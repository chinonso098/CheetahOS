import {Component,ViewChild, ViewContainerRef, AfterViewInit, OnInit} from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';

import { ComponentType } from './system-files/system.types';
import { Process } from './system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { AudioService } from './shared/system-service/audio.services';
import { SessionManagementService } from './shared/system-service/session.management.service';
import { FileIndexerService } from './shared/system-service/file.indexer.services';
import { DefaultService } from './shared/system-service/defaults.services';
import { CommonFunctions } from './system-files/commons/common.functions';

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
export class AppComponent implements AfterViewInit, OnInit {
 
  // @ViewChild('processContainerRef',  { read: ViewContainerRef })
  // private itemViewContainer!: ViewContainerRef
  
  @ViewChild('processContainerRef', { read: ViewContainerRef })itemViewContainer!: ViewContainerRef

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _componentReferenceService:ComponentReferenceService;
  private _defaultService:DefaultService;
  private _swUpdate:SwUpdate;


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  readonly name = 'system';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  // the order of the service init matter.
  //runningProcesssService must come first
  //a number of these servies are injected here (like fileIndexerService), even though it isn't utiized hear. This is to get around 
  //circular reference error, should it be injected in the fileService
  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, audioService:AudioService, 
              componentReferenceService:ComponentReferenceService, fileIndexerService: FileIndexerService, sessionManagementService:SessionManagementService,
              defaultService:DefaultService, swUpdate:SwUpdate){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._componentReferenceService = componentReferenceService; 
    this._defaultService = defaultService;
    this._swUpdate = swUpdate;

    this._runningProcessService.addProcess(this.getComponentDetail());
    this.listenForServiceWorkerUpdates();
  }

    /**
     * When a new build is deployed, the service worker downloads it in the
     * background. Once those assets are ready we activate them immediately so the
     * NEXT page load serves the new version. We deliberately do NOT force a reload
     * here: CheetahOS keeps live, unsaved desktop state, and yanking the page out
     * from under the user would be jarring. Activating quietly gives a seamless
     * "updates on next visit" behavior. No-ops in dev (worker disabled).
     */
    private listenForServiceWorkerUpdates():void{
      if(!this._swUpdate.isEnabled)
        return;

      this._swUpdate.versionUpdates
        .pipe(filter((evt):evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          this._swUpdate.activateUpdate();
        });
    }

    ngOnInit(): void{
      const currentURL = CommonFunctions.getCurrentURL();
      if(currentURL.includes(Constants.PROD_END_POINT)){
        this._defaultService.updateDefaultData(Constants.ENVIRONMENT, Constants.PROD);
      }else{
        this._defaultService.updateDefaultData(Constants.ENVIRONMENT, Constants.NON_PROD);
      }

    }

    async ngAfterViewInit(): Promise<void>{

      if(this.itemViewContainer)
        this._componentReferenceService.setViewContainerRef(this.itemViewContainer);

      // console.log("OS:", CommonFunctions.getOS());
      // console.log("Browser:", CommonFunctions.getBrowser());
    }

    private getComponentDetail():Process{
      return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }
}
