import { AfterViewInit, Component } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { IconAppCurrentState, TaskBarIconInfo } from './taskbar.entries.type';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

@Component({
  selector: 'cos-taskbarentries',
  templateUrl: './taskbarentries.component.html',
  styleUrls: ['./taskbarentries.component.css']
})
export class TaskBarEntriesComponent implements AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _systemNotificationService:SystemNotificationService;
  private _menuService:MenuService;
  private _windowServices:WindowService;

  private prevOpenedProccesses:string[]= [];
  SECONDS_DELAY = 50; //50 millisecs
  mergedTaskBarIconList:TaskBarIconInfo[] = [];
  unMergedTaskBarIconList:TaskBarIconInfo[] = [];
  pinnedTaskBarIconList:TaskBarIconInfo[] = [];

  selectedFile!:FileInfo

  readonly mergedIcons = Constants.MERGED_TASKBAR_ENTRIES;
  readonly unMergedIcons = Constants.DISTINCT_TASKBAR_ENTRIES;
 
  readonly hideLabel = 'hideLabel';
  readonly showLabel = 'showLabel';
  readonly tskbar = 'tskbar';

  taskBarEntriesIconState = this.unMergedIcons;
  hideShowLabelState = this.showLabel;

  windowInFocusPid = 0;
  prevWindowInFocusPid = 0;
  
  hasWindow = false;
  icon =  `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbarentry';
  processId = 0;
  type = ComponentType.System;
  displayName = '';
  tmpInfo!:string[];

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
              triggerProcessService:TriggerProcessService, windowServices:WindowService, systemNotificationService:SystemNotificationService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;
    this._menuService = menuService;
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;

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
      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, this.SECONDS_DELAY);
    });

    this._windowServices.currentProcessInFocusNotify.subscribe((p) =>{
      this.prevWindowInFocusPid = this.windowInFocusPid;
      this.windowInFocusPid = p;
      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, this.SECONDS_DELAY);
    });
  }
  
  ngAfterViewInit(): void {
    const delay = 1500; //1.5 secs
    //change detection is the better solution
    setTimeout(() => {
      this.setIconsBasedOnTaskbarMode();
    }, delay);
  }

  updateRunningProcess():void{
    this.setIconsBasedOnTaskbarMode();
  }

  onCloseProcessNotify(process:Process):void{
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.updateUnMergedTaskbarIconListOnClose(process);
    }
  }

  onPinIconToTaskBarIconList(file:FileInfo):void{
    let result:TaskBarIconInfo[] = [];

    if(this.taskBarEntriesIconState === this.mergedIcons){
      result = this.onPinTaskBarIconHelper(this.mergedTaskBarIconList, file);
      this.mergedTaskBarIconList = [];
      this.mergedTaskBarIconList.push(...result);
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      result = this.onPinTaskBarIconHelper(this.unMergedTaskBarIconList, file);
      this.unMergedTaskBarIconList = [];
      this.unMergedTaskBarIconList.push(...result);
    }

    // setTimeout(() => {
    //   this.highlightTaskbarIcon();
    // }, this.SECONDS_DELAY);
  }

  onPinTaskBarIconHelper(tskBarIcons:TaskBarIconInfo[], file:FileInfo):TaskBarIconInfo[]{
    let tskbarFileInfo!:TaskBarIconInfo 

    if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith)){
      tskbarFileInfo = this.getTaskBarIconInfo(file,undefined);
      tskBarIcons.push(tskbarFileInfo);
    }else{
      if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith && x.isPinned)){
        const unPinnedIcon = tskBarIcons.find(x => x.opensWith === file.getOpensWith);
        if(unPinnedIcon){
          const unPinnedIconIdx = tskBarIcons.findIndex(x => x.opensWith === unPinnedIcon.opensWith && x.pid === unPinnedIcon.pid);
          const updatedIcon = {...unPinnedIcon};
          updatedIcon.isPinned = true;
          updatedIcon.isOtherPinned = true;
          tskBarIcons[unPinnedIconIdx] = updatedIcon;

          //update other instances of app, set isOtherPinned = true;
          const result = this.updateIsOtherPinnedState(tskBarIcons, unPinnedIcon.pid, unPinnedIcon.opensWith, true);
          tskBarIcons = [];
          tskBarIcons.push(...result);
        }
      }
    }

    return tskBarIcons;
  }

  onUnPinIconFromTaskBarIconList(file:FileInfo):void{
    let result:TaskBarIconInfo[] = [];
    if(this.taskBarEntriesIconState === this.mergedIcons){
      result = this.onUnPinIconFromTaskBarHelper(this.mergedTaskBarIconList, file);
      this.mergedTaskBarIconList = [];
      this.mergedTaskBarIconList.push(...result);
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      result = this.onUnPinIconFromTaskBarHelper(this.unMergedTaskBarIconList, file);
      this.unMergedTaskBarIconList = [];
      this.unMergedTaskBarIconList.push(...result);
    }

    // setTimeout(() => {
    //   this.highlightTaskbarIcon();
    // }, this.SECONDS_DELAY);
  }

  onUnPinIconFromTaskBarHelper(tskBarIcons:TaskBarIconInfo[], file:FileInfo):TaskBarIconInfo[]{
    const pinnedIconIdx = tskBarIcons.findIndex( x => x.opensWith === file.getOpensWith && x.isPinned);

    if(pinnedIconIdx === -1) return tskBarIcons;
    
    const pinnedIcon = tskBarIcons[pinnedIconIdx]
    const updatedIcon = {...pinnedIcon};
    updatedIcon.isPinned = false;
    updatedIcon.isOtherPinned = false;
    tskBarIcons[pinnedIconIdx] = updatedIcon;

    //update other instances of app, set isOtherPinned = false;
    const result = this.updateIsOtherPinnedState(tskBarIcons, pinnedIcon.pid, pinnedIcon.opensWith, false);
    tskBarIcons = [];
    tskBarIcons.push(...result);

    return tskBarIcons;
  }

  updateIsOtherPinnedState(tskBarIcons:TaskBarIconInfo[], pid:number, opensWith:string, isOtherPinned:boolean):TaskBarIconInfo[]{
    const updated = tskBarIcons.map(item =>
      (item.opensWith === opensWith && item.pid !== pid) ? { ...item, isOtherPinned: isOtherPinned } : item
    );

    return updated;
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

    console.log('pinnedTaskBarIconList:',this.pinnedTaskBarIconList);
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
        const instaceCount = this._runningProcessService.getProcessCount(process.getProcessName)
        if(instaceCount === 1 && existingIcon.isPinned){
          this.updatePinnedTaskbarIconOnInit(process);
        }else if((instaceCount > 1) 
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
    //this.groupTaskBarIconsByEntryOrder(this.unMergedTaskBarIconList);
  }

  handleMergedTaskbarIcons():void{
    const delay = 5; // 5 millisecs
    const uniqueProccesses = this.getUniqueProccessWithWindows();
    this.storeHistory(uniqueProccesses);

    for(const process of uniqueProccesses){
      const isPinned = this.checkIfIconWasPinned(process.getProcessName);
      if(!this.mergedTaskBarIconList.some( i => i.opensWith === process.getProcessName)){
        const newIcon = this.getTaskBarIconInfo(undefined, process);
        newIcon.isPinned = isPinned;
        newIcon.isOtherPinned = isPinned;
        this.mergedTaskBarIconList.push(newIcon);
      }
      setTimeout(() => { this.setIconState(true, process.getProcessName);}, delay);
    }
  }

  groupTaskBarIconsByEntryOrder(tskBarInfo:TaskBarIconInfo[]):void{
    const groupedIcons = new Map<string, TaskBarIconInfo[]>();
  
    for (const iconInfo of tskBarInfo) {
      if (!groupedIcons.has(iconInfo.opensWith)) {
        groupedIcons.set(iconInfo.opensWith, []);
      }
      groupedIcons.get(iconInfo.opensWith)?.push(iconInfo);
    }
  
    // Flatten the values
    const result =  Array.from(groupedIcons.values()).flat();
    this.unMergedTaskBarIconList = [];
    this.unMergedTaskBarIconList.push(...result);
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
          uniqueProccesses.push(x)
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
        this.prevOpenedProccesses.push(x.getProcessName)
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
      tskBarIcon.isPinned = true
      tskBarIcon.isOtherPinned = true

      this.unMergedTaskBarIconList[idx] = tskBarIcon;
    }
  }

  updateUnMergedTaskbarIconListOnClose(process:Process):void{
    const uid = `${process.getProcessName}-${process.getProcessId}`;
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarIconList.findIndex(x => x.uid === uid);

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
            this.removeIconFromUnMergedTaskBarIconList(alternateProcess.getProcessId);
            replacementIcon.isPinned = true;      
            this.unMergedTaskBarIconList[idx] = replacementIcon;
          }
        }
      }else{
        const replacementIcon:TaskBarIconInfo = {...tskBarIcon};
        replacementIcon.uid = tmpUid;
        replacementIcon.pid = 0;
        replacementIcon.isRunning = isAppRunning;
        replacementIcon.showLabel = this.hideLabel;
        replacementIcon.iconPath = tskBarIcon.defaultIconPath;
        this.unMergedTaskBarIconList[idx] = replacementIcon;
      }
    }else if(!tskBarIcon.isPinned){
      this.removeIconFromUnMergedTaskBarIconList(process.getProcessId);
    }
  }

  getTaskBarIconInfo(file?:FileInfo , process?:Process):TaskBarIconInfo{
    let taskBarIconInfo:TaskBarIconInfo = { pid: 0, uid: '', iconPath: '', defaultIconPath:'', opensWith: '', appName: '', displayName:'', showLabel: '', isRunning: false, isPinned: false, isOtherPinned:false};
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
        isOtherPinned:true
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
        isOtherPinned:false
      }
    }

    return taskBarIconInfo;
  }

  removeIconFromUnMergedTaskBarIconList(pid:number):void{
    const deleteCount = 1;
    const procIndex = this.unMergedTaskBarIconList.findIndex(x => x.pid === pid);
    
    if(procIndex != -1){
      this.unMergedTaskBarIconList.splice(procIndex, deleteCount);
    }
  }

  onPinnedTaskBarIconClick(file:TaskBarIconInfo):void{
    // check if the give app is running
    // if it isn't running, then trigger it
    if(!this._runningProcessService.isProcessRunning(file.opensWith)){
      const tmpFile:FileInfo = new FileInfo();
      tmpFile.setOpensWith = file.opensWith;
      this._triggerProcessService.startApplication(tmpFile);
    }else{
      const process = this._runningProcessService.getProcesses().filter(x => x.getProcessName === file.opensWith);
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(process[0].getProcessId);
    }
  }

  openApplication(file:FileInfo):void{
    this._triggerProcessService.startApplication(file);
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

      console.log(`onMouseEnter -- rect:${rect}`);
      const data:unknown[] = [rect, opensWith, iconPath];
      if(this._runningProcessService.isProcessRunning(opensWith)){
        const delay = 400;
        this._windowServices.showProcessPreviewWindowNotify.next(data);

        if(this.taskBarEntriesIconState === this.unMergedIcons){
          setTimeout(() => {
            this._systemNotificationService.taskBarPreviewHighlightNotify.next(`${opensWith}-${pid}`);
          }, delay);
        }
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

    if(processName && pid)
      this._systemNotificationService.taskBarPreviewUnHighlightNotify.next(`${processName}-${pid}`);
    
    this.highlightTaskbarIcon();
  }

  highlightTaskbarIconOnMouseHover(processName: string, pid: number): DOMRect | null {
    const processInFocus = this._runningProcessService.getProcess(this.windowInFocusPid);
  
    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged ? `${this.tskbar}-${processName}` : `${this.tskbar}-${processName}-${pid}`;
    const liElement = document.getElementById(elementId) as HTMLElement | null;
  
    if (!liElement) return null;
  
    const highlightColor = 'hsl(206deg 77% 95%/20%)';
    const defaultColor = 'hsl(206deg 77% 40%/20%)';
  
    const shouldHighlight =
      processInFocus &&
      (isMerged
        ? processInFocus.getProcessName === processName
        : processInFocus.getProcessId === pid);
  
    liElement.style.backgroundColor = shouldHighlight ? highlightColor : defaultColor;
    return liElement.getBoundingClientRect();
  }
  
  highlightTaskbarIcon(): void {
    if (this.prevWindowInFocusPid === this.windowInFocusPid) return;

    this.removeHighlightFromTaskbarIcon();

    const process = this._runningProcessService.getProcess(this.windowInFocusPid);
    if (!process) return;
  
    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged
      ? `${this.tskbar}-${process.getProcessName}`
      : `${this.tskbar}-${process.getProcessName}-${process.getProcessId}`;
  
    const liElement = document.getElementById(elementId) as HTMLElement | null;
    if (liElement) {
      liElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
    }
  }
  
  removeHighlightFromTaskbarIcon():void{
    const process = this._runningProcessService.getProcess(this.prevWindowInFocusPid);
    if (!process) return;

    const isMerged = this.taskBarEntriesIconState === this.mergedIcons;
    const elementId = isMerged
      ? `${this.tskbar}-${process.getProcessName}`
      : `${this.tskbar}-${process.getProcessName}-${process.getProcessId}`;

    const liElemnt = document.getElementById(elementId) as HTMLElement | null;
    if (liElemnt) {
      liElemnt.style.backgroundColor = '';
    }
  }

  restoreOrMinizeWindow(processId:number){
    this._windowServices.restoreOrMinimizeProcessWindowNotify.next(processId)
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
