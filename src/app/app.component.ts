import {Component,ViewChild, ViewContainerRef, OnDestroy, OnInit, AfterViewInit} from '@angular/core';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { ControlProcessService } from './shared/system-service/trigger.process.service';

import { ComponentType } from './system-files/system.types';
import { Process } from './system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';


@Component({
  selector: 'cos-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

/**
 *  This is the main app component
 */
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
 
  // @ViewChild('processContainerRef',  { read: ViewContainerRef })
  // private itemViewContainer!: ViewContainerRef
  
  @ViewChild('processContainerRef', { read: ViewContainerRef })itemViewContainer!: ViewContainerRef

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _componentReferenceService:ComponentReferenceService;
  private _controlProcessService:ControlProcessService;



  // private userOpenedAppsList:string[] = [];
  // private retreivedKeys:string[] = [];
  // private userOpenedAppsKey = "openedApps";
  // private reOpendAppsCounter = Constants.ZERO;
  private SECONDS_DELAY:number[] =[1500, 1500];

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system';
  processId = Constants.ZERO;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  
  // the order of the service init matter.
  //runningProcesssService must come first
  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, controlProcessService:ControlProcessService, componentReferenceService:ComponentReferenceService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._runningProcessService = runningProcessService;
    this._controlProcessService = controlProcessService; 
    this._componentReferenceService = componentReferenceService; 
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit():void{
    // This quiets the - Expression has changed after it was checked.
    //TODO: change detection is the better solution TBD

    if(this.itemViewContainer)
      this._componentReferenceService.setViewContainerRef(this.itemViewContainer);

    setTimeout(()=> {
        // const priorSessionInfo = this.fetchPriorSessionInfo();
        // const sessionKeys = this.getSessionKey(priorSessionInfo);
        // this.restorePriorSession(sessionKeys);
    }, this.SECONDS_DELAY[0]);

  }

  ngOnDestroy():void{
    1
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
