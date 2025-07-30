/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, Input } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import {extname} from 'path';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';


@Component({
  selector: 'cos-ruffle',
  templateUrl: './ruffle.component.html',
  styleUrls: ['./ruffle.component.css'],
  standalone:false,
})
export class RuffleComponent implements BaseComponent, OnInit, AfterViewInit {
  private rufflePlayer:any;
  @ViewChild('ruffleContainer', { static: true }) ruffleContainer!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _windowService:WindowService;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private gameSrc = Constants.EMPTY_STRING;

  SECONDS_DELAY = 250;

  name= 'ruffle';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}ruffle.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Ruffle-EM';

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService, windowService:WindowService) { 
    
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
  }

  async ngAfterViewInit() {
    //this.setRuffleWindowToFocus(this.processId); 
    const isModule = false;
    this.gameSrc = (this.gameSrc !== Constants.EMPTY_STRING)? 
    this.gameSrc : this.getGamesSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService.loadScript("ruffle","osdrive/Program-Files/Ruffle/ruffle.js", isModule).then(()=>{
      this.rufflePlayer = (window as any).RufflePlayer.newest();
      this.loadSWF('ruffleWindow',this.gameSrc);
      this.storeAppState(this.gameSrc);
    });


    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY);
  }


  public loadSWF(elementId: string, swfUrl: string) {
    if (!this.rufflePlayer) {
      console.error('Ruffle is not loaded');
      return;
    }

    const player = this.rufflePlayer.createPlayer();
    this.ruffleContainer.nativeElement.appendChild(player);
    player.load(swfUrl);
  }


  setRuffleWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.ruffleContainer.nativeElement).then(htmlImg =>{
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

  getGamesSrc(pathOne:string, pathTwo:string):string{
    let gameSrc = Constants.EMPTY_STRING;

    if(this.checkForExt(pathOne,pathTwo)){
      gameSrc = Constants.ROOT + this._fileInfo.getContentPath;
    }else{
      gameSrc =  'osdrive' +this._fileInfo.getCurrentPath;
    }

    return gameSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".swf";
    let res = false;

    if(contentExt != Constants.EMPTY_STRING && contentExt == ext){
      res = true;
    }else if( currentPathExt == ext){
      res = false;
    }
    return res;
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
      this.gameSrc = appSessionData.app_data as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }


}
