import { Component, OnInit, OnDestroy } from '@angular/core';
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

export class LoginComponent implements OnInit, OnDestroy {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  intervalId!: NodeJS.Timeout;
  authFormTimeoutId!: NodeJS.Timeout;

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

  }

  ngOnInit():void {
    this.viewOptions =  this.currentDateTime;
    const secondsDelay = 1000; // Update time every second
    this.updateTime(); // Set initial time
    this.getDate();
    
    this.intervalId = setInterval(() => {
      this.updateTime();
    }, secondsDelay); 
  }

  ngOnDestroy():void {
    if (this.intervalId) {
      clearInterval(this.intervalId); // Clean up interval when component is destroyed
    }
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
      month:'short',
      day:'numeric'
    });
  }

  onKeyDown(evt:KeyboardEvent):void{
    const secondsDelay = 12000; //wait 12 seconds;
    if(evt.key === Constants.BLANK_SPACE){
      this.viewOptions = this.authForm;

      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        lockScreenElmnt.style.backdropFilter = 'blur(40px)';

        this.authFormTimeoutId = setTimeout(() => {
            this.resetViewOption();
        }, secondsDelay);
      }
    }
  }

  resetViewOption():void{
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    this.viewOptions = this.currentDateTime;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  onEnteringPassword(evt:KeyboardEvent):void{
    const regexStr = '^[a-zA-Z0-9_]+$';
    const res = new RegExp(regexStr).test(evt.key)

    if(res){
       this.showDesktop();
      //return res
    }else{

      //return res;
    }

    if (this.authFormTimeoutId) {
      clearTimeout(this.authFormTimeoutId); // is key is being pressed then rest the timeout
    }
  }

  showDesktop():void{
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '-1';
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }


  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
