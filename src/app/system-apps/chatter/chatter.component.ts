import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ChatterService } from 'src/app/shared/system-service/chatter.service';
import { ChatMessage } from './model/chat.message';
import { IUser } from './model/user';

@Component({
  selector: 'cos-chatter',
  templateUrl: './chatter.component.html',
  styleUrl: './chatter.component.css'
})
export class ChatterComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  @ViewChild('endOfMessagesRef', {static: true}) endOfMessagesRef!: ElementRef;
  @ViewChild('topOfMessagesRef', {static: true}) topOfMessagesRef!: ElementRef;
  // @ViewChild('chatUserFormCntnr', {static: true}) chatUserFormCntnr!: ElementRef;
  // @ViewChild('chatUserLabelCntnr', {static: true}) chatUserLabelCntnr!: ElementRef; 

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _windowService:WindowService;
  private _chatService:ChatterService;
  chatUser: IUser | undefined;

  chatterForm!: FormGroup;
  chatUserForm!: FormGroup;
  private _formBuilder;
  formCntrlName = 'msgText';

  showUserNameLabel = true;
  showUserNameForm = false;

  userNameAcronym = '';
  userName = '';
  chatData: ChatMessage[] = [];
  chatHistory: ChatMessage[] = [];
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

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
    windowService:WindowService, chatService:ChatterService, formBuilder:FormBuilder) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._chatService = chatService;
    this._formBuilder = formBuilder


    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this.userName = `User_${this.getRandomNums()}`;
    this.userNameAcronym = 'AU';
  }

  ngOnInit(): void {
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

    setTimeout(() => this.scrollToBottom(), 1500);
  }

  ngAfterViewInit(): void {
    1
  }

  ngOnDestroy():void{
    1
  }

  sendMessage() {
    1
  }

  onCreate(): void {
    if (this.chatUserForm.valid) {
      if (this.chatUserForm.dirty) {
        const s = { ...this.chatUser, ...this.chatUserForm.value } as IUser;
        this.userNameAcronym = `${s.lastName.charAt(0)}${s.firstName.charAt(0)}`;
        this.userName = `${s.lastName}, ${s.firstName}`;

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

  scrollToBottom() {
    setTimeout(() => {
      if (this.endOfMessagesRef) {
        this.endOfMessagesRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 1500);
  }

  loadMoreMessages() {
    const currentLength = this.chatHistory.length;
    const moreMessages = this.chatData.slice(Math.max(this.chatData.length - currentLength - 20, 0), this.chatData.length - currentLength);
    
    setTimeout(() => {
      this.chatHistory = [...moreMessages, ...this.chatHistory];
    }, 1500);
  }

  handleExpandStateToggle() {
    //this.MSNExpand.expand = !this.MSNExpand.expand;
  }

  handleExpandStateToggleMobile() {
    const now = Date.now();
    if (now - this.lastTapTime < 300) {
      this.handleExpandStateToggle();
    }
    this.lastTapTime = now;
  }



  async onKeyDownInInputBox(evt:KeyboardEvent):Promise<void>{
    
    if(evt.key == "Enter"){

      const chatInput = this.chatterForm.value.msgText as string;

      if(chatInput.trim().length === 0) {
        this.chatPrompt = 'message box can not be empty'
        return;
      }


      const chatObj = new ChatMessage(chatInput, this.userName, this.userNameAcronym)
      this.chatHistory.push(chatObj);
      this.chatterForm.reset();
      setTimeout(() => {
        this.chatterForm.controls[this.formCntrlName].setValue(null);
        this.chatterForm.controls[this.formCntrlName].markAsUntouched();
      }, 10);


      // Update the chat data
     //this._chatService.setChatData([...this.chatData]);

       // Scroll to bottom
       //this.scrollToBottom();
    }
  }

  createChat():void{
    const chatInput = this.chatterForm.value.msgText as string;

    if(chatInput.trim().length === 0) 
      return;

    const chatObj = new ChatMessage(chatInput, this.userName, this.userNameAcronym)
    this.chatHistory.push(chatObj);
    this.chatterForm.reset();
  
    // Update the chat data
    //this._chatService.setChatData([...this.chatData]);
  
  
    // Scroll to bottom
    //this.scrollToBottom();
  }
  
  getRandomNums():number {
    const min = 0;
    const max = 100000;
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  setChatterWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
