import { OnInit, AfterViewInit, Component } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { IconAppCurrentState, TaskBarIconInfo } from './taskbar.entries.type';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';

@Component({
  selector: 'cos-taskbarentries',
  templateUrl: './taskbarentries.component.html',
  styleUrls: ['./taskbarentries.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class TaskBarEntriesComponent implements OnInit, AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _systemNotificationService:SystemNotificationService;
  private _menuService:MenuService;
  private _windowServices:WindowService;
  private _sessionManagmentService:SessionManagmentService

  private prevOpenedProccesses:string[]= [];
  mergedTaskBarIconList:TaskBarIconInfo[] = [];
  unMergedTaskBarIconList:TaskBarIconInfo[] = [];
  pinnedTaskBarIconList:TaskBarIconInfo[] = [];
  sessionPinnedTaskbarIcons:TaskBarIconInfo[] = [];

  selectedFile!:FileInfo
  SECONDS_DELAY = 50; //50 millisecs

  readonly mergedIcons = Constants.MERGED_TASKBAR_ENTRIES;
  readonly unMergedIcons = Constants.DISTINCT_TASKBAR_ENTRIES;
 
  readonly hideLabel = 'hideLabel';
  readonly showLabel = 'showLabel';
  readonly tskbar = 'tskbar';

  readonly cheetahTskBarKey = 'cheetahTskBarKey';
  readonly pinAction = 'pin';
  readonly unPinAction = 'unPin';

  taskBarEntriesIconState = this.unMergedIcons;
  hideShowLabelState = this.showLabel;

  windowInFocusPid = 0;
  prevWindowInFocusPid = 0;
  isAnyWindowInFocus = false;
  
  hasWindow = false;
  icon =  `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbarentry';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  tmpInfo!:string[];

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
              triggerProcessService:ProcessHandlerService, windowServices:WindowService, systemNotificationService:SystemNotificationService,
              sessionManagmentService:SessionManagmentService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = triggerProcessService;
    this._menuService = menuService;
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this._sessionManagmentService = sessionManagmentService;

    this.processId = this._processIdService.getNewProcessId();

    this._runningProcessService.addProcess(this.getComponentDetail());
    this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess()});

    this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.onCloseProcessNotify(p)});

    this._menuService.pinToTaskBar.subscribe((p)=>{this.onPinIconToTaskBarIconList(p)});
    this._menuService.unPinFromTaskBar.subscribe((p)=>{this.onUnPinIconFromTaskBarIconList(p)});
    this._menuService.openApplicationFromTaskBar.subscribe((p)=>{this.openApplication(p)});
    this._menuService.closeApplicationFromTaskBar.subscribe((p) =>{this.closeApplication(p)});
    this._menuService.UnMergeTaskBarIcon.subscribe(() =>{this.onChangeTaskBarIconState(this.unMergedIcons)});
    this._menuService.mergeTaskBarIcon.subscribe(() =>{this.onChangeTaskBarIconState(this.mergedIcons)});

    //tskbar never closes so no need to unsub
    this._systemNotificationService.taskBarIconInfoChangeNotify.subscribe((p) =>{this.updateTaskBarIcon(p); });

    this._windowServices.focusOnCurrentProcessWindowNotify.subscribe((p)=>{
      this.prevWindowInFocusPid = this.windowInFocusPid;
      this.windowInFocusPid = p;
      this.isAnyWindowInFocus = true;
      
      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, this.SECONDS_DELAY);
    });

    this._windowServices.currentProcessInFocusNotify.subscribe((p) =>{
      this.prevWindowInFocusPid = this.windowInFocusPid;
      this.windowInFocusPid = p;
      this.isAnyWindowInFocus = true;

      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, this.SECONDS_DELAY);
    });

    this._windowServices.noProcessInFocusNotify.subscribe(()=>{
      this.isAnyWindowInFocus = false;
      this.removeHighlightFromTaskbarIcon(this.windowInFocusPid)})}
  

  ngOnInit(): void {
    this.retrievePastSessionData();
    this.fetchPriorData();
  }

  ngAfterViewInit(): void {
    const delay = 1500; //1.5 secs
    //change detection is the better solution
    setTimeout(() => {
      this.setIconsBasedOnTaskbarMode();
    }, delay);
  }

  fetchPriorData():void{
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.unMergedTaskBarIconList.push(...this.sessionPinnedTaskbarIcons);
    }else{
      this.mergedTaskBarIconList.push(...this.sessionPinnedTaskbarIcons);
    }
  }

  updateRunningProcess():void{
    this.setIconsBasedOnTaskbarMode();
  }

  onCloseProcessNotify(process:Process):void{
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.updateUnMergedTaskbarIconListOnClose(process);
    }else{
      this.updateMergedTaskbarIconListOnClose(process);
    }
  }

  onPinIconToTaskBarIconList(file:FileInfo):void{
    const isMerged = (this.taskBarEntriesIconState === this.mergedIcons);
    let tskbarFileInfo!:TaskBarIconInfo 
    const tskBarIcons = (isMerged)? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;

    if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith)){
      tskbarFileInfo = this.getTaskBarIconInfo(file,undefined);
      tskBarIcons.push(tskbarFileInfo);
      this.storeTskBarState(tskbarFileInfo, this.pinAction);
    }else{
      if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith && x.isPinned)){
        const unPinnedIcon = tskBarIcons.find(x => x.opensWith === file.getOpensWith);
        if(unPinnedIcon){
          unPinnedIcon.isPinned = true;
          unPinnedIcon.isOtherPinned = true;

          this.storeTskBarState(unPinnedIcon, this.pinAction);

          if(!isMerged){
            tskBarIcons.forEach(item => {
              if (item.opensWith === unPinnedIcon.opensWith && item.pid !== unPinnedIcon.pid) {
                item.isOtherPinned = true;
              }
            });
          }
        }
      }
    }

    setTimeout(() => {
      this.highlightTaskbarIcon();
    }, this.SECONDS_DELAY);
  }

  onUnPinIconFromTaskBarIconList(file:FileInfo):void{
    const isMerged = (this.taskBarEntriesIconState === this.mergedIcons);
    const tskBarIcons = (isMerged)? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;

    const pinnedIconIdx = tskBarIcons.findIndex( x => x.opensWith === file.getOpensWith && x.isPinned);

    if(pinnedIconIdx === -1) return;
    
    const pinnedIcon = tskBarIcons[pinnedIconIdx];
    pinnedIcon.isPinned = false;
    pinnedIcon.isOtherPinned = false;

    this.storeTskBarState(pinnedIcon, this.unPinAction);

    //update other instances of app, set isOtherPinned = false;
    if(!isMerged){
      tskBarIcons.forEach(item => {
        if (item.opensWith === pinnedIcon.opensWith && item.pid !== pinnedIcon.pid) {
          item.isOtherPinned = false;
        }
      });
    }

    //check if app is not running
    const isAppRunning = this._runningProcessService
      .getProcesses()
      .some(p=> p.getProcessName === file.getOpensWith);

    if(!isAppRunning){
      this.removeIconFromTaskBarIconList(0, file.getOpensWith, false);
    }
  }

  onChangeTaskBarIconState(iconState:string):void{
    this.taskBarEntriesIconState  = iconState;
    this.pinnedTaskBarIconList = [];
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.hideShowLabelState = this.showLabel;
      this.pinnedTaskBarIconList.push(...this.mergedTaskBarIconList.filter(x => x.isPinned));
    }else if(this.taskBarEntriesIconState === this.mergedIcons){
      this.hideShowLabelState = this.hideLabel;
      this.pinnedTaskBarIconList.push(...this.unMergedTaskBarIconList.filter(x => x.isPinned));
    }

    this.retriggerRunningProcess();
  }

  retriggerRunningProcess():void{
   this.setIconsBasedOnTaskbarMode();
   
    setTimeout(() => {
      this.highlightTaskbarIcon();
    }, this.SECONDS_DELAY);
  }

  setIconsBasedOnTaskbarMode(): void {
    if (this.taskBarEntriesIconState === this.unMergedIcons) {
      this.handleUnmergedTaskbarIcons();
    } else if (this.taskBarEntriesIconState === this.mergedIcons) {
      this.handleMergedTaskbarIcons();
    }
  }

  handleUnmergedTaskbarIcons():void{
    const delay = 5; // 5 millisecs
    const proccesses = this.getProccessWithWindows()
    this.storeHistory(proccesses);

    for(const process of proccesses){
      const existingIcon = this.unMergedTaskBarIconList.find(i => i.opensWith === process.getProcessName);
      const isPinned = this.checkIfIconWasPinned(process.getProcessName);
      const isOtherPinned  = this.unMergedTaskBarIconList.some(x => x.opensWith === process.getProcessName && x.isPinned);
      const iconPath = this.checkForPriorIcon(process.getProcessId, process.getIcon);

      if(existingIcon){
        const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName)
        if(instanceCount === 1 && existingIcon.isPinned){
          this.updatePinnedTaskbarIconOnInit(process);
        }else if((instanceCount > 1) 
          && (!this.unMergedTaskBarIconList.find(i => i.opensWith === process.getProcessName && i.pid === process.getProcessId))){
          // add only unique instances
          const newIcon = this.getTaskBarIconInfo(undefined, process);
          newIcon.isPinned = isPinned;
          newIcon.isOtherPinned = isOtherPinned;
          newIcon.iconPath = iconPath;
          this.unMergedTaskBarIconList.push(newIcon);
        }
      }else{
        const newIcon = this.getTaskBarIconInfo(undefined, process);
        newIcon.isPinned = isPinned;
        newIcon.isOtherPinned = isPinned;
        newIcon.iconPath = iconPath;
        this.unMergedTaskBarIconList.push(newIcon);
      }

      setTimeout(() => {this.setIconState(true, process.getProcessName, process.getProcessId);}, delay);
    }
    this.groupTaskBarIconsByOpensWithAndEntryOrder();
  }

  handleMergedTaskbarIcons():void{
    const delay = 5; // 5 millisecs
    const uniqueProccesses = this.getUniqueProccessWithWindows();
    this.storeHistory(uniqueProccesses);

    for(const process of uniqueProccesses){
      const isPinned = this.checkIfIconWasPinned(process.getProcessName);
      if(!this.mergedTaskBarIconList.some(i => i.opensWith === process.getProcessName)){
        const newIcon = this.getTaskBarIconInfo(undefined, process);
        newIcon.isPinned = isPinned;
        newIcon.isOtherPinned = isPinned;
        newIcon.instanceCount = 1;
        this.mergedTaskBarIconList.push(newIcon);
      }else{
        // increment instance counter
        //check to ensure that the pid and processname, aren't already in the list
        const tskBarIcon = this.mergedTaskBarIconList.find(i => i.opensWith === process.getProcessName);
        if(tskBarIcon){
          if(tskBarIcon.pid === 0){
            tskBarIcon.pid = process.getProcessId;
            tskBarIcon.instanceCount = tskBarIcon.instanceCount + 1;
          }else{
            const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName);
            tskBarIcon.instanceCount = instanceCount;
          }
        }
      }

      setTimeout(() => { this.setIconState(true, process.getProcessName);}, delay);
    }
  }

  groupTaskBarIconsByOpensWithAndEntryOrder():void{
    const tskBarIcons = this.unMergedTaskBarIconList;
    const map = new Map<string, number>();
    const set: string[] = [];
  
    // Build frequency map and set of unique values
    for (const icon of tskBarIcons) {
      if (!set.includes(icon.opensWith)) {
        set.push(icon.opensWith);
      }
      map.set(icon.opensWith, (map.get(icon.opensWith) || 0) + 1);
    }
  
    let ptrA = 0;
    let ptrB = tskBarIcons.length - 1;

    if (set.length === 0) return;
    let currentVal = set.shift()!;
    let collected = 0;
  
    while (ptrA < tskBarIcons.length - 1) {
      if (tskBarIcons[ptrA].opensWith === currentVal) {
        collected++;
        ptrA++;
      } else {
        while (ptrB > ptrA && tskBarIcons[ptrB].opensWith !== currentVal) {
          ptrB--;
        }
        if (ptrB <= ptrA) {
          break; // safety net
        }
        // Swap values
        [tskBarIcons[ptrA], tskBarIcons[ptrB]] = [tskBarIcons[ptrB], tskBarIcons[ptrA]];
        collected++;
        ptrA++;
        ptrB = tskBarIcons.length - 1; // reset ptrB
      }
  
      // Move to next group if all of currentVal is collected
      if (collected === map.get(currentVal)) {
        if(set.length === 0) break;
        currentVal = set.shift()!;
        collected = 0;
      }
    }
  }

  checkIfIconWasPinned(procName:string):boolean{
    const deleteCount = 1;
    const pinnedIconIdx = this.pinnedTaskBarIconList.findIndex(x => x.opensWith === procName);

    if (pinnedIconIdx === -1) return false;
  
    this.pinnedTaskBarIconList.splice(pinnedIconIdx, deleteCount);
    return true;
  }

  checkForPriorIcon(pid:number, iconPath:string):string{
    const tmpInfo = this._systemNotificationService.getAppIconNotication(pid);
    if(tmpInfo.length > 0){
      const priorIcon = tmpInfo[1];
      return priorIcon;
    }
    return iconPath;
  }
  
  getUniqueProccessWithWindows():Process[]{
    const uniqueProccesses:Process[] = [];
    /**
     * filter first on processes that have windows
     * then select unique instance of process with same proccess name
     */
    this._runningProcessService.getProcesses()
      .filter(p => p.getHasWindow == true)
      .forEach(x =>{
        if(!uniqueProccesses.some(a => a.getProcessName === x.getProcessName)){
          uniqueProccesses.push(x);
        }
    });

    return uniqueProccesses
  }

  getProccessWithWindows():Process[]{
    /**
     * filter first on processes that have windows
     */
    return this._runningProcessService.getProcesses().filter(p => p.getHasWindow == true);
  }

  storeHistory(arg:Process[]):void{
    arg.forEach(x =>{
      if(!this.prevOpenedProccesses.includes(x.getProcessName)){
        this.prevOpenedProccesses.push(x.getProcessName);
      }
    });
  }

  setIconState(isActive:boolean, opensWith:string, pid?:number){
    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged ? `${this.tskbar}-${opensWith}` : `${this.tskbar}-${opensWith}-${pid}`;
    const liElemnt = document.getElementById(elementId) as HTMLElement | null;

    if(liElemnt){
      if(isActive)
        liElemnt.style.borderBottomColor = 'hsl(207deg 100%  72% / 90%)';
      else{
        liElemnt.style.borderBottomColor = Constants.EMPTY_STRING;
        liElemnt.style.backgroundColor = Constants.EMPTY_STRING;
      }
    }
  }

  getAppCurrentState(file?:FileInfo, process?:Process):IconAppCurrentState{
    let  isRunning = false;
    //check if an instance of this apps is running
    if(file){
      isRunning = this._runningProcessService.getProcesses()
        .some( p=> p.getProcessName === file.getOpensWith);
    }else if(process){
      isRunning = this._runningProcessService.getProcesses()
      .some( p=> p.getProcessName === process.getProcessName);
    }

    let hideShowLabelState = Constants.EMPTY_STRING;

    if((this.taskBarEntriesIconState === this.unMergedIcons) && !isRunning){
      hideShowLabelState = this.hideLabel;
    }else if((this.taskBarEntriesIconState === this.unMergedIcons) && isRunning){
      hideShowLabelState = this.showLabel;
    }else  if((this.taskBarEntriesIconState === this.mergedIcons) && !isRunning){
      hideShowLabelState = this.hideLabel;
    }else if((this.taskBarEntriesIconState === this.mergedIcons) && isRunning){
      hideShowLabelState = this.hideLabel;
    }

    return {isRunning:isRunning, showLabel:hideShowLabelState}
  }

  updatePinnedTaskbarIconOnInit(process:Process):void{
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarIconList.findIndex(x => x.uid === tmpUid);
    const tskBarIcon = this.unMergedTaskBarIconList[idx];

    if(tskBarIcon){
      //check if an instance of this apps is running
      const isRunning = this._runningProcessService
        .getProcesses()
        .some( p=> p.getProcessName === process.getProcessName);

      tskBarIcon.uid =  `${process.getProcessName}-${process.getProcessId}`; 
      tskBarIcon.pid = process.getProcessId;
      tskBarIcon.isRunning = isRunning;
      tskBarIcon.showLabel = this.showLabel;
      tskBarIcon.isPinned = true;
      tskBarIcon.isOtherPinned = true;
    }
  }

  updateUnMergedTaskbarIconListOnClose(process:Process):void{
    const uid = `${process.getProcessName}-${process.getProcessId}`;
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarIconList.findIndex(x => x.uid === uid);
    const delay = 5; //5ms

    if(idx === -1) return;

    const tskBarIcon = this.unMergedTaskBarIconList[idx];

    if (!tskBarIcon) return;

    // if the instace that was closed, was the pinned instance
    if(tskBarIcon.isPinned){      
      //check if an instance of this apps is running, and update the pinned instance with it's info
      const isAppRunning = this._runningProcessService
        .getProcesses()
        .some(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pid);

      if(isAppRunning){
        //update the pinned instace to point to one of the similar running instace
        const alternateProcess = this._runningProcessService
        .getProcesses()
        .find(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pid);

        if(alternateProcess){
          const replacementIcon = this.unMergedTaskBarIconList.find(x => x.pid === alternateProcess.getProcessId);

          if(replacementIcon){
            this.removeIconFromTaskBarIconList(alternateProcess.getProcessId, Constants.EMPTY_STRING, true);
            replacementIcon.isPinned = true;      
            this.unMergedTaskBarIconList[idx] = replacementIcon;
          }
        }
      }else{
        tskBarIcon.uid = tmpUid;
        tskBarIcon.pid = 0;
        tskBarIcon.isRunning = isAppRunning;
        tskBarIcon.showLabel = this.hideLabel;
        tskBarIcon.iconPath = tskBarIcon.defaultIconPath;
        tskBarIcon.displayName = tskBarIcon.opensWith;

        setTimeout(() => {
          this.setIconState(false,tskBarIcon.opensWith,tskBarIcon.pid);
        }, delay);
      }
    }else if(!tskBarIcon.isPinned){
      this.removeIconFromTaskBarIconList(process.getProcessId, Constants.EMPTY_STRING, true);
    }
  }

  updateMergedTaskbarIconListOnClose(process:Process):void{
    const idx = this.mergedTaskBarIconList.findIndex(x => x.opensWith === process.getProcessName);
    const delay = 5; //5ms

    if(idx === -1) return;

    const tskBarIcon = this.mergedTaskBarIconList[idx];

    if (!tskBarIcon) return;

    //check if an instance of this apps is running, and update the pinned instance with it's info
    const isAppRunning = this._runningProcessService
      .getProcesses()
      .some(p=> p.getProcessName === process.getProcessName);

    if(!isAppRunning && !tskBarIcon.isPinned){
      this.removeIconFromTaskBarIconList(0, process.getProcessName, true);

    }else if((isAppRunning && tskBarIcon.isPinned) || (isAppRunning && !tskBarIcon.isPinned)){
      const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName);
      tskBarIcon.instanceCount = instanceCount;

      setTimeout(() => {
        this.setIconState(true,tskBarIcon.opensWith,tskBarIcon.pid);
      }, delay);
    } else if(!isAppRunning && tskBarIcon.isPinned){
      setTimeout(() => {
        this.setIconState(false,tskBarIcon.opensWith,tskBarIcon.pid);
      }, delay);
    }
  }

  getTaskBarIconInfo(file?:FileInfo , process?:Process):TaskBarIconInfo{
    let taskBarIconInfo:TaskBarIconInfo = { pid: 0, uid: '', iconPath: '', defaultIconPath:'', opensWith: '', appName: '', displayName:'', showLabel: '', isRunning: false, isPinned: false, isOtherPinned:false, instanceCount: 0};
    if(file){
      const currentState = this.getAppCurrentState(file,undefined);
       taskBarIconInfo = {
        uid:`${file.getOpensWith}-0`,
        pid:0,
        opensWith:file.getOpensWith,
        iconPath:file.getIconPath,
        defaultIconPath: file.getIconPath,
        appName: file.getOpensWith,
        displayName: file.getOpensWith,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:true,
        isOtherPinned:true,
        instanceCount: 0,
      }
    }else if(process){
      const currentState = this.getAppCurrentState(undefined,process);
      taskBarIconInfo = {
        uid:`${process.getProcessName}-${process.getProcessId}`,
        pid:process.getProcessId,
        opensWith: process.getProcessName,
        iconPath: process.getIcon,
        defaultIconPath: process.getIcon,
        appName: process.getProcessName,
        displayName: process.getProcessName,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:false,
        isOtherPinned:false,
        instanceCount: 0,
      }
    }

    return taskBarIconInfo;
  }

  removeIconFromTaskBarIconList(pid:number, opensWith:string, isDefault:boolean):void{
    const isMerged = (this.taskBarEntriesIconState === this.mergedIcons)
    const deleteCount = 1;
    const tskBarIcons = (isMerged)? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;

    let procIndex  = 0;
    if(isDefault){
      procIndex = (isMerged)? tskBarIcons.findIndex(x => x.opensWith === opensWith) : tskBarIcons.findIndex(x => x.pid === pid);
    }else{
      procIndex = tskBarIcons.findIndex(x => x.opensWith === opensWith)
    }
    
    if(procIndex === -1) return;

    tskBarIcons.splice(procIndex, deleteCount);
  }

  onTaskBarIconClick(file:TaskBarIconInfo):void{
    if(!this._runningProcessService.isProcessRunning(file.opensWith)){
      const tmpFile:FileInfo = new FileInfo();
      tmpFile.setOpensWith = file.opensWith;
      this._processHandlerService.startApplicationProcess(tmpFile);
      return;
    }

    const pidWithHighestZIndex = this._windowServices.getProcessWindowIDWithHighestZIndex();

    if(this.taskBarEntriesIconState === this.mergedIcons){
      const instanceCount = this._runningProcessService.getProcessCount(file.opensWith);
      if(instanceCount === 1){
        const process = this._runningProcessService.getProcesses().find(x => x.getProcessName === file.opensWith);
        if(process){
          this.handleWindowState(process.getProcessId, pidWithHighestZIndex); 
        }
      }
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      if(file.pid === 0) return;

      this.handleWindowState(file.pid, pidWithHighestZIndex);   
    }
  }

  private handleWindowState(pid: number, pidWithHighestZIndex: number): void {
    const windowState = this._windowServices.getWindowState(pid);

    if (!windowState) return;

    if(!windowState.is_visible){ // make window visible
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(pid);
    } else if(windowState.is_visible && (windowState.pid !== pidWithHighestZIndex)){ //set window to focus
      this._windowServices.focusOnCurrentProcessWindowNotify.next(pid);
    }else{ // make window hidden
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(pid);
    }
  }

  openApplication(file:FileInfo):void{
    this._processHandlerService.startApplicationProcess(file);
  }

  closeApplication(proccess:Process[]):void{
    const  process = proccess[0];
    for(let i = 0; i <= proccess.length - 1; i++){
      this._windowServices.removeWindowState(proccess[i].getProcessId);
      this._runningProcessService.closeProcessNotify.next(proccess[i]);
    }

    // this removes other window state data
    const falsePid = 0;
    const falseUid = `${process.getProcessName}-${falsePid}`;
    this._windowServices.cleanUp(falseUid);
  }

  onShowIconContextMenu(evt:MouseEvent, file:TaskBarIconInfo):void{
    /* My hand was forced, I had to let the desktop display the taskbar context menu.
     * This is due to the fact that the taskbar has a max height of 40px, which is not enough room to display the context menu
     */
    let liElemnt:HTMLElement;

    if(this.taskBarEntriesIconState === this.mergedIcons)
      liElemnt = document.getElementById(`${this.tskbar}-${file.opensWith}`) as HTMLElement;
    else
      liElemnt = document.getElementById(`${this.tskbar}-${file.opensWith}-${file.pid}`) as HTMLElement;

    if(liElemnt){
      const rect =  liElemnt.getBoundingClientRect();
      const data:unknown[] = [rect, file];
  
      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);
  
      this._menuService.showTaskBarAppIconMenu.next(data);
    }

    evt.preventDefault();
  }

  onMouseEnter(opensWith:string, pid:number, iconPath:string):void{

    const rect = this.highlightTaskbarIconOnMouseHover(opensWith, pid);
    const isAppRunning = this._runningProcessService.getProcesses().some(x => x.getProcessName === opensWith);
    if(!isAppRunning){
      const data = [[rect?.left, rect?.top], [opensWith]]; 
      this._systemNotificationService.showTaskBarToolTipNotify.next(data);

      return;
    }
    if(rect){
      if(this.checkForMultipleActiveInstance(opensWith)) {
        rect.x = this.getAverageOfRectX(opensWith);
        const cnstnt = 0;
        const tmpX= (rect.x * 0.5); 
        const offSet = this.calculateOffset(opensWith);
        rect.x = tmpX - offSet + cnstnt;
      }else{
        // the width of a preivew window is set to 185px
        const prevWidth = 185;
        const xOffset = ((prevWidth - rect.width) * 0.5);
        const tmpX = rect.x - xOffset ;
        rect.x = tmpX;
      }

      this.showTaskBarPreviewWindow(rect, opensWith, pid, iconPath);
    }
  }

  showTaskBarPreviewWindow(rect:DOMRect, opensWith:string, pid:number, iconPath:string):void{
    const delay = 400;//400ms
    const data:unknown[] = [rect, opensWith, iconPath];

    if(this._runningProcessService.isProcessRunning(opensWith)){

      this._windowServices.showProcessPreviewWindowNotify.next(data);

      if(this.taskBarEntriesIconState === this.unMergedIcons){
        setTimeout(() => {
          this._systemNotificationService.taskBarPreviewHighlightNotify.next(`${opensWith}-${pid}`);
        }, delay);
      }
    }
  }

  checkForMultipleActiveInstance(processName:string):boolean {
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      const instanceCount = this._runningProcessService.getProcessCount(processName);
      if(instanceCount > 1){
        return true;
      }
    }
    return false;
  }

  getAverageOfRectX(processName:string):number {
    let xSum = 0;
    let xAvg = 0;

    const instanceCount = this._runningProcessService.getProcessCount(processName);
    const instances = this._runningProcessService.getProcesses().filter( x => x.getProcessName === processName);
    const instancIds =  instances.map(i => {
        return i.getProcessId;
    });

    instancIds.forEach((pid:number) =>{
      const liElemnt = document.getElementById(`${this.tskbar}-${processName}-${pid}`);
      if(liElemnt){
        const liElmntRect = liElemnt.getBoundingClientRect();
        xSum += liElmntRect.x;
      }
    });

    xAvg = (xSum /instanceCount);
    return xAvg;
  }

  getCorrectXOffset(processName:string):number {
    let xSum = 0;
    const instanceCount = this._runningProcessService.getProcessCount(processName);
    const instances = this._runningProcessService.getProcesses().filter( x => x.getProcessName === processName);
    const instancIds =  instances.map(i => {
        return i.getProcessId;
    });
    const prevWidth = 185;

    instancIds.forEach((pid:number) =>{
      const liElemnt = document.getElementById(`${this.tskbar}-${processName}-${pid}`);
      if(liElemnt){
        const liElmntRect = liElemnt.getBoundingClientRect();
        xSum += liElmntRect.width;
      }
    });

    const fixedWidth = (prevWidth * instanceCount);
    const xOffset = ((fixedWidth - xSum) * 0.5);

    return xOffset;
  }

  calculateOffset(processName:string):number{
    const firstInstance = this._runningProcessService.getProcesses().find(x => x.getProcessName === processName);
    if(firstInstance){
      const liElemnt = document.getElementById(`${this.tskbar}-${processName}-${firstInstance.getProcessId}`);
      if(liElemnt){
        const liElmntRect = liElemnt.getBoundingClientRect();
        const width = liElmntRect.width;

        // the width of a preivew window is set to 185px
        const prevWidth = 185;
        const offSet = Math.round(prevWidth - width);
        return offSet;
      }
    }
    return 0;
  }
  
  updateTaskBarIcon(info:Map<number, string[]>):void{
    if(!info) return;

    const firstEntry = info.entries().next().value;
    if(!firstEntry)return;

    if(this.taskBarEntriesIconState === this.mergedIcons) return;

    const [key, value] = firstEntry;
    
    const tskBarIconIdx = this.unMergedTaskBarIconList.findIndex(x => x.pid === key);
    if(tskBarIconIdx === -1) return;

    const tskBarIcon = this.unMergedTaskBarIconList[tskBarIconIdx];
    tskBarIcon.displayName = value[0];
    tskBarIcon.iconPath = value[1];
    this.unMergedTaskBarIconList[tskBarIconIdx] = tskBarIcon;
  }

  onMouseLeave(processName?:string, pid?:number):void{
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();
    
    if(processName && pid)
      this._systemNotificationService.taskBarPreviewUnHighlightNotify.next(`${processName}-${pid}`);
    
    this.highlightTaskbarIcon();
  }

  highlightTaskbarIconOnMouseHover(processName: string, pid: number): DOMRect | null {
    const processInFocus = this._runningProcessService.getProcess(this.windowInFocusPid);
  
    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged ? `${this.tskbar}-${processName}` : `${this.tskbar}-${processName}-${pid}`;
    const pillElementId =`${this.tskbar}-pill-${processName}`;
    const liElement = document.getElementById(elementId) as HTMLElement | null;
    const pillElement = document.getElementById(pillElementId) as HTMLElement | null;
  
    if (!liElement) return null;
  
    const highlightColor = 'hsl(206deg 77% 95%/20%)';
    const defaultColor = 'hsl(206deg 77% 40%/20%)';
  
    const shouldHighlight =
      processInFocus &&
      (isMerged
        ? processInFocus.getProcessName === processName
        : processInFocus.getProcessId === pid);
  
    liElement.style.backgroundColor = shouldHighlight ? highlightColor : defaultColor;

    if(pillElement){
      pillElement.style.backgroundColor = shouldHighlight ? highlightColor : defaultColor;
      pillElement.style.borderLeft= '0.5px solid #333';
    }
    return liElement.getBoundingClientRect();
  }
  
  highlightTaskbarIcon(): void {
    //if (this.prevWindowInFocusPid === this.windowInFocusPid) return;

    if(!this.isAnyWindowInFocus) return;

    this.removeHighlightFromTaskbarIcon();

    const process = this._runningProcessService.getProcess(this.windowInFocusPid);
    if (!process) return;
  
    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged
      ? `${this.tskbar}-${process.getProcessName}`
      : `${this.tskbar}-${process.getProcessName}-${process.getProcessId}`;
 
    const liElement = document.getElementById(elementId) as HTMLElement | null;
    if(liElement){
      liElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
    }

    const pillElementId =`${this.tskbar}-pill-${process.getProcessName}`;
    const pillElement = document.getElementById(pillElementId) as HTMLElement | null;
    if(pillElement){
      pillElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      pillElement.style.borderLeft= '0.5px solid #333';
    }
  }

  removeHighlightFromTaskbarIcon(pid?:number):void{
    let process:Process;
    if(pid){
      process = this._runningProcessService.getProcess(pid);
    }else{
      process = this._runningProcessService.getProcess(this.prevWindowInFocusPid);
    }
 
    if (!process) return;

    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged
      ? `${this.tskbar}-${process.getProcessName}`
      : `${this.tskbar}-${process.getProcessName}-${process.getProcessId}`;

    const liElemnt = document.getElementById(elementId) as HTMLElement | null;
    if(liElemnt){
      liElemnt.style.backgroundColor = Constants.EMPTY_STRING;
    }

    const pillElementId =`${this.tskbar}-pill-${process.getProcessName}`;
    const pillElement = document.getElementById(pillElementId) as HTMLElement | null;
    if(pillElement){
      pillElement.style.backgroundColor = Constants.EMPTY_STRING;
      pillElement.style.borderLeft= Constants.EMPTY_STRING;
    }
  }

  restoreOrMinizeWindow(processId:number){
    this._windowServices.restoreOrMinimizeProcessWindowNotify.next(processId);
  }

  storeTskBarState(app_data:TaskBarIconInfo, action:string):void{

    if(!this.sessionPinnedTaskbarIcons.some(x => x.opensWith === app_data.opensWith) && (action === this.pinAction)){
      app_data.uid = `${app_data.opensWith}-0`;
      app_data.pid = 0;
      app_data.iconPath = app_data.defaultIconPath;
      app_data.isRunning = false;
      app_data.showLabel = this.hideLabel;
    
      this.sessionPinnedTaskbarIcons.push(app_data);
    }else if(this.sessionPinnedTaskbarIcons.some(x => x.opensWith === app_data.opensWith) && (action === this.unPinAction)){
      const deleteCount = 1;
      const tskBarIconIndex = this.sessionPinnedTaskbarIcons.findIndex(x => x.opensWith === app_data.opensWith);
      if (tskBarIconIndex !== -1) {
        this.sessionPinnedTaskbarIcons.splice(tskBarIconIndex, deleteCount);
      }
    }

    this._sessionManagmentService.addSession(this.cheetahTskBarKey, this.sessionPinnedTaskbarIcons);
  }

  retrievePastSessionData():void{
    const tskBarData = this._sessionManagmentService.getSession(this.cheetahTskBarKey) as TaskBarIconInfo[];

    if(tskBarData !== undefined)
      this.sessionPinnedTaskbarIcons.push(...tskBarData);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
