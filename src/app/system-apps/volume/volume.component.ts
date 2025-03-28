import { AfterViewInit, Component } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

@Component({
  selector: 'cos-volume',
  templateUrl: './volume.component.html',
  styleUrl: './volume.component.css'
})
export class VolumeComponent implements AfterViewInit  {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _systemNotificationServices:SystemNotificationService;
  private _audioService!:AudioService;

  private currentVolume = 0;
  audioIcon = `${Constants.IMAGE_BASE_PATH}no_volume.png`;
  currentVolumeTxt = Constants.EMPTY_STRING;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'volume';
  processId = 0;
  type = ComponentType.System;

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, 
    audioService:AudioService, systemNotificationServices:SystemNotificationService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    // these are subs, but since this cmpnt will not be closed, it doesn't need to be destoryed
    this._audioService.changeVolumeNotify.subscribe(() => { this.upadateVolume()}); 
    this._systemNotificationServices.showDesktopNotify.subscribe(() =>{this.upadateVolume()})
  }

  ngAfterViewInit():void{  
    1
  }

  setVolumeIcon():void{
    const tskBarVolumeElmnt = document.getElementById('taskBarVolumeImg') as HTMLImageElement;

    if(tskBarVolumeElmnt){
      if(this.currentVolume === 0){
        this.audioIcon =  `${Constants.IMAGE_BASE_PATH}no_volume.png`;
        tskBarVolumeElmnt.style.left = '2px';
      }else  if(this.currentVolume > 0 && this.currentVolume <= 0.3){
          this.audioIcon =  `${Constants.IMAGE_BASE_PATH}low_volume.png`;
          tskBarVolumeElmnt.style.left = '2px';
      }else  if(this.currentVolume >= 0.4 && this.currentVolume <= 0.7){
        this.audioIcon =  `${Constants.IMAGE_BASE_PATH}medium_volume.png`;
        tskBarVolumeElmnt.style.left = '1px';
      }else  if(this.currentVolume >= 0.8 && this.currentVolume <= 1){
        this.audioIcon =  `${Constants.IMAGE_BASE_PATH}high_volume.png`;
        tskBarVolumeElmnt.style.left = '0px';
      }

      this.currentVolumeTxt = `speaker:${(this.currentVolume * 100)}%`;
    }
  }

  upadateVolume():void{
    this.currentVolume = this._audioService.getVolume();
    this.setVolumeIcon();
  }

  showVolumeControl():void{
    this._audioService.hideShowVolumeControlNotify.next();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
