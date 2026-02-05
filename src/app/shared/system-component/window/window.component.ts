/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import {Subscription } from 'rxjs';
import { ClampedPosition, WindowBoundsState, WindowState } from './windows.types';
import {openCloseAnimation, hideShowAnimation, maximizeRestoreAnimation} from 'src/app/shared/system-component/window/animation/animations';
import { AnimationEvent } from '@angular/animations';

import { Process } from 'src/app/system-files/process';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { MenuService } from '../../system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { WindowPositionInfo, WindowResizeInfo } from 'src/app/system-files/common.interfaces';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { v } from '@angular/cdk/scrolling-module.d-ud2XrbF8';

 @Component({
   selector: 'cos-window',
   templateUrl: './window.component.html',
   animations: [openCloseAnimation,hideShowAnimation,maximizeRestoreAnimation],
   styleUrls: ['./window.component.css'],
   standalone:false,
 })
 export class WindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('mainWindowContainer') mainWindowContainer!: ElementRef;
   @ViewChild('glassPaneContainer') glassPaneContainer!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = Constants.EMPTY_STRING;  
   @Input() processAppName = Constants.EMPTY_STRING;  
   @Input() priorUId = Constants.EMPTY_STRING;  
   @Input() isMinimizable = true; 
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

  readonly SECONDS_DELAY = 450;
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
  disableWindowAnimaion = false;
  windowOpenCloseAction = 'open';
  windowHideShowAction = 'visible';
  windowMaxRestoreAction = 'restore';

  windowTransform =  'translate(0,0)';
  windowTransform0p =   'translate(0,0)';
  windowTransform50p =  'translate(-50px,50px)';
  windowTransform100p = 'translate(-100px,100px)';

  yAxis0p =   'translate(0,0)';
  yAxis50p =  'translate(0,50px)';
  yAxis100p = 'translate(0,100px)';

 
  hsZIndex = 2;

  xAxisTmp = 0;
  yAxisTmp = 0;

  windowTopPx = 0;
  windowLeftPx = 0;
  windowWidthPx = 0;
  windowHeightPx = 0;

  windowZIndex = '0';
  strWindowWidthPx = '0px';
  strWindowHeightPx = '0px';

  isWindowMaximizable = true;
  isWindowMinimizable = true;
  isWindowInFullScreenMode = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};

  hasWindow = false;
  icon = Constants.EMPTY_STRING;
  name = 'Window';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  uniqueGPId = Constants.EMPTY_STRING;
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
      this._showOpenWindowsSub = this._menuService.showOpenWindows.subscribe(() => {this.setHideAndShowAllVisibleWindows()});

      this._resizeWindowSub = this._windowService.resizeProcessWindowNotify.subscribe((p) => {
        if(p.pId === this.processId)
          this.onRZWindow(p)
      });

      this._positionWindowSub = this._windowService.positionProcessWindowNotify.subscribe((p) => {
        if(p.pId === this.processId)
          this.onPositionWindow(p)
      });
    }

    get getMainWindowContainerElmnt(): HTMLElement {
      return this.mainWindowContainer.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.retrievePastSessionData();

      // if(!this.turnOffWindowOpenCloseAnimation)
      //   this.windowOpenCloseAction = 'open';

      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      setTimeout(() => {this.setFocusOnWindowInit(this.processId) }, 0);

      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      
      // get defaultHeightOnOpen and defaultWidthOnOpen  
      this.windowHeightPx = this.getMainWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getMainWindowContainerElmnt.offsetWidth;
      this.applySizeStyles();
;
      // if(this.turnOffWindowOpenCloseAnimation)
      //   this.windowTransform =  'translate(-50%, -50%)';
      // else
      //   this.windowTransform =  'translate(0, 0)';

      // cascade position after view is ready
      if (!this.turnOffWindowStacking){
        this.stackWindow();
      } else {
        this.windowLeftPx = this.WIN_LEFT_PX;
        this.windowTopPx = this.WIN_TOP_PX;
        this.applyPositionStyles();
        this.syncStatePositionSize();
      }

      this.windowZIndex =  String(this.MAX_Z_INDEX);
      this.storeWindowStateAfterViewInit();

      //tell angular to run additional detection cycle after 
      this.changeDetectorRef.detectChanges();
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

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);
      if(this.name === "Window")
          this.name = this.processAppName;

      this.displayName = this.processAppName;
      this.icon = this.processAppIcon;
      this.isWindowMaximizable = this.isMaximizable;
      this.isWindowMinimizable = this.isMinimizable;

      if(this.turnOffWindowOpenCloseAnimation){
        this.disableWindowAnimaion = true;
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
      const winEl = this.mainWindowContainer?.nativeElement as HTMLElement | undefined;
      if (!desktop || !winEl) return;

      const winRect = winEl.getBoundingClientRect();
      const pad = this.EDGE_PAD_PX;

      const maxLeft = Math.max(pad, desktop.width - winRect.width - pad);
      const maxTop  = Math.max(pad, desktop.height - this.TASKBAR_HEIGHT_PX - winRect.height - pad);

      this.windowLeftPx = Math.min(Math.max(this.windowLeftPx, pad), maxLeft);
      this.windowTopPx  = Math.min(Math.max(this.windowTopPx, pad), maxTop);
    }

    private applyOpacityZ(zIndex: number, opacity: number): void {
      this.currentStyles = {
        ...this.currentStyles,
        left: `${this.windowLeftPx}px`,
        top: `${this.windowTopPx}px`,
        transform: 'translate(0px, 0px)',
        'z-index': zIndex,
        opacity
      };
    }

    private applyPositionStyles(): void {
      this.currentStyles = {
        ...this.currentStyles,
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
      this._renderer.setStyle(this.mainWindowContainer.nativeElement, 'width', `${this.windowWidthPx}px`);
      this._renderer.setStyle(this.mainWindowContainer.nativeElement, 'height', `${this.windowHeightPx}px`);

      this.syncSilhouetteSize();
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
          'background-color':'rgb(56,56,56)'
        };
      }
    }

    setHeaderActive(pId:number):void{
      if(this.processId === pId){
        this.headerActiveStyles = {
          'background-color':'rgb(24,60,124)'
        };
      }
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
      this._renderer.setStyle(this.glassPaneContainer.nativeElement, 'display', 'block');
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
      this._renderer.setStyle(this.glassPaneContainer.nativeElement, 'display', 'none');
    }

    removeSilhouette(pId:number):void{
      if(this.processId === pId){
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if (glassPane) {
          glassPane.remove();
        } 
      }
    }

    private syncSilhouetteSize(): void {
      const glassPane = document.getElementById(this.uniqueGPId) as HTMLDivElement | null;
      if (!glassPane) return;
      
      glassPane.style.width = `${this.windowWidthPx}px`;
      glassPane.style.height = `${this.windowHeightPx}px`;
    }


    setWindowToFullScreen(pId:number, z_index:number):void{
      if(this.processId === pId){
        this.windowZIndex =   String(z_index);
      }
    }
   
    onHideBtnClick(pId:number, evt:MouseEvent):void{
      evt.stopPropagation();
      
      if(this.processId === pId){
        if(this.isWindowMinimizable){
          this.setHideAndShow();
        }
      }
    }

    restoreHiddenWindow(pId:number):void{
      if(this.processId === pId){
        this.setHideAndShow();
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
      evt.stopPropagation();
      console.log('this featured is turned off');

      // if(this.isWindowMaximizable){
      //   if(this.isWindowInFullScreenMode && !this.windowMaximize){
      //     this.windowMaximize = false;
      //     this.windowMaxRestoreAction = 'restore';
      //   }else{
      //     this.windowMaximize = true;
      //     this.windowMaxRestoreAction = 'maximized';
      //   }
      //   this.setMaximizeAndRestore()
      // }
    }

    onMouseDown(pId:number):void{
      this.setFocsuOnThisWindow(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
    }

    onDragStarted():void{
      this._windowService.windowDragIsActive.next();
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
      this.positionSilhouette();

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
      const resize:WindowResizeInfo = {pId:this.processId, width:this.windowWidthPx, height:this.windowHeightPx}
      this._windowService.resizeProcessWindowNotify.next(resize);
    }

    onRZWindow(input:WindowResizeInfo):void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(!windowState) return;
        
      this.windowHeightPx = input.height;
      this.windowWidthPx = input.width; 
      this.applySizeStyles();
      this.syncStatePositionSize();
    }


    onPositionWindow(input: WindowPositionInfo): void {
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
    
    generateCloseAnimationValues(x_axis:number, y_axis:number):void{
      this.windowTransform0p =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;
      this.windowTransform50p =  `translate(${String(x_axis - 50)}px , ${String(y_axis + 50)}px)`;
      this.windowTransform100p =  `translate(${String(x_axis - 100)}px , ${String(y_axis + 100)}px)`;
    }

    generateHideAnimationValues(x_axis:number, y_axis:number ):void{
      this.yAxis0p =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;
      this.yAxis50p =  `translate(${String(x_axis)}px , ${String(y_axis + 50)}px)`;
      this.yAxis100p =  `translate(${String(x_axis)}px , ${String(y_axis + 100)}px)`;
    }

    setHideAndShow():void{
      const delay = 450; //450ms
      this.windowHide = !this.windowHide;
      this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
      this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);
      // CSS styles: set per current state of component properties

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws) return;

      if(this.windowHide && (ws.pId === this.processId)){
          ws.isVisible = false;
          ws.zIndex = this.HIDDEN_Z_INDEX;
          this._windowService.addWindowState(ws);

          this.setHeaderInActive(ws.pId);
          this.applyOpacityZ(this.HIDDEN_Z_INDEX, 1);

          const nextProc = this.getNextProcess();
          if(nextProc){
            this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
            this._windowService.currentProcessInFocusNotify.next(nextProc.getProcessId);
          }else{
            this._windowService.noProcessInFocusNotify.next();
          }
      }
      else if(!this.windowHide && (ws.pId === this.processId)){
          if(this.isWindowInFullScreenMode){ 
            // if window was in full screen when hidden, give the proper z-index when unhidden
            this.setWindowToFullScreen(this.processId, ws.zIndex);
          }
          ws.isVisible = true;
          this._windowService.addWindowState(ws);
          this.setFocsuOnThisWindow(ws.pId);

          console.log('call currentProcessInFocusNotify')
          this._windowService.currentProcessInFocusNotify.next(ws.pId);
          this.resetHideShowWindowsList();
      }
    }


    setHideAndShowAllVisibleWindows():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws) return;

      this.windowHide = !this.windowHide;
      this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
      this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);
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
          if(this.isWindowInFullScreenMode){ 
            // if window was in full screen when hidden, give the proper z-index when unhidden
            this.setWindowToFullScreen(this.processId, ws.zIndex);
          }
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

    hideShowAnimationDone(event: AnimationEvent) {
      if (event.toState === 'hidden') {
        this.hsZIndex = this.HIDDEN_Z_INDEX
      } else {
        this.hsZIndex = this.MAX_Z_INDEX
      }
    }

    resetHideShowWindowsList():void{
      this._windowService.resetHiddenOrVisibleWindowsList();
      this._menuService.updateTaskBarContextMenu.next();
    }

    setMaximizeAndRestore():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws)return;

      this.isWindowInFullScreenMode = this.windowMaximize;
      if(this.windowMaximize && ws.pId === this.processId){
          this.setWindowToFullScreen(this.processId, ws.zIndex);

          this._windowService.addEventOriginator(this.uniqueId);
          this._windowService.maximizeProcessWindowNotify.next();
      }
      else if(!this.windowMaximize && ws.pId === this.processId){
          this.windowWidthPx = ws.width;
          this.windowHeightPx =  ws.height;
          this.windowZIndex =   String(ws.zIndex);
          // this.windowTransform =  `translate(${windowState.leftPx}px, ${windowState.topPx}px)`;

          const windowTitleBarHeight = 30;
          this.applySizeStyles();
          this._windowService.addEventOriginator(this.uniqueId);
          this._windowService.minimizeProcessWindowNotify.next([ws.width, ws.height - windowTitleBarHeight]);
      }

      this.windowMaximize = !this.windowMaximize;
    }


    private setMaximizeOrRestore(maxWindow: boolean): void {
        const ws = this._windowService.getWindowState(this.processId);
        if (!ws) return;

        this.isWindowInFullScreenMode = maxWindow;
        ws.isMaximized = maxWindow;

        if(maxWindow){
          this.windowMaxRestoreAction = 'maximized';
          // keep current zIndex, just ensure it is top visually
          this.setWindowToFullScreen(this.processId, ws.zIndex);

          this._windowService.addEventOriginator(this.uniqueId);
          this._windowService.maximizeProcessWindowNotify.next();
        } else {
          this.windowMaxRestoreAction = 'restore';

          // Restore to stored service size (or original default)
          this.windowWidthPx  = ws.width || this.windowWidthPx;
          this.windowHeightPx = ws.height || this.windowHeightPx;

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
      const containerRect = this.getDesktopRect();
      const winEl = this.mainWindowContainer?.nativeElement as HTMLElement | undefined;
      if (!containerRect || !winEl) return;

      const winRect = winEl.getBoundingClientRect();

      const step = this.CASCADE_STEP_PX;
      const pad = this.EDGE_PAD_PX;

      const usableHeight = containerRect.height - this.TASKBAR_HEIGHT_PX;

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

      const next: WindowBoundsState = currentBound ?? {
        xOffset: 0,
        yOffset: 0,
        xBoundsSubtraction: 0,
        yBoundsSubtraction: 0
      };

      // Store the current committed absolute px position
      next.xOffset = this.windowLeftPx;
      next.yOffset = this.windowTopPx;

      next.xBoundsSubtraction = 0;
      next.yBoundsSubtraction = 0;

      this._windowService.addProcessWindowBounds(this.uniqueId, next);
    }


    createSilhouette():void{
      this.uniqueGPId = `gp-${this.uniqueId}`;
      //Every window has a hidden glass pane that is revealed when the window is hidden
      const glassPane = this._renderer.createElement('div');

      // Add attributes
      glassPane.setAttribute('id', this.uniqueGPId);

      glassPane.style.transform =  'translate(0, 0)';
      glassPane.style.height =  `${this.windowHeightPx}px`;
      glassPane.style.width =  `${this.windowWidthPx}px`;

      glassPane.style.zIndex =  String(this.HIDDEN_Z_INDEX);
      glassPane.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
      glassPane.style.backdropFilter = 'blur(2px)';
      glassPane.style.display =  'none';

      // Append to the body
      this._renderer.appendChild(this.glassPaneContainer.nativeElement, glassPane);
    }

    async onCloseBtnClick(evt:MouseEvent):Promise<void>{
      evt.stopPropagation();

      if(!this.turnOffWindowOpenCloseAnimation){
        this.windowOpenCloseAction = 'close';
        this.generateCloseAnimationValues(this.xAxisTmp, this.yAxisTmp);
      }

      this._windowService.removeWindowState(this.processId);
      this.removeSilhouette(this.processId);

      await CommonFunctions.sleep(this.SECONDS_DELAY);
      const processToClose = this._runningProcessService.getProcess(this.processId);
      if(processToClose){
        this._runningProcessService.closeProcessNotify.next(processToClose);
        this._windowService.cleanUp(this.uniqueId);
      }

      const nextProc = this.getNextProcess();
      if(nextProc){
        this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
        this._windowService.currentProcessInFocusNotify.next(nextProc.getProcessId);
      }
    }

    setFocsuOnThisWindow(pId:number):void{
      console.log('setFocsuOnThisWindow:', pId);

      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */
      const uId = `${this.name}-${pId}`;
      if((this.uniqueId === uId) && (!this.windowHide)){
        this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);

        this.setWindowToFocusById(pId);
        this.updateWindowBoundsState();
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

      if(!ws.isVisible){
        this.restoreHiddenWindow(pId);
      }else{
        this.setFocsuOnThisWindow(ws.pId);
      }
    }

    setWindowToFocusAndResetWindowBoundsByPid(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws) return;
      
      if(ws.isVisible){
        this.setWindowToFocusById(ws.pId);
        //reset window bound when a window is closed or hidden.
        this.updateWindowBoundsState();
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
      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
      const winCmpnt = document.getElementById(winCmpntId) as HTMLDivElement;
      
      if(winCmpnt){
        winCmpnt.focus();
      }
    }

    showOnlyWindowById(pId: number): void {
      const windowState = this._windowService.getWindowState(pId);
      if (!windowState || windowState.pId !== pId) return;

      const z = this.TMP_MAX_Z_INDEX;
      this.applyOpacityZ(z, 1);
    }

    lockScreenIsActive(): void {
      const windowState = this._windowService.getWindowState(this.processId);
      if (windowState && windowState.isVisible) {
        this.applyOpacityZ(this.HIDDEN_Z_INDEX, 0);
      }
    }

    desktopIsActive(): void {
      const windowState = this._windowService.getWindowState(this.processId);
      if (!windowState || !windowState.isVisible) return;

      const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
      const z = windowState.pId === topPid ? this.MAX_Z_INDEX : this.MIN_Z_INDEX;

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