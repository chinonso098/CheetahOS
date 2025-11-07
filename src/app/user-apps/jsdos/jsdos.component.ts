/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, OnDestroy, Input } from '@angular/core';
import {extname} from 'path';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';

import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState} from 'src/app/system-files/state/state.interface';

import { FileService } from 'src/app/shared/system-service/file.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import { Constants } from "src/app/system-files/constants";
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
  private _gameSrc = Constants.EMPTY_STRING;
  private _intervalId: any;

  SECONDS_DELAY = 5000;

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

    // Clear the interval to prevent memory leaks
    if (this._intervalId) {
      clearInterval(this._intervalId);
      console.log('Timer cleared on destroy.');
    }
  }

  async ngAfterViewInit():Promise<void>{
    this._gameSrc = this.getGamesSrc(this._fileInfo);

    this._scriptService.loadScript("js-dos", "osdrive/Program-Files/jsdos/js-dos.js").then(async() =>{
      const data = await this._fileService.getFileAsBlobAsync(this._gameSrc);
      this.dosInstance = await Dos(this.dosWindow.nativeElement, this.dosOptions).run(data);

      this.storeAppState(this._gameSrc);
      URL.revokeObjectURL(this._gameSrc);

      this.displayName = this._fileInfo.getFileName;
    })

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.updateComponentImg();
  }

  async captureComponentImg(): Promise<void>{
    const htmlImg = await this.captureJSDos();

    const cmpntImg:TaskBarPreviewImage = {
      pId: this.processId,
      appName: this.name,
      displayName: this.name,
      icon : this.icon,
      defaultIcon: this.icon,
      imageData: htmlImg
    }
    this._windowService.addProcessPreviewImage(this.name, cmpntImg);
  }

  async captureJSDos(): Promise<string> {
    const canvasElemnt = document.getElementsByClassName("emulator-canvas")[0] as HTMLCanvasElement;
    if (!canvasElemnt) return Constants.EMPTY_STRING;

    // Get video stream from canvas
    const stream = canvasElemnt.captureStream();
    const track = stream.getVideoTracks()[0];

    // Use ImageCapture (with TS override)
    const imageCapture = new (window as any).ImageCapture(track);
    const bitmap: ImageBitmap = await imageCapture.grabFrame();

    // Draw bitmap onto an offscreen canvas
    const tmp = document.createElement("canvas");
    tmp.width = bitmap.width;
    tmp.height = bitmap.height;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);

    return tmp.toDataURL("image/png");
  }

  updateComponentImg():void{
    this._intervalId = setInterval(async() => {
        await this.captureComponentImg()
    }, this.SECONDS_DELAY);
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
    this.dosWindow.nativeElement.focus();
  }

  getGamesSrc(file: FileInfo):string {
    console.log('getGamesSrc:', file);

    const { getCurrentPath, getContentPath } = file;

    if ((getCurrentPath !== Constants.EMPTY_STRING && getContentPath !== Constants.EMPTY_STRING)
        || (getCurrentPath !== Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING)) {
      return getCurrentPath;
    }

    if (getCurrentPath === Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING) {
      return this._gameSrc;
    }

    return Constants.EMPTY_STRING;
  }


  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".jsdos";
    let res = false;

    if(contentExt !== Constants.EMPTY_STRING && contentExt == ext){
      res = true;
    }else if( currentPathExt === ext){
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
      window: {appName:'', pId:0, xAxis:0, yAxis:0, height:0, width:0, zIndex:0, isVisible:true}
    }
    this._sessionManagmentService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      this._gameSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}
