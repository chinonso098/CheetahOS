/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import {extname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from "src/app/system-files/constants";
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { Subscription } from 'rxjs';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileService } from 'src/app/shared/system-service/file.service';

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

  private _changeContentSub!: Subscription;
  private _windowResizeSub!: Subscription;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _scriptService!:ScriptService;
  private _windowService!:WindowService;
  private _audioService!:AudioService;
  private _fileService!:FileService;

  private _fileInfo!:FileInfo;
  private player: any;

  private _appState!:AppState;
  private videoSrc = Constants.EMPTY_STRING;
  private fileType = Constants.EMPTY_STRING;
  // Guards the one-time blob fallback (see handleVideoSrcError). Reset whenever a
  // new source is loaded so each opened file gets its own single retry.
  private _triedBlobFallback = false;

  recents:string[] = [];
  SECONDS_DELAY = 250;

  readonly name= 'videoplayer';
  hasWindow = true;
   isMaximizable = true;
  icon = `${Constants.IMAGE_BASE_PATH}videoplayer.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = this.name;
  showTopMenu = false;

  // Floor for honouring live resize broadcasts (matches CSS min-* on
  // .my-video-main-container). Below this we ignore the event so we don't
  // fight the user shrinking the window past the visible minimum.
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 270;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagementService: SessionManagementService, scriptService: ScriptService, windowService:WindowService, 
              audioService:AudioService, fileService:FileService) { 

    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._runningProcessService = runningProcessService;
    this._sessionManagementService= sessionManagementService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._fileService = fileService;

    this.processId = this._processIdService.getNewProcessId();
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})

    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();

    // Set displayName here (NOT in ngAfterViewInit). It is bound to
    // [processAppName]="displayName" in the template; mutating it after the
    // view has been checked triggers NG0100
    // (ExpressionChangedAfterItHasBeenCheckedError).
    const fileName = this._fileInfo?.getFileName;
    if (fileName && fileName !== Constants.EMPTY_STRING) {
      this.displayName = fileName;
    }
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

    // If the streamed direct URL fails to load (e.g. the file lives only in the
    // writable IndexedDB layer, which has no direct osdrive URL), fall back once
    // to reading the bytes as a blob — that path resolves through both FS layers.
    this.player.on('error', () => { this.handleVideoSrcError(); });
  

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();
  }

  ngOnDestroy(): void {
    if(this.player) {
      this.player.off('fullscreenchange', this.onFullscreenChange);
      this.player.dispose();
      this._audioService.removeExternalAudioSrc(this.name);
    }
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

  async changeContent():Promise<void>{
    const uId = `${this.name}-${this.processId}`;
    const audioChgDelay = 1000;

    this.videoSrc = Constants.EMPTY_STRING;
    this.fileType = Constants.EMPTY_STRING;
    this._triedBlobFallback = false;

    if(this._runningProcessService.getEventOriginator() === uId){
      this._runningProcessService.removeEventOriginator();
      //console.log('new this._fileInfo:',  this._fileInfo);
      //this._fileInfo = this._processHandlerService.getLastProcessTrigger();
      const updatedProcesss = this.getComponentDetail();
      this._runningProcessService.updateProccess(updatedProcesss);

      this.player.pause(); // Pause the video
      this.player.currentTime(0); // Reset to the start (optional)

      this.videoSrc = (this.videoSrc !== Constants.EMPTY_STRING)
      ? this.videoSrc 
      : this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);
      this.fileType = 'video/'+this._fileInfo.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING);

      const fileName = this._fileInfo?.getFileName;
      if (fileName && fileName !== Constants.EMPTY_STRING) {
        this.displayName = fileName;
      }

      await CommonFunctions.sleep(audioChgDelay); // Wait for a short delay to allow the audio service to process the change
      if(!this.player) return;

      this.player.src({ src: this.videoSrc, type: this.fileType }); // Update video source
      this.player.load(); // Load the new video
      this.player.play(); // Start playing
      
      this.storeAppState(this.videoSrc);
    }
  }

  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.videowindow, this.processId, this.name, this.icon, this._windowService);
  }

  /**
   * One-shot recovery for sources the browser can't fetch over HTTP. The common
   * case: a video the user copied into CheetahOS lives in the IndexedDB overlay,
   * so its direct `osdrive/...` URL 404s. We read the file as a blob URL (which
   * works for both the read-only osdrive layer and the writable overlay) and
   * retry playback exactly once. A blob src is already final, so it is skipped.
   */
  private async handleVideoSrcError():Promise<void>{
    if(this._triedBlobFallback) return;
    if(this.videoSrc.includes('blob:http')) return;
    if(this._fileInfo.getCurrentPath === Constants.EMPTY_STRING) return;

    this._triedBlobFallback = true;
    try{
      const blobUrl = await this._fileService.getFileAsBlobAsync(this._fileInfo.getCurrentPath);
      if(blobUrl === Constants.EMPTY_STRING || !this.player) return;

      this.videoSrc = blobUrl;
      this.player.src({ src: this.videoSrc, type: this.fileType });
      this.player.load();
      this.player.play();
      this.storeAppState(this.videoSrc);
    }catch(err){
      console.error('handleVideoSrcError: blob fallback failed for', this._fileInfo.getCurrentPath, err);
    }
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
    // pathOne = contentPath, pathTwo = currentPath.
    //
    // 1) An already-materialized blob URL (session restore, or a file that
    //    lives in the writable IndexedDB layer) is played as-is.
    if(pathOne.includes('blob:http')){
      return pathOne;
    }
    // 2) Legacy form where contentPath itself is a media path with an extension
    //    (e.g. opened via a .url shortcut whose resolved target is the clip).
    //    Anchor it to <base href> so it resolves under a sub-path deploy instead
    //    of hitting the origin root (which 404s on GitHub Pages project sites).
    if(this.checkForExt(pathOne, pathTwo)){
      return this._fileService.toAbsoluteOsdriveUrl(this._fileInfo.getContentPath);
    }
    // 3) Default (the common case): stream straight from the file's direct
    //    osdrive URL. The browser range-fetches the bytes on demand instead of
    //    us downloading the whole (potentially 25 MB+) file into memory first.
    return this._fileService.getDirectFileUrl(pathTwo);
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


