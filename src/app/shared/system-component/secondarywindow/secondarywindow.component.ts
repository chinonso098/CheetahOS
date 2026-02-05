import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';

import { MenuService } from '../../system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import {Subscription } from 'rxjs';
import { ClampedPosition, WindowState  } from '../window/windows.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowPositionInfo } from 'src/app/system-files/common.interfaces';


@Component({
  selector: 'cos-secondarywindow',
  templateUrl: './secondarywindow.component.html',
  styleUrl: './secondarywindow.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
 export class SecondaryWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('secondaryWindowContainer') secondaryWindowContainer!: ElementRef;
   @ViewChild('secglassPaneContainer') secglassPaneContainer!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = Constants.EMPTY_STRING;  
   @Input() displayMessage = Constants.EMPTY_STRING;  
   @Input() processAppName = Constants.EMPTY_STRING;  
   @Input() isDialog = false;  

   private _runningProcessService!:RunningProcessService;
   private _systemNotificationServices!:SystemNotificationService;
   private _windowService!:WindowService;
   private _originalWindowsState!:WindowState;
   private _menuService!:MenuService;
   private _processHandlerService!:ProcessHandlerService;
   private _userNotificationServices:UserNotificationService;

   private _focusOnNextProcessSub!:Subscription;
   private _focusOnCurrentProcessSub!:Subscription;
   private _showOnlyCurrentProcessSub!:Subscription;
   private _removeFocusOnOtherProcessesSub!:Subscription;
   private _hideOtherProcessSub!:Subscription;
   private _restoreProcessSub!:Subscription;
   private _restoreProcessesSub!:Subscription;
   private _showOrSetProcessWindowToFocusSub!:Subscription;
   private _lockScreenActiveSub!:Subscription;
   private _desktopActiveSub!:Subscription;
   private _showTheDesktopSub!:Subscription;
   private _showOpenWindowsSub!:Subscription;
   private _closeCurrentProcessSub!:Subscription;
   private _positionWindowSub!:Subscription;
   private _positionWindowByIdSub!:Subscription;

  readonly HIDDEN_Z_INDEX = 0;
  readonly MIN_Z_INDEX = 1;
  readonly MAX_Z_INDEX = 2;
  readonly TMP_MAX_Z_INDEX = 3;
  readonly WIN_TOP_PX = 40;
  readonly WIN_LEFT_PX = 40;
  readonly CASCADE_STEP_PX = 24;
  readonly TASKBAR_HEIGHT_PX = 40;
  readonly EDGE_PAD_PX = 8;

  windowHide = false;
  windowMaximize = false;

  windowTopPx = 0;
  windowLeftPx = 0;
  windowWidthPx = 0;
  windowHeightPx = 0;

  windowZIndex = '0';
  strWindowWidthPx = '0px';
  strWindowHeightPx = '0px';


  xAxisTmp = 0;
  yAxisTmp = 0;

  windowTop = 0;
  windowLeft = 0;
  windowTransform = Constants.EMPTY_STRING;

  isDialogContent = false;
  currentWinStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};
  defaultWidthOnOpen = 0;
  defaultHeightOnOpen = 0;

  hasWindow = false;
  icon = Constants.EMPTY_STRING;
  name = 'Window';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  uniqueGPId = Constants.EMPTY_STRING;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, private renderer: Renderer2,
                windowService:WindowService, systemNotificationServices:SystemNotificationService, menuService: MenuService, 
                controlProcessService:ProcessHandlerService, notificationServices:UserNotificationService){
      this._runningProcessService = runningProcessService;
      this._windowService = windowService;
      this._systemNotificationServices = systemNotificationServices;
      this._menuService = menuService;
      this._processHandlerService = controlProcessService;
      this._userNotificationServices = notificationServices;
 
      this._focusOnNextProcessSub = this._windowService.focusOnNextProcessWindowNotify.subscribe((p) => {this.setWindowToFocusByPid(p)});
      this._focusOnCurrentProcessSub = this._windowService.focusOnCurrentProcessWindowNotify.subscribe((p) => { this.setFocsuOnThisWindow(p)});
      this._removeFocusOnOtherProcessesSub = this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindowNotMatchingPid(p)});
      this._showOnlyCurrentProcessSub = this._windowService.setProcessWindowToFocusOnMouseHoverNotify.subscribe((p) => {this.setWindowToFocusOnMouseHover(p)});
      this._hideOtherProcessSub = this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.hideWindowNotMatchingPidOnMouseHover(p)});
      this._restoreProcessSub = this._windowService.restoreProcessWindowOnMouseLeaveNotify.subscribe((p) => {this.restoreWindowOnMouseLeave(p)});
      this._restoreProcessesSub = this._windowService.restoreProcessesWindowNotify.subscribe(() => {this.restorePriorFocusOnWindows()});

      this._lockScreenActiveSub = this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
      this._desktopActiveSub = this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});

      this._showOrSetProcessWindowToFocusSub = this._windowService.showOrSetProcessWindowToFocusOnClickNotify.subscribe((p) => {this.showOrSetProcessWindowToFocusOnClick(p)});
      this._closeCurrentProcessSub = this._windowService.closeWindowProcessNotify.subscribe((p) => {
          if(this.processId === p){
            this.closeWindow();
          }});

      this._showTheDesktopSub = this._menuService.showTheDesktop.subscribe(() => {this.setHideAndShowAllVisibleWindows()});
      this._showOpenWindowsSub = this._menuService.showOpenWindows.subscribe(() => {this.setHideAndShowAllVisibleWindows()});

      this._positionWindowSub = this._windowService.positionProcessWindowNotify.subscribe((p) => {
        if(p.pId === this.processId)
          this.onPositionWindow(p)
      });

      this._positionWindowByIdSub = this._windowService.positionProcessWindowByIdNotify.subscribe((p) => {
        if(Number(p[0]) === this.processId)
          this.onPositionWindowById(p)
      });
    }

    get getMainWindowContainerElmnt(): HTMLElement {
      return this.secondaryWindowContainer.nativeElement;
    }

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);

      if(this.name === "Window")
        this.name = this.processAppName;

      this.icon = this.processAppIcon;
      if(this.isDialog)
      { this.displayName = this.displayMessage; }
      else
      { this.displayName = this.processAppName;}
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.isDialogContent = this.isDialog;
    
      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      setTimeout(() => {
        this.setFocusOnWindowInit(this.processId)
      }, 0);

      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();


      // get defaultHeightOnOpen and defaultWidthOnOpen  
      this.windowHeightPx = this.getMainWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getMainWindowContainerElmnt.offsetWidth;
      this.applySizeStyles();

      this.storeWindowStateAfterViewInit();

      //tell angular to run additional detection cycle after 
      this.changeDetectorRef.detectChanges();  
    }

    ngOnDestroy():void{
      this._closeCurrentProcessSub?.unsubscribe();
      this._focusOnNextProcessSub?.unsubscribe();
      this._focusOnCurrentProcessSub?.unsubscribe();
      this._removeFocusOnOtherProcessesSub?.unsubscribe();
      this._showOnlyCurrentProcessSub?.unsubscribe();
      this._hideOtherProcessSub?.unsubscribe();
      this._restoreProcessSub?.unsubscribe();
      this._restoreProcessesSub?.unsubscribe();
      this._showOrSetProcessWindowToFocusSub?.unsubscribe();
      this._lockScreenActiveSub?.unsubscribe();
      this._desktopActiveSub?.unsubscribe();
      this._showTheDesktopSub?.unsubscribe();
      this._showOpenWindowsSub?.unsubscribe();
      this._positionWindowSub?.unsubscribe();
      this._positionWindowByIdSub?.unsubscribe();
    }

    setBtnFocus(pId:number):void{
        if(this.processId === pId){
          this.closeBtnStyles = {
            'background-color':'rgb(139,10,20)'
          };
        }
    }

    setHeaderInActive(pId:number):void{
      if(this.processId === pId){
        this.headerActiveStyles = {
          'background-color':'hsla(0, 0%, 85%, 1)'
        };
      }
    }

    setHeaderActive(pId:number):void{
      if(this.processId === pId){
        this.headerActiveStyles = {
          'background-color':'hsla(0, 0%, 100%, 1)'
        };
      }
    }

    storeWindowStateAfterViewInit():void{
      const clamped = this.computeClampedPosition(this.windowLeftPx, this.windowTopPx, this.windowWidthPx, this.windowHeightPx);
      if(!clamped){
        console.warn('Clamped in undefined');
        return;
      }

      this.windowLeftPx = clamped.leftPx;
      this.windowTopPx  = clamped.topPx;
      this.applyPositionStyles();

      this._originalWindowsState = {
        appName: this.name,
        pId: this.processId,
        width: this.windowWidthPx,
        height: this.windowHeightPx,
        leftPx: clamped.leftPx,
        topPx: clamped.topPx,
        zIndex: this.MIN_Z_INDEX,   // placeholder, service will normalize
        isVisible: true,
      };

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();

    }

 private getDesktopRect(): DOMRect | null {
      const el = document.getElementById('vantaCntnr') as HTMLElement | null;
      return el ? el.getBoundingClientRect() : null;
    }

    private clamp(n: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, n));
    }

    private computeClampedPosition(leftPx: number, topPx: number, width: number, height: number): ClampedPosition | undefined{
      const desktop = this.getDesktopRect();

      if(!desktop){
        console.warn('Computing clamped position failed, desktop is undefined');
         return;
      }
      const maxLeft = Math.max(0, desktop.width - width);
      const maxTop  = Math.max(0, desktop.height - this.TASKBAR_HEIGHT_PX - height);

      return {
        leftPx: this.clamp(leftPx, 0, maxLeft),
        topPx: this.clamp(topPx, 0, maxTop),
      };
    }

    private clampToContainer(): void {
      const desktop = this.getDesktopRect();
      const winEl = this.secondaryWindowContainer?.nativeElement as HTMLElement | undefined;
      if (!desktop || !winEl) return;

      const winRect = winEl.getBoundingClientRect();
      const pad = this.EDGE_PAD_PX;

      const maxLeft = Math.max(pad, desktop.width - winRect.width - pad);
      const maxTop  = Math.max(pad, desktop.height - this.TASKBAR_HEIGHT_PX - winRect.height - pad);

      this.windowLeftPx = Math.min(Math.max(this.windowLeftPx, pad), maxLeft);
      this.windowTopPx  = Math.min(Math.max(this.windowTopPx, pad), maxTop);
    }

    private applyOpacityZ(zIndex: number, opacity: number): void {
      this.currentWinStyles = {
        ...this.currentWinStyles,
        left: `${this.windowLeftPx}px`,
        top: `${this.windowTopPx}px`,
        transform: 'translate(0px, 0px)',
        'z-index': zIndex,
        opacity
      };
    }

    private applyPositionStyles(): void {
      this.currentWinStyles = {
        ...this.currentWinStyles,
        left: `${this.windowLeftPx}px`,
        top: `${this.windowTopPx}px`,
        transform: 'translate(0px, 0px)', // keep draggable neutral
        'z-index': this.windowHide ? this.HIDDEN_Z_INDEX : this.windowZIndex,
        opacity: this.windowHide ? 0 : 1,
      };
    }

    private syncStatePositionSize(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws) return;

      ws.leftPx = this.windowLeftPx;
      ws.topPx = this.windowTopPx;
      ws.width = this.windowWidthPx;
      ws.height = this.windowHeightPx;
      ws.zIndex = Number(this.windowZIndex);

      this._windowService.addWindowState(ws);
    }

    private applySizeStyles(): void {
      this.strWindowHeightPx = `${this.windowHeightPx}px`;
      this.strWindowWidthPx =  `${this.windowWidthPx}px`;
    }

    showSilhouette(pId: number): void {
      if (this.processId === pId) {
        this.showGlassPaneContainer();
        const glassPane = document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if (glassPane) {
          glassPane.style.display = 'block';
          glassPane.style.zIndex = String(this.MIN_Z_INDEX);
          this.positionSilhouette();
        }
      }
    }

    private positionSilhouette(): void {
      const glassPane = document.getElementById(this.uniqueGPId) as HTMLDivElement;
      if (!glassPane) return;

      glassPane.style.position = 'absolute';
      glassPane.style.left = `${this.windowLeftPx}px`;
      glassPane.style.top = `${this.windowTopPx}px`;
      glassPane.style.transform = 'translate(0px, 0px)';
    }

    showGlassPaneContainer() {
      this.renderer.setStyle(this.secglassPaneContainer.nativeElement, 'display', 'block');
    }

    hideSilhouette(pId:number):void{
      if(this.processId === pId){
        this.hideGlassPaneContainer();
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if(glassPane){
          glassPane.style.display = 'none';
          glassPane.style.zIndex = String(this.HIDDEN_Z_INDEX);
        }
      }
    }

    hideGlassPaneContainer() {
      this.renderer.setStyle(this.secglassPaneContainer.nativeElement, 'display', 'none');
    }

    removeSilhouette(pId:number):void{
      if(this.processId === pId){
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if (glassPane) {
          glassPane.remove();
        } 
      }
    }

    updateWindowZIndex(window: WindowState, zIndex:number):void{
      if (this.processId === window.pId) {
        this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
        window.zIndex = zIndex;
        this._windowService.addWindowState(window);
      }
    }

    setWindowToPriorHiddenState(window: WindowState, zIndex: number): void {
      if (this.processId === window.pId) {
        this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
      }
    }

    onMouseDown(pId:number):void{
      this._windowService.windowDragIsActive.next();
      this.setFocsuOnThisWindow(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
    }

    onDragEnded(event: CdkDragEnd): void {

      // CDK gives a clean delta since drag started
      const delta = event.distance;

      // Commit delta into absolute left/top
      this.windowLeftPx += delta.x;
      this.windowTopPx  += delta.y;

      // Clamp, apply, sync
      this.clampToContainer();
      this.applyPositionStyles();
      this.syncStatePositionSize();
      this.positionSilhouette();


      // Important: reset the drag transform so we don't accumulate drift
      event.source.reset();
      this._windowService.windowDragIsInActive.next();
    }

    onPositionWindow(input:WindowPositionInfo):void{
      // If you still receive % from elsewhere, convert it to px here.
      const rect = this.getDesktopRect();
      if (!rect) return;

      this.windowLeftPx = Math.round(input.leftPx);
      this.windowTopPx  = Math.round(input.topPx);

      this.clampToContainer();
      this.applyPositionStyles();
      this.syncStatePositionSize();
      this.positionSilhouette();
    }

    // onPositionWindowById(input:string[]):void{
    //   const callingWindowId = input[1];
    //   const windowElmnt = document.getElementById(`wincmpnt-${callingWindowId}`) as HTMLElement;
    //   const dialogWindowElmnt = document.getElementById(`secWinCmpnt-${this.uniqueId}`) as HTMLElement;
    //   //const windowState  = this._windowService.getWindowStates().find(p => p.pId === this.processId);

    //   if(!windowElmnt) return;
    //   const winRect = windowElmnt.getBoundingClientRect();

    //   if(!dialogWindowElmnt) return;

    //   this.windowTop = winRect.y + (winRect.height /2);
    //   this.windowLeft = winRect.x + (winRect.width / 2);
    //   this.windowTransform = 'translate(-50%, -50%)';

    //   /**
    //    * in testing, using currentWinStyles was slower, but a minute yet noticeable diff. hence it is not used
    //    * Also, This slight delay is added due to timinig issue
    //    */
    //   setTimeout(() => {
    //     // dialogWindowElmnt.style.zIndex = '2';
    //     dialogWindowElmnt.style.left = `${this.windowLeft}px`;
    //     dialogWindowElmnt.style.top = `${this.windowTop}px`;
    //     dialogWindowElmnt.style.transform = this.windowTransform;
    //   }, 0);
    // }



    onPositionWindowById(input: string[]): void {
      // Expected input shape: [something, callingWindowId]
      const callingWindowId = input?.[1];
      if (!callingWindowId) return;

      const desktopEl = document.getElementById('vantaCntnr') as HTMLElement | null;
      if (!desktopEl) return;

      const targetEl = document.getElementById(`wincmpnt-${callingWindowId}`) as HTMLElement | null;
      if (!targetEl) return;

      // Convert viewport coordinates -> desktop-relative coordinates
      const desktopRect = desktopEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const targetCenterLeft = (targetRect.left - desktopRect.left) + (targetRect.width / 2);
      const targetCenterTop  = (targetRect.top  - desktopRect.top)  + (targetRect.height / 2);

      // Position THIS window so its center aligns with target center
      // (left/top represent the window's top-left corner)
      this.windowLeftPx = Math.round(targetCenterLeft - (this.windowWidthPx / 2));
      this.windowTopPx  = Math.round(targetCenterTop  - (this.windowHeightPx / 2));

      // Clamp + commit to styles/state
      this.clampToContainer();
      this.applyPositionStyles();
      this.syncStatePositionSize();
      this.positionSilhouette();

      // Optional: bring to focus if that's the desired behavior
      this.setFocsuOnThisWindow(this.processId);
      this._windowService.currentProcessInFocusNotify.next(this.processId);
    }


    setHideAndShowAllVisibleWindows():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws) return;

      this.windowHide = !this.windowHide;
      // CSS styles: set per current state of component properties

      if(ws.isVisible && this.windowHide && (ws.pId === this.processId)){
        ws.isVisible = false;
        ws.zIndex = this.HIDDEN_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);

        this.setHeaderInActive(ws.pId);
        this.applyOpacityZ(this.HIDDEN_Z_INDEX, 1)
      }
      else if(!ws.isVisible && !this.windowHide && (ws.pId === this.processId)){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();

        if(windowList.includes(this.processId)){

          ws.isVisible = true;
          this._windowService.addWindowState(ws);

          const window_with_highest_zIndex = this._windowService.getProcessWindowIDWithHighestZIndex();
          if(window_with_highest_zIndex === this.processId){
            this.setFocsuOnThisWindow(ws.pId);
            this._windowService.currentProcessInFocusNotify.next(ws.pId);
          }else{
            this.setWindowToPriorHiddenState(ws, this.MIN_Z_INDEX);
          }
        }
      }
    }

    resetHideShowWindowsList():void{
      this._windowService.resetHiddenOrVisibleWindowsList();
      this._menuService.updateTaskBarContextMenu.next();
    }

     createSilhouette():void{
      this.uniqueGPId = `bgp-${this.uniqueId}`;
      //Every window has a hidden glass pane that is revealed when the window is hidden
      const glassPane = this.renderer.createElement('div');

      // Add attributes
      glassPane.setAttribute('id', this.uniqueGPId);

      glassPane.style.transform =  'translate(0, 0)';
      glassPane.style.height =  `${this.defaultHeightOnOpen}px`;
      glassPane.style.width =  `${this.defaultWidthOnOpen}px`;

      glassPane.style.zIndex =  String(this.HIDDEN_Z_INDEX);
      glassPane.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
      glassPane.style.backdropFilter = 'blur(2px)';
      glassPane.style.display =  'none';

      // Append to the body
      this.renderer.appendChild(this.secglassPaneContainer.nativeElement, glassPane);
    }

    onCloseBtnClick():void{
      this.closeWindow();
    }

    closeWindow():void{
      this._windowService.removeWindowState(this.processId);
      this.removeSilhouette(this.processId);

      if(!this.isDialogContent){ // if it is visible, then the window is not a dialog box
        const processToClose = this._runningProcessService.getProcess(this.processId);
        if(processToClose){
          this._processHandlerService.closeApplicationProcess(processToClose);
        }
      }else{ 
        this._userNotificationServices.closeDialogMsgBox(this.processId);
      }
      this._windowService.cleanUp(this.uniqueId);
      const nextProc = this.getNextProcess();
      if(nextProc){
        this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
        this._windowService.currentProcessInFocusNotify.next(nextProc.getProcessId);
      }
    }

    setFocsuOnThisWindow(pId:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */
      const uId = `${this.name}-${pId}`;
      if((this.uniqueId === uId) && (!this.windowHide)){
        this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);

        this.setWindowToFocusById(pId);
      }
    }

    setFocusOnWindowInit(pId:number):void{
      this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);

      this.setHeaderActive(pId);
    }

    setWindowToFocusOnMouseHover(pId:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */
      this._windowService.hideOtherProcessesWindowNotify.next(pId);
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();
      
      if(this.processId === pId){
        if(pId === pid_with_highest_z_index)
            this.setHeaderActive(pId);

        this.hideSilhouette(pId);
        this.showOnlyWindowById(pId);
      }
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindowNotMatchingPid(pId:number):void{
      if(this.processId !== pId){
        const windowState = this._windowService.getWindowState(this.processId);
        if(windowState && windowState.isVisible){
          this.setHeaderInActive(windowState.pId);
          this.updateWindowZIndex(windowState, this.MIN_Z_INDEX);
        }
      }
    }

    restorePriorFocusOnWindows():void{
      const processWithWindows = this._windowService.getWindowStates();
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();

      for(let i = 0; i < processWithWindows.length; i++){
        const windowState = processWithWindows[i];          
        if(windowState && windowState.isVisible){
          if(windowState.pId !== pid_with_highest_z_index ){
            this.setHeaderInActive(windowState.pId);
            this.updateWindowZIndex(windowState, this.MIN_Z_INDEX);
          }else{
            this.setHeaderActive(windowState.pId);
            this.updateWindowZIndex(windowState, this.MAX_Z_INDEX);
          }
          this.hideSilhouette(windowState.pId);
        }
      }
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are hidden by setting z -index = 0
     */
    hideWindowNotMatchingPidOnMouseHover(pId:number):void{
      if(this.processId !== pId){
        const windowState  = this._windowService.getWindowStates().find(p => p.pId === this.processId);

        if(windowState && windowState.isVisible){
          this.showSilhouette(windowState.pId);
          this.updateWindowZIndex(windowState, this.HIDDEN_Z_INDEX);
        }
        else if(windowState && !windowState.isVisible){
          this.setWindowToPriorHiddenState(windowState, this.HIDDEN_Z_INDEX);
        }
      }
    }

    restoreWindowOnMouseLeave(pId:number):void{
      const window = this._windowService.getWindowState(pId);
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();

      if(window && window.isVisible){
        if(window.pId !==  pid_with_highest_z_index){
          this.setHeaderInActive(window.pId);
          this.updateWindowZIndex(window, this.MIN_Z_INDEX);
        }else{
          this.setHeaderActive(window.pId);
          this.updateWindowZIndex(window, this.MAX_Z_INDEX);
        }
      } else if(window && !window.isVisible){
        this.setWindowToPriorHiddenState(window, this.HIDDEN_Z_INDEX);
      }
    }

    //the window positioning is acting wonky, but it is kinda 50% there
    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(pId);
      if(!ws) return;

      if(ws.isVisible){
        this.setFocsuOnThisWindow(ws.pId);
      }
    }

    setWindowToFocusByPid(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws) return;
      
      if(ws.isVisible){
        this.setWindowToFocusById(ws.pId);
      }
    }

    setWindowToFocusById(pId:number):void{
      const ws = this._windowService.getWindowState(pId);
      if(!ws) return;

      if((ws.pId === pId) && (ws.zIndex < this.MAX_Z_INDEX)){
        ws.zIndex = this.MAX_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessWindowIDWithHighestZIndex(pId);

        this.applyOpacityZ(this.MAX_Z_INDEX, 1);
        this.setHeaderActive(pId);
        this.setFocusOnDiv();
      }else if((ws.pId === pId) && (ws.zIndex === this.MAX_Z_INDEX)){
        this._windowService.addProcessWindowIDWithHighestZIndex(pId);
        this.setHeaderActive(pId);
        this.setFocusOnDiv();
      } 
    }

    setFocusOnDiv():void{
      const winCmpntId =`secWinCmpnt-${this.name}-${this.processId}`;
      const winCmpnt = document.getElementById(winCmpntId) as HTMLDivElement;
      
      if(winCmpnt){
        winCmpnt.focus();
      }
    }

    showOnlyWindowById(pId: number): void {
      const ws = this._windowService.getWindowState(pId);
      if (!ws || ws.pId !== pId) return;

      const z = this.TMP_MAX_Z_INDEX;
      this.applyOpacityZ(z, 1);
    }

    lockScreenIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (ws && ws.isVisible) {
        this.applyOpacityZ(this.HIDDEN_Z_INDEX, 0);
      }
    }

    desktopIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws || !ws.isVisible) return;

      const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
      const z = ws.pId === topPid ? this.MAX_Z_INDEX : this.MIN_Z_INDEX;

      this.applyOpacityZ(z, 1);
    }

    /**
     * this method returns a process that has a windows, with a visible state
     * @returns Process
     */
   getNextProcess():Process | undefined{
    const nextPId = this._windowService.getNextPidInWindowStateList();
    return this._runningProcessService.getProcesses().find(p => p.getProcessId === nextPId);
   }
}