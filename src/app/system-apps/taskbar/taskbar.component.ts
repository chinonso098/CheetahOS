import { Component, ElementRef, AfterViewInit } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { TooltipPositionInfo } from '../taskbarentries/taskbar.entries.type';

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

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _menuService!:MenuService;
  private _systemNotificationService!:SystemNotificationService;
  private _el: ElementRef;

  isStartMenuVisible = false;
  isSearchWindowVisible = false;
  
  SECONDS_DELAY = 250;
  slideState = 'slideUp';

  searchIcon = `${Constants.IMAGE_BASE_PATH}taskbar_search.png`;
  hover = false;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbar';
  processId = 0;
  type = ComponentType.System
  displayName = Constants.EMPTY_STRING

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
    systemNotificationServices:SystemNotificationService, el: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationService = systemNotificationServices;
    this._el = el;
    
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

     // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destoryed
    this._systemNotificationService.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._systemNotificationService.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
    this._systemNotificationService.showTaskBarNotify.subscribe(() => {this.showTaskBar()});
    this._systemNotificationService.hideTaskBarNotify.subscribe(() => {this.hideTaskBar()});

    this._menuService.hideStartMenu.subscribe(() => { this.changeStartMenuFlag()});
    this._menuService.hideSearchBox.subscribe(() => { this.changeSearchFlag()});
  }

  
  ngAfterViewInit(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const tskBar = this._el.nativeElement;
      if(tskBar) {
        tskBar.style.position = Constants.EMPTY_STRING;
        tskBar.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.SECONDS_DELAY);
  }

  hideContextMenus():void{
    this._menuService.hideContextMenus.next(this.name);
  }

  showTaskBarContextMenu(evt:MouseEvent):void{
    if(this._runningProcessService.getEventOriginator() === Constants.EMPTY_STRING){
      const uId = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uId);
    
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

  async showStartMenu(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
    const delay = 100;

    if(!this.isStartMenuVisible){
      this._menuService.hideContextMenus.next(this.name);
      await CommonFunctions.sleep(delay);

      this._menuService.showStartMenu.next();
      this.isStartMenuVisible = true;
    }else{
      this.isStartMenuVisible = false;
      this._menuService.hideStartMenu.next();
    }

    if(this.isSearchWindowVisible)
      this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
  }

  changeStartMenuFlag():void{
    this.isStartMenuVisible = false;
  }

  async hideShowSearch(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();

    if(this.isSearchWindowVisible){
      this._menuService.hideContextMenus.next(this.name);
      await CommonFunctions.sleep(this.SECONDS_DELAY);

      this.isSearchWindowVisible = true;
      this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
    }else{
      this.isSearchWindowVisible = true;
      this._menuService.showSearchBox.next();
    }

    if(this.isStartMenuVisible){
      this.isStartMenuVisible = false;
      this._menuService.hideStartMenu.next();
    }
  }

  changeSearchFlag():void{
    this.isSearchWindowVisible = false
  }

  public showSearchWindowToolTip(): void {
    const elmntId = 'cheetah_search_btn';
    this.showTaskbarToolTip(elmntId, -30, 'Type here to search');
  }

  public showStartMenuToolTip(): void {
    const elmntId = 'cheetah_start_btn';
    this.showTaskbarToolTip(elmntId, 0, '  Start  ');
  }

  private showTaskbarToolTip(elementId: string, xOffset: number, text: string): void {
    const elmt = document.getElementById(elementId) as HTMLElement | null;
    if (!elmt) return;

    const rect = elmt.getBoundingClientRect();
    const data: TooltipPositionInfo = { left: rect.left + xOffset, top: rect.top, appName: text };

    this._systemNotificationService.showTaskBarToolTipNotify.next(data);
  }

  public hideToolTip():void{
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
