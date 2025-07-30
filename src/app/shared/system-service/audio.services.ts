import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { ScriptService } from "./script.services";
import {extname} from 'path';
import { Subject } from "rxjs";

declare const Howl:any;

@Injectable({
    providedIn: 'root'
})

export class AudioService implements BaseService {

  private _runningProcessService:RunningProcessService;
  private _scriptService:ScriptService;
  private _processIdService:ProcessIDService;
  private _audioPlayer: any;
  private _externalAudioSrc: Map<string, any>;

  changeVolumeNotify: Subject<void> = new Subject<void>();
  hideShowVolumeControlNotify: Subject<void> = new Subject<void>();

  isExternalAudioSrcPresent = false;
  isAudioScriptLoaded = false;
  isAudioFileReady = false;

  audioSrc = Constants.EMPTY_STRING;
  
  name = 'audio_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status  = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = 'handles system audio';

    
  constructor(scriptService:ScriptService, processIDService:ProcessIDService, runningProcessService:RunningProcessService){
    this._scriptService = scriptService;
    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;
    this._externalAudioSrc = new Map<string, any>();

    this.loadAudioScript();
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  private async loadAudioScript(): Promise<void> {
    if (this.isAudioScriptLoaded) return;

    try {
      await this._scriptService.loadScript('howler', 'osdrive/Program-Files/Howler/howler.min.js');
      this.isAudioScriptLoaded = true;
    } catch (err) {
      console.error('Failed to load Howler script:', err);
    }
  }

  private async loadHowlTrack(): Promise<void> {
    const ext = this.getExt(Constants.EMPTY_STRING, this.audioSrc).replace(Constants.DOT, Constants.EMPTY_STRING);

    return new Promise((resolve, reject) => {
      this._audioPlayer = new Howl({
        src: [this.audioSrc],
        format: [ext],
        autoplay: false,
        loop: false,
        volume: 0.5,
        preload: true,
        onload: () => {
          this.isAudioFileReady = true;
          resolve();
        },
        onloaderror: (err: any) => {
          this.isAudioFileReady = false;
          console.error('Error loading track:', err);
          reject(err);
        }
      });
    });
  }

  async play(path: string): Promise<void> {
    //console.log('play:', path);
    this.audioSrc = path;

    // Unload previous audio
    if (this._audioPlayer) {
      this._audioPlayer.stop();
      this._audioPlayer.unload();
      this.isAudioFileReady = false;
    }

    await this.handlePlay();
  }

  private async handlePlay(): Promise<void> {
    try {
      await this.loadAudioScript();
      await this.loadHowlTrack();
      this.playSound();
    } catch (err) {
      console.error('handlePlay err:', err);
    }
  }

  private playSound():void{
    this._audioPlayer.play();
  }

  stopSound():void{
    this._audioPlayer.stop();
  }

  pauseSound():void{
    this._audioPlayer.pause();
  }

  getVolume():number{
    if(!this.isAudioFileReady || !this._audioPlayer)
      return 0;

    return this._audioPlayer.volume();
  }

  changeVolume(volume:number):void{
    this._audioPlayer.volume(volume);

    if(this._externalAudioSrc){
      for(const extSrc of this._externalAudioSrc.values()){
        extSrc.volume(volume);
      }
    }
  }

  addExternalAudioSrc(srcName:string, extAudio:any):void{
    this._externalAudioSrc.set(srcName, extAudio);
    this.isExternalAudioSrcPresent = true;
  }

  removeExternalAudioSrc(srcName:string):void{
    const check = this._externalAudioSrc.get(srcName);
    if(check)
      this._externalAudioSrc.delete(srcName);
    
    if(this._externalAudioSrc.size === 0)
      this.isExternalAudioSrcPresent = false;
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

  private getProcessDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private getServiceDetail():Service{
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
  }
}