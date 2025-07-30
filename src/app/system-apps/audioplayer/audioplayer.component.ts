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

// eslint-disable-next-line no-var
declare const Howl:any;
declare const SiriWave:any;


@Component({
  selector: 'cos-audioplayer',
  templateUrl: './audioplayer.component.html',
  styleUrls: ['./audioplayer.component.css'],
  standalone:false,
})
export class AudioPlayerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit  {

  @ViewChild('waveForm', {static: true}) waveForm!: ElementRef;
  @ViewChild('audioContainer', {static: true}) audioContainer!: ElementRef; 
  @ViewChild('playBtn', {static: true}) playBtn!: ElementRef;
  @ViewChild('pauseBtn', {static: true}) pauseBtn!: ElementRef;
  @ViewChild('prevBtn', {static: true}) prevBtn!: ElementRef;
  @ViewChild('nextBtn', {static: true}) nextBtn!: ElementRef;
  @ViewChild('playlistBtn', {static: true}) playlistBtn!: ElementRef;
  @ViewChild('progress', {static: true}) progress!: ElementRef;
  @ViewChild('bar', {static: true}) bar!: ElementRef;
  @ViewChild('loading', {static: true}) loading!: ElementRef;

  @ViewChild('volumeBtn', {static: true}) volumeBtn!: ElementRef;
  @ViewChild('volumeSlider', {static: true}) volumeSlider!: ElementRef;
  @ViewChild('barFull', {static: true}) barFull!: ElementRef;
  @ViewChild('barEmpty', {static: true}) barEmpty!: ElementRef;
  @ViewChild('sliderBtn', {static: true}) sliderBtn!: ElementRef;

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
  private _appState!:AppState;

  SECONDS_DELAY = 250;
  private audioSrc = Constants.EMPTY_STRING;
  private audioPlayer: any;
  private siriWave: any;
  private isSliderDown = false;

  playList:string[] = [];
  recents:string[] = [];

  name= 'audioplayer';
  hasWindow = true;
  isMaximizable=false;
  icon = `${Constants.IMAGE_BASE_PATH}audioplayer.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Howlerjs';
  showTopMenu = false;

  track = 'N/A';
  timer ='0:00';
  duration = '0:00' ;

 
  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService, 
    windowService:WindowService, audioService:AudioService) { 
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService= sessionManagmentService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();

    this._runningProcessService = runningProcessService;
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
  }

  ngAfterViewInit():void{  

    //this.setAudioWindowToFocus(this.processId); 
    this.audioSrc = (this.audioSrc !== Constants.EMPTY_STRING)? 
      this.audioSrc :this.getAudioSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

      this._scriptService.loadScript("howler","osdrive/Program-Files/Howler/howler.min.js").then(()=>{

        this._scriptService.loadScript("siriwave","osdrive/Program-Files/Howler/siriwave.umd.min.js").then(()=>{

          this.siriWave = new SiriWave({
            container: this.waveForm.nativeElement,
            width: 900,
            height: 480,
            autostart: false,
            cover: true,
            speed: 0.03,
            amplitude: 0.7,
            frequency: 2
          });
  
          if(this.playList.length == 0){
            this.loadHowlSingleTrackObjectAsync()
                .then(howl => { this.audioPlayer = howl; 
                  this._audioService.addExternalAudioSrc(this.name, howl);
                })
                .catch(error => { console.error('Error loading track:', error); });
      
            this.storeAppState(this.audioSrc);
          }
        });
      });

      setTimeout(()=>{
        this.captureComponentImg();
      },this.SECONDS_DELAY) 
  

    // when i implement the playlist feature
    // if((this.audioSrc !== '/' && this.playList.length >= 1) || (this.audioSrc  === '/' && this.playList.length >= 1)){
    //   1
    // }
  }

  ngOnDestroy():void{
    this.audioPlayer?.unload();
    this._audioService.removeExternalAudioSrc(this.name);
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe(); 
    this._changeContentSub?.unsubscribe(); 
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.audioContainer.nativeElement).then(htmlImg =>{

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

  changeContent():void{
    const uid = `${this.name}-${this.processId}`;
    const delay = 1000;

    console.log('previous audio source:',  this.audioSrc);
    this.audioSrc = Constants.EMPTY_STRING;
    console.log('previous audio source-1:',  this.audioSrc);
    if(this._runningProcessService.getEventOrginator() === uid){
      this._fileInfo = this._processHandlerService.getLastProcessTrigger();

      this.audioSrc = (this.audioSrc !== Constants.EMPTY_STRING)? 
      this.audioSrc :this.getAudioSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

      this.siriWave.stop();
      this.audioPlayer.stop();

      // got purge the old howl instance :()
      this.audioPlayer?.unload();
      this._audioService.removeExternalAudioSrc(this.name);

      console.log('new audio source:',  this.audioSrc);

      setTimeout(async()=> {
        this.loadHowlSingleTrackObjectAsync()
          .then(howl => { this.audioPlayer = howl; 
            this._audioService.addExternalAudioSrc(this.name, howl);
            this.onPlayBtnClicked();
          })
          .catch(error => { console.error('Error loading track:', error); });

        this.storeAppState(this.audioSrc);
      }, delay);

      this._runningProcessService.removeEventOriginator();
    }
  }

  showMenu(): void{
    this.showTopMenu = true;
  }

  openFileExplorer(): void{
    this.showTopMenu = false;
  }

  playPrevious():void{
    this.showTopMenu = false;
  }

  onPlayBtnClicked():void{
    this.bar.nativeElement.style.display = 'none';
    this.waveForm.nativeElement.style.display = 'block';
    this.pauseBtn.nativeElement.style.display = 'block';
    this.playBtn.nativeElement.style.display = 'none';

    this.siriWave.start();
    this.audioPlayer.play();

    // Start updating the progress of the track.
    requestAnimationFrame(this.updatePlayBackPosition.bind(this));
  }

  onPauseBtnClicked():void{

    this.bar.nativeElement.style.display = 'block';
    this.waveForm.nativeElement.style.display = 'none';
    this.pauseBtn.nativeElement.style.display = 'none';
    this.playBtn.nativeElement.style.display = 'block';

    this.siriWave.stop();
    this.audioPlayer.pause();
  }

  onPrevBtnClicked():void{
    if(this.playList.length > 0)
      this.audioPlayer.play();
  }

  onRewind():void{
    const secs = 10
    let timeToSeek = this.audioPlayer.seek() - secs;
    timeToSeek = timeToSeek <= 0 ? 0 : timeToSeek;
    this.audioPlayer.seek(timeToSeek);
  }

  onNextBtnClicked():void{
    if(this.playList.length > 0)
      this.audioPlayer.play();
  }

  onFastForward():void{
    const secs = 10
    const timeToSeek = this.audioPlayer.seek() + secs;

    if ( timeToSeek >= this.audioPlayer.duration()) {
      this.audioPlayer.stop();
    } else {
      this.audioPlayer.seek(timeToSeek);
    }
  }

  onWaveFormClicked(evt:MouseEvent):void{
    const rect =  this.audioContainer.nativeElement.getBoundingClientRect();
    const boundedClinetX = evt.clientX - rect.left;

    const innerWidth = this.waveForm.nativeElement.offsetWidth;
    this.onSeek(boundedClinetX/ innerWidth);
  }

  onVolumeBtnClicked():void{
    const display = (this.volumeSlider.nativeElement.style.display === 'block') ? 'none' : 'block';
    setTimeout(()=> {
      this.volumeSlider.nativeElement.style.display = display;
    }, (display === 'block') ? 0 : 500);
    this.volumeSlider.nativeElement.className = (display === 'block') ? 'fadein' : 'fadeout';
  }

  onVolumeSliderBtnClicked():void{
    const display = (this.volumeSlider.nativeElement.style.display === 'block') ? 'none' : 'block';
    setTimeout(()=> {
      this.volumeSlider.nativeElement.style.display = display;
    }, (display === 'block') ? 0 : 500);
    this.volumeSlider.nativeElement.className = (display === 'block') ? 'fadein' : 'fadeout';
  }

  changeVolume(val:number):void{
    const rect =  this.audioContainer.nativeElement.getBoundingClientRect();
    this.audioPlayer.volume(val);
    const barWidth = (val * 90) / 100;
    this.barFull.nativeElement.style.width = (barWidth * 100) + '%';
    this.sliderBtn.nativeElement.style.left = (rect.width * barWidth + rect.width * 0.05 - 25) + 'px';
  }

  onBarEmptyClick(evt:MouseEvent):void{
    const scrollWidth = this.barEmpty.nativeElement.scrollWidth;
    const per = evt.offsetX / parseFloat(scrollWidth);
    this.changeVolume(per);
  }

  onMousDownSliderBtn():void{
    this.isSliderDown = true;
  }

  onVolumeMouseUp():void{
    this.isSliderDown = false;
  }

  onVolumeMouseMove(evt:MouseEvent):void{
    if(this.isSliderDown){
      const rect =  this.audioContainer.nativeElement.getBoundingClientRect();
      const boundedClinetX = evt.clientX - rect.left;

      const x = boundedClinetX;
      const startX = parseInt(rect.width) * 0.05;
      const layerX = x - startX;
      const per = Math.min(1, Math.max(0, layerX / parseFloat(this.barEmpty.nativeElement.scrollWidth)));
      this.changeVolume(per);
    }
  }

  formatTime(seconds:number):string{
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds - (mins * 60)) || 0;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  addToRecentsList(audioPath:string):void{
    if(!this.recents.includes(audioPath))
        this.recents.push(audioPath);
  }

  setAudioWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  resizeSiriWave():void{
    const rect =  this.audioContainer.nativeElement.getBoundingClientRect();
    const height = rect.height * 0.3;
    const width = rect.width;
    this.siriWave.height = height;
    this.siriWave.height_2 = height / 2;
    this.siriWave.MAX = this.siriWave.height_2 - 4;
    this.siriWave.width = width;
    this.siriWave.width_2 = width / 2;
    this.siriWave.width_4 = width / 4;
    this.siriWave.canvas.height = height;
    this.siriWave.canvas.width = width;
    this.siriWave.container.style.margin = -(height / 2) + 'px auto';

    if(this.audioPlayer){
      const volume = this.audioPlayer.volume();
      const barWidth = (volume * 0.9);
      this.sliderBtn.nativeElement.style.left = (rect.width * barWidth + rect.width * 0.05 - 25) + 'px';
    }
  }

  updatePlayBackPosition():void{
    const seek = this.audioPlayer.seek() || 0;
    this.timer = this.formatTime(Math.round(seek));
    this.progress.nativeElement.style.width =  (((seek / this.audioPlayer.duration()) * 100) || 0) + '%';

    if(this.audioPlayer.playing()){
      requestAnimationFrame(this.updatePlayBackPosition.bind(this));
    }
  }

  onSeek(per:number):void{
    // Convert the percent into a seek position.
    if (this.audioPlayer.playing()) {
      this.audioPlayer.seek(this.audioPlayer.duration() * per);
    }
  }

  async loadHowlSingleTrackObjectAsync(): Promise<any> {

    // Your asynchronous code here
    return new Promise<any>((resolve, reject) => {
      const ext = this.getExt(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);
      const audioPlayer = new Howl({
        src:[this.audioSrc],
        format: [ext.replace(Constants.DOT, Constants.EMPTY_STRING)],
        autoplay: false,
        loop: false,
        volume: 0.5,
        preload: true,
        onend:()=>{
          this.bar.nativeElement.style.display = 'block';
          this.waveForm.nativeElement.style.display = 'none';
          this.pauseBtn.nativeElement.style.display = 'none';
          this.playBtn.nativeElement.style.display = 'block';
          
          this.siriWave.stop();
        },
        onload:()=>{
          const duration =audioPlayer.duration();
          this.duration = this.formatTime(duration);
          this.track = this._fileInfo.getFileName;
          resolve(audioPlayer);
        },
        onseek:()=>{
          // Start updating the progress of the track.
          requestAnimationFrame(this.updatePlayBackPosition.bind(this));
        },
        onloaderror:(err:any)=>{
          reject(err);
        }
      });
    });
  }

  loadHowlPlayListObjectAsync(): Promise<any> {

    return new Promise<any>((resolve, reject) => { 
      this.track = this._fileInfo.getFileName;
      const ext = extname(this.audioSrc)

      const audioPlayer = new Howl({
        src: [this.audioSrc],
        format:[ext],
        autoplay: false,
        loop: false,
        volume: 0.5,
        preload: false,
        autoSuspend: false,
        onend:()=>{
          //console.log('Finished!');
          this.siriWave.canvas.style.opacity = 0;
          this.bar.nativeElement.style.display = 'block';
          this.pauseBtn.nativeElement.style.display = 'none';
          this.playBtn.nativeElement.style.display = 'block';
      
          this.siriWave.stop();
        },
        onload:()=>{
          //console.log('loaded!');
          const duration =audioPlayer.duration();
          this.duration = this.formatTime(duration);
          resolve(audioPlayer);
        },
        onseek:()=>{
          // Start updating the progress of the track.
          requestAnimationFrame(this.updatePlayBackPosition.bind(this));
        },
        onloaderror:(err:any)=>{
          console.log('there are problem:',err);
          reject(err);
        }
      });
    });
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;

      this.audioContainer.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      this.audioContainer.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
    }
  }

  minimizeWindow(arg:number[]):void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      this.audioContainer.nativeElement.style.width = `${arg[0]}px`;
      this.audioContainer.nativeElement.style.height = `${arg[1]}px`;
    }
  }


  getAudioSrc(pathOne:string, pathTwo:string):string{
    let audioSrc = Constants.EMPTY_STRING;
    if(pathOne.includes('blob:http')){
      return pathOne;
    }else if(this.checkForExt(pathOne,pathTwo)){
      audioSrc = Constants.ROOT + this._fileInfo.getContentPath;
    }else{
      audioSrc = this._fileInfo.getCurrentPath;
    }
    return audioSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = false;

    if(Constants.AUDIO_FILE_EXTENSIONS.includes(contentExt)){
      res = true;
    }else if(Constants.AUDIO_FILE_EXTENSIONS.includes(currentPathExt)){
      res = false;
    }
    return res;
  }

  getExt(contentPath:string, currentPath:string):string{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = Constants.EMPTY_STRING;

    if(Constants.AUDIO_FILE_EXTENSIONS.includes(contentExt)){
      res = contentExt;
    }else if(Constants.AUDIO_FILE_EXTENSIONS.includes(currentPathExt)){
      res = currentPathExt;
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
    if(appSessionData !== null &&  appSessionData.app_data != Constants.EMPTY_STRING){
      this.audioSrc = appSessionData.app_data as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}


