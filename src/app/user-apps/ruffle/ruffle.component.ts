import { Component, ElementRef, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import {extname} from 'path';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";


@Component({
  selector: 'cos-ruffle',
  templateUrl: './ruffle.component.html',
  styleUrls: ['./ruffle.component.css']
})
export class RuffleComponent implements BaseComponent, OnInit, AfterViewInit {
  private rufflePlayer:any;
  @ViewChild('ruffleContainer', { static: true }) ruffleContainer!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;

  private _consts:Constants = new Constants();
  
  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private gameSrc = '';

  SECONDS_DELAY = 250;

  name= 'ruffle';
  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}ruffle.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Ruffle-EM';

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
    stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService, scriptService: ScriptService) { 
    
    this._processIdService = processIdService;
    this._triggerProcessService = triggerProcessService;
    this._stateManagmentService = stateManagmentService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this.processId = this._processIdService.getNewProcessId();

    this.retrievePastSessionData();

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();
  }

  async ngAfterViewInit() {
    this.setRuffleWindowToFocus(this.processId); 

    this.gameSrc = (this.gameSrc !=='')? 
    this.gameSrc : this.getGamesSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService.loadScript("ruffle","osdrive/Program-Files/Ruffle/ruffle.js").then(()=>{
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
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.ruffleContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
}

  getGamesSrc(pathOne:string, pathTwo:string):string{
    let gameSrc = '';

    if(this.checkForExt(pathOne,pathTwo)){
      gameSrc = '/' + this._fileInfo.getContentPath;
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

    if(contentExt != '' && contentExt == ext){
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
          this.gameSrc = appSessionData.app_data as string;
        }
      }
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
  }


}
