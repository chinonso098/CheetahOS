/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-taskbarentry',
  templateUrl: './taskbarentry.component.html',
  styleUrls: ['./taskbarentry.component.css'],
  standalone:false,
})
export class TaskBarEntryComponent implements OnInit, OnChanges {

  @Input() taskBarIconImgUrl = Constants.EMPTY_STRING;
  @Input() taskBarIconName = Constants.EMPTY_STRING;
  @Input() taskBarPid = 0;
  @Input() taskBarEntryType = Constants.EMPTY_STRING;
  @Output() restoreOrMinizeWindowEvent = new EventEmitter<number>();

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

  ngOnInit(): void {
    this.icon = this.taskBarIconImgUrl;
    this.defaultIcon = this.taskBarIconImgUrl;
    this.name = this.taskBarIconName;
    this.processId = this.taskBarPid;
  }

  ngOnChanges(changes: SimpleChanges):void{
    //console.log('WINDOW onCHANGES:',changes);
    const delay = 5;

    this.setTaskBarEntryType = this.taskBarEntryType;
    this.processId = this.taskBarPid;
    setTimeout(() => {
      this.onTaskBarIconInfoChange();
    }, delay);
  }

  onTaskBarIconInfoChange():void{
    this.name = this.taskBarIconName;
    this.icon = this.taskBarIconImgUrl;
  }

  restoreOrMinizeWindow():void {
    // console.log(' I WAS ALSO CALLLED!!')
    // this.restoreOrMinizeWindowEvent.emit(this.taskBarPid);
  }
}
