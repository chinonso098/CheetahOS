import { Component, OnInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})

export class LoginComponent implements OnInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  authFormTimeoutId!: NodeJS.Timeout;
  lockScreenTimeoutId!: NodeJS.Timeout;

  authForm = 'AuthenticationForm';
  currentDateTime = 'DateTime'; 
  viewOptions = Constants.EMPTY_STRING

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_authentication';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._runningProcessService.resetLockScreenTimeOutNotify.subscribe(() => { this.resetLockScreenTimeOut()});
  }

  ngOnInit():void {
    this.viewOptions =  this.currentDateTime;
    const secondsDelay = [1000, 360000];  // Update time every second
    this.updateTime(); // Set initial time
    this.getDate();

    setInterval(() => {
      this.updateTime();
    }, secondsDelay[0]); 

    setInterval(() => {
      this.getDate();
    }, secondsDelay[1]); 
  }

  updateTime():void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    //const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    this.currentTime = `${formattedHours}:${formattedMinutes}`;
  }

  getDate():void{
    const now = new Date();
    this.currentDate = now.toLocaleString('en-US', {
      weekday: 'long', // Full day name (e.g., "Tuesday")
      month:'long',
      day:'numeric'
    });
  }

  onKeyDown(evt:KeyboardEvent):void{
    if(evt.key === Constants.BLANK_SPACE){
      this.showAuthForm();
    }
  }

  showAuthForm():void{
    this.viewOptions = this.authForm;
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'blur(40px)';
      lockScreenElmnt.style.transition = 'backdrop-filter 0.4s ease';

      this.startAuthFormTimeOut();
    }
  }

  startAuthFormTimeOut():void{
    const secondsDelay = 60000; //wait 60 seconds;
    this.authFormTimeoutId = setTimeout(() => {
      this.showDateTime();
    }, secondsDelay);
  }

  showDateTime():void{
    this.viewOptions = this.currentDateTime;
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  onEnteringPassword(evt:KeyboardEvent):void{
    const regexStr = '^[a-zA-Z0-9_]+$';
    const res = new RegExp(regexStr).test(evt.key)

    if(res){
       //this.showDesktop();
      //return res
    }else{

      //return res;
    }

    this.resetAuthFormTimeOut();
  }

  resetAuthFormTimeOut():void{
    clearTimeout(this.authFormTimeoutId);
    this.startAuthFormTimeOut();
  }


  showDesktop():void{
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '-1';
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  showLockScreen():void{
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '6';
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  startLockScreenTimeOut():void{
    const secondsDelay = 1200000; //wait 2 mins;
    this.lockScreenTimeoutId = setTimeout(() => {
      this.showDesktop();
    }, secondsDelay);
  }

  resetLockScreenTimeOut():void{
    clearTimeout(this.lockScreenTimeoutId);
    this.startLockScreenTimeOut();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
