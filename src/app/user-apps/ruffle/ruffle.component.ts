/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChild, Input } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';

import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import { FileInfo } from 'src/app/system-files/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { CommonFunctions } from 'src/app/system-files/common.functions';



@Component({
  selector: 'cos-ruffle',
  templateUrl: './ruffle.component.html',
  styleUrls: ['./ruffle.component.css'],
  standalone:false,
})
export class RuffleComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  private rufflePlayer:any;
  @ViewChild('ruffleContainer', { static: true }) ruffleContainer!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _windowService:WindowService;
  private _fileService: FileService;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _gameSrc = Constants.EMPTY_STRING;
  private _intervalId: any;

  SECONDS_DELAY = 3000;

  name= 'ruffle';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}ruffle.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'Ruffle-EM';

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService, windowService:WindowService,
              fileService:FileService,) { 
    
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this._fileService = fileService

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
  }

  async ngAfterViewInit(): Promise<void>{
    const isModule = false;
    this._gameSrc =  await this.getGamesSrc(this._fileInfo);
    this._scriptService.loadScript("ruffle","osdrive/Program-Files/Ruffle/ruffle.js", isModule).then(()=>{
      this.rufflePlayer = (window as any).RufflePlayer.newest();
      this.loadSWF(this._fileInfo.getContentPath);
      this.storeAppState(this._gameSrc);
    });


    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.updateComponentImg();
  }

  ngOnDestroy(): void {
    // Clear the interval to prevent memory leaks
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }

  public loadSWF(swfUrl: string):void{
    if (!this.rufflePlayer) {
      console.error('Ruffle is not loaded');
      return;
    }

    const player = this.rufflePlayer.createPlayer();
    this.ruffleContainer.nativeElement.appendChild(player);
    player.load(swfUrl);
  }


  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  async captureComponentImg():Promise<void>{
     const htmlImg = await this.captureRuffleStill();

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

  async captureRuffleStill(): Promise<string> {
    const playerElem = this.ruffleContainer.nativeElement.querySelector("ruffle-player");
    if (!playerElem) return Constants.EMPTY_STRING;

    const canvas = playerElem.shadowRoot?.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return Constants.EMPTY_STRING;

    // Get video stream from canvas
    const stream = canvas.captureStream();
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

  async getGamesSrc(file: FileInfo): Promise<string> {
    const { getCurrentPath, getContentPath } = file;

    if ((getCurrentPath !== Constants.EMPTY_STRING && getContentPath !== Constants.EMPTY_STRING)
        || (getCurrentPath !== Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING)) {
      return getCurrentPath;
    }

    if (getCurrentPath === Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING) {
      this._fileInfo = await this._fileService.getFileInfo(this._gameSrc);
      return this._gameSrc;
    }

    return Constants.EMPTY_STRING;
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data as string,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, xAxis:0, yAxis:0, height:0, width:0, zIndex:0, isVisible:true}
    }
    this._sessionManagmentService.addAppSession(uId, this._appState);
  }
  
  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    console.log('appSessionData:', appSessionData);

    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      this._gameSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }


}
