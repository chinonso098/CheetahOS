import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationType } from 'src/app/system-files/notification.type';

import { MenuService } from '../../system-service/menu.services';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SessionManagmentService } from '../../system-service/session.management.service';
import { ProcessIDService } from '../../system-service/process.id.service';
import { WindowService } from '../../system-service/window.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';

import { Constants } from 'src/app/system-files/constants';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';


@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css']
})

export class DialogComponent implements BaseComponent, OnChanges {

  @Input() inputMsg = Constants.EMPTY_STRING;
  @Input() notificationType = Constants.EMPTY_STRING;

  private _userNotificationServices:UserNotificationService;
  private _windowService:WindowService;
  private _sessionManagementService: SessionManagmentService;
  private _menuService:MenuService;
  private _processIdService:ProcessIDService;
  private _systemNotificationServices:SystemNotificationService;


  notificationOption = Constants.EMPTY_STRING;
  errorNotification = UserNotificationType.Error;
  warnNotification = UserNotificationType.Warning;
  infoNotification =  UserNotificationType.Info;
  pwrOnOffNotification =  UserNotificationType.PowerOnOff;

  cheetahOS = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  myComputer = `${Constants.IMAGE_BASE_PATH}my_computer.png`;

  pwrOnOffOptions = [
    { value: 'Shut down', label: 'Closes all apps and turns off the PC.' },
    { value: 'Restart', label: 'Closes all apps and turns off the PC, and turns it on again.' }
  ];

  isReopenWindowsChecked = false;
  selectedOption = 'Shut down';
  pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;

  readonly ERROR_DIALOG = 'error-dialog';
  readonly WARNING_DIALOG = 'warning-dialog';
  readonly INFO_DIALOG = 'info-dialog';


  type = ComponentType.System;
  displayMgs = Constants.EMPTY_STRING;
  name = Constants.EMPTY_STRING;
  hasWindow = false;
  isMaximizable = false;
  icon = Constants.EMPTY_STRING;
  processId = Constants.NUM_ZERO;
  displayName = Constants.EMPTY_STRING;

  constructor(notificationServices:UserNotificationService, menuService:MenuService, windowService:WindowService,
              systemNotificationServices:SystemNotificationService, sessionManagementService:SessionManagmentService, processIdService:ProcessIDService){
    this._userNotificationServices = notificationServices;
    this._menuService = menuService;
    this._sessionManagementService = sessionManagementService;
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._systemNotificationServices = systemNotificationServices;

    this.processId = this._processIdService.getNewProcessId();
  }

  ngOnChanges(changes: SimpleChanges):void{
    console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
    this.notificationOption =this.notificationType;
  }

  onYesDialogBox():void{
    this._menuService.createDesktopShortcut.next();
  }

  onCheckboxChange() {
    console.log('Checkbox is checked:', this.isReopenWindowsChecked);
  }

  onYesPowerDialogBox():void{
    if(this.selectedOption === Constants.SYSTEM_RESTART){
      if(!this.isReopenWindowsChecked)
        this._sessionManagementService.clearAppSession();

      this._systemNotificationServices.restartSystemNotify.next();
    }else{
      if(!this.isReopenWindowsChecked)
        this._sessionManagementService.clearAppSession();

      this._systemNotificationServices.shutDownSystemNotify.next();
    }
  }

  onCloseDialogBox():void{
    this._userNotificationServices.closeDialogMsgBox(this.processId);
    this._windowService.removeWindowState(this.processId);
  }

  onPwrOptionSelect(event: any):void{
    const selectedValue = event.target.value;
    this.selectedOption = selectedValue;
    this.pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;
  }

  private generateNotificationId(): number{
    const min = 10;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}
