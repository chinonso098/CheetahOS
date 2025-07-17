import { Component, ElementRef, AfterViewInit } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'cos-taskbar',
  templateUrl: './taskbar.component.html',
  styleUrls: ['./taskbar.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
    animations: [
    trigger('tskBarSlideStatusAnimation', [
      state('slideDown', style({ bottom: '-40px' })),
      state('slideUp', style({ bottom: '0px' })),

      transition('* => slideUp', [
        animate('0.3s ease-in')
      ]),
      transition('slideUp => slideDown', [
        animate('0.4s ease-out')
      ]),
    ])
  ]
})
export class TaskbarComponent implements AfterViewInit{

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _systemNotificationServices:SystemNotificationService;
  private _el: ElementRef;

  
  SECONDS_DELAY = 250;
  slideState = 'slideUp';

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbar';
  processId = 0;
  type = ComponentType.System
  displayName = ''

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
    systemNotificationServices:SystemNotificationService, el: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationServices = systemNotificationServices;
    this._el = el;
    
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

     // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destoryed
    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
    this._systemNotificationServices.showTaskBarNotify.subscribe(() => {this.showTaskBar()});
    this._systemNotificationServices.hideTaskBarNotify.subscribe(() => {this.hideTaskBar()});
  }

  
  ngAfterViewInit(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const tskBar = this._el.nativeElement;
      if(tskBar) {
        tskBar.style.position = '';
        tskBar.style.zIndex = '';
      }
    }, this.SECONDS_DELAY);
  }

  hideContextMenus():void{
    this._menuService.hideContextMenus.next();
  }

  showTaskBarContextMenu(evt:MouseEvent):void{
    if(this._runningProcessService.getEventOrginator() === Constants.EMPTY_STRING){
      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);
    
      this._menuService.showTaskBarConextMenu.next(evt);
    }

    evt.preventDefault();
  }

  lockScreenIsActive():void{
    const taskBarElmnt = document.getElementById('the-window-taskbar') as HTMLDivElement;
    if(taskBarElmnt){
      taskBarElmnt.style.opacity = '0';
    }
  }

  desktopIsActive():void{
    const taskBarElmnt = document.getElementById('the-window-taskbar') as HTMLDivElement;
    if(taskBarElmnt){
      taskBarElmnt.style.opacity = '1';
    }
  }

  showTaskBar():void{
    this.slideState = 'slideUp';
  }

  hideTaskBar():void{
    this.slideState = 'slideDown';
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
