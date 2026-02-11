import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';
import { MenuService } from '../../../system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessHandlerService } from '../../../system-service/process.handler.service';
import { UserNotificationService } from '../../../system-service/user.notification.service';
import { SystemNotificationService } from '../../../system-service/system.notification.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import {Subscription } from 'rxjs';
import { WindowState  } from '../windows.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowHelper } from '../window.helper';
import { WindowStyleHelper } from '../window.style.helper';
import { WindowConstants } from '../window.constants';

@Component({
  selector: 'cos-secondarywindow',
  templateUrl: './secondarywindow.component.html',
  styleUrl: './secondarywindow.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
 export class SecondaryWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
    @ViewChild('secondaryWindowContainer') secondaryWindowContainer!: ElementRef;
    @ViewChild('secGlassPaneContainer') secGlassPaneContainer!: ElementRef;

    @Input() runningProcessID = 0;  
    @Input() processAppIcon = Constants.EMPTY_STRING;  
    @Input() displayMessage = Constants.EMPTY_STRING;  
    @Input() processAppName = Constants.EMPTY_STRING;  
    @Input() callingProcessUId = Constants.EMPTY_STRING;    
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

    windowHide = false;
    windowMaximize = false;

    windowTopPx = 0;
    windowLeftPx = 0;
    windowWidthPx = 0;
    windowHeightPx = 0;

    strWindowZIndex = '0';
    strWindowWidthPx = '0px';
    strWindowHeightPx = '0px';

    xAxisTmp = 0;
    yAxisTmp = 0;
    windowTransform = Constants.EMPTY_STRING;

    callingProcessId = 0;   
    isDialogContent = false;
    currentWinStyles: Record<string, unknown> = {};
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
      //this._showOnlyCurrentProcessSub = this._windowService.setProcessWindowToFocusOnMouseHoverNotify.subscribe((p) => {this.setWindowToFocusOnMouseHover(p)});
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
    }

    get getSecondaryWindowContainerElmnt(): HTMLElement {
      return this.secondaryWindowContainer.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.isDialogContent = this.isDialog;
    
      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      this.setFocusOnWindowAfterInit(this.processId);

      // get defaultHeightOnOpen and defaultWidthOnOpen  
      this.windowHeightPx = this.getSecondaryWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getSecondaryWindowContainerElmnt.offsetWidth;
      this.strWindowZIndex =  String(WindowConstants.MAX_Z_INDEX);
      this.applySizeStyles();

      if(this.isDialog && this.callingProcessUId === Constants.EMPTY_STRING){ // file Dialog
        const rect = WindowHelper.getDesktopRect();
        if(rect){
          // top-left position that centers the element
          this.windowLeftPx = Math.round((rect.width - this.windowWidthPx) * 0.5);
          this.windowTopPx  = Math.round((rect.height - this.windowHeightPx) * 0.5);
          this.applyPositionStyles();
        }
      }else if(this.isDialog && this.callingProcessUId !== Constants.EMPTY_STRING){
        this.callingProcessId = Number(this.callingProcessUId.split(Constants.DASH)[1]);
        this.centerNotificationWindowWithinCallingProcess();
      }

      this.storeWindowStateAfterViewInit();
      this.changeDetectorRef.detectChanges();      //tell angular to run additional detection cycle after 
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

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);
      if(this.name ===  WindowConstants.WINDOW)
        this.name = this.processAppName;

      this.icon = this.processAppIcon;
      if(this.isDialog)
       this.displayName = this.displayMessage; 
      else
       this.displayName = this.processAppName;
    }
    
    setBtnFocus(pId:number):void{
      if(this.processId !== pId) return;
      this.closeBtnStyles = { 'background-color':'rgb(139,10,20)' };
    }

    setHeaderInActive(pId:number):void{
      if(this.processId !== pId) return;
      this.headerActiveStyles = {'background-color':'hsla(0, 0%, 85%, 1)'};
    }

    setHeaderActive(pId:number):void{
      if(this.processId !== pId) return; 
      this.headerActiveStyles = {  'background-color':'hsla(0, 0%, 100%, 1)' };
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
        zIndex: WindowConstants.MAX_Z_INDEX,   // placeholder, service will normalize
        isVisible: true,
      };

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();
    }

    private clampToContainer():void{
      const clampData = WindowHelper.clampToContainer(this.secondaryWindowContainer, this.windowLeftPx, this.windowTopPx, WindowConstants.EDGE_PAD_PX, WindowConstants.TASKBAR_HEIGHT_PX);
      if(!clampData) return;

      this.windowLeftPx = clampData.leftPx;
      this.windowTopPx  = clampData.topPx;
    }

    private applyOpacityZ(zIndex: number, opacity: number): void {
      this.currentWinStyles = WindowStyleHelper.applyStyle(this.currentWinStyles, this.windowLeftPx,
         this.windowTopPx, zIndex, opacity);
    }

    private applyPositionStyles(): void {
      const zIndex = this.windowHide ? WindowConstants.HIDDEN_Z_INDEX : this.strWindowZIndex;
      const opacity = this.windowHide ? 0 : 1;

      this.currentWinStyles = WindowStyleHelper.applyStyle(this.currentWinStyles, this.windowLeftPx,
         this.windowTopPx, Number(zIndex), opacity);
    }

    private syncStatePositionSize(): void {
      WindowHelper.syncStatePositionSize(this._windowService, this.processId, this.windowLeftPx,
        this.windowTopPx, this.windowWidthPx, this.windowHeightPx, this.strWindowZIndex);
    }

    private applySizeStyles(): void {
      this.strWindowHeightPx = `${this.windowHeightPx}px`;
      this.strWindowWidthPx =  `${this.windowWidthPx}px`;
    }

    createSilhouette():void{
      this.uniqueGlassPaneId = `secGP-${this.uniqueId}`;

      // //Every window has a hidden glass pane that is revealed when the window is hidden
      this.secGlassPaneContainer = WindowStyleHelper.createSilhouette(this.uniqueGlassPaneId, this.renderer, this.secGlassPaneContainer,
         this.windowHeightPx, this.windowWidthPx);

      this.setSilhouetteState();
    }

    setSilhouetteState():void{
      WindowStyleHelper.updateState({
        renderer: this.renderer, glassPaneContainer: this.secGlassPaneContainer, uniqueGlassPaneId: this.uniqueGlassPaneId,
        windowLeftPx: this.windowLeftPx, windowTopPx: this.windowTopPx,
      });
    }

    showSilhouette(pId: number): void {
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

    updateWindowZIndex(window: WindowState, zIndex:number):void{
      if (this.processId !== window.pId) return;

      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
      window.zIndex = zIndex;
      this._windowService.addWindowState(window);
    }

    setWindowToPriorHiddenState(ws: WindowState, zIndex: number): void {
      if(this.processId !== ws.pId) return;

      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
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
      this.setSilhouetteState();
      WindowStyleHelper.positionSilhouette();

      // Important: reset the drag transform so we don't accumulate drift
      event.source.reset();
      this._windowService.windowDragIsInActive.next();
    }

    centerNotificationWindowWithinCallingProcess():void{
      const primWindElmnt = document.getElementById(`primWinCmpnt-${this.callingProcessUId}`) as HTMLElement;
      if(!primWindElmnt) return;

      const winRect = primWindElmnt.getBoundingClientRect();
      this.windowTopPx = winRect.y + (winRect.height * 0.25);
      this.windowLeftPx = winRect.x + (winRect.width * 0.25);

      setTimeout(() => { 
        this.applyPositionStyles()
        this.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
        this.setHeaderActive(this.processId); }, 1);
    }

    setHideAndShowAllVisibleWindows():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || ws.pId !== this.processId) return;

      this.windowHide = !this.windowHide;

      if(ws.isVisible && this.windowHide){
        ws.isVisible = false;
        ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);

        this.setHeaderInActive(ws.pId);
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
      }
      else if(!ws.isVisible && !this.windowHide ){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();

        if(windowList.includes(this.processId)){
          ws.isVisible = true;
          this._windowService.addWindowState(ws);

          const window_with_highest_zIndex = this._windowService.getProcessWindowIDWithHighestZIndex();
          if(window_with_highest_zIndex === this.processId){
            this.setFocsuOnThisWindow(ws.pId);
            this._windowService.currentProcessInFocusNotify.next(ws.pId);
          }
          else{
            this.setWindowToPriorHiddenState(ws, WindowConstants.MIN_Z_INDEX);
          }
        }
      }
    }

    resetHideShowWindowsList():void{
      this._windowService.resetHiddenOrVisibleWindowsList();
      this._menuService.updateTaskBarContextMenu.next();
    }

    onCloseBtnClick(evt:MouseEvent):void{
      evt.stopPropagation();
      this.closeWindow();
    }

    closeWindow(): void {
      this._windowService.removeWindowState(this.processId);
      this.setSilhouetteState();
      WindowStyleHelper.removeSilhouette();

      if(this.isDialogContent) //Close dialog or process
        this._userNotificationServices.closeDialogMsgBox(this.processId);
      else {
        const process = this._runningProcessService.getProcess(this.processId);
        if(process)
          this._processHandlerService.closeApplicationProcess(process);
      }
      this._windowService.cleanupWindowDataForApp(this.uniqueId);
      const nextProc = this.getNextProcess();
      if(!nextProc) return;

      this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
      this._windowService.currentProcessInFocusNotify.next(nextProc.getProcessId);
    }

    setFocsuOnThisWindow(pId:number):void{
      const uId =`${this.name}-${pId}`;
      if(this.uniqueId !== uId || this.windowHide) return;

      this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
      this.setWindowToFocusByPid(pId);
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
          }else{
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
        }else{
          this.setHeaderActive(ws.pId);
          this.updateWindowZIndex(ws, WindowConstants.MAX_Z_INDEX);
        }
      } else if(!ws.isVisible){
        this.setWindowToPriorHiddenState(ws, WindowConstants.HIDDEN_Z_INDEX);
      }
    }

    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(pId);
      if(!ws || !ws.isVisible) return;

      this.setFocsuOnThisWindow(ws.pId);
    }

    setWindowToFocusByPid(pId:number):void{
      if(this.processId !== pId) return;

      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || !ws.isVisible) return;

      this.setFocusOnWindowAndUpdateStates(ws.pId);
    }

    private setFocusOnWindowAndUpdateStates(pId:number):void{
      const ws = this._windowService.getWindowState(pId);
      const winCmpntId =`secWinCmpnt-${this.name}-${this.processId}`;

      if(!ws || ws.pId !== pId) return;

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
        this.setHeaderActive(pId);
         this.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
        WindowHelper.setFocusOnDiv(winCmpntId);
      } 
    }


    showOnlyWindowById(pId: number): void {
      const ws = this._windowService.getWindowState(pId);
      if (!ws || ws.pId !== pId) return;

      const z = WindowConstants.TMP_MAX_Z_INDEX;
      this.applyOpacityZ(z, 1);
    }

    lockScreenIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (ws && ws.isVisible) {
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
      }
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
      const nextPId = this._windowService.getNextPidInWindowStateList();
      return this._runningProcessService.getProcesses().find(p => p.getProcessId === nextPId);
    }
}