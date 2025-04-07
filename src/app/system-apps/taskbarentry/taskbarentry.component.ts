import { Component, EventEmitter, Input, OnInit, Output, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-taskbarentry',
  templateUrl: './taskbarentry.component.html',
  styleUrls: ['./taskbarentry.component.css']
})
export class TaskBarEntryComponent implements OnInit, OnDestroy, OnChanges {

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

  ngOnChanges(changes: SimpleChanges):void{
    const delay = 10;
    console.log('WINDOW onCHANGES:',changes);
    this.setTaskBarEntryType = this.taskBarEntryType;

    setTimeout(() => {
      this.onTaskBarIconInfoChange();
    }, delay);
  }

  onTaskBarIconInfoChange(info?:Map<number, string[]>):void{
    if(info){
      const firstEntry = info.entries().next().value;
      if (firstEntry) {
        const [key, value] = firstEntry;
        if(this.setTaskBarEntryType === this.taskBarShowLabelEntryOption){
          const pid = key;
          if(this.processId === pid){
            this.name = value[0];
            this.icon = value[1];
          }
        }        
      } else { console.log("The map is empty."); }
    }else{
      const tmpInfo = this._systemNotificationService.getAppIconNotication(this.taskBarPid);
       if(this.setTaskBarEntryType === this.taskBarShowLabelEntryOption){
        if(tmpInfo.length > 0){
          this.name = tmpInfo[0];
          this.icon = tmpInfo[1];
        }
      }
    }
  }

  restoreOrMinizeWindow():void {
    this.restoreOrMinizeWindowEvent.emit(this.taskBarPid);
  }
}
