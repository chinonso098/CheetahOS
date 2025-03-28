import {Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { UserNotificationType } from 'src/app/system-files/notification.type';
import { MenuService } from '../../system-service/menu.services';
import { Subscription } from 'rxjs';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css']
})

export class DialogComponent implements OnChanges, OnDestroy {

  @Input() inputMsg = '';
  @Input() notificationType = '';

  private _notificationServices:UserNotificationService;
  private _systemNotificationServices:SystemNotificationService;
  private _menuService:MenuService;

  private _deskTopIsActiveSub!:Subscription;
  private _lockScreenIsActiveSub!:Subscription;

  notificationOption = '';
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

  selectedOption = 'Shut down';
  pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;
  notificationId = 0;
  type = ComponentType.System;
  displayMgs = '';

  constructor(notificationServices:UserNotificationService, systemNotificationServices:SystemNotificationService,
    menuService:MenuService){
    this._notificationServices = notificationServices;
    this._menuService = menuService;
    this._systemNotificationServices = systemNotificationServices;

    this.notificationId = this.generateNotificationId();
    this._lockScreenIsActiveSub = this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._deskTopIsActiveSub = this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnChanges(changes: SimpleChanges):void{
    console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
    this.notificationOption =this.notificationType;
  }

  onYesDialogBox():void{
    this._menuService.createDesktopShortcut.next();
  }

  onYesPowerDialogBox():void{
    // if(this.selectedOption === Constants.SYSTEM_RESTART){
    //   this._systemNotificationServices.restartSystemNotify.next();
    // }else{
    //   this._systemNotificationServices.shutDownSystemNotify.next();
    // }
  }

  onCloseDialogBox():void{
    this._notificationServices.closeDialogBoxNotify.next(this.notificationId);
  }

  onPwrOptionSelect(event: any):void{
    const selectedValue = event.target.value;
    this.selectedOption = selectedValue;
    this.pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;
  }

  ngOnDestroy(): void {
    this._deskTopIsActiveSub?.unsubscribe();
    this._lockScreenIsActiveSub?.unsubscribe();
  }

  private generateNotificationId(): number{
    //Yes! it is notification id, not process id. so why the range below 1000, 
    // becuase PropertiesId range from 500 - 999. And it is still a component, compoenets are retrieved by id. 
    const min = 10;
    const max = 499;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

  lockScreenIsActive():void{
    const errDiagElmnt = document.getElementById(`error-dialog-${this.notificationId}`) as HTMLDivElement;
    if(errDiagElmnt) {
      errDiagElmnt.style.zIndex = '0';
    }

    const infoDiagElmnt = document.getElementById(`info-dialog-${this.notificationId}`) as HTMLDivElement;
    if(infoDiagElmnt) {
      infoDiagElmnt.style.zIndex = '0';
    }

    const warnDiagElmnt = document.getElementById(`warning-dialog-${this.notificationId}`) as HTMLDivElement;
    if(warnDiagElmnt) {
      warnDiagElmnt.style.zIndex = '0';
    }

    const pwrDiagElmnt = document.getElementById(`shutdown-restart-dialog-${this.notificationId}`) as HTMLDivElement;
    if(pwrDiagElmnt) {
      pwrDiagElmnt.style.zIndex = '0';
    }
  }

  desktopIsActive():void{
    const errDiagElmnt = document.getElementById(`error-dialog-${this.notificationId}`) as HTMLDivElement;
    if(errDiagElmnt) {
      errDiagElmnt.style.zIndex = '2';
    }

    const infoDiagElmnt = document.getElementById(`info-dialog-${this.notificationId}`) as HTMLDivElement;
    if(infoDiagElmnt) {
      infoDiagElmnt.style.zIndex = '2';
    }

    const warnDiagElmnt = document.getElementById(`warning-dialog-${this.notificationId}`) as HTMLDivElement;
    if(warnDiagElmnt) {
      warnDiagElmnt.style.zIndex = '2';
    }

    const pwrDiagElmnt = document.getElementById(`shutdown-restart-dialog-${this.notificationId}`) as HTMLDivElement;
    if(pwrDiagElmnt) {
      pwrDiagElmnt.style.zIndex = '2';
    }
  }

}
