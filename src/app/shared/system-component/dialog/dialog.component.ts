import {ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { NotificationService } from '../../system-service/notification.service';
import { NotificationType } from 'src/app/system-files/notification.type';
import { MenuService } from '../../system-service/menu.services';
import { RunningProcessService } from '../../system-service/running.process.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css']
})

export class DialogComponent implements OnChanges, OnDestroy {

  @Input() inputMsg = '';
  @Input() notificationType = '';

  private _notificationServices:NotificationService;
  private _menuService:MenuService;
  private _runningProcessService:RunningProcessService;

  private _deskTopIsActiveSub!:Subscription;
  private _lockScreenIsActiveSub!:Subscription;

  notificationOption = '';
  errorNotification = NotificationType.Error;
  warnNotification = NotificationType.Warning;
  infoNotification =  NotificationType.Info;


  notificationId = 0;
  type = ComponentType.System;
  displayMgs = '';

  constructor(notificationServices:NotificationService, 
    menuService:MenuService, runningProcessService:RunningProcessService){
    this._notificationServices = notificationServices;
    this._menuService = menuService;
    this._runningProcessService =runningProcessService;

    this.notificationId = this.generateNotificationId();
    this._lockScreenIsActiveSub = this._runningProcessService.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._deskTopIsActiveSub = this._runningProcessService.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
    this.notificationOption =this.notificationType;
  }

  onYesDialogBox():void{
    this._menuService.createDesktopShortcut.next();
  }

  onCloseDialogBox():void{
    this._notificationServices.closeDialogBoxNotify.next(this.notificationId);
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
  }

}
