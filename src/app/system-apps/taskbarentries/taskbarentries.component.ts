import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { IconAppCurrentState, IconAppState, TaskBarFileInfo } from './taskbar.entries.type';

@Component({
  selector: 'cos-taskbarentries',
  templateUrl: './taskbarentries.component.html',
  styleUrls: ['./taskbarentries.component.css']
})
export class TaskBarEntriesComponent implements AfterViewInit, OnDestroy {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _menuService:MenuService;
  private _windowServices:WindowService;

  private prevOpenedProccesses:string[]= [];
  SECONDS_DELAY = 100;
  runningProcess:Process[] = [];
  pinToTaskBarList:TaskBarFileInfo[] = [];
  //pinnedAppIconState:IconAppState[] = []
  selectedFile!:FileInfo

  readonly mergedIcons = Constants.MERGED_TASKBAR_ENTRIES;
  readonly unMergedIcons = Constants.DISTINCT_TASKBAR_ENTRIES;

  taskBarEntriesIconState = Constants.DISTINCT_TASKBAR_ENTRIES;
  readonly hideLabel = 'hideLabel';
  readonly showLabel = 'showLabel';
  hideShowLabelState = 'showLabel';

  readonly pinned = "pinned";
  readonly unPinned = "unPinned";
  windowInFocusPid = 0;
  prevWindowInFocusPid = 0;
  
  hasWindow = false;
  icon =  `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbarentry';
  processId = 0;
  type = ComponentType.System;
  displayName = '';
  appProcessId = 0;
  newUniqueId = Constants.EMPTY_STRING;

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
              triggerProcessService:TriggerProcessService, windowServices:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;
    this._menuService = menuService;
    this._windowServices = windowServices;

    this.processId = this._processIdService.getNewProcessId();

    this._runningProcessService.addProcess(this.getComponentDetail());
    this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess()});
    this._runningProcessService.newProcessNotify.subscribe((p) =>{

      console.log('newUniqueId:', p)
      
      this.newUniqueId = p});

    this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.IAmNotSureAboutMethodName(p)});

    this._menuService.pinToTaskBar.subscribe((p)=>{this.pinIconToTaskBarList(p)});
    this._menuService.unPinFromTaskBar.subscribe((p)=>{this.unPinIconFromTaskBarList(p)});
    this._menuService.openApplicationFromTaskBar.subscribe((p)=>{this.openApplication(p)});
    this._menuService.closeApplicationFromTaskBar.subscribe((p) =>{this.closeApplication(p)});
    this._menuService.UnMergeTaskBarIcon.subscribe(() =>{this.mergeUnMergeTaskEntriesIcon(this.mergedIcons)});
    this._menuService.mergeTaskBarIcon.subscribe(() =>{this.mergeUnMergeTaskEntriesIcon(this.unMergedIcons)});

    this._windowServices.focusOnCurrentProcessWindowNotify.subscribe((p)=>{
      this.prevWindowInFocusPid = this.windowInFocusPid;
      this.windowInFocusPid = p;
      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, 100);
    });

    this._windowServices.currentProcessInFocusNotify.subscribe((p) =>{
      this.prevWindowInFocusPid = this.windowInFocusPid;
      this.windowInFocusPid = p;
      setTimeout(() => {
        this.highlightTaskbarIcon();
      }, 100);
    });
  }
  
  ngAfterViewInit(): void {
    //change detection is the better solution
    setTimeout(() => {
      this.runningProcess = this.filterProcesses();
    }, 1500);
  }

  ngOnDestroy(): void {
    1
  }

  updateRunningProcess():void{
    this.runningProcess = this.filterProcesses();

    setTimeout(()=>{
      this.changeProcessStateIdentifier();
    },this.SECONDS_DELAY) 
  }

  IAmNotSureAboutMethodName(process:Process):void{
    if(this.taskBarEntriesIconState === this.unMergedIcons){

      // const tmpFile:FileInfo = new FileInfo();
      // tmpFile.setFileName = process.getProcessName;
      // tmpFile.setOpensWith = process.getProcessName;

      const uid = `${process.getProcessName}-${process.getProcessId}`;
      console.log('uid:', uid);
      this.updateTaskBarFileInfoInPinnedTaskbarList_(uid);
      //this.hideShowIconLabel(tmpFile);
    }
  }

  pinIconToTaskBarList(file:FileInfo):void{
    let tskbarFileInfo!:TaskBarFileInfo 
    if(!this.pinToTaskBarList.some(x => x.opensWith === file.getOpensWith)){
      tskbarFileInfo = this.getTaskBarFileInfo(file);

      console.log('pinIconToTaskBarList-tskbarFileInfo:', tskbarFileInfo);
      this.pinToTaskBarList.push(tskbarFileInfo);
    }
    else return

    //this.hideShowIconLabel(tskbarFileInfo);
    this.updateRunningProcess();
  }

  pinIconToTaskBarList_unique(file:FileInfo):void{
    // if(!this.pinToTaskBarList.some(x => x.getOpensWith === file.getOpensWith))
    //     this.pinToTaskBarList.push(file);

    //this.hideShowIconLabel(file);
    this.updateRunningProcess();
  }

  unPinIconFromTaskBarList_unique(file:FileInfo):void{
    const deleteCount = 1;
    // const procIndex = this.pinToTaskBarList.findIndex((pin) => {
    //     return pin.getOpensWith === file.getOpensWith;
    //   });

    // if(procIndex != -1){
    //     this.pinToTaskBarList.splice(procIndex, deleteCount)
    // }
    this.updateRunningProcess();
  }

  unPinIconFromTaskBarList(file:FileInfo):void{
    const deleteCount = 1;
    const procIndex = this.pinToTaskBarList.findIndex((pin) => {
        return pin.opensWith === file.getOpensWith;
      });

    if(procIndex != -1){
        this.pinToTaskBarList.splice(procIndex, deleteCount)
    }
    this.updateRunningProcess();
  }

  mergeUnMergeTaskEntriesIcon(iconState:string):void{
    this.taskBarEntriesIconState  = iconState;

    if(this.taskBarEntriesIconState === this.mergedIcons){
      this.hideShowLabelState = this.showLabel;
    }else{
      this.hideShowLabelState = this.hideLabel;
    }

    this.filterProcesses();
  }

  filterProcesses_unique():Process[]{
    const proccessesNotInPinToStart:Process[] = [];
    const uniqueProccesses = this.getUniqueProccessWithWindows();
    

    this.storeHistory(uniqueProccesses);
    /**
     * i have 2 lists of varying lengths
     * list one can have duplicates of the same object, but list 2 only has unique objects
     * compare both lists, if object.name from list1 equal to object.name from list 2
     * setIconToActive
     * else, put object in a different list
     */
    // uniqueProccesses.forEach(x =>{
    //   if(this.pinToTaskBarList.some( i => i.getOpensWith === x.getProcessName)){
    //     this.appProcessId = x.getProcessId;
    //     this.setIconState(x.getProcessName,true);
    //   }else{
    //     proccessesNotInPinToStart.push(x);
    //   }
    // });
  
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

  filterProcesses():Process[]{
    const proccessesNotInPinToStart:Process[] = [];
    const proccesses = this.getProccessWithWindows()


    this.storeHistory(proccesses);

    /**
     * i have 2 lists of varying lengths
     * list one can have duplicates of the same object, but list 2 only has unique objects
     * compare both lists, if object.name from list1 equal to object.name from list 2
     * setIconToActive
     * else, put object in a different list
     */
    proccesses.forEach(x =>{
      if(this.pinToTaskBarList.some( i => i.opensWith === x.getProcessName)){
        this.appProcessId = x.getProcessId;
        this.setIconState(x.getProcessName,true);
      }else{
        proccessesNotInPinToStart.push(x);
      }
    });
  
    return proccessesNotInPinToStart;
  }

  getProccessWithWindows():Process[]{
    /**
     * filter first on processes that have windows
     * then select unique instance of process with same proccess name
     */
    return this._runningProcessService.getProcesses().filter(p => p.getHasWindow == true);
  }

  getTaskBarFileInfo(file:FileInfo):TaskBarFileInfo{
    const currentState = this.getIconAppCurrentState(file);

    const taskBarFileInfo:TaskBarFileInfo = {
      uid:`${file.getOpensWith}-0`,
      pid:0,
      opensWith:file.getOpensWith,
      iconPath:file.getIconPath,
      appName: file.getFileName,
      showLabel:currentState.showLabel,
      isRunning:currentState.isRunning,
    }

    return taskBarFileInfo;
  }

  storeHistory(arg:Process[]):void{
    arg.forEach(x =>{
      if(!this.prevOpenedProccesses.includes(x.getProcessName)){
        this.prevOpenedProccesses.push(x.getProcessName)
      }
    });
  }

  changeProcessStateIdentifier_unique():void{
    const runningProcess = this.getUniqueProccessWithWindows();
    this.prevOpenedProccesses.forEach(x =>{
      if(!runningProcess.some(i => i.getProcessName === x)){
        this.setIconState(x,false);
      }else{
        this.setIconState(x,true);
      }
    });
  }


  changeProcessStateIdentifier():void{
    const runningProcess = this.getProccessWithWindows();
    this.prevOpenedProccesses.forEach(x =>{
      if(!runningProcess.some(i => i.getProcessName === x)){
        this.setIconState(x,false);
      }else{
        this.setIconState(x,true);
      }
    });
  }

  setIconState(appName:string, isActive:boolean){
    const liElemnt = document.getElementById(`tskbar-${appName}`) as HTMLElement;
    if(liElemnt){
      if(isActive)
        liElemnt.style.borderBottomColor = 'hsl(207deg 100%  72% / 90%)';
      else
      liElemnt.style.borderBottomColor = '';
    }
  }

  getIconAppCurrentState(file:FileInfo):IconAppCurrentState{

    //check if an instance of this apps is running
    const isRunning = this._runningProcessService.getProcesses()
      .some( p=> p.getProcessName === file.getOpensWith);

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

  updateTaskBarFileInfoInPinnedTaskbarList(file:TaskBarFileInfo):void{
    const tmpUid = `${file.opensWith}-0`;
    const idx = this.pinToTaskBarList.findIndex(x => x.uid === tmpUid);
    const pinned = this.pinToTaskBarList[idx];

    if(pinned){
      //check if an instance of this apps is running
      const isRunning = this._runningProcessService.getProcesses()
        .some( p=> p.getProcessName === file.opensWith);

      const pid = this.newUniqueId.split(Constants.DASH)[1];
      pinned.uid = this.newUniqueId;
      pinned.pid = Number(pid);
      pinned.isRunning = isRunning;
      pinned.showLabel = this.showLabel;

      this.pinToTaskBarList[idx] = pinned;

      console.log('pinned:', pinned);
    }
  }


  updateTaskBarFileInfoInPinnedTaskbarList_(uid:string):void{

    const appName = uid.split(Constants.DASH)[0];
    const tmpUid = `${appName}-0`;
    const idx = this.pinToTaskBarList.findIndex(x => x.uid === uid);
    const pinned = this.pinToTaskBarList[idx];

    if(pinned){
      //check if an instance of this apps is running
      const isRunning = this._runningProcessService.getProcesses()
        .some( p=> p.getProcessName === appName);

      pinned.uid = tmpUid;
      pinned.pid = 0;
      pinned.isRunning = isRunning;
      pinned.showLabel = this.hideLabel;

      this.pinToTaskBarList[idx] = pinned;

      console.log('pinned:', pinned);
    }
  }

  onPinnedAppIconClick_unique(file:FileInfo):void{
    // check if the give app is running
    // if it isn't running, then trigger it
    if(!this._runningProcessService.isProcessRunning(file.getOpensWith)){
      this._triggerProcessService.startApplication(file);
      //this.hideShowIconLabel(file);
      return;
    }else{
      const process = this._runningProcessService.getProcesses().filter(x => x.getProcessName === file.getOpensWith);
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(process[0].getProcessId);
    }
  }

  onPinnedAppIconClick(file:TaskBarFileInfo):void{
    // check if the give app is running
    // if it isn't running, then trigger it
    if(!this._runningProcessService.isProcessRunning(file.opensWith)){
      const tmpFile:FileInfo = new FileInfo();
      tmpFile.setOpensWith = file.opensWith;

      this._triggerProcessService.startApplication(tmpFile);

      setTimeout(() => {
        this.updateTaskBarFileInfoInPinnedTaskbarList(file);
      }, 10);


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
    const liElemnt = document.getElementById(`tskbar-${file.opensWith}`) as HTMLElement;
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

    const liElemnt = document.getElementById(`tskbar-UnPinned-${file.getOpensWith}`) as HTMLElement;
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
    const prefix = (caller === "pinned")? 'tskbar': 'tskbar-UnPinned';
    const rect = this.highlightTaskbarIconOnMouseHover(prefix, appName, pid);
    if(rect){
      console.log(`onMouseEnter -- rect:${rect}`);
      const data:unknown[] = [rect, appName, iconPath];
      if(this._runningProcessService.isProcessRunning(appName)){
        this._windowServices.showProcessPreviewWindowNotify.next(data);
      }
    }
  }

  onMouseLeave():void{
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this.highlightTaskbarIcon();
  }

  highlightTaskbarIconOnMouseHover(prefix:string, appName:string, pid:number): DOMRect | null{

    console.log(`highlightTaskbarIconOnMouseHover -- prefix:${prefix}, appName:${appName}, pid:${pid}`);

    //const proccess = this._runningProcessService.getProcess(pid);
    const proccessInFocus = this._runningProcessService.getProcess(this.windowInFocusPid);

    let liElemnt:HTMLElement;
    
    if(this.taskBarEntriesIconState === this.mergedIcons){
      liElemnt = document.getElementById(`${prefix}-${appName}`) as HTMLElement;
      if(liElemnt){
        if(proccessInFocus.getProcessName === appName){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 95%/20%)';
        }else{
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 40%/20%)';
        }

        return liElemnt?.getBoundingClientRect();
      }
    }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
      liElemnt = document.getElementById(`${prefix}-${appName}-${pid}`) as HTMLElement;
      if(liElemnt){
        if(proccessInFocus.getProcessId === pid){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 95%/20%)';
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
    const tskbar = 'tskbar';
    const tskbarUnPinned = 'tskbar-UnPinned';

    let liElemnt:HTMLElement;
  
    if(proccess){
      if(this.taskBarEntriesIconState === this.mergedIcons){
        liElemnt = document.getElementById(`${tskbar}-${proccess.getProcessName}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
        }else{
          liElemnt = document.getElementById(`${tskbarUnPinned}-${proccess.getProcessName}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          }
        }
      }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
        liElemnt = document.getElementById(`${tskbar}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
        }else{
          liElemnt = document.getElementById(`${tskbarUnPinned}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          }
        }
      }
    }
  }

  removeHighlightFromTaskbarIcon():void{
    const proccess = this._runningProcessService.getProcess(this.prevWindowInFocusPid);
    const tskbar = 'tskbar';
    const tskbarUnPinned = 'tskbar-UnPinned';

    let liElemnt:HTMLElement;
  
    if(proccess){
      if(this.taskBarEntriesIconState === this.mergedIcons){
        liElemnt = document.getElementById(`${tskbar}-${proccess.getProcessName}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = '';
        }else{
          liElemnt = document.getElementById(`${tskbarUnPinned}-${proccess.getProcessName}`) as HTMLElement;
          if(liElemnt){
            liElemnt.style.backgroundColor = '';
          }
        }
      }else if(this.taskBarEntriesIconState === this.unMergedIcons){ 
        liElemnt = document.getElementById(`${tskbar}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
        if(liElemnt){
          liElemnt.style.backgroundColor = '';
        }else{
          liElemnt = document.getElementById(`${tskbarUnPinned}-${proccess.getProcessName}-${proccess.getProcessId}`) as HTMLElement;
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
