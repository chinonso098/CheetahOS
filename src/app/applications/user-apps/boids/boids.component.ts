import { Component, ElementRef, OnDestroy, OnInit, AfterViewInit, ViewChild, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { WindowService } from 'src/app/shared/system-service/window.service';

import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';
import { Boid } from './boid';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { TaskBarPreviewImage } from 'src/app/system-shell/taskbarpreview/taskbar.preview';
import { WindowResizeInfo } from 'src/app/shared/system-ui-components/window/windows.types';

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
  
  private _windowService!:WindowService;
  private _scriptService!:ScriptService;
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _sessionManagementService!:SessionManagementService;

  private SECONDS_DELAY = 1000;
  private _appState!:AppState;
  private p5Instance: any;
  private _intervalId: any;
  private _windowResizeSub!: Subscription;
  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;

  /* Floors mirror the CSS min-width/min-height; below these we skip the
     canvas resize to avoid degenerate p5 buffers. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  flocks: Boid[] = [];

  params = {
    align: 1.2,
    cohesion: 1.5,
    separation: 1.8
  };

  form!:FormGroup;
  sliders = ['align', 'cohesion', 'separation'];

  readonly name= 'boids';
  hasWindow = true;
  isMaximizable=true;
  icon = `${Constants.IMAGE_BASE_PATH}bird_oid.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Boids';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService,  scriptService: ScriptService, 
              windowService:WindowService, private fb: FormBuilder, sessionManagementService:SessionManagementService) { 
                
    this._processIdService = processIdService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._sessionManagementService = sessionManagementService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());

    /* p5's built-in p.windowResized only fires on browser window
       resize, not on our in-OS primary-window drag-resize. Listen to
       the primary window broadcast and re-size the canvas to match
       the host container. */
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });

    /* Maximize and minimize fire as global notifications, so we gate
       them by checking that we are the originating process before
       refitting the canvas. */
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() => {
      this.maximizeWindow();
    });
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe(() => {
      this.minimizeWindow();
    });
  }

  async ngOnInit(): Promise<void> {
    this.form = this.fb.group({
      align: [1.2],
      cohesion: [1.5],
      separation: [1.4]
    });

    await this._scriptService.loadScript("P5JS","osdrive/Cheetah/System/P5JS/p5.min.js");
    console.log('p5 loaded');

    this.retrievePastSessionData();
  }

  ngAfterViewInit():void{
    const delay = 500; //500ms
    setTimeout(() => {
      this.p5Instance = new p5(this.sketch.bind(this), this.boidCanvas.nativeElement);
    }, delay);

    this.updateComponentImg();
  }

  ngOnDestroy(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }

    if (this._intervalId) {
      clearInterval(this._intervalId);
    }

    this._windowResizeSub?.unsubscribe();
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();

    this._scriptService.unloadScript("P5JS","osdrive/Cheetah/System/P5JS/p5.min.js");
  }

  /**
   * Re-fit the p5 canvas to the (now reflowed) host container. Reads
   * the container's live offset size and asks p5 to resize the backing
   * canvas. No-op until p5 has finished its initial setup.
   */
  onWindowResize():void {
    if(!this.p5Instance) return;
    const boidCntnr = document.getElementById('boidCntnr');
    if(!boidCntnr) return;
    this.p5Instance.resizeCanvas(boidCntnr.offsetWidth, boidCntnr.offsetHeight);
  }

  /**
   * Keep the p5 canvas glued to the host while the maximize/restore CSS
   * animation plays. The host (boidCntnr) is interpolated continuously by the
   * `maximizeRestoreAnimation` transition, so instead of waiting for it to
   * finish and snapping once, we refit every animation frame for the full
   * duration. Each frame reads the host's interpolated offsetWidth/Height, so
   * the canvas grows/shrinks smoothly in lock-step. A trailing refit
   * guarantees we land exactly on the final size.
   */
  private refitCanvasDuringAnimation(durationMs:number):void{
    const start = performance.now();
    const step = () => {
      this.onWindowResize();
      if(performance.now() - start < durationMs){
        requestAnimationFrame(step);
      } else {
        this.onWindowResize(); // final settle on the exact end size
      }
    };
    requestAnimationFrame(step);
  }

  /**
   * Maximize broadcasts have no pId, so gate on event originator, then refit
   * the canvas every frame across the ~0.50s maximize animation for a fluid
   * grow rather than a single post-animation snap.
   */
  maximizeWindow():void {
    this.refitCanvasDuringAnimation(Constants.MAXIMIZE_RESTORE_ANIM_MS);
  }

  /**
   * Restore-from-maximized. Same originator gate; refit every frame while the
   * window shrinks back so the canvas tracks the shrink instead of snapping.
   */
  minimizeWindow():void {
    this.refitCanvasDuringAnimation(Constants.MAXIMIZE_RESTORE_ANIM_MS);
  }

  captureComponentImg():void{
    const htmlImg =  this.captureCanvasStill();

    const cmpntImg:TaskBarPreviewImage = {
      pId: this.processId,
      appName: this.name,
      displayName: this.name,
      icon : this.icon,
      defaultIcon: this.icon,
      imageData: htmlImg
    }
    
    this._windowService.addProcessPreviewImage(this.name, cmpntImg);
  }

  sketch(p: any) {
    const numOfBoids = 120;
    const boidCntnr = document.getElementById('boidCntnr');
    p.setup = () => {
      p.createCanvas(boidCntnr?.offsetWidth, boidCntnr?.offsetHeight);

      for (let i = 0; i < numOfBoids; i++) {
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

  public captureCanvasStill(): string  {
    const canvasElemnt = document.getElementById("defaultCanvas0") as HTMLCanvasElement;
    if (!canvasElemnt) return Constants.EMPTY_STRING;

    return canvasElemnt.toDataURL("image/jpeg", 0.5);
  }

  updateComponentImg():void{
    this._intervalId = setInterval(() => {
        this.captureComponentImg()
    }, this.SECONDS_DELAY);
  }


  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }
  
  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data as string,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }
  
  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      //
    }
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}


