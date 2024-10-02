import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';

import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
// import { DiffEditorModel } from 'ngx-monaco-editor-v2';


@Component({
  selector: 'cos-codeeditor',
  templateUrl: './codeeditor.component.html',
  styleUrl: './codeeditor.component.css'
})
export class CodeEditorComponent  implements BaseComponent,  OnDestroy, AfterViewInit, OnInit {

  @ViewChild('monacoContent', {static: true}) monacoContent!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _stateManagmentService:StateManagmentService;
  private _triggerProcessService:TriggerProcessService;
  private _consts:Constants = new Constants();

  private _maximizeWindowSub!: Subscription;
  SECONDS_DELAY = 250;

  editorOptions = {
    language: 'javascript', // java, javascript, python, csharp, html, markdown, ruby
    theme: 'vs-dark', // vs, vs-dark, hc-black
    automaticLayout: true,
  };
  code = this.getCode();


  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}vs_code.png`;
  name = 'codeeditor';
  processId = 0;
  type = ComponentType.User;
  displayName = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
                stateManagmentService:StateManagmentService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._stateManagmentService = stateManagmentService;
    this._triggerProcessService = triggerProcessService;


    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit(): void {
    this.setCodeEditorWindowToFocus(this.processId); 

    // setTimeout(()=>{
    //   this.captureComponentImg();
    // },this.SECONDS_DELAY) 
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.monacoContent.nativeElement).then(htmlImg =>{
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
      this.monacoContent.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.monacoContent.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

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
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
  }

}
