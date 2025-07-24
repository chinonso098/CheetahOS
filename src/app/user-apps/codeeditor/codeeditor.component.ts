/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { AppState } from 'src/app/system-files/state/state.interface';

// import { DiffEditorModel } from 'ngx-monaco-editor-v2';


@Component({
  selector: 'cos-codeeditor',
  templateUrl: './codeeditor.component.html',
  styleUrl: './codeeditor.component.css',
  standalone:false,
})
export class CodeEditorComponent  implements BaseComponent,  OnDestroy, AfterViewInit, OnInit {

  @ViewChild('monacoContent', {static: true}) monacoContent!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  private _processHandlerService:ProcessHandlerService;
  private _windowService:WindowService;
  private _sessionManagmentService:SessionManagmentService


  private _maximizeWindowSub!: Subscription;
  SECONDS_DELAY = 250;

  private _appState!:AppState;
    
  editorOptions = {
    language: 'javascript', // java, javascript, python, csharp, html, markdown, ruby
    theme: 'vs-dark', // vs, vs-dark, hc-black
    automaticLayout: true,
  };
  code = this.getCode();


  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}vs_code.png`;
  isMaximizable = false;
  name = 'codeeditor';
  processId = 0;
  type = ComponentType.User;
  displayName = Constants.EMPTY_STRING;

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
               sessionManagmentService:SessionManagmentService ,windowService:WindowService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._processHandlerService = triggerProcessService;
    this._windowService = windowService;


    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  ngAfterViewInit(): void {
    1
    //this.setCodeEditorWindowToFocus(this.processId); 

    // setTimeout(()=>{
    //   this.captureComponentImg();
    // },this.SECONDS_DELAY) 

    //this.storeAppState();
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.monacoContent.nativeElement).then(htmlImg =>{
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
      this.monacoContent.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.monacoContent.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
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
    if(appSessionData !== null && appSessionData.app_data != Constants.EMPTY_STRING){
        this.code =  appSessionData.app_data as string;
    }
  }

  getCode():string{
    // return (
    //   '<html><!-- // !!! Tokens can be inspected using F1 > Developer: Inspect Tokens !!! -->\n<head>\n	<!-- HTML comment -->\n	<style type="text/css">\n		/* CSS comment */\n	</style>\n	<script type="javascript">\n		// JavaScript comment\n	</' +
    //   'script>\n</head>\n<body></body>\n</html>'
    // );

    return 'function x() {\nconsole.log("Hello world!");\n}';
  }


  setCodeEditorWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}
