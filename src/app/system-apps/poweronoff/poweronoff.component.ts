import { Component, OnInit, AfterViewInit } from '@angular/core';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-poweronoff',
  templateUrl: './poweronoff.component.html',
  styleUrl: './poweronoff.component.css'
})
export class PowerOnOffComponent implements OnInit, AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _audioService:AudioService;

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  authFormTimeoutId!: NodeJS.Timeout;
  lockScreenTimeoutId!: NodeJS.Timeout;

  isSystemPowered = false;
  showPowerBtn = true;
  pwrBtnIcon = `${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`;
  showStartUpGif = false;
  startUpGif = `${Constants.GIF_BASE_PATH}cheetah_starting_up.gif`;
  loadingMessage = 'Pwr On';

  startUpMessages: string[] = ['Initializing...',  'Loading resources...', 'Setting up system', 'Almost done...'];


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_pwr_mgt';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  
  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, audioService:AudioService){
    this._processIdService = processIdService;
    this.processId = this._processIdService.getNewProcessId();
    this._audioService = audioService;

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit(): void {
    1
  }

  powerOnSystem():void{
    if(this.showPowerBtn){
      this.showPowerBtn = false;
      this.simulateBusy();
    }
  }

  simulateBusy() {
    this.showStartUpGif = true;
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

  showLockScreen():void{
    this.revertSettings();
    const powerOnOffElmnt = document.getElementById('powerOnOffCmpnt') as HTMLDivElement;
    if(powerOnOffElmnt){
      powerOnOffElmnt.style.zIndex = '-2';
      powerOnOffElmnt.style.display = 'none';
      // play startup sound
      this._audioService.playSound();
    }

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.focus();
    }
  }

  revertSettings():void{
    this.showStartUpGif = false;
    this.showPowerBtn = true;
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
