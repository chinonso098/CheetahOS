import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { Constants } from "src/app/system-files/constants";

import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';

import {extname} from 'path';
import * as htmlToImage from 'html-to-image';
import { Subscription } from 'rxjs';

declare const Quill:any;

@Component({
  selector: 'cos-texteditor',
  templateUrl: './texteditor.component.html',
  styleUrls: ['./texteditor.component.css']
})


export class TextEditorComponent  implements BaseComponent, OnDestroy, AfterViewInit, OnInit  {

  @ViewChild('editorContainer', {static: true}) editorContainer!: ElementRef;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _triggerProcessService:TriggerProcessService;
  private _scriptService: ScriptService;
  private _fileService:FileService;

  private _consts:Constants = new Constants();
  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _maximizeWindowSub!: Subscription;
  private fileSrc = '';
  private quill: any;

  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}text-editor.png`;
  name = 'texteditor';
  processId = 0;
  type = ComponentType.System;
  displayName = '';


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
              fileService:FileService,  sessionManagmentService: SessionManagmentService,  stateManagmentService:StateManagmentService, 
              scriptService: ScriptService){

    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._stateManagmentService = stateManagmentService;
    this._triggerProcessService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this._fileService = fileService;


    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();
  }


  ngAfterViewInit(): void {
    this.setTextEditorWindowToFocus(this.processId); 

    this.fileSrc = (this.fileSrc !=='')? 
    this.fileSrc : this.getFileSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    const options = {
      debug: 'info',
      modules: {
        toolbar: true,
      },
      placeholder: 'Compose an epic...',
      theme: 'snow'
    };
    this._scriptService.loadScript("quilljs","osdrive/Program-Files/Quill/quill.js").then( async() =>{
  
      const textCntnt = await this._fileService.getFileAsync(this.fileSrc);
      const index = 0;

      this.quill = new Quill(this.editorContainer.nativeElement, options)
      this.quill.insertText(index, textCntnt, {
        color: '#ffff00',
        italic: false,
      });
    })

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.editorContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

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
      this.editorContainer.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.editorContainer.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }

  setTextEditorWindowToFocus(pid:number):void{
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
    const ext = ".txt";
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
