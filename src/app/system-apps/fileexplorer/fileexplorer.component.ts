import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileInfo } from 'src/app/system-files/file.info';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { Subscription } from 'rxjs';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { FileManagerService } from 'src/app/shared/system-service/file.manager.services';
import { FormGroup, FormBuilder } from '@angular/forms';
import { ViewOptions } from './fileexplorer.enums';
import {basename} from 'path';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { GeneralMenu, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.item';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { SortBys } from '../desktop/desktop.enums';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';
import { NotificationService } from 'src/app/shared/system-service/notification.service';

@Component({
  selector: 'cos-fileexplorer',
  templateUrl: './fileexplorer.component.html',
  styleUrls: ['./fileexplorer.component.css'],
  encapsulation: ViewEncapsulation.None,
})

export class FileExplorerComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileExplorerMainContainer', {static: true}) fileExplrMainCntnr!: ElementRef; 
  @ViewChild('fileExplorerRootContainer', {static: true}) fileExplorerRootContainer!: ElementRef; 
  @ViewChild('fileExplorerContentContainer', {static: true}) fileExplrCntntCntnr!: ElementRef;
  @ViewChild('navExplorerContainer', {static: true}) navExplorerCntnr!: ElementRef; 
 
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;
  private _directoryFilesEntires!:FileEntry[];
  private _triggerProcessService:TriggerProcessService;
  private _stateManagmentService: StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _notificationService:NotificationService;
  private _menuService:MenuService;
  private _formBuilder;
  private _appState!:AppState;
  private _consts:Constants = new Constants();

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
  

  private isPrevBtnActive = false;
  private isNextBtnActive = false;
  private isUpBtnActive = true;
  private isNavigatedBefore = false;
  private isRenameActive = false;
  private isIconInFocusDueToCurrentAction = false;
  private isIconInFocusDueToPriorAction = false;
  private isBtnClickEvt= false;
  private isHideCntxtMenuEvt= false;
  private isShiftSubMenuLeft = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = -1;
  private prevSelectedElementId = -1; 
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private renameFileTriggerCnt = 0; 
  private currentIconName = this._consts.EMPTY_STRING;

  isSearchBoxNotEmpty = false;
  showPathHistory = false;
  onClearSearchIconHover = false;
  onSearchIconHover = false;
  showIconCntxtMenu = false;
  showFileExplrCntxtMenu = false;
  showInformationTip = false;
  iconCntxtCntr = 0;
  fileExplrCntxtCntr = 0;
  //hideInformationTip = false;

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
  olClassName = 'ol-icon-size-view';

  fileExplrFiles:FileInfo[] = [];
  fileTreeNode:FileTreeNode[] = [];
  _fileInfo!:FileInfo;
  prevPathEntries:string[] = [];
  nextPathEntries:string[] = [];
  recentPathEntries:string[] = [];
  upPathEntries:string[] = ['/Users/Desktop'];
  _directoryHops:string[] = ['This PC'];
  fileTreeHistory:string[] = [];
  SECONDS_DELAY:number[] = [100, 1500, 6000, 12000, 250];
  
  defaultviewOption = ViewOptions.MEDIUM_ICON_VIEW;
  currentViewOption = ViewOptions.MEDIUM_ICON_VIEW;
  currentViewOptionId = 3;
  
  readonly smallIconsView = ViewOptions.SMALL_ICON_VIEW;
  readonly mediumIconsView = ViewOptions.MEDIUM_ICON_VIEW;
  readonly largeIconsView = ViewOptions.LARGE_ICON_VIEW;
  readonly extraLargeIconsView = ViewOptions.EXTRA_LARGE_ICON_VIEW;
  readonly listView = ViewOptions.LIST_VIEW;
  readonly detailsView = ViewOptions.DETAILS_VIEW;
  readonly contentView = ViewOptions.CONTENT_VIEW;
  readonly tilesView = ViewOptions.TILES_VIEW;

  readonly sortByName = SortBys.NAME;
  readonly sortByItemType = SortBys.ITEM_TYPE;
  readonly sortBySize = SortBys.SIZE;
  readonly sortByDateModified = SortBys.DATE_MODIFIED;

  isExtraLargeIcon = false;
  isLargeIcon = false;
  isMediumIcon = true;
  isSmallIcon = false;
  isListIcon = false;
  isDetailsIcon = false;
  isContentIcon = false;
  isTitleIcon = false;

  isSortByName = false;
  isSortByItemType = false;
  isSortBySize = false;
  isSortByDateModified = false;

  showExpandTreeIcon = false;
  showNavigationPane = true;
  showPreviewPane = false;
  showDetailsPane = false;
  showRibbonMenu = false;

  renameForm!: FormGroup;
  pathForm!: FormGroup;
  searchForm!: FormGroup;

  searchHistory =['Java','ProgramFile', 'Perenne'];
  pathHistory =['/Users/Vidoes','/Users/Games', '/Users/Music'];

  sourceData:GeneralMenu[] = [
    {icon:this._consts.EMPTY_STRING, label: 'Open', action: this.onTriggerRunProcess.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Open in new window', action: this.doNothing.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Open in Terminal', action: this.doNothing.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Pin to Start', action: this.doNothing.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Cut', action: this.onCut.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Copy', action: this.onCopy.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Create shortcut', action: this.createShortCut.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Delete', action: this.onDeleteFile.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Rename', action: this.onRenameFileTxtBoxShow.bind(this) },
    {icon:this._consts.EMPTY_STRING, label: 'Properties', action: this.showPropertiesWindow.bind(this) }
  ];

  menuData:GeneralMenu[] = [];

  fileExplrMenu:NestedMenu[] = [];

  fileExplrMngrMenuOption = this._consts.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  fileExplrMenuOption = this._consts.NESTED_MENU_OPTION;
  menuOrder = '';

  fileInfoTipData = [{label:this._consts.EMPTY_STRING, data:this._consts.EMPTY_STRING}];

  fileType = this._consts.EMPTY_STRING;
  fileAuthor = this._consts.EMPTY_STRING;
  fileSize = this._consts.EMPTY_STRING;
  fileDimesions = this._consts.EMPTY_STRING;
  fileDateModified = this._consts.EMPTY_STRING;


  icon = `${this._consts.IMAGE_BASE_PATH}file_explorer.png`;
  navPathIcon = `${this._consts.IMAGE_BASE_PATH}this_pc.png`;
  name = 'fileexplorer';
  processId = 0;
  type = ComponentType.System;
  directory =this._consts.ROOT;
  displayName = 'fileexplorer';
  hasWindow = true;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService, triggerProcessService:TriggerProcessService, 
              fileManagerService:FileManagerService, formBuilder: FormBuilder, stateManagmentService:StateManagmentService, sessionManagmentService:SessionManagmentService,        
              menuService:MenuService, notificationService:NotificationService ) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileService = fileService;
    this._triggerProcessService = triggerProcessService;
    this._stateManagmentService = stateManagmentService;
    this._sessionManagmentService = sessionManagmentService;
    this._menuService = menuService;
    this._notificationService = notificationService;
    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
    this.retrievePastSessionData();

    this._dirFilesUpdatedSub = this._fileService.dirFilesUpdateNotify.subscribe(() =>{
      if(this._fileService.getEventOrginator() === this.name){
        this.loadFilesInfoAsync();
        this._fileService.removeEventOriginator();
      }
    });
    this._fetchDirectoryDataSub = this._fileService.fetchDirectoryDataNotify.subscribe((p) => {
      const name = 'filetreeview';
      const uid = `${name}-${this.processId}`;
      if(this._fileService.getEventOrginator() === uid){
        this.updateFileTreeAsync(p);
        this._fileService.removeEventOriginator();
      }
    })
    this._goToDirectoryDataSub = this._fileService.goToDirectoryNotify.subscribe((p) => {
      const name = 'filetreeview-1';
      const uid = `${name}-${this.processId}`;
      if(this._fileService.getEventOrginator() === uid){
        this.navigateToFolder(p);
        this._fileService.removeEventOriginator();
      }
    })

    this._maximizeWindowSub = this._runningProcessService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._runningProcessService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
    this._sortByNotifySub = fileManagerService.sortByNotify.subscribe((p)=>{this.sortIcons(p)});
    this._refreshNotifySub = fileManagerService.refreshNotify.subscribe(()=>{this.refreshIcons()});
    this._hideContextMenuSub = this._menuService.hideContextMenus.subscribe(() => { this.hideIconContextMenu()});
  }

  ngOnInit():void{
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();

    if(this._fileInfo){
      // is this a URL or and Actual Folder
      if(this._fileInfo.getOpensWith === 'fileexplorer' && !this._fileInfo.getIsFile){ //Actual Folder
        this.directory = this._fileInfo.getCurrentPath;
        const fileName = (this._fileInfo.getFileName === this._consts.EMPTY_STRING)? this._consts.NEW_FOLDER : this._fileInfo.getFileName;

        this.populateHopsList();
        this.setNavPathIcon(fileName, this._fileInfo.getCurrentPath);
        this.storeAppState(this._fileInfo.getCurrentPath);
      }
    }

    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: this._consts.EMPTY_STRING,
    });
    this.pathForm = this._formBuilder.nonNullable.group({
      pathInput: this._consts.EMPTY_STRING,
    });
    this.searchForm = this._formBuilder.nonNullable.group({
      searchInput: this._consts.EMPTY_STRING,
    });

    this.setNavButtonsColor();
    this.getFileExplorerMenuData();
  }

  async ngAfterViewInit():Promise<void>{

    this.setFileExplorerWindowToFocus(this.processId); 
    this.hidePathTextBoxOnload();
    this.changeFileExplorerLayoutCSS(this.currentViewOption);
    this.changeTabLayoutIconCntnrCSS(this.currentViewOptionId,false);

    this.pathForm.setValue({
      pathInput: (this.directory !== this._consts.ROOT)? this.directory : this._consts.ROOT
    })
  
    await this.loadFileTreeAsync();
    await this.loadFilesInfoAsync().then(()=>{
      setTimeout(()=>{
        this.captureComponentImg();
      },this.SECONDS_DELAY[4]) 
    });

  }

  ngOnDestroy(): void {
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
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.fileExplorerRootContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
  }
  
  colorTabLayoutContainer():void{
    this.tabLayoutCntnrStyle ={
      'background-color': '#403c3c'
    }
  }

  unColorTabLayoutContainer():void{
    this.tabLayoutCntnrStyle ={
      'background-color': this._consts.EMPTY_STRING
    }
  }

  onMouseEnterTabLayoutBtn(iconView:string, id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,true);
    this.changeFileExplorerLayoutCSS(iconView);
  }

  onMouseLeaveTabLayoutBtn(id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,false);
    this.changeFileExplorerLayoutCSS(this.defaultviewOption);
  }

  onClickTabLayoutBtn(iconView:any, id:number):void{
    this.currentViewOptionId = id;
    this.currentViewOption = iconView;
    this.defaultviewOption = iconView;

    this.changeTabLayoutIconCntnrCSS(id,true);

    for(let i = 1; i<=8; i++){
      if(i != id){
        this.changeTabLayoutIconCntnrCSS(i,false);
      }
    }
  }

  changeFileExplorerLayoutCSS(inputViewOption:any){
    if(inputViewOption == this.smallIconsView || inputViewOption == this.mediumIconsView ||inputViewOption == this.largeIconsView || inputViewOption== this.extraLargeIconsView){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
      this.changeButtonAndImageSize(inputViewOption);
    }

    if(inputViewOption == this.listView || inputViewOption == this.detailsView || inputViewOption == this.tilesView || inputViewOption == this.contentView){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
    }
  }

  changeTabLayoutIconCntnrCSS(id:number, isMouseHover:boolean){
    const btnElement = document.getElementById(`tabLayoutIconCntnr-${this.processId}-${id}`) as HTMLElement;
    if(this.currentViewOptionId == id){
      if(btnElement){
        btnElement.style.border = '0.5px solid #ccc';
        // btnElement.style.margin = '-0.5px';

        if(isMouseHover){
          btnElement.style.backgroundColor = '#807c7c';
        }else{
          btnElement.style.backgroundColor = '#605c5c';
        }
      }
    }

    if(this.currentViewOptionId != id){
      if(btnElement){
        if(isMouseHover){
          btnElement.style.backgroundColor = '#403c3c';
          btnElement.style.border = '0.5px solid #ccc';
          // btnElement.style.margin = '-0.5px';
        }else{
          btnElement.style.backgroundColor = this._consts.EMPTY_STRING;
          btnElement.style.border = this._consts.EMPTY_STRING;
          btnElement.style.margin = '0';
        }
      }    
    }
  }

  changeLayoutCss(iconSize:string):void{

    const layoutOptions:string[] = [this.smallIconsView,this.mediumIconsView,this.largeIconsView,this.extraLargeIconsView,
                              this.listView,this.detailsView,this.tilesView,this.contentView];
    const cssLayoutOptions:string[] = ['icon-view','list-view', 'details-view', 'tiles-view','content-view']
    const layoutIdx = layoutOptions.indexOf(iconSize)

    if(layoutIdx <= 3){
      this.olClassName = 'ol-icon-size-view';
    }
    else if (layoutIdx >= 4){
      /*
         the icon-views has various sizes, but it is still treated as one distinct layout. 
         So, options 0 - 3 in the layoutOptions = option 0 in the cssLayoutOptions
       */
      const idx = layoutIdx - 3;
      this.olClassName = `ol-${cssLayoutOptions[idx]}`;
    }
  }

  changeButtonAndImageSize(iconSize:string):void{

    const icon_sizes:string[] = [this.smallIconsView,this.mediumIconsView,this.largeIconsView,this.extraLargeIconsView];
    const fig_img_sizes:string[] = ['30px', '45px', '75px', '90px']; //small, med, large,ext large
    const btn_width_height_sizes = [['90px', '70px'], ['110px', '90px']];

    const iconIdx = icon_sizes.indexOf(iconSize);
    const btnIdx = (iconIdx <= 2) ? 0 : 1;

    for(let i = 0; i < this.fileExplrFiles.length; i++){
      const btnElmnt = document.getElementById(`btnElmnt-${this.processId}-${i}`) as HTMLElement;
      const imgElmnt = document.getElementById(`imgElmnt-${this.processId}-${i}`) as HTMLElement;

      if(btnElmnt){
        btnElmnt.style.width = btn_width_height_sizes[btnIdx][0];
        btnElmnt.style.height = btn_width_height_sizes[btnIdx][1];
      }

      if(imgElmnt){
        imgElmnt.style.width = fig_img_sizes[iconIdx];
        imgElmnt.style.height = fig_img_sizes[iconIdx];
      }
    }
  }

  changeOrderedlistStyle(iconView:string):void{
    const icon_sizes:string[] = [this.smallIconsView,this.mediumIconsView,this.largeIconsView,this.extraLargeIconsView];
    const btn_width_height_sizes = [['90px', '70px'], ['110px', '90px']];
    const iconIdx = icon_sizes.indexOf(iconView);
    const btnIdx = (iconIdx <= 2) ? 0 : 1;
    
    const olElmnt = document.getElementById(`olElmnt-${this.processId}`) as HTMLElement;

    if(iconView == this.smallIconsView || iconView == this.mediumIconsView ||iconView == this.largeIconsView || iconView == this.extraLargeIconsView){
      if(olElmnt){
        olElmnt.style.gridTemplateColumns = `repeat(auto-fill,${btn_width_height_sizes[btnIdx][0]})`;
        olElmnt.style.gridTemplateRows = `repeat(auto-fill,${btn_width_height_sizes[btnIdx][1]})`;
        olElmnt.style.rowGap = '20px';
        olElmnt.style.columnGap = '0px';
        olElmnt.style.padding = '5px 0';
        olElmnt.style.gridAutoFlow = 'row';
      }
    }else if(iconView == this.contentView){

      const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
      if(olElmnt){
        olElmnt.style.gridTemplateColumns = `repeat(auto-fill, minmax(50px, ${rect.width}px)`;
        olElmnt.style.gridTemplateRows = 'repeat(auto-fill, 43px)'; 
      }
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
      'background-color': this._consts.EMPTY_STRING
    }
  }

  colorUpNavBtn():void{
    if(!this.isUpBtnActive){
      this.upNavBtnCntnrStyle ={
        'background-color': this._consts.EMPTY_STRING
      }
    }else{
      this.upNavBtnCntnrStyle ={
        'background-color': '#3f3e3e',
        'transition':'background-color 0.3s ease'
      }
    }
  }

  async goUpAlevel():Promise<void>{
    if(this.upPathEntries.length > 0){
      const currentDirPath =  this.directory;

      if(!this.isNavigatedBefore){
        this.isNavigatedBefore = true;
        this.prevPathEntries.push(currentDirPath);
        this.isPrevBtnActive = true;
        this.prevNavBtnStyle ={
          'fill': '#fff'
        }
      }

      let nextDirPath = this.upPathEntries.pop() ?? this._consts.EMPTY_STRING;
      if(currentDirPath === nextDirPath){
        nextDirPath = this.upPathEntries.pop() ?? this._consts.EMPTY_STRING;
        this.directory = nextDirPath;
        this.prevPathEntries.push(nextDirPath);
      }else{
        this.directory = nextDirPath;
        this.prevPathEntries.push(nextDirPath);
      }

      const folderName = basename(this.directory);

      if(this.upPathEntries.length == 0){
        this.isUpBtnActive = false;
        this.upNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      this.populateHopsList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFilesInfoAsync();
    }
  }

  toggleRibbobMenu():void{
    this.showRibbonMenu = !this.showRibbonMenu
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

  async goBackAlevel():Promise<void>{
    if(this.prevPathEntries.length > 0){
      const currentDirPath =  this.directory;

      if(this.recentPathEntries.indexOf(currentDirPath) == -1){
        this.recentPathEntries.push(currentDirPath);
      }

      const idx = this.upPathEntries.indexOf(currentDirPath);
      if(idx != -1){
        this.upPathEntries.splice(idx,1);
      }else{
        this.upPathEntries.push(currentDirPath);
      }

      this.nextPathEntries.push(currentDirPath);
      this.isNextBtnActive = true;
      this.isUpBtnActive = true;
      this.nextNavBtnStyle ={
        'fill': '#fff'
      }
      this.upNavBtnStyle ={
        'fill': '#fff'
      }

      let nextDirPath = this.prevPathEntries.pop() ?? this._consts.EMPTY_STRING;
      if(currentDirPath === nextDirPath){
        nextDirPath = this.prevPathEntries.pop() ?? this._consts.EMPTY_STRING;
        this.directory = nextDirPath;
      }else{
        this.directory = nextDirPath;
      }

      const folderName = basename(this.directory);

      if(this.prevPathEntries.length == 0){
        this.isPrevBtnActive = false;
        this.prevNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      this.populateHopsList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFilesInfoAsync();
    }
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

  async goForwardAlevel():Promise<void>{
    if(this.nextPathEntries.length > 0){

      const currentDirPath =  this.directory;
      this.prevPathEntries.push(currentDirPath);
      this.isPrevBtnActive = true;
      this.prevNavBtnStyle ={
        'fill': '#fff'
      }

      const nextDirPath = this.directory = this.nextPathEntries.pop() ?? this._consts.EMPTY_STRING;
      const idx = this.upPathEntries.indexOf(nextDirPath)

      if (idx !== -1) {
           this.upPathEntries.splice(idx, 1);
      }else{
        this.upPathEntries.push(nextDirPath);
      }

      if(this.upPathEntries.length == 0){
        this.isUpBtnActive = false;
        this.upNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      const folderName = basename(this.directory);
      if(this.nextPathEntries.length == 0){
        this.isNextBtnActive = false;
        this.nextNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      this.populateHopsList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFilesInfoAsync();
    }
  }

  onNavPaneBtnClick():void{
    this.showNavigationPane = !this.showNavigationPane;
  }

  onNavPaneBtnEnter():void{
    const btnElement = document.getElementById(`navPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      btnElement.style.borderColor = '#ccc';
      btnElement.style.backgroundColor = '#807c7c';
    }
  }

  onNavPaneBtnLeave():void{
    const btnElement = document.getElementById(`navPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'transparent';
      btnElement.style.borderColor = 'transparent';
    }
  }

  onPrevPaneBtnClick():void{
    this.showPreviewPane = !this.showPreviewPane;
    this.showDetailsPane = false;

    this.removePaneBtnStyle(`detailsPaneIconCntnr-${this.processId}`);
    this.setPaneBtnStyle(`prevPaneIconCntnr-${this.processId}`);
  }

  onPrevPaneBtnEnter():void{
    const btnElement = document.getElementById(`prevPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      if(!this.showPreviewPane){
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#605c5c ';
      }else{
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#807c7c';
      }
    }
  }

  onPrevPaneBtnLeave():void{
    const btnElement = document.getElementById(`prevPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      if(!this.showPreviewPane){
        btnElement.style.backgroundColor = 'transparent';
        btnElement.style.borderColor = 'transparent';
      }else{
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#605c5c';
      }
    }
  }

  onDetailPaneBtnClick():void{
    this.showDetailsPane = !this.showDetailsPane;
    this.showPreviewPane = false;

    this.removePaneBtnStyle(`prevPaneIconCntnr-${this.processId}`);
    this.setPaneBtnStyle(`detailsPaneIconCntnr-${this.processId}`);
  }

  onDetailPaneBtnEnter():void{
    const btnElement = document.getElementById(`detailsPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      if(!this.showDetailsPane){
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#605c5c';
      }else{
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#807c7c';
      }
    }
  }

  onDetailPaneBtnLeave():void{
    const btnElement = document.getElementById(`detailsPaneIconCntnr-${this.processId}`) as HTMLDivElement;
    if(btnElement){
      if(!this.showDetailsPane){
        btnElement.style.backgroundColor = 'transparent';
        btnElement.style.borderColor = 'transparent';
      }else{
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#605c5c';
      }
    }
  }

  removePaneBtnStyle(id:string):void{
    const btnElement = document.getElementById(id) as HTMLDivElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'transparent';
      btnElement.style.borderColor = 'transparent';
    }
  }

  setPaneBtnStyle(id:string):void{
    const btnElement = document.getElementById(id) as HTMLDivElement;
    if(btnElement){
      btnElement.style.borderColor = '#ccc';
      btnElement.style.backgroundColor = '#807c7c';
    }
  }

  showExpandTreeIconBtn():void{
    this.showExpandTreeIcon = true;
  }

  hideExpandTreeIconBtn():void{
    this.showExpandTreeIcon = false;
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    let droppedFiles:File[] = [];
    if(event?.dataTransfer?.files){
        // eslint-disable-next-line no-unsafe-optional-chaining
        droppedFiles  = [...event?.dataTransfer?.files];
    }
    
    if(droppedFiles.length >= 1){
      const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
      if(result){
        await this.loadFilesInfoAsync();
      }
    }
  }

  private async loadFilesInfoAsync(showUrlFiles=true):Promise<void>{
    this.fileExplrFiles = [];
    this._fileService.resetDirectoryFiles();
    let directoryEntries  = await this._fileService.getEntriesFromDirectoryAsync(this.directory);

    //console.log('directoryEntries:',directoryEntries); //TBD

    if(this.directory === this._consts.ROOT){
      if(!showUrlFiles){
        const filteredDirectoryEntries = directoryEntries.filter(x => !x.includes(this._consts.URL));
        directoryEntries = filteredDirectoryEntries;
        this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(filteredDirectoryEntries,this.directory);
      }
      else{
        const filteredDirectoryEntries = directoryEntries.filter(x => x.includes(this._consts.URL));
        directoryEntries = filteredDirectoryEntries;
        this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(filteredDirectoryEntries,this.directory); 
      }
    }else{
      this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(directoryEntries,this.directory);
    }

    for(let i = 0; i < directoryEntries.length; i++){
      const fileEntry = this._directoryFilesEntires[i];
      const fileInfo = await this._fileService.getFileInfoAsync(fileEntry.getPath);

      this.fileExplrFiles.push(fileInfo)
    }
  }

  private async loadFileTreeAsync():Promise<void>{

    console.log('loadFileTreeAsync called');
    const usersDir = '/Users/';
    this.fileTreeNode = [];
    this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.getEntriesFromDirectoryAsync(usersDir);

    const osDrive:FileTreeNode = {
      name:this._consts.OSDISK, path: this._consts.ROOT, isFolder: true, children:[]
    }

   // this.directory, will not be correct for all cases. Make sure to check
    for(const dirEntry of directoryEntries){
      const isFile =  await this._fileService.checkIfDirectory(usersDir + dirEntry);
      const ftn:FileTreeNode = {
        name : dirEntry,
        path : `${usersDir}${dirEntry}`,
        isFolder: isFile,
        children: []
      }

      //console.log('ftn:', ftn); //TBD
      this.fileTreeNode.push(ftn);
    }

    this.fileTreeNode.push(osDrive);
  }

  async updateFileTreeAsync(path:string):Promise<void>{

    console.log('updateFileTreeAsync called', path);

    if(!this.fileTreeHistory.includes(path)){
      const tmpFileTreeNode:FileTreeNode[] = [];
      this._fileService.resetDirectoryFiles();
      const directoryEntries  = await this._fileService.getEntriesFromDirectoryAsync(path);
  
      // this.directory, will not be correct for all cases. Make sure to check
      for(const dirEntry of directoryEntries){
  
        const isFile =  await this._fileService.checkIfDirectory(`${path}/${dirEntry}`.replace(this._consts.DOUBLE_SLASH,this._consts.ROOT));
        const ftn:FileTreeNode = {
          name : dirEntry,
          path: `${path}/${dirEntry}`.replace(this._consts.DOUBLE_SLASH,this._consts.ROOT),
          isFolder: isFile,
          children: []
        }
  
        //console.log('update-ftn:', ftn); //TBD
        tmpFileTreeNode.push(ftn);
      }
  
      const res =  this.addChildrenToNode(this.fileTreeNode, path, tmpFileTreeNode);
      //console.log('updatedTreeData:', res);
      this.fileTreeNode = res;
      this.fileTreeHistory.push(path);
    }
  }

  private addChildrenToNode(treeData: FileTreeNode[], nodePath: string, newChildren: FileTreeNode[]): FileTreeNode[] {
    // Create a new array for the updated treeData
    const updatedTreeData: FileTreeNode[] = [];

    for (let i = 0; i < treeData.length; i++) {
      const node = treeData[i];
      const updatedNode: FileTreeNode = {
        name: node.name,
        path: node.path,
        isFolder: node.isFolder,
        children: node.children || []
      };

      // If the current node matches the nodeName, add the new children
      if (node.path === nodePath) {
        for(const child of newChildren){
          updatedNode.children.push(child)
        }
      }

      // If the node has children, recursively call this function on the children
      if (node.children) {
        updatedNode.children = this.addChildrenToNode(node.children, nodePath, newChildren);
      }

      // Add the updated node to the new treeData array
      updatedTreeData.push(updatedNode);
    }

    return updatedTreeData;
  }

  async runProcess(file:FileInfo):Promise<void>{

    console.log('fileexplorer-runProcess:',file)
    this.showInformationTip = false;
    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    if((file.getOpensWith === 'fileexplorer' && file.getFileName !== 'fileexplorer') && file.getFileType ==='folder'){

      if(!this.isNavigatedBefore){
        this.prevPathEntries.push(this.directory);
        this.upPathEntries.push(this.directory);
        this.isNavigatedBefore = true;
      }

      this.isPrevBtnActive = true;

      if(file.getCurrentPath.includes(this._consts.URL)){
        this.directory = file.getContentPath;
      }
      else{
        this.directory = file.getCurrentPath;
      }

      this.displayName = file.getFileName;
      this.icon = file.getIconPath;

      this.prevPathEntries.push(this.directory);
      this.upPathEntries.push(this.directory);

      if(this.recentPathEntries.indexOf(this.directory) == -1){
        this.recentPathEntries.push(this.directory);
      }

      this.populateHopsList();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
  
      await this.loadFilesInfoAsync();
    }else{
      //APPS opened from the fileexplore do not have their windows in focus,
      // and this is due to the mouse click event that causes fileexplorer to trigger setFocusOnWindow event
      setTimeout(() => {
        this._triggerProcessService.startApplication(file);
      }, this.SECONDS_DELAY[4]);
    }
  }

  async navigateToFolder(data:string[]):Promise<void>{
    const thisPC = 'This-PC';
    const fileName = data[0];
    const path = data[1];

    if(!this.isNavigatedBefore){
      this.prevPathEntries.push(this.directory);
      this.upPathEntries.push(this.directory);
      this.isNavigatedBefore = true;
    }

    this.isPrevBtnActive = true;
    this.displayName = fileName;
    this.directory = (path === thisPC)? this._consts.ROOT : path;

    if(path === `/Users/${fileName}`)
      this.icon = `${this._consts.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
    else
      this.icon = `${this._consts.IMAGE_BASE_PATH}folder.png`;

    this.prevPathEntries.push(this.directory);
    this.upPathEntries.push(this.directory);

    if(this.recentPathEntries.indexOf(this.directory) == -1){
      this.recentPathEntries.push(this.directory);
    }

    this.populateHopsList();
    this.setNavPathIcon(fileName, path);
    this.storeAppState(path);

    if(path === thisPC || path !== this._consts.ROOT)
      await this.loadFilesInfoAsync();
    else if(path === this._consts.ROOT)
      await this.loadFilesInfoAsync(false);
  }

  setNavPathIcon(fileName:string, directory:string):void{
    console.log(`fileexplorer - setNavPathIcon: fileName:${fileName} -----  directory:${directory}`)

    if(directory === `/Users/${fileName}`){
      this.navPathIcon = `${this._consts.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder_small.png`;
    }
    else if((fileName === 'OSDisk (C:)' && directory === this._consts.ROOT)){
      this.navPathIcon = `${this._consts.IMAGE_BASE_PATH}os_disk.png`;
    }
    else if((fileName === 'fileexplorer' && directory === this._consts.ROOT) || (fileName === this._consts.EMPTY_STRING && directory === this._consts.ROOT)){
      this.navPathIcon = `${this._consts.IMAGE_BASE_PATH}this_pc.png`;
    }else{
      this.navPathIcon = `${this._consts.IMAGE_BASE_PATH}folder_folder_small.png`;
    }
  }

  onTriggerRunProcess():void{
    this.runProcess(this.selectedFile);
  }

  onBtnClick(id:number):void{
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next(); 

    const menuHeight = 213; //this is not ideal.. menu height should be gotten dynmically
    this.iconCntxtCntr++;

    const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);
    
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

    this.adjustContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file
    this.isIconInFocusDueToPriorAction = false;
    this.showInformationTip = false;

    if(!this.showIconCntxtMenu)
      this.showIconCntxtMenu = !this.showIconCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);

    this.fileExplrCntxtMenuStyle = {
      'position': 'absolute', 
      'transform':`translate(${String(axis.xAxis)}px, ${String(axis.yAxis)}px)`,
      'z-index': 2,
    }

    evt.preventDefault();
  }

  adjustContextMenuData(file:FileInfo):void{
    this.menuData = [];
    const editNotAllowed:string[] = ['3D-Objects.url','Desktop.url','Documents.url','Downloads.url','Games.url','Music.url','Pictures.url','Videos.url'];

    //console.log('adjustContextMenuData - filename:',file.getCurrentPath); //TBD
   if(file.getIsFile){
      if(editNotAllowed.includes(file.getCurrentPath.replace('/', this._consts.EMPTY_STRING))){
        this.menuOrder = this._consts.FILE_EXPLORER_UNIQUE_MENU_ORDER ;
        for(const x of this.sourceData) {
          if(x.label === 'Cut' || x.label === 'Delete' || x.label === 'Rename'){ /*nothing*/}
          else{
            this.menuData.push(x);
          }
        }
      }else{
        //files can not be opened in terminal, pinned to start, opened in new window, pin to Quick access
        this.menuOrder = this._consts.FILE_EXPLORER_FILE_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Open in new window' || x.label === 'Pin to Start'){ /*nothing*/}
          else{
            this.menuData.push(x);
          }
        }
      }
    }else{
      this.menuOrder = this._consts.FILE_EXPLORER_FOLDER_MENU_ORDER;
      this.menuData = this.sourceData;
    }
  }

  onShowFileExplorerContextMenu(evt:MouseEvent):void{
    this.showExpandTreeIcon = false;
    this.fileExplrCntxtCntr++;
    if(this.iconCntxtCntr >= this.fileExplrCntxtCntr)
        return;

    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next();
    const menuHeight = 230; //this is not ideal.. menu height should be gotten dynmically

    const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);

    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

    if(!this.showFileExplrCntxtMenu)
      this.showFileExplrCntxtMenu = !this.showFileExplrCntxtMenu;

    this.fileExplrCntxtMenuStyle = {
      'position': 'absolute', 
      'transform':`translate(${String(axis.xAxis)}px, ${String(axis.yAxis)}px)`,
      'z-index': 2,
    }
    evt.preventDefault();
  }


  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  hideIconContextMenu(caller?:string):void{
    this.showIconCntxtMenu = false;
    this.showFileExplrCntxtMenu = false;
    this.isShiftSubMenuLeft = false;
    this.iconCntxtCntr = 0;
    this.fileExplrCntxtCntr = 0;
    this.showExpandTreeIcon = false;

    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this._menuService.hideContextMenus.next();
    }
  }

  handleIconHighLightState():void{

    //First case - I'm clicking only on the desktop icons
    if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt == 0)){  
      
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= 0)
          this.setBtnStyle(this.selectedElementId,false);
      }
      if(!this.isRenameActive){
        this.isBtnClickEvt = false;
        this.btnClickCnt = 0;
      }
    }else{
      this.hideCntxtMenuEvtCnt++;
      this.isHideCntxtMenuEvt = true;
      //Second case - I was only clicking on the desktop
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= 1) && (!this.isBtnClickEvt && this.btnClickCnt == 0)){
        this.isIconInFocusDueToCurrentAction = false;
        this.btnStyleAndValuesChange();
      }
      
      // //Third case - I was clicking on the desktop icons, then i click on the desktop.
      // //clicking on the desktop triggers a hideContextMenuEvt
      // if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt > 1)){
      //   this.isIconInFocusDueToCurrentAction = false;
      //   console.log('3rd----this.isIconInFocusDueToCurrentAction:', this.isIconInFocusDueToCurrentAction );
      //   this.btnStyleAndValuesReset();
      // }
    }
  }

  doBtnClickThings(id:number):void{

    this.isIconInFocusDueToCurrentAction = true;
    this.isIconInFocusDueToPriorAction = false;
    this.prevSelectedElementId = this.selectedElementId 
    this.selectedElementId = id;

    this.isBtnClickEvt = true;
    this.btnClickCnt++;
    this.isHideCntxtMenuEvt = false;
    this.hideCntxtMenuEvtCnt = 0;
   
    if(this.prevSelectedElementId != id){
      this.removeBtnStyle(this.prevSelectedElementId);
    }
  }

  onMouseEnter(evt:MouseEvent, file:FileInfo, id:number):void{
    this.showInformationTip = true;
    this.setBtnStyle(id, true);
    this.displayInformationTip(evt, file);
  }

  onMouseLeave(id:number):void{
    this.showInformationTip = false;
    //this.hideInformationTip = false;

    if(id != this.selectedElementId){
      this.removeBtnStyle(id);
    }
    else if((id == this.selectedElementId) && this.isIconInFocusDueToPriorAction){
      this.setBtnStyle(id,false);
    }
  }

  setBtnStyle(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = '#4c4c4c';
      btnElement.style.border = '1px solid #3c3c3c';

      if(this.selectedElementId == id){

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
          btnElement.style.backgroundColor = 'transparent';
          btnElement.style.border = '0.5px solid white'
        }
      }
    }
  }

  btnStyleAndValuesReset():void{
    this.isBtnClickEvt = false;
    this.btnClickCnt = 0;
    this.removeBtnStyle(this.selectedElementId);
    this.removeBtnStyle(this.prevSelectedElementId);
    this.selectedElementId = -1;
    this.prevSelectedElementId = -1;
    this.btnClickCnt = 0;
    this.isIconInFocusDueToPriorAction = false;
  }

  btnStyleAndValuesChange():void{
    this.isBtnClickEvt = false;
    this.btnClickCnt = 0;
    this.prevSelectedElementId = this.selectedElementId;
    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
    this.setBtnStyle(this.selectedElementId, false);
    //this.removeBtnStyle(this.prevSelectedElementId);
  }
  
  removeBtnStyle(id:number):void{
    const btnElement = document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'transparent';
      btnElement.style.border = 'none'
    }
  }

  doNothing():void{/** */}

  onCopy():void{
    const action = 'copy';
    const path = this.selectedFile.getCurrentPath;
    this._menuService.storeData.next([path, action]);
  }

  onCut():void{
    const action = 'cut';
    const path = this.selectedFile.getCurrentPath;
    this._menuService.storeData.next([path, action]);
  }
  
  checkAndHandleMenuBounds(rect:DOMRect, evt:MouseEvent, menuHeight:number):{ xAxis: number; yAxis: number; }{

    let xAxis = 0;
    let yAxis = 0;
    //const horizontalMin = rect.x;
    const horizontalMax = rect.right
    //const verticalMin = rect.top;
    const verticalMax = rect.bottom;
    const horizontalDiff =  horizontalMax - evt.clientX;
    const verticalDiff = verticalMax - evt.clientY;
    let horizontalShift = false;
    let verticalShift = false;

    const menuWidth = 210;
    const subMenuWidth = 205;

    // if((horizontalDiff) >= 0 && (horizontalDiff) <= 10){
    //   this.isShiftSubMenuLeft = true;
    //   horizontalShift = true;

    //   xAxis = evt.clientX - rect.left - horizontalDiff;
    // }

    if((horizontalDiff) < menuWidth){
      horizontalShift = true;
      this.isShiftSubMenuLeft = true;
      const diff = menuWidth - horizontalDiff;
      xAxis = evt.clientX - rect.left - diff;
    }

    

    if((verticalDiff) >= 40 && (verticalDiff) <= menuHeight){
      const shifMenuUpBy = menuHeight - verticalDiff;
      verticalShift = true;

      yAxis = evt.clientY - rect.top - shifMenuUpBy;
    }
    
    xAxis = (horizontalShift)? xAxis : evt.clientX - rect.left;
    yAxis = (verticalShift)? yAxis : evt.clientY - rect.top;
 
    return {xAxis, yAxis};
  }

  //menu doesn't exist when this method is first called
  // getMenuHeight(menuId:string):number{
  //   const nestedMenu =  document.getElementById(menuId) as HTMLDivElement;
  //   let menuHeight = 0;
  //   console.log('nestedMenu:', nestedMenu);

  //   setTimeout(()=>{
  //     if(nestedMenu){
  //       menuHeight = Number(nestedMenu.style.height);
  //       console.log('menu height:', menuHeight);
  //     }
  //   },200)
  //   return menuHeight
  // }

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

  onDragStart(evt:any):void{
    // const rect =  this.myBounds.nativeElement.getBoundingClientRect(); 
    // console.log('start:',evt.id )


    // const btnTransform = window.getComputedStyle(evt)
    // const matrix = new DOMMatrixReadOnly(btnTransform.transform)

    // const transform = {
    //   translateX: matrix.m41,
    //   translateY: matrix.m42
    // }

    // // const transX = matrix.m41;
    // // const transY = matrix.m42;


    // console.log('start-transform:', transform)
    // console.log('rect:',rect )
  }

  onDragEnd(evt:any):void{
1
  }

  setFileExplorerWindowToFocus(pid: number):void {
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  sortIcons(sortBy:string): void {
    if(sortBy === "Size"){
      this.fileExplrFiles = this.fileExplrFiles.sort((objA, objB) => objB.getSize - objA.getSize);
    }else if(sortBy === "Date Modified"){
      this.fileExplrFiles = this.fileExplrFiles.sort((objA, objB) => objB.getDateModified.getTime() - objA.getDateModified.getTime());
    }else if(sortBy === "Name"){
      this.fileExplrFiles = this.fileExplrFiles.sort((objA, objB) => {
        return objA.getFileName < objB.getFileName ? -1 : 1;
      });
    }else if(sortBy === "Item Type"){
      this.fileExplrFiles = this.fileExplrFiles.sort((objA, objB) => {
        return objA.getFileType < objB.getFileType ? -1 : 1;
      });
    }
  }

  // this method is gross
  displayInformationTip(evt:MouseEvent, file:FileInfo):void{

    const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const x = (evt.clientX - rect.left) - 15;
    const y = (evt.clientY - rect.top) + 10;

    setTimeout(()=>{
      const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
      if(infoTip){
        setTimeout(()=>{ 
          infoTip.style.display = 'block';
          infoTip.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
          infoTip.style.position = 'absolute';
          infoTip.style.zIndex = '3';


          this.setInformationTipInfo(file);

          //this.hideInformationTip = true;
          // if(this.hideInformationTip){
          //   setTimeout(()=>{ // hide after 9 secs
          //     this.hideInformationTip = false;
          //     this.showInformationTip = false;
          //   },this.SECONDS_DELAY[3]) 
          // }

        },this.SECONDS_DELAY[1])  //wait 1.5 seconds
      }
    },this.SECONDS_DELAY[0]) // wait 100th of a sec
  }

  setInformationTipInfo(file:FileInfo):void{
    const infoTipFields = ['Author:', 'Item type:','Date created:','Date modified:', 'Dimesions:', 'General', 'Size:','Type:'];
    const fileAuthor = 'Relampago Del Catatumbo';
    const fileType = file.getFileType;
    const fileDateModified = file.getDateModifiedUS;
    const fileSize = `${String(file.getSize1)}  ${file.getFileSizeUnit}`;
    const fileName = file.getFileName;

    //reset
    this.fileInfoTipData = [];

    if(this._consts.IMAGE_FILE_EXTENSIONS.includes(file.getFileType)){
      const img = new Image();
      img.src = file.getIconPath;
      const width = img?.naturalWidth;
      const height = img?.naturalHeight;
      const imgDimesions = `${width} x ${height}`;

      this.fileInfoTipData.push({label:infoTipFields[1], data:`${file.getFileType.replace('.',this._consts.EMPTY_STRING).toLocaleUpperCase()} File`});
      this.fileInfoTipData.push({label:infoTipFields[4], data:imgDimesions })
      this.fileInfoTipData.push({label:infoTipFields[6], data:fileSize })
    }

    if(fileType === '.txt'){
      this.fileInfoTipData.push({label:infoTipFields[7], data:'Text Document'});
      this.fileInfoTipData.push({label:infoTipFields[3], data: fileDateModified });
      this.fileInfoTipData.push({label:infoTipFields[6], data:fileSize });
    }

    if(fileType === 'folder'){
      if(fileName === 'Desktop' || fileName === 'Documents' || fileName === 'Downloads'){
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified })
      }else if(fileName === 'Music'){
        this.fileInfoTipData.push({label:this._consts.EMPTY_STRING, data:'Contains music and other audio files' })
      }else if(fileName === 'Videos'){
        this.fileInfoTipData.push({label:this._consts.EMPTY_STRING, data:'Contains movies and other video files' })
      }else if(fileName === 'Pictures' ){
        this.fileInfoTipData.push({label:this._consts.EMPTY_STRING, data:'Contains digital photos, images and graphic files'})
      }else{
        this.fileInfoTipData.push({label:infoTipFields[7], data:fileType });
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified });
      }
    }
  }

  async refreshIcons():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
    await this.loadFilesInfoAsync();
  }

  async onDeleteFile():Promise<void>{
    let result = false;
    if(this.selectedFile.getIsFile){
      result = await this._fileService.deleteFileAsync(this.selectedFile.getCurrentPath);
    }else{
      result = await this._fileService.deleteFolderAsync(this.selectedFile.getCurrentPath)
    }

    if(result){
      await this.loadFilesInfoAsync();
    }
  }

  onKeyPress(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_]+$';
    const res = new RegExp(regexStr).test(evt.key)

    if(res){
      this.hideInvalidCharsToolTip();
      return res
    }else{
      this.showInvalidCharsToolTip();

      setTimeout(()=>{ // hide after 6 secs
        this.hideInvalidCharsToolTip();
      },this.SECONDS_DELAY[2]) 

      return res;
    }
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
    SearchTxtBox.value = this._consts.EMPTY_STRING;
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

  showPathTextBox():void{
    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLInputElement;
    const pathIconBoxElement = document.getElementById(`pathIconBox-${this.processId}`) as HTMLElement;

    if(pathTxtBoxCntrElement){
      pathTxtBoxCntrElement.style.display = 'flex';
    }

    if(pathTxtBoxElement){
      pathTxtBoxElement.style.display = 'block';

      if(this.showPathHistory){
        if(this.directory === this._consts.ROOT){
          this.pathForm.setValue({
            pathInput:this._consts.ROOT
          })
        }
      }else{
        this.pathForm.setValue({
          pathInput:this.directory
        })
      }
      pathTxtBoxElement?.focus();
      pathTxtBoxElement?.select();
    }

    if(pathIconBoxElement){
      pathIconBoxElement.style.display = 'none';
    }
  }

  hidePathTextBox():void{
    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLElement;
    const pathIconBoxElement = document.getElementById(`pathIconBox-${this.processId}`) as HTMLElement;

    if(pathTxtBoxElement){
      pathTxtBoxElement.style.display = 'none';
    }

    if(pathTxtBoxCntrElement){
      pathTxtBoxCntrElement.style.display = 'none';
    }

    if(pathIconBoxElement){
      pathIconBoxElement.style.display = 'flex';
    }
  }

  hidePathTextBoxOnload():void{
    const pathTxtBoxCntrElement = document.getElementById(`pathTxtBoxCntr-${this.processId}`) as HTMLElement;
    const pathTxtBoxElement = document.getElementById(`pathTxtBox-${this.processId}`) as HTMLElement;  

    if(pathTxtBoxElement){
      pathTxtBoxElement.style.display = 'none';
    }

    if(pathTxtBoxCntrElement){
      pathTxtBoxCntrElement.style.display = 'none';
    }
  }

  populateHopsList():void{
    const tmpArray = this.directory.split(this._consts.ROOT).filter(x => x !== this._consts.EMPTY_STRING);
    if(tmpArray.length === 0){ tmpArray[0]= this._consts.THISPC; }
    else{ tmpArray.unshift(this._consts.THISPC); }

    if(this.directory.includes('/Users')){
      this._directoryHops = tmpArray;
    }else{
      tmpArray[1] = this._consts.OSDISK;
      this._directoryHops = tmpArray;
    }

    console.log('this._directoryHops:', this._directoryHops);
  }

  showInvalidCharsToolTip():void{
    // get the position of the textbox
    const invalidCharToolTipElement = document.getElementById(`invalidChars-${this.processId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer-${this.processId}-${this.selectedElementId}`) as HTMLElement;

    const fileRect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const rect = renameContainerElement.getBoundingClientRect();

    const x = rect.left - fileRect.left;
    const y = rect.top - fileRect.top ;

    if(invalidCharToolTipElement){
      invalidCharToolTipElement.style.transform =`translate(${x + 2}px, ${y + 2}px)`;
      invalidCharToolTipElement.style.zIndex = '2';
      invalidCharToolTipElement.style.opacity = '1';
      invalidCharToolTipElement.style.transition = 'opacity 0.5s ease';
    }
  }

  hideInvalidCharsToolTip():void{
    const invalidCharToolTipElement = document.getElementById(`invalidChars-${this.processId}`) as HTMLElement;

    if(invalidCharToolTipElement){
      invalidCharToolTipElement.style.transform =`translate(${-100000}px, ${100000}px)`;
      invalidCharToolTipElement.style.zIndex = '-1';
      invalidCharToolTipElement.style.opacity = '0';
      invalidCharToolTipElement.style.transition = 'opacity 0.5s ease 1';
    }
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

  onRenameFileTxtBoxShow():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElement= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;

    //TODO: fileexplorer behaves differently from the desktop
    //this.removeBtnStyle(this.selectedElementId);

    if(figCapElement){
      figCapElement.style.display = 'none';
    }

    if(renameContainerElement){
      renameContainerElement.style.display = 'block';
      this.currentIconName = this.selectedFile.getFileName;
      this.renameForm.setValue({
        renameInput:this.currentIconName
      })

      renameTxtBoxElement?.focus();
      renameTxtBoxElement?.select();
    }
  }

  async onRenameFileTxtBoxDataSave():Promise<void>{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameText = this.renameForm.value.renameInput as string;

    if(renameText !== this._consts.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName){
      const result = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText, this.selectedFile.getIsFile);

      if(result){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getContentPath) && (f.getFileName == this.selectedFile.getFileName));
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now();
        this.fileExplrFiles[fileIdx] = this.selectedFile;

        this.renameForm.reset();
        await this.loadFilesInfoAsync();
      }
    }else{
      this.renameForm.reset();
    }

    this.setBtnStyle(this.selectedElementId, false);
    this.renameFileTriggerCnt = 0;

    if(figCapElement){
      figCapElement.style.display = 'block';
    }

    if(renameContainerElement){
      renameContainerElement.style.display = 'none';
    }
  }

  onRenameFileTxtBoxHide():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer-${this.processId}-${this.selectedElementId}`) as HTMLElement;

    if(figCapElement){
      figCapElement.style.display = 'block';
    }
    if(renameContainerElement){
      renameContainerElement.style.display = 'none';
    }

    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
  }

  showSearchHistory():void{
    const searchHistoryElement = document.getElementById(`searchHistory-${this.processId}`) as HTMLElement;
    if(searchHistoryElement){
      if(this.searchHistory.length > 0){
        searchHistoryElement.style.display = 'block';
      }
    }
  }

  hideSearchHistory():void{
    // this.isSearchBoxinFocus = !this.isSearchBoxinFocus ;
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

  storeAppState(app_data:unknown):void{
    const uid = `${this.name}-${this.processId}`;

    this._appState = {
      pid: this.processId,
      app_data: app_data,
      app_name: this.name,
      unique_id: uid
    }
    
    this._stateManagmentService.addState(uid, this._appState, StateType.App);
  }

  retrievePastSessionData():void{
    const pickUpKey = this._sessionManagmentService._pickUpKey;
    if(this._sessionManagmentService.hasTempSession(pickUpKey)){
      const tmpSessKey = this._sessionManagmentService.getTempSession(pickUpKey) || this._consts.EMPTY_STRING; 
      const retrievedSessionData = this._sessionManagmentService.getSession(tmpSessKey) as BaseState[];

      if(retrievedSessionData !== undefined){
        const appSessionData = retrievedSessionData[0] as AppState;
        if(appSessionData !== undefined  && appSessionData.app_data != this._consts.EMPTY_STRING){
          this.directory = appSessionData.app_data as string;
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

      //window title and button bar, and windows taskbar height, fileExplr headerTab container, 
      //empty line container, fileExplr header container, empty line container 2, footer container
      const pixelTosubtract = 30 + 40 + 115.5 + 6 + 24 + 7 + 24;

      this.fileExplrMainCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      this.fileExplrCntntCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      this.navExplorerCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      
    }
  }

  minimizeWindow(arg:number[]):void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
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

    this.getFileExplorerMenuData();
  }

  buildViewMenu():NestedMenuItem[]{

    const extraLargeIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Extra Large icons', action: () => this.isExtraLargeIcon = !this.isExtraLargeIcon,  variables:this.isExtraLargeIcon, 
      emptyline:false, styleOption:'A' }

    const largeIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Large icons', action: () => this.isLargeIcon = !this.isLargeIcon,  variables:this.isMediumIcon, 
      emptyline:false, styleOption:'A' }

    const mediumIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Medium icons', action: () => this.isMediumIcon = !this.isMediumIcon, variables:this.isLargeIcon,
      emptyline:false, styleOption:'A' }

    const smallIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Small icons', action: () => this.isSmallIcon = !this.isSmallIcon, variables:this.isLargeIcon,
    emptyline:false, styleOption:'A' }

    const listIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'List icons', action: () => this.isListIcon = !this.isListIcon, variables:this.isListIcon,
    emptyline:false, styleOption:'A' }

    const detailsIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Details icons', action: () => this.isDetailsIcon = !this.isDetailsIcon, variables:this.isDetailsIcon,
      emptyline:false, styleOption:'A' }

    const titlesIcon:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Titles icons', action: () => this.isTitleIcon = !this.isTitleIcon, variables:this.isTitleIcon,
        emptyline:false, styleOption:'A' }

    const viewByMenu = [extraLargeIcon, largeIcon, mediumIcon, smallIcon, listIcon, detailsIcon, titlesIcon];

    return viewByMenu;
  }

  buildSortByMenu(): NestedMenuItem[]{

    const sortByName:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Name',  action: this.sortByNameM.bind(this),  variables:this.isSortByName , 
      emptyline:false, styleOption:'A' }

    const sortBySize:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Size',  action: this.sortBySizeM.bind(this),  variables:this.isSortBySize , 
      emptyline:false, styleOption:'A' }

    const sortByItemType:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Item type',  action: this.sortByItemTypeM.bind(this),  variables:this.isSortByItemType, 
      emptyline:false, styleOption:'A' }

    const sortByDateModified:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}circle.png`, label:'Date modified',  action: this.sortByDateModifiedM.bind(this),  variables:this.isSortByDateModified, 
      emptyline:false, styleOption:'A' }

    const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified ]

    return sortByMenu
  }

  buildNewMenu(): NestedMenuItem[]{
    const newFolder:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action:()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const textEditor:NestedMenuItem={ icon:`${this._consts.IMAGE_BASE_PATH}text_editor.png`, label:'Rich Text',  action:  ()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const sortByMenu = [newFolder, textEditor ]

    return sortByMenu
  }

  getFileExplorerMenuData():void{
    this.fileExplrMenu = [
          {icon1:this._consts.EMPTY_STRING,  icon2: `${this._consts.IMAGE_BASE_PATH}arrow_next_1.png`, label:'View', nest:this.buildViewMenu(), action: ()=> this._consts.EMPTY_STRING, action1: this.shiftViewSubMenu.bind(this), emptyline:false},
          {icon1:this._consts.EMPTY_STRING,  icon2:`${this._consts.IMAGE_BASE_PATH}arrow_next_1.png`, label:'Sort by', nest:this.buildSortByMenu(), action: ()=> this._consts.EMPTY_STRING, action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
          {icon1:this._consts.EMPTY_STRING,  icon2:this._consts.EMPTY_STRING, label: 'Refresh', nest:[], action:() => console.log('Refresh'), action1: ()=> this._consts.EMPTY_STRING, emptyline:true},
          {icon1:this._consts.EMPTY_STRING,  icon2:this._consts.EMPTY_STRING, label: 'Paste', nest:[], action: () => console.log('Paste!! Paste!!'), action1: ()=> this._consts.EMPTY_STRING, emptyline:false},
          {icon1:`${this._consts.IMAGE_BASE_PATH}terminal.png`, icon2:this._consts.EMPTY_STRING, label:'Open in Terminal', nest:[], action: () => console.log('Open Terminal'), action1: ()=> this._consts.EMPTY_STRING, emptyline:false},
          {icon1:`${this._consts.IMAGE_BASE_PATH}vs_code.png`, icon2:this._consts.EMPTY_STRING, label:'Open with Code', nest:[], action: () => console.log('Open CodeEditor'), action1: ()=> this._consts.EMPTY_STRING, emptyline:true},
          {icon1:this._consts.EMPTY_STRING,  icon2:`${this._consts.IMAGE_BASE_PATH}arrow_next_1.png`, label:'New', nest:this.buildNewMenu(), action: ()=> this._consts.EMPTY_STRING, action1: this.shiftNewSubMenu.bind(this), emptyline:true},
          {icon1:this._consts.EMPTY_STRING,  icon2:this._consts.EMPTY_STRING, label:'Properties', nest:[], action: () => console.log('Properties'), action1: ()=> this._consts.EMPTY_STRING, emptyline:false}
      ]
  }

  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    let fileContent = '';
    const directory = '/';//(inputDir)? inputDir : this.directory;

    if(directory === this._consts.ROOT){

      const msg = `Cheetah can't create a shortcut here.
Do you want the shortcut to be placed on the desktop instead?`;
      this._notificationService.warningNotify.next(msg);
      return;
    }


    if(selectedFile.getIsFile){
      fileContent = `[InternetShortcut]
FileName=${selectedFile.getFileName} - ${this._consts.SHORTCUT}
IconPath=${selectedFile.getIconPath}
FileType=${selectedFile.getFileType}
ContentPath=${selectedFile.getContentPath}
OpensWith=${selectedFile.getOpensWith}
`;
    }else{
      //
    }

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${this._consts.SHORTCUT}${this._consts.URL}`;
    const result = await this._fileService.writeFileAsync(this.directory, shortCut);
    if(result){
      await this.loadFilesInfoAsync();
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}
