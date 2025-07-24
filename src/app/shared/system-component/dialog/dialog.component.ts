/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, SimpleChanges, AfterViewInit} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationType } from 'src/app/system-files/notification.type';

import { MenuService } from '../../system-service/menu.services';
import { WindowService } from '../../system-service/window.service';
import { ProcessIDService } from '../../system-service/process.id.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SessionManagmentService } from '../../system-service/session.management.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';

import { Constants } from 'src/app/system-files/constants';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { AudioService } from '../../system-service/audio.services';
import { CommonFunctions } from 'src/app/system-files/common.functions';


@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
  standalone:false,
})

export class DialogComponent implements BaseComponent, OnChanges, AfterViewInit {

  @Input() inputMsg = Constants.EMPTY_STRING;
  @Input() notificationType = Constants.EMPTY_STRING;

  private _userNotificationServices:UserNotificationService;
  private _windowService:WindowService;
  private _sessionManagementService: SessionManagmentService;
  private _menuService:MenuService;
  private _processIdService:ProcessIDService;
  private _systemNotificationService:SystemNotificationService;
  private _processHandlerService:ProcessHandlerService;
  private _audioService:AudioService;


  notificationOption = Constants.EMPTY_STRING;
  errorNotification = UserNotificationType.Error;
  warnNotification = UserNotificationType.Warning;
  infoNotification =  UserNotificationType.Info;
  pwrOnOffNotification =  UserNotificationType.PowerOnOff;

  cheetahOS = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  myComputer = `${Constants.IMAGE_BASE_PATH}my_computer.png`;
  errorNotificationAudio = `${Constants.AUDIO_BASE_PATH}cheetah_critical_stop.wav`;

  pwrOnOffOptions = [
    { value: 'Shut down', label: 'Closes all apps and turns off the PC.' },
    { value: 'Restart', label: 'Closes all apps and turns off the PC, and turns it on again.' }
  ];

  reOpenWindows = true;
  selectedOption = 'Shut down';
  pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;

  readonly ERROR_DIALOG = 'error-dialog';
  readonly WARNING_DIALOG = 'warning-dialog';
  readonly INFO_DIALOG = 'info-dialog';

  readonly UPDATE = 'Update';
  readonly UPDATE_0 = 'Update0';

  type = ComponentType.System;
  displayMgs = Constants.EMPTY_STRING;
  name = Constants.EMPTY_STRING;
  hasWindow = false;
  isMaximizable = false;
  icon = Constants.EMPTY_STRING;
  processId = 0;
  displayName = Constants.EMPTY_STRING;

  constructor(notificationServices:UserNotificationService, menuService:MenuService, windowService:WindowService,
              systemNotificationServices:SystemNotificationService, sessionManagementService:SessionManagmentService, processIdService:ProcessIDService,
              processHandlerService:ProcessHandlerService, audioService:AudioService){
    this._userNotificationServices = notificationServices;
    this._menuService = menuService;
    this._sessionManagementService = sessionManagementService;
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._systemNotificationService = systemNotificationServices;
    this._processHandlerService = processHandlerService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();
  }

  ngOnChanges(changes: SimpleChanges):void{
    console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
    this.notificationOption =this.notificationType;
    this.setPwrDialogPid(this.UPDATE);
  }

  async ngAfterViewInit(): Promise<void> {
    const delay = 200; //200ms
    await CommonFunctions.sleep(delay);
    this.playDialogNotifcationSound();
  }

  onYesDialogBox():void{
    this._menuService.createDesktopShortcut.next();
  }

  onCheckboxChange():void{
    console.log('Checkbox is checked:', this.reOpenWindows);
  }

  setPwrDialogPid(action:string):void{ 
    if(this.notificationOption === UserNotificationType.PowerOnOff){
      if(action === this.UPDATE){
        this._systemNotificationService.setPwrDialogPid(this.processId);
      }else{
        this._systemNotificationService.setPwrDialogPid(0);
      }
    }
  }

  onYesPowerDialogBox():void{
    const delay = 200; //200ms
    const clearSessionData = !this.reOpenWindows;
    
    this.onCloseDialogBox();
    this._processHandlerService.closeActiveProcessWithWindows(clearSessionData);

    setTimeout(() => {
      if(this.selectedOption === Constants.SYSTEM_RESTART){
        if(!this.reOpenWindows)
          this._sessionManagementService.clearAppSession();

        this._systemNotificationService.restartSystemNotify.next(Constants.RSTRT_ORDER_LOCK_SCREEN);
      }else{
        if(!this.reOpenWindows)
          this._sessionManagementService.clearAppSession();

        this._systemNotificationService.shutDownSystemNotify.next();
      }
    }, delay);
  }

  onCloseDialogBox():void{
    this._userNotificationServices.closeDialogMsgBox(this.processId);

    if(this.notificationOption !== UserNotificationType.PowerOnOff){
      this._windowService.removeWindowState(this.processId);
    }

    if(this.notificationOption === UserNotificationType.PowerOnOff){
       this.setPwrDialogPid(this.UPDATE_0);
    }
  }

  onPwrDialogWindowClick(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  onPwrOptionSelect(event: any):void{
    const selectedValue = event.target.value;
    this.selectedOption = selectedValue;
    this.pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;
  }

  async playDialogNotifcationSound():Promise<void>{

    if(this.notificationOption === this.errorNotification)
        await this._audioService.play(this.errorNotificationAudio);
  }

  private generateNotificationId(): number{
    const min = 10;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}
