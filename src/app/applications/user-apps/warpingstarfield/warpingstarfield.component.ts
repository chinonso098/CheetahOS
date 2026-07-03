import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit, Input, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-shell/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';

import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { AppState } from 'src/app/system-files/state/state.interface';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-ui-components/window/windows.types';

declare const THREE: any; 


@Component({
  selector: 'cos-warpingstarfield',
  templateUrl: './warpingstarfield.component.html',
  styleUrl: './warpingstarfield.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class WarpingstarfieldComponent implements BaseComponent, OnDestroy, AfterViewInit, OnInit {

  @ViewChild('canvas', {static: true}) canvasRef!: ElementRef;
  @ViewChild('starfield', {static: true}) starfield!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _windowService!:WindowService;
  private _sessionManagementService!:SessionManagementService;
  private _scriptService!: ScriptService

  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _windowResizeSub!: Subscription;
  private _appState!:AppState;

  /* Floors mirror the CSS min-width/min-height so the resize handler
     ignores transient sub-min sizes during drag. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;
   
  private _renderer!: any;
  private _camera!: any
  private _scene!: any
  private _canvas!: any
  private _intervalId: any;
 
  private _animationId = 0;
  private readonly PARTICLE_SIZE = 500;
  private readonly SPREAD_RADIUS = 450;

  private stars!: any
  SECONDS_DELAY = 1000;


  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}star_field.png`;
  isMaximizable = true;
  readonly name = 'starfield';
  processId = 0;
  type = ComponentType.User;
  displayName = 'StarField';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, windowService:WindowService,
    sessionManagementService:SessionManagementService, scriptService: ScriptService){ 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._sessionManagementService = sessionManagementService;
    this._scriptService = scriptService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 

    /* Sync the THREE renderer + camera aspect to the primary window's
       drag-resize, maximize, and restore. Without these, the WebGL
       buffer stays locked at the size sampled in initScene(). */
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() => {
      this.maximizeWindow();
    });
    
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe(() => {
      this.minimizeWindow();
    });

    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
  }

  
  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  async ngAfterViewInit(): Promise<void> {

    const isModule = false;
    await this._scriptService.loadScript('three_js', 'osdrive/Cheetah/System/ThreeJS/three.min.js', isModule);
    
    this.initScene();
    this.animate();

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.updateComponentImg();
  }

  ngOnDestroy():void{
    cancelAnimationFrame(this._animationId);

    if (this._intervalId) {
      clearInterval(this._intervalId);
    }

    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    
    // Unload the Three.js script when the component is destroyed, this can cause a problem
    // if other components are using Three.js, like the VANTA background
    this._scriptService.unloadScript('three_js', 'osdrive/Cheetah/System/ThreeJS/three.min.js');
  }

  updateComponentImg():void{
    this._intervalId = setInterval(async() => {
        await this.captureComponentImg()
    }, this.SECONDS_DELAY);
  }

  async captureComponentImg(): Promise<void>{
    const htmlImg = await this.captureCanvasStill();

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

  private initScene():void {
    this._scene = new THREE.Scene();
    const starfieldWidow = document.getElementById('starfieldApp');
    this._canvas = this.canvasRef?.nativeElement;
    if (!this._canvas) {
      console.error('Canvas not found!');
      return;
    }

    if(!starfieldWidow){
      console.error('starfieldWidow not found!');
      return;
    }

    this._camera = new THREE.PerspectiveCamera(
      75,
      starfieldWidow.offsetWidth / starfieldWidow.offsetHeight,
      0.1,
      1000
    );
    this._camera.position.z = 100;

    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas, 
      antialias: true,
      alpha: true
    });

    this._renderer.setSize(starfieldWidow.offsetWidth, starfieldWidow.offsetHeight);

    const positions: any[] = [];
    const velocity: number[] = [];
    const acceleration: number[] = [];

    for (let i = 0; i < this.PARTICLE_SIZE; i++) {
      const pos = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(this.SPREAD_RADIUS),
        THREE.MathUtils.randFloatSpread(this.SPREAD_RADIUS),
        THREE.MathUtils.randFloatSpread(this.SPREAD_RADIUS)
      );
      positions.push(pos, pos.clone());
      velocity.push(0);
      acceleration.push(0.05);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(positions);
    geo.setAttribute('velocity', new THREE.Float32BufferAttribute(velocity, 1));
    geo.setAttribute('acceleration', new THREE.Float32BufferAttribute(acceleration, 1));

    const mat = new THREE.LineBasicMaterial({ color: 0xE6E6E6 });
    this.stars = new THREE.LineSegments(geo, mat);

    const group = new THREE.Group();
    group.add(this.stars);
    this._scene.add(group);
  }

  private animate = () => {
    this._animationId = requestAnimationFrame(this.animate);

    const positions = this.stars.geometry.attributes.position.array as Float32Array;
    const velocity = this.stars.geometry.attributes.velocity.array as Float32Array;
    const acceleration = this.stars.geometry.attributes.acceleration.array as Float32Array;

    let index = 0;
    for (let i = 0; i < this.PARTICLE_SIZE; i++) {
      let v = velocity[i];
      const a = acceleration[i];

      v += a;
      v = THREE.MathUtils.clamp(v, 0, 3.5);

      let x = positions[index++];
      let y = positions[index++];
      let z = positions[index++];

      let xx = positions[index++];
      let yy = positions[index++];
      let zz = positions[index++];

      if (z > 100) {
        x = xx = THREE.MathUtils.randFloatSpread(this.SPREAD_RADIUS);
        y = yy = THREE.MathUtils.randFloatSpread(this.SPREAD_RADIUS);
        z = zz = -100;
        positions[index - 3] = x;
        positions[index - 2] = y;
        positions[index - 6] = xx;
        positions[index - 5] = yy;
      }

      z += v;
      zz += v * 1.5;

      velocity[i] = v;
      positions[index - 1] = zz;
      positions[index - 4] = z;
    }

    this.stars.geometry.attributes.position.needsUpdate = true;
    this.stars.geometry.attributes.velocity.needsUpdate = true;

    this._renderer.render(this._scene, this._camera);
  };

  /**
   * Re-fit the THREE renderer and camera to the (now reflowed) host
   * container. Reads the live offsetWidth/Height of #starfieldApp and
   * updates both the WebGL drawing buffer and the camera aspect.
   * No-op until initScene() has finished.
   */
  onWindowResize():void {
    if(!this._renderer || !this._camera) return;
    const host = document.getElementById('starfieldApp');
    if(!host) return;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    if(w <= 0 || h <= 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    // updateStyle must stay true (the default): initScene() sets inline
    // canvas style.width/height, so we have to rewrite them here or the
    // canvas stays pinned to its initial CSS size even though the WebGL
    // buffer changes. Letting setSize own canvas.width/height also keeps
    // the devicePixelRatio scaling correct.
    this._renderer.setSize(w, h);
  }

    /**
   * Keep canvas glued to the host while the maximize/restore CSS
   * animation plays. The host (starfieldApp) is interpolated continuously by the
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

  maximizeWindow():void {
    /* The maximize animation reflows the host on the next frame. */
    this.refitCanvasDuringAnimation(Constants.MAXIMIZE_RESTORE_ANIM_MS);
  }

  minimizeWindow():void {
    this.refitCanvasDuringAnimation(Constants.MAXIMIZE_RESTORE_ANIM_MS);
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the Task Manager (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  async captureCanvasStill(): Promise<string> {
    const canvas = this._canvas;
    if (!canvas) return Constants.EMPTY_STRING;

     const opts = {
      pixelRatio: 0.5,
      quality: 0.85,
      // NOTE: do NOT enable cacheBust. html-to-image appends `?<timestamp>`
      // to every resource URL, which is invalid for blob: URLs (e.g.
      // photoviewer images created via URL.createObjectURL) and causes
      // ERR_FILE_NOT_FOUND -> "Failed to fetch" inside dataurl.js.
      cacheBust: false,
    };

    const bkgrndImgData = await htmlToImage.toJpeg(this.starfield.nativeElement, opts);

    // Get video stream from canvas
    const stream = canvas.captureStream();
    const track = stream.getVideoTracks()[0];

    // Use ImageCapture (with TS override)
    const imageCapture = new (window as any).ImageCapture(track);
    const bitmap: ImageBitmap = await imageCapture.grabFrame();

    // Draw bitmap onto an offscreen canvas
    const tmp = document.createElement("canvas");
    tmp.width = bitmap.width;
    tmp.height = bitmap.height;
    const ctx = tmp.getContext("2d")!;

    // Draw UI image
    const bkGrndImg = new Image();
    bkGrndImg.src = bkgrndImgData;
    await new Promise(resolve => (bkGrndImg.onload = resolve));
    ctx.drawImage(bkGrndImg, 0, 0);
    ctx.drawImage(bitmap, 0, 0);

    return tmp.toDataURL("image/jpeg");
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
