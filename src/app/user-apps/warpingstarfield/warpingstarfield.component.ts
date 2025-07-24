import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit, Input, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { AppState } from 'src/app/system-files/state/state.interface';

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
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _windowService:WindowService;
  private _sessionManagmentService:SessionManagmentService;

  private _maximizeWindowSub!: Subscription;

  private _appState!:AppState;
   
  private renderer!: any;
  private camera!: any
  private scene!: any
 
  private animationId = 0;
  private PARTICLE_SIZE = 500;
  private SPREAD_RADIUS = 450;

  private stars!: any
  SECONDS_DELAY = 250;


  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}star_field.png`;
  isMaximizable = false;
  name = 'starfield';
  processId = 0;
  type = ComponentType.User;
  displayName = 'StarField';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, windowService:WindowService,
    sessionManagmentService:SessionManagmentService){ 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    //this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
  }

  
  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  ngAfterViewInit(): void {
    this.initScene();
    this.animate();
    //window.addEventListener('resize', this.onResize);
    //this.setTitleWindowToFocus(this.processId); 

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  ngOnDestroy():void{
    cancelAnimationFrame(this.animationId);
    //window.removeEventListener('resize', this.onResize);
    this._maximizeWindowSub?.unsubscribe();
  }

    captureComponentImg():void{
      htmlToImage.toPng(this.starfield.nativeElement).then(htmlImg =>{
  
        const cmpntImg:TaskBarPreviewImage = {
          pid: this.processId,
          appName: this.name,
          displayName: this.name,
          icon : this.icon,
          defaultIcon: this.icon,
          imageData: htmlImg
        }
        this._windowService.addProcessPreviewImage(this.name, cmpntImg);
      })
    }

  private initScene():void {
    this.scene = new THREE.Scene();
    const starfieldWidow = document.getElementById('starfieldApp');
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      console.error('Canvas not found!');
      return;
    }

    if(!starfieldWidow){
      console.error('starfieldWidow not found!');
      return;
    }

    this.camera = new THREE.PerspectiveCamera(
      75,
      starfieldWidow.offsetWidth / starfieldWidow.offsetHeight,
      0.1,
      1000
    );
    this.camera.position.z = 100;

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, 
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(starfieldWidow.offsetWidth, starfieldWidow.offsetHeight);

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
    this.scene.add(group);
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

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

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  setWarpWindowToFocus(pid:number):void{
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
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
