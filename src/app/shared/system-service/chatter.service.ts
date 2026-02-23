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
import { SessionManagmentService } from './session.management.service';
import { IUserData } from 'src/app/system-apps/chatter/model/chat.interfaces';
import { SocketService } from './socket.service';

type AnyObj = Record<string, any>;

function isObj(v: any): v is AnyObj {
  return typeof v === 'object' && v !== null;
}
function s(v: any): string {
  return typeof v === 'string' ? v : '';
}
function sNE(v: any): string {
  const out = s(v).trim();
  return out.length ? out : '';
}
function b(v: any): boolean {
  return typeof v === 'boolean' ? v : false;
}

@Injectable({
  providedIn: 'root',
})
export class ChatterService implements BaseService {
  private _runningProcessService!: RunningProcessService;
  private _processIdService!: ProcessIDService;
  private _sessionManagmentService!: SessionManagmentService;
  private _socketService!: SocketService;

  private _connectedUserCounter = 0;
  private _comeOnlineTS = -1;
  private _chatData: ChatMessage[] = [];
  private _onlineUsers: IUserData[] = [];

  private _newMessagRecievedSub!: Subscription;
  private _userConnectSub!: Subscription; // left as-is (non-breaking), even if unused currently
  private _userDisconnectSub!: Subscription;
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

  newMessageNotify: Subject<void> = new Subject<void>();
  userCountChangeNotify: Subject<number> = new Subject<number>();
  newUserInformationNotify: Subject<void> = new Subject<void>();
  updateOnlineUserListNotify: Subject<void> = new Subject<void>();
  updateOnlineUserCountNotify: Subject<void> = new Subject<void>(); // kept for compatibility
  updateUserNameOrStateNotify: Subject<void> = new Subject<void>();
  updateUserCountNotify: Subject<void> = new Subject<void>(); // kept for compatibility

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
    sessionManagmentService: SessionManagmentService
  ) {
    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;
    this._sessionManagmentService = sessionManagmentService;

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
    this._socketService.sendMessage(this.REMOVE_USER_INFO_EVT, data);

    setTimeout(() => {
      this.terminateSubscriptions();
    }, 35);
  }

  sendUpdateUserNameMessage(data: IUserData) {
    this._socketService.sendMessage(this.UPDATE_USER_NAME_EVT, data);
  }

  sendUpdateOnlineUserCountMessage() {
    const data = { timeStamp: this._comeOnlineTS, userCount: this._connectedUserCounter };
    this._socketService.sendMessage(this.UPDATE_ONLINE_USER_COUNT_EVT, data);
  }

  sendUserTypingStateMessage(isTyping: boolean) {
    this._socketService.sendMessage(this.USER_TYPING_STATE_EVT, isTyping);
  }

  saveUserData(value: IUserData) {
    this._sessionManagmentService.addSession(this.name, value);
  }

  getUserData() {
    return this._sessionManagmentService.getSession(this.name);
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

  private updateUserCountAfterComparing(userCount: any) {
    if (!userCount) return;

    const uCount = typeof userCount.userCount === 'number' ? userCount.userCount : 0;
    this._connectedUserCounter = uCount;

    // preserve your existing signal
    this.userCountChangeNotify.next(1);
  }

  private raiseNewMessageReceived(chatMsg: any): void {
    if (!isObj(chatMsg)) return;

    // Accept both underscore (current) and flat (future safe) payloads
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

  private upsertOnlineUser(user: IUserData): boolean {
    const idx = this._onlineUsers.findIndex((x) => x.userId === user.userId);
    if (idx === -1) {
      this._onlineUsers.push(user);
      return true;
    }
    // Update in place
    const curr = this._onlineUsers[idx];
    curr.userName = user.userName;
    curr.userNameAcronym = user.userNameAcronym;
    curr.color = user.color;
    curr.isTyping = user.isTyping;
    this._onlineUsers[idx] = curr;
    return false;
  }

  private raiseNewUserInformationRecieved(userInfo: any): void {
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

    const wasAdded = this.upsertOnlineUser(newUser);
    // Keep your old behavior: notify on new info; safe for both add/update
    this.newUserInformationNotify.next();

    // If you ever want “only on add”, you can gate on wasAdded later (not doing it now).
    void wasAdded;
  }

  private raiseUpdateOnlineUserListRecieved(onlinerUserList: any): void {
    if (!onlinerUserList || !Array.isArray(onlinerUserList)) return;

    const cleaned: IUserData[] = [];
    for (const u of onlinerUserList) {
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

    // Replace list (your existing behavior)
    this._onlineUsers = cleaned;
    this.updateOnlineUserListNotify.next();
  }

  private raiseUpdateUserNameRecieved(userInfo: any): void {
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

  private raiseUserTypingStateRecieved(userInfo: any, isTyping: boolean): void {
    const userId = sNE(userInfo);
    if (!userId) return;

    const idx = this._onlineUsers.findIndex((x) => x.userId === userId);
    if (idx === -1) return;

    this._onlineUsers[idx].isTyping = isTyping;
    this.updateUserNameOrStateNotify.next();
  }

  private raiseRemoveUserFromOnlineListRecieved(userInfo: any): void {
    const userId = sNE(userInfo);
    if (!userId) return;

    const originalLength = this._onlineUsers.length;
    this._onlineUsers = this._onlineUsers.filter((x) => x.userId !== userId);

    if (this._onlineUsers.length < originalLength) {
      this.updateOnlineUserListNotify.next();
    }
  }

  private terminateSubscriptions(): void {
    // Idempotent cleanup
    this._newMessagRecievedSub?.unsubscribe();
    this._userDisconnectSub?.unsubscribe();
    this._userConnectSub?.unsubscribe();
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

  setSubscriptions(): void {
    this._newMessagRecievedSub = this._socketService
      .onMessageEvent(this.NEW_MSG_EVT)
      .subscribe((p) => this.raiseNewMessageReceived(p));

    this._newUserInformationSub = this._socketService
      .onMessageEvent(this.NEW_USER_INFO_EVT)
      .subscribe((t) => this.raiseNewUserInformationRecieved(t));

    this._updateOnlineUserListSub = this._socketService
      .onMessageEvent(this.UPDATE_ONLINE_USER_LIST_EVT)
      .subscribe((t) => this.raiseUpdateOnlineUserListRecieved(t));

    this._updateUserNameSub = this._socketService
      .onMessageEvent(this.UPDATE_USER_NAME_EVT)
      .subscribe((t) => this.raiseUpdateUserNameRecieved(t));

    this._userIsTypingSub = this._socketService
      .onMessageEvent(this.USER_IS_TYPING_EVT)
      .subscribe((t) => this.raiseUserTypingStateRecieved(t, true));

    this._userStoppedTypingSub = this._socketService
      .onMessageEvent(this.USER_STOPPED_TYPING_EVT)
      .subscribe((t) => this.raiseUserTypingStateRecieved(t, false));

    this._updateUserCountSub = this._socketService
      .onMessageEvent(this.UPDATE_ONLINE_USER_COUNT_EVT)
      .subscribe((j) => this.updateUserCountAfterComparing(j));

    this._userOfflineRemoveUserInfoSub = this._socketService
      .onMessageEvent(this.REMOVE_USER_INFO_EVT)
      .subscribe((t) => this.raiseRemoveUserFromOnlineListRecieved(t));
  }

  private getProcessDetail(): Process {
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

  private getServiceDetail(): Service {
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
  }
}