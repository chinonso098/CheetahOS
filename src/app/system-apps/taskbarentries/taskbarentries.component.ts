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
import { IconAppCurrentState, TaskBarFileInfo } from './taskbar.entries.type';
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
  SECONDS_DELAY = 100; //100 millisecs
  activeProcesses:Process[] = [];
  pinToTaskBarList:TaskBarFileInfo[] = [];
  unMergedTaskBarList:TaskBarFileInfo[] = [];
  selectedFile!:FileInfo

  readonly mergedIcons = Constants.MERGED_TASKBAR_ENTRIES;
  readonly unMergedIcons = Constants.DISTINCT_TASKBAR_ENTRIES;
 
  readonly hideLabel = 'hideLabel';
  readonly showLabel = 'showLabel';

  taskBarEntriesIconState = this.unMergedIcons;
  hideShowLabelState = this.showLabel;

  readonly pinned = "pinned";
  readonly unPinned = "unPinned";
  readonly tskbar = "tskbar";
  readonly tskbarUnPinned = 'tskbar-UnPinned';

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

    this._menuService.pinToTaskBar.subscribe((p)=>{this.onPinIconToTaskBarList(p)});
    this._menuService.unPinFromTaskBar.subscribe((p)=>{this.onUnPinIconFromTaskBarList(p)});
    this._menuService.openApplicationFromTaskBar.subscribe((p)=>{this.openApplication(p)});
    this._menuService.closeApplicationFromTaskBar.subscribe((p) =>{this.closeApplication(p)});
    this._menuService.UnMergeTaskBarIcon.subscribe(() =>{this.changeTaskBarEntriesIconState(this.unMergedIcons)});
    this._menuService.mergeTaskBarIcon.subscribe(() =>{this.changeTaskBarEntriesIconState(this.mergedIcons)});

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
      this.activeProcesses = this.filterProcesses();
    }, delay);
  }

  updateRunningProcess():void{
    this.activeProcesses = this.filterProcesses();

    setTimeout(()=>{
      this.changeProcessStateIdentifier();
    }, this.SECONDS_DELAY)
  }

  onCloseProcessNotify(process:Process):void{
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.updateUnMergedTaskbarIconOnClose(process);
    }
  }

  onPinIconToTaskBarList(file:FileInfo):void{
    let tskbarFileInfo!:TaskBarFileInfo 

    if(this.taskBarEntriesIconState === this.mergedIcons){
      if(!this.pinToTaskBarList.some(x => x.opensWith === file.getOpensWith)){
        tskbarFileInfo = this.getTaskBarFileInfo(file,undefined);
        this.pinToTaskBarList.push(tskbarFileInfo);
      }
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      if(!this.unMergedTaskBarList.some(x => x.opensWith === file.getOpensWith)){
        tskbarFileInfo = this.getTaskBarFileInfo(file,undefined);
        this.unMergedTaskBarList.push(tskbarFileInfo);
      }
    }

    this.updateRunningProcess();
  }

  onUnPinIconFromTaskBarList(file:FileInfo):void{
    const deleteCount = 1;
    if(this.taskBarEntriesIconState === this.mergedIcons){
      const procIndex = this.pinToTaskBarList.findIndex((pin) => {
        return pin.opensWith === file.getOpensWith;
      });

      if(procIndex != -1){
          this.pinToTaskBarList.splice(procIndex, deleteCount)
      }
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      const procIndex = this.unMergedTaskBarList.findIndex((pin) => {
        return pin.opensWith === file.getOpensWith;
      });

    if(procIndex != -1){
        this.unMergedTaskBarList.splice(procIndex, deleteCount)
    }
    }
    this.updateRunningProcess();
  }

  changeTaskBarEntriesIconState(iconState:string):void{
    this.taskBarEntriesIconState  = iconState;
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.hideShowLabelState = this.showLabel;
    }else if(this.taskBarEntriesIconState === this.mergedIcons){
      this.hideShowLabelState = this.hideLabel;
    }

    this.retriggerRunningProcess();
  }

  retriggerRunningProcess():void{
    this.activeProcesses = this.filterProcesses();

    setTimeout(()=>{
      this.changeProcessStateIdentifier();
    }, this.SECONDS_DELAY)

    setTimeout(() => {
      this.highlightTaskbarIcon();
    }, 50);
  }

  filterProcesses():Process[]{
    const proccessesNotInPinToStart:Process[] = [];
    const delay = 5; // 5 millisecs
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      const proccesses = this.getProccessWithWindows()
      this.storeHistory(proccesses);

      for(const process of proccesses){
        const tskBarFile = this.unMergedTaskBarList.find(i => i.opensWith === process.getProcessName);
        if(tskBarFile){
          const proccessInstaceCount = this._runningProcessService.getProcessCount(process.getProcessName)
          if(proccessInstaceCount === 1){
            if(tskBarFile.isPinned){
              this.updatePinnedTaskbarIconOnInit(process);
            }
          }else if(proccessInstaceCount > 1){
            // add only unique instances
            if(!this.unMergedTaskBarList.find(i => i.opensWith === process.getProcessName && i.pid === process.getProcessId)){
              const tskbarFileInfo = this.getTaskBarFileInfo(undefined, process);
              this.unMergedTaskBarList.push(tskbarFileInfo);
            }
          }
          setTimeout(() => {this.setIconState(true, process.getProcessName, process.getProcessId);}, delay);
        }else{
          const tskbarFileInfo = this.getTaskBarFileInfo(undefined, process);
          this.unMergedTaskBarList.push(tskbarFileInfo);
          setTimeout(() => {this.setIconState(true, process.getProcessName, process.getProcessId);}, delay);
        }
      }
    }else if(this.taskBarEntriesIconState === this.mergedIcons){
      const uniqueProccesses = this.getUniqueProccessWithWindows();
      this.storeHistory(uniqueProccesses);
      /**
       * i have 2 lists of varying lengths
       * list one can have duplicates of the same object, but list 2 only has unique objects
       * compare both lists, if object.name from list1 equal to object.name from list 2
       * setIconToActive
       * else, put object in a different list
       */
      uniqueProccesses.forEach(x =>{
        if(this.pinToTaskBarList.some( i => i.opensWith === x.getProcessName)){
          this.setIconState(true, x.getProcessName);
        }else{
          proccessesNotInPinToStart.push(x);
        }
      });
    }
    return proccessesNotInPinToStart;
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

  changeProcessStateIdentifier():void{
    const runningProcess = this.getProccessWithWindows();

    if(this.taskBarEntriesIconState === this.mergedIcons){
      this.prevOpenedProccesses.forEach(x =>{
        if(!runningProcess.some(i => i.getProcessName === x)){
          this.setIconState(false, x);
        }else{
          this.setIconState(true, x);
        }
      });
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){
      this.prevOpenedProccesses.forEach(x =>{
        if(!runningProcess.some(i => i.getProcessName === x)){
          this.setIconState(false, x, 0);
        }
      });
    }
  }

  setIconState(isActive:boolean, appName:string, pid?:number){
    let liElemnt!:HTMLElement;

    if(this.taskBarEntriesIconState === this.unMergedIcons){
      liElemnt = document.getElementById(`tskbar-${appName}-${pid}`) as HTMLElement;
    }else if(this.taskBarEntriesIconState === this.mergedIcons){
      liElemnt = document.getElementById(`tskbar-${appName}`) as HTMLElement;
    }
    if(liElemnt){
      if(isActive)
        liElemnt.style.borderBottomColor = 'hsl(207deg 100%  72% / 90%)';
      else{
        liElemnt.style.borderBottomColor = Constants.EMPTY_STRING;
        liElemnt.style.backgroundColor = Constants.EMPTY_STRING;
      }
    }
  }

  getIconAppCurrentState(file?:FileInfo, process?:Process):IconAppCurrentState{

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
    const idx = this.unMergedTaskBarList.findIndex(x => x.uid === tmpUid);
    const pinned = this.unMergedTaskBarList[idx];

    if(pinned){
      //check if an instance of this apps is running
      const isRunning = this._runningProcessService.getProcesses()
        .some( p=> p.getProcessName === process.getProcessName);

      pinned.uid =  `${process.getProcessName}-${process.getProcessId}`; 
      pinned.pid = process.getProcessId;
      pinned.isRunning = isRunning;
      pinned.showLabel = this.showLabel;

      this.unMergedTaskBarList[idx] = pinned;
    }
  }


  updateUnMergedTaskbarIconOnClose(process:Process):void{
    const uid = `${process.getProcessName}-${process.getProcessId}`;
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarList.findIndex(x => x.uid === uid);
    const tskBarIcon = this.unMergedTaskBarList[idx];

    if(tskBarIcon){
      // if the instace that was closed, was the pinned instance
      if(tskBarIcon.isPinned){      
        //check if an instance of this apps is running, and update the pinned instance with it's info
        const isRunning = this._runningProcessService.getProcesses().some(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pid);
        if(isRunning){
          //update the pinned instace to point to one of the similar running instace
          const activeProccess = this._runningProcessService.getProcesses().find(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pid );
          if(activeProccess){
            tskBarIcon.uid = `${activeProccess.getProcessName}-${activeProccess.getProcessId}`;
            tskBarIcon.pid = activeProccess.getProcessId;
            tskBarIcon.iconPath = activeProccess.getIcon;
            tskBarIcon.isRunning = isRunning;
            tskBarIcon.showLabel = this.showLabel;
            tskBarIcon.isPinned = true;
 
            // this strange order is important
            this.removeActiveProcessFromUnMergedTasBarList(activeProccess.getProcessId);

            this.unMergedTaskBarList[idx] = tskBarIcon;
          }
        }else{
          tskBarIcon.uid = tmpUid;
          tskBarIcon.pid = 0;
          tskBarIcon.isRunning = isRunning;
          tskBarIcon.showLabel = this.hideLabel;
          this.unMergedTaskBarList[idx] = tskBarIcon;
        }
      }else if(!tskBarIcon.isPinned){
        this.removeActiveProcessFromUnMergedTasBarList(process.getProcessId);
      }
    }
  }

  getTaskBarFileInfo(file?:FileInfo , process?:Process):TaskBarFileInfo{

    let taskBarFileInfo:TaskBarFileInfo = { pid: 0, uid: '', iconPath: '', opensWith: '', appName: '', showLabel: '', isRunning: false, isPinned: false};
    if(file){
      const currentState = this.getIconAppCurrentState(file,undefined);
       taskBarFileInfo = {
        uid:`${file.getOpensWith}-0`,
        pid:0,
        opensWith:file.getOpensWith,
        iconPath:file.getIconPath,
        appName: file.getFileName,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:true
      }
    }else if(process){
      const currentState = this.getIconAppCurrentState(undefined,process);
      taskBarFileInfo = {
        uid:`${process.getProcessName}-${process.getProcessId}`,
        pid:process.getProcessId,
        opensWith: process.getProcessName,
        iconPath: process.getIcon,
        appName: process.getProcessName,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:false
      }
    }

    return taskBarFileInfo;
  }

  public removeActiveProcessFromUnMergedTasBarList(pid:number):void{
    const deleteCount = 1;
    const procIndex = this.unMergedTaskBarList.findIndex((process) => {
        return process.pid === pid;
      });

    if(procIndex != -1){
      this.unMergedTaskBarList.splice(procIndex, deleteCount)
    }
 }

  onPinnedAppIconClick(file:TaskBarFileInfo):void{
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

  onShowIconContextMenu(evt:MouseEvent, file:TaskBarFileInfo):void{
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
      const isPinned = true;
      const data:unknown[] = [rect, file, isPinned];
  
      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);
  
      this._menuService.showTaskBarAppIconMenu.next(data);
    }

    evt.preventDefault();
  }

  onShowUnPinnedIconContextMenu(evt:MouseEvent, proccess:Process):void{
    const file = new FileInfo();
    file.setOpensWith = proccess.getProcessName;
    file.setIconPath = proccess.getIcon;

    let liElemnt:HTMLElement;

    if(this.taskBarEntriesIconState === this.mergedIcons)
     liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}`) as HTMLElement;
    else
      liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;

    if(liElemnt){
      const rect =  liElemnt.getBoundingClientRect();
      const isPinned = false;
      const data:unknown[] = [rect, file, isPinned];
  
      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);
  
      this._menuService.showTaskBarAppIconMenu.next(data);
    }

    evt.preventDefault();
  }

  onMouseEnter(appName:string, pid:number, iconPath:string, caller:string):void{
    const prefix = (caller === this.pinned)? this.tskbar: this.tskbarUnPinned;
    const rect = this.highlightTaskbarIconOnMouseHover(prefix, appName, pid);
    if(rect){
      if(this.checkForMultipleActiveInstance(appName)) {
        rect.x = this.getAverageOfRectX(prefix, appName);
        const cnstnt = 0;
        const tmpX= (rect.x * 0.5); 
        const offSet = this.calculateOffset(prefix, appName);
        rect.x = tmpX - offSet + cnstnt;
      }else{
        // the width of a preivew window is set to 185px
        const prevWidth = 185;
        const xOffset = ((prevWidth - rect.width) * 0.5);
        const tmpX = rect.x - xOffset ;
        rect.x = tmpX;
      }

      console.log(`onMouseEnter -- rect:${rect}`);
      const data:unknown[] = [rect, appName, iconPath];
      if(this._runningProcessService.isProcessRunning(appName)){
        const delay = 400;
        this._windowServices.showProcessPreviewWindowNotify.next(data);

        if(this.taskBarEntriesIconState === this.unMergedIcons){
          setTimeout(() => {
            this._systemNotificationService.taskBarPreviewHighlightNotify.next(`${appName}-${pid}`);
          }, delay);
        }
      }
    }
  }

  checkForMultipleActiveInstance(appName:string):boolean {
    if(this.taskBarEntriesIconState === this.unMergedIcons){
      const instanceCount = this._runningProcessService.getProcessCount(appName);
      if(instanceCount > 1){
        return true;
      }
    }
    return false;
  }

  getAverageOfRectX(prefix:string, appName:string):number {
    let xSum = 0;
    let xAvg = 0;

    const instanceCount = this._runningProcessService.getProcessCount(appName);
    const instances = this._runningProcessService.getProcesses().filter( x => x.getProcessName === appName);
    const instancIds =  instances.map(i => {
        return i.getProcessId;
    });

    instancIds.forEach((pid:number) =>{
      const liElemnt = document.getElementById(`${prefix}-${appName}-${pid}`);
      if(liElemnt){
        const liElmntRect = liElemnt.getBoundingClientRect();
        xSum += liElmntRect.x;
      }
    });

    xAvg = (xSum /instanceCount);
    return xAvg;
  }

  getCorrectXOffset(prefix:string, appName:string):number {
    let xSum = 0;
    const instanceCount = this._runningProcessService.getProcessCount(appName);
    const instances = this._runningProcessService.getProcesses().filter( x => x.getProcessName === appName);
    const instancIds =  instances.map(i => {
        return i.getProcessId;
    });
    const prevWidth = 185;

    instancIds.forEach((pid:number) =>{
      const liElemnt = document.getElementById(`${prefix}-${appName}-${pid}`);
      if(liElemnt){
        const liElmntRect = liElemnt.getBoundingClientRect();
        xSum += liElmntRect.width;
      }
    });

    const fixedWidth = (prevWidth * instanceCount);
    const xOffset = ((fixedWidth - xSum) * 0.5);

    return xOffset;
  }

  calculateOffset(prefix:string, appName:string):number{
    const firstInstance = this._runningProcessService.getProcesses().find(x => x.getProcessName === appName);
    if(firstInstance){
      const liElemnt = document.getElementById(`${prefix}-${appName}-${firstInstance.getProcessId}`);
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
  

  onMouseLeave(appName?:string, pid?:number):void{
    this._windowServices.hideProcessPreviewWindowNotify.next();

    if(appName && pid)
      this._systemNotificationService.taskBarPreviewUnHighlightNotify.next(`${appName}-${pid}`);
    
    this.highlightTaskbarIcon();
  }

  highlightTaskbarIconOnMouseHover(prefix:string, appName:string, pid:number): DOMRect | null{

    //console.log(`highlightTaskbarIconOnMouseHover -- prefix:${prefix}, appName:${appName}, pid:${pid}`);
    const proccessInFocus = this._runningProcessService.getProcess(this.windowInFocusPid);

    let liElemnt:HTMLElement;
    
    if(this.taskBarEntriesIconState === this.mergedIcons){
      liElemnt = document.getElementById(`${prefix}-${appName}`) as HTMLElement;
      if(liElemnt){
        if(proccessInFocus){
          if(proccessInFocus.getProcessName === appName){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 95%/20%)';
          }else{
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 40%/20%)';
          }
        }else{
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 40%/20%)';
        }

        return liElemnt.getBoundingClientRect();
      }
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
      liElemnt = document.getElementById(`${prefix}-${appName}-${pid}`) as HTMLElement;
      if(liElemnt){
        if(proccessInFocus){
          if(proccessInFocus.getProcessId === pid){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 95%/20%)';
          }else{
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 40%/20%)';
          }
        }else{
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 40%/20%)';
        }
        return liElemnt.getBoundingClientRect();
      }
    }

    return null;
  }

  highlightTaskbarIcon():void{
    if(this.prevWindowInFocusPid === this.windowInFocusPid) return;

    this.removeHighlightFromTaskbarIcon();

    const proccess = this._runningProcessService.getProcess(this.windowInFocusPid);
    let liElemnt:HTMLElement;
  
    if(proccess){
      if(this.taskBarEntriesIconState === this.mergedIcons){
        liElemnt = document.getElementById(`${this.tskbar}-${proccess.getProcessName}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
        }else{
          liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          }
        }
      }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
        liElemnt = document.getElementById(`${this.tskbar}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
        }else{
          liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          }
        }
      }
    }
  }

  removeHighlightFromTaskbarIcon():void{
    const proccess = this._runningProcessService.getProcess(this.prevWindowInFocusPid);
    let liElemnt:HTMLElement;

    if(proccess){
      if(this.taskBarEntriesIconState === this.mergedIcons){
        liElemnt = document.getElementById(`${this.tskbar}-${proccess.getProcessName}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = '';
        }else{
          liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = '';
          }
        }
      }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
        liElemnt = document.getElementById(`${this.tskbar}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = '';
        }else{
          liElemnt = document.getElementById(`${this.tskbarUnPinned}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = '';
          }
        }
      }
    }
  }

  restoreOrMinizeWindow(processId:number){
    this._windowServices.restoreOrMinimizeProcessWindowNotify.next(processId)
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
