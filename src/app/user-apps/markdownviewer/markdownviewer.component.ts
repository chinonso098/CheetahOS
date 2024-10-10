import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, Renderer2} from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { Process } from 'src/app/system-files/process';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import {extname} from 'path';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Constants } from "src/app/system-files/constants";

declare const marked:any;

@Component({
  selector: 'cos-markdownviewer',
  templateUrl: './markdownviewer.component.html',
  styleUrl: './markdownviewer.component.css'
})

export class MarkDownViewerComponent implements BaseComponent,  OnDestroy, AfterViewInit, OnInit {

  @ViewChild('markDownContent', {static: true}) markDownContent!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _triggerProcessService:TriggerProcessService;
  private _scriptService: ScriptService;
  private _fileService:FileService;

  private _consts:Constants = new Constants();

  private _sanitizer: DomSanitizer;
  private _renderer: Renderer2;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _maximizeWindowSub!: Subscription;
  private fileSrc = '';
  mkdDwnHtml:SafeHtml = '';

  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}markdown.png`;
  name = 'markdownviewer';
  processId = 0;
  type = ComponentType.System;
  displayName = '';


  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
                stateManagmentService:StateManagmentService, scriptService: ScriptService,fileService:FileService, 
                sessionManagmentService: SessionManagmentService, renderer: Renderer2, sanitizer: DomSanitizer){
    this._processIdService = processIdService
    this._runningProcessService = runningProcessService;
    this._stateManagmentService = stateManagmentService;
    this._sessionManagmentService = sessionManagmentService;
    this._triggerProcessService = triggerProcessService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._renderer = renderer;
    this._sanitizer = sanitizer

    this.processId = this._processIdService.getNewProcessId();

    this.retrievePastSessionData();

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();
  }

  ngAfterViewInit(): void{
    this.setMardkDownViewerWindowToFocus(this.processId); 

    this.fileSrc = (this.fileSrc !=='')? 
    this.fileSrc : this.getFileSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService.loadScript("markedjs","osdrive/Program-Files/Marked/marked.min.js").then(async() =>{  
     const mkd = marked.setOptions({
        gfm: true,
        breaks: true
      });

      const textCntnt = await this._fileService.getFileAsync(this.fileSrc);
      const htmlCntnt = mkd(textCntnt);
      const safeHtmlCntnt = this._sanitizer.bypassSecurityTrustHtml(htmlCntnt);
      this.mkdDwnHtml = safeHtmlCntnt;
      this.storeAppState(this.fileSrc);
    })

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY);

  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.markDownContent.nativeElement).then(htmlImg =>{

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
  }

  maximizeWindow():void{

    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){

      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;
      this.markDownContent.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.markDownContent.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }


  setMardkDownViewerWindowToFocus(pid:number):void{
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  getFileSrc(pathOne:string, pathTwo:string):string{
    let fileSrc = '';

    if(this.checkForExt(pathOne,pathTwo)){
      fileSrc = '/' + this._fileInfo.getContentPath;
    }else{
      fileSrc =  this._fileInfo.getCurrentPath;
    }

    return fileSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".md";
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
          this.fileSrc = appSessionData.app_data as string;
        }
      }
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
  }

}
