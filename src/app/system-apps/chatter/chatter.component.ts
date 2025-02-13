import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { WindowService } from 'src/app/shared/system-service/window.service';

@Component({
  selector: 'cos-chatter',
  templateUrl: './chatter.component.html',
  styleUrl: './chatter.component.css'
})
export class ChatterComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
    private _windowService:WindowService;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
  name = 'chatter';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Chatter';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService ,windowService:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit(): void {
    1
  }

  ngOnDestroy():void{
    1
  }

  setChatterWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
