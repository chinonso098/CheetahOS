import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges } from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { of, Subscription } from 'rxjs';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { BaseState } from 'src/app/system-files/state/state.interface';
import { WindowBoundsState, WindowState } from './windows.types';
import {openCloseAnimation, hideShowAnimation, minimizeMaximizeAnimation} from 'src/app/shared/system-component/window/animation/animations';

import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Process } from 'src/app/system-files/process';

 @Component({
   selector: 'cos-window',
   templateUrl: './window.component.html',
   animations: [openCloseAnimation,hideShowAnimation,minimizeMaximizeAnimation],
   styleUrls: ['./window.component.css']
 })
 export class WindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
   @ViewChild('divWindow') divWindow!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = '';  
   @Input() processAppName = '';  
   @Input() isMaximizable = true;  
   
   private _runningProcessService:RunningProcessService;
   //private _stateManagmentService: StateManagmentService;
   private _sessionManagmentService: SessionManagmentService;
   private _windowService:WindowService;
   private _originalWindowsState!:WindowState;

   private _restoreOrMinSub!:Subscription
   private _focusOnNextProcessSub!:Subscription;
   private _focusOnCurrentProcessSub!:Subscription;
   private _showOnlyCurrentProcessSub!:Subscription;
   private _removeFocusOnOtherProcessesSub!:Subscription;
   private _hideOtherProcessSub!:Subscription;
   private _restoreProcessSub!:Subscription
   private _restoreProcessesSub!:Subscription

  readonly SECONDS_DELAY = 450;
  readonly WINDOW_CAPTURE_SECONDS_DELAY = 5000;
  readonly HIDDEN_Z_INDEX = 0;
  readonly MIN_Z_INDEX = 1;
  readonly MAX_Z_INDEX = 2;
  readonly TMP_MAX_Z_INDEX = 3;
  readonly WIN_TOP = 25;
  readonly WIN_LEFT = 25;

  windowHide = false;
  windowMaximize = false;
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

  xAxisTmp = 0;
  yAxisTmp = 0;

  windowTop = 0;
  windowLeft = 0;

  isWindowMaximizable = true;
  currentWindowSizeState = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};
  defaultWidthOnOpen = 0;
  defaultHeightOnOpen = 0;
  private readonly z_index = '25914523'; // this number = zindex
  //private pid_with_highest_z_index = 0;

  hasWindow = false;
  icon = '';
  name = 'Window';
  processId = 0;
  uniqueId = '';
  type = ComponentType.System;
  displayName = '';
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, 
                windowService:WindowService, sessionManagmentService: SessionManagmentService){
      this._runningProcessService = runningProcessService;
      this._sessionManagmentService = sessionManagmentService;
      this._windowService = windowService;
 
      this.retrievePastSessionData();

      this._restoreOrMinSub = this._windowService.restoreOrMinimizeProcessWindowNotify.subscribe((p) => {this.restoreHiddenWindow(p)});
      this._focusOnNextProcessSub = this._windowService.focusOnNextProcessWindowNotify.subscribe((p) => {this.setWindowToFocusAndResetWindowBoundsByPid(p)});
      this._focusOnCurrentProcessSub = this._windowService.focusOnCurrentProcessWindowNotify.subscribe((p) => {this.setFocsuOnThisWindow(p)});
      this._removeFocusOnOtherProcessesSub = this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindowNotMatchingPid(p)});
      this._showOnlyCurrentProcessSub = this._windowService.setProcessWindowToFocusOnMouseHoverNotify.subscribe((p) => {this.setWindowToFocusOnMouseHover(p)});
      this._hideOtherProcessSub = this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.hideWindowNotMatchingPidOnMouseHover(p)});
      this._restoreProcessSub = this._windowService.restoreProcessWindowOnMouseLeaveNotify.subscribe((p) => {this.restoreWindowOnMouseLeave(p)});
      this._restoreProcessesSub = this._windowService.restoreProcessesWindowNotify.subscribe(() => {this.restorePriorFocusOnWindows()});
    }

    get getDivWindowElement(): HTMLElement {
      return this.divWindow.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.isWindowMaximizable = this.isMaximizable;

      this.windowOpenCloseAction = 'open';
      this.uniqueId = `${this.name}-${this.processId}`;
      setTimeout(() => {
        this.stackWindow(); 
        this.setFocusOnWindowInit(this.processId)
      }, 0);

      this._windowService.addProcessWindowToWindows(this.uniqueId ); 
    }

    ngAfterViewInit():void{
      this.defaultHeightOnOpen = this.getDivWindowElement.offsetHeight;
      this.defaultWidthOnOpen  = this.getDivWindowElement.offsetWidth;

      this.windowTransform =  'translate(0, 0)';
      this.windowHeight =  `${String(this.defaultHeightOnOpen)}px`;
      this.windowWidth =  `${String(this.defaultWidthOnOpen)}px`;
      this.windowZIndex =  String(this.MAX_Z_INDEX);

      this._originalWindowsState = {
        app_name: this.name,
        pid : this.processId,
        height:this.defaultHeightOnOpen,
        width: this.defaultWidthOnOpen,
        x_axis: 0,
        y_axis: 0,
        z_index:this.MAX_Z_INDEX,
        is_visible:true
      }

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);

      //tell angular to run additional detection cycle after 
      this.changeDetectorRef.detectChanges();

      //setTimeout(()=>{ /**When i get this working as it should, i will remove the other capture methods */
      //  this.captureComponentImg();
      //},this.WINDOW_CAPTURE_SECONDS_DELAY);
  
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
    }

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);

      if(this.name == "Window")
          this.name = this.processAppName;

      this.displayName = this.processAppName;
      this.icon = this.processAppIcon;
    }


    captureComponentImg():void{
      htmlToImage.toPng(this.divWindow.nativeElement).then(htmlImg =>{
  
        const cmpntImg:TaskBarPreviewImage = {
          pid: this.processId,
          imageData: htmlImg
        }
        this._windowService.addProcessPreviewImage(this.name, cmpntImg);
      })
    }


    setHideAndShow():void{
      this.windowHide = !this.windowHide;
      this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
      this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);
      // CSS styles: set per current state of component properties

      const windowState = this._windowService.getWindowState(this.processId);

      if(this.windowHide && windowState){
        if(windowState.pid == this.processId){
          windowState.is_visible = false;
          windowState.z_index = this.MIN_Z_INDEX;
          this._windowService.addWindowState(windowState);

          this.setHeaderInActive(windowState.pid);
          this.currentStyles = { 
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':this.MIN_Z_INDEX 
          };

          const nextProc = this.getNextProcess();
          if(nextProc){
            this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
          }
        }
      }
      else if(!this.windowHide && windowState){
        if(windowState.pid == this.processId){
          if(this.currentWindowSizeState){ 
            // if window was in full screen when hidden, give the proper z-index when unhidden
            this.setWindowToFullScreen(this.processId, windowState.z_index);
          }
          windowState.is_visible = true;
          this._windowService.addWindowState(windowState);
          //this.setFocsuOnThisWindow(windowState.pid );
        }
      }
    }

    setMaximizeAndUnMaximize():void{
      const windowState = this._windowService.getWindowState(this.processId);
      this.currentWindowSizeState = this.windowMaximize;

      if(this.windowMaximize){
        if(windowState){
          if(windowState.pid == this.processId){
            this.setWindowToFullScreen(this.processId, windowState.z_index);
  
            this._windowService.addEventOriginator(this.uniqueId);
            this._windowService.maximizeProcessWindowNotify.next();
          }
        }
      }
      else if(!this.windowMaximize){
        if(windowState){
          if(windowState.pid == this.processId){
            this.windowWidth = `${String(windowState.width)}px`;
            this.windowHeight = `${String(windowState.height)}px`;
            this.windowTransform =  `translate(${String(windowState.x_axis)}px, ${String(windowState.y_axis)}px)`;
            this.windowZIndex =   String(windowState.z_index);
  
            const windowTitleBarHeight = 30;
            this._windowService.addEventOriginator(this.uniqueId);
            this._windowService.minimizeProcessWindowNotify.next([windowState.width, windowState.height - windowTitleBarHeight]);
          }
        }
      }

      this.windowMaximize = !this.windowMaximize;
    }

    setBtnFocus(pid:number):void{
        if(this.processId == pid){
          this.closeBtnStyles = {
            'background-color':'rgb(139,10,20)'
          };
        }
    }

    setHeaderInActive(pid:number):void{
      if(this.processId == pid){
        this.headerActiveStyles = {
          'background-color':'rgb(56,56,56)'
        };
      }
    }

    setHeaderActive(pid:number):void{

      //console.log('setHeaderActive:',pid);//TBD
      if(this.processId == pid){


      //console.log('setHeaderActive 1:',pid);//TBD
        this.headerActiveStyles = {
          'background-color':'rgb(24,60,124)'
        };
      }
    }

    setWindowToFullScreen(pid:number, z_index:number):void{
      if(this.processId == pid){
        this.windowZIndex =   String(z_index);
      }
    }
   
    onHideBtnClick(pid:number):void{
      if(this.processId == pid){
        this.setHideAndShow();
      }
    }

    restoreHiddenWindow(pid:number):void{
      if(this.processId == pid){
        this.setHideAndShow();
      }
    }

    updateWindowZIndex(window: WindowState, zIndex:number):void{
      //console.log(`updateWindowZIndex-Window app_name: ${window.app_name} ----  Window pid:${window.pid}  ---------- ${this.processId}`);//TBD
      if(this.processId == window.pid){
        this.currentStyles = {
          'top': `${this.windowTop}%`,
          'left': `${this.windowLeft}%`,
          'z-index':zIndex
        };
        window.z_index = zIndex;
        this._windowService.addWindowState(window);
      }
    }

    setWindowToPriorHiddenState(window: WindowState, zIndex:number):void{
      //console.log(`setWindowToPriorHiddenState-Window app_name: ${window.app_name} ----  Window pid:${window.pid}  ---------- ${this.processId}`);//TBD
      if(this.processId == window.pid){
        this.currentStyles = {
          'top': `${this.windowTop}%`,
          'left': `${this.windowLeft}%`,
          'z-index':zIndex,
          'opacity': 0,
        };
      }
    }

    onMaximizeBtnClick():void{
      if(this.isWindowMaximizable){
        this.windowMaximize = true;
        this.windowMinMaxAction = 'maximized';
        this.setMaximizeAndUnMaximize();
      }
    }

    onUnMaximizeBtnClick():void{
      this.windowMaximize = false;
      this.windowMinMaxAction = 'minimized';
      this.setMaximizeAndUnMaximize();
    }

    onTitleBarDoubleClick():void{
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
      if( x_axis!= 0  && y_axis != 0){
        const windowState = this._windowService.getWindowState(this.processId);

        if(windowState){
          windowState.x_axis= x_axis;
          windowState.y_axis= y_axis;

          this.xAxisTmp = x_axis;
          this.yAxisTmp = y_axis;
          this.windowTransform =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;    
          this._windowService.addWindowState(windowState);

          this.resetWindowBoundsState();
        }
      }
    }

    onDragStart(pid:number):void{
      console.log('onDragStart-Started. But this function will also call  setFocusOnWindow()'); //TBD
      //this.resetWindowBoundsState();
      this.setFocsuOnThisWindow(pid);
    }

    onRZStop(input:any):void{
      const height = Number(input.size.height);
      const width = Number(input.size.width);

      const windowState = this._windowService.getWindowState(this.processId);
      if(windowState){
        windowState.width= width;
        windowState.height= height;
  
        this.windowWidth = `${String(width)}px`;
        this.windowHeight = `${String(height)}px`;
  
        this._windowService.addWindowState(windowState);

        //send window resize alert(containing new width and height);
        this._windowService.resizeProcessWindowNotify.next([]);
      }
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

    stackWindow():void{
      console.log('stacking Window');
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
        const newXVal = currentBound.x_offset + offset;
        const newYVal = currentBound.y_offset + offset;
        newLeft = newXVal, newTop = newYVal;
        currentBound.x_offset = newXVal;
        currentBound.y_offset = newYVal;

        this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
      }else{
        const windowBound:WindowBoundsState = {x_offset:this.WIN_LEFT, y_offset:this.WIN_TOP, x_bounds_subtraction:0, y_bounds_subtraction:0};
        this._windowService.addProcessWindowBounds(this.uniqueId, windowBound);
      }

      // Ensure they don’t go out of bounds
      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
      const mainWindow = document.getElementById('vanta')?.getBoundingClientRect();
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
            const  leftSubtraction = (currentBound?.x_bounds_subtraction || 0) - offset;
            const resetLeft = this.WIN_LEFT - (leftSubtraction * -1);
            newLeft = resetLeft;
            newTop = this.WIN_TOP;
            if(currentBound){
              currentBound.x_offset = resetLeft;
              currentBound.y_offset = this.WIN_TOP;
              currentBound.x_bounds_subtraction = leftSubtraction;
              this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
            }
          }
  
          //vertinally out of bounds
          if(availableVerticalRoom < 0){
            const  topSubtraction = (currentBound?.y_bounds_subtraction || 0) - offset;
            const resetTop = this.WIN_TOP - (topSubtraction * -1);
            newTop = resetTop;
            newLeft = this.WIN_LEFT;
            if(currentBound){
              currentBound.y_offset = resetTop;
              currentBound.x_offset = this.WIN_LEFT;
              currentBound.y_bounds_subtraction = topSubtraction;
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
      console.log('resetWindowBoundsState');
      let newLeft = 0;
      let newTop = 0;

      const winCmpntId =`wincmpnt-${this.name}-${this.processId}`;
      const mainWindow = document.getElementById('vanta')?.getBoundingClientRect();
      const winCmpnt = document.getElementById(winCmpntId)?.getBoundingClientRect();
      const currentBound = this._windowService.getProcessWindowBounds(this.uniqueId);

      if(winCmpnt && mainWindow){
        newTop = ((winCmpnt.top / mainWindow.height) * 100);
        newLeft = ((winCmpnt.left / mainWindow.width) * 100);

        if(currentBound){
          currentBound.x_offset = newLeft;
          currentBound.y_offset = newTop
          currentBound.x_bounds_subtraction = 0;
          currentBound.y_bounds_subtraction = 0;

          this._windowService.addProcessWindowBounds(this.uniqueId, currentBound);
        }
      }
    }

    createGlassPane():void{
      //Every window has a hidden glass pane that is revealed when the window is hidden
    }

    onCloseBtnClick():void{
      this.windowOpenCloseAction = 'close';
      this.generateCloseAnimationValues(this.xAxisTmp, this.yAxisTmp);
      this._windowService.removeWindowState(this.processId);

      setTimeout(()=>{
        const processToClose = this._runningProcessService.getProcess(this.processId);
        if(processToClose){
          this._runningProcessService.closeProcessNotify.next(processToClose);
          this._windowService.cleanUp(this.uniqueId);
        }

        const nextProc = this.getNextProcess();
        if(nextProc){
          this._windowService.focusOnNextProcessWindowNotify.next(nextProc.getProcessId);
        }
      },this.SECONDS_DELAY) ;
    }

    setFocsuOnThisWindow(pid:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */
      const uid = `${this.name}-${pid}`;
      if((this.uniqueId === uid) && (!this.windowHide)){
        this._windowService.addEventOriginator(this.uniqueId);
        this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pid);
        
        this.setHeaderActive(pid);
        this.setWindowToFocusById(pid);
        this.resetWindowBoundsState();
      }
    }

    setFocusOnWindowInit(pid:number):void{
      this._windowService.addEventOriginator(this.uniqueId);
      this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pid);

      this.setHeaderActive(pid);
    }

    setWindowToFocusOnMouseHover(pid:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */

      this._windowService.addEventOriginator(this.uniqueId);
      this._windowService.hideOtherProcessesWindowNotify.next(pid);
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();
      
      if(this.processId == pid){
        if(pid === pid_with_highest_z_index)
            this.setHeaderActive(pid);

        this.showOnlyWindowById(pid);
      }
    }

    /**
     * the pid of the current window currently in focus is passed. if the pid of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindowNotMatchingPid(pid:number):void{
      if(this.processId !== pid){
        const windowState = this._windowService.getWindowState(this.processId);
        if(windowState){
          if(windowState.is_visible){
            this.setHeaderInActive(windowState.pid);
            this.updateWindowZIndex(windowState, this.MIN_Z_INDEX);
          }
        }
      }
    }

    restorePriorFocusOnWindows():void{
      const processWithWindows = this._windowService.getWindowStates();
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();

      for(let i = 0; i < processWithWindows.length; i++){
        const window = processWithWindows[i];          
        if(window && window.is_visible){
          if(window.pid !== pid_with_highest_z_index ){
            this.setHeaderInActive(window.pid);
            this.updateWindowZIndex(window, this.MIN_Z_INDEX);
          }else{
            this.setHeaderActive(window.pid);
            this.updateWindowZIndex(window, this.MAX_Z_INDEX);
          }
        }
      }
    }

    /**
     * the pid of the current window currently in focus is passed. if the pid of other windows do not match,
     * then they are hidden by setting z -index = 0
     */
    hideWindowNotMatchingPidOnMouseHover(pid:number):void{
      if(this.processId !== pid){
        const windowState  = this._windowService.getWindowStates().find(p => p.pid === this.processId);

        if(windowState && windowState.is_visible){
          this.updateWindowZIndex(windowState, this.HIDDEN_Z_INDEX);
        }
        else if(windowState && !windowState.is_visible){
          // using a z-index of less than 1, breaks hide/show animation, the show part to be exact.
          this.setWindowToPriorHiddenState(windowState, this.MIN_Z_INDEX);
        }
      }
    }

    restoreWindowOnMouseLeave(pid:number):void{
      const window = this._windowService.getWindowState(pid);
      const pid_with_highest_z_index = this._windowService.getProcessWindowIDWithHighestZIndex();

      if(window){
        if(window.is_visible){
          if(window.pid !==  pid_with_highest_z_index){
            this.setHeaderInActive(window.pid);
            this.updateWindowZIndex(window, this.MIN_Z_INDEX);
          }else{
            this.setHeaderActive(window.pid);
            this.updateWindowZIndex(window, this.MAX_Z_INDEX);
          }
        } else if(!window.is_visible){
          // using a z-index of less than 1, breaks hide/show animation, the show part to be exact.
          this.setWindowToPriorHiddenState(window, this.MIN_Z_INDEX);
        }
      }
    }

    setWindowToFocusAndResetWindowBoundsByPid(pid:number):void{
      // return to modify this function, passing just the pid is enough
      if(this.processId === pid){
        const window = this._windowService.getWindowState(this.processId);
        if(window && window.is_visible){
          //console.log('setNextWindowToFocus-process:',process.getProcessId +'----'+process.getProcessName); //TBD
          this.setWindowToFocusById(window.pid);
  
          //reset window bound when a window is closed or hidden.
          this.resetWindowBoundsState();
        }
      }
     }

    setWindowToFocusById(pid:number):void{
      const windowState = this._windowService.getWindowState(pid);
      if(windowState){
        console.log(`setWindowToFocusById-Window app_name: ${windowState.app_name} ----  Window pid:${windowState.pid}  ---------- ${this.processId}`);//TBD

        if((windowState.pid == pid) && (windowState.z_index < this.MAX_Z_INDEX)){
          windowState.z_index = this.MAX_Z_INDEX;
          this._windowService.addWindowState(windowState);
          this._windowService.addProcessWindowIDWithHighestZIndex(pid);
  
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':this.MAX_Z_INDEX
          };
          this.setHeaderActive(pid);
        }     
      }
    }

    showOnlyWindowById(pid:number):void{
      const uid = `${this.name}-${pid}`;
      const windowState = this._windowService.getWindowState(pid);

      if(windowState && (windowState.pid == pid)){
        const z_index = this.TMP_MAX_Z_INDEX;

        if(!windowState.is_visible){
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':z_index,
            'opacity': 1,
            'transform': `translate(${String(windowState.x_axis)}px, ${String(windowState.y_axis)}px)`
          };
          //console.log('window:',uid + ' should be visible');
        }else{
          this.currentStyles = {
            'top': `${this.windowTop}%`,
            'left': `${this.windowLeft}%`,
            'z-index':z_index
          };
        }
        //this.setHeaderActive(pid);  //header should only be active, if the windows in question had the highest 2-index.TBD
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
    const pickUpKey = this._sessionManagmentService._pickUpKey;
    if(this._sessionManagmentService.hasTempSession(pickUpKey)){
      const tmpSessKey = this._sessionManagmentService.getTempSession(pickUpKey) || ''; 

      const retrievedSessionData = this._sessionManagmentService.getSession(tmpSessKey) as BaseState[];
      
      if(retrievedSessionData !== undefined){
        const windowSessionData = retrievedSessionData[1] as WindowState;

        if(windowSessionData !== undefined ){
          
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
        }
      }

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
      this._sessionManagmentService.removeSession(tmpSessKey);
    }
  }

}