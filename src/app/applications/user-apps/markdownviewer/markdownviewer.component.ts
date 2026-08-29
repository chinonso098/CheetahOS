/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, Renderer2, Input, HostBinding} from '@angular/core';
import { Subscription } from 'rxjs';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { Process } from 'src/app/system-files/process';
import { AppState } from 'src/app/system-files/state/state.interface';

import { ScriptService } from 'src/app/shared/system-service/script.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { ThemeService } from 'src/app/shared/system-theme/theme';

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
  private _themeService!:ThemeService;

  // Default styling is light; the host gains `theme-dark` for the dark variant.
  @HostBinding('class.theme-dark') isDarkTheme = false;
  private _themeChangeSub!: Subscription;

  private _sanitizer: DomSanitizer;
  private _renderer: Renderer2;
  updateIntervalId !: NodeJS.Timeout;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;

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
  readonly name = 'markdownviewer';
  processId = 0;
  type = ComponentType.System;
  displayName = this.name;


  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
                scriptService: ScriptService,fileService:FileService,  sessionManagementService: SessionManagementService, renderer: Renderer2, 
                sanitizer: DomSanitizer,windowService:WindowService, themeService:ThemeService){
    this._processIdService = processIdService
    this._runningProcessService = runningProcessService;
    this._sessionManagementService = sessionManagementService;
    this._processHandlerService = triggerProcessService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._renderer = renderer;
    this._sanitizer = sanitizer
    this._themeService = themeService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());

    this.isDarkTheme = !this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isDarkTheme = !this._themeService.isLightTheme();
    });
  }

  ngOnInit():void{
    this.retrievePastSessionData();

    // Set displayName here (NOT in ngAfterViewInit). It is bound to
    // [processAppName]="displayName"; mutating it after the view is checked
    // triggers NG0100 (ExpressionChangedAfterItHasBeenCheckedError).
    const fileName = this._fileInfo?.getFileName;
    if (fileName && fileName !== Constants.EMPTY_STRING) {
      this.displayName = fileName;
    }
  }

  async ngAfterViewInit(): Promise<void>{
    const imgUpdateDelay = 4500; //4.5 seconds to allow for the initial render and any async script loading
    this.fileSrc = (this.fileSrc !== Constants.EMPTY_STRING)? 
    this.fileSrc : this._fileService.resolveContentPath(this._fileInfo);

    // displayName is set in ngOnInit (before the view is checked) to avoid NG0100.

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
    if(this.updateIntervalId){
      clearInterval(this.updateIntervalId);
    }

    this._themeChangeSub?.unsubscribe();

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


  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId 
      && this._windowService.getIsWindowInFocus()) return;

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
