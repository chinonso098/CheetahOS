import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges } from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { of, Subscription } from 'rxjs';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { BaseState, WindowState } from 'src/app/system-files/state/state.interface';
import {openCloseAnimation, hideShowAnimation, minimizeMaximizeAnimation} from 'src/app/shared/system-component/window/animation/animations';
import { StateType } from 'src/app/system-files/state/state.type';
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
   private _stateManagmentService: StateManagmentService;
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

  readonly SECONDS_DELAY = 350;
  readonly WINDOW_CAPTURE_SECONDS_DELAY = 5000;
  readonly HIDDEN_Z_INDEX = 0;
  readonly MIN_Z_INDEX = 1;
  readonly MAX_Z_INDEX = 2;
  readonly TMP_Z_INDEX = 3;

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

  winTop = 0;
  winLeft = 0;

  isWindowMaximizable = true;
  currentWindowSizeState = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};
  defaultWidthOnOpen = 0;
  defaultHeightOnOpen = 0;
  private readonly z_index = '25914523'; // this number = zindex
  private pid_with_highest_z_index = 0;

  hasWindow = false;
  icon = '';
  name = 'Window';
  processId = 0;
  uniqueId = '';
  type = ComponentType.System;
  displayName = '';
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, 
                windowService:WindowService, stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService){
      this._runningProcessService = runningProcessService;
      this._stateManagmentService = stateManagmentService;
      this._sessionManagmentService = sessionManagmentService;
      this._windowService = windowService;
 
      this.retrievePastSessionData();

      this._restoreOrMinSub = this._windowService.restoreOrMinimizeProcessWindowNotify.subscribe((p) => {this.restoreHiddenWindow(p)});
      this._focusOnNextProcessSub = this._windowService.focusOnNextProcessWindowNotify.subscribe(() => {this.setNextWindowToFocus()});
      this._focusOnCurrentProcessSub = this._windowService.focusOnCurrentProcessWindowNotify.subscribe((p) => {this.setFocusOnWindow(p)});
      this._removeFocusOnOtherProcessesSub = this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindow(p)});
      this._showOnlyCurrentProcessSub = this._windowService.showOnlyCurrentProcessWindowNotify.subscribe((p) => {this.showOnlyThisWindow(p)});
      this._hideOtherProcessSub = this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.moveWindowsOutOfSight(p)});
      this._restoreProcessSub = this._windowService.restoreProcessWindowNotify.subscribe((p) => {this.restorePriorFocusOnWindow(p)});
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
        if(this._windowService.isProcessInWindowList(this.uniqueId )){
          this.stackWindow(false);
        }else{
          this.stackWindow(true);
        }
      }, 0);

      this._windowService.addProcessWindowToWindows(this.uniqueId ); 
    }

    ngAfterViewInit():void{
      this.defaultHeightOnOpen = this.getDivWindowElement.offsetHeight;
      this.defaultWidthOnOpen  = this.getDivWindowElement.offsetWidth;

      const z_index = this._stateManagmentService.getState(this.z_index) as number;
      this.windowTransform =  'translate(0, 0)';
      this.windowHeight =  `${String(this.defaultHeightOnOpen)}px`;
      this.windowWidth =  `${String(this.defaultWidthOnOpen)}px`;
      this.windowZIndex =  (z_index === undefined)? String(this.MAX_Z_INDEX) : String(z_index);

      this._originalWindowsState = {
        app_name: this.name,
        pid : this.processId,
        height:this.defaultHeightOnOpen,
        width: this.defaultWidthOnOpen,
        x_axis: 0,
        y_axis: 0,
        z_index:(z_index === undefined)? this.MAX_Z_INDEX : z_index,
        is_visible:true
      }

      this._windowService.addWindowState(this._originalWindowsState);

      //this.setWindowToFocusById(this.processId);

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

      if(this.windowHide){
        if(windowState){
          if(windowState.pid == this.processId){
            //console.log(`setHideAndShow-Window app_name: ${windowState.app_name} ----  Window pid:${windowState.pid}  ---------- ${this.processId}`);//TBD
            windowState.is_visible = false;
            windowState.z_index = this.MIN_Z_INDEX;
            this._windowService.addWindowState(windowState);
  
            this.currentStyles = { 
              'top': `${this.winTop}%`,
              'left': `${this.winLeft}%`,
              'z-index':this.MIN_Z_INDEX 
            };

            const nextProc = this.getNextProcess();
            if(nextProc){
              this._windowService.addEventOriginator(`${nextProc.getProcessName}-${nextProc.getProcessId}`);
              this._windowService.focusOnNextProcessWindowNotify.next();
            }
          }
        }
      }
      else if(!this.windowHide){
        if(windowState){
          if(windowState.pid == this.processId){
            if(this.currentWindowSizeState){ 
              // if window was in full screen when hidden, give the proper z-index when unhidden
              this.setWindowToFullScreen(this.processId, windowState.z_index);
            }
            windowState.is_visible = true;
            this._windowService.addWindowState(windowState);
          }
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
          'top': `${this.winTop}%`,
          'left': `${this.winLeft}%`,
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
          'top': `${this.winTop}%`,
          'left': `${this.winLeft}%`,
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
        }
      }
    }

    onDragStart(pid:number):void{
      console.log('onDragStart-Started. But this function will also call  setFocusOnWindow()'); //TBD
      this.setFocusOnWindow(pid);
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

    stackWindow(isFirstTime:boolean):void{
      console.log('stacking Window');
      let newTop = 25;
      let newLeft = 25;

      if(!isFirstTime){
        const offset = 2;
        const currentVal = this._windowService.getProcessWindowOffset(this.uniqueId);
        newTop = currentVal + offset;
        newLeft = currentVal + offset;

        this._windowService.addProcessWindowOffset(this.uniqueId, newTop);
      }else{
        this._windowService.addProcessWindowOffset(this.uniqueId, newTop);
      }

      // Ensure they don’t go out of bounds
      const mainWindow = document.getElementById('vanta');
      if(mainWindow){
        newTop = Math.min(newTop, 60); // Prevent it from going off-screen
        newLeft = Math.min(newLeft, 60);
      }


      this.winTop = newTop;
      this.winLeft = newLeft;

      console.log(`Setting window position: top=${newTop}%, left=${newLeft}%`);

      console.log(`Before Update:`, this.currentStyles);

      this.currentStyles = {
        'top': `${newTop}%`,
        'left': `${newLeft}%`,
        'z-index':this.MAX_Z_INDEX
      };
    }

    createGlassPane():void{
      //Every window has a hidden glass pane that is revealed when the window is hidden
    }

    onCloseBtnClick():void{
      this.windowOpenCloseAction = 'close';
      this.generateCloseAnimationValues(this.xAxisTmp, this.yAxisTmp);
      this._windowService.removeWindowState(this.processId);

      console.log(`Process processId  to clode:`, this.processId);

      setTimeout(()=>{
        const processToClose = this._runningProcessService.getProcess(this.processId);

        console.log(`processToClose`, processToClose);

        this._runningProcessService.closeProcessNotify.next(processToClose);
        this._windowService.cleanUp(this.uniqueId);

        const nextProc = this.getNextProcess();

        console.log(`nextProc`, nextProc);

        if(nextProc){
          this._windowService.addEventOriginator(`${nextProc.getProcessName}-${nextProc.getProcessId}`);
          this._windowService.focusOnNextProcessWindowNotify.next();
        }
      },this.SECONDS_DELAY) ;
    }

    setFocusOnWindow(pid:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */

      // console.log('windows hideState:', this.windowHide +'---' + pid);//TBD
      const uid = `${this.name}-${pid}`;
      // console.log('setFocusOnWindow --- uid:',uid);//TBD
      // console.log('setFocusOnWindow --- uniqueId:', this.uniqueId);//TBD

      if(this.uniqueId === uid){

        if(!this.windowHide){

          // console.log('setFocusOnWindow --- uid:',uid);//TBD
          // console.log('setFocusOnWindow --- uniqueId:', this.uniqueId);//TBD

          this._windowService.addEventOriginator(this.uniqueId);
          this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pid);
          
          if(this.processId == pid){
            this.setHeaderActive(pid);
            this.setWindowToFocusById(pid);
          }
        }
      }
    }

    showOnlyThisWindow(pid:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */

      this._windowService.addEventOriginator(this.uniqueId);
      this._windowService.hideOtherProcessesWindowNotify.next(pid);
      
      if(this.processId == pid){
        this.setHeaderActive(pid);
        this.showOnlyWindowById(pid);
      }
    }

    /**
     * the pid of the current window currently in focus is passed. if the pid of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindow(pid:number):void{

      // console.log('removeFocusOnWindow --- i was called 0');//TBD
      // console.log('removeFocusOnWindow --- evt orig:', this._runningProcessService.getEventOrginator());//TBD
      // console.log('removeFocusOnWindow --- this.uniqueId:', this.uniqueId);//TBD
      // console.log('removeFocusOnWindow --- pid:', pid);//TBD

      const processWithWindows = this._windowService.getWindowStates().filter(p => p.pid !== pid);

      for(let i = 0; i < processWithWindows.length; i++){
        const process = processWithWindows[i];
        const window = this._windowService.getWindowState(process.pid);
        if(window){
          if(window.is_visible){
            this.setHeaderInActive(window.pid);
            this.updateWindowZIndex(window, this.MIN_Z_INDEX);
          }
        }
      }
    }

    /**
     * the pid of the current window currently in focus is passed. if the pid of other windows do not match,
     * then they are hidden by setting z -index = -1
     */
    moveWindowsOutOfSight(pid:number):void{

      //console.log('i was called 1');
      if(this._windowService.getEventOrginator() === this.uniqueId){
        const processWithWindows = this._windowService.getWindowStates().filter(p => p.pid !== pid);

        for(let i = 0; i < processWithWindows.length; i++){
          const process = processWithWindows[i];
          const window = this._windowService.getWindowState(process.pid);
            
          if(window != undefined && window.is_visible){
            if(window.z_index === 2){
              this.pid_with_highest_z_index = window.pid;
            }
            this.updateWindowZIndex(window, this.HIDDEN_Z_INDEX);
          }
          else if(window != undefined && !window.is_visible){
            // using a z-index of less than 1, breaks hide/show animation, the show part to be exact.
            this.setWindowToPriorHiddenState(window, this.MIN_Z_INDEX);
          }
        }
        this._windowService.removeEventOriginator();
      }
    }

    restorePriorFocusOnWindows():void{

      //console.log('i was called 2');
      //const processWithWindows = this._runningProcessService.getProcesses().filter(p => p.getHasWindow === true);
      const processWithWindows = this._windowService.getWindowStates();

      for(let i = 0; i < processWithWindows.length; i++){
        const process = processWithWindows[i];
        const window = this._windowService.getWindowState(process.pid)
          
        if(window != undefined && window.is_visible){
          if(window.pid !== this.pid_with_highest_z_index){
            this.setHeaderInActive(window.pid);
            this.updateWindowZIndex(window, this.MIN_Z_INDEX);
          }else{
            this.setHeaderActive(window.pid);
            this.updateWindowZIndex(window, this.MAX_Z_INDEX);
          }
        }
      }
    }

    restorePriorFocusOnWindow(pid:number):void{

      //console.log('i was called 3');
      const processWithWindows = this._windowService.getWindowStates().filter(p => p.pid === pid);

      const process = processWithWindows[0];
      const window = this._windowService.getWindowState(process.pid);
        
      if(window != undefined && window.is_visible){
        if(window.pid !== this.pid_with_highest_z_index){
          this.setHeaderInActive(window.pid);
          this.updateWindowZIndex(window, this.MIN_Z_INDEX);
        }else{
          this.setHeaderActive(window.pid);
          this.updateWindowZIndex(window, this.MAX_Z_INDEX);
        }
      }
      else if(window != undefined && !window.is_visible){
        // using a z-index of less than 1, breaks hide/show animation, the show part to be exact.
        this.setWindowToPriorHiddenState(window, this.MIN_Z_INDEX);
      }
    }

    setWindowToFocusById(pid:number):void{
      let z_index = this._stateManagmentService.getState(this.z_index) as number;

      const windowState = this._windowService.getWindowState(pid);

      //console.log(`setWindowToFocusById-Window app_name: ${windowState.app_name} ----  Window pid:${windowState.pid}  ---------- ${this.processId}`);//TBD

      if(windowState){
        if((windowState.pid == pid) && (!z_index) || (windowState.pid == pid) && (windowState.z_index <= z_index)){

          //console.log('setWindowToFocusById --- i got in here');//TBD
          z_index = this.MAX_Z_INDEX;
          this._stateManagmentService.addState(this.z_index, z_index);

          windowState.z_index = z_index;
          this._windowService.addWindowState(windowState);
  
          this.currentStyles = {
            'top': `${this.winTop}%`,
            'left': `${this.winLeft}%`,
            'z-index':z_index
          };
          this.setHeaderActive(pid);
        }     
      }
    }

    showOnlyWindowById(pid:number):void{
      const uid = `${this.name}-${pid}`;
      const windowState = this._windowService.getWindowState(pid);

      if(windowState){
        if((windowState.pid == pid)){
          const z_index = this.TMP_Z_INDEX;

          if(!windowState.is_visible){
            //console.log('window:',uid + ' is currently hidden');//TBD
            //console.log(`translate(${String(windowState.x_axis)}px, ${String(windowState.y_axis)}px)`); //TBD
            this.currentStyles = {
              'top': `${this.winTop}%`,
              'left': `${this.winLeft}%`,
              'z-index':z_index,
              'opacity': 1,
              'transform': `translate(${String(windowState.x_axis)}px, ${String(windowState.y_axis)}px)`
            };
            //console.log('window:',uid + ' should be visible');
          }else{
            this.currentStyles = {
              'top': `${this.winTop}%`,
              'left': `${this.winLeft}%`,
              'z-index':z_index
            };
          }
          this.setHeaderActive(pid);
        }     
      }
    }

   setNextWindowToFocus():void{
    if(this._windowService.getEventOrginator() == this.uniqueId){

      const processWithWindows = this._windowService.getWindowStates().filter(p => p.pid === this.processId);
      for (let i = 0; i < processWithWindows.length; i++){
        const process = processWithWindows[i];

        const window = this._windowService.getWindowState(process.pid);
        if(window != undefined && window.is_visible){
          //console.log('setNextWindowToFocus-process:',process.getProcessId +'----'+process.getProcessName); //TBD
          this.setWindowToFocusById(process.pid);
          break;
        }
      }

      this._windowService.removeEventOriginator();
    }
   }

   getNextProcess():Process | undefined{
    const nextPid = this._windowService.getNextPidInWindowStateList();

    console.log('nextPid:', nextPid);

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