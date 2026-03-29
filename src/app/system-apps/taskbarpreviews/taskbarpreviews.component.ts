import { Component, Input, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-taskbarpreviews',
  templateUrl: './taskbarpreviews.component.html',
  styleUrl: './taskbarpreviews.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class TaskbarpreviewsComponent implements AfterViewInit, OnDestroy {

  private _runningProcessService!:RunningProcessService;
  private _systemNotificationService!:SystemNotificationService
  private _windowServices:WindowService;


  @Input() icon = Constants.EMPTY_STRING;
  @Input() name = Constants.EMPTY_STRING;
  @Input() imageData = Constants.EMPTY_STRING;
  @Input() pId = 0;

  appInfo = Constants.EMPTY_STRING;
  SECONDS_DELAY = 20;


  constructor(runningProcessService:RunningProcessService, windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._runningProcessService = runningProcessService
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;

    effect(() => {
      const p = this._systemNotificationService.taskBarPreviewHighlightNotify();
      if (p !== null) {
        this.highLightTasktBarPreview(p);
      }
    });

    effect(() => {
      const p = this._systemNotificationService.taskBarPreviewUnHighlightNotify();
      if (p !== null) {
        this.unHighLightTasktBarPreview(p);
      }
    });
  }

  async ngAfterViewInit(): Promise<void>{
    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.shortAppInfo();
  }

  ngOnDestroy(): void {
  }

  shortAppInfo():void{
    this.appInfo = this.name;
    const limit = 30;
    const ellipsis = '...';

    this.appInfo = (this.appInfo.length > limit) ? this.appInfo.substring(0, limit) + ellipsis : this.appInfo;
  }

  onClosePreviewWindow(pId:number):void{
    const processToClose = this._runningProcessService.getProcess(pId);
    this._runningProcessService.closeProcessNotify.set(processToClose);
  }

  keepTaskBarPreviewWindow():void{
    this._windowServices.keepProcessPreviewWindowNotify.update(v => v + 1);
  }

  hideTaskBarPreviewWindowAndRestoreDesktop():void{
    this._windowServices.hideProcessPreviewWindowNotify.update(v => v + 1);
    this._windowServices.restoreProcessesWindowNotify.update(v => v + 1);
  }

  showTaskBarPreviewContextMenu(evt:MouseEvent, pId:number):void{
    console.log('I will implement the TaskBarPreview Context Window.........later');
  }

  setWindowToFocusOnMouseHover(pId:number):void{
    this._windowServices.setProcessWindowToFocusOnMouseHoverNotify.set(pId);
    this.setCloseBtnColor(pId, false);
    this.setSvgIconColor(pId);
  }

  restoreWindowOnMouseLeave(pId:number):void{
    this._windowServices.restoreProcessWindowOnMouseLeaveNotify.set(pId);
    this.removeCloseBtnColor(pId);
  }

  async showOrSetWindowToFocusOnClick(pId:number): Promise<void>{
    const delay = 100; //100ms
    this.restoreWindowOnMouseLeave(pId);
    this.hideTaskBarPreviewWindowAndRestoreDesktop();

    await CommonFunctions.sleep(delay);
    this._windowServices.showOrSetProcessWindowToFocusOnClickNotify.set(pId);
  }


  setCloseBtnColor(pId:number, isBtnHover:boolean):void{
    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pId}`) as HTMLElement;
    if(!closeBtnElmnt) return;

    closeBtnElmnt.style.backgroundColor = (isBtnHover)? 'rgb(232,17,35)' : 'black';
  }

  setSvgIconColor(pId:number):void{
    const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pId}`) as HTMLElement; 
    if(!svgIconElmnt) return;

    svgIconElmnt.style.fill = '#ababab';
  }

  removeCloseBtnColor(pId:number):void{
    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pId}`) as HTMLElement;
    if(!closeBtnElmnt) return

    closeBtnElmnt.style.backgroundColor = '';
  }

  highLightTasktBarPreview(uId: string): void {
    const pId = uId.split(Constants.DASH)[1];
    const tskBarPrevElmnt = document.getElementById(`tskBar-prev-${uId}`) as HTMLElement;
    if(!tskBarPrevElmnt) return;

    tskBarPrevElmnt.style.backgroundColor = 'hsla(0,0%,25%,60%)';

    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pId}`) as HTMLElement;
    if(!closeBtnElmnt) return;

    closeBtnElmnt.style.backgroundColor = 'black';

    const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pId}`) as HTMLElement; 
    if(!svgIconElmnt) return;

    svgIconElmnt.style.fill = '#ababab';
  }

  unHighLightTasktBarPreview(uId:string):void{
    //console.log(`highLightTasktBarPreview:${uId}`);
    const pId = uId.split(Constants.DASH)[1];
    const tskBarPrevElmnt = document.getElementById(`tskBar-prev-${uId}`) as HTMLElement;
    if(!tskBarPrevElmnt) return;

    tskBarPrevElmnt.style.backgroundColor = Constants.EMPTY_STRING;

    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pId}`) as HTMLElement;
    if(!closeBtnElmnt) return;

    closeBtnElmnt.style.backgroundColor = Constants.EMPTY_STRING;

    const svgIconElmnt = document.getElementById(`tskBar-prev-svgIcon-${pId}`) as HTMLElement; 
    if(!svgIconElmnt)return;

    svgIconElmnt.style.fill = Constants.EMPTY_STRING;
  }

}
