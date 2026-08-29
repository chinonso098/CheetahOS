/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';

import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SocketService } from 'src/app/shared/system-service/socket.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';

import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';

import { ChatMessage } from './model/chat.message';
import { IUser, IUserData } from './model/chat.interfaces';
import { ChatterBot } from './chatter.bot';
import { ProfanityFilter } from './model/profanity.filter';
import { ReservedNameValidator } from './model/reserved.name.validator';
import { Subscription } from 'rxjs';
import { AppState } from 'src/app/system-files/state/state.interface';
import { ChatterService } from 'src/app/application-services/chatter.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';



@Component({
  selector: 'cos-chatter',
  templateUrl: './chatter.component.html',
  styleUrl: './chatter.component.css',
  standalone:false,
  providers: [SocketService, ChatterService] // New instance per component
})
export class ChatterComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  @ViewChild('chatterContainer', {static: true}) chatterContainer!: ElementRef;
  @ViewChild('chatHistoryOutput', {static: true}) chatHistoryOutput!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _windowService!:WindowService;
  private _chatService!:ChatterService;
  private _socketService!:SocketService;
  private _audioService!:AudioService;
  private _sessionManagementService: SessionManagementService;
  private _defaultService: DefaultService;
  private _systemNotificationService: SystemNotificationService;

  private _themeService!:ThemeService;
  // Tracks the system light/dark theme so the chat UI can recolor. Bound to the
  // host as `theme-light`; the existing dark styling is the CSS default.
  @HostBinding('class.theme-light') isLightTheme = false;
  private _themeChangeSub!: Subscription;

  private _newChatMessageSub!: Subscription;
  private _messageUpdateSub!: Subscription;
  // The message currently open for editing (null = normal compose mode). Only
  // the user's OWN, non-app messages are editable; submitting sends a
  // messageUpdate rather than a newMessage.
  private _editingMsg: ChatMessage | null = null;
  private _priorMessagesSub!: Subscription;
  private _userCountChangeSub!: Subscription;
  private _newUserInfomationSub!: Subscription;
  private _updateOnlineUserListSub!: Subscription;
  private _updateUserNameOrStatusSub!: Subscription;
  private _windowResizeSub!: Subscription;

  private _formBuilder;
  chatterForm!: FormGroup;
  chatUserForm!: FormGroup;
  formCntrlName = 'msgText';

  userNameAcronymStyle:Record<string, unknown> = {};

  private _appState!:AppState;
  A_NEW_USER_HAS_JOINED_THE_CHAT_MSG = 0;
  USER_HAS_LEFT_THE_CHAT_MSG = 1;
  USER_CHANGED_NAME_MSG = 2;
  SCROLL_DELAY = 300;
  SECONDS_DELAY = 250;

  showUserNameLabel = true;
  showUserNameForm = false;
  isTyping = false;
  isFirstOnlineUserUpdateResponse = true;
  // Drives the one-time "welcome" border animation on the username label
  // (pulsating -> steady purple -> transparent). Only true on first launch.
  showFirstRunHighlight = false;
  messageLastRecieved = Constants.EMPTY_STRING;
  scrollCounter = 0;
  userCount = 0;

  userNameAcronym = Constants.EMPTY_STRING;
  bkgrndIconColor = Constants.EMPTY_STRING;
  userName = Constants.EMPTY_STRING;
  userId= Constants.EMPTY_STRING;

  chatData: ChatMessage[] = [];
  onlineUsers: IUserData[] = [];
  onlineUsersListFirstUpdateTS = 0;
  chatUser!: IUser;
  chatUserData!:IUserData;

  RETRIEVAL_DELAY = 150;
  currIteration = 0;
  prevScrollHeight = 0;

  // ── Chatter bot ────────────────────────────────────────────────────────
  // Client-side companion that becomes active when the room is empty or nearly
  // so (0 or 1 other humans online). It replies to the user's posts and shows
  // up in the online-user list so a lone user isn't left talking to no one.
  private readonly _chatterBot = new ChatterBot();
  // Routing policy for the user<->bot exchange while the user is alone.
  //   true  (default) -> those messages (the user's posts, their edits, and the
  //                      bot's own lines) stay entirely on this machine.
  //   false           -> they are sent to the server like any normal chat.
  keepUserAndBotChatLocal = false;
  // Number of OTHER humans online (server count minus self). Source of truth
  // for bot activation; `userCount` below is the display value (may include the
  // bot). Kept separate so activation never reads its own bot-inflated count.
  private _humanOthersOnline = 0;
  // Guards the one-time greeting; only posted after history has loaded so the
  // initial `chatData = priorMessages` assignment can't wipe it out.
  private _botGreeted = false;
  private _priorMessagesLoaded = false;
  // Ensures we only ever schedule ONE pending greeting attempt at a time.
  private _greetingScheduled = false;
  // Short pause before greeting so the server's online-user count can settle
  // after join. We then re-read the freshest count and only greet if the user
  // is genuinely alone — never a stale "no one else is around" when someone was
  // already in the room.
  private readonly BOT_GREETING_DELAY = 1500;
  // Tracks the bot's active state across refreshes so we can detect the
  // active -> inactive transition (a second human joined) and fire a one-shot
  // snarky farewell before the bot bows out.
  private _botWasActive = false;
  // Pending bot reply timers, cleared on destroy so a closing window never
  // fires a late reply against a torn-down view.
  private readonly _botTimeoutIds = new Set<ReturnType<typeof setTimeout>>();

  // Leading-edge throttle for keeping the lock screen awake while typing.
  // The first keystroke resets the idle timer immediately; further keys are
  // ignored until the cooldown elapses, at which point the next keystroke
  // fires again. Cheaper than resetting on every keystroke, and (unlike a
  // sleep-and-refire loop) never fires once typing has actually stopped.
  private readonly LOCK_AWAKE_THROTTLE_MS = 5000;
  private _lockAwakeCoolingDown = false;
  private _lockAwakeThrottleId?: ReturnType<typeof setTimeout>;

  logonAudio = `${Constants.AUDIO_BASE_PATH}cheetah_logon.wav`;
  newMsgAudio = `${Constants.AUDIO_BASE_PATH}cheetah_notify_messaging.wav`;

  chatPrompt = 'Type a message';
  isMaximizable = true;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
  readonly name = 'chatter';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Chatter';

  // Floor at which we still try to reflow. Below this, the user can
  // see the window but the layout is intentionally clipped (see CSS
  // min-width / min-height on .chatter-main-container).
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  constructor(socketService:SocketService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
              windowService:WindowService, formBuilder:FormBuilder, chatService:ChatterService, audioService:AudioService,
              sessionManagementService:SessionManagementService, themeService:ThemeService, private _cdr:ChangeDetectorRef,
              defaultService:DefaultService, systemNotificationService:SystemNotificationService){ 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._socketService = socketService;
    this._audioService = audioService;
    this._chatService = chatService;
    this._sessionManagementService = sessionManagementService;
    this._themeService = themeService;
    this._defaultService = defaultService;
    this._systemNotificationService = systemNotificationService;

    this._chatService.setSocketInstance(socketService);
    this._chatService.setSubscriptions();
    this._formBuilder = formBuilder

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this.setDefaults();

    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });


    this._newChatMessageSub = this._chatService.newMessageNotify.subscribe((msg)=> this.updateChatData(msg));
    this._messageUpdateSub = this._chatService.messageUpdateNotify.subscribe((msg)=> this.applyIncomingMessageUpdate(msg));
    this._userCountChangeSub = this._chatService.userCountChangeNotify.subscribe((p)=> this.updateOnlineUserCount(p));
    this._newUserInfomationSub = this._chatService.newUserInformationNotify.subscribe(()=> this.updateOnlineUserList());
    this._updateOnlineUserListSub =  this._chatService.updateOnlineUserListNotify.subscribe(()=> this.updateOnlineUserList());
    this._updateUserNameOrStatusSub =  this._chatService.updateUserNameOrStateNotify.subscribe(()=> this.updateOnlineUserList());

    // When the server's chat history arrives (in response to our fetch in
    // ngAfterViewInit), render it via the existing batched-load routine.
    this._priorMessagesSub = this._chatService.priorMessagesNotify.subscribe(()=> this.retrieveEarlierMessages());

    // Live reflow when the primary window is resized. CSS flex already
    // tracks the size; this just ensures change-detection runs so any
    // bound style/state (footer message length, scroll position) updates.
    // this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
    //   if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
    //   this.onWindowResize();
    // });
  }

  async ngOnInit(): Promise<void> {
    this.userNameAcronymStyle = { 'background-color': this.bkgrndIconColor };

    this.chatterForm = this._formBuilder.nonNullable.group({ msgText: Constants.EMPTY_STRING });
    this.chatUserForm = this._formBuilder.group({
      firstName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),ProfanityFilter.validator]],
      lastName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),ProfanityFilter.validator]],
    }, { validators: ReservedNameValidator.validator });

    // set as my timestamp for when i came online
    this._chatService.setComeOnlineTS(Date.now());

    // First time the app is opened, briefly highlight the username label so the
    // user notices they can click it to set their name.
    this.showFirstRunHighlight = this.isFirstAppLaunch();
  }

  /** True if this app has been launched at most once, per the persisted
   *  `system_metrics` usage log. A missing entry also counts as first-run. */
  private isFirstAppLaunch(): boolean {
    try {
      const raw = localStorage.getItem('system_metrics');
      if (!raw) return true;
      const usage = JSON.parse(raw) as { name: string; launchCount: number }[];
      if (!Array.isArray(usage)) return true;
      const entry = usage.find((u) => u?.name === this.name);
      return !entry || (entry.launchCount ?? 0) <= 1;
    } catch {
      return false;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    const userOnlineSendDelay = 250;
    const audioDelay = 1500; //1s
    const fetchPriorMessagesDelay = 2000; //2s

    await CommonFunctions.sleep(audioDelay);
    await this._audioService.play(this.logonAudio);

    await CommonFunctions.sleep(userOnlineSendDelay);
    this._chatService.sendUserOnlineAddInfoMessage(this.chatUserData);
    this.generateAndSendAppMessages(this.A_NEW_USER_HAS_JOINED_THE_CHAT_MSG);

    // Request the chat history from the server. The reply is handled by the
    // priorMessagesNotify subscription, which then calls retrieveEarlierMessages().
    await CommonFunctions.sleep(fetchPriorMessagesDelay);
    const whoami = this._defaultService.getDefaultSetting(Constants.DEFAULT_WHO_IS_THIS) ?? Constants.UNKNOWN;
    this._chatService.sendFetchPriorMessagesMessage(whoami);

    await CommonFunctions.sleep(this.SECONDS_DELAY)
    await this.captureComponentImg();
  }

  async ngOnDestroy(): Promise<void>{
    const delay = 25;
    this._chatService.sendUserOfflineRemoveInfoMessage(this.chatUserData);
    this.generateAndSendAppMessages(this.USER_HAS_LEFT_THE_CHAT_MSG);
    

    await CommonFunctions.sleep(delay);
    this._newChatMessageSub?.unsubscribe();
    this._messageUpdateSub?.unsubscribe();
    this._priorMessagesSub?.unsubscribe();
    this._userCountChangeSub?.unsubscribe();
    this._newUserInfomationSub?.unsubscribe();
    this._updateOnlineUserListSub?.unsubscribe();
    this._updateUserNameOrStatusSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    this._themeChangeSub?.unsubscribe();
    this._socketService.disconnect();
    clearTimeout(this._lockAwakeThrottleId);

    // Cancel any pending bot replies so a closing window can't fire late.
    this._botTimeoutIds.forEach(id => clearTimeout(id));
    this._botTimeoutIds.clear();
    
    const ssPid = this._socketService.processId;
    const socketProccess = this._runningProcessService.getProcess(ssPid);
    if(socketProccess)
      this._runningProcessService.removeProcess(socketProccess);

    // ChatterService is now component-scoped, so it registers a process on every
    // open. Remove it here to mirror the socket cleanup and avoid leaking entries.
    this._chatService.terminateSubscriptions();
    const csPid = this._chatService.processId;
    const chatterProcess = this._runningProcessService.getProcess(csPid);
    if(chatterProcess)
      this._runningProcessService.removeProcess(chatterProcess);
  }

  async updateChatData(newMsg?:ChatMessage):Promise<void>{
    const delay = 500; //500ms

    // Append ONLY the newly-received message rather than replacing the whole
    // view with the service's history. The service only holds server-fetched
    // history + messages from OTHER users; the local user's own posts and all
    // bot messages live only in `this.chatData`. A full replace (the old
    // behaviour) wiped those the instant a networked message arrived — e.g.
    // when a second user joined. Appending preserves the local conversation.
    if(newMsg){
      this.chatData.push(newMsg);
    }else{
      this.chatData = this._chatService.getChatData();
    }
    this.setMessageLastReceievedTime();

    await this._audioService.play(this.newMsgAudio);
    await CommonFunctions.sleep(delay);
    this.scrollToBottom();
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.chatterContainer, this.processId, this.name, this.icon, this._windowService);
  }

  /** Triggered whenever the primary window broadcasts a resize/maximize.
   *  CSS flex handles the visual reflow; we just nudge change detection
   *  and keep the chat view scrolled to the latest message so the user
   *  doesn't end up looking at empty space after the window grows. */
  private onWindowResize():void{
    this._cdr.detectChanges();
    requestAnimationFrame(() => {
      try { this.scrollToBottom(); } catch { /* view not ready */ }
    });
  }

  updateOnlineUserCount(_value:number):void{
    // `_value` is a legacy add/broadcast flag; the authoritative count comes
    // from the service. Subtract 1 to exclude yourself → OTHER humans online.
    const currentUserCount = this._chatService.getUserCount();
    this._humanOthersOnline = Math.max(0, currentUserCount - 1);
    this.refreshBotPresence();
  }

  generateAndSendAppMessages(msgType:number, userName?:string):void{

    let chatInput = Constants.EMPTY_STRING;
    if(msgType == this.A_NEW_USER_HAS_JOINED_THE_CHAT_MSG){
      chatInput = `${this.userName} has joined the chat.`
    }else if(msgType == this.USER_HAS_LEFT_THE_CHAT_MSG){
      chatInput = `${this.userName} has left the chat.`
    }else{
      chatInput = `${userName} has changed name to ${this.userName}.`
    }

    const chatObj = new ChatMessage(chatInput, this.userId, this.userName);
    chatObj.setIsAppMsg = true;

    if(msgType === this.USER_CHANGED_NAME_MSG)
        chatObj.setIsUserNameEdit = true;

    this._chatService.sendChatMessage(chatObj);

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
  }

  updateOnlineUserList():void{
    this.onlineUsers = this._chatService.getListOfOnlineUsers();
    // The service roster overwrites onlineUsers, so re-attach the bot entry
    // (and re-sync the displayed count) whenever it changes.
    this.refreshBotPresence();
  }

  /**
   * Keep the bot's roster entry and the displayed online count in sync with
   * whether the bot is currently active (i.e. the room is empty or nearly so).
   * Also posts the one-time greeting, but only once history has loaded so it
   * can't be clobbered by the initial prior-messages assignment.
   */
  private refreshBotPresence():void{
    const active = this._chatterBot.isActive(this._humanOthersOnline);

    // Rebuild the roster: strip any stale bot entry, re-add when active.
    this.onlineUsers = this.onlineUsers.filter(u => u.userId !== ChatterBot.BOT_USER_ID);
    if(active)
      this.onlineUsers = [...this.onlineUsers, this._chatterBot.userData];

    // Footer reflects the bot's presence so it never reads "online:0".
    this.userCount = this._humanOthersOnline + (active ? 1 : 0);

    // Looks like we're alone and history is ready: line up a greeting. It's
    // scheduled (not posted inline) so we can pause, re-check the freshest
    // online count, and back out if someone was actually already here.
    if(active && this._priorMessagesLoaded && !this._botGreeted){
      this.scheduleGreeting();
    }

    // A second human just joined (active -> inactive): drop a parting jab, but
    // only if the bot had actually been in the conversation (greeted), so
    // joining an already-busy room never triggers a phantom goodbye.
    if(this._botWasActive && !active && this._botGreeted){
      this.postBotMessage(this._chatterBot.farewell(), true);
    }
    this._botWasActive = active;

    this._cdr.detectChanges();
  }

  /**
   * Wait a beat, re-read the most recent online-user count, and greet ONLY if
   * the user is still genuinely alone. This closes the join race where the
   * server hadn't yet reported an existing user when we first thought the room
   * was empty — which used to produce a wrong "no one else is around" greeting.
   */
  private scheduleGreeting():void{
    if(this._greetingScheduled || this._botGreeted) return;
    this._greetingScheduled = true;

    const id = setTimeout(() => {
      this._botTimeoutIds.delete(id);

      // Pull the freshest authoritative count (minus self).
      const currentUserCount = this._chatService.getUserCount();
      this._humanOthersOnline = Math.max(0, currentUserCount - 1);

      // Re-sync roster/footer (and any farewell) against the fresh count.
      this.refreshBotPresence();

      if(this._chatterBot.isActive(this._humanOthersOnline) && !this._botGreeted){
        this._botGreeted = true;
        this.postBotMessage(this._chatterBot.greeting(), false);
      }else{
        // Someone was actually here. Stand down quietly and allow another
        // attempt later if the room truly empties out.
        this._greetingScheduled = false;
      }
    }, this.BOT_GREETING_DELAY);

    this._botTimeoutIds.add(id);
  }

  /**
   * If the bot is active, schedule a delayed, "typed" reply to the user's post.
   * The reply is local-only (never sent over the socket).
   */
  private botRespondTo(userText:string):void{
    if(!this._chatterBot.isActive(this._humanOthersOnline)) return;

    // Show the bot as typing in the roster while it "thinks".
    this._chatterBot.setTyping(true);
    this.refreshBotPresence();

    const id = setTimeout(() => {
      this._botTimeoutIds.delete(id);
      this._chatterBot.setTyping(false);
      this.refreshBotPresence();
      this.postBotMessage(this._chatterBot.replyTo(userText), true);
    }, this._chatterBot.thinkingDelayMs());

    this._botTimeoutIds.add(id);
  }

  /** Append a bot message to the local chat view and scroll to it. */
  /** True when the current message must stay on this machine: the bot is the
   *  only "participant" (user is alone) AND `keepUserAndBotChatLocal` is on.
   *  Drives every send-gate below. */
  private keepChatLocal():boolean{
    return this.keepUserAndBotChatLocal && this._chatterBot.isActive(this._humanOthersOnline);
  }

  private async postBotMessage(message:ChatMessage, playSound:boolean):Promise<void>{
    const delay = 300;
    this.chatData.push(message);
    // When we're NOT keeping the exchange local, broadcast the bot's line too so
    // the full back-and-forth is visible/persisted server-side.
    if(!this.keepUserAndBotChatLocal){
      this._chatService.sendChatMessage(message);
    }
    this.setMessageLastReceievedTime();
    this._cdr.detectChanges();

    if(playSound)
      await this._audioService.play(this.newMsgAudio);

    await CommonFunctions.sleep(delay);
    this.scrollToBottom();
  }

  // getTimeOut():number{
  //   const delays = [100, 175, 250, 325, 400, 475, 550, 525, 700, 775, 850, 925];
  //   const timeout = delays[Math.floor(Math.random() * delays.length)];
  //   return timeout;
  // }

  setDefaults():void{
    const DEV = 'Dev';
    const whoami = this._defaultService.getDefaultSetting(Constants.DEFAULT_WHO_IS_THIS);
    const uData = this._chatService.getUserData() as IUserData;
    if(!uData){
      this.userId = this.generateUserID();
      this.userName = (whoami === Constants.USER_DEV) ? DEV : `User_${this.getRandomNum()}`;
      this.userNameAcronym = (whoami === Constants.USER_DEV) ? 'D ' : 'AU';
      this.bkgrndIconColor = this.geIconColor();

      this.chatUserData = {
        userId:this.userId, 
        userName: this.userName, 
        userNameAcronym:this.userNameAcronym, 
        color:this.bkgrndIconColor,
        isTyping:false
      };
      this._chatService.saveUserData(this.chatUserData);
    }else{
      this.userId = uData.userId;
      this.userName = uData.userName;
      this.userNameAcronym = uData.userNameAcronym;
      this.bkgrndIconColor = uData.color;
      this.chatUserData = uData;

      this.chatUserData = {
        userId:this.userId, 
        userName: this.userName, 
        userNameAcronym:this.userNameAcronym, 
        color:this.bkgrndIconColor,
        isTyping:this.isTyping
      };
    }

    this.onlineUsersListFirstUpdateTS = Date.now();
    //this.onlineUsers.push(this.chatUserData);
  }

  onUpdateUserName(): void {
    if (this.chatUserForm.valid) {
      if (this.chatUserForm.dirty) {
        const oldUserName = this.userName;
        const s = { ...this.chatUser, ...this.chatUserForm.value } as IUser;
        this.userNameAcronym = `${s.lastName.charAt(0)}${s.firstName.charAt(0)}`;
        this.userName = `${s.lastName}, ${s.firstName}`;

        // retrieve the data from session and update it
        const uData = this._chatService.getUserData() as IUserData;
        uData.userName = this.userName;
        uData.userNameAcronym = this.userNameAcronym;

        this._chatService.saveUserData(uData)
        this._chatService.sendUpdateUserNameMessage(uData);
        this.generateAndSendAppMessages(this.USER_CHANGED_NAME_MSG, oldUserName);

        this.showTheUserNameLabel();
      }
    }
  }

  showTheUserNameForm():void{
    this.showUserNameForm = true;
    this.showUserNameLabel = false;
  }

  showTheUserNameLabel():void{
    this.showUserNameForm = false;
    this.showUserNameLabel = true;
  }

  focusOnInput(evt:any):void{
    evt.stopPropagation();

    const chatterMsgBoxElm= document.getElementById('chatterMsgBox') as HTMLInputElement;
    if(chatterMsgBoxElm){
      chatterMsgBoxElm?.focus();
    }

    this.focusWindow();
  }

  scrollToBottom(): void {
    // Setting scrollTop on the (overflow:auto) chat list is sufficient to
    // pin the view to the latest message.
    //
    // The previous extra `scrollIntoView` on this same element bubbled up
    // to the nearest scrollable ancestor — the primary window's
    // `.window-content-container`, which is `overflow: hidden`. Such
    // elements are still programmatically scrollable, so scrollIntoView
    // shifted the entire chatter app a few px up inside the window,
    // exposing the dark window background at the bottom; a later reflow
    // (e.g. hovering a title-bar button) reset it and it "floated back
    // down". Removed. (Same fix as terminal.component.ts.)
    this.chatHistoryOutput.nativeElement.scrollTop = this.chatHistoryOutput.nativeElement.scrollHeight;
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  async onKeyDownInInputBox(evt:KeyboardEvent):Promise<void>{
    // Any key press counts as user activity, so keep the lock screen awake.
    // Throttled internally, so this is cheap even during fast typing.
    this.keepLockScreenAwake();

    if(evt.key === "Escape"){
      this.cancelEdit();
      return;
    }

    if(evt.key === "Enter"){
      this.createChat();
    }else{
      const chatInput = this.chatterForm.value.msgText as string;
      if(chatInput!== null && chatInput.trim().length > 0) {

        this.isTyping = true;
        this.chatUserData.isTyping = true
        this._chatService.sendUserTypingStateMessage(this.isTyping)
      }else if(chatInput!== null &&  chatInput.trim().length === 0) {
        this.isTyping = false;
        this.chatUserData.isTyping = false
        this._chatService.sendUserTypingStateMessage(this.isTyping)
      }
    }
  }

  /** Leading-edge throttle: resets the lock-screen idle timer on the first
   *  keystroke, then ignores keys until LOCK_AWAKE_THROTTLE_MS elapses. The
   *  next keystroke after the cooldown fires again, so continuous typing keeps
   *  the screen unlocked while idle typing pauses let it lock normally. */
  private keepLockScreenAwake():void{
    if(this._lockAwakeCoolingDown) return;

    this._systemNotificationService.resetLockScreenTimeOutNotify.next();
    this._lockAwakeCoolingDown = true;
    this._lockAwakeThrottleId = setTimeout(() => {
      this._lockAwakeCoolingDown = false;
    }, this.LOCK_AWAKE_THROTTLE_MS);
  }

  async createChat():Promise<void>{
    const chatInput = this.chatterForm.value.msgText as string;
    const delay = 10;

    if(chatInput!== null &&  chatInput.trim().length === 0) {
      // While editing, an empty box cancels the edit instead of erroring.
      if(this._editingMsg){
        this.cancelEdit();
        return;
      }
      this.chatPrompt = 'message box can not be empty';
      return;
    }

    const cleanInput = ProfanityFilter.clean(chatInput);

    // Edit path: update an existing OWN message rather than posting a new one.
    if(this._editingMsg){
      await this.submitMessageEdit(cleanInput);
      return;
    }

    const chatObj = new ChatMessage(cleanInput, this.userId, this.userName, this.userNameAcronym, this.bkgrndIconColor);
    this.chatData.push(chatObj);

    // Routing follows `keepUserAndBotChatLocal`. While the bot is the only
    // participant (user alone) and the flag is ON, the message stays local so we
    // don't persist a one-sided, context-free exchange to shared history. With
    // the flag OFF — or once real people are present — it's sent to the server.
    const botActive = this._chatterBot.isActive(this._humanOthersOnline);
    const keepLocal = this.keepChatLocal();
    if(!keepLocal){
      this._chatService.sendChatMessage(chatObj);
    }
    this.chatterForm.reset();

    // When alone, let the bot reply to the post (its routing follows the flag).
    if(botActive){
      this.botRespondTo(cleanInput);
    }

    await CommonFunctions.sleep(delay);
    this.chatterForm.controls[this.formCntrlName].setValue(null);
    this.chatterForm.controls[this.formCntrlName].markAsUntouched();

    this.isTyping = false;
    this.chatUserData.isTyping = false
    this._chatService.sendUserTypingStateMessage(this.isTyping);

    // Scroll to bottom
    await CommonFunctions.sleep(this.SCROLL_DELAY);
    this.scrollToBottom();
  }

  /** True when `msg` is the message currently open for editing (drives the
   *  persistent border highlight while its text sits in the textbox). */
  isEditingMsg(msg:ChatMessage):boolean{
    return !!this._editingMsg && this._editingMsg.getMsgId === msg.getMsgId;
  }

  /** Enter edit mode for one of the user's OWN messages: load its text into the
   *  textbox so it can be changed. Ignores app messages and other users' posts. */
  editMessage(msg:ChatMessage):void{
    if(msg.getUserId !== this.userId || msg.getIsAppMsg) return;

    this._editingMsg = msg;
    this.chatterForm.controls[this.formCntrlName].setValue(msg.getMessage);
    this.chatPrompt = 'Edit your message, then press Enter';

    const box = document.getElementById('chatterMsgBox') as HTMLInputElement | null;
    box?.focus();
    this.focusWindow();
    this._cdr.detectChanges();
  }

  /** Leave edit mode without changing anything and clear the textbox. */
  private cancelEdit():void{
    if(!this._editingMsg) return;

    this._editingMsg = null;
    this.chatPrompt = 'Type a message';
    this.chatterForm.reset();
    this.chatterForm.controls[this.formCntrlName].setValue(null);
    this.chatterForm.controls[this.formCntrlName].markAsUntouched();
    this._cdr.detectChanges();
  }

  /** Commit an edit: update the message text in place (optimistic) and, when
   *  real people are present, broadcast a messageUpdate so their copies update
   *  too. Mirrors createChat's "keep it local while alone" rule. */
  private async submitMessageEdit(cleanInput:string):Promise<void>{
    const delay = 10;
    const target = this._editingMsg;
    const keepLocal = this.keepChatLocal();

    this._editingMsg = null;
    this.chatPrompt = 'Type a message';

    if(target){
      // Optimistic in-place update — same object reference rendered in chatData.
      target.setMessage = cleanInput;
      if(!keepLocal){
        this._chatService.sendMessageUpdate(target);
      }
    }

    this.chatterForm.reset();
    await CommonFunctions.sleep(delay);
    this.chatterForm.controls[this.formCntrlName].setValue(null);
    this.chatterForm.controls[this.formCntrlName].markAsUntouched();

    this.isTyping = false;
    this.chatUserData.isTyping = false;
    if(!keepLocal){
      this._chatService.sendUserTypingStateMessage(this.isTyping);
    }

    this._cdr.detectChanges();
    await CommonFunctions.sleep(this.SCROLL_DELAY);
    this.scrollToBottom();
  }

  /** A message edit arrived from another user: swap the matching entry in the
   *  local view so everyone sees the same edited text. */
  private applyIncomingMessageUpdate(updated:ChatMessage):void{
    const idx = this.chatData.findIndex(m => m.getMsgId === updated.getMsgId);
    if(idx !== -1){
      this.chatData[idx] = updated;
      this._cdr.detectChanges();
    }
  }
  
  getRandomNum(min?:number, max?:number):number {
    const defaultMin = 0;
    const defaultMax = 100000;
    min =(min === undefined)? defaultMin :min;
    max =(max === undefined)? defaultMax : max;
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

   /** Generates the next color dynamically */
  geIconColor(): string {
    const defaultMin = 0;
    const defaultMax = 36;
    const colorSet = ['#00FFFF', '#AAFF00', '#228B22', '#7CFC00', '#00A36C', '#32CD32', '#00FF7F','#FFBF00','#ECFFDC',
      '#F88379', '#FF4433', '#FF00FF', '#FFB6C1', '#E30B5C', '#800080', '#D8BFD8', '#AA98A9', '#7F00FF','#7B68EE',
      '#0000FF', '#0047AB', '#3F00FF', '#7393B3', '#D27D2D', '#800020', '#8B0000', '#FFFF00', '#FFD700','#000000',
      '#4B0082','#696969','#191970','#000080','#4169E1','#008080','#2E8B57','#F08080'];

    const selectedColor = colorSet[this.getRandomNum(defaultMin,defaultMax)]
    return selectedColor;
  }

  setMessageLastReceievedTime():void{
    const dateTime = new Date(); 
    // const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // const dayName = days[dateTime.getDay()];
    
    let hour = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const meridian = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12; // Convert 24-hour to 12-hour format
    
    // Format the time as HH:MM Meridian
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridian}`;
    this.messageLastRecieved=` ${dateTime.getMonth() + 1}/${dateTime.getDate()},${formattedTime} `;
  }

  generateUserID():string {
    return CommonFunctions.generateID();
  }

  retrieveEarlierMessages(): void {
    const minNoOfMsgs = 40;
    const loadedMessages = this._chatService.getChatData();

    // Load the last 40 messages initially
    if (loadedMessages.length >= 0) {
        this.chatData = loadedMessages.slice(-minNoOfMsgs);
        setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);

        // Load older messages progressively
        this.currIteration = 0;
        this.loadMessagesInBatches(loadedMessages, minNoOfMsgs);
    } else {
        this.chatData = loadedMessages;
        setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
    }

    // History is now in place; it's safe for the bot to greet without being
    // wiped by the assignments above.
    this._priorMessagesLoaded = true;
    this.refreshBotPresence();
  }

  loadMessagesInBatches(loadedMessages: ChatMessage[], batchSize: number) {
    const totalBatches = Math.ceil(loadedMessages.length / batchSize);

    const interval = setInterval(() => {
        if (this.currIteration >= totalBatches - 1) {
            clearInterval(interval);
            return;
        }

        this.loadMoreMessages(loadedMessages, batchSize);
        this.currIteration++;
    }, this.RETRIEVAL_DELAY);
  }

  loadMoreMessages(chatHistory: ChatMessage[], batchSize: number) {
    const chatContainer = this.chatHistoryOutput.nativeElement;

    // Store current scroll height before adding messages
    this.prevScrollHeight = chatContainer.scrollHeight;

    const remainingMessages = chatHistory.length - this.chatData.length;
    if (remainingMessages <= 0) return;

    const startIdx = Math.max(remainingMessages - batchSize, 0);
    const moreMessages = chatHistory.slice(startIdx, remainingMessages);

    this.chatData.unshift(...moreMessages);

    // Maintain scroll position instead of scrolling to bottom
    setTimeout(() => this.maintainScrollPosition(), this.SCROLL_DELAY);
  }

  maintainScrollPosition() {
    const chatContainer = this.chatHistoryOutput.nativeElement;
    chatContainer.scrollTop = chatContainer.scrollHeight - this.prevScrollHeight;
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId 
      && this._windowService.getIsWindowInFocus()) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null &&  appSessionData.appData != Constants.EMPTY_STRING){
      //const data = appSessionData.app_data as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
