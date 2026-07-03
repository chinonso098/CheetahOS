/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

import { concatMap } from 'rxjs';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { TooltipPositionInfo } from '../taskbarentries/taskbar.entries.type';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';

@Component({
  selector: 'cos-systemtray',
  templateUrl: './systemtray.component.html',
  styleUrl: './systemtray.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class SystemtrayComponent implements OnInit, AfterViewInit {

  private _audioService!:AudioService;
  private _menuService!:MenuService;
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _systemNotificationService!:SystemNotificationService;

  private currentVolume = 0;
  isShowVolumeControl = false;
  isShowOverFlowMenuPane = false;

  taskBarArrowIcon = `${Constants.IMAGE_BASE_PATH}taskbar_arrow_up.png`;
  taskBarNotificationIcon = `${Constants.IMAGE_BASE_PATH}taskbar_no_notification.png`;
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

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, audioService:AudioService, 
             systemNotificationServices:SystemNotificationService, menuService:MenuService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._systemNotificationService = systemNotificationServices;
    this._menuService = menuService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    // NOTE: The system tray lives for the entire lifetime of the OS and is never
    // closed, so these subscriptions intentionally do not need to be unsubscribed.

    // Refresh the volume icon whenever the audio volume changes.
    this._audioService.changeVolumeNotify.pipe(concatMap(() => this.updateVolume())).subscribe();
    // Also refresh the volume icon when the desktop is shown, so the tray icon
    // stays in sync after the desktop is brought back into focus.
    this._systemNotificationService.showDesktopNotify.pipe(concatMap(() => this.updateVolume())).subscribe();

    this._audioService.hideVolumeControlNotify.subscribe((p) => {
      if(p === Constants.EMPTY_STRING){
        this.hideVolumeControl();
      }
    });

    this._menuService.hideOverFlowMenu.subscribe((p) => {
      if(p === Constants.EMPTY_STRING){
        this.hideOverFlowMenuPane();
      }
    });
  }

  ngOnInit():void {
    // Refresh intervals expressed in milliseconds.
    const clockRefreshMs = 1000;    // update the clock every second
    const dateRefreshMs = 360000;   // update the date every 6 minutes

    // Seed the initial values immediately so the tray is populated on first render.
    this.updateTime();
    this.getDate();

    // These timers run for the lifetime of the OS and are intentionally not cleared.
    setInterval(() => { this.updateTime(); }, clockRefreshMs);
    setInterval(() => { this.getDate(); }, dateRefreshMs);
  }

  ngAfterViewInit(): void {
    // Seed the taskbar volume icon on startup so it reflects the current
    // service-level volume even before any audio has played.
    this.updateVolume();
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

  getUSDate():string{
    const dateTime = new Date();  

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    const formattedDate = dateTime.toLocaleDateString('en-US', options);
    return `${formattedDate}`;
  }

  setVolumeIcon():void{
    const tskBarVolumeElmnt = document.getElementById('taskBarVolumeFig') as HTMLImageElement;
    if(tskBarVolumeElmnt){
      // Pick the icon based on the current volume level. The ranges are kept
      // contiguous (no gaps) so every possible value maps to exactly one icon:
      //   -1            -> error
      //    0            -> muted
      //   (0,   0.4)    -> low
      //   [0.4, 0.8)    -> medium
      //   [0.8, 1]      -> high
      if(this.currentVolume === -1){
        this.audioIcon = `${Constants.IMAGE_BASE_PATH}volume_error.png`;
        tskBarVolumeElmnt.style.left = '5px';
      }else if(this.currentVolume <= 0){
        this.audioIcon = `${Constants.IMAGE_BASE_PATH}no_volume.png`;
        tskBarVolumeElmnt.style.left = '5px';
      }else if(this.currentVolume < 0.4){
        this.audioIcon = `${Constants.IMAGE_BASE_PATH}low_volume.png`;
        tskBarVolumeElmnt.style.left = '4.5px';
      }else if(this.currentVolume < 0.8){
        this.audioIcon = `${Constants.IMAGE_BASE_PATH}medium_volume.png`;
        tskBarVolumeElmnt.style.left = '4.5px';
      }else{
        this.audioIcon = `${Constants.IMAGE_BASE_PATH}high_volume.png`;
        tskBarVolumeElmnt.style.left = '4.5px';
      }

      // Round to a whole number so the tooltip never shows floating-point noise
      // (e.g. "35.00000000000001%").
      this.currentVolumeTxt = `Speaker: ${Math.round(this.currentVolume * 100)}%`;
    }
  }

  async updateVolume():Promise<void>{
    // Small delay to let the audio service settle on its final volume value
    // before we read it (the value can change immediately after a notification).
    const delayMs = 100;
    await CommonFunctions.sleep(delayMs);
    this.currentVolume = this._audioService.getVolume();
    this.setVolumeIcon();
  }

  showVolumeControl():void{
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
    
    if(!this.isShowVolumeControl){
      this.isShowVolumeControl = true
      this._audioService.showVolumeControlNotify.next();
    }else{
      this.hideVolumeControl();
    }
  }

  showOverFlowMenuPane():void{
    this._systemNotificationService.hideTaskBarToolTipNotify.next();

    if(!this.isShowOverFlowMenuPane){
      this.isShowOverFlowMenuPane = true
      this._menuService.showOverFlowMenu.next();
    }else{
      this.hideOverFlowMenuPane();
    }
  }

  hideVolumeControl():void{
    this.isShowVolumeControl = false;
    this._audioService.hideVolumeControlNotify.next(this.name);
  }

  hideOverFlowMenuPane():void{
    this.isShowOverFlowMenuPane = false;
    this._menuService.hideOverFlowMenu.next(this.name);
  }

  public showOverFlowToolTip(): void {
    const elmntId = 'cheetah_overflowmenu_btn';
    const txt = this.isShowOverFlowMenuPane ? 'Hide' : 'Show hidden icons';
    this.showTaskbarToolTip(elmntId, -45, txt);
  }

  public showVolumeToolTip(): void {
    const elmntId = 'cheetah_volume_btn';
    this.showTaskbarToolTip(elmntId, -30, this.currentVolumeTxt);
  }

  public showUSDateToolTip(): void {
    const elmntId = 'cheetah_datetime_btn';
    this.showTaskbarToolTip(elmntId, -60, this.getUSDate());
  }

  public showNotificationToolTip(): void {
    const elmntId = 'cheetah_notification_btn';
    this.showTaskbarToolTip(elmntId, -85, 'No new notifications');
  }

  private showTaskbarToolTip(elementId: string, xOffset: number, text: string): void {
    const elmt = document.getElementById(elementId) as HTMLElement | null;
    if (!elmt) return;

    const rect = elmt.getBoundingClientRect();
    const data: TooltipPositionInfo = { left: rect.left + xOffset, top: rect.top, appName: text };

    this._systemNotificationService.showTaskBarToolTipNotify.next(data);
  }

  public hideToolTip():void{
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
