/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-poweronoff',
  templateUrl: './poweronoff.component.html',
  styleUrl: './poweronoff.component.css',
  standalone:false,
})
export class PowerOnOffComponent implements OnInit, AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _systemNotificationService:SystemNotificationService;
  private _audioService:AudioService;
  private _sessionManagmentService:SessionManagmentService;

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  authFormTimeoutId!: NodeJS.Timeout;
  lockScreenTimeoutId!: NodeJS.Timeout;

  readonly cheetahPwrKey = Constants.CHEETAH_PWR_KEY;

  isSystemPowered = false;
  isFirstPwrOn = true;
  showPowerBtn = true;
  pwrBtnIcon = `${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`;
  showStartUpGif = false;
  startUpGif = `${Constants.GIF_BASE_PATH}cheetah_starting_up.gif`;
  loadingMessage = 'Pwr On';

  powerOnAudio = `${Constants.AUDIO_BASE_PATH}cheetah_start_up_2.mp3`;
  powerOffAudio = `${Constants.AUDIO_BASE_PATH}cheetah_shutdown.wav`;

  startUpMessages: string[] = ['Initializing...',  'Loading resources...', 'Setting up system', 'Almost done...'];


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_pwr_mgt';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  
  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, audioService:AudioService, 
              systemNotificationService:SystemNotificationService, sessionManagmentService:SessionManagmentService){
    this._processIdService = processIdService;
    this._audioService = audioService;
    this._systemNotificationService = systemNotificationService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._systemNotificationService.restartSystemNotify.subscribe((p) => { 
      if(p === Constants.RSTRT_ORDER_PWR_ON_OFF_SCREEN){
        this.simulateRestart()
      }
    });
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    if(this.isSystemPowered){
      this.showLockScreen();
    }
  }

  ngAfterViewInit(): void {
    1
  }

  powerOnSystem():void{
    if(this.showPowerBtn){
      this.showPowerBtn = false;
      this.storeState(Constants.SYSTEM_ON);
      this.simulateBusy();
    }
  }

  simulateBusy() {
    this.showStartUpGif = true;
    this.isSystemPowered = true;
    let index = 0;
    this.loadingMessage = 'Powering On';
    const secondsDelay = 2000; //2 seconds

    const interval = setInterval(() => {
      if (index < this.startUpMessages.length) {
        this.loadingMessage = this.startUpMessages[index];
        index++;
      } else {
        clearInterval(interval);
        this.showLockScreen();
      }
    }, secondsDelay);
  }

  simulateRestart(): void {
    this.isFirstPwrOn = true;
    this.isSystemPowered = false;
    this.showPowerBtn = false;
    this.loadingMessage = Constants.EMPTY_STRING;
    const delay = 1000;
    setTimeout(() => {
      this.showStartUpGif = true;
      this.loadingMessage = Constants.EMPTY_STRING;
      this.simulateBusy();
    }, delay);
  }


  showLockScreen():void{
    this.revertSettings();
    const powerOnOffElmnt = document.getElementById('powerOnOffCmpnt') as HTMLDivElement;
    if(powerOnOffElmnt){
      powerOnOffElmnt.style.zIndex = '-2';
      powerOnOffElmnt.style.display = 'none';


      // play startup sound
      if(this.isSystemPowered && this.isFirstPwrOn){
        this._audioService.play(this.powerOnAudio);
        this.isFirstPwrOn = false;
      }
    }

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.focus();
    }
  }

  revertSettings():void{
    this.showStartUpGif = false;
    this.showPowerBtn = true;
    this.loadingMessage = 'Pwr On';
    //this.storeState(Constants.SYSTEM_SHUT_DOWN);
  }

  storeState(state:string):void{
    this._sessionManagmentService.addSession(this.cheetahPwrKey, state);
  }
  
  retrievePastSessionData():void{
    const sessionData = this._sessionManagmentService.getSession(this.cheetahPwrKey) as string;
    console.log('pwr-psession:', sessionData);
    if(!sessionData || sessionData === Constants.SYSTEM_SHUT_DOWN){
      this.isSystemPowered = false;
      this.isFirstPwrOn = true;
    }else{ 
      this.isSystemPowered = true;
      this.isFirstPwrOn = false;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
