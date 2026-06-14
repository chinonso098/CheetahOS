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
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { AppState } from 'src/app/system-files/state/state.interface';
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _windowService!:WindowService;
  private _sessionManagementService!:SessionManagementService;
  private _maximizeWindowSub!:Subscription;
  private _minimizeWindowSub!:Subscription;
  private _windowResizeSub!:Subscription;

  /* Floor mirrors the CSS min-height; width floor matches the primary
     window MIN_WINDOW_WIDTH_PX so we don't react to transient sub-min
     drags. */
  readonly MIN_WIDTH_PX = 320;
  readonly MIN_HEIGHT_PX = 240;

  private _appState!:AppState;
  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}angular.png`;
  isMaximizable = true;
  name = 'hello';
  processId = 0;
  type = ComponentType.User;
  displayName = 'Hello';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService,windowService:WindowService,
              sessionManagementService:SessionManagementService ) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._sessionManagementService = sessionManagementService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe(() => {this.minimizeWindow()});
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
  }

  async ngAfterViewInit(): Promise<void> {
    //this.setTitleWindowToFocus(this.processId); 

    setTimeout(()=>{

    },this.SECONDS_DELAY) 

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
  }


  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.titleContent, this.processId, this.name, this.icon, this._windowService);
  }

  maximizeWindow():void{

    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      /* The host (.title) is already width:100%/height:100%, so the
         primary window's maximize animation reflows us for free. We
         just strip any inline px that an older pass may have written. */
      const host = this.titleContent?.nativeElement as HTMLElement | undefined;
      if(host){
        host.style.width = '';
        host.style.height = '';
      }
    }
  }

  /**
   * Restore-from-maximized. Mirror of maximizeWindow: clear any inline
   * sizes so the fluid CSS regains control.
   */
  minimizeWindow():void{
    const uId = `${this.name}-${this.processId}`;
    if(this._runningProcessService.getEventOriginator() !== uId) return;
    this._runningProcessService.removeEventOriginator();
    const host = this.titleContent?.nativeElement as HTMLElement | undefined;
    if(host){
      host.style.width = '';
      host.style.height = '';
    }
  }

  /**
   * Live drag-resize. Strip stale inline px so the host stays fluid.
   */
  onWindowResize():void{
    const host = this.titleContent?.nativeElement as HTMLElement | undefined;
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

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data as string,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }
  
  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      //
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}