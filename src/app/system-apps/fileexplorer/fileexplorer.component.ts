/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation, Input} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Subscription } from 'rxjs';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { FileToolTip, ViewOptions, ViewOptionsCSS } from './fileexplorer.types';
import {basename, dirname} from 'path';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { GeneralMenu, MenuPosition, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.types';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ActivityType, SortBys, UserNotificationType } from 'src/app/system-files/common.enums';
import { DragEventInfo, FileTreeNode } from 'src/app/system-files/common.interfaces';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types'
import { file } from 'jszip';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';

@Component({
  selector: 'cos-fileexplorer',
  templateUrl: './fileexplorer.component.html',
  styleUrls: ['./fileexplorer.component.css'],
  standalone:false,
  encapsulation: ViewEncapsulation.None,
})

export class FileExplorerComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileExplorerMainContainer', {static: true}) fileExplrMainCntnr!: ElementRef; 
  @ViewChild('fileExplorerRootContainer', {static: true}) fileExplorerRootContainer!: ElementRef; 
  @ViewChild('fileExplorerContentContainer', {static: true}) fileExplrCntntCntnr!: ElementRef;
  @ViewChild('navExplorerContainer', {static: true}) navExplorerCntnr!: ElementRef; 

  @Input() priorUId = Constants.EMPTY_STRING;
 
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _fileService!:FileService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagmentService!:SessionManagmentService;
  private _userNotificationService!:UserNotificationService;
  private _windowService!:WindowService;
  private _menuService!:MenuService;
  private _audioService!:AudioService;
  private _systemNotificationService!:SystemNotificationService;
  private _activityHistoryService!:ActivityHistoryService;
  private _formBuilder;
  private _appState!:AppState;


  private _viewByNotifySub!:Subscription;
  private _sortByNotifySub!:Subscription;
  private _refreshNotifySub!:Subscription;
  private _autoArrangeIconsNotifySub!:Subscription;
  private _autoAlignIconsNotifyBySub!:Subscription;
  private _dirFilesUpdatedSub!: Subscription;
  private _fetchDirectoryDataSub!: Subscription;
  private _goToDirectoryDataSub!: Subscription;
  private _hideContextMenuSub!:Subscription;
  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _creatShortCutOnDesktopSub!: Subscription;
  

  private isPrevBtnActive = false;
  private isNextBtnActive = false;
  private isUpBtnActive = true;
  private isNavigatedBefore = false;
  private isRenameActive = false;
  private isIconInFocusDueToCurrentAction = false;
  private isIconInFocusDueToPriorAction = false;
  private isHideCntxtMenuEvt= false;
  private isShiftSubMenuLeft = false;
  private isRecycleBinFolder = false;
  private isDragFromFileExplorerActive = false;

  private isActive = false;
  private isFocus = false;

  isDetailsView = false;
  isNotDetailsView = true;

  _isBtnClickEvt= false;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = -1;
  private prevSelectedElementId = -1; 
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private renameFileTriggerCnt = 0; 
  private currentIconName = Constants.EMPTY_STRING;
  private blankSpaceClickCntr = 0; 

  readonly capacity = Constants.STORAGE_CAPACITY;
  usedCapacity = 0;
  availableCapacityText = Constants.EMPTY_STRING;

  isShowFileNameWarning = false;
  isSearchBoxNotEmpty = false;
  isShowOnlyURLFilesInRootDir = true;
  showPathHistory = false;
  onClearSearchIconHover = false;
  onSearchIconHover = false;
  showIconCntxtMenu = false;
  showFileExplrCntxtMenu = false;
  quickAccessFolderSection = false;
  quickAccessFilesSection = false;
  showFileSizeAndUnit = false;
  iconCntxtCntr = 0;
  fileExplrCntxtCntr = 0;
  selectFilesSizeSum = Constants.EMPTY_STRING;
  selectFilesSizeUnit = Constants.EMPTY_STRING;

  readonly ROOT = Constants.ROOT;
  readonly THIS_PC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);
  readonly EMPTY_STRING = Constants.EMPTY_STRING
  readonly QUICK_ACCESS = 'Quick access';
  fileTreeNavToPath = Constants.EMPTY_STRING

  fileExplrCntxtMenuStyle:Record<string, unknown> = {};
  clearSearchStyle:Record<string, unknown> = {};
  searchStyle:Record<string, unknown> = {};
  prevNavBtnStyle:Record<string, unknown> = {};
  nextNavBtnStyle:Record<string, unknown> = {};
  recentNavBtnStyle:Record<string, unknown> = {};
  upNavBtnStyle:Record<string, unknown> = {};
  upNavBtnCntnrStyle:Record<string, unknown> = {};
  tabLayoutCntnrStyle:Record<string, unknown> = {};
  ribbonMenuBtnStyle:Record<string, unknown> = {};
  ribbonMenuCntnrStyle:Record<string, unknown> = {};

  olClassName = ViewOptionsCSS.ICONS_VIEW_CSS;
  btnTypeRibbon = 'Ribbon';
  btnTypeFooter = 'Footer';
  selectedRow = -1;

  fetchedFiles:FileInfo[] = [];
  frequentFolders:FileInfo[] = [];
  recentFiles:FileInfo[] = [];
  devicesAndDrivesFiles:FileInfo[] = [];

  fileTreeNode:FileTreeNode[] = [];
  _fileInfo!:FileInfo;
  prevPathEntries:string[] = [];
  nextPathEntries:string[] = [];
  recentPathEntries:string[] = [];
  upPathEntries:string[] = ['/Users/Desktop'];
  _directoryTraversalList:string[] = ['This PC'];
  fileTreeHistory:string[] = [];
  SECONDS_DELAY:number[] = [100, 1500, 6000, 12000, 500];
  
  defaultviewOption = ViewOptions.MEDIUM_ICON_VIEW;
  currentViewOption = ViewOptions.MEDIUM_ICON_VIEW;
  currentViewOptionId = 3;
  
  readonly smallIconsView = ViewOptions.SMALL_ICON_VIEW;
  readonly mediumIconsView = ViewOptions.MEDIUM_ICON_VIEW;
  readonly largeIconsView = ViewOptions.LARGE_ICON_VIEW;
  readonly extraLargeIconsView = ViewOptions.EXTRA_LARGE_ICON_VIEW;
  readonly detailsView = ViewOptions.DETAILS_VIEW;

  readonly sortByName = SortBys.NAME;
  readonly sortByItemType = SortBys.ITEM_TYPE;
  readonly sortBySize = SortBys.SIZE;
  readonly sortByDateModified = SortBys.DATE_MODIFIED;

  isExtraLargeIcon = false;
  isLargeIcon = false;
  isMediumIcon = true;
  isSmallIcon = false;
  isDetailsIcon = false;

  isSortByName = false;
  isSortByItemType = false;
  isSortBySize = false;
  isSortByDateModified = false;

  showExpandTreeIcon = false;
  showNavigationPane = true;

  renameForm!: FormGroup;
  pathForm!: FormGroup;
  searchForm!: FormGroup;

  searchHistory =['Java','ProgramFile', 'Perenne'];
  pathHistory =['/Users/Vidoes','/Users/Games', '/Users/Music'];

  sourceData:GeneralMenu[] = [
    {icon:Constants.EMPTY_STRING, label: 'Open', action: this.onTriggerRunApplication.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in new window', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in Terminal', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Start', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Send to Zip', action: this.onZip.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Mount', action: this.onMountZipFile.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Cut', action: this.onCut.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Copy', action: this.onCopy.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Create shortcut', action: this.createShortCut.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Delete', action: this.onDeleteFile.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Rename', action: this.onRenameFileTxtBoxShow.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Restore', action: this.onRestore.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Properties', action: this.showPropertiesWindow.bind(this) }
  ];

  menuData:GeneralMenu[] = [];
  fileExplrMenu:NestedMenu[] = [];

  fileExplrMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  fileExplrMenuOption = Constants.NESTED_MENU_OPTION;
  menuOrder = Constants.EMPTY_STRING;

  fileInfoTipData:FileToolTip[] = [];

  fileType = Constants.EMPTY_STRING;
  fileAuthor = Constants.EMPTY_STRING;
  fileSize = Constants.EMPTY_STRING;
  fileDimesions = Constants.EMPTY_STRING;
  fileDateModified = Constants.EMPTY_STRING;
  currentTooltipFileId = Constants.EMPTY_STRING;

  readonly shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;
  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;

  fileExplorerBoundedRect!:DOMRect;
  multiSelectElmnt!:HTMLDivElement | null;
  multiSelectStartingPosition!:MouseEvent | null;

  markedBtnIds:string[] = [];
  movedBtnIds:string[] = [];

  mounthPath:string = Constants.EMPTY_STRING;

  icon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
  navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
  isMaximizable = false;
  readonly name = 'fileexplorer';
  processId = 0;
  type = ComponentType.System;
  directory = Constants.ROOT;
  displayName = 'fileexplorer';
  hasWindow = true;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService, 
              triggerProcessService:ProcessHandlerService, formBuilder: FormBuilder, sessionManagmentService:SessionManagmentService, 
              menuService:MenuService, notificationService:UserNotificationService, windowService:WindowService, 
              audioService:AudioService, systemNotificationService:SystemNotificationService, activityHistoryService:ActivityHistoryService) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileService = fileService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._menuService = menuService;
    this._userNotificationService = notificationService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._systemNotificationService = systemNotificationService;
    this._activityHistoryService = activityHistoryService;
    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._dirFilesUpdatedSub = this._fileService.dirFilesUpdateNotify.subscribe(() =>{
      if(this._fileService.getEventOriginator() === this.name){
        this.loadFiles();
        this._fileService.removeEventOriginator();
      }
    });

    this._fetchDirectoryDataSub = this._fileService.fetchDirectoryDataNotify.subscribe((p) => {
      const name = 'filetreeview';
      const uId = `${name}-${this.processId}`;
      if(this._fileService.getEventOriginator() === uId){
        this.updateFileTreeAsync(p);
        this._fileService.removeEventOriginator();
      }
    });

    this._goToDirectoryDataSub = this._fileService.goToDirectoryNotify.subscribe((p) => {
      const name = 'filetreeview-1';
      const uId = `${name}-${this.processId}`;
      if(this._fileService.getEventOriginator() === uId){
        if(!this.isRecycleBinFolder){
          this.navigateToFolder(p);
          this._fileService.removeEventOriginator();
        }
      }
    });

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)});
    this._hideContextMenuSub = this._menuService.hideContextMenus.subscribe((p) => {
      if(p !== this.name)
        this.hideIconContextMenu();
    });

  }

  ngOnInit():void{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
    this.retrievePastSessionData();
    
    if(this._fileInfo){
      // is this a URL or and Actual Folder
      if(this._fileInfo.getOpensWith === Constants.FILE_EXPLORER && !this._fileInfo.getIsFile){ //Actual Folder
        this.directory = this._fileInfo.getCurrentPath;
        const fileName = (this._fileInfo.getFileName === Constants.EMPTY_STRING)? Constants.NEW_FOLDER : this._fileInfo.getFileName;

        this.generateBreadCrumbs();
        this.checkAndSetIfRecycleBin();
        this.setNavPathIcon(fileName, this._fileInfo.getCurrentPath);
      }
    }

    this.renameForm = this._formBuilder.nonNullable.group({ renameInput: Constants.EMPTY_STRING, });
    this.pathForm = this._formBuilder.nonNullable.group({ pathInput: Constants.EMPTY_STRING, });
    this.searchForm = this._formBuilder.nonNullable.group({ searchInput: Constants.EMPTY_STRING, });

    this.setNavButtonsColor();
    this.getFileExplorerMenuData();
    this.storeAppState(this._fileInfo.getCurrentPath);
  }

  async ngAfterViewInit():Promise<void>{
    this.hidePathTextBoxOnload();
    this.changeFileExplorerLayoutCSS(this.currentViewOption);
    this.changeTabLayoutIconCntnrCSS(this.currentViewOptionId,false);

    this.pathForm.setValue({
      pathInput: (this.directory !== Constants.ROOT)? this.directory : Constants.ROOT
    })

    await this.loadFileTreeAsync();
    await this.setProperRecycleBinIcon();
    await this.loadFiles().then(async()=>{
      await CommonFunctions.sleep(this.SECONDS_DELAY[4])
      this.captureComponentImg();
    });

    //this.updateFileExplorerWindoAfterViewInit();
  }

  ngOnDestroy(): void {
    this._systemNotificationService.removeAppIconNotication(this.processId);
    this._viewByNotifySub?.unsubscribe();
    this._sortByNotifySub?.unsubscribe();
    this._refreshNotifySub?.unsubscribe();
    this._autoArrangeIconsNotifySub?.unsubscribe();
    this._autoAlignIconsNotifyBySub?.unsubscribe();
    this._dirFilesUpdatedSub?.unsubscribe();
    this._hideContextMenuSub?.unsubscribe();
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._fetchDirectoryDataSub?.unsubscribe();
    this._goToDirectoryDataSub?.unsubscribe();
    this._creatShortCutOnDesktopSub?.unsubscribe();
  }

  get getFileExplorerRootContainerElmnt(): HTMLElement {
    return this.fileExplorerRootContainer.nativeElement;
  }

  updateFileExplorerWindoAfterViewInit():void{

    if(!this.fileExplorerRootContainer) return;

    const windowHeightPx = this.getFileExplorerRootContainerElmnt.offsetHeight;
    const windowWidthPx = this.getFileExplorerRootContainerElmnt.offsetWidth;
    const titleBar = 30;

    const resize:WindowResizeInfo = {pId:this.processId, widthPx:windowWidthPx, heightPx:windowHeightPx + titleBar}
    this._windowService.resizeProcessWindowNotify.next(resize);
  }

  setIsBtnClickEvt(val: boolean, who:string) {
    this._isBtnClickEvt = val;
    if(val === true) {
      // console.log('isBtnClickEvt set to true!');
    }else{
      // console.log('isBtnClickEvt set to false!');
      // console.log('who set it to false!:', who);
    }
  }

  getIsBtnClickEvt() {
    return this._isBtnClickEvt;
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }

    this._sessionManagmentService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);

    if(appSessionData !== null  && appSessionData.appData != Constants.EMPTY_STRING){
      this.directory = appSessionData.appData as string;
    }
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();
    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  maximizeWindow():void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vantaCntnr') as HTMLElement;

      //window title and button bar, and windows taskbar height, fileExplr headerTab container, 
      //empty line container, fileExplr header container, empty line container 2, footer container
      const pixelTosubtract = 30 + 40 + 115.5 + 6 + 24 + 7 + 24;

      this.fileExplrMainCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      this.fileExplrCntntCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      this.navExplorerCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
    }
  }

  minimizeWindow(arg:number[]):void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      // fileExplr headerTab container, empty line container, fileExplr header container, empty line container 2, footer container
      const pixelTosubtract =  115.5 + 6 + 24 + 7 + 24;
      const windowHeight = arg[1];
      const res = windowHeight - pixelTosubtract;

      this.fileExplrMainCntnr.nativeElement.style.height = `${res}px`;
      this.fileExplrCntntCntnr.nativeElement.style.height = `${res}px`;
      this.navExplorerCntnr.nativeElement.style.height = `${res}px`;
    }
  }

  setNavButtonsColor():void{
    this.prevNavBtnStyle ={
      'fill': '#ccc'
    }

    this.nextNavBtnStyle ={
      'fill': '#ccc'
    }

    this.recentNavBtnStyle ={
      'fill': '#ccc'
    }

    this.upNavBtnStyle ={
      'fill': '#fff'
    }

    this.ribbonMenuBtnStyle ={
      'fill': '#fff'
    }
  }

  colorChevron():void{
    this.recentNavBtnStyle ={
      'fill': 'rgb(18, 107, 240)'
    }
  }

  unColorChevron():void{
    this.recentNavBtnStyle ={
      'fill': '#ccc'
    }
  }

  uncolorUpNavBtn():void{
    this.upNavBtnCntnrStyle ={
      'background-color': Constants.EMPTY_STRING
    }
  }

  colorUpNavBtn():void{
    if(!this.isUpBtnActive){
      this.upNavBtnCntnrStyle ={
        'background-color': Constants.EMPTY_STRING
      }
    }else{
      this.upNavBtnCntnrStyle ={
        'background-color': '#3f3e3e',
        'transition':'background-color 0.3s ease'
      }
    }
  }

  colorPrevNavBtn():void{
    if(!this.isPrevBtnActive){
      this.prevNavBtnStyle ={
        'fill': '#ccc'
      }
    }else{
      this.prevNavBtnStyle ={
        'fill': 'rgb(18, 107, 240)'
      }
    }
  }

  uncolorPrevNavBtn():void{
    this.prevNavBtnStyle ={
      'fill': '#ccc'
    }
  }

  private normalizePath(path: string): string {
    // normalize slashes + remove trailing root (except if it's the root itself)
    const root = Constants.ROOT;
    let p = path.replace(/\\/g, root); // if you mix slashes
    if (p.length > 1 && p.endsWith(root)) p = p.slice(0, -1);
    return p;
  }

  private getParentPath(path: string): string {
    const root = Constants.ROOT;
    const p = this.normalizePath(path);
    const lastSep = p.lastIndexOf(root);
    if (lastSep <= 0) return root;          // parent of "/x" -> "/"
    return p.substring(0, lastSep);
  }

  private rebuildUpStackFromCurrent(): void {
    // "Up" should take you to parent, then parent's parent, etc.
    const root = Constants.ROOT;
    let cur = this.normalizePath(this.directory);

    const parents: string[] = [];
    while (cur !== root && cur !== Constants.RECYCLE_BIN_PATH) {
      cur = this.getParentPath(cur);
      parents.push(cur);
      if (cur === root) break;
    }

    // We want pop() to return the immediate parent first:
    // if parents = ["/Users/me", "/Users", "/"]
    // we should store it as ["/", "/Users", "/Users/me"] so pop() => "/Users/me"
    this.upPathEntries = parents.reverse();

    console.log('this.upPathEntries:', this.upPathEntries);

    this.isUpBtnActive = this.upPathEntries.length > 0;
    this.upNavBtnStyle = { fill: this.isUpBtnActive ? '#fff' : '#ccc' };
  }

  private async navigateTo(targetPath: string, kind: string): Promise<void> {
    const next = this.normalizePath(targetPath);
    const cur  = this.normalizePath(this.directory);

    if (!next || next === cur) return;

    // Stack updates
    if (kind === 'push') {
      this.prevPathEntries.push(cur);
      this.nextPathEntries = []; // important: new nav invalidates forward stack
    } else if (kind === 'back') {
      this.nextPathEntries.push(cur);
    } else if (kind === 'forward') {
      this.prevPathEntries.push(cur);
    } else if (kind === 'up') {
      // treat Up as a "push" nav (it’s a new location)
      this.prevPathEntries.push(cur);
      this.nextPathEntries = [];
    }

    // Apply directory
    this.directory = next;

    // UI state for back/forward
    this.isPrevBtnActive = this.prevPathEntries.length > 0;
    this.prevNavBtnStyle = { fill: this.isPrevBtnActive ? '#fff' : '#ccc' };

    this.isNextBtnActive = this.nextPathEntries.length > 0;
    this.nextNavBtnStyle = { fill: this.isNextBtnActive ? '#fff' : '#ccc' };

    // Up state based on actual parents
    this.rebuildUpStackFromCurrent();

    // Downstream work
    const folderName = basename(this.directory);
    await this._audioService.play(this.cheetahNavAudio);
    this.generateBreadCrumbs();
    this.setNavPathIcon(folderName, this.directory);
    await this.loadFiles();
    await CommonFunctions.sleep(this.SECONDS_DELAY[4]);
    this.captureComponentImg();
  }

  async goForwardAlevel(): Promise<void> {
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    if (this.nextPathEntries.length === 0) return;

    const next = this.nextPathEntries.pop() ?? Constants.EMPTY_STRING;
    await this.navigateTo(next, 'forward');
  }

  async goBackAlevel(): Promise<void> {
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    if (this.prevPathEntries.length === 0) return;

    const prev = this.prevPathEntries.pop() ?? Constants.EMPTY_STRING;
    await this.navigateTo(prev, 'back');
  }

  async goUpAlevel(): Promise<void> {
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    if (this.upPathEntries.length === 0) return;

    const parent = this.upPathEntries.pop() ?? Constants.EMPTY_STRING;
    await this.navigateTo(parent, 'up');
  }

  colorNextNavBtn():void{
    if(!this.isNextBtnActive){
      this.nextNavBtnStyle ={
        'fill': '#ccc'
      }
    }else{
      this.nextNavBtnStyle ={
        'fill': 'rgb(18, 107, 240)'
      }
    }
  }

  uncolorNextNavBtn():void{
    this.nextNavBtnStyle ={
      'fill': '#ccc'
    }
  }
  onNavPaneBtnClick():void{
    this.showNavigationPane = !this.showNavigationPane;
  }

  showExpandTreeIconBtn():void{
    this.showExpandTreeIcon = true;
  }

  hideExpandTreeIconBtn():void{
    this.showExpandTreeIcon = false;
  }

  private async loadFileTreeAsync():Promise<void>{
    if(this.isRecycleBinFolder) return;

    this.fileTreeNode = [];
    //this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.readDirectory(Constants.USER_BASE_PATH);
    const osDrive:FileTreeNode = {name:Constants.OSDISK, path: Constants.ROOT, isFolder: true, children:[]}

    // this.directory, will not be correct for all cases. Make sure to check
    for(const dirEntry of directoryEntries){
      const entryPath = `${Constants.USER_BASE_PATH}/${dirEntry}`;
      const isFile =  await this._fileService.isDirectory(entryPath);
      const ftn:FileTreeNode = {
        name : dirEntry,
        path : entryPath,
        isFolder: isFile,
        children: []
      }

      this.fileTreeNode.push(ftn);
    }

    this.fileTreeNode.push(osDrive);
  }

  async updateFileTreeAsync(path:string):Promise<void>{
    //console.log('updateFileTreeAsync called', path);

    if(!this.fileTreeHistory.includes(path)){
      const tmpFileTreeNode:FileTreeNode[] = [];
      //this._fileService.resetDirectoryFiles();
      const directoryEntries  = await this._fileService.readDirectory(path);
  
      // this.directory, will not be correct for all cases. Make sure to check
      for(const dirEntry of directoryEntries){
        const entryPath = `${path}/${dirEntry}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        const isDir =  await this._fileService.isDirectory(entryPath);
        const ftn:FileTreeNode = { name: dirEntry,  path: entryPath, isFolder: isDir, children: [] }
        tmpFileTreeNode.push(ftn);
      }
  
      const res =  this.addChildrenToNode(this.fileTreeNode, path, tmpFileTreeNode);
      this.fileTreeNode = res;
      this.fileTreeHistory.push(path);
    }
  }

  private addChildrenToNode(treeData: FileTreeNode[], nodePath: string, newChildren: FileTreeNode[]): FileTreeNode[] {
    // Create a new array for the updated treeData
    const updatedTreeData: FileTreeNode[] = [];

    for (let i = 0; i < treeData.length; i++) {
      const node = treeData[i];
      const updatedNode: FileTreeNode = { name: node.name, path: node.path, isFolder: node.isFolder, children: node.children || [] };

      // If the current node matches the nodeName, add the new children
      if (node.path === nodePath) {
        for(const child of newChildren){
          updatedNode.children.push(child)
        }
      }

      // If the node has children, recursively call this function on the children
      if(node.children)
        updatedNode.children = this.addChildrenToNode(node.children, nodePath, newChildren);
      
      // Add the updated node to the new treeData array
      updatedTreeData.push(updatedNode);
    }

    return updatedTreeData;
  }

  async navigateToFolder(data: string[]): Promise<void> {
    console.log('navigateToFolder:', data);

    const quickAccess = 'Quick access';
    const thisPC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);

    const fileName = data[0];
    const rawPath = data[1];

    // Resolve "special" paths to a real directory target
    const isSpecialRoot = (rawPath === thisPC || rawPath === quickAccess);
    const targetDir = isSpecialRoot ? Constants.ROOT : rawPath;

    // --- HISTORY: push CURRENT once, clear forward stack ---
    const curDir = this.directory;

    // Only add to back stack if this is a true navigation to a different target
    if (targetDir !== curDir) {
      this.prevPathEntries.push(curDir);
      this.nextPathEntries = []; // new branch => forward is invalid
    }

    // --- UI state ---
    this.isPrevBtnActive = this.prevPathEntries.length > 0;
    this.displayName = fileName;

    // fileTreeNavToPath appears to be a "highlight in tree" target
    this.fileTreeNavToPath = (rawPath === Constants.ROOT) ? Constants.EMPTY_STRING : rawPath;

    if (rawPath === Constants.ROOT) {
      this.fileTreeNavToPath = Constants.EMPTY_STRING;
    } 
    // --- Apply navigation ---
    this.directory = targetDir;

    // --- Icon ---
    if (rawPath === `/Users/${fileName}`) {
      this.icon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
    } else {
      this.icon = `${Constants.IMAGE_BASE_PATH}folder.png`;
    }

    // --- Recent paths ---
    if (this.recentPathEntries.indexOf(this.directory) === -1) {
      this.recentPathEntries.push(this.directory);
    }

    // --- Up stack: rebuild from actual directory (recommended) ---
    this.rebuildUpStackFromCurrent(); // <- from prior message

    // --- Refresh breadcrumb / UI ---
    this.generateBreadCrumbs();
    this.setNavPathIcon(fileName, this.directory);
    this.storeAppState(this.directory);

    // --- Load content based on resolved directory ---
    if (this.directory === Constants.ROOT) {
      await this.loadFiles(false);
    } else {
      await this.loadFiles();
    }

    if(rawPath === thisPC || rawPath !== Constants.ROOT)
      await this.loadFiles();
    else if(rawPath === Constants.ROOT)
      await this.loadFiles(false);

    await CommonFunctions.sleep(this.SECONDS_DELAY[4]);
    this.captureComponentImg();
  }

  setNavPathIcon(fileName:string, directory:string):void{
    console.log(`fileexplorer - setNavPathIcon: fileName:${fileName} -----  directory:${directory}`)

    if(directory === `/Users/${fileName}` || directory === Constants.RECYCLE_BIN_PATH){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder_small.png`;
    }
    else if((fileName === Constants.OSDISK && directory === Constants.ROOT)){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}os_disk.png`;
    }
    else if((fileName === Constants.FILE_EXPLORER && directory === Constants.ROOT) || (fileName === Constants.EMPTY_STRING && directory === Constants.ROOT)){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
    }else{
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}folder_folder_small.png`;
    }

    const taskBarAppIconInfo:Map<number, string[]> = new Map<number, string[]>();
    taskBarAppIconInfo.set(this.processId, [fileName, this.navPathIcon]);
    this._systemNotificationService.setAppIconNotication(this.processId, [fileName, this.navPathIcon])

    this._systemNotificationService.taskBarIconInfoChangeNotify.next(taskBarAppIconInfo);
  }

  showPathTextBox(evt:MouseEvent):void{
    evt.stopPropagation();
    this.focusWindow();

    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLInputElement;
    const pathIconBoxElement = document.getElementById(`pathIconBox-${this.processId}`) as HTMLElement;

    if(!pathTxtBoxCntrElement || !pathTxtBoxElement || !pathIconBoxElement) return;

    pathTxtBoxCntrElement.style.display = 'flex';
    pathTxtBoxElement.style.display = 'block';

    if(this.showPathHistory){
      if(this.directory === Constants.ROOT)
        this.pathForm.setValue({ pathInput:Constants.ROOT })
    }
    else
      this.pathForm.setValue({ pathInput:this.directory })

    pathTxtBoxElement?.focus();
    pathTxtBoxElement?.select();
    pathIconBoxElement.style.display = 'none';
  }

  hidePathTextBox():void{
    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLElement;
    const pathIconBoxElement = document.getElementById(`pathIconBox-${this.processId}`) as HTMLElement;

    if(!pathTxtBoxCntrElement || !pathTxtBoxElement || !pathIconBoxElement) return;

    pathTxtBoxElement.style.display = 'none';
    pathTxtBoxCntrElement.style.display = 'none';
    pathIconBoxElement.style.display = 'flex';
  }

  hidePathTextBoxOnload():void{
    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLElement;  

    if(!pathTxtBoxCntrElement || ! pathTxtBoxElement) return;

    pathTxtBoxElement.style.display = 'none';
    pathTxtBoxCntrElement.style.display = 'none';
  }

  /**
   * popluates a List with path traversal
   * RECYCLE_BIN_PATH → [RECYCLE_BIN]
   * user path like /Users/Bob/Documents → [THISPC, Users, Bob, Documents]
   * non-user path like /System/Library → [THISPC, System, Library]
   * root / → [THISPC, OSDISK] (stable breadcrumb)
   * @returns 
   */
  generateBreadCrumbs(): void {
    // Split directory into segments (ignore empty from leading/trailing slashes)
    const segments = this.directory
      .split(Constants.ROOT)
      .filter(x => x !== Constants.EMPTY_STRING);

    // Breadcrumb trail always starts at THISPC
    const trail: string[] = [Constants.THISPC, ...segments];

    // Special case: Recycle Bin
    if (this.directory === Constants.RECYCLE_BIN_PATH) {
      this._directoryTraversalList = [Constants.RECYCLE_BIN];
      return;
    }

    // User base path: show the real segments as-is (THISPC + /Users/...)
    if (this.directory.includes(Constants.USER_BASE_PATH)) {
      this._directoryTraversalList = trail;
      return;
    }

    // Non-user paths: show a stable disk label after THISPC
    // Ensure slot exists for the disk label (index 1).
    if (trail.length === 1) {
      trail.push(Constants.OSDISK);
    } else {
      if(this.directory === Constants.ROOT)
        trail[1] = Constants.OSDISK;
    }

    this._directoryTraversalList = trail;
    console.log('this._directoryTraversalList:', this._directoryTraversalList);
  }


  captureComponentImg():void{
    htmlToImage.toPng(this.fileExplorerRootContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pId: this.processId,
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
    })
  }
  

  toggleLargeIconsView():void{
    this.currentViewOption = ViewOptions.LARGE_ICON_VIEW;
    this.changeLayoutCss( this.currentViewOption );
    this.changeOrderedlistStyle( this.currentViewOption );
    this.changeIconViewBtnSize( this.currentViewOption );
  }

  toggleDetailsView():void{
    this.currentViewOption = ViewOptions.DETAILS_VIEW;
    this.changeLayoutCss( this.currentViewOption );
    this.changeOrderedlistStyle( this.currentViewOption );
    this.changeIconViewBtnSize( this.currentViewOption );
  }

  changeFileExplorerLayoutCSS(inputViewOption:ViewOptions):void{
    if(inputViewOption === ViewOptions.SMALL_ICON_VIEW || inputViewOption === ViewOptions.MEDIUM_ICON_VIEW || 
      inputViewOption === ViewOptions.LARGE_ICON_VIEW || inputViewOption === ViewOptions.EXTRA_LARGE_ICON_VIEW){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
      this.changeIconViewBtnSize(inputViewOption);
    }

    if(inputViewOption === ViewOptions.DETAILS_VIEW){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
    }
  }

  changeTabLayoutIconCntnrCSS(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`tabLayoutIconCntnr-${this.processId}-${id}`) as HTMLElement;
    if(this.currentViewOptionId === id){
      if(btnElement){
        btnElement.style.border = '0.5px solid #ccc';
        if(isMouseHover){
          btnElement.style.backgroundColor = '#807c7c';
        }else{
          btnElement.style.backgroundColor = '#605c5c';
        }
      }
    }

    if(this.currentViewOptionId !== id){
      if(btnElement){
        if(isMouseHover){
          btnElement.style.backgroundColor = '#403c3c';
          btnElement.style.border = '0.5px solid #ccc';
        }else{
          btnElement.style.backgroundColor = Constants.EMPTY_STRING;
          btnElement.style.border = Constants.EMPTY_STRING;
          btnElement.style.margin = '0';
        }
      }    
    }
  }

  changeLayoutCss(iconSize:ViewOptions):void{
    const layoutOptions:ViewOptions[] = [ViewOptions.SMALL_ICON_VIEW, ViewOptions.MEDIUM_ICON_VIEW, ViewOptions.LARGE_ICON_VIEW, 
                                        ViewOptions.EXTRA_LARGE_ICON_VIEW, ViewOptions.DETAILS_VIEW];

    const LayoutOptionsCSS:ViewOptionsCSS[] = [ViewOptionsCSS.ICONS_VIEW_CSS, ViewOptionsCSS.DETAILS_VIEW_CSS];

    const layoutIdx = layoutOptions.indexOf(iconSize);
    if(layoutIdx <= 3){
      this.olClassName = LayoutOptionsCSS[0];
    } else if (layoutIdx >= 4){
      this.olClassName = LayoutOptionsCSS[1];
    }
  }

  changeIconViewBtnSize(iconSize:ViewOptions):void{

    const icon_sizes:ViewOptions[] = [ViewOptions.SMALL_ICON_VIEW, ViewOptions.MEDIUM_ICON_VIEW, ViewOptions.LARGE_ICON_VIEW, 
                                      ViewOptions.EXTRA_LARGE_ICON_VIEW];

    const fig_img_sizes:string[] = ['30px', '45px', '80px', '96px']; //small, med, large, ext large
    const btn_width_height_sizes:string[][] = [['70px', '50px'], ['90px', '70px'], ['120px', '100px'], ['140px', '120px']];
    const shortCutIconSizes:string[][] = [['8', '-12'], ['12', '-8'], ['21', '1'],  ['25', '5']];

    const iconIdx = icon_sizes.indexOf(iconSize);

    for(let i = 0; i < this.fetchedFiles.length; i++){
      const btnElmnt = document.getElementById(`btnElmnt-${this.processId}-${i}`) as HTMLElement;
      const imgElmnt = document.getElementById(`imgElmnt-${this.processId}-${i}`) as HTMLElement;
      const figCapElmnt = document.getElementById(`figCapElmnt-${this.processId}-${i}`) as HTMLElement;
      const shortCutElmt = document.getElementById(`shortCut-${this.processId}-${i}`) as HTMLElement;

      if(btnElmnt){
        btnElmnt.style.width = btn_width_height_sizes[iconIdx][0];
        //btnElmnt.style.height = btn_width_height_sizes[iconIdx][1];
        btnElmnt.style.height = 'min-content';
      }

      if(imgElmnt){
        imgElmnt.style.width = fig_img_sizes[iconIdx];
        imgElmnt.style.height = fig_img_sizes[iconIdx];
      }

      if(figCapElmnt){
        figCapElmnt.style.width = btn_width_height_sizes[iconIdx][0];
      }

      if(shortCutElmt){
        shortCutElmt.style.width = shortCutIconSizes[iconIdx][0];
        shortCutElmt.style.height = shortCutIconSizes[iconIdx][0];
        shortCutElmt.style.bottom = shortCutIconSizes[iconIdx][1];
      }
    }
  }

  changeOrderedlistStyle(iconView:ViewOptions):void{
    const icon_sizes:ViewOptions[] = [ViewOptions.SMALL_ICON_VIEW, ViewOptions.MEDIUM_ICON_VIEW, ViewOptions.LARGE_ICON_VIEW, 
                                ViewOptions.EXTRA_LARGE_ICON_VIEW];

    const btn_width_height_sizes = [['70px', '50px'], ['90px', '70px'], ['120px', '100px'],  ['140px', '120px']];
    const iconIdx = icon_sizes.indexOf(iconView);
    
    const olElmnt = document.getElementById(`olElmnt-${this.processId}`) as HTMLElement;

    if(iconView === ViewOptions.SMALL_ICON_VIEW || 
      iconView === ViewOptions.MEDIUM_ICON_VIEW ||
      iconView === ViewOptions.LARGE_ICON_VIEW  || 
      iconView === ViewOptions.EXTRA_LARGE_ICON_VIEW){

      if(olElmnt){
        olElmnt.style.gridTemplateColumns = `repeat(auto-fill,${btn_width_height_sizes[iconIdx][0]})`;
        olElmnt.style.gridTemplateRows = `repeat(auto-fill,${btn_width_height_sizes[iconIdx][1]})`;
        olElmnt.style.rowGap = '34px';
        olElmnt.style.columnGap = '5px';
        olElmnt.style.padding = '5px 10px';
        olElmnt.style.gridAutoFlow = 'row';
      }
    }
    
    else if(iconView === ViewOptions.CONTENT_VIEW){
      const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
      if(olElmnt){
        olElmnt.style.gridTemplateColumns = `repeat(auto-fill, minmax(50px, ${rect.width}px)`;
        olElmnt.style.gridTemplateRows = 'repeat(auto-fill, 43px)'; 
      }
    }
  }

  questionBtn():void{
   console.log('do somthing');
  }

  colorRibbonMenuCntnr():void{
    this.ribbonMenuCntnrStyle ={
      'background-color': '#ccc'
    }
  }

  uncolorRibbonMenuCntnr():void{
    this.ribbonMenuCntnrStyle ={
      'background-color': '#080404'
    }
  }

  colorBtnCntnr(btnId:string):void{
    const btnElmnt = document.getElementById(btnId) as HTMLElement;
    if(btnElmnt){
      btnElmnt.style.backgroundColor = '#ccc';
    }
  }

  uncolorBtnCntnr(type:string, btnId:string):void{
    const btnElmnt = document.getElementById(btnId) as HTMLElement;
    if(type === this.btnTypeRibbon){
      if(btnElmnt){
        btnElmnt.style.backgroundColor = '#080404';
      }
    }else{
      if(btnElmnt){
        btnElmnt.style.backgroundColor = Constants.EMPTY_STRING;
      }
    }
  }

  async runApplication(file:FileInfo, evt?:MouseEvent, ):Promise<void>{

    if(evt)
      evt.stopPropagation();

    console.log('fileexplorer-runApplication:',file)
    this.fileTreeNavToPath = Constants.EMPTY_STRING;

    this.hideFileExplorerToolTip();
    CommonFunctions.handleTracking(this._activityHistoryService, file);
    await this._audioService.play(this.cheetahNavAudio);

    if(this.isRecycleBinFolder){
      this._menuService.showPropertiesView.next(file);
      return;
    }

    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    if((file.getOpensWith === Constants.FILE_EXPLORER && file.getFileName !== Constants.FILE_EXPLORER) && file.getFileType === Constants.FOLDER){
      if(!this.isNavigatedBefore){
        this.prevPathEntries.push(this.directory);
        this.upPathEntries.push(this.directory);
        this.isNavigatedBefore = true;
      }

      this.isPrevBtnActive = true;

      if(file.getCurrentPath.includes(Constants.URL)){
        this.directory = file.getContentPath;
      }
      else{
        this.directory = file.getCurrentPath;
      }

      this.displayName = file.getFileName;
      this.icon = file.getIconPath;

      this.prevPathEntries.push(this.directory);
      this.upPathEntries.push(this.directory);

      if(this.recentPathEntries.indexOf(this.directory) === -1){
        this.recentPathEntries.push(this.directory);
      }

      this.generateBreadCrumbs();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
  
      await this.loadFiles();
      await CommonFunctions.sleep(this.SECONDS_DELAY[4])
      this.captureComponentImg(); 
    }else{
      //APPS opened from the fileexplore do not have their windows in focus,
      // and this is due to the mouse click event that causes fileexplorer to trigger setFocusOnWindow event
      await CommonFunctions.sleep(this.SECONDS_DELAY[4]);
      this._processHandlerService.runApplication(file);
    }
  }

  async onTriggerRunApplication():Promise<void>{
    await this.runApplication(this.selectedFile);
  }

  onBtnClick(evt:MouseEvent, id:number):void{
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);
    this.getSelectFileSizeSumAndUnit();

    evt.stopPropagation();
  }

  supressPropagation(evt:MouseEvent):void{
    evt.stopPropagation();
    evt.preventDefault()
  }

  onQuickAccessMouseEnter(evt:MouseEvent, file:FileInfo, id:number, isFileSection:boolean):void{
    const quickAcessSection = (isFileSection)? 'btnElmnt-file': 'btnElmnt-folder';
    const quickAcessSection2 = (isFileSection)? 'fileExplrQAFiles': 'fileExplrQAFolder';

    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;

      const quickAccesBtnElmnt = document.getElementById(`${quickAcessSection}-${this.processId}-${id}`) as HTMLDivElement;
      const quickAccesUlElmnt = document.getElementById(`${quickAcessSection2}-${this.processId}`) as HTMLUListElement;
      this.setBtnStyle(id, true, quickAccesBtnElmnt);

      if(quickAccesUlElmnt){
        const rect = quickAccesUlElmnt.getBoundingClientRect();
        this.showFileExplorerToolTip(evt, file, rect, isFileSection);
      }
    }
  }

  onMouseEnter(evt:MouseEvent, file:FileInfo, id:number):void{
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;

      this.setBtnStyle(id, true);
      this.showFileExplorerToolTip(evt, file);
    }
  }

  onQuickAccessMouseLeave(id:number, isFileSection:boolean):void{
    const quickAcessSection = (isFileSection)? 'btnElmnt-file': 'btnElmnt-folder';

    this.isMultiSelectEnabled = true;
    this.hideFileExplorerToolTip();

    const quickAccesBtnElmnt = document.getElementById(`${quickAcessSection}-${this.processId}-${id}`) as HTMLDivElement;
    if(!this.isMultiSelectActive){
      if(id != this.selectedElementId){
        this.removeBtnStyle(id, quickAccesBtnElmnt);
      }
      else if((id == this.selectedElementId) && this.isIconInFocusDueToPriorAction){
        this.setBtnStyle(id,false, quickAccesBtnElmnt);
      }
    }
  }
  onMouseLeave(id:number):void{
    this.isMultiSelectEnabled = true;
    this.hideFileExplorerToolTip();

    if(!this.isMultiSelectActive){
      if(id != this.selectedElementId){
        this.removeBtnStyle(id);
      }
      else if((id == this.selectedElementId) && this.isIconInFocusDueToPriorAction){
        this.setBtnStyle(id,false);
      }
    }
  }

  doNothing():void{/** */}

  updateTableFieldSize(data:string[]) {
    const tdId = data[0];
    // for(let i =0; i <= this.fileExplrFiles.length; i++){    
    //   if(tdId === 'th-1') {
    //     const fileName =  document.getElementById(`fileName-${i}`) as HTMLElement;
    //     if(fileName){
    //       const px_offSet = 25;
    //       fileName.style.width = `${Number(data[1]) - px_offSet}px`;
    //     }
    //   }
    //   // else if(tdId === 'th-1'){
    //   //   const procType =  document.getElementById(`procType-${i}`) as HTMLElement;
    //   //   if(procType){
    //   //     const px_offSet = 10;
    //   //     procType.style.width =`${Number(data[1]) - px_offSet}px`;
    //   //   }
    //   // }
    // }
  }

  onProcessSelected(rowIndex:number, btnId:number):void{
    this.selectedRow = rowIndex;
    
    if(this.selectedRow !== -1){
      this.isActive = true;
      this.isFocus = true;
    }
  }

  onQuickAcessShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number, isFileSection:boolean):void{
    const quickAcessSection = (isFileSection)? 'fileExplrQAFiles': 'fileExplrQAFolder';

    if(isFileSection){
      this.quickAccessFilesSection = true;
      this.quickAccessFolderSection = false;
    }else{
      this.quickAccessFilesSection = false;
      this.quickAccessFolderSection = true;
    }

    const quickAccesFileElmnt = document.getElementById(`${quickAcessSection}-${this.processId}`) as HTMLDivElement;
    if(quickAccesFileElmnt){
      const rect = quickAccesFileElmnt.getBoundingClientRect();
      this.onShowIconContextMenu(evt, file, id, rect, isFileSection);
    }
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number, rectInput?:DOMRect, isFileSection?:boolean):void{
    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next(this.name); 
    this.hideFileExplorerToolTip();

    const menuHeight = (file.getIsFile)? 225 : 344; //this is not ideal.. menu height should be gotten dynmically
    this.iconCntxtCntr++;

    let axis:MenuPosition = {xAxis:0, yAxis:0}
    if(this.currentViewOption === ViewOptions.DETAILS_VIEW){
      this.isDetailsView = true;
      this.isNotDetailsView = false;

      const tblBodyElmnt = document.getElementById(`tblBody-${this.processId}`) as HTMLTableCellElement;
      const rect = tblBodyElmnt.getBoundingClientRect();
      axis =  {xAxis: evt.clientX  - rect.left - 75, yAxis:evt.clientY - rect.top - 50}
    }else{
      this.isDetailsView = false;
      this.isNotDetailsView = true;

      if(rectInput){
        const tmpAxis = this.checkAndHandleMenuBounds(rectInput, evt, menuHeight);
        axis = (isFileSection)? {xAxis:tmpAxis.xAxis - 10, yAxis: tmpAxis.yAxis + 200} :
         {xAxis:tmpAxis.xAxis - 10, yAxis: tmpAxis.yAxis + 300};
      }else{
        const rect:DOMRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
        axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);
      }
    }
    
    const uId = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uId);

    this.adjustIconContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file
    this.isIconInFocusDueToPriorAction = false;

    if(!this.showIconCntxtMenu)
      this.showIconCntxtMenu = !this.showIconCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);

    this.fileExplrCntxtMenuStyle = {
      'position': 'absolute', 
      'transform':`translate(${axis.xAxis}px, ${axis.yAxis}px)`,
      'z-index': 2,
    }

    evt.preventDefault();
  }

  adjustIconContextMenuData(file:FileInfo):void{
    this.menuData = [];
    const editNotAllowed:string[] = ['3D-Objects.url', 'Desktop.url', 'Documents.url', 'Downloads.url', 'Games.url', 'Music.url', 'Pictures.url', 'Videos.url'];
    const isZipFile = (file.getFileExtension === '.zip');
    
   if(file.getIsFile){
      if(editNotAllowed.includes(file.getCurrentPath.replace(Constants.ROOT, Constants.EMPTY_STRING))){
        this.menuOrder = Constants.FILE_EXPLORER_UNIQUE_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Cut' || x.label === 'Delete' || x.label === 'Rename' || x.label === 'Mount') continue;
          else
            this.menuData.push(x);
        }
      }else if(this.isRecycleBinFolder){
        this.menuOrder = Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Restore' || x.label === 'Cut' || x.label === 'Delete' || x.label === 'Properties')
            this.menuData.push(x);
        }
      }else{
        //files can not be opened in terminal, pinned to start, opened in new window, pin to Quick access
        this.menuOrder = Constants.FILE_EXPLORER_FILE_MENU_ORDER;
        for(const x of this.sourceData){
          if(x.label === 'Open in Terminal' 
            || x.label === 'Pin to Quick access' || x.label === 'Open in new window' 
            || x.label === 'Pin to Start' || x.label === 'Restore') continue;
          else{
            if(x.label === 'Mount' && !isZipFile) continue;
            else
              this.menuData.push(x);
          }
        }
      }
    }else{
      if(this.isRecycleBinFolder){
        this.menuOrder = Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Restore' || x.label === 'Cut' || x.label === 'Delete' || x.label === 'Properties'){
            this.menuData.push(x);
          }
        }
      }else{
        this.menuOrder = Constants.FILE_EXPLORER_FOLDER_MENU_ORDER;
        this.menuData = this.sourceData.filter(x => x.label !== 'Restore' &&  x.label !== 'Mount');
      }
    }
  }


  onShowFileExplorerContextMenu(evt:MouseEvent):void{
    this.showExpandTreeIcon = false;
    this.fileExplrCntxtCntr++;
    if(this.iconCntxtCntr >= this.fileExplrCntxtCntr)
        return;

    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next(this.name);
    const menuHeight = 230; //this is not ideal.. menu height should be gotten dynmically

    const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);

    const uId = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uId);

    if(!this.showFileExplrCntxtMenu)
      this.showFileExplrCntxtMenu = !this.showFileExplrCntxtMenu;

    this.fileExplrCntxtMenuStyle = {
      'position': 'absolute', 
      'transform':`translate(${String(axis.xAxis)}px, ${String(axis.yAxis)}px)`,
      'z-index': 2,
    }

    evt.preventDefault();
    evt.stopPropagation();
  }

  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  hideIconContextMenu(evt?:MouseEvent, caller?:string):void{
    this.showIconCntxtMenu = false;
    this.isDetailsView = false;
    this.isNotDetailsView = true;
    this.showFileExplrCntxtMenu = false;
    this.isShiftSubMenuLeft = false;
    this.iconCntxtCntr = 0;
    this.fileExplrCntxtCntr = 0;
    this.showExpandTreeIcon = false;

    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this.focusWindow();
      this._menuService.hideContextMenus.next(this.name);
    }

    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  checkAndHandleMenuBounds(rect:DOMRect, evt:MouseEvent, menuHeight:number):MenuPosition{
    let xAxis = 0;
    let yAxis = 0;
    let horizontalShift = false;
    let verticalShift = false;

    const horizontalMax = rect.right
    const verticalMax = rect.bottom;
    const horizontalDiff =  horizontalMax - evt.clientX;
    const verticalDiff = verticalMax - evt.clientY;
    const menuWidth = 210;
    const subMenuWidth = 205;
    const taskBarHeight = 5;

    if(horizontalDiff < menuWidth){
      horizontalShift = true;
      const diff = menuWidth - horizontalDiff;
      xAxis = evt.clientX - rect.left - diff;
    }

    if((horizontalDiff <= menuWidth) || (horizontalDiff <= (menuWidth + subMenuWidth))){
      this.isShiftSubMenuLeft = true;
    }

    if((verticalDiff) >= taskBarHeight && (verticalDiff) <= menuHeight){
      const shifMenuUpBy = menuHeight - verticalDiff;
      verticalShift = true;
      yAxis = evt.clientY - rect.top - shifMenuUpBy;
    }
    
    xAxis = (horizontalShift)? xAxis : evt.clientX - rect.left;
    yAxis = (verticalShift)? yAxis : evt.clientY - rect.top;
 
    return {xAxis, yAxis};
  }

  shiftViewSubMenu():void{ this.shiftNestedMenuPosition(0); }

  shiftSortBySubMenu():void{this.shiftNestedMenuPosition(1);  }

  shiftNewSubMenu():void { this.shiftNestedMenuPosition(6); }

  shiftNestedMenuPosition(i:number):void{
    const nestedMenu =  document.getElementById(`dmNestedMenu-${i}`) as HTMLDivElement;
    if(nestedMenu){
      if(this.isShiftSubMenuLeft)
          nestedMenu.style.left = '-98%';
    }
  }

  buildViewMenu():NestedMenuItem[]{

    const extraLargeIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Extra Large icons', action: this.showExtraLargeIconsM,
      variables:this.isExtraLargeIcon,  emptyline:false, styleOption:'A' }

    const largeIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Large icons', action: this.showLargeIconsM,
      variables:this.isLargeIcon, emptyline:false, styleOption:'A' }

    const mediumIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Medium icons', action: this.showMediumIconsM, 
      variables:this.isMediumIcon, emptyline:false, styleOption:'A' }

    const smallIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Small icons', action: this.showSmallIconsM, 
      variables:this.isSmallIcon, emptyline:false, styleOption:'A' }


    const detailsIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Details icons', action:this.showDetailsIconsM,
     variables:this.isDetailsIcon, emptyline:false, styleOption:'A' }


    const viewByMenu = [extraLargeIcon, largeIcon, mediumIcon, smallIcon, detailsIcon];

    return viewByMenu;
  }

  buildSortByMenu(): NestedMenuItem[]{

    const sortByName:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Name',  action: this.sortByNameM.bind(this),  variables:this.isSortByName , 
      emptyline:false, styleOption:'A' }

    const sortBySize:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Size',  action: this.sortBySizeM.bind(this),  variables:this.isSortBySize , 
      emptyline:false, styleOption:'A' }

    const sortByItemType:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Item type',  action: this.sortByItemTypeM.bind(this),  variables:this.isSortByItemType, 
      emptyline:false, styleOption:'A' }

    const sortByDateModified:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Date modified',  action: this.sortByDateModifiedM.bind(this),  variables:this.isSortByDateModified, 
      emptyline:false, styleOption:'A' }

    const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified ]

    return sortByMenu;
  }

  buildNewMenu(): NestedMenuItem[]{
    const newFolder:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action:()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const textEditor:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}text_editor.png`, label:'Rich Text',  action:()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const sortByMenu = [newFolder, textEditor ]

    return sortByMenu;
  }

  getFileExplorerMenuData():void{
    this.fileExplrMenu = [
          {icon1:Constants.EMPTY_STRING,  icon2: `${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'View', nest:this.buildViewMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftViewSubMenu.bind(this), emptyline:false},
          {icon1:Constants.EMPTY_STRING,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'Sort by', nest:this.buildSortByMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: 'Refresh', nest:[], action:() => this.refresh(), action1: ()=> Constants.EMPTY_STRING, emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: 'Paste', nest:[], action: this.onPaste.bind(this), action1: ()=> Constants.EMPTY_STRING, emptyline:false},
          {icon1:`${Constants.IMAGE_BASE_PATH}terminal.png`, icon2:Constants.EMPTY_STRING, label:'Open in Terminal', nest:[], action: () => console.log('Open Terminal'), action1: ()=> Constants.EMPTY_STRING, emptyline:false},
          {icon1:`${Constants.IMAGE_BASE_PATH}vs_code.png`, icon2:Constants.EMPTY_STRING, label:'Open with Code', nest:[], action: () => console.log('Open CodeEditor'), action1: ()=> Constants.EMPTY_STRING, emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'New', nest:this.buildNewMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftNewSubMenu.bind(this), emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label:'Properties', nest:[], action: () => console.log('Properties'), action1: ()=> Constants.EMPTY_STRING, emptyline:false}
    ]
  }

  handleIconHighLightState():void{
    this.hideShowFileSizeAndUnit();

    //First case - I'm clicking only on the folder icons
    if((this.getIsBtnClickEvt() && this.btnClickCnt >= 1) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt === 0)){  
      
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= 0)
          this.setBtnStyle(this.selectedElementId, false);
      }
      if(!this.isRenameActive){
        this.btnClickCnt = 0;
        this.setIsBtnClickEvt(false, 'handleIconHighLightState');

        if(!this.areMultipleIconsHighlighted){
          console.log('First Case Triggered:', this.areMultipleIconsHighlighted);
          this.btnStyleAndValuesChange();
        }
      }
    }else{
      this.hideCntxtMenuEvtCnt++;
      this.isHideCntxtMenuEvt = true;
      //Second case - I was only clicking on an empty space in the folder
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= 1) && (!this.getIsBtnClickEvt() && this.btnClickCnt === 0)){
        this.isIconInFocusDueToCurrentAction = false;
        this.blankSpaceClickCntr++;

        if(!this.areMultipleIconsHighlighted){
          console.log('Second Case Triggered:', this.areMultipleIconsHighlighted);
          this.btnStyleAndValuesChange();
        }

        //reset after clicking on the folder 2wice
        if(this.blankSpaceClickCntr >= 1 && !this.areMultipleIconsHighlighted){
          this.blankSpaceClickCntr = 0;
        }else if(this.blankSpaceClickCntr >= 2 && this.areMultipleIconsHighlighted){
          console.log('turn off - fileExplr areMultipleIconsHighlighted-1')
  
          this.removeClassAndStyleFromBtn();
          this.btnStyleAndValuesChange();

          this.markedBtnIds = [];
          this.areMultipleIconsHighlighted = false;
          this.blankSpaceClickCntr = 0;
        }
      }
    }
  }

  doBtnClickThings(id:number):void{
    this.isIconInFocusDueToCurrentAction = true;
    this.isIconInFocusDueToPriorAction = false;
    this.prevSelectedElementId = this.selectedElementId 
    this.selectedElementId = id;

    this.setIsBtnClickEvt(true, 'doBtnClickThings');
    this.btnClickCnt++;
    this.isHideCntxtMenuEvt = false;
    this.hideCntxtMenuEvtCnt = 0;
   
    if(this.prevSelectedElementId !== id){
      this.removeBtnStyle(this.prevSelectedElementId);
    }
  }

  setBtnStyle(id:number, isMouseHover:boolean, btnElementInput?:HTMLElement):void{
    const btnElement = (btnElementInput)? btnElementInput : document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
    //const figCapElement = document.getElementById(`figCapElmnt-${this.processId}-${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = '#4c4c4c';
      btnElement.style.border = '0.5px solid #3c3c3c';

      if(this.selectedElementId === id){

        if(isMouseHover && this.isIconInFocusDueToCurrentAction){
          btnElement.style.backgroundColor ='#787474'
        }

        if(!isMouseHover && this.isIconInFocusDueToCurrentAction){
          btnElement.style.backgroundColor ='#787474'
        }

        if(isMouseHover && this.isIconInFocusDueToPriorAction){
          btnElement.style.backgroundColor = '#4c4c4c';
        }

        if(!isMouseHover && this.isIconInFocusDueToPriorAction){
          btnElement.style.backgroundColor = Constants.EMPTY_STRING;
          btnElement.style.border = '0.5px solid white'
        }
      }
    }

    // if(figCapElement){
    //   if(this.selectedElementId === id){
    //       figCapElement.style.overflow = 'unset'; 
    //       figCapElement.style.overflowWrap = 'break-word';
    //       figCapElement.style.webkitLineClamp = '2';
    //   }
    // }
  }

  btnStyleAndValuesReset():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesReset');
    this.btnClickCnt = 0;
    this.removeBtnStyle(this.selectedElementId);
    this.removeBtnStyle(this.prevSelectedElementId);
    this.selectedElementId = -1;
    this.prevSelectedElementId = -1;
    this.btnClickCnt = 0;
    this.isIconInFocusDueToPriorAction = false;
  }

  btnStyleAndValuesChange():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesChange');
    this.btnClickCnt = 0;
    this.prevSelectedElementId = this.selectedElementId;
    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
    this.setBtnStyle(this.selectedElementId, false);
    //this.removeBtnStyle(this.prevSelectedElementId);
  }
  
  removeBtnStyle(id:number, btnElementInput?:HTMLElement):void{
    const btnElement = (btnElementInput)? btnElementInput : document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
    //const figCapElement = document.getElementById(`figCapElmnt-${this.processId}-${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.border = '0.5px solid transparent'
    }

    // if(figCapElement){
    //   figCapElement.style.overflow = 'hidden'; 
    //   figCapElement.style.overflowWrap = 'unset'
    //   figCapElement.style.webkitLineClamp = '3';
    // }
  }

  activateMultiSelect(evt:MouseEvent):void{
    this.fileExplorerBoundedRect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    if(this.isMultiSelectEnabled){    
      this.isMultiSelectActive = true;
      this.multiSelectElmnt = document.getElementById('fileExplrMultiSelectPane') as HTMLDivElement;
      this.multiSelectStartingPosition = evt;
    }
    evt.stopPropagation();
  }
  
  deActivateMultiSelect():void{ 
    if(this.multiSelectElmnt){
      this.setDivWithAndSize(this.multiSelectElmnt, 0, 0, 0, 0, false);
    }

    this.multiSelectElmnt = null;
    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    const markedBtnCount = this.getCountOfAllTheMarkedButtons();
    if(markedBtnCount === 0)
      this.areMultipleIconsHighlighted = false;
    else{
      this.areMultipleIconsHighlighted = true;
      this.getIDsOfAllTheMarkedButtons();
    }
    this.getSelectFileSizeSumAndUnit();
  }

  updateDivWithAndSize(evt:MouseEvent):void{

    if(!this.isMultiSelectEnabled) return;

    const rect = this.fileExplorerBoundedRect;
    
    if(this.multiSelectStartingPosition && this.multiSelectElmnt){
      const startingXPoint = this.multiSelectStartingPosition.clientX - rect.left;
      const startingYPoint = this.multiSelectStartingPosition.clientY - rect.top;

      const currentXPoint = evt.clientX - rect.left;
      const currentYPoint = evt.clientY - rect.top;

      const startX = Math.min(startingXPoint, currentXPoint);
      const startY = Math.min(startingYPoint, currentYPoint);
      const divWidth = Math.abs(startingXPoint - currentXPoint);
      const divHeight = Math.abs(startingYPoint - currentYPoint);

      this.setDivWithAndSize(this.multiSelectElmnt, startX, startY, divWidth, divHeight, true);

      // Call function to check and highlight selected items
      this.highlightSelectedItems(startX, startY, divWidth, divHeight);
    }

     evt.stopPropagation();
  }

  setDivWithAndSize(divElmnt:HTMLDivElement, initX:number, initY:number, width:number, height:number, isShow:boolean):void{

    divElmnt.style.position = 'absolute';
    divElmnt.style.transform =  `translate(${initX}px , ${initY}px)`;
    divElmnt.style.height =  `${height}px`;
    divElmnt.style.width =  `${width}px`;

    divElmnt.style.backgroundColor = 'rgba(4, 124, 212, 0.2)';
    divElmnt.style.border = '1px solid #047cd4';
    divElmnt.style.backdropFilter = 'blur(5px)';
    if(isShow){
      divElmnt.style.zIndex = '2';
      divElmnt.style.display =  'block';
    }else{
      divElmnt.style.zIndex = '0';
      divElmnt.style.display =  'none';
    }
  }
  
  highlightSelectedItems(initX: number, initY: number, width: number, height: number): void {
    const rect = this.fileExplorerBoundedRect;
    const selectionRect = {
        left: initX + rect.left,
        top: initY + rect.top,
        right: initX + rect.left + width,
        bottom: initY + rect.top + height
    };

    const btnIcons = document.querySelectorAll('.iconview-button');
    btnIcons.forEach((btnIcon) => {
        const btnIconRect = btnIcon.getBoundingClientRect();
        const id = btnIcon.id.replace(`btnElmnt-${this.processId}-`, Constants.EMPTY_STRING);

        // Check if the item is inside the selection area
        if ( btnIconRect.right > selectionRect.left && btnIconRect.left < selectionRect.right &&
            btnIconRect.bottom > selectionRect.top && btnIconRect.top < selectionRect.bottom){

            //remove any previous style
            if(Number(id) === this.selectedElementId){
              this.removeBtnStyle(this.selectedElementId);
              this.removeBtnStyle(this.prevSelectedElementId);
            }
            btnIcon.classList.add('fileexplr-multi-select-highlight'); 
        } else {
            btnIcon.classList.remove('fileexplr-multi-select-highlight');
        }
    });
  }
  
  getCountOfAllTheMarkedButtons():number{
    const btnIcons = document.querySelectorAll('.fileexplr-multi-select-highlight');
    return btnIcons.length;
  }
  
  getIDsOfAllTheMarkedButtons():void{
    const btnIcons = document.querySelectorAll('.fileexplr-multi-select-highlight');
    btnIcons.forEach(btnIcon => {
      const btnId = btnIcon.id.replace(`btnElmnt-${this.processId}-`, Constants.EMPTY_STRING);
      if(!this.markedBtnIds.includes(btnId))
        this.markedBtnIds.push(btnId);
    });
  }
  
  getSelectFileSizeSumAndUnit():void{
    let sum = 0;

    if(this.markedBtnIds.length > 0){
      for(const id of this.markedBtnIds){
        const file = this.fetchedFiles[Number(id)];
        if(file.getIsFile){
          sum += sum + file.getSizeInBytes;
        }else{
          this.hideShowFileSizeAndUnit();
          return;
        }
      }

      this.selectFilesSizeSum = String(CommonFunctions.getReadableFileSizeValue(sum));
      this.selectFilesSizeUnit = CommonFunctions.getFileSizeUnit(sum);
    }

    if(this.getIsBtnClickEvt()){
      console.log('isBtnClickEvt:', this.getIsBtnClickEvt());
      const file = this.fetchedFiles[this.selectedElementId];
      if(file && file.getIsFile){
        this.showFileSizeAndUnit = true;
        this.selectFilesSizeSum = String(file.getSize);
        this.selectFilesSizeUnit = file.getFileSizeUnit
      }else{
        this.hideShowFileSizeAndUnit();
      }
    }
  }

  private hideShowFileSizeAndUnit():void{
    this.showFileSizeAndUnit = false;
    this.selectFilesSizeSum = Constants.EMPTY_STRING;
    this.selectFilesSizeUnit = Constants.EMPTY_STRING;
  }

  removeClassAndStyleFromBtn():void{
    this.markedBtnIds.forEach(id =>{
      const btnIcon = document.getElementById(`btnElmnt-${this.processId}-${id}`);
      if(btnIcon){
        btnIcon.classList.remove('fileexplr-multi-select-highlight');
      }
      this.removeBtnStyle(Number(id));
    })
  }

  enableDisableMultSelect(evt:string){
    const MouseEnter = 'mouseenter';
    const MouseLeave = 'mouseleave';

    if(evt === MouseEnter){
      if(!this.isMultiSelectActive)
          this.isMultiSelectEnabled = false;
    }else if(evt === MouseLeave){
          this.isMultiSelectEnabled = true;
    }
  }

  async onZip(): Promise<void>{
    const srcPath = this.selectedFile.getCurrentPath;
    const isDir = !this.selectedFile.getIsFile;
    const delay = 50; //50ms

    const result = await this._fileService.zipEntityAsync(srcPath, isDir);
    if(result){
      await CommonFunctions.sleep(delay);
      this.refresh();
    }
  }

  async onMountZipFile(): Promise<void>{
    const srcPath = this.selectedFile.getCurrentPath;
    const delay = 50; //50ms

    const result = await this._fileService.mountZipAsync(srcPath);
    if(result){
      await CommonFunctions.sleep(delay);
      this.refresh();
    }
  }

  onCopy():void{
    const action = MenuAction.COPY;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  onCut():void{
    const action = MenuAction.CUT;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  async onPaste():Promise<void>{
    const cntntPath = this._menuService.getPath();
    const action = this._menuService.getActions();
    const delay = 50; //50ms

    // console.log(`path: ${cntntPath}`);
    // console.log(`action: ${action}`);
    //onPaste will be modified to handle cases such as multiselect, file or folder or both

    if(action === MenuAction.COPY){
      const result = await this._fileService.copyAsync(cntntPath, this.directory);
      if(result){
          await CommonFunctions.sleep(delay);
          this.refresh();
      }
    }
    else if(action === MenuAction.CUT){
      const result = await this._fileService.moveAsync(cntntPath, this.directory);
      if(result){
        if(cntntPath.includes(Constants.DESKTOP_PATH)){
          this._fileService.addEventOriginator(Constants.DESKTOP);
          this._fileService.dirFilesUpdateNotify.next();

          await CommonFunctions.sleep(delay);
          this.refresh();
        }else{
          await CommonFunctions.sleep(delay);
          await this.refresh();
        }
      }
    }
  }

  async onRestore():Promise<void>{
    const delay0 = 100;
    const delay = 250;
    const srcPath = this.selectedFile.getCurrentPath;
    const originPath = this._fileService.getFolderOrigin(srcPath);
    const destPath = dirname(originPath);
    const result = await this._fileService.moveAsync(srcPath, destPath, this.selectedFile.getIsFile, true);
    if(result){
      await CommonFunctions.sleep(delay0);
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();

      await CommonFunctions.sleep(delay);
      this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
      this._fileService.dirFilesUpdateNotify.next();
    }
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    event.stopPropagation();
  
    const dragInfo = this._systemNotificationService.getDragEventInfo();
    if(dragInfo){ //&& (dragInfo.Origin.includes(Constants.FILE_EXPLORER) || dragInfo.Origin.includes(Constants.DESKTOP_PATH))
      const files = this._fileService.getDragAndDropFile();
      if (!files?.length) return;

      const delay = 50; //50ms
      const destPath = this.directory;
      const moveResults:Promise<boolean>[] = [];

      // Move all files concurrently
      for (const file of files) {
        const srcPath = file.getCurrentPath;
        moveResults.push(
          this._fileService.moveAsync(srcPath, destPath, file.getIsFile)
        );
      }

      // Wait for all moves to complete
      const results = await Promise.all(moveResults);
      //const allSucceeded = moveResults.every(value => value === true);
      const allSucceeded = results.every(Boolean);

      if(!allSucceeded){
        console.error('One or more move operations failed');
        return;
      }

      const cameFromFileExplr = files.some(f => !f.getCurrentPath.includes(Constants.DESKTOP_PATH));
      if(cameFromFileExplr){
        this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
        this._fileService.dirFilesUpdateNotify.next();
        await CommonFunctions.sleep(delay)
      }

      this._systemNotificationService.removeDragEventInfo();
      await this.refresh();
      return;
    }

    if(!CommonFunctions.conditionalDrop(event) && this.isDragFromFileExplorerActive) {
      console.warn('Drop failed due to condition.');
      return;
    }else{
      const droppedFiles:File[] = [];
      const files = event.dataTransfer?.files;
      if(files && files.length > 0){
        droppedFiles.push(...files);
      }
      
      if(droppedFiles.length >= 1){
        const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
        if(result){
          await this.refresh();
        }
      }
    }
  }

  onDragStart(evt:any):void{
    this.isDragFromFileExplorerActive = true;
    const uId = `${this.name}-${this.processId}`;

    const dragEvtInfo:DragEventInfo={origin:uId, currentLocation:Constants.EMPTY_STRING, isDragActive: this.isDragFromFileExplorerActive};
    this._systemNotificationService.setDropEventInfo(dragEvtInfo);
  }

  onDragEnd(evt:any):void{
    this.isDragFromFileExplorerActive = false;
  }

  async showFileExplorerToolTip(evt: MouseEvent, file: FileInfo, rectInput?:DOMRect, isFileSection?:boolean): Promise<void> {
    if (this.currentViewOption === ViewOptions.CONTENT_VIEW) return;

    const rect:DOMRect = (rectInput)
    ? rectInput 
    : this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();

    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    let infoTip:HTMLDivElement|null = null;
    if(rectInput){
      infoTip = (isFileSection)
        ? document.getElementById(`fx-information-tip-qa-files-${this.processId}`) as HTMLDivElement 
        : document.getElementById(`fx-information-tip-qa-folder-${this.processId}`) as HTMLDivElement;
    }else{
      infoTip =  document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    }
    if (!infoTip) return;

    //this.fileInfoTipData = [];
    this.currentTooltipFileId = file.getCurrentPath;
    await this.setInformationTipInfo(file);

    if (this.fileInfoTipData.length === 0) return;

    requestAnimationFrame(() => {
      const offsetX = this.currentViewOption === ViewOptions.DETAILS_VIEW ? -25 : -15;
      const offsetY = this.currentViewOption === ViewOptions.DETAILS_VIEW ? -50 : 10;
      if(rectInput){
        infoTip.style.transform =`translate(${x + -30}px, ${y + 2}px)`;
      }else{
        infoTip.style.transform = `translate(${x + offsetX}px, ${y + offsetY}px)`;
      }
      infoTip.classList.add('visible');
    });
  }

  hideFileExplorerToolTip():void {
    this.currentTooltipFileId = Constants.EMPTY_STRING;
    this.fileInfoTipData = [];

    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    const infoTip1 = document.getElementById(`fx-information-tip-qa-files-${this.processId}`) as HTMLDivElement;
    const infoTip2 = document.getElementById(`fx-information-tip-qa-folder-${this.processId}`) as HTMLDivElement;
    
    if (infoTip) {
      infoTip.classList.remove('visible');
    }

    if (infoTip1) {
      infoTip1.classList.remove('visible');
    }

    if (infoTip2) {
      infoTip2.classList.remove('visible');
    }
  }

  async setInformationTipInfo(file:FileInfo):Promise<void>{
    const infoTipFields = ['Author:', 'Item type:','Date created:','Date modified:', 'Dimesions:', 'General', 'Size:','Type:', 'Original location:'];
    const specialFolders: Record<string, string> = {
      'Music': 'Contains music and other audio files',
      'Videos': 'Contains movies and other video files',
      'Pictures': 'Contains digital photos, images and graphic files'
    };
    const standardFolders = ['3D-Objects', 'Documents', 'Downloads', 'Desktop', 'Games'];
   
    const fileAuthor = 'Relampago Del Catatumbo';
    const fileType = file.getFileType;
    const fileDateModified = file.getDateModifiedUS;
    const fileSize = `${String(file.getSize)}  ${file.getFileSizeUnit}`;
    const fileName = file.getFileName;
    const isFile = file.getIsFile;
    const currentPath = dirname(file.getCurrentPath);
    const isRoot = currentPath === Constants.ROOT;
    const localFileId = file.getCurrentPath;

    let isFolder = fileType === Constants.FOLDER;

    //reset
    this.fileInfoTipData = [];

    //Special Cases
    //Normally, IsFile & IsFolder can't both be true at the same time, expect in a few cases like fileexplorer.url, music.url etc...
    //This is a condition that wayback when, i didn't foresee coming to bite me in the rear.
    if(isFile && isFolder){ isFolder = false; }


    if (Constants.IMAGE_FILE_EXTENSIONS.includes(file.getFileType)) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.src = file.getContentPath;
        img.onload = () => {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          const imgDimensions = `${width} x ${height}`;

          this.fileInfoTipData.push({
            label: infoTipFields[1],
            data: `${file.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING).toLocaleUpperCase()} File`
          });
          
          this.fileInfoTipData.push({ label: infoTipFields[4], data: imgDimensions });
          this.fileInfoTipData.push({ label: infoTipFields[6], data: fileSize });

          resolve();
        };
        img.onerror = (err) => {
          console.error("Failed to load image", err);
          resolve(); // Still resolve to prevent blocking
        };
      });
    }else if(isFile && !isFolder){
      const fileTypeName = (fileType !== Constants.FOLDER)? this.getFileTypeName(fileType) : this.getFileTypeName(Constants.URL);
      this.fileInfoTipData.push({label:infoTipFields[7], data:fileTypeName});
      this.fileInfoTipData.push({label:infoTipFields[3], data: fileDateModified });
      this.fileInfoTipData.push({ label: infoTipFields[6], data: fileSize });
    }
    else if(isFolder){
      if(isRoot && (standardFolders.includes(fileName))){
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified });
      }else if((isRoot && specialFolders[fileName])){
        this.fileInfoTipData.push({label:Constants.EMPTY_STRING, data:specialFolders[fileName]})
      }else{
        this.fileInfoTipData.push({label:infoTipFields[7], data:fileType });
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified });

        const folderSizeInBytes = await this._fileService.getFolderSizeAsync(file.getCurrentPath);
        if (this.currentTooltipFileId !== localFileId) {
          // User has hovered over a different file before this resolved
          return;
        }
        const folderSize = CommonFunctions.getReadableFileSizeValue(folderSizeInBytes);
        const folderUnit = CommonFunctions.getFileSizeUnit(folderSizeInBytes);
        const sizeLabelExists = this.fileInfoTipData.some(x => x.label === infoTipFields[6]);
        if (!sizeLabelExists) {
          this.fileInfoTipData.push({label:infoTipFields[6], data:`${String(folderSize)} ${folderUnit}`});
        }


        if(this.isRecycleBinFolder){
          const originalLocation = this._fileService.getFolderOrigin(file.getCurrentPath);
          this.fileInfoTipData.push({label:infoTipFields[8], data:originalLocation });
        }
      }
    }
  }

  getFileTypeName(fileExt:string):string{
    for(const map of Constants.FILE_EXTENSION_MAP){
      if(map[0] === fileExt) {
         return map[1];
      }
    }

    return 'Unknown File';
  }

  showInvalidCharsToolTip():void{
    // get the position of the textbox
    const invalidCharElmt = document.getElementById(`invalidChars-${this.processId}`) as HTMLElement;
    const renameFormElmnt= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;

    if(!invalidCharElmt || !renameFormElmnt)return;

    const fileRect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const rect = renameFormElmnt.getBoundingClientRect();

    const x = rect.left - fileRect.left;
    const y = rect.top - fileRect.top ;

    this.isShowFileNameWarning = true;
    invalidCharElmt.style.transform =`translate(${x + 2}px, ${y + 2}px)`;
  }

  hideInvalidCharsToolTip():void{
    this.isShowFileNameWarning = false;
  }

  onInputChange():void{
    const SearchTxtBox = document.getElementById(`searchTxtBox-${this.processId}`) as HTMLInputElement;
    const charLength = SearchTxtBox.value.length
    if( charLength > 0){
      this.isSearchBoxNotEmpty = true;
    }else if( charLength <= 0){
      this.isSearchBoxNotEmpty = false;
    }

    this.resetSearchIconHiglight();
    this.resetClearSearchIconHiglight();
  }

  onClearSearchTextBox():void{
    const SearchTxtBox = document.getElementById(`searchTxtBox-${this.processId}`) as HTMLInputElement;
    SearchTxtBox.value = Constants.EMPTY_STRING;
    this.isSearchBoxNotEmpty = false;

    this.resetSearchIconHiglight();
    this.resetClearSearchIconHiglight();
  }

  handleClearSearchIconHighlights():void{
    this.onClearSearchIconHover = !this.onClearSearchIconHover;

    if(this.isSearchBoxNotEmpty){
      if(this.onClearSearchIconHover){
        this.clearSearchStyle = {
          'background-color': '#3f3e3e',
          'transition': 'background-color 0.3s ease'
        }
      }else if(!this.onClearSearchIconHover){
        this.clearSearchStyle = {
          'background-color': '#191919',
        }
      }
    }
  }

  resetClearSearchIconHiglight():void{
    this.clearSearchStyle = {
      'background-color': '#191919',
    }

    if(!this.isSearchBoxNotEmpty){
      this.onClearSearchIconHover = false;
    }
  }

  handleSearchIconHighlights():void{
    this.onSearchIconHover = !this.onSearchIconHover;

    if(this.isSearchBoxNotEmpty){
      if(this.onSearchIconHover){
        this.searchStyle = {
          'background-color': 'rgb(18, 107, 240)',
          'transition': 'background-color 0.3s ease'
        }
      }else if(!this.onSearchIconHover){
        this.searchStyle = {
          'background-color': 'blue',
        }
      }
    }
  }

  resetSearchIconHiglight():void{

    if(this.isSearchBoxNotEmpty){
      this.searchStyle = {
        'background-color': 'blue',
      }
    }else{
      this.searchStyle = {
        'background-color': '#191919',
      }

      this.onSearchIconHover = false;
    }
  }

  onSearch():void{
    const searchText = this.searchForm.value.searchInput as string;
  }

  isFormDirty(): void {
    if (this.renameForm.dirty == true){
        this.onRenameFileTxtBoxDataSave();
  
    }else if(this.renameForm.dirty == false){
      this.renameFileTriggerCnt ++;
      if(this.renameFileTriggerCnt > 1){
        this.onRenameFileTxtBoxHide();
        this.renameFileTriggerCnt = 0;
      }
    }
  }

  showSearchHistory(evt:MouseEvent):void{
    this.focusWindow();

    const searchHistoryElement = document.getElementById(`searchHistory-${this.processId}`) as HTMLElement;
    if(searchHistoryElement){
      if(this.searchHistory.length > 0){
        searchHistoryElement.style.display = 'block';
      }
    }

    evt.stopPropagation();
  }

  hideSearchHistory():void{
    const searchHistoryElement = document.getElementById(`searchHistory-${this.processId}`) as HTMLElement;
    searchHistoryElement.style.display = 'none';
  }

  hideshowPathHistory():void{
    const pathHistoryElement = document.getElementById(`pathHistory-${this.processId}`) as HTMLElement;
    const hdrNavPathCntnrElement =  document.getElementById(`hdrNavPathCntnr-${this.processId}`) as HTMLElement; 
    const minus24 = hdrNavPathCntnrElement.offsetWidth - 25;

    this.showPathHistory = !this.showPathHistory;

    if(this.showPathHistory){
      if(pathHistoryElement){
        if(this.pathHistory.length > 0){
          pathHistoryElement.style.display = 'block';
          pathHistoryElement.style.width = `${minus24}px`;
        }
      }
    }else if(!this.showPathHistory){
      pathHistoryElement.style.display = 'none';
    }
  }
  
  hidePathHistory():void{
    const pathHistoryElement = document.getElementById(`pathHistory-${this.processId}`) as HTMLElement;
    pathHistoryElement.style.display = 'none';
    this.showPathHistory = false;
  }

  checkAndSetIfRecycleBin():void{
    if(this.directory === Constants.RECYCLE_BIN_PATH){
      this.isRecycleBinFolder = true;
      this.icon  =  `${Constants.IMAGE_BASE_PATH}empty_bin.png`;
    }
  }

  async setProperRecycleBinIcon():Promise<void>{
    if(this.directory !== Constants.RECYCLE_BIN_PATH) return;

    const count = await this._fileService.countFolderItems(Constants.RECYCLE_BIN_PATH);
    this.icon = (count === 0) 
      ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
      : `${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
  }

  onFileExplrCntntClick():void{
    this.hidePathTextBox();
  }

  /**
   * loadFiles by default, when the path is root, will only fetch url files
   * @param showOnlyUrlFiles 
   */
  private async loadFiles(showOnlyUrlFiles=true):Promise<void>{
    this.fetchedFiles = [];
    const directoryFiles  = await this._fileService.loadDirectoryFiles(this.directory);

    if(this.directory === Constants.ROOT){
      if(!showOnlyUrlFiles){
        this.fetchedFiles.push(...directoryFiles.filter(x => x.getFileExtension !== Constants.URL))
      }else{
        this.fetchedFiles.push(...directoryFiles.filter(x => x.getFileExtension === Constants.URL));
      }
    }else{
      this.fetchedFiles.push(...directoryFiles.filter(x => x.getCurrentPath !== Constants.RECYCLE_BIN_PATH)); 
    }

    //console.log('Fetched files:', this.fetchedFiles);
  }

  async refresh(evt?:MouseEvent):Promise<void>{
    console.log('Refresh Called !!!!!!!')
    this.isIconInFocusDueToPriorAction = false;

    if(evt)
      evt.stopPropagation();

    await this.loadFiles();
  }

  async onDeleteFile():Promise<void>{
    const desktopRefreshDelay = 1000;
    let result = false;

    result = await this._fileService.deleteAsync(this.selectedFile.getCurrentPath, this.selectedFile.getIsFile);
    if(result){
      this._menuService.resetStoreData();
      await this.loadFiles();

      await CommonFunctions.sleep(desktopRefreshDelay)
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();
    }
  }

  onKeyPress(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_.\\s-]+$';
    if(evt.key === 'Enter'){
      evt.preventDefault(); // prevent newline in textarea
      this.isFormDirty(); // trigger form submit logic

      return true;
    }else{
      const res = new RegExp(regexStr).test(evt.key)
      if(res){
        this.hideInvalidCharsToolTip();
        this.autoResize();
        return res
      }else{
        this.showInvalidCharsToolTip();

        setTimeout(()=>{ // hide after 6 secs
          this.hideInvalidCharsToolTip();
        },this.SECONDS_DELAY[2]) 

        return res;
      }
    }
  }

  autoResize_old() {
    const renameTxtBoxElmt = document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLTextAreaElement;
    if(renameTxtBoxElmt){
      renameTxtBoxElmt.style.height = 'auto'; // Reset the height
      renameTxtBoxElmt.style.height = `${renameTxtBoxElmt.scrollHeight}px`; // Set new height
    }
  }
  autoResize() {
    const renameTxtBoxElmt = document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLTextAreaElement;

    if (renameTxtBoxElmt) {
      const cursorPosition = renameTxtBoxElmt.selectionStart;
      const textValue = renameTxtBoxElmt.value;
      const lines = textValue.substring(0, cursorPosition).split(Constants.NEW_LINE);
      const currentLineNumber = lines.length;

      if (currentLineNumber > 1) {
        const currentHeight = renameTxtBoxElmt.clientHeight;
        renameTxtBoxElmt.style.height = `${currentHeight * 2}px`;
      } else {
        renameTxtBoxElmt.style.height = 'auto';
      }
    }
  }

  onRenameFileTxtBoxShow():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElement= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;

    if((figCapElement && renameContainerElement && renameTxtBoxElement)) {
      figCapElement.style.display = 'none';
      renameContainerElement.style.display = 'block';
      
      renameTxtBoxElement.style.display = 'block';
      renameTxtBoxElement.style.zIndex = '3'; // ensure it's on top

      this.currentIconName = this.selectedFile.getFileName;
      this.renameForm.setValue({
        renameInput: this.currentIconName
      });

      renameTxtBoxElement.focus();
      renameTxtBoxElement.select();
    }
  }

  async onRenameFileTxtBoxDataSave():Promise<void>{ //##
    this.isRenameActive = !this.isRenameActive;
    const isRename = true;

    const figCapElmnt= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameFormElmnt= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElmnt= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;
    const renameText = this.renameForm.value.renameInput as string;
    const oldFileName = this.selectedFile.getFileName;

    if(renameText !== Constants.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName){

      const renameResult = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText,  this.selectedFile.getIsFile);
      if(renameResult){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        //const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getContentPath) && (f.getFileName == this.selectedFile.getFileName));
        const fileIdx = this.fetchedFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getCurrentPath) && (f.getFileName == this.selectedFile.getFileName));
        this.selectedFile.setContentPath = renameText;
        this.selectedFile.setCurrentPath = `${dirname(this.selectedFile.getCurrentPath)}/${renameText}`;
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now().toString();
        this.fetchedFiles[fileIdx] = this.selectedFile;


        this.renameForm.reset();
        this._menuService.resetStoreData();
        //await this.loadFiles();
        const activity = CommonFunctions.getTrackingActivity(ActivityType.FILE, renameText, this.selectedFile.getCurrentPath, oldFileName, isRename);
        CommonFunctions.trackActivity(this._activityHistoryService, activity);
      }
    }else{
      this.renameForm.reset();
    }

    this.setBtnStyle(this.selectedElementId, false);
    this.renameFileTriggerCnt = 0;

    if(figCapElmnt && renameFormElmnt && renameTxtBoxElmnt){
      figCapElmnt.style.display = 'block';
      renameFormElmnt.style.display = 'none';
      renameTxtBoxElmnt.style.display = 'none';
    }
  }

  onRenameFileTxtBoxHide():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElmnt= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameFormElmnt= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElmnt= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;

    if(figCapElmnt && renameFormElmnt && renameTxtBoxElmnt){
      figCapElmnt.style.display = 'block';
      renameFormElmnt.style.display = 'none';
      renameTxtBoxElmnt.style.display = 'none';
    }

    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
  }

  sortByNameM():void{
    this.sortBy(this.sortByName)
  }

  sortBySizeM():void{
    this.sortBy(this.sortBySize)
  }
  sortByItemTypeM():void{
    this.sortBy(this.sortByItemType)
  }
  sortByDateModifiedM():void{
    this.sortBy(this.sortByDateModified)
  }

  sortBy(sortBy:string):void{

    if(sortBy === SortBys.DATE_MODIFIED){
      this.isSortByDateModified = true;
      this.isSortByItemType = false;
      this.isSortByName = false;
      this.isSortBySize = false;
    }

    if(sortBy === SortBys.ITEM_TYPE){
      this.isSortByItemType = true;
      this.isSortByDateModified = false;
      this.isSortByName = false;
      this.isSortBySize = false;
    }

    if(sortBy === SortBys.SIZE){
      this.isSortBySize  = true;
      this.isSortByItemType = false;
      this.isSortByName = false;
      this.isSortByDateModified = false;
    }

    if(sortBy === SortBys.NAME){
      this.isSortByName  = true;
      this.isSortByItemType = false;
      this.isSortByDateModified = false;
      this.isSortBySize = false;
    }

    this.sortIcons(sortBy);
    this.getFileExplorerMenuData();
  }

  sortIcons(sortBy:string):void {
    this.fetchedFiles = CommonFunctions.sortIconsBy(this.fetchedFiles, sortBy);
  }

  //Methods defined as class fields, you learn somthing new every day.
  private showExtraLargeIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isExtraLargeIcon = true;
    this.onMenuSelectLayout(ViewOptions.EXTRA_LARGE_ICON_VIEW);
  }

  private showLargeIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isLargeIcon = true;
    this.onMenuSelectLayout(ViewOptions.LARGE_ICON_VIEW);
  }

  private showMediumIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isMediumIcon = true;
    this.onMenuSelectLayout(ViewOptions.MEDIUM_ICON_VIEW);
  }

  private showSmallIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isSmallIcon = true;
    this.onMenuSelectLayout(ViewOptions.SMALL_ICON_VIEW);
  }

  private showDetailsIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isDetailsIcon = true;
    this.onMenuSelectLayout(ViewOptions.DETAILS_VIEW);
  }

  onMenuSelectLayout(inputViewOption:ViewOptions):void{
    this.changeLayoutCss( inputViewOption);
    this.changeOrderedlistStyle( inputViewOption );
    this.changeIconViewBtnSize( inputViewOption);
  }
  

  setViewFlagsToFalse():void{
    this.isExtraLargeIcon = false;
    this.isLargeIcon = false;
    this.isMediumIcon = false;
    this.isSmallIcon = false;
    this.isDetailsIcon = false;
  }

  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    const directory = this.directory;
    const fileContent = this.generateShortcuContent(selectedFile);
    shortCut.setContentPath = fileContent;

    if(directory === Constants.ROOT){
      const title = 'Shortcut';
      const msg = `Cheetah can't create a shortcut here.
Do you want the shortcut to be placed on the desktop instead?`;

      const uId = `${this.name}-${this.processId}`;
      const confirm = await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.Warning,  undefined, uId);
      const createOnDesktop = true;
      if(confirm)
        await this.createShortCutHelper(shortCut, selectedFile.getFileName, createOnDesktop);
    }
    else
      await this.createShortCutHelper(shortCut, selectedFile.getFileName);
  }

  generateShortcuContent(file:FileInfo):string{
    let fileContent = Constants.EMPTY_STRING;
    const shortCut = ` - ${Constants.SHORTCUT}`;

    fileContent = `[InternetShortcut]
FileName=${file.getFileName}${shortCut}
IconPath=${file.getIconPath}
FileType=${file.getFileType}
ContentPath=${(file.getIsFile)? file.getContentPath : file.getCurrentPath}
OpensWith=${file.getOpensWith}
`;
    return fileContent;
  }

  async createShortCutHelper(shortCut:FileInfo, fileName:string, createOnDesktop:boolean = false):Promise<void>{
    let result = false;
    shortCut.setFileName= `${fileName} - ${Constants.SHORTCUT}${Constants.URL}`;
  
    if(createOnDesktop){
      result = await this._fileService.writeFileAsync(Constants.DESKTOP_PATH, shortCut);
      if(result){
        this._fileService.addEventOriginator(Constants.DESKTOP);
        this._fileService.dirFilesUpdateNotify.next();
      }
    }
    else{ 
      result = await this._fileService.writeFileAsync(this.directory, shortCut);
      if(result)
        await this.loadFiles();
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}
