/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, Renderer2, Input} from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { Process } from 'src/app/system-files/process';
import { AppState } from 'src/app/system-files/state/state.interface';

import {extname} from 'path';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';

declare const marked:any;

@Component({
  selector: 'cos-markdownviewer',
  templateUrl: './markdownviewer.component.html',
  styleUrl: './markdownviewer.component.css',
  standalone:false,
})

export class MarkDownViewerComponent implements BaseComponent,  OnDestroy, AfterViewInit, OnInit {

  @ViewChild('markDownContent', {static: true}) markDownContent!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  private _sessionManagmentService: SessionManagmentService;
  private _processHandlerService:ProcessHandlerService;
  private _scriptService: ScriptService;
  private _fileService:FileService;
  private _windowService:WindowService;


  private _sanitizer: DomSanitizer;
  private _renderer: Renderer2;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _maximizeWindowSub!: Subscription;
  private fileSrc = Constants.EMPTY_STRING;
  mkdDwnHtml:SafeHtml = Constants.EMPTY_STRING;

  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}markdown.png`;
  isMaximizable = false;
  name = 'markdownviewer';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
                scriptService: ScriptService,fileService:FileService,  sessionManagmentService: SessionManagmentService, renderer: Renderer2, 
                sanitizer: DomSanitizer,windowService:WindowService){
                  
    this._processIdService = processIdService
    this._runningProcessService = runningProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._processHandlerService = triggerProcessService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._renderer = renderer;
    this._sanitizer = sanitizer

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
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

      const textCntnt = await this._fileService.getFileAsTextAsync(this.fileSrc);
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
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
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
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  getFileSrc(pathOne:string, pathTwo:string):string{
    let fileSrc = Constants.EMPTY_STRING;

    if(this.checkForExt(pathOne,pathTwo)){
      fileSrc = Constants.ROOT + this._fileInfo.getContentPath;
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
      this.fileSrc = appSessionData.app_data as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}
