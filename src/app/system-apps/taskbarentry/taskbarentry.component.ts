import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-taskbarentry',
  templateUrl: './taskbarentry.component.html',
  styleUrls: ['./taskbarentry.component.css']
})
export class TaskBarEntryComponent implements OnInit, OnDestroy {

  @Input() taskBarIconImgUrl = Constants.EMPTY_STRING;
  @Input() taskBarIconName = Constants.EMPTY_STRING;
  @Input() taskBarPid = 0;
  @Input() taskBarEntryType = Constants.EMPTY_STRING;
  @Output() restoreOrMinizeWindowEvent = new EventEmitter<number>();

  private _systemNotificationService:SystemNotificationService;
  private _taskBarIconInfoChangeSub!: Subscription;

  taskBarShowLabelEntryOption = 'showLabel';
  taskBarHideLabelEntryOption = 'hideLabel';

  setTaskBarEntryType = this.taskBarEntryType;

  hasWindow = false;
  hover = false;
  icon = Constants.EMPTY_STRING;
  name = Constants.EMPTY_STRING;
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  defaultIcon = Constants.EMPTY_STRING;

  constructor(systemNotificationService:SystemNotificationService){
    this._systemNotificationService = systemNotificationService;

    this._taskBarIconInfoChangeSub = this._systemNotificationService.taskBarIconInfoChangeNotify.subscribe((p) =>{this.onTaskBarIconInfoChange(p); });
  }

  ngOnInit(): void {
    this.icon = this.taskBarIconImgUrl;
    this.defaultIcon = this.taskBarIconImgUrl;
    this.name = this.taskBarIconName;
    this.processId = this.taskBarPid;
    //this.taskBarEntryType = this.taskBarHideLabelEntryOption;
  }

  ngOnDestroy(): void {
    this._taskBarIconInfoChangeSub?.unsubscribe();
  }

  onTaskBarIconInfoChange(info:string[]):void{
    console.log('onTaskBarIconInfoChange:',info);
    if(this.setTaskBarEntryType === this.taskBarShowLabelEntryOption){
      const pid = Number(info[0]);
      if(this.processId === pid){
        this.name = info[1];
        this.icon = info[2];
      }
    }

  }

  restoreOrMinizeWindow() {
    this.restoreOrMinizeWindowEvent.emit(this.taskBarPid);
  }
}
