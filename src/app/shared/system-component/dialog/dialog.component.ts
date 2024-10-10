import {ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
import { NotificationService } from '../../system-service/notification.service';
import { NotificationType } from 'src/app/system-files/notification.type';

@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css']
})


export class DialogComponent implements OnChanges {

  @Input() inputMsg = '';
  @Input() notificationType = '';

  private _notificationServices:NotificationService;

  notificationOption = '';
  errorNotification = NotificationType.Error;
  warnNotification = NotificationType.Warning;
  infoNotification =  NotificationType.Info;


  notificationId = 0;
  type = ComponentType.System;
  displayMgs = '';

  constructor(private changeDetectorRef: ChangeDetectorRef, notificationServices:NotificationService){
    this._notificationServices = notificationServices;
    this.notificationId = this.generateNotificationId();
  }


  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
    this.notificationOption =this.notificationType;
  }


  onCloseDialogBox():void{
    this._notificationServices.closeDialogBoxNotify.next(this.notificationId);
  }

  private generateNotificationId(): number{
    const min = Math.ceil(0);
    const max = Math.floor(499);
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

}
