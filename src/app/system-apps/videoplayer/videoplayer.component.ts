/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import {extname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { Constants } from "src/app/system-files/constants";
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { Subscription } from 'rxjs';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { CommonFunctions } from 'src/app/system-files/common.functions';

declare const videojs: (arg0: any, arg1: object, arg2: () => void) => any;

@Component({
  selector: 'cos-videoplayer',
  templateUrl: './videoplayer.component.html',
  styleUrls: ['./videoplayer.component.css'],
  standalone:false,
})
export class VideoPlayerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit  {

  @ViewChild('videowindow', {static: true}) videowindow!: ElementRef;
  @ViewChild('mainVideoCntnr', {static: true}) mainVideoCntnr!: ElementRef;
  @ViewChild('videoCntnr', {static: true}) videoCntnr!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;

  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _changeContentSub!: Subscription;
  private _windowResizeSub!: Subscription;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _scriptService!:ScriptService;
  private _windowService!:WindowService;
  private _audioService!:AudioService;

  private _fileInfo!:FileInfo;
  private player: any;

  private _appState!:AppState;
  private videoSrc = Constants.EMPTY_STRING;
  private fileType = Constants.EMPTY_STRING;

  recents:string[] = [];
  SECONDS_DELAY = 250;

  name= 'videoplayer';
  hasWindow = true;
   isMaximizable = true;
  icon = `${Constants.IMAGE_BASE_PATH}videoplayer.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Video-js';
  showTopMenu = false;

  // Floor for honouring live resize broadcasts (matches CSS min-* on
  // .my-video-main-container). Below this we ignore the event so we don't
  // fight the user shrinking the window past the visible minimum.
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 270;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagementService: SessionManagementService, scriptService: ScriptService, windowService:WindowService, 
              audioService:AudioService) { 

    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._runningProcessService = runningProcessService;
    this._sessionManagementService= sessionManagementService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minmizeWindow(p)})
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})

    // Live reflow during drag-resize of the primary window. We don't need
    // imperative sizing here — the CSS makes .my-video-container fluid and
    // video.js (fluid:true) follows. We just clear any leftover inline
    // px sizes that maximize/minimize may have written, then let CSS rule.
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
        this.onWindowResize();
    });

    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  showMenu(): void{
    this.showTopMenu = true;
    console.log('show menu')
  }

  openFileExplorer(): void{
    this.showTopMenu = false;
  }

  playPrevious():void{
    this.showTopMenu = false;
  }

  async ngAfterViewInit(): Promise<void> {
    //this.setVideoWindowToFocus(this.processId);
    
    this.fileType =  (this.fileType !== Constants.EMPTY_STRING) ? 
      this.fileType : 'video/' + this._fileInfo.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING);

    this.videoSrc = (this.videoSrc !== Constants.EMPTY_STRING) ? 
      this.videoSrc : this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    const videoOptions = {
        // fill (not fluid): the .video-js box matches the parent container's
        // width AND height. fluid forces a 16:9 padding-top trick which
        // pushed the absolutely-positioned control bar below the visible
        // frame whenever the window aspect ratio differed from 16:9.
        fill : true,
        responsive: true,
        autoplay: true, 
        controls:true,
        controlBar: {
          fullscreenToggle: false,
          skipButtons: {
            backward: 10,
            forward: 10
          }
        },
        sources: [{ src:this.videoSrc, type: this.fileType }] 
      }
  
    const appData:string[] = [this.fileType, this.videoSrc];
    this.storeAppState(appData);

    await this._scriptService.loadStyle("videojs-css","osdrive/Program-Files/Videojs/video-js.min.css");
    await this._scriptService.loadScript("videojs","osdrive/Program-Files/Videojs/video.min.js", false);

    this.player = videojs(this.videowindow.nativeElement, videoOptions, ()=>{
      console.log('onPlayerReady:', "player is read");
      //this.player.on('fullscreenchange', this.onFullscreenChange);
      this._audioService.addExternalAudioSrc(this.name, this.player)
    });
  

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();
  }

  ngOnDestroy(): void {
    if(this.player) {
      this.player.off('fullscreenchange', this.onFullscreenChange);
      this.player.dispose();
      this._audioService.removeExternalAudioSrc(this.name);
    }
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._changeContentSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    

    // for multiple instances of video player, we dont want to unload the script until the last instance is closed
    if(this._runningProcessService.getProcessCount(this.name) <= 1){
      this._scriptService.unloadScript("videojs", "osdrive/Program-Files/Videojs/video.min.js");
      this._scriptService.unloadStyle("videojs-css", "osdrive/Program-Files/Videojs/video-js.min.css");

      // video.min.js attaches itself to window.videojs — clear it so the
      // global is GC'd and a fresh copy is fetched next time.
      delete (window as any).videojs;
    }
  }

  changeContent():void{
    const uId = `${this.name}-${this.processId}`;
    const delay = 1000;

    this.videoSrc = Constants.EMPTY_STRING;
    this.fileType = Constants.EMPTY_STRING;

    if(this._runningProcessService.getEventOriginator() === uId){
      //console.log('new this._fileInfo:',  this._fileInfo);
      //this._fileInfo = this._processHandlerService.getLastProcessTrigger();
      const updatedProcesss = this.getComponentDetail();
      this._runningProcessService.updateProccess(updatedProcesss);

      this.player.pause(); // Pause the video
      this.player.currentTime(0); // Reset to the start (optional)

      this.videoSrc = (this.videoSrc !== Constants.EMPTY_STRING)? 
      this.videoSrc :this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);
      this.fileType = 'video/'+this._fileInfo.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING);

      setTimeout(async()=> {
        if(this.player) {
          this.player.src({ src: this.videoSrc, type: this.fileType }); // Update video source
          this.player.load(); // Load the new video
          this.player.play(); // Start playing
        }
        this.storeAppState(this.videoSrc);
      }, delay);

      this._runningProcessService.removeEventOriginator();
    }
  }

  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.videowindow, this.processId, this.name, this.icon, this._windowService);
  }

  /** Drag-resize: drop the inline pixel sizes that maximize/minimize may
   *  have written so CSS flex can take over. With fill:true the player
   *  automatically tracks the parent container; no API call needed. */
  private onWindowResize():void{
    try{
      if(this.videoCntnr?.nativeElement?.style){
        this.videoCntnr.nativeElement.style.width = '';
        this.videoCntnr.nativeElement.style.height = '';
      }
      if(this.videowindow?.nativeElement?.style){
        this.videowindow.nativeElement.style.width = '';
        this.videowindow.nativeElement.style.height = '';
      }
    }catch{ /* player not ready yet — CSS still reflows correctly */ }
  }

  onFullscreenChange = () => {
    const isFullscreen = this.player.isFullscreen();
    console.log('Fullscreen changed:', isFullscreen);

    // Exit fullscreen mode immediately if it tries to enter
    if (isFullscreen) {
      this.player.exitFullscreen();
    }
    // Handle fullscreen change logic here
  }

  addToRecentsList(videoPath:string):void{
    if(!this.recents.includes(videoPath))
      this.recents.push(videoPath);
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  getVideoSrc(pathOne:string, pathTwo:string):string{
    let videoSrc = Constants.EMPTY_STRING;

    if(pathOne.includes('blob:http')){
      return pathOne;
    }else if(this.checkForExt(pathOne,pathTwo)){
      videoSrc = Constants.ROOT + this._fileInfo.getContentPath;
    }else{
      videoSrc =  this._fileInfo.getCurrentPath;
    }
    return videoSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = false;

    if(Constants.VIDEO_FILE_EXTENSIONS.includes(contentExt)){
      res = true;
    }else if(Constants.VIDEO_FILE_EXTENSIONS.includes(currentPathExt)){
      res = false;
    }
    return res;
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData != Constants.EMPTY_STRING){
        const videoData =  appSessionData.appData as string[];
        this.fileType = videoData[0];
        this.videoSrc = videoData[1];
    }
  }

  maximizeWindow():void{
    // Bring maximize in line with the responsive layout: the CSS flex chain
    // (.my-video-main-container -> .my-video-container) fills whatever the
    // primary window gives us, and video.js (fluid/fill) follows. So we no
    // longer compute and stamp explicit pixel sizes off #vantaCntnr (which
    // double-counted chrome and fought the flex parent). Just clear any
    // stale inline px and let CSS reflow.
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
  }

  minmizeWindow(arg:number[]):void{
    // Restore from maximized. Same reasoning as maximizeWindow — the
    // window component owns the box size; we only strip leftover inline px
    // so the CSS flex chain + video.js can reflow to the restored size.
    // (arg carries the restored [width,height] but is no longer needed
    //  imperatively; kept for the subscription signature.)
    void arg;
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
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

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

}


