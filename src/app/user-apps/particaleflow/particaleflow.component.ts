import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, Input } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

@Component({
  selector: 'cos-particaleflow',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './particaleflow.component.html',
  styleUrl: './particaleflow.component.css'
})
export class ParticaleflowComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('particleFlowCanvas', { static: true }) particleFlowCanvas!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _windowService:WindowService;
  // private _scriptService: ScriptService;
  private _processIdService:ProcessIDService;
  private _processHandlerService:ProcessHandlerService;
  private _runningProcessService:RunningProcessService;
  private _sessionManagmentService:SessionManagmentService;


  private _appState!:AppState;

  name= 'particleflow';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}particles.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Particle Flow';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService,
              windowService:WindowService, triggerProcessService:ProcessHandlerService, sessionManagmentService:SessionManagmentService) { 
                
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  ngAfterViewInit():void{
    const delay = 500; //500ms
  }

  ngOnDestroy(): void {
    const delay = 500; //500ms
  }

  setParticleFlowWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }
  
  storeAppState(app_data:unknown):void{
    const uid = `${this.name}-${this.processId}`;
    this._appState = {
      pid: this.processId,
      app_data: app_data as string,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }
  
  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
      //
    }
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }
}