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
import { Boid } from './boid';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

declare const p5:any;

@Component({
  selector: 'cos-boids',
  templateUrl: './boids.component.html',
  styleUrls: ['./boids.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class BoidsComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('boidCanvas', { static: true }) boidCanvas!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _windowService:WindowService;
  private _scriptService: ScriptService;
  private _processIdService:ProcessIDService;
  private _processHandlerService:ProcessHandlerService;
  private _runningProcessService:RunningProcessService;
  private _sessionManagmentService:SessionManagmentService;


  private _appState!:AppState;
  private p5Instance: any;
  flocks: Boid[] = [];

  params = {
    align: 1.2,
    cohesion: 1.5,
    separation: 1.8
  };

  form!:FormGroup;
  sliders = ['align', 'cohesion', 'separation'];

  name= 'boids';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}bird_oid.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Boids';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService,  scriptService: ScriptService, 
              windowService:WindowService, triggerProcessService:ProcessHandlerService, private fb: FormBuilder,
              sessionManagmentService:SessionManagmentService) { 
                
    this._processIdService = processIdService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      align: [1.2],
      cohesion: [1.5],
      separation: [1.4]
    });

    this._scriptService.loadScript("P5JS","osdrive/Cheetah/System/P5JS/p5.min.js").then(()=>{
      console.log('p5 loaded');
    });

    this.retrievePastSessionData();
  }

  ngAfterViewInit():void{
    const delay = 500; //500ms
    setTimeout(() => {
      this.p5Instance = new p5(this.sketch.bind(this), this.boidCanvas.nativeElement);
    }, delay);
  }

  ngOnDestroy(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
    }
  }

  sketch(p: any) {
    const boidCntnr = document.getElementById('boidCntnr');
    p.setup = () => {
      p.createCanvas(boidCntnr?.offsetWidth, boidCntnr?.offsetHeight);

      for (let i = 0; i < 100; i++) {
        this.flocks.push(new Boid(p));
      }
    };

    p.draw = () => {
      p.background('#393e46');
      const params = this.form.value;

      for (const boid of this.flocks) {
        boid.edges();
        boid.behavior(this.flocks, params);
        boid.update();
        boid.draw();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(boidCntnr?.offsetWidth, boidCntnr?.offsetHeight);
    };
  }

  setBoidWindowToFocus(pid:number):void{
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


