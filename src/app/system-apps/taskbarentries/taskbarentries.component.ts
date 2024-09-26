import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

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
  private _consts:Constants = new Constants();

  private _processListChangeSub!: Subscription;
  private _addIconToTaskbarSub!: Subscription;
  private _removeIconFromTaskbarSub!: Subscription;
  private _openApplicationFromTaskbarSub!: Subscription;
  private _closeApplicationsFromTaskbarSub!: Subscription;

  private prevOpenedProccesses:string[]= [];
  SECONDS_DELAY = 100;
  runningProcess:Process[] = [];
  pinToTaskBarList:FileInfo[] = [];
  selectedFile!:FileInfo

  pinned = "pinned";
  unPinned = "unPinned";
  
  hasWindow = false;
  icon =  `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbarentry';
  processId = 0;
  type = ComponentType.System;
  displayName = '';
  appProcessId = 0;

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
              triggerProcessService:TriggerProcessService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;
    this._menuService = menuService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess()});
    this._addIconToTaskbarSub = this._menuService.pinToTaskBar.subscribe((p)=>{this.pinIconToTaskBarList(p)});
    this._removeIconFromTaskbarSub = this._menuService.unPinFromTaskBar.subscribe((p)=>{this.unPinIconFromTaskBarList(p)});
    this._openApplicationFromTaskbarSub = this._menuService.openApplicationFromTaskBar.subscribe((p)=>{this.openApplication(p)});
    this._closeApplicationsFromTaskbarSub = this._menuService.closeApplicationFromTaskBar.subscribe((p) =>{this.closeApplication(p)});
  }
  
  ngAfterViewInit(): void {
    //change detection is the better solution
    setTimeout(() => {
      this.runningProcess = this.filterProcesses();
    }, 1500);
  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
    this._addIconToTaskbarSub?.unsubscribe();
    this._removeIconFromTaskbarSub?.unsubscribe();
    this._openApplicationFromTaskbarSub?.unsubscribe();
    this._closeApplicationsFromTaskbarSub?.unsubscribe();
  }

  updateRunningProcess():void{
    this.runningProcess = this.filterProcesses();

    setTimeout(()=>{
      this.changeProcessStateIdentifier();
    },this.SECONDS_DELAY) 
  }

  pinIconToTaskBarList(file:FileInfo):void{
    if(!this.pinToTaskBarList.some(x => x.getOpensWith === file.getOpensWith))
        this.pinToTaskBarList.push(file);

    this.updateRunningProcess();
  }

  unPinIconFromTaskBarList(file:FileInfo):void{
    const deleteCount = 1;
    const procIndex = this.pinToTaskBarList.findIndex((pin) => {
        return pin.getOpensWith === file.getOpensWith;
      });

    if(procIndex != -1){
        this.pinToTaskBarList.splice(procIndex, deleteCount)
    }
    this.updateRunningProcess();
  }

  filterProcesses():Process[]{
    const uniqueProccesses = this.getUniqueProccess();
    const proccessesNotInPinToStart:Process[] = [];

    this.storeHistory(uniqueProccesses);
    /**
     * i have 2 lists of varying lengths
     * list one can have duplicates of the same object, but list 2 only has unique objects
     * compare both lists, if object.name from list1 equal to object.name from list 2
     * setIconToActive
     * else, put object in a different list
     */
    uniqueProccesses.forEach(x =>{
      if(this.pinToTaskBarList.some( i => i.getOpensWith === x.getProcessName)){
        this.appProcessId = x.getProcessId;
        this.setIconState(x.getProcessName,true);
      }else{
        proccessesNotInPinToStart.push(x);
      }
    });
  
    return proccessesNotInPinToStart;
  }

  getUniqueProccess():Process[]{
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

  storeHistory(arg:Process[]):void{
    arg.forEach(x =>{
      if(!this.prevOpenedProccesses.includes(x.getProcessName)){
        this.prevOpenedProccesses.push(x.getProcessName)
      }
    });
  }

  changeProcessStateIdentifier():void{
    const runningProcess = this.getUniqueProccess();
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
      liElemnt.style.borderBottomColor = 'transparent';
    }
  }

  onPinnedAppIconClick(file:FileInfo):void{
    // check if the give app is running
    // if it isn't running, then trigger it
    if(!this._runningProcessService.isProcessRunning(file.getOpensWith)){
      this._triggerProcessService.startApplication(file);
      return;
    }else{
      const process = this._runningProcessService.getProcesses().filter(x => x.getProcessName === file.getOpensWith);
      this._runningProcessService.restoreOrMinimizeProcessWindowNotify.next(process[0].getProcessId);
    }
  }

  openApplication(file:FileInfo):void{
    this._triggerProcessService.startApplication(file);
  }

  closeApplication(proccess:Process[]):void{
    for(let i = 0; i <= proccess.length - 1; i++){
      this._runningProcessService.closeProcessNotify.next(proccess[i]);
    }
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo):void{
    /* My hand was forced, I had to let the desktop display the taskbar context menu.
     * This is due to the fact that the taskbar has a max height of 40px, which is not enough room to display the context menu
     */
    const liElemnt = document.getElementById(`tskbar-${file.getOpensWith}`) as HTMLElement;
    const rect =  liElemnt.getBoundingClientRect();
    const isPinned = true;
    const data:unknown[] = [rect, file, isPinned];

    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

    this._menuService.showTaskBarMenu.next(data);

    evt.preventDefault();
  }

  onShowUnPinnedIconContextMenu(evt:MouseEvent, proccess:Process):void{

    const file = new FileInfo();
    file.setOpensWith = proccess.getProcessName;
    file.setIconPath = proccess.getIcon;

    const liElemnt = document.getElementById(`tskbar-UnPinned-${file.getOpensWith}`) as HTMLElement;
    const rect =  liElemnt.getBoundingClientRect();
    const isPinned = false;
    const data:unknown[] = [rect, file, isPinned];

    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

    this._menuService.showTaskBarMenu.next(data);

    evt.preventDefault();
  }

  onMouseEnter(appName:string, iconPath:string, caller:string):void{
    const prefix = (caller === "pinned")? 'tskbar': 'tskbar-UnPinned';
    const liElemnt = document.getElementById(`${prefix}-${appName}`) as HTMLElement;
    const rect =  liElemnt.getBoundingClientRect();
    const data:unknown[] = [rect, appName, iconPath];

    if(this._runningProcessService.isProcessRunning(appName))
      this._runningProcessService.showProcessPreviewWindowNotify.next(data);
  }

  onMouseLeave():void{
    this._runningProcessService.hideProcessPreviewWindowNotify.next();
  }

  restoreOrMinizeWindow(processId:number){
    this._runningProcessService.restoreOrMinimizeProcessWindowNotify.next(processId)
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
