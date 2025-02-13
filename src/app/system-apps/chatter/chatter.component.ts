import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ChatterService } from 'src/app/shared/system-service/chatter.service';
import { ChatMessage } from './model/chat.message';

@Component({
  selector: 'cos-chatter',
  templateUrl: './chatter.component.html',
  styleUrl: './chatter.component.css'
})
export class ChatterComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  @ViewChild('endOfMessagesRef') endOfMessagesRef!: ElementRef;
  @ViewChild('topOfMessagesRef') topOfMessagesRef!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _windowService:WindowService;
  private _chatService:ChatterService;
  chatterForm!: FormGroup;
  private _formBuilder;

  userName = false;
  userNameValue = '';
  chatValue = '';
  chatData: any[] = [];
  loadedMessages: any[] = [];
  lastTapTime = 0;
  sendDisable = true;
  MSNExpand = { expand: false, show: false, x: 50, y: 120, hide: false, focusItem: false };

  chatPrompt = 'Type a message';
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
  }

  ngOnInit(): void {

    this.chatterForm = this._formBuilder.nonNullable.group({
      msgText: '',
    });

    this._chatService.chatData$.subscribe(data => {
      this.chatData = data;
      this.loadedMessages = data.slice(-40);
    });

    setTimeout(() => this.scrollToBottom(), 1500);
  }

  ngAfterViewInit(): void {
    1
  }

  ngOnDestroy():void{
    1
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
    const currentLength = this.loadedMessages.length;
    const moreMessages = this.chatData.slice(Math.max(this.chatData.length - currentLength - 20, 0), this.chatData.length - currentLength);
    
    setTimeout(() => {
      this.loadedMessages = [...moreMessages, ...this.loadedMessages];
    }, 1500);
  }

  handleExpandStateToggle() {
    this.MSNExpand.expand = !this.MSNExpand.expand;
  }

  handleExpandStateToggleMobile() {
    const now = Date.now();
    if (now - this.lastTapTime < 300) {
      this.handleExpandStateToggle();
    }
    this.lastTapTime = now;
  }

  createChat() {
    if (this.chatValue.trim().length === 0) return;
  
    const newMessage = new ChatMessage(this.chatValue, this.userNameValue, '')
    
    // {
    //   name: this.userNameValue || 'Anonymous',
    //   chat: this.chatValue,
    //   date: new Date().toISOString(),
    //   dev: false, // You can adjust this based on your app logic
    // };
  
    // Update the chat data
    this._chatService.setChatData([...this.chatData, newMessage]);
  
    // Reset input
    this.chatValue = '';
  
    // Scroll to bottom
    this.scrollToBottom();
  }
  

  setChatterWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
