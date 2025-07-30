/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, OnDestroy, Input } from '@angular/core';

import {extname} from 'path';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState} from 'src/app/system-files/state/state.interface';

import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';

declare let Dos: any;
@Component({
  selector: 'cos-jsdos',
  templateUrl: './jsdos.component.html',
  styleUrls: ['./jsdos.component.css'],
  standalone:false,
})
export class JSdosComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('doswindow') dosWindow!: ElementRef; 
  @Input() priorUId = Constants.EMPTY_STRING;

  private _fileService:FileService;
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _windowService:WindowService;
  
  private dosInstance: any = null; // Store js-dos instance

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private gameSrc = Constants.EMPTY_STRING;

  SECONDS_DELAY = 250;

  name= 'jsdos';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}js-dos_emulator.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'JS-Dos';

  dosOptions= {
    style: "none",
    noSideBar: true,
    noFullscreen: true,
    noSocialLinks:true
  }

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService ,windowService:WindowService) { 
    this._fileService = fileService
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

  ngOnDestroy(): void {
    if(this.dosInstance) {
      this.dosInstance.exit(); // Clean up js-dos instance
      this.dosInstance = null;
    }
  }

  async ngAfterViewInit() {
    
    //this.setJSDosWindowToFocus(this.processId); 
      
    this.gameSrc = (this.gameSrc !=='')? 
      this.gameSrc : this.getGamesSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService.loadScript("js-dos", "osdrive/Program-Files/jsdos/js-dos.js").then(async() =>{
      const data = await this._fileService.getFileAsBlobAsync(this.gameSrc);
      this.dosInstance = await Dos(this.dosWindow.nativeElement, this.dosOptions).run(data);

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
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
    })
  }

  setJSDosWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  getGamesSrc(pathOne:string, pathTwo:string):string{
    let gameSrc = Constants.EMPTY_STRING;

    if(this.checkForExt(pathOne,pathTwo)){
      gameSrc = Constants.ROOT + this._fileInfo.getContentPath;
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
      app_data: app_data,
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
