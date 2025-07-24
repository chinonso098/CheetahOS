// import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, Input, Renderer2 } from '@angular/core';
// import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
// import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
// import { ScriptService } from 'src/app/shared/system-service/script.services';
// import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
// import { WindowService } from 'src/app/shared/system-service/window.service';
// import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
// import { Constants } from 'src/app/system-files/constants';
// import { Process } from 'src/app/system-files/process';
// import { ComponentType } from 'src/app/system-files/system.types';
// import { AppState } from 'src/app/system-files/state/state.interface';
// import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
// import { ParticleScene } from './particle.types';

// @Component({
//   selector: 'cos-particaleflow',
//   // eslint-disable-next-line @angular-eslint/prefer-standalone
//   standalone: false,
//   templateUrl: './particaleflow.component.html',
//   styleUrl: './particaleflow.component.css'
// })
// export class ParticaleFlowComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
//   @Input() priorUId = Constants.EMPTY_STRING;
  
//   private _windowService:WindowService;
//   // private _scriptService: ScriptService;
//   private _processIdService:ProcessIDService;
//   private _processHandlerService:ProcessHandlerService;
//   private _runningProcessService:RunningProcessService;
//   private _sessionManagmentService:SessionManagmentService;
//   private _animationId = 0;


//   private _appState!:AppState;
//   private _particileScene!: ParticleScene;
//   // private _x = 0;
//   // private _y = 0;

//   private particle!:any;
//   private emitter!:any;

//   name= 'particleflow';
//   hasWindow = true;
//   isMaximizable=false;
//   icon = `${Constants.IMAGE_BASE_PATH}particles.png`;
//   processId = 0;
//   type = ComponentType.User;
//   displayName = 'Particle Flow';


//   constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, private renderer: Renderer2,
//               windowService:WindowService, triggerProcessService:ProcessHandlerService, sessionManagmentService:SessionManagmentService) { 
                
//     this._processIdService = processIdService;
//     this._windowService = windowService;
//     this._processHandlerService = triggerProcessService;
//     this._sessionManagmentService = sessionManagmentService;

//     this.processId = this._processIdService.getNewProcessId();
//     this._runningProcessService = runningProcessService;
//     this._runningProcessService.addProcess(this.getComponentDetail());
//   }

//   ngOnInit(): void {
//     this.retrievePastSessionData();
//   }

//   ngAfterViewInit():void{
//     this.initScene();

//     this.particle = this.getParticle();
//     this.emitter = this.getParticleEmitter();

//     this.animate();
//   }

//   ngOnDestroy(): void {
//     const delay = 500; //500ms
//     cancelAnimationFrame(this._animationId);
//   }

//   initScene():void{
//     const nativeEl = document.getElementById('particleFlowCntnr') as HTMLElement;
//     const width = nativeEl.offsetWidth;
//     const height = nativeEl.offsetHeight;

//     const canvas = this.renderer.createElement('canvas');
//     const ctx = canvas.getContext('2d');
    
//     // Append to the body
//     this.renderer.appendChild(nativeEl, canvas);
//     canvas.width = width;
//     canvas.height = height;
//     const timeMult = 0.0002;

//     this._particileScene = {context:ctx, width:width, height:height};
//   }

//   getParticle():{ update: () => void;  render: (ctx: CanvasRenderingContext2D) => void;} {
//     const data:ParticleScene = this._particileScene;
//     const angle = Math.random() * Math.PI * 2;
//     const speed_erratic = Math.random() * 2 + 1

//     let x = data.width * Constants.NUM_HALF;
//     let y = data.height * Constants.NUM_HALF;

//     // const xVel = Math.random() * 2 - 1;
//     // const yVel = Math.random() * 2 - 1;

//     const vel = {
//       x: Math.cos(angle) * speed_erratic,
//       y:Math.sin(angle) * speed_erratic
//     }

//     let alpha = 1.0;
//     const fadeRate = 0.003
//     function update(): void {
//       x += vel.x;
//       y += vel.y;
//       alpha -= fadeRate
//     }

//     function render(ctx:CanvasRenderingContext2D):void{
//       ctx.fillStyle = `rgba(225, 0, 225, ${alpha})`;
//       ctx.beginPath();
//       ctx.arc(x, y, 4, 0, Math.PI * 2);
//       ctx.fill();
//     } 

//     return {update , render}
//   }

//   getParticleEmitter(): {update: () => void; }{
//     const data:ParticleScene = this._particileScene;  
//     const particles: { update: () => void; render: (ctx: CanvasRenderingContext2D) => void; }[] = [];
//     const maxParticles = 500;

//     const update = () =>{
//       particles.forEach( p =>{
//           p.update();
//           p.render(data.context);
//       })

//       const particle = this.getParticle();
//       particles.push(particle);

//       while(particles.length > maxParticles){
//         particles.shift();
//       }
//     }

//     return {update}
//   }

//   animate():void{
//     const data:ParticleScene = this._particileScene;
//     console.log('animate:', data);

//     const ctx  = data.context;
//     this._animationId = requestAnimationFrame(this.animate.bind(this));
//     //ctx.clearRect(0, 0, data.width, data.height);

//     //create trails
//     ctx.fillStyle = 'rgba(0, 0, 0.01)';
//     ctx.fillRect(0, 0, data.width, data.height);

//     this.emitter.update();
//   }

//   setParticleFlowWindowToFocus(pid:number):void{
//     this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
//   }
  
//   storeAppState(app_data:unknown):void{
//     const uid = `${this.name}-${this.processId}`;
//     this._appState = {
//       pid: this.processId,
//       app_data: app_data as string,
//       app_name: this.name,
//       unique_id: uid,
//       window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
//     }
//     this._sessionManagmentService.addAppSession(uid, this._appState);
//   }
  
//   retrievePastSessionData():void{
//     const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
//     if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
//       //
//     }
//   }

//   private getComponentDetail():Process{
//     return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
//   }
// }


//Uncomment the code above, and comment the one below, for a simple particle emitter



import { Component, OnDestroy, OnInit, AfterViewInit, Input, Renderer2 } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { ParticleScene } from './particle.types';
import { getCurl } from './curl';

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
  private _processIdService:ProcessIDService;
  private _processHandlerService:ProcessHandlerService;
  private _runningProcessService:RunningProcessService;
  private _sessionManagmentService:SessionManagmentService;
  private _animationId = 0;


  private _appState!:AppState;
  private _particileScene!: ParticleScene;
  private emitter!:any;

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
    this.emitter = this.getParticleEmitter();
    this.animate(0);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this._animationId);
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
    this._particileScene = {context:ctx, width:width, height:height};
  }

  getParticle(opts:any):{ update: (t:any) => void;  render: (ctx: CanvasRenderingContext2D) => void;} {
    const data:ParticleScene = this._particileScene;
    const { pos, vel, col, fadeRate } = opts;
    let { x, y } = pos;
    const size = 4;
    const noiseForce = 1;
    const noiseScale = 0.01;

    function update(t:number): void {
      const curl = getCurl(x * noiseScale, y * noiseScale, t);
      x += vel.x;
      y += vel.y;
      x += curl.x * noiseForce;
      y += curl.y * noiseForce;
      col.alpha -= fadeRate;
      col.lightness -= fadeRate * 100;
    }

    function render(ctx:CanvasRenderingContext2D):void{
      if (col.alpha > 0.01) {
        ctx.fillStyle = `hsla(${col.hue}, ${100}%, ${col.lightness}%, ${col.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2, true);
        ctx.fill();
      }
    } 

    return {update , render}
  }

  getParticleEmitter(): {update: (t:any) => void; }{
    const data:ParticleScene = this._particileScene;  
    const particles: { update: (t:any) => void; render: (ctx: CanvasRenderingContext2D) => void; }[] = [];
    const maxParticles = 500;

    const update = (t:any) =>{
      particles.forEach( p =>{
          p.update(t);
          p.render(data.context);
      })


      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5 + 1;
      const curl = getCurl(t, 0, 0);

      const pOptions = {
        pos: { x: data.width * 0.5, y: data.height * 0.5 },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        col: { hue: 360 * curl.x, lightness: 100, alpha: 1.0 },
        fadeRate: 0.005,
      };

      const particle = this.getParticle(pOptions);
      particles.push(particle);
      while(particles.length > maxParticles){
        particles.shift();
      }
    }

    return {update}
  }

  animate(t:number):void{
    const data:ParticleScene = this._particileScene;
    const timeMult = 0.0002;
    const ctx  = data.context;
    this._animationId = requestAnimationFrame(this.animate.bind(this));

    ctx.fillStyle = `rgba(${0},${0},${0},${0.05})`;
    ctx.fillRect(0, 0, data.width, data.height);

    this.emitter.update(t * timeMult);
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