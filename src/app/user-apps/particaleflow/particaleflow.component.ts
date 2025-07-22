import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, Input, Renderer2 } from '@angular/core';
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
import { ParticleScene } from './particle.types';

@Component({
  selector: 'cos-particaleflow',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './particaleflow.component.html',
  styleUrl: './particaleflow.component.css'
})
export class ParticaleFlowComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _windowService:WindowService;
  // private _scriptService: ScriptService;
  private _processIdService:ProcessIDService;
  private _processHandlerService:ProcessHandlerService;
  private _runningProcessService:RunningProcessService;
  private _sessionManagmentService:SessionManagmentService;


  private _appState!:AppState;
  private _particileScene!: ParticleScene;
  private _x = 0;
  private _y = 0;

  name= 'particleflow';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}particles.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Particle Flow';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, private renderer: Renderer2,
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
    this.initScene();
    this.getParticle();
    this.animate();
  }

  ngOnDestroy(): void {
    const delay = 500; //500ms
  }

  initScene():void{
    const nativeEl = document.getElementById('particleFlowCntnr') as HTMLElement;
    const width = nativeEl.offsetWidth;
    const height = nativeEl.offsetHeight;

    const canvas = this.renderer.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Append to the body
    this.renderer.appendChild(nativeEl, canvas);
    canvas.width = width;
    canvas.height = height;
    const timeMult = 0.0002;

    // console.log('initScene-ctx:', ctx);
    // console.log('initScene-width:', width);
    // console.log('initScene-height:', height);

    this._particileScene = {context:ctx, width:width, height:height };
  }

  animate():void{
    const data:ParticleScene = this._particileScene;
    console.log('animate:', data);

    const ctx  = data.context;
    requestAnimationFrame(this.animate.bind(this));
    ctx.clearRect(Constants.NUM_ZERO, Constants.NUM_ZERO, data.width, data.height);

    this.update()
    this.render(ctx);
  }

  render(ctx:CanvasRenderingContext2D):void{
    ctx.fillStyle = "rgba(225, 225, 225, 1.0)";
    ctx.beginPath();
    ctx.arc(this._x, this._y, Constants.NUM_TEN, Constants.NUM_ZERO, Math.PI * Constants.NUM_TWO);
    ctx.fill();
  } 

  update():void{
    const xVel = Math.random() * Constants.NUM_TWO;
    const yVel = Math.random() * Constants.NUM_TWO;
    this._x += xVel;
    this._y += yVel;
  }

  getParticle():void{
    const data:ParticleScene = this._particileScene;
    this._x = data.width * Constants.NUM_HALF;
    this._y = data.height * Constants.NUM_HALF;
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