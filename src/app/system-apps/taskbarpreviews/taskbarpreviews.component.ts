import { Component, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';

@Component({
  selector: 'cos-taskbarpreviews',
  templateUrl: './taskbarpreviews.component.html',
  styleUrl: './taskbarpreviews.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class TaskbarpreviewsComponent implements AfterViewInit, OnDestroy {

  private _runningProcessService:RunningProcessService;
  private _systemNotificationService:SystemNotificationService
  private _windowServices:WindowService;

  private _highLightTaskBarPreviewSub!: Subscription;
  private _unHighLightTaskBarPreviewSub!: Subscription;

  @Input() icon = '';
  @Input() name = '';
  @Input() imageData = '';
  @Input() pid = 0;

  appInfo = '';
  SECONDS_DELAY = 20;


  constructor(runningProcessService:RunningProcessService, windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._runningProcessService = runningProcessService
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;

    this._highLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewHighlightNotify.subscribe((p) => {this.highLightTasktBarPreview(p)});
    this._unHighLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewUnHighlightNotify.subscribe((p) => {this.unHighLightTasktBarPreview(p)});
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.shortAppInfo();
    }, this.SECONDS_DELAY);
  }

  ngOnDestroy(): void {
    this._highLightTaskBarPreviewSub?.unsubscribe();
    this._unHighLightTaskBarPreviewSub?.unsubscribe();
  }

  shortAppInfo():void{
    this.appInfo = this.name;
    const limit = 30;
    const ellipsis = '...';

    this.appInfo = (this.appInfo.length > limit) ? this.appInfo.substring(0, limit) + ellipsis : this.appInfo;
  }

  onClosePreviewWindow(pid:number):void{
    const processToClose = this._runningProcessService.getProcess(pid);
    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  keepTaskBarPreviewWindow():void{
    this._windowServices.keepProcessPreviewWindowNotify.next();
  }

  hideTaskBarPreviewWindowAndRestoreDesktop():void{
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this._windowServices.restoreProcessesWindowNotify.next();
  }

  showTaskBarPreviewContextMenu(evt:MouseEvent, pid:number):void{
    console.log('I will implement the TaskBarPreview Context Window.........later');
  }

  setWindowToFocusOnMouseHover(pid:number):void{
    this._windowServices.setProcessWindowToFocusOnMouseHoverNotify.next(pid);
    this.setCloseBtnColor(pid, false);
    this.setSvgIconColor(pid);
  }

  restoreWindowOnMouseLeave(pid:number):void{
    this._windowServices.restoreProcessWindowOnMouseLeaveNotify.next(pid);
    this.removeCloseBtnColor(pid);
  }

  showOrSetWindowToFocusOnClick(pid:number):void{
    const delay = 100; //100ms
    this.restoreWindowOnMouseLeave(pid);

    this.hideTaskBarPreviewWindowAndRestoreDesktop();

    setTimeout(() => {
      this._windowServices.showOrSetProcessWindowToFocusOnClickNotify.next(pid);
    }, delay);
  }


  setCloseBtnColor(pid:number, isBtnHover:boolean):void{
    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pid}`) as HTMLElement;
    if(closeBtnElmnt){
      closeBtnElmnt.style.backgroundColor = (isBtnHover)? 'rgb(232,17,35)' : 'black';
    }
  }

  setSvgIconColor(pid:number):void{
    const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pid}`) as HTMLElement; 
    if(svgIconElmnt){
      svgIconElmnt.style.fill = '#ababab';
    }
  }

  removeCloseBtnColor(pid:number):void{
    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pid}`) as HTMLElement;
    if(closeBtnElmnt){
      closeBtnElmnt.style.backgroundColor = '';
    }
  }

  highLightTasktBarPreview(uid: string): void {
    const pid = uid.split('-')[1];
    const tskBarPrevElmnt = document.getElementById(`tskBar-prev-${uid}`) as HTMLElement;
    if(tskBarPrevElmnt){
      tskBarPrevElmnt.style.backgroundColor = 'hsla(0,0%,25%,60%)';

      const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pid}`) as HTMLElement;
      if(closeBtnElmnt){
        closeBtnElmnt.style.backgroundColor = 'black';
      }

      const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pid}`) as HTMLElement; 
      if(svgIconElmnt){
        svgIconElmnt.style.fill = '#ababab';
      }
    }
  }

  unHighLightTasktBarPreview(uid:string):void{
    console.log(`highLightTasktBarPreview:${uid}`);
    const pid = uid.split('-')[1];
    const tskBarPrevElmnt = document.getElementById(`tskBar-prev-${uid}`) as HTMLElement;
    if(tskBarPrevElmnt){
      tskBarPrevElmnt.style.backgroundColor ='';
    }

    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pid}`) as HTMLElement;
    if(closeBtnElmnt){
      closeBtnElmnt.style.backgroundColor = '';
    }

    const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pid}`) as HTMLElement; 
    if(svgIconElmnt){
      svgIconElmnt.style.fill = '';
    }
  }

}
