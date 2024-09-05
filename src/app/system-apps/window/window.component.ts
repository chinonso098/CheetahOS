import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges } from '@angular/core';

import { ComponentType } from 'src/app/system-files/component.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Subscription } from 'rxjs';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { BaseState, WindowState } from 'src/app/system-files/state/state.interface';
import {openCloseAnimation, hideShowAnimation, minimizeMaximizeAnimation} from 'src/app/system-apps/window/animation/animations';
import { StateType } from 'src/app/system-files/state/state.type';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';

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
   private _originalWindowsState!:WindowState;

   private _restoreOrMinSub!:Subscription
   private _focusOnNextProcessSub!:Subscription;
   private _focusOnCurrentProcessSub!:Subscription;
   private _focusOutOtherProcessSub!:Subscription;

  readonly SECONDS_DELAY = 350;
  readonly WINDOW_CAPTURE_SECONDS_DELAY = 5000;
  readonly MIN_Z_INDEX = 1;
  readonly MAX_Z_INDEX = 2;

  windowHide = false;
  windowMaximize = false;
  windowOpenCloseAction = 'open';
  windowHideShowAction = 'visible';
  windowMinMaxAction = 'minimized';

  windowTransform =  'translate(0,0)';

  windowTransform0p =   'translate(0,0)';
  windowTransform25p =  'translate(-25px,25px)';
  windowTransform50p =  'translate(-50px,50px)';
  windowTransform75p =  'translate(-75px,75px)';
  windowTransform100p = 'translate(-100px,100px)';

  yAxis0p =   'translate(0,0)';
  yAxis25p =  'translate(0,25px)';
  yAxis50p =  'translate(0,50px)';
  yAxis75p =  'translate(0,75px)';
  yAxis100p = 'translate(0,100px)';

  windowWidth = '0px';
  windowHeight = '0px';
  windowZIndex = '0';

  xAxisTmp = 0;
  yAxisTmp = 0;

  isWindowMaximizable = true;
  currentWindowSizeState = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  closeBtnStyles: Record<string, unknown> = {};
  defaultWidthOnOpen = 0;
  defaultHeightOnOpen = 0;
  private readonly z_index = '25914523'; // this number = zindex

  hasWindow = false;
  icon = '';
  name = 'Window';
  processId = 0;
  uniqueId = '';
  type = ComponentType.System;
  displayName = '';
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, 
                stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService){
      this._runningProcessService = runningProcessService;
      this._stateManagmentService = stateManagmentService;
      this._sessionManagmentService = sessionManagmentService;
 
      this.retrievePastSessionData();

      this._restoreOrMinSub = this._runningProcessService.restoreOrMinimizeWindowNotify.subscribe((p) => {this.restoreHiddenWindow(p)});
      this._focusOnNextProcessSub = this._runningProcessService.focusOnNextProcessNotify.subscribe(() => {this.setNextWindowToFocus()});
      this._focusOnCurrentProcessSub = this._runningProcessService.focusOnCurrentProcessNotify.subscribe((p) => {this.setFocusOnWindow(p)});
      this._focusOutOtherProcessSub = this._runningProcessService.focusOutOtherProcessNotify.subscribe((p) => {this.removeFocusOnWindow(p)});
    }

    get getDivWindowElement(): HTMLElement {
      return this.divWindow.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.isWindowMaximizable = this.isMaximizable;
      this.windowOpenCloseAction = 'open'
    }

    ngOnDestroy():void{
      this._restoreOrMinSub?.unsubscribe();
      this._focusOnNextProcessSub?.unsubscribe();
      this._focusOnCurrentProcessSub?.unsubscribe();
      this._focusOutOtherProcessSub?.unsubscribe();
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
      
      this.uniqueId = `${this.name}-${this.processId}`;
      this._stateManagmentService.addState(this.uniqueId,this._originalWindowsState, StateType.Window);
      this.setWindowToFocusById(this.processId);

      //tell angular to run additional detection cycle after 
      this.changeDetectorRef.detectChanges();

      //setTimeout(()=>{ /**When i get this working as it should, i will remove the other capture methods */
      //  this.captureComponentImg();
      //},this.WINDOW_CAPTURE_SECONDS_DELAY);
  
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
        this._runningProcessService.addProcessImage(this.name, cmpntImg);
      })
    }


    setHideAndShow():void{
      this.windowHide = !this.windowHide;
      this.windowHideShowAction = this.windowHide ? 'hidden' : 'visible';
      this.generateHideAnimationValues(this.xAxisTmp, this.yAxisTmp);
      // CSS styles: set per current state of component properties
      const windowState = this._stateManagmentService.getState(this.uniqueId, StateType.Window) as WindowState;

      if(this.windowHide){
        if(windowState.pid == this.processId){
          windowState.is_visible = false;
          this._stateManagmentService.addState(this.uniqueId, windowState, StateType.Window);
        }
      }
      else if(!this.windowHide){
        if(windowState.pid == this.processId){
          if(this.currentWindowSizeState){ 
            // if window was in full screen when hidden, give the proper z-index when unhidden
            this.setWindowToFullScreen(this.processId, windowState.z_index);
          }
          windowState.is_visible = true;
          this._stateManagmentService.addState(this.uniqueId, windowState, StateType.Window);
        }
      }
    }

    setMaximizeAndUnMaximize():void{
      const windowState = this._stateManagmentService.getState(this.uniqueId, StateType.Window) as WindowState;
      this.currentWindowSizeState = this.windowMaximize;
      const uid = `${this.processAppName}-${this.processId}`;

      if(this.windowMaximize){
        if(windowState.pid == this.processId){
          this.setWindowToFullScreen(this.processId, windowState.z_index);

          this._runningProcessService.addEventOriginator(uid);
          this._runningProcessService.maximizeWindowNotify.next();
        }
      }
      else if(!this.windowMaximize){
        if(windowState.pid == this.processId){
          this.windowWidth = `${String(windowState.width)}px`;
          this.windowHeight = `${String(windowState.height)}px`;
          this.windowTransform =  `translate(${String(windowState.x_axis)}px, ${String(windowState.y_axis)}px)`;
          this.windowZIndex =   String(windowState.z_index);

          const windowTitleBarHeight = 30;
          this._runningProcessService.addEventOriginator(uid);
          this._runningProcessService.minimizeWindowNotify.next([windowState.width, windowState.height - windowTitleBarHeight]);
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
          'background-color':'rgb(121, 163, 232)'
        };
      }
    }

    setHeaderActive(pid:number):void{
      if(this.processId == pid){
        this.headerActiveStyles = {
          'background-color':'blue'
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

    updateWindowZIndex(window: WindowState):void{
      if(this.processId == window.pid){
        this.currentStyles = {
          'z-index':this.MIN_Z_INDEX
        };
        window.z_index = this.MIN_Z_INDEX;
        const uid = `${window.app_name}-${window.pid}`;
        this._stateManagmentService.addState(uid, window, StateType.Window);
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
      if(this.isWindowMaximizable){
        if(this.currentWindowSizeState && !this.windowMaximize){
          this.windowMaximize = false;
          this.windowMinMaxAction = 'minimized';
        }else{
          this.windowMaximize = true;
          this.windowMinMaxAction = 'maximized';
        }
        this.setMaximizeAndUnMaximize()
      }
    }

    onDragEnd(input:HTMLElement):void{
      const style = window.getComputedStyle(input);
      const matrix1 = new WebKitCSSMatrix(style.transform);
      const x_axis = matrix1.m41;
      const y_axis = matrix1.m42;

      //ignore false drag
      if( x_axis!= 0  && y_axis != 0){
        const windowState = this._stateManagmentService.getState(this.uniqueId, StateType.Window) as WindowState;
        windowState.x_axis= x_axis;
        windowState.y_axis= y_axis;

        this.xAxisTmp = x_axis;
        this.yAxisTmp = y_axis;
        this.windowTransform =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;    
        this._stateManagmentService.addState(this.uniqueId, windowState, StateType.Window);
      }
    }

    onDragStart(pid:number):void{
      this.setFocusOnWindow(pid);
    }

    onRZStop(input:any):void{
      const height = Number(input.size.height);
      const width = Number(input.size.width);

      const windowState = this._stateManagmentService.getState(this.uniqueId, StateType.Window) as WindowState;
      windowState.width= width;
      windowState.height= height;


      this.windowWidth = `${String(width)}px`;
      this.windowHeight = `${String(height)}px`;

      this._stateManagmentService.addState(this.uniqueId, windowState, StateType.Window);
    }
    
    generateCloseAnimationValues(x_axis:number, y_axis:number):void{
      this.windowTransform0p =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;
      this.windowTransform25p =  `translate(${String(x_axis - 25)}px , ${String(y_axis + 25)}px)`;
      this.windowTransform50p =  `translate(${String(x_axis - 50)}px , ${String(y_axis + 50)}px)`;
      this.windowTransform75p =  `translate(${String(x_axis - 75)}px , ${String(y_axis + 75)}px)`;
      this.windowTransform100p =  `translate(${String(x_axis - 100)}px , ${String(y_axis + 100)}px)`;
    }

    generateHideAnimationValues(x_axis:number, y_axis:number ):void{
      this.yAxis0p =  `translate(${String(x_axis)}px , ${String(y_axis)}px)`;
      this.yAxis25p =  `translate(${String(x_axis)}px , ${String(y_axis + 25)}px)`;
      this.yAxis50p =  `translate(${String(x_axis)}px , ${String(y_axis + 50)}px)`;
      this.yAxis75p =  `translate(${String(x_axis)}px , ${String(y_axis + 75)}px)`;
      this.yAxis100p =  `translate(${String(x_axis)}px , ${String(y_axis + 100)}px)`;
    }

    onCloseBtnClick():void{
      this.windowOpenCloseAction = 'close';
      this.generateCloseAnimationValues(this.xAxisTmp, this.yAxisTmp);

      setTimeout(()=>{
        const processToClose = this._runningProcessService.getProcess(this.processId);
        this._runningProcessService.closeProcessNotify.next(processToClose);
        this._runningProcessService.focusOnNextProcessNotify.next();
      },this.SECONDS_DELAY) ;
    }

    setFocusOnWindow(pid:number):void{
      /**
       * If you want to make a non-focusable element focusable, 
       * you must add a tabindex attribute to it. And divs falls into the category of non-focusable elements .
       */

      this._runningProcessService.focusOutOtherProcessNotify.next(pid);
      
      if(this.processId == pid){
        this.setHeaderActive(pid);
        this.setWindowToFocusById(pid);
      }
    }

    /**
     * the pid of the current window currently in focus is passed. if the pid of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindow(pid:number):void{
      const processWithWindows = this._runningProcessService.getProcesses().filter(p => p.getHasWindow == true && p.getProcessId != pid);

      for(let i = 0; i < processWithWindows.length; i++){
          const process = processWithWindows[i];
          const window = this._stateManagmentService.getState(`${process.getProcessName}-${process.getProcessId}`, StateType.Window) as WindowState;
          
          if(window != undefined && window.is_visible){
            this.setHeaderInActive(window.pid);
            this.updateWindowZIndex(window);
        }
      }
    }

   setWindowToFocusById(pid:number):void{
      let z_index = this._stateManagmentService.getState(this.z_index) as number;
      const uid = `${this.name}-${pid}`;
      const windowState = this._stateManagmentService.getState(uid,StateType.Window) as WindowState;

      if(windowState !== undefined){
        if((windowState.pid == pid) && (!z_index) || (windowState.pid == pid) && (windowState.z_index <= z_index)){
          z_index = this.MAX_Z_INDEX;
          this._stateManagmentService.addState(this.z_index, z_index);

          windowState.z_index = z_index
          this._stateManagmentService.addState(this.uniqueId, windowState, StateType.Window);
  
          this.currentStyles = {
            'z-index':z_index
          };
          this.setHeaderActive(pid);
        }     
      }
    }

   setNextWindowToFocus():void{
      const processWithWindows = this._runningProcessService.getProcesses().filter(p => p.getHasWindow == true);

      for (let i = 0; i < processWithWindows.length; i++){
        const process = processWithWindows[i];
        const window = this._stateManagmentService.getState(`${process.getProcessName}-${process.getProcessId}`,StateType.Window) as WindowState;
          
        if(window != undefined && window.is_visible){
          //console.log('process:',process.getProcessId +'----'+process.getProcessName); //TBD
          this.setWindowToFocusById(process.getProcessId);
          break;
        }
      }
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