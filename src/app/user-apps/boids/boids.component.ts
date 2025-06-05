import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';
import { Boid } from './boid';
import { FormBuilder, FormGroup } from '@angular/forms';

declare const Tweakpane:any;
declare const p5:any;

@Component({
  selector: 'cos-boids',
  templateUrl: './boids.component.html',
  styleUrls: ['./boids.component.css']
})
export class BoidsComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('boidCanvas', { static: true }) boidCanvas!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  
  private _scriptService: ScriptService;
  private _windowService:WindowService;
  private _triggerProcessService:TriggerProcessService;

  private p5Instance: any;
  flocks: Boid[] = [];

  params = {
    align: 1.2,
    cohesion: 1.5,
    separation: 1.8
  };

 form!:FormGroup;

  name= 'boids';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}audioplayer.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Boids';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService,  scriptService: ScriptService, 
              windowService:WindowService, triggerProcessService:TriggerProcessService, private fb: FormBuilder) { 
                
    this._processIdService = processIdService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._triggerProcessService = triggerProcessService;

    this.processId = this._processIdService.getNewProcessId();


    this._runningProcessService = runningProcessService;
    // this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    // this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
    // this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {

    this.form = this.fb.group({
      align: [1.2],
      cohesion: [1.5],
      separation: [1.8]
    });

    this._scriptService.loadScript("P5JS","osdrive/Cheetah/System/P5JS/p5.min.js").then(()=>{
      console.log('p5 loaded');
    });
    // this._scriptService.loadScript("TweakPane","osdrive/Cheetah/System/TweakPaneJS/tweakpane.min.js").then(()=>{
    //       console.log('tweakpane loaded');
    //     this._scriptService.loadScript("P5JS","osdrive/Cheetah/System/P5JS/p5.min.js").then(()=>{
    //       console.log('p5 loaded');
    //     });
    // });
  }

  ngAfterViewInit():void{
    setTimeout(() => {
      this.p5Instance = new p5(this.sketch.bind(this), this.boidCanvas.nativeElement);
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
    }
  }

  sketch_old(p: any) {
    console.log('What is this:', p);
    const boidCntnr = document.getElementById('boidCntnr');
    let pane: any;

    p.setup = () => {
      p.createCanvas(boidCntnr?.offsetWidth, boidCntnr?.offsetHeight);

      pane = new Tweakpane.Pane();
      pane.addInput(this.params, 'align', { min: 0, max: 2 });
      pane.addInput(this.params, 'cohesion', { min: 0, max: 2 });
      pane.addInput(this.params, 'separation', { min: 0, max: 2 });

      for (let i = 0; i < 100; i++) {
        this.flocks.push(new Boid(p));
      }
    };

    p.draw = () => {
      p.background('#393e46');
      for (const particle of this.flocks) {
        particle.edges();
        particle.behavior(this.flocks, this.params);
        particle.update();
        particle.draw();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(boidCntnr?.offsetWidth, boidCntnr?.offsetHeight);
    };
  }

  sketch(p: any) {
    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
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
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  }

  setBoidWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
  return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
}
}


