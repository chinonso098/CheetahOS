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
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Subscription } from 'rxjs';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';

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
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _windowService:WindowService;
  private _audioService:AudioService;

  private _fileInfo!:FileInfo;
  private player: any;

  private _appState!:AppState;
  private videoSrc = Constants.EMPTY_STRING;
  private fileType = Constants.EMPTY_STRING;

  recents:string[] = [];
  SECONDS_DELAY = 250;

  name= 'videoplayer';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}videoplayer.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Video-js';
  showTopMenu = false;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService, windowService:WindowService, 
              audioService:AudioService) { 

    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._runningProcessService = runningProcessService;
    this._sessionManagmentService= sessionManagmentService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minmizeWindow(p)})
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
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
    
    this.fileType =  (this.fileType !=='') ? 
      this.fileType : 'video/' + this._fileInfo.getFileType.replace('.','');

    this.videoSrc = (this.videoSrc !=='') ? 
      this.videoSrc : this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    const videoOptions = {
        fluid: true,
        responsive: true,
        autoplay: true, 
        controls:true,
        aspectRatio: '16:9',
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

    this._scriptService.loadScript("videojs","osdrive/Program-Files/Videojs/video.min.js").then(() =>{
      this.player = videojs(this.videowindow.nativeElement, videoOptions, ()=>{
        console.log('onPlayerReady:', "player is read");
        this._audioService.addExternalAudioSrc(this.name, this.player)
      });
  
      //this.player.on('fullscreenchange', this.onFullscreenChange);
    })

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
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
  }

  changeContent():void{
    const uid = `${this.name}-${this.processId}`;
    const delay = 1000;

    this.videoSrc = Constants.EMPTY_STRING;
    this.fileType = Constants.EMPTY_STRING;

    if(this._runningProcessService.getEventOrginator() === uid){
      this._fileInfo = this._processHandlerService.getLastProcessTrigger();
      //console.log('new this._fileInfo:',  this._fileInfo);

      this.player.pause(); // Pause the video
      this.player.currentTime(0); // Reset to the start (optional)

      this.videoSrc = (this.videoSrc !== '')? 
      this.videoSrc :this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);
      this.fileType = 'video/'+this._fileInfo.getFileType.replace('.','');

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


  captureComponentImg():void{
    htmlToImage.toPng(this.videowindow.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

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

  setVideoWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
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
    const uid = `${this.name}-${this.processId}`;
    this._appState = {
      pid: this.processId,
      app_data: app_data,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data != Constants.EMPTY_STRING){
        const videoData =  appSessionData.app_data as string[];
        this.fileType = videoData[0];
        this.videoSrc = videoData[1];
    }
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta'); //1920 x 1080

      //window title and button bar, and windows taskbar height, video top menu bar
      const pixelTosubtract = 30 + 40;
      this.videoCntnr.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      this.videoCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;

      // this.mainVideoCntnr.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      // this.mainVideoCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;

      // Resize video element
      this.videowindow.nativeElement.style.width = '100%';
      this.videowindow.nativeElement.style.height = '100%';
      // this.videowindow.nativeElement.style.width = `1920px`;
      // this.videowindow.nativeElement.style.height= `1080px`;

      this._runningProcessService.removeEventOriginator();
    }
  }

  minmizeWindow(arg:number[]):void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      this.videoCntnr.nativeElement.style.width = `${arg[0]}px`;
      this.videoCntnr.nativeElement.style.height = `${arg[1]}px`;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}


