import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-taskbarentry',
  templateUrl: './taskbarentry.component.html',
  styleUrls: ['./taskbarentry.component.css']
})
export class TaskBarEntryComponent implements OnInit {

  @Input() taskBarIconImgUrl = Constants.EMPTY_STRING;
  @Input() taskBarIconName = Constants.EMPTY_STRING;
  @Input() taskBarPid = 0;
  @Input() taskBarEntryType = Constants.EMPTY_STRING;

  @Output() restoreOrMinizeWindowEvent = new EventEmitter<number>();

  taskBarShowLabelEntryOption = 'showLabel';
  taskBarHideLabelEntryOption = 'hideLabel';

  hasWindow = false;
  hover = false;
  icon = Constants.EMPTY_STRING;
  name = Constants.EMPTY_STRING;
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  constructor( ){
    //this.taskBarEntryType = this.taskBarHideLabelEntryOption;
  }

  ngOnInit(): void {
    this.icon = this.taskBarIconImgUrl;
    this.name = this.taskBarIconName;
    this.processId = this.taskBarPid;
    //this.taskBarEntryType = this.taskBarHideLabelEntryOption;
  }

  restoreOrMinizeWindow() {
    this.restoreOrMinizeWindowEvent.emit(this.taskBarPid);
  }
}
