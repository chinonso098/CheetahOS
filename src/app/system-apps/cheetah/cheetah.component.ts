import { Component, OnInit, OnDestroy} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from "src/app/system-files/constants";
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { Subscription } from 'rxjs';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"]
})

export class CheetahComponent implements BaseComponent, OnInit, OnDestroy{
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _audioService:AudioService;
  private _systemNotificationServices:SystemNotificationService;

  private _deskTopIsActiveSub!:Subscription;
  private _lockScreenIsActiveSub!:Subscription;


  SECONDS_DELAY = 100;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'cheetah';
  version = 'Version: 3.03.18';
  year = `\u00A9 ${new Date().getFullYear()}`;

  readonly defaultAudio = `${Constants.AUDIO_BASE_PATH}about_cheetah.mp3`;

  constructor(processIdService:ProcessIDService,  runningProcessService:RunningProcessService, audioService:AudioService, systemNotificationServices:SystemNotificationService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._lockScreenIsActiveSub = this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._deskTopIsActiveSub = this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  onClosePropertyView():void{
    const processToClose = this._runningProcessService.getProcess(this.processId);
    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  ngOnInit(): void {
    const secondsDelay = 50;

    setTimeout(() => {
      this._audioService.play(this.defaultAudio);
    }, secondsDelay);

    this.removeUnWantedStyle();
  }

  ngOnDestroy(): void {
    this._deskTopIsActiveSub?.unsubscribe();
    this._lockScreenIsActiveSub?.unsubscribe();
  }

  removeUnWantedStyle():void{
    setTimeout(()=> {
      const cheetahElmnt = document.getElementById('cheetahAboutMainCntnr') as HTMLDivElement;
      if(cheetahElmnt) {
        cheetahElmnt.style.transform = Constants.EMPTY_STRING;
      }
    }, this.SECONDS_DELAY);
  }

  lockScreenIsActive():void{
    const cheetahElmnt = document.getElementById('cheetahAboutMainCntnr') as HTMLDivElement;
    if(cheetahElmnt) {
      cheetahElmnt.style.zIndex = '0';
    }
  }

  desktopIsActive():void{
    const cheetahElmnt = document.getElementById('cheetahAboutMainCntnr') as HTMLDivElement;
    if(cheetahElmnt) {
      cheetahElmnt.style.zIndex = '2';
    }
  }
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}