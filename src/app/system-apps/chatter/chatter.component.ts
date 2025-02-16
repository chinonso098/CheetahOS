import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SocketService } from 'src/app/shared/system-service/socket.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ChatterService } from 'src/app/shared/system-service/chatter.service';
import { ChatMessage } from './model/chat.message';
import { IUser, IUserData } from './model/chat.interfaces';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-chatter',
  templateUrl: './chatter.component.html',
  styleUrl: './chatter.component.css',
  providers: [SocketService] // New instance per component
})
export class ChatterComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  @ViewChild('chatHistoryOutput', {static: true}) chatHistoryOutput!: ElementRef;

  private _newMessageAlertSub!: Subscription;
  private _userCountChangeSub!: Subscription;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _windowService:WindowService;
  private _chatService:ChatterService;
  private _socketService:SocketService;

  userNameAcronymStyle:Record<string, unknown> = {};

  chatterForm!: FormGroup;
  chatUserForm!: FormGroup;
  private _formBuilder;
  formCntrlName = 'msgText';

  showUserNameLabel = true;
  showUserNameForm = false;
  isTyping = false;
  messageLastRecieved = '';
  scrollCounter = 0;
  userCount = 0;

  userNameAcronym = '';
  bkgrndIconColor = '';
  userName = '';
  userId= '';

  chatData: ChatMessage[] = [];
  onlineUsers: IUserData[] = [];
  chatUser!: IUser;
  chatUserData!:IUserData

  lastTapTime = 0;
  messages: string[] = [];
  newMessage = '';

  chatPrompt = 'Type a message';
  isMaximizable = false;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
  name = 'chatter';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Chatter';

  constructor(socketService:SocketService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
    windowService:WindowService, chatService:ChatterService, formBuilder:FormBuilder) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._socketService = socketService;
    this._chatService = chatService;
    this._formBuilder = formBuilder

    this.setDefaults();

    this._newMessageAlertSub = this._chatService.newMessageNotify.subscribe(()=> this.pullData());
    this._userCountChangeSub = this._chatService.userCountChangeNotify.subscribe(()=> this.updateOnlineUserCount());

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
  }

  ngOnInit(): void {
    this.userNameAcronymStyle = {
      'background-color': this.bkgrndIconColor
    };

    this.chatterForm = this._formBuilder.nonNullable.group({
      msgText: '',
    });

    this.chatUserForm = this._formBuilder.group({
      firstName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),]],
      lastName: ["",[Validators.required,Validators.minLength(1),Validators.maxLength(10),]],
    });

    // this._chatService.chatData$.subscribe(data => {
    //   this.chatData = data;
    //   this.chatHistory = data.slice(-40);
    // });

    //setTimeout(() => this.scrollToBottom(), 1500);
  }

  ngAfterViewInit(): void {
   
    setTimeout(() => {
        this._chatService.sendUserInfoMessage(this.chatUserData);
    }, 2000);
  }

  ngOnDestroy():void{
    this._newMessageAlertSub?.unsubscribe();
    this._userCountChangeSub?.unsubscribe();
    this._socketService.disconnect();

    const ssPid = this._socketService.processId;
    const socketProccess = this._runningProcessService.getProcess(ssPid);
    this._runningProcessService.removeProcess(socketProccess);
  }

  pullData():void{
    const data = this._chatService.getChatData();
    //console.log('chat data:', data);
    this.chatData = data
    this.setMessageLastReceievedTime();

    setTimeout(() => this.scrollToBottom(), 500);
  }

  updateOnlineUserCount():void{
    setTimeout(() => {
      //subtract 1 to account for yourself
      console.log('this._chatService.getUserCount():',this._chatService.getUserCount());
      //this.userCount = this._chatService.getUserCount() - 1;
    }, 1000);
  }

  setDefaults():void{
    const uData = this._chatService.getUserData() as IUserData;
    if(!uData){
      this.userId = this.generateUserID();
      this.userName = `User_${this.getRandomNum()}`;
      this.userNameAcronym = 'AU';
      this.bkgrndIconColor = this.geIconColor();

      this.chatUserData = {
        'userId':this.userId, 
        'userName': this.userName, 
        'userNameAcronym':this.userNameAcronym, 
        'color':this.bkgrndIconColor
      };

      this._chatService.saveUserData(this.chatUserData)
    }else{
      this.userId = uData.userId;
      this.userName = uData.userName;
      this.userNameAcronym = uData.userNameAcronym;
      this.bkgrndIconColor = uData.color;
      this.chatUserData = uData;
    }
  }

  onUpdateUserName(): void {
    if (this.chatUserForm.valid) {
      if (this.chatUserForm.dirty) {
        const s = { ...this.chatUser, ...this.chatUserForm.value } as IUser;
        this.userNameAcronym = `${s.lastName.charAt(0)}${s.firstName.charAt(0)}`;
        this.userName = `${s.lastName}, ${s.firstName}`;

        // retrieve the data from session and update it
        const uData = this._chatService.getUserData() as IUserData;
        uData.userName = this.userName;
        uData.userNameAcronym = this.userNameAcronym
        this._chatService.saveUserData(uData)

        this.showTheUserNameLabel();
      }
    }
  }

  showTheUserNameForm():void{
    this.showUserNameForm = true;
    this.showUserNameLabel = false;
    //this.volumeSlider.nativeElement.style.display === 'block'
  }

  showTheUserNameLabel():void{
    this.showUserNameForm = false;
    this.showUserNameLabel = true;
    //this.volumeSlider.nativeElement.style.display === 'block'
  }

  onKeyDownOnWindow(evt:KeyboardEvent):void{
    this.focusOnInput();
    if (evt.key === "Tab") {
      // Prevent tab from moving focus
      evt.preventDefault();
    }
  }

  focusOnInput():void{
    const chatterMsgBoxElm= document.getElementById('chatterMsgBox') as HTMLInputElement;
    if(chatterMsgBoxElm){
      chatterMsgBoxElm?.focus();
    }
  }

  private scrollToBottom(): void {
    this.chatHistoryOutput.nativeElement.scrollTop = this.chatHistoryOutput.nativeElement.scrollHeight;
    this.chatHistoryOutput.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  // loadMoreMessages() {
  //   const currentLength = this.chatHistory.length;
  //   const moreMessages = this.chatData.slice(Math.max(this.chatData.length - currentLength - 20, 0), this.chatData.length - currentLength);
    
  //   setTimeout(() => {
  //     this.chatHistory = [...moreMessages, ...this.chatHistory];
  //   }, 1500);
  // }


  async onKeyDownInInputBox(evt:KeyboardEvent):Promise<void>{
    
    if(evt.key == "Enter"){
      const chatInput = this.chatterForm.value.msgText as string;

      if(chatInput.trim().length === 0) {
        this.chatPrompt = 'message box can not be empty'
        return;
      }

      const chatObj = new ChatMessage(chatInput, this.userId, this.userName, this.userNameAcronym, this.bkgrndIconColor)
      this._chatService.sendChatMessage(chatObj);
      this.chatterForm.reset();
      setTimeout(() => {
        this.chatterForm.controls[this.formCntrlName].setValue(null);
        this.chatterForm.controls[this.formCntrlName].markAsUntouched();
      }, 10);

       // Scroll to bottom
      setTimeout(() => this.scrollToBottom(), 500);
    }
  }

  createChat():void{
    const chatInput = this.chatterForm.value.msgText as string;

    if(chatInput.trim().length === 0) 
      return;

    const chatObj = new ChatMessage(chatInput, this.userId, this.userName, this.userNameAcronym, this.bkgrndIconColor)
    this._chatService.sendChatMessage(chatObj);
    this.chatterForm.reset();
    setTimeout(() => {
      this.chatterForm.controls[this.formCntrlName].setValue(null);
      this.chatterForm.controls[this.formCntrlName].markAsUntouched();
    }, 10);
    
    // Scroll to bottom
    //this.scrollToBottom();
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

  private setMessageLastReceievedTime():void{
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

  private generateUserID() {
    let userId = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < 15; i++) {
      userId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return userId;
  }

  setChatterWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
