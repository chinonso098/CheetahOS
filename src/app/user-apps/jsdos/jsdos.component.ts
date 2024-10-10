import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import {DosPlayerFactoryType } from "js-dos";
import {DosPlayerOptions} from './js.dos';
import {CommandInterface, Emulators} from "emulators";
import {extname} from 'path';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
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

declare const Dos: DosPlayerFactoryType;
declare const emulators:Emulators

@Component({
  selector: 'cos-jsdos',
  templateUrl: './jsdos.component.html',
  styleUrls: ['./jsdos.component.css']
})
export class JSdosComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('doswindow') dosWindow!: ElementRef; 

  private _fileService:FileService;
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _consts:Constants = new Constants();
  
  private _ci!: CommandInterface;
  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private gameSrc = '';

  SECONDS_DELAY = 250;

  name= 'jsdos';
  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}js-dos_emulator.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'JS-Dos';

  dosOptions:DosPlayerOptions = {
    style: "none",
    noSideBar: true,
    noFullscreen: true,
    noSocialLinks:true
  }

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
              stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService, scriptService: ScriptService) { 
    this._fileService = fileService
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

  ngOnDestroy(): void {
    if(this.dosOptions){

      if(this._ci != undefined)
          this._ci.exit();
    }
  }

  async ngAfterViewInit() {
    
    this.setJSDosWindowToFocus(this.processId); 
      
    this.gameSrc = (this.gameSrc !=='')? 
      this.gameSrc : this.getGamesSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService.loadScript("js-dos", "osdrive/Program-Files/JS-DOS/js-dos.js").then(async() =>{

      emulators.pathPrefix= '/';

      const data = await this._fileService.getFileBlobAsync(this.gameSrc);
      this._ci = await  Dos(this.dosWindow.nativeElement, this.dosOptions).run(data);
      this.storeAppState(this.gameSrc);
      URL.revokeObjectURL(this.gameSrc);

      this.displayName = this._fileInfo.getFileName;
    })

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.dosWindow.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);
      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
  }

  setJSDosWindowToFocus(pid:number):void{
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  getGamesSrc(pathOne:string, pathTwo:string):string{
    let gameSrc = '';

    if(this.checkForExt(pathOne,pathTwo)){
      gameSrc = '/' + this._fileInfo.getContentPath;
    }else{
      gameSrc =  this._fileInfo.getCurrentPath;
    }

    return gameSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".jsdos";
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
