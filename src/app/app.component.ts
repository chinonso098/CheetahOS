import {Component,ViewChild, ViewContainerRef, OnDestroy, OnInit, AfterViewInit} from '@angular/core';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { ProcessHandlerService } from './shared/system-service/process.handler.service';

import { ComponentType } from './system-files/system.types';
import { Process } from './system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { AudioService } from './shared/system-service/audio.services';


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
  private _processHandlerService:ProcessHandlerService;
  private _audioService:AudioService;


  private SECONDS_DELAY = 1500;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system';
  processId = Constants.ZERO;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  noAudio = `${Constants.AUDIO_BASE_PATH}no_audio.mp3`;

  
  // the order of the service init matter.
  //runningProcesssService must come first
  constructor(audioService:AudioService, runningProcessService:RunningProcessService, processIdService:ProcessIDService, 
              controlProcessService:ProcessHandlerService,  componentReferenceService:ComponentReferenceService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._runningProcessService = runningProcessService;
    this._processHandlerService = controlProcessService; 
    this._audioService = audioService;
    this._componentReferenceService = componentReferenceService; 
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit():void{
    // This quiets the - audioservice error
    this._audioService.play(this.noAudio);

    if(this.itemViewContainer)
      this._componentReferenceService.setViewContainerRef(this.itemViewContainer);

    setTimeout(()=> {
      this._processHandlerService.checkAndRestore();
    }, this.SECONDS_DELAY);

  }

  ngOnDestroy():void{
    1
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
