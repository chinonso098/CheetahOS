/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit,OnDestroy, AfterViewInit, ViewChild, ElementRef, Renderer2, Input, HostBinding} from '@angular/core';
import { Subject, Subscription, interval, switchMap } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType, ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { SortingInterface } from './sorting.interface';
import { RefreshRates, RefreshRatesIntervals, TableColumns,DisplayViews, ResourceUtilization } from './taskmanager.enum';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { CheckableMenu } from 'src/app/shared/system-ui-components/menu/menu.types';
import { WindowResizeInfo } from 'src/app/shared/system-ui-components/window/windows.types';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { InformationUpdate } from 'src/app/system-files/commons/common.interfaces';
import { Constants } from 'src/app/system-files/constants';
import { Service } from 'src/app/system-files/service';
import { AppState } from 'src/app/system-files/state/state.interface';
import { DialogMessage } from 'src/app/shared/system-ui-components/dialog/dialog.types';



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
  private _windowResizeSub!: Subscription;
  private _themeChangeSub!: Subscription;

  @HostBinding('class.theme-light') isLightTheme = false;

  /* Floors used to gate the resize handler so we don't react to
     transient sub-min sizes from drag-resize. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _notificationService!:UserNotificationService;
  private _windowService!:WindowService;
  private _sessionManagementService!:SessionManagementService;
  private _systemNotificationService!:SystemNotificationService;
  private _renderer: Renderer2;
  private _themeService!:ThemeService;
  private _appState!:AppState;


  private _processListChangeSub!: Subscription;
  private _taskmgrRefreshIntervalSub!: Subscription;
  /** Emits a new polling interval (ms) whenever the user changes the refresh rate. */
  private _changeRefreshRateSubject!:Subject<number>;
  /** Subscription to the refresh-rate-change pipeline; tracked so it can be torn down. */
  private _refreshRateSwitchSub!: Subscription;
  private _currentSortingOrder:'asc' | 'desc' = 'asc';

  private _sorting:SortingInterface ={
    column: '',
    order: 'asc',
  }

  /**
   * The physical left-to-right order of the table columns. Both the header
   * row and every body row follow this order, so the array index doubles as
   * the cell index when we show/hide a column.
   */
  private readonly _columnOrder:string[] = [
    TableColumns.NAME, TableColumns.TYPE, TableColumns.STATUS, TableColumns.PID,
    TableColumns.PROCESS_NAME, TableColumns.CPU, TableColumns.MEMORY,
    TableColumns.DISK, TableColumns.NETWORK, TableColumns.GPU, TableColumns.POWER_USAGE,
  ];

  /**
   * Ascending comparators keyed by column. `sortTable` multiplies the result
   * by -1 to get descending order, so each comparator only needs to define
   * the "smallest first" direction. Numeric columns subtract; text columns
   * use localeCompare (which correctly returns 0 for equal values, keeping
   * the sort stable).
   */
  private readonly _ascendingComparators:Record<string, (a:Process, b:Process) => number> = {
    [TableColumns.CPU]:          (a, b) => a.getCpuUsage - b.getCpuUsage,
    [TableColumns.GPU]:          (a, b) => a.getGpuUsage - b.getGpuUsage,
    [TableColumns.MEMORY]:       (a, b) => a.getMemoryUsage - b.getMemoryUsage,
    [TableColumns.DISK]:         (a, b) => a.getDiskUsage - b.getDiskUsage,
    [TableColumns.NETWORK]:      (a, b) => a.getNetworkUsage - b.getNetworkUsage,
    [TableColumns.PID]:          (a, b) => a.getProcessId - b.getProcessId,
    [TableColumns.NAME]:         (a, b) => a.getProcessName.localeCompare(b.getProcessName),
    [TableColumns.PROCESS_NAME]: (a, b) => a.getProcessName.localeCompare(b.getProcessName),
    [TableColumns.POWER_USAGE]:  (a, b) => a.getPowerUsage.localeCompare(b.getPowerUsage),
    [TableColumns.TYPE]:         (a, b) => a.getType.localeCompare(b.getType),
  };

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

  /** Discriminator that tells <cos-menu> to render the checkable variant. */
  checkableMenuOption = Constants.CHECKABLE_MENU_OPTION;

  /**
   * Backing data for the column show/hide context menu. Built once in
   * ngOnInit; each item's `checked` flag is kept in sync by
   * toggleColumnVisibility so the menu reflects the live column state.
   */
  columnMenuItems: CheckableMenu[] = [];

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
  closingNotAllowed:string[] = ["system", "desktop", "filemanager", "taskbar", "startbutton", "clock", "taskbarentry", "startmenu", "volume", "search",
    "cmpnt_ref_svc", "file_mgr_svc", "file_svc", "menu_svc", "notification_svc", "pid_gen_svc", "rning_proc_svc", "scripts_svc",
    "session_mgmt_svc", "state_mgmt_svc","trgr_proc_svc", "window_mgmt_svc", "audio_svc", "activity_tracking_svc", "file_indexing_svc"];
  groupedData:Record<string, Process[]> = {};
  selectedRefreshRate = 0;

  cpuUtil = 0;
  memUtil = 0;
  diskUtil = 0;
  networkUtil = 0;
  gpuUtil = 0;
  powerUtil = 'Very low';

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}taskmanager.png`;
  isMaximizable=true;
  readonly name = 'taskmanager';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Task Manager';


  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, sessionManagementService:SessionManagementService,
               notificationService:UserNotificationService, renderer: Renderer2 ,windowService:WindowService,
               systemNotificationService:SystemNotificationService, themeService:ThemeService) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._notificationService = notificationService;
    this._windowService = windowService;
    this._sessionManagementService = sessionManagementService;
    this._systemNotificationService = systemNotificationService;
    this._renderer = renderer;
    this._themeService = themeService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess();})

    // this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow();})
    // this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})

    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
    this._currentSortingOrder = this._sorting.order;

    this._changeRefreshRateSubject = new Subject<number>();

    this.refreshRateInterval = RefreshRatesIntervals.NORMAL;
    this.selectedRefreshRate = RefreshRates.NORMAL;
    this.viewOptions = this.detailedView; 
  }


  ngOnInit(): void {
   this.processes = this._runningProcessService.getProcesses();
   this.services = this._runningProcessService.getServices();
   this.buildColumnMenuItems();
   //this.groupTableBy(); -- work on table grouping...someday

   this.isLightTheme = this._themeService.isLightTheme();
   this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
     this.isLightTheme = this._themeService.isLightTheme();
   });
  }

  /**
   * Builds the checkable items shown in the column show/hide context menu.
   * The order matches the right-click menu in Windows Task Manager (Name is
   * always shown, so it is intentionally omitted). Each item's action flips
   * the matching column's visibility.
   */
  private buildColumnMenuItems():void{
    const toggleableColumns:string[] = [
      TableColumns.TYPE, TableColumns.STATUS, TableColumns.PID, TableColumns.PROCESS_NAME,
      TableColumns.CPU, TableColumns.MEMORY, TableColumns.DISK, TableColumns.NETWORK,
      TableColumns.GPU, TableColumns.POWER_USAGE,
    ];

    this.columnMenuItems = toggleableColumns.map(column => ({
      label: column,
      checked: this.isColumnVisible(column),
      action: () => this.toggleColumnVisibility(column),
    }));
  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
    this._taskmgrRefreshIntervalSub?.unsubscribe();
    this._refreshRateSwitchSub?.unsubscribe();
    this._changeRefreshRateSubject?.unsubscribe();
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    this._themeChangeSub?.unsubscribe();
    
    
    this.sleepCounter = 0;
    this.processNumberToSuspend = 0;
    this.sleepNumber = 0;
  }

  async ngAfterViewInit(): Promise<void> {

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

    // When the user changes the refresh rate, switchMap tears down the old
    // interval and starts a fresh one. The resulting subscription is stored
    // in `_refreshRateSwitchSub` so ngOnDestroy can clean it up (previously
    // it was discarded, leaking a timer that kept firing after close).
    this._refreshRateSwitchSub = this._changeRefreshRateSubject.pipe(
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
    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();
  }

  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.tskManagerRootContainer, this.processId, this.name, this.icon, this._windowService);
  }

  isDescSorting(column: string): boolean {
    return this._sorting.column === column && this._sorting.order === 'desc';
  }

  isAscSorting(column: string): boolean {
    return this._sorting.column === column && this._sorting.order === 'asc';
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    // Any left-click inside the Task Manager (empty space, a row, a tab, etc.)
    // dismisses the column context menu. This runs before the focus check
    // below so an already-focused window still closes the menu.
    this.hideContextMenu();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
    this.hideContextMenu();
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the Task Manager (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. The desktop's menu is opened by a (contextmenu) handler on the
    // desktop root, which receives this event as it bubbles up the DOM.
    // Stopping propagation here means the event never reaches the desktop,
    // so its menu never opens — no shared service flag required.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  closeHeaderList():void{
    this.hideContextMenu();
  }

  updateRunningProcess():void{
    this.processes = this._runningProcessService.getProcesses();

    setTimeout(()=>{ this.applyDefaultColumnVisibility();}, 10);
  }

  refreshRate(refreshRate:number):void{
    const refreshRatesIntervals:number[] = [RefreshRatesIntervals.PAUSED,RefreshRatesIntervals.LOW,
                                          RefreshRatesIntervals.NORMAL,RefreshRatesIntervals.HIGH];

    if(refreshRate >= RefreshRates.PAUSED && refreshRate <= RefreshRates.HIGH){
      this.refreshRateInterval = refreshRatesIntervals[refreshRate];
      this.selectedRefreshRate =  refreshRate;
      this._changeRefreshRateSubject.next(this.refreshRateInterval);
    }
  }

  sortTable(column: string,  isSortTriggered:boolean): void {

    // A direct click on a header toggles the direction and (for the basic,
    // non-numeric columns) repaints the header highlight. The periodic
    // refresh also calls this method with isSortTriggered === false to keep
    // the rows ordered as the (fake) usage numbers change.
    if(isSortTriggered){
      this._currentSortingOrder = this.isDescSorting(column) ? 'asc' : 'desc';
      this._sorting = {column, order: this._currentSortingOrder };
      this.resetBasicHeaderHighlights();
    }

    this.applySort(column);
  }

  /**
   * Reorders `this.processes` by the given column. Numeric columns sort
   * numerically, text columns alphabetically; the active direction
   * (asc/desc) is applied by flipping the comparator's sign. Unknown or
   * empty columns (e.g. the initial state before any sort) are ignored.
   */
  private applySort(column: string): void {
    const ascendingComparator = this._ascendingComparators[column];
    if(!ascendingComparator) return;

    // Keep the highlight on the active basic column. (Numeric columns are
    // highlighted separately through setThHeaderContainerColor in the
    // template, so they intentionally have no entry here.)
    this.highlightSortedBasicHeader(column);

    const directionMultiplier = this._currentSortingOrder === 'asc' ? 1 : -1;
    this.processes = [...this.processes].sort((a, b) => directionMultiplier * ascendingComparator(a, b));
  }

  /** Clears the highlight on every basic (text) column header. */
  private resetBasicHeaderHighlights(): void {
    const whiteBackground = { 'background-color': 'var(--tm-bg)' };
    this.thStyle  = { ...whiteBackground };
    this.thStyle1 = { ...whiteBackground };
    this.thStyle2 = { ...whiteBackground };
    this.thStyle3 = { ...whiteBackground };
    this.thStyle4 = { ...whiteBackground };
  }

  /** Highlights the header of the basic (text) column that is currently sorted. */
  private highlightSortedBasicHeader(column: string): void {
    const highlight = { 'background-color': 'var(--tm-th-heat)' };
    switch(column){
      case TableColumns.NAME:         this.thStyle  = highlight; break;
      case TableColumns.TYPE:         this.thStyle1 = highlight; break;
      case TableColumns.PID:          this.thStyle2 = highlight; break;
      case TableColumns.PROCESS_NAME: this.thStyle3 = highlight; break;
      case TableColumns.POWER_USAGE:  this.thStyle4 = highlight; break;
    }
  }

  showContextMenu(evt:MouseEvent):void{
    const rect =  this.tskMgrTable.nativeElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    this.cntxtMenuStyle = {
      'display': 'block', 
      'position': 'absolute',
      'width': '180px', 
      'transform':`translate(${x}px, ${y - 65}px)`,
      'z-index': 2,
      'opacity': 1
    }

    // Open our own column menu and stop here: preventDefault() kills the
    // native browser menu and stopPropagation() keeps the event from
    // bubbling to the desktop root, so the desktop context menu stays shut.
    // (Replaces the old addEventOriginator side-channel coordination.)
    evt.preventDefault();
    evt.stopPropagation();
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
    else if(menuName !== Constants.EMPTY_STRING){
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
    // IDs are suffixed with the process id so multiple task-manager
    // instances never resolve to each other's tabs/panes.
    const tskmgrProcessPane = document.getElementById(`tskmgr-process-pane-${this.processId}`);
    const tskmgrProcessTab = document.getElementById(`tskmgr-process-tab-${this.processId}`);

    if(tskmgrProcessTab && tskmgrProcessPane){

      tskmgrProcessTab.classList.add('active');
      tskmgrProcessPane.classList.add('active');
    }
  }

  showProcessesPane():void{
    const tskmgrProcessPane = document.getElementById(`tskmgr-process-pane-${this.processId}`);
    const tskmgrProcessTab = document.getElementById(`tskmgr-process-tab-${this.processId}`);
    const tskmgrServicePane = document.getElementById(`tskmgr-service-pane-${this.processId}`);
    const tskmgrServiceTab = document.getElementById(`tskmgr-service-tab-${this.processId}`);

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
    const tskmgrProcessPane = document.getElementById(`tskmgr-process-pane-${this.processId}`);
    const tskmgrProcessTab = document.getElementById(`tskmgr-process-tab-${this.processId}`);

    const tskmgrServicePane = document.getElementById(`tskmgr-service-pane-${this.processId}`);
    const tskmgrServiceTab = document.getElementById(`tskmgr-service-tab-${this.processId}`);

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
    if(num !== 0){
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

    const update:InformationUpdate = {
      pId:this.processId, 
      appName:this.name, 
      info:[`cpu:${this.cpuUtil}`, `memory:${this.memUtil}`, `disk:${this.diskUtil}`, `gpu:${this.gpuUtil}`]
    }

    this._systemNotificationService.updateInformationNotify.next(update);
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

  onEndTaskBtnClick(evt?:MouseEvent):void{
    evt?.stopPropagation();

    const processToClose = this._runningProcessService.getProcess(this.processIdToClose);
    if(!this.closingNotAllowed.includes(processToClose.getProcessName)){
      this._runningProcessService.closeProcessNotify.next(processToClose);
    }else{
      const uId = `${this.name}-${this.processId}`;
      const msg = DialogMessage.TASKMANAGER_TERMINATE_PROCESS_NOT_ALLOWED.replace(DialogMessage.placeholder, processToClose.getProcessName);
      this._notificationService.showInfoNotification(msg, uId);
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

    // Keep the menu's checkmark in step with the column's new visibility.
    const menuItem = this.columnMenuItems.find(item => item.label === column);
    if(menuItem){
      menuItem.checked = this.isColumnVisible(column);
    }

    // A selection from the context menu dismisses it.
    this.hideContextMenu();
  }

  applyDefaultColumnVisibility():void{
    for(const column of this._columnOrder){
      this.applyColumnHeaderVisibility(column);
      this.applyColumnBodyVisibility(column);
    }
  }

  /**
   * Returns whether a given column is currently visible. The `Name` column
   * (and any column without a dedicated toggle) is always visible.
   */
  private isColumnVisible(column: string): boolean {
    switch(column){
      case TableColumns.TYPE:         return this.typeColumnVisible;
      case TableColumns.STATUS:       return this.statusColumnVisible;
      case TableColumns.PID:          return this.pidColumnVisible;
      case TableColumns.PROCESS_NAME: return this.processNameColumnVisible;
      case TableColumns.CPU:          return this.cpuColumnVisible;
      case TableColumns.MEMORY:       return this.memoryColumnVisible;
      case TableColumns.DISK:         return this.diskColumnVisible;
      case TableColumns.NETWORK:      return this.networkColumnVisible;
      case TableColumns.GPU:          return this.gpuColumnVisible;
      case TableColumns.POWER_USAGE:  return this.powerColumnVisible;
      default:                        return true;
    }
  }

  /** Shows or hides a single cell by toggling its inline `display` style. */
  private setCellDisplay(cell: HTMLElement, visible: boolean): void {
    if(visible){
      this._renderer.removeStyle(cell, 'display');
    }else{
      this._renderer.setStyle(cell, 'display', 'none');
    }
  }

  applyColumnHeaderVisibility(column: string) {
    const tableHeader = this.tskMgrTableHeaderCntnt.nativeElement;
    const colNum = this._columnOrder.indexOf(column);
    if(colNum < 0) return;

    const headerRowIndex = 0;
    this.setCellDisplay(tableHeader.rows[headerRowIndex].cells[colNum], this.isColumnVisible(column));
  }

  applyColumnBodyVisibility(column: string) {
    const tableBody = this.tskMgrTableBodyCntnt.nativeElement;
    const colNum = this._columnOrder.indexOf(column);
    if(colNum < 0) return;

    const visible = this.isColumnVisible(column);
    for(let i = 0; i < this.processes.length; i++){
      this.setCellDisplay(tableBody.rows[i].cells[colNum], visible);
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

  setUtilColumnColors(cellValue: number | string){
    // Numeric usage cells (CPU/Memory/Disk/Network/GPU) are colour-coded by
    // how heavy the load is; the higher the value, the warmer the colour.
    if(typeof cellValue == "number"){
      if(cellValue <= ResourceUtilization.LOW){
        return {
          'text-align':'right',
          'background-color': 'var(--tm-util-low)'
        };
      }else if(cellValue > ResourceUtilization.LOW && cellValue <= ResourceUtilization.MEDIUM){
        return {
          'text-align':'right',
          'background-color': 'var(--tm-util-med)'
        };
      }else if(cellValue > ResourceUtilization.MEDIUM && cellValue <= ResourceUtilization.HIGH){
        return {
          'text-align':'right',
          'background-color': 'var(--tm-util-high)'
        };
      }else if (cellValue > ResourceUtilization.HIGH){
        return {
          'text-align':'right',
          'background-color': 'var(--tm-util-vhigh)', 
        };
      }
    }else if(typeof cellValue =="string"){
      // The Power-usage cell uses descriptive levels rather than a number.
      if(cellValue == 'Very low'){
        return {
          'background-color': 'var(--tm-util-low)'
        };
      }else if(cellValue == 'Low'){
        return {
          'background-color': 'var(--tm-util-med)'
        };
      }else if(cellValue == 'Moderate'){
        return {
          'background-color': 'var(--tm-util-mod)'
        };
      }else if(cellValue == 'High'){
        return {
          'background-color': 'var(--tm-util-high)'
        };
      }else if (cellValue == 'Very high'){
        return {
          'background-color': 'var(--tm-util-vhigh)', 
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
        divElmnt.style.backgroundColor = 'var(--tm-th-heat)';
        divElmnt1.style.backgroundColor = 'var(--tm-th-heat)';
        utilDivElmnt.style.right = '-40%';
      }else if(cellValue >= lowUtil){
        divElmnt.style.backgroundColor = (cellValue >= veryHighUtil)?  'var(--tm-th-heat-warn)' : 'var(--tm-th-heat)';
        divElmnt1.style.backgroundColor = (cellValue >= veryHighUtil)?  'var(--tm-th-heat-warn)' : 'var(--tm-th-heat)';
        
        divElmnt.style.borderLeft = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
        divElmnt1.style.borderLeft = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
        divElmnt.style.borderRight = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
        divElmnt1.style.borderRight = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
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
          divElmnt.style.backgroundColor = (cellValue >= veryHighUtil)?  'var(--tm-th-heat-warn)' : 'var(--tm-bg)';
          divElmnt1.style.backgroundColor = (cellValue >= veryHighUtil)?  'var(--tm-th-heat-warn)' : 'var(--tm-bg)';
          
          divElmnt.style.borderLeft = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
          divElmnt1.style.borderLeft = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
          divElmnt.style.borderRight = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
          divElmnt1.style.borderRight = (cellValue >= veryHighUtil)? 'var(--tm-th-heat-warn)': '';
          utilDivElmnt.style.right = (cellValue >= maxHighUtil)? '-5%': '-20%';
        }
      }
    }
  }

  maximizeWindow():void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      /* The layout is now fully flex-driven:
         .tskmgr-root (100%/100%) -> .tskmgr-tabbed-window (flex:1) ->
         .tskmgr-tab-content -> .tskmgr-tab-pane.active -> .card ->
         .card-body -> .tskmgr-table-cntnr (flex:1; overflow:auto).
         The primary window already sizes the host on maximize, so the
         table container fills the available space automatically. We
         just clear any leftover inline sizes from a prior imperative
         pass and re-sync the header column. */
      const tblCntnr = this.tskmgrTblCntnr?.nativeElement as HTMLElement | undefined;
      if(tblCntnr){
        tblCntnr.style.width = '';
        tblCntnr.style.height = '';
      }
    }
  }

  minimizeWindow(arg:number[]):void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      /* `arg` carried the pre-maximize width so the old code could
         restore an inline px width on the table container. With the
         flex layout in place the container reflows on its own when the
         primary window shrinks back to its prior size, so the arg is
         no longer needed -- we just clear any inline sizes to make
         sure CSS wins. */
      void arg;
      const tblCntnr = this.tskmgrTblCntnr?.nativeElement as HTMLElement | undefined;
      if(tblCntnr){
        tblCntnr.style.width = '';
        tblCntnr.style.height = '';
      }
    }
  }

  /**
   * Called whenever the primary window broadcasts a live drag-resize.
   * Both maximizeWindow / minimizeWindow / synchronizeBodyCntntAndBodyCntnr
   * write inline px sizes onto tskmgrTblCntnr, and alignHeaderAndBodyWidth
   * writes inline px width/min-width onto the first header cell. Those
   * pinned values would prevent the layout from shrinking with the
   * window, so we strip them and let CSS (flex on the container,
   * table-layout:auto + width:max-content on the table) take over. We do
   * NOT re-run alignHeaderAndBodyWidth here -- header and body share the
   * same <table>, so their columns align automatically.
   */
  onWindowResize():void {
    const tblCntnr = this.tskmgrTblCntnr?.nativeElement as HTMLElement | undefined;
    if(tblCntnr){
      tblCntnr.style.width = '';
      tblCntnr.style.height = '';
    }
    const headerEl = this.tskMgrTableHeaderCntnt?.nativeElement as HTMLTableSectionElement | undefined;
    const firstHeaderCell = headerEl?.rows?.[0]?.cells?.[0] as HTMLElement | undefined;
    if(firstHeaderCell){
      firstHeaderCell.style.width = '';
      firstHeaderCell.style.minWidth = '';
    }
  }

  storeAppState(app_data:unknown):void{
    //store refresh state, sort state, and view state
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }


  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
    
      //retrieve refresh state, sort state, and view state
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
