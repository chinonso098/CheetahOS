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

  static instace:AudioService;
  private _runningProcessService:RunningProcessService;
  private _scriptService:ScriptService;
  private _processIdService:ProcessIDService;
  private _audioPlayer: any;

  readonly defaultAudio = `${Constants.AUDIO_BASE_PATH}cheetah_start_up_2.mp3`;

  changeVolumeNotify: Subject<void> = new Subject<void>();
  hideShowVolumeControlNotify: Subject<void> = new Subject<void>();

  name = 'audio_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status  = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = 'handles system audio file';

  audioSrc = '';
    
  constructor(){
      AudioService.instace = this;
      this.audioSrc = this.defaultAudio;
      this._scriptService = ScriptService.instace;
      this._processIdService = ProcessIDService.instance;
      this._runningProcessService = RunningProcessService.instance;

      this.loadAudioScript();
      this.processId = this._processIdService.getNewProcessId();
      this._runningProcessService.addProcess(this.getProcessDetail());
      this._runningProcessService.addService(this.getServiceDetail());
  }

  private loadAudioScript(): void {
      // Using setTimeout ensures it runs after the constructor has returned
      setTimeout(() => {
          this.loadAudioScriptAsync();
      }, 0);
  }

  private async loadAudioScriptAsync():Promise<void>{
    this._scriptService.loadScript("howler","osdrive/Program-Files/Howler/howler.min.js").then(()=>{
      this.loadHowlSingleTrackObjectAsync()
        .then(howl => { this._audioPlayer = howl; })
        .catch(error => { console.error('Error loading track:', error); });
    });
  }

  async loadHowlSingleTrackObjectAsync(): Promise<any> {
    // Your asynchronous code here
    return new Promise<any>((resolve, reject) => {
      const ext = this.getExt('', this.audioSrc);
      const audioPlayer = new Howl({
        src:[this.audioSrc],
        format: [ext.replace('.','')],
        autoplay: false,
        loop: false,
        volume: 0.5,
        preload: true,
        onload:()=>{
          resolve(audioPlayer);
        },
        onloaderror:(err:any)=>{
          reject(err);
        }
      });
    });
  }

  play(path:string):void{
    const delay = 1;
    this.audioSrc = Constants.EMPTY_STRING;
    this.audioSrc = path;

    this._audioPlayer.stop();

    setTimeout(async()=> {
      this.loadHowlSingleTrackObjectAsync()
        .then(howl => { 
          this._audioPlayer = howl; 
          this.playSound();
        })
        .catch(error => { console.error('Error loading track:', error); });
    }, delay);
  }

  playSound():void{
    this._audioPlayer.play();
  }

  stopSound():void{
    this._audioPlayer.stop();
  }

  pauseSound():void{
    this._audioPlayer.pause();
  }

  getVolume():number{
    return  this._audioPlayer.volume();
  }

  changeVolume(volume:number):void{
    this._audioPlayer.volume(volume);
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
    let res = '';

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