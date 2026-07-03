import { Component, ElementRef, AfterViewInit, OnDestroy, HostBinding } from '@angular/core';
//import { animate, style, transition, trigger } from '@angular/animations';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

import { trigger, transition, style, animate, state, keyframes } from '@angular/animations';
import { Subscription } from 'rxjs';
import { applyEffect } from 'src/osdrive/Cheetah/System/Fluent Effect';
import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { DialogMessage } from 'src/app/shared/system-ui-components/dialog/dialog.types';

@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('slideStartMenuAnimation', [
      // Hidden (default)
      state('slideDown', style({
        bottom: '-540px',
        zIndex: -1,
      })),
  
      // Visible (open)
      state('slideUp', style({
        bottom: '0px',
        zIndex: 3,
      })),
  
      // --- Slide Up (Open) ---
      transition('* => slideUp', [
        // Prepare visible state first
        style({ zIndex: 3, bottom: '-540px' }),
  
        // Keyframe-based bounce animation
        animate(
          '550ms cubic-bezier(0.25, 1.25, 0.5, 1)',
          keyframes([
            style({ bottom: '-540px', offset: 0 }),
            style({ bottom: '5px', offset: 0.8 }),  // slight overshoot
            style({ bottom: '0px', offset: 1.0 })   // settle into place
          ])
        )
      ]),
  
      // --- Slide Down (Close) ---
      transition('slideUp => slideDown', [
        animate(
          '420ms cubic-bezier(0.4, 0, 0.2, 1)',
          keyframes([
            style({ bottom: '0px', offset: 0 }),
            style({ bottom: '-20px', offset: 0.8 }),
            style({ bottom: '-540px', offset: 1.0 })
          ])
        ),
        style({ zIndex: -1 })
      ]),
    ])
  ]
})

export class StartMenuComponent implements AfterViewInit, OnDestroy {
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _userNotificationService!:UserNotificationService;
  private _systemNotificationService!:SystemNotificationService;
  private _menuService!:MenuService;
  private _fileService!:FileService;
  private _elRef:ElementRef;
  // This is a never-destroyed system singleton: <cos-startmenu> sits statically in
  // DesktopComponent's template, and DesktopComponent lives for the whole page
  // lifetime. The constructor therefore subscribes exactly once and there is no
  // re-creation, so these streams are not a leak risk in normal use. We still keep
  // the Subscription handles so ngOnDestroy can tear them down as a safety net
  // (e.g. for tests, or if this component is ever hosted somewhere transient).
  private _showStartMenuSub!:Subscription;
  private _hideStartMenuSub!:Subscription;
  private _showLockScreenSub!:Subscription;
  private _showDesktopSub!:Subscription;
  private _transparencyChangeSub!:Subscription;

  /**
   * When the "Transparency effects" setting is OFF the host gains the
   * `.solid-surface` class, which swaps the translucent/blurred start-menu
   * panels for opaque ones. Default setting is OFF, so this starts true.
   */
  @HostBinding('class.solid-surface') isSolidSurface = false;

  /**
   * Exposes the start-menu surface color through the `--surface-color` custom
   * property. It is the accent color when "Show accent color on Start and
   * taskbar" is ON and a real accent color is chosen, and the default system
   * color otherwise. Translucency is controlled separately by `.solid-surface`.
   */
  @HostBinding('style.--surface-color') surfaceColor = Constants.DEFAULT_SYSTEM_COLOR;

  /**
   * Exposes the raw personalization accent color through the `--accent-color`
   * custom property. Unlike `--surface-color`, this ALWAYS carries the accent
   * color (the `DEFAULT_ACCENT_COLOR` value) regardless of the "Show accent
   * color" toggle or transparency, for elements that should always be tinted.
   */
  @HostBinding('style.--accent-color') accentColor = Constants.DEFAULT_ACCENT_COLOR_VALUE;

  // Animation state names consumed by the [@slideStartMenuAnimation] trigger in the template.
  private readonly SLIDE_UP = 'slideUp';
  private readonly SLIDE_DOWN = 'slideDown';

  // Current animation state bound in the template. The menu starts hidden (slid down).
  slideState = this.SLIDE_DOWN;

  isOverlayExpanded = false;
  delayStartMenuOverlayHideTimeoutId!: ReturnType<typeof setTimeout>;
  delayStartMenuOverlayShowTimeoutId!: ReturnType<typeof setTimeout>;
  // Guards the Fluent reveal effects so they are wired up only once (not on every hover).
  private hasAppliedRevealEffects = false;

  startMenuFiles:FileInfo[] = [];
  // Delay (in milliseconds) before stripping the VANTA.js inline styles off our host element.
  private VANTA_CLEANUP_DELAY_MS = 250;
  // Delay (in milliseconds) before moving focus into the menu, so it lands after
  // the open animation has started and the menu is no longer inert.
  private FOCUS_ON_OPEN_DELAY_MS = 200;
  readonly START_MENU_DIRECTORY ='/AppData/StartMenu';
  readonly Documents= 'Documents';
  readonly Pictures = 'Pictures';
  readonly Videos = 'Videos';

  hamburgerMenuImg = `${Constants.IMAGE_BASE_PATH}sm_hamburger_menu.png`;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, processHandlerService:ProcessHandlerService,
               elRef: ElementRef, fileService:FileService, userNotificationService:UserNotificationService,
               menuService:MenuService, systemNotificationService:SystemNotificationService, private _defaultService:DefaultService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;
    this._fileService = fileService;
    this._processHandlerService = processHandlerService ;
    this._userNotificationService = userNotificationService;
    this._systemNotificationService = systemNotificationService;
    this._menuService = menuService;

    this.processId = this._processIdService.getNewProcessId();
    if(this._runningProcessService.getProcesses().findIndex(x => x.getProcessName === this.name) === -1){
      this._runningProcessService.addProcess(this.getComponentDetail());
    }

    this._showStartMenuSub = this._menuService.showStartMenu.subscribe(() => {this.showStartMenu()});
    this._hideStartMenuSub = this._menuService.hideStartMenu.subscribe(() => {this.hideStartMenu()});

    this._showLockScreenSub = this._systemNotificationService.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._showDesktopSub = this._systemNotificationService.showDesktopNotify.subscribe(() => {this.desktopIsActive()});

    this.initTransparencyState();
  }

  /**
   * Reads the persisted "Transparency effects" setting and keeps the start-menu
   * surfaces in sync when it changes. OFF (default) -> opaque solid surfaces.
   */
  private initTransparencyState():void{
    this.isSolidSurface = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) !== Constants.TRUE;
    this.applySurfaceColor();
    this._transparencyChangeSub = this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
      if(key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT){
        this.isSolidSurface = this._defaultService.getDefaultSetting(key) !== Constants.TRUE;
      }
      if(key === Constants.DEFAULT_ACCENT_COLOR || key === Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR){
        this.applySurfaceColor();
      }
    });
  }

  /**
   * Computes the start-menu surface color: the accent color when the "Show
   * accent color on Start and taskbar" toggle is ON, otherwise the default
   * system color. The accent color always has a default, so it's used directly.
   */
  private applySurfaceColor():void{
    const showAccent = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR) === Constants.TRUE;
    const accent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
    this.surfaceColor = showAccent ? accent : Constants.DEFAULT_SYSTEM_COLOR;
    this.accentColor = accent;
  }

  ngOnDestroy(): void {
    // SAFETY NET ONLY: in normal use this never runs, because the component is a
    // never-destroyed singleton (see the subscription fields above). It exists so
    // that any transient host (e.g. a test harness) still cleans up correctly.
    this._showStartMenuSub?.unsubscribe();
    this._hideStartMenuSub?.unsubscribe();
    this._showLockScreenSub?.unsubscribe();
    this._showDesktopSub?.unsubscribe();
    this._transparencyChangeSub?.unsubscribe();

    // Cancel any pending overlay slide timers so they cannot fire after teardown.
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);

    console.log(`StartMenuComponent (processId: ${this.processId}) destroyed and unsubscribed from all streams.`);
  }

  async ngAfterViewInit():Promise<void>{
    const delay = 1500; //1.5secs
    await CommonFunctions.sleep(delay);
    await this.loadFilesInfoAsync();
    this.removeVantaJSSideEffect();
  }

  /**
   * NOTE:This method is temporary for the start menu
   */
  removeVantaJSSideEffect(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = Constants.EMPTY_STRING;
        elfRef.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.VANTA_CLEANUP_DELAY_MS);
  }

  showStartMenu():void{
    this.slideState = this.SLIDE_UP;
    // Tell the rest of the system the menu now owns keyboard navigation so the
    // desktop icon grid stops reacting to the same keys (see MenuService).
    this._menuService.isStartMenuOpen = true;

    // Once the open animation has begun, move keyboard focus into the menu so it
    // can be driven entirely from the keyboard (arrow keys, Enter, Escape).
    setTimeout(() => this.focusFirstAppButton(), this.FOCUS_ON_OPEN_DELAY_MS);
  }

  hideStartMenu():void{
    this.slideState = this.SLIDE_DOWN;
    // Release keyboard ownership back to the desktop / open windows.
    this._menuService.isStartMenuOpen = false;
  }

  /**
   * True while the start menu is open (slid up). Bound to the `inert` attribute in
   * the template so the menu's controls are skipped by Tab and assistive tech
   * while the menu is closed/off-screen.
   */
  get isMenuOpen(): boolean {
    return this.slideState === this.SLIDE_UP;
  }

  /**
   * Top-level keyboard handler for the menu. Pressing Escape closes the menu via
   * the shared menu stream (which also keeps other listeners, e.g. the
   * notification center, in sync).
   */
  onMenuKeydown(evt: KeyboardEvent): void {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      this._menuService.hideStartMenu.next();
    }
  }

  /**
   * Roving keyboard navigation for the app list. Arrow Up/Down move focus between
   * app buttons (wrapping around), Home/End jump to the first/last app. Enter and
   * Space are handled natively by the <button> elements.
   */
  onAppListKeydown(evt: KeyboardEvent): void {
    const navigationKeys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navigationKeys.includes(evt.key)) {
      return;
    }

    // Stop the arrow keys from also scrolling the app list container.
    evt.preventDefault();

    const buttons = this.getAppButtons();
    if (buttons.length === 0) {
      return;
    }

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = 0;

    switch (evt.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
    }

    buttons[nextIndex]?.focus();
  }

  /** Keyboard activation (Enter/Space) for a left-rail folder shortcut. */
  onFolderKeydown(folderName: string, evt: Event): void {
    // Prevent Space from scrolling the page before we open the folder.
    evt.preventDefault();
    this.openFolderPath(folderName, evt);
  }

  /** Keyboard activation (Enter/Space) for the left-rail power button. */
  onPowerKeydown(evt: Event): void {
    evt.preventDefault();
    this.power(evt);
  }

  /**
   * Moves keyboard focus into the menu when it opens. Prefers the first app
   * button; if the app list hasn't populated yet it falls back to the app-list
   * container (which is focusable via tabindex="-1"). Either way the start menu
   * takes DOM focus, which is what makes the focus-gated desktop icon navigation
   * stand down — so the two no longer fight over the arrow keys.
   */
  private focusFirstAppButton(): void {
    const firstButton = this.getAppButtons()[0];
    if (firstButton) {
      firstButton.focus();
      return;
    }

    const appList = this._elRef.nativeElement.querySelector('.start-menu-list-ol') as HTMLElement | null;
    appList?.focus();
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

  /** Returns the app-list launch buttons in DOM order. */
  private getAppButtons(): HTMLButtonElement[] {
    return Array.from(
      this._elRef.nativeElement.querySelectorAll('.start-menu-list-btn')
    ) as HTMLButtonElement[];
  }

  private applyHighlightEffects(): void {

    // App list reveal: subtle Windows 10 style
    applyEffect('.start-menu-list-ol', {
      clickEffect: true,
      lightColor: 'rgba(255,255,255,0.10)',
      gradientSize: 35,
      isContainer: true,
      children: {
        borderSelector: '.start-menu-list-li',
        elementSelector: '.start-menu-list-btn',
        lightColor: 'rgba(255,255,255,0.22)',
        gradientSize: 120
      }
    });

    // Left rail reveal: highlight corners/edges when pointer is near
    applyEffect('.start-menu-main-overlay-icon-text-container', {
      clickEffect: false,
      lightColor: 'rgba(255,255,255,0.10)',
      gradientSize: 45,
      isContainer: true,
      children: {
        borderSelector: '.start-menu-main-overlay-icon-text-content',
        elementSelector: '.start-menu-main-overlay-icon-text-content',
        lightColor: 'rgba(255,255,255,0.20)',
        gradientSize: 110
      }
    });
  }

  // Show Overlay Function
  startMenuOverlaySlideOut(): void {
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);

    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    if (!smIconTxtOverlay) return;

    this.delayStartMenuOverlayShowTimeoutId = setTimeout(() => {
      smIconTxtOverlay.style.boxShadow = '2px 0 12px rgba(0, 0, 0, 0.18)';
      smIconTxtOverlay.style.width = '248px';
      this.isOverlayExpanded = true;
    }, 120);
  }

  lockScreenIsActive():void{
    const startMenuElmnt = document.getElementById('the-window-startmenu') as HTMLDivElement;
    if(startMenuElmnt){
      startMenuElmnt.style.opacity = '0';
    }

    this.hideStartMenu();
  }

  desktopIsActive():void{
    const startMenuElmnt = document.getElementById('the-window-startmenu') as HTMLDivElement;
    if(startMenuElmnt){
      startMenuElmnt.style.opacity = '1';
    }
  }

  
  // Hide Overlay Function
  startMenuOverlaySlideIn(): void {
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);

    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    if (!smIconTxtOverlay) return;

    this.delayStartMenuOverlayHideTimeoutId = setTimeout(() => {
      this.isOverlayExpanded = false;
      smIconTxtOverlay.style.width = '48px';
      smIconTxtOverlay.style.boxShadow = 'none';
    }, 90);
  }

  onBtnHover():void{
    // The Fluent reveal effect attaches DOM listeners, so wire it up only once.
    if (this.hasAppliedRevealEffects) {
      return;
    }

    this.applyHighlightEffects();
    this.hasAppliedRevealEffects = true;
  }

  private async loadFilesInfoAsync():Promise<void>{
    this.startMenuFiles = [];
    //this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.loadDirectoryFiles(this.START_MENU_DIRECTORY);
    this.startMenuFiles.push(...directoryEntries)
  }

  async runProcess(file:FileInfo, evt:Event):Promise<void>{
    evt.stopPropagation();

    // Allow any click animations to play before the start menu closes.
    const app_startup_delay = 450;

    // Emitting on the shared stream both closes this menu (via our hideStartMenu
    // subscription) and notifies other listeners (e.g. the notification center),
    // so an explicit this.hideStartMenu() call here would be redundant.
    this._menuService.hideStartMenu.next();

    await CommonFunctions.sleep(app_startup_delay);
    this._processHandlerService.runApplication(file);
  }

  async openFolderPath(folderName:string, evt:Event):Promise<void>{
   const path = `/Users/${folderName}`;

   const file = new FileInfo();
   file.setFileName = folderName;
   file.setOpensWith = Constants.FILE_EXPLORER;
   file.setIsFile = false;
   file.setCurrentPath = path;

   await this.runProcess(file, evt);
  }

  power(evt:Event):void{
    evt.stopPropagation();

    this.hideStartMenu();
    this._userNotificationService.showPowerOnOffNotification(DialogMessage.SHUT_DOWN_CHEETAH);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
