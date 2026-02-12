/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import {Subscription } from 'rxjs';
import { WindowBoundsState, WindowResizeInfo, WindowState } from '../windows.types';
import {openCloseAnimation, hideShowAnimation, maximizeRestoreAnimation} from 'src/app/shared/system-component/window/window.animations';
import { AnimationEvent } from '@angular/animations';

import { Process } from 'src/app/system-files/process';
import { SystemNotificationService } from '../../../system-service/system.notification.service';
import { MenuService } from '../../../system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowConstants } from '../window.constants';
import { WindowStyleHelper } from '../window.style.helper';
import { WindowHelper } from '../window.helper';

 @Component({
   selector: 'cos-primarywindow',
   templateUrl: './primarywindow.component.html',
   animations: [openCloseAnimation, hideShowAnimation, maximizeRestoreAnimation],
   styleUrls: ['./primarywindow.component.css'],
   standalone:false,
 })
 export class PrimaryWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('primaryWindowContainer') primaryWindowContainer!: ElementRef;
   @ViewChild('primGlassPaneContainer') primGlassPaneContainer!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = Constants.EMPTY_STRING;  
   @Input() processAppName = Constants.EMPTY_STRING;  
   @Input() priorUId = Constants.EMPTY_STRING;  
   @Input() isMaximizable = true;  
   @Input() turnOffWindowOpenCloseAnimation = false;  
   @Input() turnOffWindowStacking = false;  

   private _renderer: Renderer2;
   private _runningProcessService!:RunningProcessService;
   private _sessionManagmentService!:SessionManagmentService;
   private _systemNotificationServices!:SystemNotificationService;
   private _windowService!:WindowService;
   private _originalWindowsState!:WindowState;
   private _menuService!:MenuService;

   private _restoreOrMinSub!:Subscription
   private _focusOnNextProcessSub!:Subscription;
   private _focusOnCurrentProcessSub!:Subscription;
   private _showOnlyCurrentProcessSub!:Subscription;
   private _removeFocusOnOtherProcessesSub!:Subscription;
   private _hideOtherProcessSub!:Subscription;
   private _resizeWindowSub!:Subscription;
   private _restoreProcessSub!:Subscription;
   private _restoreProcessesSub!:Subscription;
   private _showOrSetProcessWindowToFocusSub!:Subscription;
   private _lockScreenActiveSub!:Subscription;
   private _desktopActiveSub!:Subscription;
   private _showTheDesktopSub!:Subscription;
   private _showOpenWindowsSub!:Subscription;
   private _positionWindowSub!:Subscription;

  hideWindow = false;
  disableWindowAnimaion = false;
  windowOpenCloseAction = WindowConstants.OPEN;
  windowHideShowAction = WindowConstants.VISIBLE;
  windowMaxRestoreAction = WindowConstants.RESTORE;

  readonly SECONDS_DELAY = 450;

  windowTransform =  'translate(0,0)';
  hsZIndex = 2;
  windowTopPx = 0;
  windowLeftPx = 0;
  windowWidthPx = 0;
  windowHeightPx = 0;

  strWindowZIndex = '0';
  strWindowWidthPx = '0px';
  strWindowHeightPx = '0px';

  isWindowMaximizable = true;
  isWindowInFullScreenMode = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};

  readonly hasWindow = false; //The window cmpnt is an exception
  icon = Constants.EMPTY_STRING;
  name = 'Window';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  uniqueGlassPaneId = Constants.EMPTY_STRING;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, renderer: Renderer2,
                windowService:WindowService, sessionManagmentService: SessionManagmentService, systemNotificationServices:SystemNotificationService,
                menuService: MenuService,){
      this._runningProcessService = runningProcessService;
      this._sessionManagmentService = sessionManagmentService;
      this._windowService = windowService;
      this._systemNotificationServices = systemNotificationServices;
      this._menuService = menuService;

      this._renderer = renderer
      this._restoreOrMinSub = this._windowService.restoreOrMinimizeProcessWindowNotify.subscribe((p) => {this.restoreHiddenWindow(p)});
      this._focusOnNextProcessSub = this._windowService.focusOnNextProcessWindowNotify.subscribe((p) => {this.setWindowToFocusAndResetWindowBoundsByPid(p)});
      this._focusOnCurrentProcessSub = this._windowService.focusOnCurrentProcessWindowNotify.subscribe((p) => { this.setFocsuOnThisWindow(p)});
      this._removeFocusOnOtherProcessesSub = this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindowNotMatchingPid(p)});
      this._showOnlyCurrentProcessSub = this._windowService.setProcessWindowToFocusOnMouseHoverNotify.subscribe((p) => {this.setWindowToFocusOnMouseHover(p)});
      this._hideOtherProcessSub = this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.hideWindowNotMatchingPidOnMouseHover(p)});
      this._restoreProcessSub = this._windowService.restoreProcessWindowOnMouseLeaveNotify.subscribe((p) => {this.restoreWindowOnMouseLeave(p)});
      this._restoreProcessesSub = this._windowService.restoreProcessesWindowNotify.subscribe(() => {this.restorePriorFocusOnWindows()});

      this._lockScreenActiveSub = this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
      this._desktopActiveSub = this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});

      this._showOrSetProcessWindowToFocusSub = this._windowService.showOrSetProcessWindowToFocusOnClickNotify.subscribe((p) => {this.showOrSetProcessWindowToFocusOnClick(p)});

      this._showTheDesktopSub = this._menuService.showTheDesktop.subscribe(() => {this.setHideAndShowAllVisibleWindows()});
      this._showOpenWindowsSub = this._menuService.showOpenWindows.subscribe(() => { this.setHideAndShowAllVisibleWindows() });

      this._resizeWindowSub = this._windowService.resizeProcessWindowNotify.subscribe((p) => {
        if(p.pId === this.processId)
          this.onRZWindow(p)
      });
    }

    get getPrimaryWindowContainerElmnt(): HTMLElement {
      return this.primaryWindowContainer.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.retrievePastSessionData();

      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      this.setFocusOnWindowAfterInit(this.processId);
      
      // set defaultHeightOnOpen and defaultWidthOnOpen  
      this.windowHeightPx = this.getPrimaryWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getPrimaryWindowContainerElmnt.offsetWidth;
      this.strWindowZIndex =  String(WindowConstants.MAX_Z_INDEX);
      this.applySizeStyles();

      // cascade position after view is ready
      if (!this.turnOffWindowStacking)
        this.stackWindow();
      
      else if(this.turnOffWindowOpenCloseAnimation && this.turnOffWindowStacking){ // file tranfer Dialog
        const rect = WindowHelper.getDesktopRect();
        if(rect){
          // top-left position that centers the element
          this.windowLeftPx = Math.round((rect.width - this.windowWidthPx) * 0.5);
          this.windowTopPx  = Math.round((rect.height - this.windowHeightPx) * 0.5);
          this.applyPositionStyles();
          this.syncStatePositionSize();
        }
      }
      this.storeWindowStateAfterViewInit();
      this.changeDetectorRef.detectChanges();  //tell angular to run additional detection cycle after 
    }

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);
      if(this.name === WindowConstants.WINDOW)
        this.name = this.processAppName;

      this.displayName = this.processAppName;
      this.icon = this.processAppIcon;
      this.isWindowMaximizable = this.isMaximizable;

      if(this.turnOffWindowOpenCloseAnimation && this.turnOffWindowStacking){ // file tranfer Dialog
        this.disableWindowAnimaion = true;
      }
    }

    ngOnDestroy():void{
      this._restoreOrMinSub?.unsubscribe();
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
      this._resizeWindowSub?.unsubscribe();
      this._positionWindowSub?.unsubscribe();
    }

    storeWindowStateAfterViewInit():void{
      const clamped = WindowHelper.computeClampedPosition(this.windowLeftPx, this.windowTopPx, this.windowWidthPx, this.windowHeightPx, WindowConstants.TASKBAR_HEIGHT_PX );
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
        widthPx: this.windowWidthPx,
        heightPx: this.windowHeightPx,
        leftPx: clamped.leftPx,
        topPx: clamped.topPx,
        zIndex: WindowConstants.MAX_Z_INDEX,
        isVisible: true,
      };

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();
    }

    private clampToContainer():void{
      const clampData = WindowHelper.clampToContainer(this.primaryWindowContainer, this.windowLeftPx, this.windowTopPx, WindowConstants.EDGE_PAD_PX, WindowConstants.TASKBAR_HEIGHT_PX);
      if(!clampData) return;

      this.windowLeftPx = clampData.leftPx;
      this.windowTopPx  = clampData.topPx;
    }

    private applyOpacityZ(zIndex: number, opacity: number, isWindowVisible:boolean = true): void {

      if(isWindowVisible)
        this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
          this.windowTopPx, zIndex, opacity);
      else
        this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
          this.windowTopPx, zIndex, opacity, isWindowVisible);
    }

    private applyPositionStyles(): void {
      const zIndex = this.hideWindow ? WindowConstants.HIDDEN_Z_INDEX : this.strWindowZIndex;
      const opacity = this.hideWindow ? 0 : 1;

      this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
         this.windowTopPx, Number(zIndex), opacity);
    }

    private syncStatePositionSize(): void {
      WindowHelper.syncStatePositionSize(this._windowService, this.processId, this.windowLeftPx,
        this.windowTopPx, this.windowWidthPx, this.windowHeightPx, this.strWindowZIndex);
    }

    private applySizeStyles(): void {
      this.strWindowHeightPx = `${this.windowHeightPx}px`;
      this.strWindowWidthPx =  `${this.windowWidthPx}px`;
      this._renderer.setStyle(this.primaryWindowContainer.nativeElement, 'width', `${this.windowWidthPx}px`);
      this._renderer.setStyle(this.primaryWindowContainer.nativeElement, 'height', `${this.windowHeightPx}px`);

      this.setSilhouetteState();
      WindowStyleHelper.syncSilhouetteSize();
    }

    setBtnFocus(pId:number):void{
      if(this.processId !== pId) return;
      this.closeBtnStyles = { 'background-color':'rgb(139,10,20)' };
    }

    setHeaderInActive(pId:number):void{
      if(this.processId !== pId) return;
      this.headerActiveStyles = { 'background-color':'rgb(56,56,56)'};
    }

    setHeaderActive(pId:number):void{
      if(this.processId !== pId) return; 
      this.headerActiveStyles = {  'background-color':'rgb(24,60,124)'};
    }

    showSilhouette(pId:number): void {
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      WindowStyleHelper.showSilhouette();
    }

    showGlassPaneContainer() {
      this.setSilhouetteState();
      WindowStyleHelper.showGlassPaneContainer();
    }

    hideSilhouette(pId:number):void{
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      WindowStyleHelper.hideSilhouette();
    }

    hideGlassPaneContainer() {
      this.setSilhouetteState();
      WindowStyleHelper.hideGlassPaneContainer();
    }
   
    onHideBtnClick(pId:number, evt:MouseEvent):void{
      evt.stopPropagation();
      
      if(this.processId !== pId) return;
      this.setHideAndShow();
    }

    restoreHiddenWindow(pId:number):void{
      if(this.processId !== pId) return;
      this.setHideAndShow();
    }

    updateWindowZIndex(window: WindowState, zIndex:number):void{
      if(this.processId !== window.pId) return;

      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
      window.zIndex = zIndex;
      this._windowService.addWindowState(window);
    }

    syncFullScreenWindowZIndexForProcess(pId:number, zIndex:number):void{ // this may be deleted
      if(this.processId !== pId) return;

      this.strWindowZIndex =   String(zIndex);
      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
    }

    setWindowToPriorHiddenState(window: WindowState, zIndex: number): void {
      if (this.processId !== window.pId) return;
      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
    }

    onMaximizeBtnClick(evt: MouseEvent): void {
      evt.stopPropagation();

      if (!this.isWindowMaximizable) return;

      const maxWindow = true;   // full screen
      this.setMaximizeOrRestore(maxWindow);
    }

    onRestoreBtnClick(evt: MouseEvent): void {
      evt.stopPropagation();

      const maxWindow = false;   // restore window to prior size
      this.setMaximizeOrRestore(maxWindow);
    }

    onTitleBarDoubleClick(evt:MouseEvent):void{
      // evt.stopPropagation();

      // if(!this.isWindowMaximizable) return;
      // let maxWindow = false;

      // if(this.isWindowInFullScreenMode)
      //   maxWindow = false;   
      // else
      //   maxWindow = true;   

      // this.setMaximizeOrRestore(maxWindow);
    }

    onMouseDown(pId:number):void{
      this._windowService.windowDragIsActive.next();
      this.setFocsuOnThisWindow(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
    }

    onDragEnded(event: CdkDragEnd): void {
      if(this.isWindowInFullScreenMode){ // dragging full screen window is not allowed
        this._windowService.windowDragIsInActive.next();
        return;
      }
      // CDK gives a clean delta since drag started
      const delta = event.distance;

      // Commit delta into absolute left/top
      this.windowLeftPx += delta.x;
      this.windowTopPx  += delta.y;

      // Clamp, apply, sync
      this.clampToContainer();
      this.applyPositionStyles();
      this.syncStatePositionSize();

      this.setSilhouetteState();
      WindowStyleHelper.positionSilhouette();

      // Update per-app cascade starting point
      this.updateWindowBoundsState();

      // Important: reset the drag transform so we don't accumulate drift
      event.source.reset();
      this._windowService.windowDragIsInActive.next();
    }

    onRZStop(input:any):void{
      this.windowWidthPx =  Number(input.size.width);
      this.windowHeightPx =  Number(input.size.height);  
      this.applySizeStyles();
      this.syncStatePositionSize();

      //send window resize alert(containing new width and height);
      const resize:WindowResizeInfo = {pId:this.processId, widthPx:this.windowWidthPx, heightPx:this.windowHeightPx}
      this._windowService.resizeProcessWindowNotify.next(resize);
    }

    onRZWindow(input:WindowResizeInfo):void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(!windowState) return;
        
      this.windowHeightPx = input.heightPx;
      this.windowWidthPx = input.widthPx; 
      this.applySizeStyles();
      this.syncStatePositionSize();
    }

    setHideAndShow():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || ws.pId !== this.processId) return;

      this.hideWindow = !this.hideWindow;
      this.windowHideShowAction = this.hideWindow ? WindowConstants.HIDDEN : WindowConstants.VISIBLE;

      if(this.hideWindow){
        ws.isVisible = false;
        ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.removeProcessIDToHiddenOrVisibleWindows(ws.pId);

        this.setHeaderInActive(ws.pId);
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);

        const nxtProcess = this.getNextProcess();
        if(nxtProcess){
          this._windowService.focusOnNextProcessWindowNotify.next(nxtProcess.getProcessId);
          this._windowService.currentProcessInFocusNotify.next(nxtProcess.getProcessId);
        }else{
          this._windowService.noProcessInFocusNotify.next();
        }
      }
      else if(!this.hideWindow){
        if(this.isWindowInFullScreenMode){ 
          // if window was in full screen when hidden, give the proper z-index when unhidden
          this.syncFullScreenWindowZIndexForProcess(this.processId, ws.zIndex);
        }
        ws.isVisible = true;
        this._windowService.addWindowState(ws);
        this.setFocsuOnThisWindow(ws.pId);

        this._windowService.currentProcessInFocusNotify.next(ws.pId);
        this.resetHideShowWindowsList();
      }
    }

    setHideAndShowAllVisibleWindows():void{
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws || ws.pId !== this.processId) return;

      this.hideWindow = !this.hideWindow;

      if(ws.isVisible && this.hideWindow){
        //this.windowHideShowAction = this.hideWindow ? WindowConstants.HIDDEN : WindowConstants.VISIBLE; // animation not needed for this case

        ws.isVisible = false;
        ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);

        this.setHeaderInActive(ws.pId);
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
      }
      else if(!ws.isVisible){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();

        if(windowList.includes(this.processId) && !this.hideWindow){
          //this.windowHideShowAction = this.hideWindow ? WindowConstants.HIDDEN : WindowConstants.VISIBLE; // animation not needed for this case

          if(this.isWindowInFullScreenMode)  // if window was in full screen when hidden, give the proper z-index when unhidden
            this.syncFullScreenWindowZIndexForProcess(this.processId, ws.zIndex);

          ws.isVisible = true;
          this._windowService.addWindowState(ws);
          const window_with_highest_zIndex = this._windowService.getProcessWindowIDWithHighestZIndex();
          if(window_with_highest_zIndex === this.processId){
            this.setFocsuOnThisWindow(ws.pId);
            this._windowService.currentProcessInFocusNotify.next(ws.pId);
          }else{
            this.setWindowToPriorHiddenState(ws, WindowConstants.MIN_Z_INDEX);
          }
        }
      }
    }

    hideShowAnimationDone(event: AnimationEvent) {
      if (event.toState === 'hidden') {
        this.hsZIndex = WindowConstants.HIDDEN_Z_INDEX
      } else {
        this.hsZIndex = WindowConstants.MAX_Z_INDEX
      }
    }

    resetHideShowWindowsList():void{
      this._windowService.resetHiddenOrVisibleWindowsList();
      this._menuService.updateTaskBarContextMenu.next();
    }

    private setMaximizeOrRestore(maxWindow: boolean): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws) return;

      this.isWindowInFullScreenMode = maxWindow;
      ws.isMaximized = maxWindow;

      if(maxWindow){
        this.windowMaxRestoreAction = WindowConstants.MAXIMIZED;
        // keep current zIndex, just ensure it is top visually
        this.syncFullScreenWindowZIndexForProcess(this.processId, ws.zIndex);

        this._windowService.addEventOriginator(this.uniqueId);
        this._windowService.maximizeProcessWindowNotify.next();
      } else {
        this.windowMaxRestoreAction = WindowConstants.RESTORE;

        // Restore to stored service size (or original default)
        this.windowWidthPx  = ws.widthPx || this.windowWidthPx;
        this.windowHeightPx = ws.heightPx || this.windowHeightPx;

        const windowTitleBarHeight = 30;
        this.applySizeStyles();

        this._windowService.addEventOriginator(this.uniqueId);
        this._windowService.minimizeProcessWindowNotify.next([
          this.windowWidthPx,
          this.windowHeightPx - windowTitleBarHeight
        ]);
      }

      this._windowService.addWindowState(ws);
    }

    stackWindow():void{
      const containerRect = WindowHelper.getDesktopRect();
      const winEl = this.primaryWindowContainer?.nativeElement as HTMLElement | undefined;
      if (!containerRect || !winEl) return;

      const winRect = winEl.getBoundingClientRect();

      const step = WindowConstants.CASCADE_STEP_PX;
      const pad = WindowConstants.EDGE_PAD_PX;

      const usableHeight = containerRect.height - WindowConstants.TASKBAR_HEIGHT_PX;

      // Center baseline
      const centerLeft = Math.round((containerRect.width - winRect.width) / 2);
      const centerTop  = Math.round((usableHeight - winRect.height) / 2);

      // Clamp bounds
      const maxLeft = Math.max(pad, containerRect.width - winRect.width - pad);
      const maxTop  = Math.max(pad, usableHeight - winRect.height - pad);

      // per-app cascade cursor
      let bounds = this._windowService.getProcessWindowBounds(this.uniqueId);

      if (!bounds) {
        // first instance: start near center
        bounds = {
          xOffset: centerLeft,
          yOffset: centerTop,
          xBoundsSubtraction: 0,
          yBoundsSubtraction: 0
        };
      } else {
        // next instance: cascade
        bounds.xOffset += step;
        bounds.yOffset += step;
      }

      // wrap if overflow
      if (bounds.xOffset > maxLeft || bounds.yOffset > maxTop) {
        bounds.xOffset = centerLeft;
        bounds.yOffset = centerTop;
      }

      this._windowService.addProcessWindowBounds(this.uniqueId, bounds);
      this.windowLeftPx = Math.min(Math.max(bounds.xOffset, pad), maxLeft);
      this.windowTopPx  = Math.min(Math.max(bounds.yOffset, pad), maxTop);

      this.applyPositionStyles();
      this.syncStatePositionSize();
    }

    updateWindowBoundsState(): void {
      const currentBound = this._windowService.getProcessWindowBounds(this.uniqueId);
      const next: WindowBoundsState = currentBound ?? { xOffset: 0, yOffset: 0, xBoundsSubtraction: 0, yBoundsSubtraction: 0 };

      // Store the current committed absolute px position
      next.xOffset = this.windowLeftPx;
      next.yOffset = this.windowTopPx;
      next.xBoundsSubtraction = 0;
      next.yBoundsSubtraction = 0;

      this._windowService.addProcessWindowBounds(this.uniqueId, next);
    }

    createSilhouette():void{
      this.uniqueGlassPaneId = `primGP-${this.uniqueId}`;

      // //Every window has a hidden glass pane that is revealed when the window is hidden
      this.primGlassPaneContainer = WindowStyleHelper.createSilhouette(this.uniqueGlassPaneId, this._renderer, this.primGlassPaneContainer,
         this.windowHeightPx, this.windowWidthPx);

      this.setSilhouetteState();
    }

    setSilhouetteState():void{
      WindowStyleHelper.updateState({
        renderer: this._renderer, glassPaneContainer: this.primGlassPaneContainer, uniqueGlassPaneId: this.uniqueGlassPaneId,
        windowLeftPx: this.windowLeftPx, windowTopPx: this.windowTopPx,
      });
    }

    async onCloseBtnClick(evt:MouseEvent):Promise<void>{
      evt.stopPropagation();

      if(!this.turnOffWindowOpenCloseAnimation)
        this.windowOpenCloseAction = WindowConstants.CLOSE;

      this._windowService.removeWindowState(this.processId);
      this.setSilhouetteState();
      WindowStyleHelper.removeSilhouette();

      await CommonFunctions.sleep(this.SECONDS_DELAY);
      const process = this._runningProcessService.getProcess(this.processId);
      if(process){
        this._runningProcessService.closeProcessNotify.next(process);
        this._windowService.cleanupWindowDataForApp(this.uniqueId);
      }

      const nxtProcess = this.getNextProcess();
      if(nxtProcess){
        this._windowService.focusOnNextProcessWindowNotify.next(nxtProcess.getProcessId);
        this._windowService.currentProcessInFocusNotify.next(nxtProcess.getProcessId);
      }
    }

    setFocsuOnThisWindow(pId:number):void{
      const uId = `${this.name}-${pId}`;
      if(this.uniqueId !== uId || this.hideWindow) return;

      this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
      this.setFocusOnWindowAndUpdateStates(pId);
      this.updateWindowBoundsState();
    }

    setFocusOnWindowAfterInit(pId:number):void{
      this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
      this.setHeaderActive(pId);
    }

    setWindowToFocusOnMouseHover(pId:number):void{
      this._windowService.hideOtherProcessesWindowNotify.next(pId);
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();
      
      if(this.processId !== pId) return;

      if(pId === pid_with_highest_z_index)
        this.setHeaderActive(pId);

      this.hideSilhouette(pId);
      this.showOnlyWindowById(pId);
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindowNotMatchingPid(pId:number):void{
      if(this.processId === pId) return;

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || !ws.isVisible) return;

      this.setHeaderInActive(ws.pId);
      this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
    }

    restorePriorFocusOnWindows():void{
      const processWithWindows = this._windowService.getWindowStates();
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();

      for(let i = 0; i < processWithWindows.length; i++){
        const ws = processWithWindows[i];          
        if(ws && ws.isVisible){
          if(ws.pId !== pid_with_highest_z_index ){
            this.setHeaderInActive(ws.pId);
            this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
          }
          else{
            this.setHeaderActive(ws.pId);
            this.updateWindowZIndex(ws, WindowConstants.MAX_Z_INDEX);
          }
          this.hideSilhouette(ws.pId);
        }
      }
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are hidden by setting z -index = 0
     */
    hideWindowNotMatchingPidOnMouseHover(pId:number):void{
      if(this.processId === pId) return;

      const ws  = this._windowService.getWindowStates().find(p => p.pId === this.processId);
      if(!ws) return;

      if(ws.isVisible){
        this.showSilhouette(ws.pId);
        this.updateWindowZIndex(ws, WindowConstants.HIDDEN_Z_INDEX);
      }
      else if(!ws.isVisible){
        this.setWindowToPriorHiddenState(ws, WindowConstants.HIDDEN_Z_INDEX);
      }
    }

    restoreWindowOnMouseLeave(pId:number):void{
      const ws = this._windowService.getWindowState(pId);
      if(!ws) return;

      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();
      if(ws.isVisible){
        if(ws.pId !==  pid_with_highest_z_index){
          this.setHeaderInActive(ws.pId);
          this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
        }
        else{
          this.setHeaderActive(ws.pId);
          this.updateWindowZIndex(ws, WindowConstants.MAX_Z_INDEX);
        }
      } 
      else if(!ws.isVisible){
        this.setWindowToPriorHiddenState(ws, WindowConstants.HIDDEN_Z_INDEX);
      }
    }

    //the window positioning is acting wonky, but it is kinda 50% there
    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(pId);
      if(!ws) return;

      if(!ws.isVisible){
        this.restoreHiddenWindow(pId);
      }else{
        this.setFocsuOnThisWindow(ws.pId);
      }
    }

    setWindowToFocusAndResetWindowBoundsByPid(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || !ws.isVisible) return;
      
      this.setFocusOnWindowAndUpdateStates(ws.pId);
      this.updateWindowBoundsState();
    }

    setFocusOnWindowAndUpdateStates(pId:number):void{
      const ws = this._windowService.getWindowState(pId);
      if(!ws || ws.pId !== pId) return;

      const winCmpntId =`primWinCmpnt-${this.name}-${this.processId}`;
      if(ws.zIndex < WindowConstants.MAX_Z_INDEX){
        ws.zIndex = WindowConstants.MAX_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessWindowIDWithHighestZIndex(pId);

        this.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
        this.setHeaderActive(pId);
        WindowHelper.setFocusOnDiv(winCmpntId);
      }
      else if(ws.zIndex === WindowConstants.MAX_Z_INDEX){
        this._windowService.addProcessWindowIDWithHighestZIndex(pId);
        this.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
        this.setHeaderActive(pId);
        WindowHelper.setFocusOnDiv(winCmpntId);
      } 
    }

    showOnlyWindowById(pId: number): void {
      const ws = this._windowService.getWindowState(pId);
      if (!ws || ws.pId !== pId) return;

      const z = WindowConstants.TMP_MAX_Z_INDEX;
      if(ws.isVisible)
        this.applyOpacityZ(z, 1);
      else
        this.applyOpacityZ(z, 1, ws.isVisible);
    }

    lockScreenIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (ws && ws.isVisible)
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
    }

    desktopIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws || !ws.isVisible) return;

      const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
      const z = ws.pId === topPid ? WindowConstants.MAX_Z_INDEX : WindowConstants.MIN_Z_INDEX;
      this.applyOpacityZ(z, 1);
    }

    /**
     * this method returns a process that has a windows, with a visible state
     * @returns Process
     */
    getNextProcess():Process | undefined{
      const nextPid = this._windowService.getNextPidInWindowStateList();
      return this._runningProcessService.getProcesses().find(p => p.getProcessId === nextPid);
    }

    retrievePastSessionData():void{

      const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
      if(appSessionData !== null && appSessionData.window !== undefined){
          // this.currentStyles = {
          //   'transform': 'translate(0,0)',
          //   'width': '100%',
          //   'height': 'calc(100% - 40px)', //This accounts for the taskbar height
          //   'top': '0',
          //   'left': '0',
          //   'right': '0',
          //   'bottom': '0', 
          //   'z-index': z_index
          // };

      /*
          Why i am removing the session below. Once window has it's size and position data, the session data is no longer needed

          --- Order of Operation ---   the application open first, followed by creating a window component for it's presentation.

            1. For the App Component
              1. The constructor executes first

            2.For the Windows Component
              1. The constructor executes first

              2. ngOnChange executes next

              3.  Then followed by ngOnInit
      */
        this._sessionManagmentService.removeAppSession(this.priorUId);
      }
    }

}