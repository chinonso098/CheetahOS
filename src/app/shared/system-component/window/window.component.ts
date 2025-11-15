/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import {Subscription } from 'rxjs';
import { WindowBoundsState, WindowState } from './windows.types';
import {openCloseAnimation, hideShowAnimation, minimizeMaximizeAnimation} from 'src/app/shared/system-component/window/animation/animations';
import { AnimationEvent } from '@angular/animations';

import { Process } from 'src/app/system-files/process';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { MenuService } from '../../system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { WindowPositionInfo, WindowResizeInfo } from 'src/app/system-files/common.interfaces';

 @Component({
   selector: 'cos-window',
   templateUrl: './window.component.html',
   animations: [openCloseAnimation,hideShowAnimation,minimizeMaximizeAnimation],
   styleUrls: ['./window.component.css'],
   standalone:false,
 })
 export class WindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('divWindow') divWindow!: ElementRef;
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
  readonly WIN_TOP = 25;
  readonly WIN_LEFT = 25;

  windowHide = false;
  windowMaximize = false;
  disableWindowAnimaion = false;
  windowOpenCloseAction = 'open';
  windowHideShowAction = 'visible';
  windowMinMaxAction = 'minimized';

  windowTransform =  'translate(0,0)';
  windowTransform0p =   'translate(0,0)';
  windowTransform50p =  'translate(-50px,50px)';
  windowTransform100p = 'translate(-100px,100px)';

  yAxis0p =   'translate(0,0)';
  yAxis50p =  'translate(0,50px)';
  yAxis100p = 'translate(0,100px)';

  windowWidth = '0px';
  windowHeight = '0px';
  windowZIndex = '0';
  hsZIndex = 2;

  xAxisTmp = 0;
  yAxisTmp = 0;

  windowTop = 0;
  windowLeft = 0;

  isWindowMaximizable = true;
  isWindowMinimizable = true;
  currentWindowSizeState = false;
  currentStyles: Record<string, unknown> = {};
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

    get getDivWindowElement(): HTMLElement {
      return this.divWindow.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.retrievePastSessionData();

      if(!this.turnOffWindowOpenCloseAnimation)
        this.windowOpenCloseAction = 'open';

      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      setTimeout(() => {
        if(!this.turnOffWindowStacking)
          this.stackWindow(); 

        this.setFocusOnWindowInit(this.processId)
      }, 0);

      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      this.defaultHeightOnOpen = this.getDivWindowElement.offsetHeight;
      this.defaultWidthOnOpen  = this.getDivWindowElement.offsetWidth;

      if(this.turnOffWindowOpenCloseAnimation)
        this.windowTransform =  'translate(-50%, -50%)';
      else
        this.windowTransform =  'translate(0, 0)';

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

    showSilhouette(pId:number):void{
      if(this.processId === pId){
        this.showGlassPaneContainer();
        const glassPane= document.getElementById(this.uniqueGPId) as HTMLDivElement;
        if(glassPane){
          glassPane.style.position = 'absolute';
          glassPane.style.display = 'block';
          glassPane.style.zIndex = String(this.MIN_Z_INDEX);
          glassPane.style.top =  `${this.windowTop}%`;
          glassPane.style.left =  `${this.windowLeft}%`;
        }
      }
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
      if(this.processId === window.pId){
        this.currentStyles = {
          'top': `${this.windowTop}%`,
          'left': `${this.windowLeft}%`,
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
        this.currentStyles = {
          'top': `${this.windowTop}%`,
          'left': `${this.windowLeft}%`,
          'z-index':zIndex,
          'opacity': (zIndex > 0)?  1 : 0,
          'transform': `translate(${window.xAxis}px, ${window.yAxis}px)`
        };
      }
    }

    onMaximizeBtnClick(evt:MouseEvent):void{
      evt.stopPropagation();

      if(this.isWindowMaximizable){
        this.windowMaximize = true;
        this.windowMinMaxAction = 'maximized';
        this.setMaximizeAndUnMaximize();
      }
    }

    onUnMaximizeBtnClick(evt:MouseEvent):void{
      evt.stopPropagation();

      this.windowMaximize = false;
      this.windowMinMaxAction = 'minimized';
      this.setMaximizeAndUnMaximize();
    }

    onTitleBarDoubleClick(evt:MouseEvent):void{
      evt.stopPropagation();
      console.log('this featured is turned off');

      // if(this.isWindowMaximizable){
      //   if(this.currentWindowSizeState && !this.windowMaximize){
      //     this.windowMaximize = false;
      //     this.windowMinMaxAction = 'minimized';
      //   }else{
      //     this.windowMaximize = true;
      //     this.windowMinMaxAction = 'maximized';
      //   }
      //   this.setMaximizeAndUnMaximize()
      // }
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
          this.windowTransform = `translate(${x_axis}px , ${y_axis}px)`;    
          this._windowService.addWindowState(windowState);

          this.resetWindowBoundsState();
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

    onRZStop(input:any):void{
      const height = Number(input.size.height);
      const width = Number(input.size.width);

      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState){
        windowState.width= width;
        windowState.height= height;
  
        this.windowWidth = `${width}px`;
        this.windowHeight = `${height}px`;
  
        this._windowService.addWindowState(windowState);

        //send window resize alert(containing new width and height);
        const resize:WindowResizeInfo = {pId:this.processId, width:width, height:height}
        this._windowService.resizeProcessWindowNotify.next(resize);
      }
    }

    onRZWindow(input:WindowResizeInfo):void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(!windowState) return;
        
      windowState.width= input.width;
      windowState.height= input.height;

      this.windowWidth = `${input.width}px`;
      this.windowHeight = `${input.height}px`;

      this._renderer.setStyle(this.divWindow.nativeElement, 'width', this.windowWidth);
      this._renderer.setStyle(this.divWindow.nativeElement, 'height', this.windowHeight);

      this._windowService.addWindowState(windowState);
    
    }

    onPositionWindow(input:WindowPositionInfo):void{
      console.log('onPositionWindow-main window:', input);

      this.windowTop = input.top;
      this.windowLeft = input.left;
      //this.windowTransform = input.transform;

      this.currentStyles = { 
        'top': `${input.top}%`,
        'left': `${input.left}%`,
        'transform': input.transform,
      };
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

      const windowState = this._windowService.getWindowState(this.processId);

      if(this.windowHide && windowState){
        if(windowState.pId === this.processId){
          windowState.isVisible = false;
          windowState.zIndex = this.HIDDEN_Z_INDEX;
          this._windowService.addWindowState(windowState);

          setTimeout(() => {
            this.setHeaderInActive(windowState.pId);
            this.currentStyles = { 
              'top': `${this.windowTop}%`,
              'left': `${this.windowLeft}%`,
              'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
              'z-index':this.HIDDEN_Z_INDEX 
            };
            const nextProc = this.getNextProcess();
            if(nextProc){
              this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
              this._windowService.currentProcessInFocusNotify.next(nextProc.getProcessId);
            }else{
              this._windowService.noProcessInFocusNotify.next();
            }
          }, delay);
        }
      }
      else if(!this.windowHide && windowState){
        if(windowState.pId === this.processId){
          if(this.currentWindowSizeState){ 
            // if window was in full screen when hidden, give the proper z-index when unhidden
            this.setWindowToFullScreen(this.processId, windowState.zIndex);
          }
          windowState.isVisible = true;
          this._windowService.addWindowState(windowState);
          this.setFocsuOnThisWindow(windowState.pId);

          console.log('call currentProcessInFocusNotify')
          this._windowService.currentProcessInFocusNotify.next(windowState.pId);
          this.resetHideShowWindowsList();
        }
      }
    }

    setHideAndShowAllVisibleWindows():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState && windowState.isVisible){
        this.windowHide = !this.windowHide;
        this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
        this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);
        // CSS styles: set per current state of component properties

        if(this.windowHide){
          if(windowState.pId === this.processId){
            windowState.isVisible = false;
            windowState.zIndex = this.HIDDEN_Z_INDEX;
            this._windowService.addWindowState(windowState);
            this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);
  
            this.setHeaderInActive(windowState.pId);
            this.currentStyles = { 
              'top': `${this.windowTop}%`,
              'left': `${this.windowLeft}%`,
              'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
              'z-index':this.HIDDEN_Z_INDEX 
            };
          }
        }
      }else if(windowState && !windowState.isVisible){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();
        if(windowList.includes(this.processId)){
          this.windowHide = !this.windowHide;
          this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
          this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);

          if(!this.windowHide){
            if(windowState.pId === this.processId){
              if(this.currentWindowSizeState){ 
                // if window was in full screen when hidden, give the proper z-index when unhidden
                this.setWindowToFullScreen(this.processId, windowState.zIndex);
              }
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

    setMaximizeAndUnMaximize():void{
      const windowState = this._windowService.getWindowState(this.processId);
      this.currentWindowSizeState = this.windowMaximize;

      if(this.windowMaximize){
        if(windowState){
          if(windowState.pId === this.processId){
            this.setWindowToFullScreen(this.processId, windowState.zIndex);
  
            this._windowService.addEventOriginator(this.uniqueId);
            this._windowService.maximizeProcessWindowNotify.next();
          }
        }
      }
      else if(!this.windowMaximize){
        if(windowState){
          if(windowState.pId === this.processId){
            this.windowWidth = `${String(windowState.width)}px`;
            this.windowHeight = `${String(windowState.height)}px`;
            this.windowTransform =  `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`;
            this.windowZIndex =   String(windowState.zIndex);
  
            const windowTitleBarHeight = 30;
            this._windowService.addEventOriginator(this.uniqueId);
            this._windowService.minimizeProcessWindowNotify.next([windowState.width, windowState.height - windowTitleBarHeight]);
          }
        }
      }

      this.windowMaximize = !this.windowMaximize;
    }

    stackWindow():void{
      let newTop = this.WIN_TOP;
      let newLeft = this.WIN_LEFT;
      let mainWindowWidth = 0;
      let adjMainWindowWidth = 0;
      let mainWindowHeight = 0;
      let adjMainWindowHeight = 0;

      const offset = 2;
      const taskBarHeight = 40;

      const currentBound = this._windowService.getProcessWindowBounds(this.uniqueId);
      if(currentBound){
        const newXVal = currentBound.xOffset + offset;
        const newYVal = currentBound.yOffset + offset;
        newLeft = newXVal, newTop = newYVal;
        currentBound.xOffset = newXVal;
        currentBound.yOffset = newYVal;

        this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
      }else{
        const windowBound:WindowBoundsState = {xOffset:this.WIN_LEFT, yOffset:this.WIN_TOP, xBoundsSubtraction:0, yBoundsSubtraction:0};
        this._windowService.addProcessWindowBounds(this.uniqueId, windowBound);
      }

      // Ensure they don’t go out of bounds
      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
      const mainWindow = document.getElementById('vantaCntnr')?.getBoundingClientRect();
      const winCmpnt = document.getElementById(winCmpntId)?.getBoundingClientRect();

      if(mainWindow && winCmpnt){
        mainWindowWidth = mainWindow.width;   
        //get the starting point of the window in x-axis
        const startingPointXAxis = ((mainWindowWidth * newLeft) / 100);
        // assuming we don't move the window around, every new window will start from the point.
        adjMainWindowWidth = mainWindowWidth - startingPointXAxis;
        const availableHorizontalRoom = adjMainWindowWidth - winCmpnt.width;
  
        mainWindowHeight = mainWindow.height;
        //get the starting point of the window in x-axis
        const startingPointYAxis = ((mainWindowHeight * newTop) / 100);
        // assuming we don't move the window around, every new window will start from the point.
        adjMainWindowHeight = mainWindowHeight - startingPointYAxis; 
        const availableVerticalRoom = adjMainWindowHeight - taskBarHeight - winCmpnt.height;
  
        // handle out of bounds
        if((availableVerticalRoom < 0) || (availableHorizontalRoom < 0)){
          //horizontally out of bounds
          if(availableHorizontalRoom < 0){
            const  leftSubtraction = (currentBound?.xBoundsSubtraction || 0) - offset;
            const resetLeft = this.WIN_LEFT - (leftSubtraction * -1);
            newLeft = resetLeft;
            newTop = this.WIN_TOP;
            if(currentBound){
              currentBound.xOffset = resetLeft;
              currentBound.yOffset = this.WIN_TOP;
              currentBound.xBoundsSubtraction = leftSubtraction;
              this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
            }
          }
  
          //vertinally out of bounds
          if(availableVerticalRoom < 0){
            const  topSubtraction = (currentBound?.yBoundsSubtraction || 0) - offset;
            const resetTop = this.WIN_TOP - (topSubtraction * -1);
            newTop = resetTop;
            newLeft = this.WIN_LEFT;
            if(currentBound){
              currentBound.yOffset = resetTop;
              currentBound.xOffset = this.WIN_LEFT;
              currentBound.yBoundsSubtraction = topSubtraction;
              this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
            }
          }
        }
      }

      this.windowTop = newTop;
      this.windowLeft = newLeft;

      this.currentStyles = {
        'top': `${newTop}%`,
        'left': `${newLeft}%`,
        // 'z-index':this.MAX_Z_INDEX
      };
    }

    resetWindowBoundsState():void{
      let newLeft = 0;
      let newTop = 0;

      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
      const mainWindow = document.getElementById('vantaCntnr')?.getBoundingClientRect();
      const winCmpnt = document.getElementById(winCmpntId)?.getBoundingClientRect();
      const currentBound = this._windowService.getProcessWindowBounds(this.uniqueId);

      if(winCmpnt && mainWindow){
        newTop = ((winCmpnt.top / mainWindow.height) * 100);
        newLeft = ((winCmpnt.left / mainWindow.width) * 100);

        if(currentBound){
          currentBound.xOffset = newLeft;
          currentBound.yOffset = newTop
          currentBound.xBoundsSubtraction = 0;
          currentBound.yBoundsSubtraction = 0;

          this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
        }
      }
    }

    createSilhouette():void{
      this.uniqueGPId = `gp-${this.uniqueId}`;
      //Every window has a hidden glass pane that is revealed when the window is hidden
      const glassPane = this._renderer.createElement('div');

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
      this._renderer.appendChild(this.glassPaneContainer.nativeElement, glassPane);
    }

    onCloseBtnClick(evt:MouseEvent):void{
      evt.stopPropagation();

      if(!this.turnOffWindowOpenCloseAnimation){
        this.windowOpenCloseAction = 'close';
        this.generateCloseAnimationValues(this.xAxisTmp, this.yAxisTmp);
      }

      this._windowService.removeWindowState(this.processId);
      this.removeSilhouette(this.processId);

      setTimeout(()=>{
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
      },this.SECONDS_DELAY) ;
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
        this.resetWindowBoundsState();
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
          if(!windowState.isVisible){
            this.restoreHiddenWindow(pId);
          }else{
            this.setFocsuOnThisWindow(windowState.pId);
          }
        }
      }
    }

    setWindowToFocusAndResetWindowBoundsByPid(pId:number):void{
      if(this.processId === pId){
        const window = this._windowService.getWindowState(this.processId);
        if(window && window.isVisible){
          this.setWindowToFocusById(window.pId);
  
          //reset window bound when a window is closed or hidden.
          this.resetWindowBoundsState();
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

          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
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
      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
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
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':z_index,
            'opacity': 1,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`
          };
        }else{
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':z_index,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`
          };
        }
      }
    }

    lockScreenIsActive():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState && windowState.isVisible){
        this.currentStyles = {
          'top': `${this.windowTop}%`,
          'left': `${this.windowLeft}%`,
          'z-index':this.HIDDEN_Z_INDEX,
          'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
          'opacity': 0,
        };
        this._windowService.addWindowState(windowState);   
      }
    }

    desktopIsActive():void{
      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState && windowState.isVisible){
        if(windowState.pId === this._windowService.getProcessWindowIDWithHighestZIndex()){
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':this.MAX_Z_INDEX,
            'transform': `translate(${windowState.xAxis}px, ${windowState.yAxis}px)`,
            'opacity': 1
          };
        }else{
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
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