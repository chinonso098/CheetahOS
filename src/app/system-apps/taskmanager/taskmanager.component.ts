/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit,OnDestroy, AfterViewInit, ViewChild, ElementRef, Renderer2, Input} from '@angular/core';
import { Subject, Subscription, interval, switchMap } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType, ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { SortingInterface } from './sorting.interface';
import { RefreshRates, RefreshRatesIntervals, TableColumns,DisplayViews, ResourceUtilization } from './taskmanager.enum';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import * as htmlToImage from 'html-to-image';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { Service } from 'src/app/system-files/service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { AppState } from 'src/app/system-files/state/state.interface';


@Component({
  selector: 'cos-taskmanager',
  templateUrl: './taskmanager.component.html',
  styleUrls: ['./taskmanager.component.css'],
  standalone:false,
})
export class TaskmanagerComponent implements BaseComponent,OnInit,OnDestroy,AfterViewInit {

  @ViewChild('tskManagerRootContainer') tskManagerRootContainer!: ElementRef; 
  @ViewChild('tskMgrTable') tskMgrTable!: ElementRef;  
  @ViewChild('tskmgrTblCntnr') tskmgrTblCntnr!: ElementRef;
  @ViewChild('tskmgrCardBody') tskmgrCardBody!: ElementRef; 
  @ViewChild('tskMgrTableHeaderCntnt') tskMgrTableHeaderCntnt!: ElementRef;  
  @ViewChild('tskMgrTableBodyCntnt') tskMgrTableBodyCntnt!: ElementRef;  
  @Input() priorUId = Constants.EMPTY_STRING;

  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _notificationService:UserNotificationService;
  private _windowService:WindowService;
  private _sessionManagmentService:SessionManagmentService;
  private _renderer: Renderer2;
  private _appState!:AppState;


  private _processListChangeSub!: Subscription;
  private _taskmgrRefreshIntervalSub!: Subscription;
  private _chnageTaskmgrRefreshIntervalSub!:Subject<number>;
  private _currentSortingOrder!:any;

  private _sorting:SortingInterface ={
    column: '',
    order: 'asc',
  }  

  private sleepNumber = 0;
  private sleepCounter = 0;
  private processNumberToSuspend = 0;
  private refreshRateInterval = 0;
  private processIdToClose = 0;

  statusColumnVisible = true;
  cpuColumnVisible = true;
  memoryColumnVisible = true;
  diskColumnVisible = true;
  networkColumnVisible = true;
  pidColumnVisible = false;
  gpuColumnVisible = true;
  powerColumnVisible = true;
  processNameColumnVisible = false;
  typeColumnVisible = false;

  cntxtMenuStyle:Record<string, unknown> = {};
  thStyle:Record<string,unknown> = {};
  thStyle1:Record<string,unknown> = {};
  thStyle2:Record<string,unknown> = {};
  thStyle3:Record<string,unknown> = {};
  thStyle4:Record<string,unknown> = {};
  isActive = false;
  isFocus = false;

  selectedRow = -1;
  showBtnNavMenu = false;

  detailedView = DisplayViews.DETAILED_VIEW;
  viewOptions = Constants.EMPTY_STRING;

  SECONDS_DELAY = 250;

  processes:Process[] =[];
  services:Service[] = [];
  closingNotAllowed:string[] = ["system", "desktop", "filemanager", "taskbar", "startbutton", "clock", "taskbarentry", "startmenu", "volume",
    "cmpnt_ref_svc", "file_mgr_svc", "file_svc", "menu_svc", "notification_svc", "pid_gen_svc", "rning_proc_svc", "scripts_svc",
    "session_mgmt_svc", "state_mgmt_svc","trgr_proc_svc", "window_mgmt_svc", "audio_svc"];
  groupedData: any = {};
  selectedRefreshRate = 0;

  cpuUtil = 0;
  memUtil = 0;
  diskUtil = 0;
  networkUtil = 0;
  gpuUtil = 0;
  powerUtil = 'Very low';

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}taskmanager.png`;
  isMaximizable=false;
  name = 'taskmanager';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Task Manager';


  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, sessionManagmentService:SessionManagmentService,
               notificationService:UserNotificationService, renderer: Renderer2 ,windowService:WindowService) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._notificationService = notificationService;
    this._windowService = windowService;
    this._sessionManagmentService = sessionManagmentService;
    this._renderer = renderer;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess();})
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow();})
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
    this._currentSortingOrder = this._sorting.order;

    this._chnageTaskmgrRefreshIntervalSub = new Subject<number>();

    this.refreshRateInterval = RefreshRatesIntervals.NOMRAL;
    this.selectedRefreshRate = RefreshRates.NORMAL;
    this.viewOptions = this.detailedView; 
  }


  ngOnInit(): void {
   this.processes = this._runningProcessService.getProcesses();
   this.services = this._runningProcessService.getServices();
   //this.groupTableBy(); -- work on table grouping...someday
  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
    this._taskmgrRefreshIntervalSub?.unsubscribe();
    this._chnageTaskmgrRefreshIntervalSub?.unsubscribe();
    this._maximizeWindowSub?.unsubscribe();
    
    this.sleepCounter = 0;
    this.processNumberToSuspend = 0;
    this.sleepNumber = 0;
  }

  ngAfterViewInit(): void {

    //this.setTaskMangrWindowToFocus(this.processId); 

    this.hideContextMenu();


    this.applyDefaultColumnVisibility();
    this.alignHeaderAndBodyWidth();
    this.synchronizeBodyCntntAndBodyCntnr();


    //Initial delay 1 seconds and interval countdown also 2 second
    this._taskmgrRefreshIntervalSub = interval(this.refreshRateInterval).subscribe(() => {
      this.generateLies();
      this.sortTable(this._sorting.column, false);
    });

    this._chnageTaskmgrRefreshIntervalSub.pipe(
      switchMap( newRefreshRate => {
        //un-sub from current interval
        this._taskmgrRefreshIntervalSub?.unsubscribe();   

        //start new interval with newrefreshrate 
        return interval(newRefreshRate);        
    })).subscribe(() => {
      this.generateLies();
      this.sortTable(this._sorting.column, false);
    });

    this.synchronizeBodyCntntAndBodyCntnr();
    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.tskManagerRootContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
    })
}


  isDescSorting(column: string): boolean {
    return this._sorting.column === column && this._sorting.order === 'desc';
  }

  isAscSorting(column: string): boolean {
    return this._sorting.column === column && this._sorting.order === 'asc';
  }

  setTaskMangrWindowToFocus(pid: number):void {
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
    this.hideContextMenu();
  }

  closeHeaderList():void{
    this.hideContextMenu();
  }

  updateRunningProcess():void{
    this.processes = this._runningProcessService.getProcesses();

    setTimeout(()=>{
      this.applyDefaultColumnVisibility();
    }, 10);
 
  }

  refreshRate(refreshRate:number):void{
    const refreshRatesIntervals:number[] = [RefreshRatesIntervals.PAUSED,RefreshRatesIntervals.LOW,
                                          RefreshRatesIntervals.NOMRAL,RefreshRatesIntervals.HIGH];

    if(refreshRate >= RefreshRates.PAUSED && refreshRate <= RefreshRates.HIGH){
      this.refreshRateInterval = refreshRatesIntervals[refreshRate];
      this.selectedRefreshRate =  refreshRate;
      this._chnageTaskmgrRefreshIntervalSub.next(this.refreshRateInterval);
    }
  }

  sortTable(column: string,  isSortTriggered:boolean): void {

    if(isSortTriggered){
      this._currentSortingOrder = this.isDescSorting(column) ? 'asc' : 'desc';
      this._sorting = {column, order: this._currentSortingOrder };
      this.thStyle = {
        'background-color': '#ffffff'
      }
      this.thStyle1 = {
        'background-color': '#ffffff'
      }
      this.thStyle2 = {
        'background-color': '#ffffff'
      }
      this.thStyle3 = {
        'background-color': '#ffffff'
      }
      this.thStyle4 = {
        'background-color': '#ffffff'
      }
    }
  
    if(column == TableColumns.CPU){
      if(this._currentSortingOrder == 'asc'){
          this.processes = this.processes.sort((objA, objB) => objB.getCpuUsage - objA.getCpuUsage);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getCpuUsage - objA.getCpuUsage).reverse();
      }
    }else if(column == TableColumns.GPU){
      if(this._currentSortingOrder == 'asc'){
          this.processes = this.processes.sort((objA, objB) => objB.getCpuUsage - objA.getCpuUsage);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getCpuUsage - objA.getCpuUsage).reverse();
      }
    } else if (column == TableColumns.MEMORY){
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => objB.getMemoryUsage - objA.getMemoryUsage);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getMemoryUsage - objA.getMemoryUsage).reverse();
      }
    }else if(column == TableColumns.DISK){
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => objB.getDiskUsage - objA.getDiskUsage);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getDiskUsage - objA.getDiskUsage).reverse();
      }
    }else if(column == TableColumns.NETWORK){
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => objB.getNetworkUsage - objA.getNetworkUsage);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getNetworkUsage - objA.getNetworkUsage).reverse();
      }
    }else if(column == TableColumns.PID){
      this.thStyle2 = {
        'background-color': '#d0ecfc'
      }
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => objB.getProcessId - objA.getProcessId);
      }else{
        this.processes = this.processes.sort((objA, objB) => objB.getProcessId - objA.getProcessId).reverse();
      }
    }else if(column == TableColumns.NAME){
      this.thStyle = {
        'background-color': '#d0ecfc'
      }
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getProcessName < objB.getProcessName ? -1 : 1;
        });
      }else{
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getProcessName < objB.getProcessName ? -1 : 1
        }).reverse();
      }
    }else if(column == TableColumns.PROCESS_NAME){
      this.thStyle3 = {
        'background-color': '#d0ecfc'
      }
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getProcessName < objB.getProcessName ? -1 : 1;
        });
      }else{
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getProcessName < objB.getProcessName ? -1 : 1
        }).reverse();
      }
    }else if(column == TableColumns.POWER_USAGE){
      this.thStyle4 = {
        'background-color': '#d0ecfc'
      }
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getPowerUsage < objB.getPowerUsage ? -1 : 1;
        });
      }else{
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getPowerUsage < objB.getPowerUsage ? -1 : 1
        }).reverse();
      }
    }else if(column == TableColumns.TYPE){
      this.thStyle1 = {
        'background-color': '#d0ecfc'
      }
      if(this._currentSortingOrder == 'asc'){
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getType < objB.getType ? -1 : 1;
        });
      }else{
        this.processes = this.processes.sort((objA, objB) => {
          return objA.getType < objB.getType ? -1 : 1
        }).reverse();
      }
    }
  }

  showContextMenu(evt:MouseEvent):void{
    const rect =  this.tskMgrTable.nativeElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

    this.cntxtMenuStyle = {
      'display': 'block', 
      'width': '180px', 
      'transform':`translate(${x}px, ${y - 65}px)`,
      'z-index': 2,
      'opacity': 1
    }

    evt.preventDefault();
  }

  hideContextMenu():void{
    this.cntxtMenuStyle = {
      'display': 'none', 
    }
  }

  hideShowNavMenu(menuName:string):void{
    let menuElmt:HTMLElement;
    this.showBtnNavMenu = !this.showBtnNavMenu;

    if(menuName == Constants.EMPTY_STRING){
      menuElmt =  document.getElementById(`tskmgr-nav-file-menu-${this.processId}`) as HTMLElement;
      if(menuElmt)
        menuElmt.style.display ='none';

      menuElmt =  document.getElementById(`tskmgr-nav-view-menu-${this.processId}`) as HTMLElement;
      if(menuElmt)
        menuElmt.style.display ='none';
    }
    else if(menuName != Constants.EMPTY_STRING){
      if(menuName == 'tskmgr-nav-file-menu' && this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-file-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='block';
        menuElmt.style.left = '2px';
        menuElmt.style.top = '20px';
      }
      else if(menuName == 'tskmgr-nav-file-menu' && !this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-file-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='none';
      }

      if(menuName == 'tskmgr-nav-view-menu' && this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-view-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='block';
        menuElmt.style.left = '85px';
        menuElmt.style.top = '20px';
      }
      else if(menuName == 'tskmgr-nav-view-menu' && !this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-view-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='none';
      }
    }
  }

  hideShowNavMenu1(menuName:string, evtName:string):void{
    let menuElmt:HTMLElement;
  
    if(evtName === 'enter'){
      if(menuName == 'tskmgr-nav-file-menu' && this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-file-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='block';
        menuElmt.style.left = '2px';
        menuElmt.style.top = '20px';

        menuElmt =  document.getElementById(`tskmgr-nav-view-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='none';
      }

      if(menuName == 'tskmgr-nav-view-menu' && this.showBtnNavMenu){
        menuElmt =  document.getElementById(`tskmgr-nav-view-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='block';
        menuElmt.style.left = '85px';
        menuElmt.style.top = '20px';

        menuElmt =  document.getElementById(`tskmgr-nav-file-menu-${this.processId}`) as HTMLElement;  
        menuElmt.style.display ='none';
      }
    }
  }

  showDefaultPane():void{
    const tskmgrProcessPane = document.getElementById('tskmgr-process-pane');
    const tskmgrProcessTab = document.getElementById('tskmgr-process-tab');

    if(tskmgrProcessTab && tskmgrProcessPane){

      tskmgrProcessTab.classList.add('active');
      tskmgrProcessPane.classList.add('active');
    }
  }

  showProcessesPane():void{
    const tskmgrProcessPane = document.getElementById('tskmgr-process-pane');
    const tskmgrProcessTab = document.getElementById('tskmgr-process-tab');
    const tskmgrServicePane = document.getElementById('tskmgr-service-pane');
    const tskmgrServiceTab = document.getElementById('tskmgr-service-tab');

    if(tskmgrProcessTab && tskmgrServiceTab){
      tskmgrProcessTab.classList.add('active');
      tskmgrServiceTab.classList.remove('active');
    }
    if(tskmgrProcessPane && tskmgrServicePane){
      tskmgrProcessPane.classList.add('active');
      tskmgrServicePane.classList.remove('active');
    }
  }

  showServicesPane():void{
    const tskmgrProcessPane = document.getElementById('tskmgr-process-pane');
    const tskmgrProcessTab = document.getElementById('tskmgr-process-tab');

    const tskmgrServicePane = document.getElementById('tskmgr-service-pane');
    const tskmgrServiceTab = document.getElementById('tskmgr-service-tab');

    if(tskmgrProcessTab && tskmgrServiceTab){
      tskmgrServiceTab.classList.add('active');
      tskmgrProcessTab.classList.remove('active');
    }

    if(tskmgrProcessPane && tskmgrServicePane){
      tskmgrServicePane.classList.add('active');
      tskmgrProcessPane.classList.remove('active');
    }
  }

  generateLies():void{
    const processes:Process[] = this._runningProcessService.getProcesses();
    const powerLevels:string[] = ['Very low','Low','Moderate','High','Very high'];

    const maxAppUtilNum = 30; // should be 100
    const minAppUtilNum = 0;

    const maxBkgrndProcUtilNum = 3;
    const minBkgrndProcUtilNum = 0;

    const maxCheetahProcUtilNum = 2;
    const minCheetahProcUtilNum = 0;
    const suspended = 'Suspended';

    const maxNum = 10;
    const minNum = 1;

    this.sleepNumber == 0 ? 
      this.sleepNumber = this.getRandomNums(minNum, (maxNum*maxNum)*2) :  this.sleepNumber;

    this.processNumberToSuspend == 0 ? this.processNumberToSuspend =
      processes[this.getRandomNums(0,processes.length-1)].getProcessId : this.processNumberToSuspend;

    for(let i =0; i < processes.length; i++){

      const currProcess = processes[i];
      currProcess.setProcessStatus = Constants.EMPTY_STRING;
      currProcess.setPowerUsage = powerLevels[0];

      //background proc
      if(currProcess.getType === ProcessType.Background){

        if(this.getRandomNums(minNum,maxNum) > 5){
          currProcess.setCpuUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minBkgrndProcUtilNum, maxBkgrndProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) <= 1){
          currProcess.setDiskUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minBkgrndProcUtilNum, maxBkgrndProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) > 7){
          currProcess.setMemoryUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minBkgrndProcUtilNum, maxBkgrndProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) <= 2){
          currProcess.setNetworkUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minBkgrndProcUtilNum, maxBkgrndProcUtilNum));
        } 
        if(this.getRandomNums(minNum,maxNum) <= 1){
          currProcess.setGpuUsage =  0; 
        } 
        if(this.getRandomNums(minNum,maxNum) <= 9){
          currProcess.setPowerUsage = powerLevels[this.getRandomNums(0,1)];
        } 

      }else if(currProcess.getType === ProcessType.Cheetah){
        if(this.getRandomNums(minNum,maxNum) > 5){
          currProcess.setCpuUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minCheetahProcUtilNum, maxCheetahProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) <= 1){
          currProcess.setDiskUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minCheetahProcUtilNum, maxCheetahProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) > 7){
          currProcess.setMemoryUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minCheetahProcUtilNum, maxCheetahProcUtilNum));
        }
        if(this.getRandomNums(minNum,maxNum) <= 2){
          currProcess.setNetworkUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minCheetahProcUtilNum, maxCheetahProcUtilNum));
        } 
        if(this.getRandomNums(minNum,maxNum) >= 1){
          currProcess.setGpuUsage = 0;
        } 
        if(this.getRandomNums(minNum,maxNum) <= 9){
          currProcess.setPowerUsage = powerLevels[this.getRandomNumsBiased(0,1)];
        } 
      }else{
        if(currProcess.getProcessId == this.processNumberToSuspend){

          if(this.sleepCounter <= this.sleepNumber){
  
            currProcess.setProcessStatus = suspended;
            currProcess.setCpuUsage = 0;
            currProcess.setDiskUsage = 0;
            currProcess.setMemoryUsage = 0;
            currProcess.setNetworkUsage = 0;
            currProcess.setGpuUsage = 0;
            currProcess.setPowerUsage  = powerLevels[0];
  
            this.sleepCounter++;
          }else{
            this.sleepCounter = 0;
            this.processNumberToSuspend = 0;
            this.sleepNumber = 0;
            currProcess.setProcessStatus = '';
            currProcess.setPowerUsage = powerLevels[0];
          }
        }else{

          if(this.getRandomNums(minNum,maxNum) > 5 ){
            currProcess.setCpuUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minAppUtilNum, maxAppUtilNum));
          }
          if(this.getRandomNums(minNum,maxNum) <= 1){
            currProcess.setDiskUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minAppUtilNum, maxAppUtilNum));
          }
          if(this.getRandomNums(minNum,maxNum) > 7){
            currProcess.setMemoryUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minAppUtilNum, maxAppUtilNum));
          }
          if(this.getRandomNums(minNum,maxNum) <= 2){
            currProcess.setNetworkUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minAppUtilNum, maxAppUtilNum));
          } 
          if(this.getRandomNums(minNum,maxNum) <= 1){
            currProcess.setGpuUsage = this.addTrailingZeros(this.getRandomFloatingNumsBiased(minAppUtilNum, maxAppUtilNum));
          } 
          if(this.getRandomNums(minNum,maxNum) <= 9){
            currProcess.setPowerUsage = powerLevels[this.getRandomNumsBiased(0,4)];
          } 

        }
      }
    }
    this.processes = processes;
    this.sumRowValues(processes);
  }

  getRandomFloatingNumsBiased(min: number, max: number): number {
    const rand = Math.random(); // Generates a number between 0 and 1

    // Bias: Squaring the random value skews results toward lower numbers
    // Can use Math.pow(rand, 8) for even stronger bias
    const biasedRand = Math.pow(rand, 7); 

    // Scale to the desired range
    const num = min + biasedRand * (max - min);
    return Math.round(num * 10) / 10; // Rounding to one decimal place
 }

  getRandomFloatingNums(min:number, max:number):number{
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
  }

  getRandomNums(min:number, max:number) {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

  getRandomNumsBiased(min:number, max:number) {
    const rand = Math.random(); // Generates a number between 0 and 1

    // Bias: Squaring the random value skews results toward lower numbers
    // Can use Math.pow(rand, 8) for even stronger bias
    const biasedRand = Math.pow(rand, 7); 

    // Scale to the desired range
    const num = min + biasedRand * (max - min);
    return Math.floor(Math.round(num * 10) / 10); // Rounding to one decimal place
  }

  addTrailingZeros(num:number):number {
    const totalLength = 3;
    const strNum = String(num);
    if(num != 0){
      if(strNum.length == 1)
      return parseFloat(strNum.padEnd(totalLength, '.1'));
    }
    return num;
  }

  sumRowValues(processes: Process[]): void {
    const clamp = (value: number) => Math.min(99, Math.round(value));
  
    this.cpuUtil = clamp(processes.reduce((n, { getCpuUsage }) => n + getCpuUsage, 0));
    this.memUtil = clamp(processes.reduce((n, { getMemoryUsage }) => n + getMemoryUsage, 0));
    this.diskUtil = clamp(processes.reduce((n, { getDiskUsage }) => n + getDiskUsage, 0));
    this.networkUtil = clamp(processes.reduce((n, { getNetworkUsage }) => n + getNetworkUsage, 0));
    this.gpuUtil = clamp(processes.reduce((n, { getGpuUsage }) => n + getGpuUsage, 0));
  }


  groupTableBy() {
    const groupedData:Record<string, Process[]> = {};
    for (const process of this.processes) {
    
        if(process.getType == ComponentType.System){

          if(!groupedData[ComponentType.System]){
            groupedData[ComponentType.System] = []
          }
          groupedData[ComponentType.System].push(process)
        }else if(process.getType == ComponentType.User){
          if(!groupedData[ComponentType.User]){
            groupedData[ComponentType.User] = []
          }
          groupedData[ComponentType.User].push(process)
        }
    }
    return groupedData;
  }

  onFewerDetailsBtnClick():void{
    this.viewOptions = DisplayViews.MINI_VIEW;
  }

  onMoreDetailsBtnClick():void{
    this.viewOptions = DisplayViews.DETAILED_VIEW;
  }

  onExitBtnClick():void{
    this.processIdToClose = this.processId;
    this.onEndTaskBtnClick();
  }

  onEndTaskBtnClick():void{
    const processToClose = this._runningProcessService.getProcess(this.processIdToClose);
    if(!this.closingNotAllowed.includes(processToClose.getProcessName)){
      this._runningProcessService.closeProcessNotify.next(processToClose);
    }else{
      //alert(`The app: ${processToClose.getProcessName} is not allowed to be closed`)
      const msg = `The proc:${processToClose.getProcessName} is not allowed to be closed`;
      this._notificationService.showInfoNotification(msg);
    }
  }

  onProcessSelected(rowIndex:number, processId:number):void{
    this.selectedRow = rowIndex;
    this.processIdToClose = processId;
    
    if(this.selectedRow != -1){
      this.isActive = true;
      this.isFocus = true;
    }
  }

  toggleColumnVisibility(column: string) {
    if (column === TableColumns.TYPE) {
      this.typeColumnVisible = !this.typeColumnVisible;
    }else if (column === TableColumns.STATUS) {
      this.statusColumnVisible = !this.statusColumnVisible;
    }else if (column === TableColumns.PID) {
      this.pidColumnVisible = !this.pidColumnVisible;
    }else if (column === TableColumns.PROCESS_NAME) {
      this.processNameColumnVisible = !this.processNameColumnVisible;
    }else if (column === TableColumns.CPU) {
      this.cpuColumnVisible = !this.cpuColumnVisible;
    }else if (column === TableColumns.MEMORY) {
      this.memoryColumnVisible = !this.memoryColumnVisible;
    } else if (column === TableColumns.DISK) {
      this.diskColumnVisible = !this.diskColumnVisible;
    }else if (column === TableColumns.NETWORK) {
      this.networkColumnVisible = !this.networkColumnVisible;
    }else if (column === TableColumns.GPU) {
      this.gpuColumnVisible = !this.gpuColumnVisible;
    }else if (column === TableColumns.POWER_USAGE) {
      this.powerColumnVisible = !this.powerColumnVisible;
    }
 
    this.applyColumnHeaderVisibility(column);
    this.applyColumnBodyVisibility(column);
  }

  applyDefaultColumnVisibility():void{
    const tableColumns: string[] = [TableColumns.NAME,TableColumns.TYPE,TableColumns.STATUS,TableColumns.PID,TableColumns.PROCESS_NAME,
      TableColumns.CPU,TableColumns.MEMORY,TableColumns.DISK,TableColumns.NETWORK,TableColumns.GPU,TableColumns.POWER_USAGE];

      for(let i = 0; i < tableColumns.length; i++){
        this.applyColumnHeaderVisibility(tableColumns[i]);
        this.applyColumnBodyVisibility(tableColumns[i]);
      }
  }


  applyColumnHeaderVisibility(column: string) {
    const tableHeader = this.tskMgrTableHeaderCntnt.nativeElement;
    const tableColumns: string[] = [TableColumns.NAME,TableColumns.TYPE,TableColumns.STATUS,TableColumns.PID,TableColumns.PROCESS_NAME,
      TableColumns.CPU,TableColumns.MEMORY,TableColumns.DISK,TableColumns.NETWORK,TableColumns.GPU,TableColumns.POWER_USAGE];

    const rowNum = 0;
    const colNum = tableColumns.indexOf(column);

    if(column === TableColumns.TYPE){
      this.typeColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.STATUS){
      this.statusColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.PID){
      this.pidColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.PROCESS_NAME){
      this.processNameColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.CPU){
      this.cpuColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.MEMORY){
      this.memoryColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.DISK){
      this.diskColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.NETWORK){
      this.networkColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.GPU){
      this.gpuColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }

    if(column === TableColumns.POWER_USAGE){
      this.powerColumnVisible
      ? this._renderer.removeStyle(tableHeader.rows[rowNum].cells[colNum], 'display')
      : this._renderer.setStyle(tableHeader.rows[rowNum].cells[colNum], 'display', 'none');
    }
  }

  applyColumnBodyVisibility(column: string) {
    const tableBody = this.tskMgrTableBodyCntnt.nativeElement;

    const tableColumns: string[] = [TableColumns.NAME,TableColumns.TYPE,TableColumns.STATUS,TableColumns.PID,TableColumns.PROCESS_NAME,
                                    TableColumns.CPU,TableColumns.MEMORY,TableColumns.DISK,TableColumns.NETWORK,TableColumns.GPU,TableColumns.POWER_USAGE];
    
    const colNum = tableColumns.indexOf(column);

    for( let i = 0; i < this.processes.length; i++){

      if(column === TableColumns.TYPE){
        this.typeColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.STATUS){
        this.statusColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.PID){
        this.pidColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.PROCESS_NAME){
        this.processNameColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.CPU){
        this.cpuColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.MEMORY){
        this.memoryColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.DISK){
        this.diskColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.NETWORK){
        this.networkColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.GPU){
        this.gpuColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }

      if(column === TableColumns.POWER_USAGE){
        this.powerColumnVisible
        ? this._renderer.removeStyle(tableBody.rows[i].cells[colNum], 'display')
        : this._renderer.setStyle(tableBody.rows[i].cells[colNum], 'display', 'none');
      }
    }

    /**
     * due to order of operations, the header will be visible first, but it will default to the set width of 81px
     * Depending on the column, this width might not suffice, and would lead to a mis-aligment betwen column header and
     * column body
     */
    this.alignHeaderAndBodyWidth(colNum);
  }

  alignHeaderAndBodyWidth(hColIdx?:number) {
    const tableHeader = this.tskMgrTableHeaderCntnt.nativeElement;
    const tableBody = this.tskMgrTableBodyCntnt.nativeElement;

    // console.log('table - bodyRow.r0:', tableBody.rows[0] );
    // console.log('table - bodyRow.r0.c1:', tableBody.rows[0].cells[0]);
    // console.log('table - bodyRow.r0.c1 width:', tableBody.rows[0].cells[0].offsetWidth);
    // console.log('table - bodyRow.r0.c1 width:', tableBody.rows[0].cells[0].getBoundingClientRect().width);

    const hRow = 0;
    let hCol = 0;

    hCol = (hColIdx === undefined)? hCol: hColIdx;
    const cellWidth = tableBody.rows[hRow].cells[hCol].getBoundingClientRect().width;
    this._renderer.setStyle(tableHeader.rows[hRow].cells[hCol], 'min-width', cellWidth + 'px');
    this._renderer.setStyle(tableHeader.rows[hRow].cells[hCol], 'width', cellWidth + 'px');
  }

  updateTableFieldSize(data:string[]) {
    const tdId = data[0];
    for(let i =0; i <= this.processes.length; i++){    
      if(tdId === 'th-0') {
        const procName =  document.getElementById(`procName-${i}`) as HTMLElement;
        if(procName){
          const px_offSet = 44;
          procName.style.width = `${Number(data[1]) - px_offSet}px`;
        }
      }else if(tdId === 'th-1'){
        const procType =  document.getElementById(`procType-${i}`) as HTMLElement;
        if(procType){
          const px_offSet = 10;
          procType.style.width =`${Number(data[1]) - px_offSet}px`;
        }
      }
    }
  }

  synchronizeBodyCntntAndBodyCntnr() {
     /**
     * on first load there is a mis-match between the body cntnr
     * and the body content, causing a clipping of a portion of the table
     */
    const tskmgrCardBody = this.tskmgrCardBody.nativeElement;
    const tbodyWidth = tskmgrCardBody.getBoundingClientRect().width;
    this.tskmgrTblCntnr.nativeElement.style.width = `${tbodyWidth}px`;

    //console.log('synchronizeCntnrs from tskmgrCardBody tbodyWidth:', tbodyWidth);
  }

  activeFocus(){
    return{ 
      'active': this.isActive ? 'active' : '',
      'focus': this.isFocus ? 'focus' : ''
    }
  }

  setUtilColoumnColors(cellValue:any){
    let  baseStyle: Record<string, unknown> = {};

    if(typeof cellValue == "number"){
      if(cellValue <= ResourceUtilization.LOW){
      return baseStyle = {
          'text-align':'right',
          'background-color': '#fff4c4'
        };
      }else if(cellValue > ResourceUtilization.LOW && cellValue <= ResourceUtilization.MEDIUM){
        return baseStyle = {
          'text-align':'right',
          'background-color': '#ffecac'
        };
      }else if(cellValue > ResourceUtilization.MEDIUM && cellValue <= ResourceUtilization.HIGH){
        return baseStyle = {
          'text-align':'right',
          'background-color': '#ffa41c'
        };
      }else if (cellValue > ResourceUtilization.HIGH){
        return baseStyle = {
          'text-align':'right',
          'background-color': '#fc6c30', 
        };
      }
    }else if(typeof cellValue =="string"){
      if(cellValue == 'Very low'){
        return baseStyle = {
            'background-color': '#fff4c4'
          };
        }else if(cellValue == 'Low'){
          return baseStyle = {
            'background-color': '#ffecac'
          };
        }else if(cellValue == 'Moderate'){
          return baseStyle = {
            'background-color': '#ffd464'
          };
        }else if(cellValue == 'High'){
          return baseStyle = {
            'background-color': '#ffa41c'
          };
        }else if (cellValue == 'Very high'){
          return baseStyle = {
            'background-color': '#fc6c30', 
          };
        }       
    }

    return {};
  }

  setThHeaderContainerColor(cellValue:number, cellName:string){

    const sortColoumn = this._sorting.column;
    const maxHighUtil = 100;
    const veryHighUtil = 90;
    const lowUtil = 10;

    if(cellName == sortColoumn){
      const divElmnt =  document.getElementById(`${cellName.toLowerCase()}Div-${this.processId}`) as HTMLDivElement;  
      const divElmnt1 =  document.getElementById(`${cellName.toLowerCase()}Div1-${this.processId}`) as HTMLDivElement; 
      const utilDivElmnt =  document.getElementById(`${cellName.toLowerCase()}UtilDiv-${this.processId}`) as HTMLDivElement; 

      if(cellValue < lowUtil){
        divElmnt.style.backgroundColor = '#d0ecfc';
        divElmnt1.style.backgroundColor = '#d0ecfc';
        utilDivElmnt.style.right = '-40%';
      }else if(cellValue >= lowUtil){
        divElmnt.style.backgroundColor = (cellValue >= veryHighUtil)?  '#fcc4ac' : '#d0ecfc';
        divElmnt1.style.backgroundColor = (cellValue >= veryHighUtil)?  '#fcc4ac' : '#d0ecfc';
        
        divElmnt.style.borderLeft = (cellValue >= veryHighUtil)? '#fcc4ac': '';
        divElmnt1.style.borderLeft = (cellValue >= veryHighUtil)? '#fcc4ac': '';
        divElmnt.style.borderRight = (cellValue >= veryHighUtil)? '#fcc4ac': '';
        divElmnt1.style.borderRight = (cellValue >= veryHighUtil)? '#fcc4ac': '';
        utilDivElmnt.style.right = (cellValue >= maxHighUtil)? '-5%': '-20%';
      }
    } 
    else{
      const divElmnt =  document.getElementById(`${cellName.toLowerCase()}Div-${this.processId}`) as HTMLDivElement;  
      const divElmnt1 =  document.getElementById(`${cellName.toLowerCase()}Div1-${this.processId}`) as HTMLDivElement;  
      const utilDivElmnt =  document.getElementById(`${cellName.toLowerCase()}UtilDiv-${this.processId}`) as HTMLDivElement; 

      if(divElmnt && divElmnt1 && utilDivElmnt){      
        if(cellValue < lowUtil){
          utilDivElmnt.style.right = '-40%';
        }else if(cellValue >= lowUtil){
          divElmnt.style.backgroundColor = (cellValue >= veryHighUtil)?  '#fcc4ac' : '#ffffff';
          divElmnt1.style.backgroundColor = (cellValue >= veryHighUtil)?  '#fcc4ac' : '#ffffff';
          
          divElmnt.style.borderLeft = (cellValue >= veryHighUtil)? '#fcc4ac': '';
          divElmnt1.style.borderLeft = (cellValue >= veryHighUtil)? '#fcc4ac': '';
          divElmnt.style.borderRight = (cellValue >= veryHighUtil)? '#fcc4ac': '';
          divElmnt1.style.borderRight = (cellValue >= veryHighUtil)? '#fcc4ac': '';
          utilDivElmnt.style.right = (cellValue >= maxHighUtil)? '-5%': '-20%';
        }
      }
    }
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta'); 
      //const tskmgrCardBody = this.tskmgrCardBody.nativeElement;
      //const tbodyWidth = tskmgrCardBody.getBoundingClientRect().width;
      // console.log('mainWindow?.offsetHeight:',mainWindow?.offsetHeight);
      // console.log('mainWindow?.offsetWidth:',mainWindow?.offsetWidth);
      // console.log('maximizeWindow from tskmgrCardBody tbodyWidth:', tbodyWidth);
  
      /*
      -45 (tskmgr footer)
      -30 (window title and button tab)
      -20 (taskmgr nav buttons)
      -3  (span)
      -19 (tskmgr tabs)
      -2 (empty div )
      -1 (body border solid px)
      -40 (windows taskbar)
      */
      const pixelToSubtract = 45 + 30 + 20 + 3 + 19 + 2 + 1 + 40;
      this.tskmgrTblCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelToSubtract}px`;
      this.tskmgrTblCntnr.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;


      //when next you decide to focus on the Window min/max, use the chrome dev mode to see whhich containers 
      // do not return to their original size on minimize. The minimize functionality for the taskmanger, is 95% there 
    }
  }

  minimizeWindow(arg:number[]):void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      console.log('Set windows backto this:', arg);

      this.tskmgrTblCntnr.nativeElement.style.width = `${arg[0]}px`;
      
      // this.tskmgrTblCntnr.nativeElement.style.width = `${arg[0]}px`;
      // this.tskmgrTblCntnr.nativeElement.style.height = `${arg[1]}px`;
    }
  }

  storeAppState(app_data:unknown):void{
    //store refresh state, sort state, and view state
    const uid = `${this.name}-${this.processId}`;
    this._appState = {
      pid: this.processId,
      app_data: app_data,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }


  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
    
      //retrieve refresh state, sort state, and view state
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
