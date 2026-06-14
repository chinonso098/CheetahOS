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
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';

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
  private _windowResizeSub!: Subscription;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService: SessionManagementService;
  private _scriptService!:ScriptService;
  private _windowService!:WindowService;
  private _audioService!:AudioService;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;

  SECONDS_DELAY = 250;
  // Audio player minimum usable size. Resize notifications below these values
  // are ignored so the SiriWave canvas / controls don't try to lay out into a
  // sub-minimum window.
  readonly MIN_WIDTH_PX  = 480;
  readonly MIN_HEIGHT_PX = 320;
  private audioSrc = Constants.EMPTY_STRING;
  private audioPlayer: any;
  private siriWave: any;
  private isSliderDown = false;

  playList:string[] = [];
  recents:string[] = [];

  name= 'audioplayer';
  hasWindow = true;
  isMaximizable=true;
  icon = `${Constants.IMAGE_BASE_PATH}audioplayer.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Howlerjs';
  showTopMenu = false;

  track = 'N/A';
  timer ='0:00';
  duration = '0:00' ;

 
  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagementService: SessionManagementService, scriptService:ScriptService, 
    windowService:WindowService, audioService:AudioService) { 
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagementService= sessionManagementService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();

    this._runningProcessService = runningProcessService;
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify.subscribe(() =>{this.changeContent()})
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      // Ignore resizes that fall below our declared minimums.
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  async ngAfterViewInit():Promise<void>{  

    //this.setAudioWindowToFocus(this.processId); 
    this.audioSrc = (this.audioSrc !== Constants.EMPTY_STRING)? 
      this.audioSrc :this.getAudioSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

      // These are UMD bundles, not ES modules. They MUST be loaded as classic
      // scripts (isModule = false). If loaded as type="module" the browser
      // caches them in its module map keyed by URL, so removing the <script>
      // tag in ngOnDestroy and re-appending it on the next open will NOT
      // re-execute the script — meaning window.SiriWave never gets re-attached
      // and `new SiriWave(...)` below throws on the second open.
      //await this._scriptService.loadScript("howler","osdrive/Program-Files/Howler/howler.min.js", false);
      const isModule = false;
      await this._scriptService.loadScript("siriwave","osdrive/Program-Files/Howler/siriwave.umd.min.js", isModule);

      // .waveform itself is display:none until playback starts, so its rect
      // is 0×0 right now. Measure the audio container instead and use the
      // same 30% height ratio that .waveform's CSS uses.
      const rect = this.audioContainer.nativeElement.getBoundingClientRect();
      const initW = rect.width  || 480;
      const initH = (rect.height || 320) * 0.3;

      this.siriWave = new SiriWave({
        container: this.waveForm.nativeElement,
        width: initW,
        height: initH,
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

      await CommonFunctions.sleep(this.SECONDS_DELAY);
      await this.captureComponentImg();


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
    this._windowResizeSub?.unsubscribe();

    this._scriptService.unloadScript("siriwave", "osdrive/Program-Files/Howler/siriwave.umd.min.js" );
    // siriwave.umd.min.js attaches itself to window.SiriWave — clear it so the
    // global is GC'd and a fresh copy is fetched next time.
    delete (window as any).SiriWave;
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.audioContainer, this.processId, this.name, this.icon, this._windowService);
  }

  async changeContent():Promise<void>{
    const uId = `${this.name}-${this.processId}`;
    const delay = 1000; // 1sec delay to allow the file info to be updated in the process handler service before we fetch it

    console.log('previous audio source:',  this.audioSrc);
    this.audioSrc = Constants.EMPTY_STRING;
    console.log('previous audio source-1:',  this.audioSrc);
    if(this._runningProcessService.getEventOriginator() === uId){

      //this._fileInfo = this._processHandlerService.getLastProcessTrigger();
      const updatedProcesss = this.getComponentDetail();
      this._runningProcessService.updateProccess(updatedProcesss);

      this.audioSrc = (this.audioSrc !== Constants.EMPTY_STRING)? 
      this.audioSrc :this.getAudioSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

      this.siriWave.stop();
      this.audioPlayer.stop();

      // got purge the old howl instance :()
      this.audioPlayer?.unload();
      this._audioService.removeExternalAudioSrc(this.name);

      console.log('new audio source:',  this.audioSrc);

      await CommonFunctions.sleep(delay);
      const howl = await this.loadHowlSingleTrackObjectAsync();

      try{
        this.audioPlayer = howl;
        this._audioService.addExternalAudioSrc(this.name, howl);
        this.onPlayBtnClicked();
      }
      catch(error){ console.error('Error loading track:', error);}

      this.storeAppState(this.audioSrc);
      await this.captureComponentImg();
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

    // .waveform was display:none until now, so the canvas had no real rendered
    // size. Re-sync the SiriWave drawing buffer to the canvas's actual CSS
    // pixel size (times DPR) on the next frame to avoid blurry first paint.
    requestAnimationFrame(() => this.resizeSiriWave());

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
    return mins + Constants.COLON + (secs < 10 ? '0' : Constants.EMPTY_STRING) + secs;
  }

  addToRecentsList(audioPath:string):void{
    if(!this.recents.includes(audioPath))
      this.recents.push(audioPath);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  resizeSiriWave():void{
    if(!this.siriWave || !this.siriWave.canvas) return;

    // Measure the canvas's actual rendered CSS pixels (cover:true makes the
    // canvas style 100%/100% of .waveform, so this is the true display size).
    // Fall back to computing from the container when the canvas is hidden.
    const canvasRect = this.siriWave.canvas.getBoundingClientRect();
    let cssW = canvasRect.width;
    let cssH = canvasRect.height;

    if(cssW <= 0 || cssH <= 0){
      const containerRect = this.audioContainer.nativeElement.getBoundingClientRect();
      cssW = containerRect.width;
      cssH = containerRect.height * 0.3; // matches .waveform { height: 30% }
    }
    if(cssW <= 0 || cssH <= 0) return;

    // Drawing buffer = CSS size * devicePixelRatio  =>  pixel-perfect, no blur.
    const ratio = (this.siriWave.opt && this.siriWave.opt.ratio) || (window.devicePixelRatio || 1);
    this.siriWave.opt.width  = cssW;
    this.siriWave.opt.height = cssH;
    this.siriWave.width      = ratio * cssW;
    this.siriWave.height     = ratio * cssH;
    this.siriWave.heightMax  = (this.siriWave.height / 2) - 6;

    this.siriWave.canvas.width  = this.siriWave.width;
    this.siriWave.canvas.height = this.siriWave.height;
    // Keep CSS stretch at 100% (cover behavior); drawing buffer above gives crispness.
    this.siriWave.canvas.style.width  = '100%';
    this.siriWave.canvas.style.height = '100%';
    // Library stores the host element at opt.container in this build.
    const host = this.siriWave.container || (this.siriWave.opt && this.siriWave.opt.container);
    if(host && host.style) host.style.margin = '0';

    if(this.audioPlayer){
      const containerRect = this.audioContainer.nativeElement.getBoundingClientRect();
      const volume = this.audioPlayer.volume();
      const barWidth = (volume * 0.9);
      this.sliderBtn.nativeElement.style.left = (containerRect.width * barWidth + containerRect.width * 0.05 - 25) + 'px';
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
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      // Container is now 100% of the primary window content area, so we only
      // need to re-flow the SiriWave canvas to the new size.
      this.onWindowResize();
    }
  }

  minimizeWindow(arg:number[]):void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
  }

  // Called continuously while the primary window is being resized. Re-runs the
  // SiriWave sizing math against the current container rect.
  onWindowResize():void{
    try {
      this.resizeSiriWave();
    } catch (e) {
      console.warn('audioplayer resize failed:', e);
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
    if(appSessionData !== null &&  appSessionData.appData != Constants.EMPTY_STRING){
      this.audioSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

}


