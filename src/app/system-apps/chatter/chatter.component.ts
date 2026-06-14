/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ChatterService } from 'src/app/shared/system-service/chatter.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SocketService } from 'src/app/shared/system-service/socket.service';

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';

import { ChatMessage } from './model/chat.message';
import { IUser, IUserData } from './model/chat.interfaces';
import { Subscription } from 'rxjs';
import { AppState } from 'src/app/system-files/state/state.interface';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';

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

  private _newChatMessageSub!: Subscription;
  private _priorMessagesSub!: Subscription;
  private _userCountChangeSub!: Subscription;
  private _newUserInfomationSub!: Subscription;
  private _updateOnlineUserListSub!: Subscription;
  private _updateUserNameOrStatusSub!: Subscription;
  private _windowResizeSub!: Subscription;
  private _maximizeSub!: Subscription;

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

  logonAudio = `${Constants.AUDIO_BASE_PATH}cheetah_logon.wav`;
  newMsgAudio = `${Constants.AUDIO_BASE_PATH}cheetah_notify_messaging.wav`;

  chatPrompt = 'Type a message';
  isMaximizable = true;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
  name = 'chatter';
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
              sessionManagementService:SessionManagementService, private _cdr:ChangeDetectorRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._socketService = socketService;
    this._audioService = audioService;
    this._chatService = chatService;
    this._sessionManagementService = sessionManagementService;

    this._chatService.setSocketInstance(socketService);
    this._chatService.setSubscriptions();
    this._formBuilder = formBuilder

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this.setDefaults();


    this._newChatMessageSub = this._chatService.newMessageNotify.subscribe(()=> this.updateChatData());
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
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });

    // Maximize/restore broadcasts no payload — just kick a CD tick and
    // re-pin the scroll to the latest message after the animation settles.
    this._maximizeSub = this._windowService.maximizeProcessWindowNotify.subscribe(() => this.onWindowResize());
  }

  async ngOnInit(): Promise<void> {
    this.userNameAcronymStyle = { 'background-color': this.bkgrndIconColor };

    this.chatterForm = this._formBuilder.nonNullable.group({ msgText: Constants.EMPTY_STRING });
    this.chatUserForm = this._formBuilder.group({
      firstName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),]],
      lastName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),]],
    });

    // set as my timestamp for when i came online
    this._chatService.setComeOnlineTS(Date.now());
  }

  async ngAfterViewInit(): Promise<void> {
    const delay = 50;
    const audioDelay = 200; //200ms

    await CommonFunctions.sleep(audioDelay);
    await this._audioService.play(this.logonAudio);

    await CommonFunctions.sleep(delay);
    this._chatService.sendUserOnlineAddInfoMessage(this.chatUserData);
    this.generateAndSendAppMessages(this.A_NEW_USER_HAS_JOINED_THE_CHAT_MSG);

    // Request the chat history from the server. The reply is handled by the
    // priorMessagesNotify subscription, which then calls retrieveEarlierMessages().
    this._chatService.sendFetchPriorMessagesMessage();

    await CommonFunctions.sleep(this.SECONDS_DELAY)
    await this.captureComponentImg();
  }

  async ngOnDestroy(): Promise<void>{
    const delay = 25;
    this._chatService.sendUserOfflineRemoveInfoMessage(this.chatUserData);
    this.generateAndSendAppMessages(this.USER_HAS_LEFT_THE_CHAT_MSG);
    

    await CommonFunctions.sleep(delay);
    this._newChatMessageSub?.unsubscribe();
    this._priorMessagesSub?.unsubscribe();
    this._userCountChangeSub?.unsubscribe();
    this._newUserInfomationSub?.unsubscribe();
    this._updateOnlineUserListSub?.unsubscribe();
    this._updateUserNameOrStatusSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    this._maximizeSub?.unsubscribe();

    this._socketService.disconnect();
    
    const ssPid = this._socketService.processId;
    const socketProccess = this._runningProcessService.getProcess(ssPid);
    this._runningProcessService.removeProcess(socketProccess);

    // ChatterService is now component-scoped, so it registers a process on every
    // open. Remove it here to mirror the socket cleanup and avoid leaking entries.
    this._chatService.terminateSubscriptions();
    const csPid = this._chatService.processId;
    const chatterProcess = this._runningProcessService.getProcess(csPid);
    this._runningProcessService.removeProcess(chatterProcess);
  }

  async updateChatData():Promise<void>{
    const delay = 500; //500ms
    const data = this._chatService.getChatData();
    this.chatData = data
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

  updateOnlineUserCount(value:number):void{
    //0 is add_and_broadcast
    // 1 is add
    const currentUserCount = this._chatService.getUserCount();

    if(value === 0){
      //subtract 1 to account for yourself
      this.userCount = currentUserCount - 1;
    }else{
      //subtract 1 to account for yourself
      this.userCount = currentUserCount - 1;
    }
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
    chatObj.setIsAppMgs = true;

    if(msgType === this.USER_CHANGED_NAME_MSG)
        chatObj.setIsUserNameEdit = true;

    this._chatService.sendChatMessage(chatObj);

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
  }

  updateOnlineUserList():void{
    const data = this._chatService.getListOfOnlineUsers();
    this.onlineUsers = data;
  }

  // getTimeOut():number{
  //   const delays = [100, 175, 250, 325, 400, 475, 550, 525, 700, 775, 850, 925];
  //   const timeout = delays[Math.floor(Math.random() * delays.length)];
  //   return timeout;
  // }

  setDefaults():void{
    const uData = this._chatService.getUserData() as IUserData;
    if(!uData){
      this.userId = this.generateUserID();
      this.userName = `User_${this.getRandomNum()}`;
      this.userNameAcronym = 'AU';
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

  async createChat():Promise<void>{
    const chatInput = this.chatterForm.value.msgText as string;
    const delay = 10;

    if(chatInput!== null &&  chatInput.trim().length === 0) {
      this.chatPrompt = 'message box can not be empty';
      return;
    }

    const chatObj = new ChatMessage(chatInput, this.userId, this.userName, this.userNameAcronym, this.bkgrndIconColor);
    this.chatData.push(chatObj);
    this._chatService.sendChatMessage(chatObj);
    this.chatterForm.reset();

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

  generateUserID() {
    let userId = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < 15; i++) {
      userId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return userId;
  }

  retrieveEarlierMessages(): void {
    const minNoOfMsgs = 40;
    const loadedMessages = this._chatService.getChatData();

    // Load the last 40 messages initially
    if (loadedMessages.length >= minNoOfMsgs) {
        this.chatData = loadedMessages.slice(-minNoOfMsgs);
        setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);

        // Load older messages progressively
        this.currIteration = 0;
        this.loadMessagesInBatches(loadedMessages, minNoOfMsgs);
    } else {
        this.chatData = loadedMessages;
        setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
    }
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

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

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
