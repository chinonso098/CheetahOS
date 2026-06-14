import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { BaseService } from './base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { ChatMessage } from 'src/app/system-apps/chatter/model/chat.message';
import { SessionManagementService } from './session.management.service';
import { IUserData } from 'src/app/system-apps/chatter/model/chat.interfaces';
import { SocketService } from './socket.service';

// ---------------------------------------------------------------------------
// Defensive payload coercers
// Socket payloads arrive untyped (`any`) from the network, so every field is
// run through one of these tiny guards before use. They never throw and always
// return a safe default, which keeps the raise*-handlers below free of clutter.
// ---------------------------------------------------------------------------
type AnyObj = Record<string, any>;

/** True when `v` is a non-null object (arrays included). */
function isObj(v: any): v is AnyObj {
  return typeof v === 'object' && v !== null;
}
/** Coerce to a string, defaulting to '' for non-strings. */
function s(v: any): string {
  return typeof v === 'string' ? v : '';
}
/** Coerce to a trimmed, non-empty string, or '' when blank/invalid. */
function sNE(v: any): string {
  const out = s(v).trim();
  return out.length ? out : '';
}
/** Coerce to a boolean, defaulting to false for non-booleans. */
function b(v: any): boolean {
  return typeof v === 'boolean' ? v : false;
}

// Not provided in root: ChatterService is consumed solely by ChatterComponent,
// which lists it in its own `providers`. This scopes a fresh instance to each
// (single-instance) chatter window and tears it down when the window closes.
@Injectable()
export class ChatterService implements BaseService {
  private _runningProcessService!: RunningProcessService;
  private _processIdService!: ProcessIDService;
  private _sessionManagementService!: SessionManagementService;
  private _socketService!: SocketService;

  private _connectedUserCounter = 0;
  private _comeOnlineTS = -1;
  private _chatData: ChatMessage[] = [];
  private _onlineUsers: IUserData[] = [];

  // One subscription per inbound socket event. All are created in
  // setSubscriptions() and torn down together in terminateSubscriptions()
  // when the chatter window closes.
  private _newMessageReceivedSub!: Subscription;
  private _priorMessagesSub!: Subscription;
  private _newUserInformationSub!: Subscription;
  private _updateOnlineUserListSub!: Subscription;
  private _updateUserNameSub!: Subscription;
  private _updateUserCountSub!: Subscription;
  private _userOfflineRemoveUserInfoSub!: Subscription;
  private _userIsTypingSub!: Subscription;
  private _userStoppedTypingSub!: Subscription;

  private readonly NEW_MSG_EVT = 'newMessage';
  private readonly NEW_USER_INFO_EVT = 'newUserInfo';
  private readonly UPDATE_USER_NAME_EVT = 'updateUserName';
  private readonly REMOVE_USER_INFO_EVT = 'removeUserInfo';
  private readonly USER_TYPING_STATE_EVT = 'userTypingState';
  private readonly USER_IS_TYPING_EVT = 'userIsTyping';
  private readonly USER_STOPPED_TYPING_EVT = 'userStoppedTyping';
  private readonly UPDATE_ONLINE_USER_COUNT_EVT = 'updateOnlineUserCount';
  private readonly UPDATE_ONLINE_USER_LIST_EVT = 'updateOnlineUserList';
  private readonly FETCH_PRIOR_MSG_EVT = 'fetchPriorMessages';
  private readonly PRIOR_MSG_EVT = 'priorMessages';

  // UI-facing notifiers. ChatterComponent subscribes to these and refreshes its
  // view whenever the service mutates chat/user state from an inbound event.
  newMessageNotify: Subject<void> = new Subject<void>();
  userCountChangeNotify: Subject<number> = new Subject<number>();
  newUserInformationNotify: Subject<void> = new Subject<void>();
  updateOnlineUserListNotify: Subject<void> = new Subject<void>();
  updateUserNameOrStateNotify: Subject<void> = new Subject<void>();
  // Fired after the server's prior-message history has been loaded into
  // _chatData, so the component can render the backfilled conversation.
  priorMessagesNotify: Subject<void> = new Subject<void>();

  name = 'chatter_msg_svc';
  icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
  processId = 0;
  type = ProcessType.Background;
  status = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = ' ';

  constructor(
    processIDService: ProcessIDService,
    runningProcessService: RunningProcessService,
    sessionManagementService: SessionManagementService
  ) {
    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;
    this._sessionManagementService = sessionManagementService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  sendChatMessage(data: ChatMessage) {
    this._socketService.sendMessage(this.NEW_MSG_EVT, data);
  }

  sendUserOnlineAddInfoMessage(data: IUserData) {
    this._socketService.sendMessage(this.NEW_USER_INFO_EVT, data);
  }

  sendUserOfflineRemoveInfoMessage(data: IUserData) {
    // Tell the server we are leaving. Subscription teardown is handled
    // explicitly by ChatterComponent.ngOnDestroy via terminateSubscriptions(),
    // so there is no timer-based cleanup here.
    this._socketService.sendMessage(this.REMOVE_USER_INFO_EVT, data);
  }

  sendUpdateUserNameMessage(data: IUserData) {
    this._socketService.sendMessage(this.UPDATE_USER_NAME_EVT, data);
  }

  // Counterpart to setComeOnlineTS(): announces this client's online timestamp
  // and the count it currently sees. The server does not yet handle this inbound
  // event, so today this is effectively a no-op kept ready for that wiring.
  sendUpdateOnlineUserCountMessage() {
    const data = { timeStamp: this._comeOnlineTS, userCount: this._connectedUserCounter };
    this._socketService.sendMessage(this.UPDATE_ONLINE_USER_COUNT_EVT, data);
  }

  sendUserTypingStateMessage(isTyping: boolean) {
    this._socketService.sendMessage(this.USER_TYPING_STATE_EVT, isTyping);
  }

  // Ask the server for the full chat history. The reply arrives asynchronously
  // on the PRIOR_MSG_EVT channel and is handled by raisePriorMessagesReceived().
  sendFetchPriorMessagesMessage() {
    this._socketService.sendMessage(this.FETCH_PRIOR_MSG_EVT, null);
  }

  saveUserData(value: IUserData) {
    this._sessionManagementService.addSession(this.name, value);
  }

  getUserData() {
    return this._sessionManagementService.getSession(this.name);
  }

  getChatData(): ChatMessage[] {
    return this._chatData;
  }

  getListOfOnlineUsers(): IUserData[] {
    return this._onlineUsers;
  }

  getUserCount(): number {
    return this._connectedUserCounter;
  }

  setComeOnlineTS(timeStamp: number): void {
    this._comeOnlineTS = timeStamp;
  }

  // Apply the authoritative online-user count pushed by the server.
  // Expected `payload` shape: { timeStamp: number, userCount: number }.
  private applyOnlineUserCount(payload: any): void {
    if (!payload) return;

    this._connectedUserCounter =
      typeof payload.userCount === 'number' ? payload.userCount : 0;

    // The numeric arg is a legacy signal the component's handler expects.
    this.userCountChangeNotify.next(1);
  }

  // A chat message arrived from another user: validate, build a ChatMessage,
  // append it to history, and notify the UI to render it.
  private raiseNewMessageReceived(chatMsg: any): void {
    if (!isObj(chatMsg)) return;

    // Payloads currently use underscore-prefixed fields (ChatMessage shape).
    const msg = sNE(chatMsg['_msg']);
    const userId = sNE(chatMsg['_userId']);
    const userName = sNE(chatMsg['_userName']);

    if (!msg || !userId || !userName) return;

    const userNameAcronym = s(chatMsg['_userNameAcronym']);
    const iconColor = s(chatMsg['_iconColor']);
    const msgDate = s(chatMsg['_msgDate'] );
    const isAppMsg = b(chatMsg['_isAppMsg']);
    const isUserNameEdit = b(chatMsg['_isUserNameEdit']);

    const newChatData = new ChatMessage(msg, userId, userName, userNameAcronym, iconColor, msgDate);
    newChatData.setIsAppMgs = isAppMsg;
    newChatData.setIsUserNameEdit = isUserNameEdit;

    this._chatData.push(newChatData);
    this.newMessageNotify.next();
  }

  // The server returned the stored chat history (a flat record per message).
  // Rebuild ChatMessage instances, preserving each original send time, and
  // replace the local history wholesale (this is the initial backfill on open).
  private raisePriorMessagesReceived(priorMessages: any): void {
    if (!Array.isArray(priorMessages)) return;

    const restored: ChatMessage[] = [];
    for (const rec of priorMessages) {
      if (!isObj(rec)) continue;

      const msg = sNE(rec['msg']);
      const userId = sNE(rec['userId']);
      const userName = sNE(rec['userName']);
      if (!msg || !userId || !userName) continue;

      const userNameAcronym = s(rec['userNameAcronym']);
      const iconColor = s(rec['iconColor']);

      const chatMessage = new ChatMessage(msg, userId, userName, userNameAcronym, iconColor);
      // Preserve the real send time from the stored numeric timestamp, formatted
      // to match ChatMessage's own date style.
      const timestamp = typeof rec['timestamp'] === 'number' ? rec['timestamp'] : Date.now();
      chatMessage.setMsgDate = new Date(timestamp).toLocaleString('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      chatMessage.setIsAppMgs = b(rec['isAppMsg']);
      chatMessage.setIsUserNameEdit = b(rec['isUserNameEdit']);

      restored.push(chatMessage);
    }

    this._chatData = restored;
    this.priorMessagesNotify.next();
  }

  // Add the user to the online list, or update the existing entry in place.
  // Returns true when a new user was added, false when an existing one was updated.
  private upsertOnlineUser(user: IUserData): boolean {
    const idx = this._onlineUsers.findIndex((x) => x.userId === user.userId);
    if (idx === -1) {
      this._onlineUsers.push(user);
      return true;
    }
    // Update the existing record in place so external references stay valid.
    const curr = this._onlineUsers[idx];
    curr.userName = user.userName;
    curr.userNameAcronym = user.userNameAcronym;
    curr.color = user.color;
    curr.isTyping = user.isTyping;
    this._onlineUsers[idx] = curr;
    return false;
  }

  private raiseNewUserInformationReceived(userInfo: any): void {
    if (!isObj(userInfo)) return;

    const userId = sNE(userInfo['userId']);
    const userName = sNE(userInfo['userName']);
    if (!userId || !userName) return;

    const newUser: IUserData = {
      userId,
      userName,
      userNameAcronym: s(userInfo['userNameAcronym']),
      color: s(userInfo['color']),
      isTyping: b(userInfo['isTyping']),
    };

    // Insert or update; notify the UI either way (both add and update matter).
    this.upsertOnlineUser(newUser);
    this.newUserInformationNotify.next();
  }

  // Server pushed the full online-user roster (e.g. when this client joins).
  // Sanitise every entry, then replace the local list wholesale.
  private raiseUpdateOnlineUserListReceived(onlineUserList: any): void {
    if (!onlineUserList || !Array.isArray(onlineUserList)) return;

    const cleaned: IUserData[] = [];
    for (const u of onlineUserList) {
      if (!isObj(u)) continue;
      const userId = sNE(u['userId']);
      const userName = sNE(u['userName']);
      if (!userId || !userName) continue;

      cleaned.push({
        userId,
        userName,
        userNameAcronym: s(u['userNameAcronym']),
        color: s(u['color']),
        isTyping: b(u['isTyping']),
      });
    }

    if (cleaned.length === 0) return;

    // Replace the whole roster with the sanitised copy.
    this._onlineUsers = cleaned;
    this.updateOnlineUserListNotify.next();
  }

  // Another user renamed themselves: merge the new name into the roster.
  private raiseUpdateUserNameReceived(userInfo: any): void {
    if (!isObj(userInfo)) return;

    const userId = sNE(userInfo['userId']);
    const userName = sNE(userInfo['userName']);
    if (!userId || !userName) return;

    const newUserInfo: IUserData = {
      userId,
      userName,
      userNameAcronym: s(userInfo['userNameAcronym']),
      color: s(userInfo['color']),
      isTyping: b(userInfo['isTyping']),
    };

    this.upsertOnlineUser(newUserInfo);
    this.updateUserNameOrStateNotify.next();
  }

  // Toggle a user's typing indicator. `userInfo` is just their userId here.
  private raiseUserTypingStateReceived(userInfo: any, isTyping: boolean): void {
    const userId = sNE(userInfo);
    if (!userId) return;

    const idx = this._onlineUsers.findIndex((x) => x.userId === userId);
    if (idx === -1) return;

    this._onlineUsers[idx].isTyping = isTyping;
    this.updateUserNameOrStateNotify.next();
  }

  // A user went offline: drop them from the roster and refresh the list only
  // if someone was actually removed. `userInfo` is the departing userId.
  private raiseRemoveUserFromOnlineListReceived(userInfo: any): void {
    const userId = sNE(userInfo);
    if (!userId) return;

    const originalLength = this._onlineUsers.length;
    this._onlineUsers = this._onlineUsers.filter((x) => x.userId !== userId);

    if (this._onlineUsers.length < originalLength) {
      this.updateOnlineUserListNotify.next();
    }
  }

  // Tear down every inbound-event subscription. Safe to call repeatedly: each
  // unsubscribe is null-guarded and unsubscribing an already-closed sub is a
  // no-op, so an extra call can never throw.
  terminateSubscriptions(): void {
    this._newMessageReceivedSub?.unsubscribe();
    this._priorMessagesSub?.unsubscribe();
    this._newUserInformationSub?.unsubscribe();
    this._updateOnlineUserListSub?.unsubscribe();
    this._updateUserNameSub?.unsubscribe();
    this._updateUserCountSub?.unsubscribe();
    this._userOfflineRemoveUserInfoSub?.unsubscribe();
    this._userIsTypingSub?.unsubscribe();
    this._userStoppedTypingSub?.unsubscribe();
  }

  setSocketInstance(socketService: SocketService): void {
    this._socketService = socketService;
  }

  // Wire one subscription per inbound socket event. Must be called AFTER
  // setSocketInstance(). ChatterComponent calls this once on open and pairs it
  // with terminateSubscriptions() on close.
  setSubscriptions(): void {
    this._newMessageReceivedSub = this._socketService
      .onMessageEvent(this.NEW_MSG_EVT)
      .subscribe((p) => this.raiseNewMessageReceived(p));

    this._priorMessagesSub = this._socketService
      .onMessageEvent(this.PRIOR_MSG_EVT)
      .subscribe((p) => this.raisePriorMessagesReceived(p));

    this._newUserInformationSub = this._socketService
      .onMessageEvent(this.NEW_USER_INFO_EVT)
      .subscribe((t) => this.raiseNewUserInformationReceived(t));

    this._updateOnlineUserListSub = this._socketService
      .onMessageEvent(this.UPDATE_ONLINE_USER_LIST_EVT)
      .subscribe((t) => this.raiseUpdateOnlineUserListReceived(t));

    this._updateUserNameSub = this._socketService
      .onMessageEvent(this.UPDATE_USER_NAME_EVT)
      .subscribe((t) => this.raiseUpdateUserNameReceived(t));

    this._userIsTypingSub = this._socketService
      .onMessageEvent(this.USER_IS_TYPING_EVT)
      .subscribe((t) => this.raiseUserTypingStateReceived(t, true));

    this._userStoppedTypingSub = this._socketService
      .onMessageEvent(this.USER_STOPPED_TYPING_EVT)
      .subscribe((t) => this.raiseUserTypingStateReceived(t, false));

    this._updateUserCountSub = this._socketService
      .onMessageEvent(this.UPDATE_ONLINE_USER_COUNT_EVT)
      .subscribe((j) => this.applyOnlineUserCount(j));

    this._userOfflineRemoveUserInfoSub = this._socketService
      .onMessageEvent(this.REMOVE_USER_INFO_EVT)
      .subscribe((t) => this.raiseRemoveUserFromOnlineListReceived(t));
  }

  private getProcessDetail(): Process {
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

  private getServiceDetail(): Service {
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
  }
}