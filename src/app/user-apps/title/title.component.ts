import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { AppState } from 'src/app/system-files/state/state.interface';

@Component({
  selector:'cos-title',
  templateUrl: './title.component.html',
  styleUrls: ["./title.component.css"],
   // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})

export class TitleComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit{

  @ViewChild('titleContent', {static: true}) titleContent!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _windowService:WindowService;
  private _sessionManagmentService:SessionManagmentService;
  private _maximizeWindowSub!: Subscription;

  private _appState!:AppState;
  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}angular.png`;
  isMaximizable = false;
  name = 'hello';
  processId = 0;
  type = ComponentType.User;
  displayName = 'Hello';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService,windowService:WindowService,
              sessionManagmentService:SessionManagmentService ) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  ngAfterViewInit(): void {
    //this.setTitleWindowToFocus(this.processId); 

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.titleContent.nativeElement).then(htmlImg =>{
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

  maximizeWindow():void{

    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){

      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;
      this.titleContent.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.titleContent.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }

  setTitleWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  storeAppState(app_data:unknown):void{
    const uid = `${this.name}-${this.processId}`;
    this._appState = {
      pid: this.processId,
      app_data: app_data as string,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }
  
  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
      //
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}