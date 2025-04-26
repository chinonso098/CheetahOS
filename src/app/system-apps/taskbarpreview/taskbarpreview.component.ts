import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, OnDestroy} from '@angular/core';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TaskBarPreviewImage } from './taskbar.preview';
import { trigger, state, style, animate, transition } from '@angular/animations'
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'cos-taskbarpreview',
  templateUrl: './taskbarpreview.component.html',
  styleUrl: './taskbarpreview.component.css',
  animations: [
    trigger('fadeAnimation', [
      state('in', style({ opacity: 1 })),
      state('out', style({ opacity: 0 })),
      transition('* => in', [
        animate('0.30s ease-in')
      ]),
      transition('in => out', [
        animate('0.30s ease-out')
      ]),
    ])
  ]
})
export class TaskBarPreviewComponent implements OnChanges, AfterViewInit, OnDestroy {

  private _runningProcessService:RunningProcessService;
  private _systemNotificationService:SystemNotificationService
  private _windowServices:WindowService;

  private _highLightTaskBarPreviewSub!: Subscription;
  private _unHighLightTaskBarPreviewSub!: Subscription;

  @Input() name = '';
  @Input() icon = '';
  @Input() fadeState = '';

  componentImages!:TaskBarPreviewImage[];
  appInfo = '';
  SECONDS_DELAY = 250;

  constructor(runningProcessService:RunningProcessService, windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._runningProcessService = runningProcessService
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this.fadeState = 'in';

    this._highLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewHighlightNotify.subscribe((p) => {this.highLightTasktBarPreview(p)});
    this._unHighLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewUnHighlightNotify.subscribe((p) => {this.unHighLightTasktBarPreview(p)});
  }

  ngOnChanges(changes: SimpleChanges):void{
    1
    //console.log('PREVIEW onCHANGES:',changes);
    // console.log('this.name:',this.name);
    // console.log('this.fadeState:',this.fadeState);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.componentImages = this._windowServices.getProcessPreviewImages(this.name);
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
  }

  restoreWindowOnMouseLeave(pid:number):void{
    this._windowServices.restoreProcessWindowOnMouseLeaveNotify.next(pid);
    this.removeCloseBtnColor(pid);
  }

  showOrSetWindowToFocusOnClick(pid:number):void{
    this._windowServices.showOrSetProcessWindowToFocusOnClickNotify.next(pid);
  }


  setCloseBtnColor(pid:number, isBtnHover:boolean):void{
    const closeBtnElmnt = document.getElementById(`tskBar-prev-closeBtn-${pid}`) as HTMLElement;
    if(closeBtnElmnt){
      closeBtnElmnt.style.backgroundColor = (isBtnHover)? 'rgb(232,17,35)' : 'black';
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
    const delay = 5;
    const highlight = () => {
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
        return true;
      }
      return false;
    };
  
    if(!highlight()){
      const intervalId = setInterval(() => {
        if (highlight()) {
          clearInterval(intervalId);
        }
      }, delay); // checks every 5ms
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
