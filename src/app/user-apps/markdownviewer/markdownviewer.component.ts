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
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _sessionManagementService!:SessionManagementService;
  private _processHandlerService!:ProcessHandlerService;
  private _scriptService!:ScriptService;
  private _fileService!:FileService;
  private _windowService!:WindowService;


  private _sanitizer: DomSanitizer;
  private _renderer: Renderer2;
  updateIntervalId !: NodeJS.Timeout;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _windowResizeSub!: Subscription;

  /* Floors mirror the CSS min-width/min-height so the resize handler
     ignores transient sub-min sizes during drag. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  private fileSrc = Constants.EMPTY_STRING;
  mkdDwnHtml:SafeHtml = Constants.EMPTY_STRING;

  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}markdown.png`;
  isMaximizable = true;
  name = 'markdownviewer';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
                scriptService: ScriptService,fileService:FileService,  sessionManagementService: SessionManagementService, renderer: Renderer2, 
                sanitizer: DomSanitizer,windowService:WindowService){
                  
    this._processIdService = processIdService
    this._runningProcessService = runningProcessService;
    this._sessionManagementService = sessionManagementService;
    this._processHandlerService = triggerProcessService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._renderer = renderer;
    this._sanitizer = sanitizer

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());

    /* maximizeWindow was declared but never wired up. Subscribe so the
       primary window's maximize/restore broadcasts actually reach us;
       both handlers just clear any inline px so the flex CSS wins. */
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() => {
      this.maximizeWindow();
    });
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe(() => {
      this.minimizeWindow();
    });
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
  }

  ngOnInit():void{
    this.retrievePastSessionData();
  }

  async ngAfterViewInit(): Promise<void>{
    const imgUpdateDelay = 4500; //4.5 seconds to allow for the initial render and any async script loading
    this.fileSrc = (this.fileSrc !== Constants.EMPTY_STRING)? 
    this.fileSrc : this.getFileSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    const isModule = false;
    await this._scriptService.loadScript("markedjs","osdrive/Program-Files/Marked/marked.min.js", isModule);
    const mkd = marked.setOptions({
      gfm: true,
      breaks: true
    });

    const textCntnt = await this._fileService.getFileAsTextAsync(this.fileSrc);
    const htmlCntnt = mkd(textCntnt);
    const safeHtmlCntnt = this._sanitizer.bypassSecurityTrustHtml(htmlCntnt);
    this.mkdDwnHtml = safeHtmlCntnt;
    this.storeAppState(this.fileSrc);

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();

    this.updateIntervalId = setInterval(async ()=>{
      await this.captureComponentImg();
    }, imgUpdateDelay)
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();

    if(this.updateIntervalId){
      clearInterval(this.updateIntervalId);
    }

    // for multiple instances of markdown viewer, we dont want to unload the script until the last instance is closed
    if(this._runningProcessService.getProcessCount(this.name) <= 1){
      this._scriptService.unloadScript(
        "markedjs",
        "osdrive/Program-Files/Marked/marked.min.js"
      );

      // marked.min.js attaches itself to window.marked — clear it so the
      // global is GC'd and a fresh copy is fetched next time.
      delete (window as any).marked;
    }
  }

  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.markDownContent, this.processId, this.name, this.icon, this._windowService);
  }

  maximizeWindow():void{

    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      /* The host (.markdown-main-container) and inner .markdown-content
         are now both fluid (100%/100% + flex), so the primary window's
         maximize animation reflows us automatically. We just strip any
         inline px that an older pass may have written. */
      const host = this.markDownContent?.nativeElement as HTMLElement | undefined;
      if(host){
        host.style.width = '';
        host.style.height = '';
      }
    }
  }

  /**
   * Restore-from-maximized. Mirror of maximizeWindow: clear any inline
   * sizes so the flex layout reads the restored host dimensions.
   */
  minimizeWindow():void{
    const uId = `${this.name}-${this.processId}`;
    if(this._runningProcessService.getEventOriginator() !== uId) return;
    this._runningProcessService.removeEventOriginator();
    const host = this.markDownContent?.nativeElement as HTMLElement | undefined;
    if(host){
      host.style.width = '';
      host.style.height = '';
    }
  }

  /**
   * Live drag-resize. Same intent as maximize/minimize — clear any
   * stale inline px so CSS controls the layout.
   */
  onWindowResize():void{
    const host = this.markDownContent?.nativeElement as HTMLElement | undefined;
    if(host){
      host.style.width = '';
      host.style.height = '';
    }
  }


  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the Task Manager (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
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

    if(contentExt !== Constants.EMPTY_STRING && contentExt == ext){
      res = true;
    }else if( currentPathExt == ext){
      res = false;
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
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      this.fileSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

}
