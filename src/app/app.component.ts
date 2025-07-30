import {Component,ViewChild, ViewContainerRef, OnInit, AfterViewInit} from '@angular/core';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';

import { ComponentType } from './system-files/system.types';
import { Process } from './system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { AudioService } from './shared/system-service/audio.services';
import { SessionManagmentService } from './shared/system-service/session.management.service';

@Component({
  selector: 'cos-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false
})

/**
 *  This is the main app component
 */
export class AppComponent implements AfterViewInit {
 
  // @ViewChild('processContainerRef',  { read: ViewContainerRef })
  // private itemViewContainer!: ViewContainerRef
  
  @ViewChild('processContainerRef', { read: ViewContainerRef })itemViewContainer!: ViewContainerRef

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _componentReferenceService:ComponentReferenceService;
  private _audioService:AudioService;
  private _sessionManagmentService:SessionManagmentService;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  noAudio = `${Constants.AUDIO_BASE_PATH}no_audio.mp3`;

  // the order of the service init matter.
  //runningProcesssService must come first
  constructor(audioService:AudioService, runningProcessService:RunningProcessService, processIdService:ProcessIDService, 
              componentReferenceService:ComponentReferenceService, sessionManagmentService:SessionManagmentService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._componentReferenceService = componentReferenceService; 
    this._sessionManagmentService = sessionManagmentService;

    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngAfterViewInit():void{
    // This quiets the - audioservice error
    // const cheetahLogonKey = this._sessionManagmentService.getSession(Constants.CHEETAH_LOGON_KEY) as string;
    // const cheetahPwrKey = this._sessionManagmentService.getSession(Constants.CHEETAH_PWR_KEY) as string;

    // if(cheetahPwrKey === Constants.SYSTEM_ON && cheetahLogonKey === Constants.SIGNED_IN){
    //   this._audioService.play(this.noAudio);
    // }


    if(this.itemViewContainer)
      this._componentReferenceService.setViewContainerRef(this.itemViewContainer);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
