import { Component, ElementRef, AfterViewInit, HostBinding } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { TooltipPositionInfo } from '../taskbarentries/taskbar.entries.type';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';

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
  private _defaultService!:DefaultService;
  private _el: ElementRef;

  isStartMenuVisible = false;
  isSearchWindowVisible = false;

  /**
   * When the "Transparency effects" setting is OFF the host gains the
   * `.solid-surface` class, which swaps the translucent/blurred taskbar
   * background for an opaque one. Default setting is OFF, so this starts true.
   */
  @HostBinding('class.solid-surface') isSolidSurface = false;

  /**
   * Exposes the taskbar surface color through the `--surface-color` custom
   * property. It is the accent color when "Show accent color on Start and
   * taskbar" is ON and a real accent color is chosen, and the default system
   * color otherwise. Translucency is controlled separately by `.solid-surface`.
   */
  @HostBinding('style.--surface-color') surfaceColor = Constants.DEFAULT_SYSTEM_COLOR;

  /**
   * Exposes the chosen accent color through the `--accent-color` custom property.
   * Unlike `--surface-color`, this always reflects the accent (independent of the
   * "Show accent color on Start and taskbar" toggle), falling back to the default
   * accent value when no real accent is set. Used for the Start button hover.
   */
  @HostBinding('style.--accent-color') accentColor = Constants.DEFAULT_ACCENT_COLOR_VALUE;

  /**
   * Delay (ms) before stripping the inline styles that the VANTA.js wallpaper
   * injects onto the host element. The wallpaper writes its styles slightly
   * after view init, so we wait before clearing them.
   */
  private readonly VANTA_STYLE_FIX_DELAY_MS = 250;

  /** Delay (ms) used when collapsing the search box so context menus close first. */
  private readonly SEARCH_HIDE_DELAY_MS = 250;

  slideState = 'slideUp';

  /**
   * Bound to the taskbar's opacity in the template so the lock-screen / desktop
   * toggles are model-driven instead of reaching into the DOM directly.
   */
  taskBarOpacity = 1;

  searchIcon = `${Constants.IMAGE_BASE_PATH}taskbar_search.png`;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbar';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
    systemNotificationServices:SystemNotificationService, el: ElementRef, defaultService:DefaultService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationService = systemNotificationServices;
    this._defaultService = defaultService;
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

    this.initTransparencyState();
  }

  /**
   * Reads the persisted "Transparency effects" setting and keeps the taskbar
   * surface in sync when it changes. OFF (default) -> opaque solid surface.
   */
  private initTransparencyState():void{
    this.isSolidSurface = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) !== Constants.TRUE;
    this.applySurfaceColor();
    this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
      if(key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT){
        this.isSolidSurface = this._defaultService.getDefaultSetting(key) !== Constants.TRUE;
      }
      if(key === Constants.DEFAULT_ACCENT_COLOR || key === Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR){
        this.applySurfaceColor();
      }
    });
  }

  /**
   * Computes the taskbar surface color: the accent color when the "Show accent
   * color on Start and taskbar" toggle is ON, otherwise the default system color.
   * The accent itself is always present, so it needs no None guard.
   */
  private applySurfaceColor():void{
    const showAccent = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR) === Constants.TRUE;
    const accent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
    this.surfaceColor = showAccent ? accent : Constants.DEFAULT_SYSTEM_COLOR;
    // The Start button hover always follows the accent, regardless of the surface toggle.
    this.accentColor = accent;
  }

  
  ngAfterViewInit(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const tskBar = this._el.nativeElement;
      if(tskBar) {
        tskBar.style.position = Constants.EMPTY_STRING;
        tskBar.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.VANTA_STYLE_FIX_DELAY_MS);
  }

  hideContextMenus():void{
    this._menuService.closeAllContextMenus(this.name);
  }

  showTaskBarContextMenu(evt:MouseEvent):void{
    evt.preventDefault();
    // Stop the event reaching the desktop <ol>, otherwise the desktop's own
    // right-click menu would open alongside the taskbar one. The menu is
    // rendered and owned by the desktop layer.
    evt.stopPropagation();
    this._menuService.showTaskBarConextMenu.next(evt);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  // Hide the taskbar while the lock screen is showing (model-driven opacity).
  lockScreenIsActive():void{
    this.taskBarOpacity = 0;
  }

  // Restore the taskbar once the desktop is active again.
  desktopIsActive():void{
    this.taskBarOpacity = 1;
  }

  showTaskBar():void{
    this.slideState = 'slideUp';
  }

  hideTaskBar():void{
    this.slideState = 'slideDown';
  }

  /**
   * Toggles the start menu. When opening, any open context menus are closed
   * first and we wait briefly so they animate out before the start menu shows.
   * Opening the start menu also closes the search box (they are mutually exclusive).
   */
  async showStartMenu(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
    const delay = 100;

    if(!this.isStartMenuVisible){
      // Open: let context menus close first, then reveal the start menu.
      this._menuService.closeAllContextMenus(this.name);
      await CommonFunctions.sleep(delay);

      this._menuService.showStartMenu.next();
      this.isStartMenuVisible = true;
    }else{
      // Close.
      this.isStartMenuVisible = false;
      this._menuService.hideStartMenu.next();
    }

    // The start menu and search box are mutually exclusive.
    if(this.isSearchWindowVisible)
      this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
  }

  changeStartMenuFlag():void{
    this.isStartMenuVisible = false;
  }

  /**
   * Toggles the search box. When it is already open we first close any open
   * context menus and wait briefly so they animate out before the search box
   * collapses. Opening it while the start menu is open also closes the start menu.
   */
  async hideShowSearch(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();

    if(this.isSearchWindowVisible){
      // Collapse: let context menus close first, then hide the search box.
      this._menuService.closeAllContextMenus(this.name);
      await CommonFunctions.sleep(this.SEARCH_HIDE_DELAY_MS);

      this.isSearchWindowVisible = false;
      this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
    }else{
      // Expand.
      this.isSearchWindowVisible = true;
      this._menuService.showSearchBox.next();
    }

    // The start menu and search box are mutually exclusive.
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
