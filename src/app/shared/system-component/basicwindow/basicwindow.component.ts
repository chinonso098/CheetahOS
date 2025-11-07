import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';

import { MenuService } from '../../system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import {Subscription } from 'rxjs';
import { WindowState  } from '../window/windows.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';


@Component({
  selector: 'cos-basicwindow',
  templateUrl: './basicwindow.component.html',
  styleUrl: './basicwindow.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
 export class BasicWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('bdivWindow') bdivWindow!: ElementRef;
   @ViewChild('bglassPaneContainer') bglassPaneContainer!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = Constants.EMPTY_STRING;  
   @Input() displayMessage = Constants.EMPTY_STRING;  
   @Input() processAppName = Constants.EMPTY_STRING;  
   @Input() isDialog = false;  

   private _runningProcessService:RunningProcessService;
   private _systemNotificationServices:SystemNotificationService;
   private _windowService:WindowService;
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

  readonly HIDDEN_Z_INDEX = 0;
  readonly MIN_Z_INDEX = 1;
  readonly MAX_Z_INDEX = 2;
  readonly TMP_MAX_Z_INDEX = 3;

  windowHide = false;
  windowMaximize = false;

  windowWidth = '0px';
  windowHeight = '0px';
  windowZIndex = '0';

  xAxisTmp = 0;
  yAxisTmp = 0;

  // windowTop = Constants.ZERO;
  // windowLeft = Constants.ZERO;

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
      this._closeCurrentProcessSub = this._windowService.closeWindowProcessNotify.subscribe((p) => {
          if(this.processId === p){
            this.closeWindow();
          }});

      this._showTheDesktopSub = this._menuService.showTheDesktop.subscribe(() => {this.setHideAndShowAllVisibleWindows()});
      this._showOpenWindowsSub = this._menuService.showOpenWindows.subscribe(() => {this.setHideAndShowAllVisibleWindows()});
    }

    get getDivWindowElement(): HTMLElement {
      return this.bdivWindow.nativeElement;
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
      this.defaultHeightOnOpen = this.getDivWindowElement.offsetHeight;
      this.defaultWidthOnOpen  = this.getDivWindowElement.offsetWidth;

      this.windowHeight =  `${String(this.defaultHeightOnOpen)}px`;
      this.windowWidth =  `${String(this.defaultWidthOnOpen)}px`;
      this.windowZIndex =  String(this.MAX_Z_INDEX);

      this._originalWindowsState = {
        appName: this.name,
        pId : this.processId,
        height:this.defaultHeightOnOpen,
        width: this.defaultWidthOnOpen,
        xAxis: 0,
        yAxis: 0,
        zIndex:this.MAX_Z_INDEX,
        isVisible:true
      }

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();

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

    showSilhouette(pId:number):void{
      if(this.processId === pId){
        this.showGlassPaneContainer();
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if(glassPane){
          glassPane.style.position = 'absolute';
          glassPane.style.display = 'block';
          glassPane.style.zIndex = String(this.MIN_Z_INDEX);
          // glassPane.style.top =  `${this.windowTop}%`;
          // glassPane.style.left =  `${this.windowLeft}%`;
        }
      }
    }

    showGlassPaneContainer() {
      this.renderer.setStyle(this.bglassPaneContainer.nativeElement, 'display', 'block');
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
      this.renderer.setStyle(this.bglassPaneContainer.nativeElement, 'display', 'none');
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
      if(this.processId === window.pId){
        this.currentWinStyles = {
          // 'top': `${this.windowTop}%`,
          // 'left': `${this.windowLeft}%`,
          'z-index':zIndex,
          'opacity': (zIndex > 0)? 1 : 0,
          'transform': `translate(${window.xAxis}px, ${window.yAxis}px)`
        };
        window.zIndex = zIndex;
        this._windowService.addWindowState(window);
      }
    }

    setWindowToPriorHiddenState(window: WindowState, zIndex:number):void{
      if(this.processId === window.pId){
        this.currentWinStyles = {
          // 'top': `${this.windowTop}%`,
          // 'left': `${this.windowLeft}%`,
          'z-index':zIndex,
          'opacity': (zIndex > 0)?  1 : 0,
          'transform': `translate(${window.xAxis}px, ${window.yAxis}px)`
        };
      }
    }

    onDragEnd(input:HTMLElement):void{
      const style = window.getComputedStyle(input);
      const matrix1 = new WebKitCSSMatrix(style.transform);
      const x_axis = matrix1.m41;
      const y_axis = matrix1.m42;

      //ignore false drag
      if( x_axis!== 0  && y_axis !== 0){
        const windowState = this._windowService.getWindowState(this.processId);
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;

        if(windowState){
          windowState.xAxis= x_axis;
          windowState.yAxis= y_axis;

          this.xAxisTmp = x_axis;
          this.yAxisTmp = y_axis;  
          this._windowService.addWindowState(windowState);
        }

        if(glassPane){
          glassPane.style.transform = `translate(${x_axis}px , ${y_axis}px)`;   
        }
      }
      this._windowService.windowDragIsInActive.next();
    }

    onDragStart(pId:number):void{
      this.setFocsuOnThisWindow(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
      this._windowService.windowDragIsActive.next();
    }

    setHideAndShowAllVisibleWindows():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState && windowState.isVisible){
        this.windowHide = !this.windowHide;
        // CSS styles: set per current state of component properties

        if(this.windowHide){
          if(windowState.pId === this.processId){
            windowState.isVisible = false;
            windowState.zIndex = this.HIDDEN_Z_INDEX;
            this._windowService.addWindowState(windowState);
            this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);
  
            this.setHeaderInActive(windowState.pId);
            this.currentWinStyles = { 
              // 'top': `${this.windowTop}%`,
              // 'left': `${this.windowLeft}%`,
              'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
              'z-index':this.HIDDEN_Z_INDEX 
            };
          }
        }
      }else if(windowState && !windowState.isVisible){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();
        if(windowList.includes(this.processId)){
          this.windowHide = !this.windowHide;

          if(!this.windowHide){
            if(windowState.pId === this.processId){
              windowState.isVisible = true;
              this._windowService.addWindowState(windowState);

              const window_with_highest_zIndex = this._windowService.getProcessWindowIDWithHighestZIndex();
              if(window_with_highest_zIndex === this.processId){
                this.setFocsuOnThisWindow(windowState.pId);
                this._windowService.currentProcessInFocusNotify.next(windowState.pId);
              }else{
                this.setWindowToPriorHiddenState(windowState, this.MIN_Z_INDEX);
              }
            }
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
      this.renderer.appendChild(this.bglassPaneContainer.nativeElement, glassPane);
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
        if(windowState){
          if(windowState.isVisible){
            this.setHeaderInActive(windowState.pId);
            this.updateWindowZIndex(windowState, this.MIN_Z_INDEX);
          }
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

      if(window){
        if(window.isVisible){
          if(window.pId !==  pid_with_highest_z_index){
            this.setHeaderInActive(window.pId);
            this.updateWindowZIndex(window, this.MIN_Z_INDEX);
          }else{
            this.setHeaderActive(window.pId);
            this.updateWindowZIndex(window, this.MAX_Z_INDEX);
          }
        } else if(!window.isVisible){
          this.setWindowToPriorHiddenState(window, this.HIDDEN_Z_INDEX);
        }
      }
    }

    //the window positioning is acting wonky, but it is kinda 50% there
    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      if(this.processId === pId){
        const windowState = this._windowService.getWindowState(pId);
        if(windowState){
          this.setFocsuOnThisWindow(windowState.pId);
        }
      }
    }

    setWindowToFocusAndResetWindowBoundsByPid(pId:number):void{
      if(this.processId === pId){
        const window = this._windowService.getWindowState(this.processId);
        if(window && window.isVisible){
          this.setWindowToFocusById(window.pId);
        }
      }
    }

    setWindowToFocusById(pId:number):void{
      const windowState = this._windowService.getWindowState(pId);
      if(windowState){
        if((windowState.pId === pId) && (windowState.zIndex < this.MAX_Z_INDEX)){
          windowState.zIndex = this.MAX_Z_INDEX;
          this._windowService.addWindowState(windowState);
          this._windowService.addProcessWindowIDWithHighestZIndex(pId);

          this.currentWinStyles = {
            // 'top': `${this.windowTop}%`,
            // 'left': `${this.windowLeft}%`,
            'z-index':this.MAX_Z_INDEX,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`
          };

          this.setHeaderActive(pId);
          this.setFocusOnDiv();
        }else if((windowState.pId === pId) && (windowState.zIndex === this.MAX_Z_INDEX)){
          this._windowService.addProcessWindowIDWithHighestZIndex(pId);

          this.setHeaderActive(pId);
          this.setFocusOnDiv();
        }  
      }
    }

    setFocusOnDiv():void{
      const winCmpntId =`bwincmpnt-${this.name}-${this.processId}`;
      const winCmpnt = document.getElementById(winCmpntId) as HTMLDivElement;
      
      if(winCmpnt){
        winCmpnt.focus();
      }
    }

    showOnlyWindowById(pId:number):void{
      const windowState = this._windowService.getWindowState(pId);

      if(windowState && (windowState.pId === pId)){
        const z_index = this.TMP_MAX_Z_INDEX;
        if(!windowState.isVisible){
          this.currentWinStyles = {
            // 'top': `${this.windowTop}%`,
            // 'left': `${this.windowLeft}%`,
            'z-index':z_index,
            'opacity': 1,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`
          };
        }else{
          this.currentWinStyles = {
            // 'top': `${this.windowTop}%`,
            // 'left': `${this.windowLeft}%`,
            'z-index':z_index,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`
          };
        }
      }
    }

    lockScreenIsActive():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState && windowState.isVisible){
        this.currentWinStyles = {
          // 'top': `${this.windowTop}%`,
          // 'left': `${this.windowLeft}%`,
          'z-index':this.HIDDEN_Z_INDEX,
          'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
          'opacity': 0,
        };
        this._windowService.addWindowState(windowState);   
      }
    }

    desktopIsActive():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState){
        if(windowState.pId === this._windowService.getProcessWindowIDWithHighestZIndex()){
          this.currentWinStyles = {
            // 'top': `${this.windowTop}%`,
            // 'left': `${this.windowLeft}%`,
            'z-index':this.MAX_Z_INDEX,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
            'opacity': 1
          };
        }else{
          this.currentWinStyles = {
            // 'top': `${this.windowTop}%`,
            // 'left': `${this.windowLeft}%`,
            'z-index':this.MIN_Z_INDEX,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
            'opacity': 1
          };
        }
        this._windowService.addWindowState(windowState);   
      }
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