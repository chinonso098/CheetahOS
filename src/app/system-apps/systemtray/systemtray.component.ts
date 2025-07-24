/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit } from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

@Component({
  selector: 'cos-systemtray',
  templateUrl: './systemtray.component.html',
  styleUrl: './systemtray.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class SystemtrayComponent implements OnInit {

  private _processIdService;
  private _runningProcessService;
  private _systemNotificationServices:SystemNotificationService;
  private _audioService!:AudioService;
  private currentVolume = 0;

  taskBarArrowIcon = `${Constants.IMAGE_BASE_PATH}taskbar_arrow_up.png`;
  audioIcon = `${Constants.IMAGE_BASE_PATH}no_volume.png`;
  currentVolumeTxt = Constants.EMPTY_STRING;

  subscribeTime = Constants.EMPTY_STRING;
  subscribeDate = Constants.EMPTY_STRING;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system tray';
  processId = 0;
  type = ComponentType.System

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService,audioService:AudioService, systemNotificationServices:SystemNotificationService) { 
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

  ngOnInit():void {
    const secondsDelay = [1000, 360000]; 
    this.updateTime();
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
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    this.subscribeTime = `${formattedHours}:${formattedMinutes} ${ampm}`;
  }

  getDate():void{
    const dateTime = new Date();  
    this.subscribeDate = `${dateTime.getMonth() + 1}/${dateTime.getDate()}/${dateTime.getFullYear()}`;
  }

  setVolumeIcon():void{
    const tskBarVolumeElmnt = document.getElementById('taskBarVolumeFig') as HTMLImageElement;

    if(tskBarVolumeElmnt){
      if(this.currentVolume === 0){
        this.audioIcon =  `${Constants.IMAGE_BASE_PATH}no_volume.png`;
        tskBarVolumeElmnt.style.left = '3px';
      }else  if(this.currentVolume > 0 && this.currentVolume <= 0.3){
          this.audioIcon =  `${Constants.IMAGE_BASE_PATH}low_volume.png`;
          tskBarVolumeElmnt.style.left = '3px';
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
    const delay = 250;
    setTimeout(() => {
      this.currentVolume = this._audioService.getVolume();
      this.setVolumeIcon();
    }, delay);
  }

  showVolumeControl():void{
    this._audioService.hideShowVolumeControlNotify.next();
  }


  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
