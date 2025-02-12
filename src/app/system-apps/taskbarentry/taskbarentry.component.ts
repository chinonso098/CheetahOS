import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-taskbarentry',
  templateUrl: './taskbarentry.component.html',
  styleUrls: ['./taskbarentry.component.css']
})
export class TaskBarEntryComponent implements OnInit {

  @Input() taskBarIconImgUrl = ''
  @Input() taskBarIconName = ''
  @Input() taskBarPid = 0
  @Output() restoreOrMinizeWindowEvent = new EventEmitter<number>();

  hasWindow = false;
  hover = false;
  icon = '';
  name = '';
  processId = 0;
  type = ComponentType.System;
  displayName = '';

  constructor( ){
    //
  }

  ngOnInit(): void {
    this.icon = this.taskBarIconImgUrl;
    this.name = this.taskBarIconName;
    this.processId = this.taskBarPid;
  }

  restoreOrMinizeWindow() {
    this.restoreOrMinizeWindowEvent.emit(this.taskBarPid);
  }
}
