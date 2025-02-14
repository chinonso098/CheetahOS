import {ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { NotificationService } from '../../system-service/notification.service';
import { NotificationType } from 'src/app/system-files/notification.type';
import { MenuService } from '../../system-service/menu.services';

@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css']
})

export class DialogComponent implements OnChanges {

  @Input() inputMsg = '';
  @Input() notificationType = '';

  private _notificationServices:NotificationService;
  private _menuService:MenuService;

  notificationOption = '';
  errorNotification = NotificationType.Error;
  warnNotification = NotificationType.Warning;
  infoNotification =  NotificationType.Info;


  notificationId = 0;
  type = ComponentType.System;
  displayMgs = '';

  constructor(private changeDetectorRef: ChangeDetectorRef, notificationServices:NotificationService, menuService:MenuService){
    this._notificationServices = notificationServices;
    this._menuService = menuService;
    this.notificationId = this.generateNotificationId();
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

  private generateNotificationId(): number{
    //Yes! it is notification id, not process id. so why the range below 1000, 
    // becuase PropertiesId range from 500 - 999. And it is still a component, compoenets are retrieved by id. 
    const min = 10;
    const max = 499;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

}
