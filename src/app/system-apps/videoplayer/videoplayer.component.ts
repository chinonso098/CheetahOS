import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import {extname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { Constants } from "src/app/system-files/constants";
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Subscription } from 'rxjs';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
declare const videojs: (arg0: any, arg1: object, arg2: () => void) => any;


@Component({
  selector: 'cos-videoplayer',
  templateUrl: './videoplayer.component.html',
  styleUrls: ['./videoplayer.component.css']
})
export class VideoPlayerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit  {

  @ViewChild('videowindow', {static: true}) videowindow!: ElementRef;
  @ViewChild('mainVideoCntnr', {static: true}) mainVideoCntnr!: ElementRef;
  @ViewChild('videoCntnr', {static: true}) videoCntnr!: ElementRef;

  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;

  private _fileInfo!:FileInfo;
  private player: any;
  private _consts:Constants = new Constants();
  private _appState!:AppState;
  private videoSrc = '';
  private fileType = '';

  recents:string[] = [];
  SECONDS_DELAY = 250;

  name= 'videoplayer';
  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}videoplayer.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Video-js';
  showTopMenu = false;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
    stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService, scriptService: ScriptService) { 
    this._processIdService = processIdService;
    this._triggerProcessService = triggerProcessService;
    this._stateManagmentService = stateManagmentService;
    this._runningProcessService = runningProcessService;
    this._sessionManagmentService= sessionManagmentService;
    this._scriptService = scriptService;
    this.processId = this._processIdService.getNewProcessId();

  
    this.retrievePastSessionData();

    this._maximizeWindowSub = this._runningProcessService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._runningProcessService.minimizeProcessWindowNotify.subscribe((p) =>{this.minmizeWindow(p)})
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();
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

    this.setVideoWindowToFocus(this.processId); 
    this.fileType =  (this.fileType !=='') ? 
      this.fileType : 'video/' + this._fileInfo.getFileType.replace('.','');

    this.videoSrc = (this.videoSrc !=='') ? 
      this.videoSrc : this.getVideoSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

   

    const options = {
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
      this.player = videojs(this.videowindow.nativeElement, options, function onPlayerReady(){
        console.log('onPlayerReady:', "player is read");
      });
  
      //this.player.on('fullscreenchange', this.onFullscreenChange);
    })

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  ngOnDestroy(): void {
    if (this.player) {
      this.player.off('fullscreenchange', this.onFullscreenChange);
      this.player.dispose();
    }
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.videowindow.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
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
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  getVideoSrc(pathOne:string, pathTwo:string):string{
    let videoSrc = '';

    if(pathOne.includes('blob:http')){
      return pathOne;
    }else if(this.checkForExt(pathOne,pathTwo)){
      videoSrc = '/' + this._fileInfo.getContentPath;
    }else{
      videoSrc =  this._fileInfo.getCurrentPath;
    }
    return videoSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = false;

    if(this._consts.VIDEO_FILE_EXTENSIONS.includes(contentExt)){
      res = true;
    }else if(this._consts.VIDEO_FILE_EXTENSIONS.includes(currentPathExt)){
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
      unique_id: uid
    }
    this._stateManagmentService.addState(uid, this._appState, StateType.App);
  }

  retrievePastSessionData():void{
    const pickUpKey = this._sessionManagmentService._pickUpKey;
    if(this._sessionManagmentService.hasTempSession(pickUpKey)){
      const tmpSessKey = this._sessionManagmentService.getTempSession(pickUpKey) || ''; 
      const retrievedSessionData = this._sessionManagmentService.getSession(tmpSessKey) as BaseState[];

      if(retrievedSessionData !== undefined){
        const appSessionData = retrievedSessionData[0] as AppState;

        if(appSessionData !== undefined  && appSessionData.app_data != ''){
          const videoData =  appSessionData.app_data as string[];
          this.fileType = videoData[0];
          this.videoSrc = videoData[1];
        }
      }
    }
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');

      //window title and button bar, and windows taskbar height, video top menu bar
      const pixelTosubtract = 30 + 40;
      this.videoCntnr.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      this.videoCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
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
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
  }

}


