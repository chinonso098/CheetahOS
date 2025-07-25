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
import { SortBys } from 'src/app/system-files/common.enums';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
 
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _userNotificationService:UserNotificationService;
  private _windowService:WindowService;
  private _menuService:MenuService;
  private _audioService:AudioService;
  private _systemNotificationService:SystemNotificationService;
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

  isSearchBoxNotEmpty = false;
  showPathHistory = false;
  onClearSearchIconHover = false;
  onSearchIconHover = false;
  showIconCntxtMenu = false;
  showFileExplrCntxtMenu = false;
  showFileSizeAndUnit = false;
  iconCntxtCntr = 0;
  fileExplrCntxtCntr = 0;
  selectFilesSizeSum = Constants.EMPTY_STRING;
  selectFilesSizeUnit = Constants.EMPTY_STRING;

  readonly ROOT = Constants.ROOT;
  readonly THISPC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);
  readonly QUICKACCESS = 'Quick access';
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


  fileExplrFiles:FileInfo[] = [];
  fileTreeNode:FileTreeNode[] = [];
  _fileInfo!:FileInfo;
  prevPathEntries:string[] = [];
  nextPathEntries:string[] = [];
  recentPathEntries:string[] = [];
  upPathEntries:string[] = ['/Users/Desktop'];
  _directoryTraversalList:string[] = ['This PC'];
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
    {icon:Constants.EMPTY_STRING, label: 'Open', action: this.onTriggerRunProcess.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in new window', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in Terminal', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Start', action: this.doNothing.bind(this) },
    //{icon:Constants.EMPTY_STRING, label: 'Send to', action: this.doNothing.bind(this) },
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
  readonly cheetahGenericNotifyAudio = `${Constants.AUDIO_BASE_PATH}cheetah_notify_system_generic.wav`;

  fileExplorerBoundedRect!:DOMRect;
  multiSelectElmnt!:HTMLDivElement | null;
  multiSelectStartingPosition!:MouseEvent | null;

  markedBtnIds:string[] = [];
  movedBtnIds:string[] = [];

  icon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
  navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
  isMaximizable = false;
  name = 'fileexplorer';
  processId = 0;
  type = ComponentType.System;
  directory = Constants.ROOT;
  displayName = 'fileexplorer';
  hasWindow = true;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService, 
              triggerProcessService:ProcessHandlerService, formBuilder: FormBuilder, sessionManagmentService:SessionManagmentService, 
              menuService:MenuService, notificationService:UserNotificationService, windowService:WindowService, 
              audioService:AudioService, systemNotificationService:SystemNotificationService) { 

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
      const uid = `${name}-${this.processId}`;
      if(this._fileService.getEventOriginator() === uid){
        this.updateFileTreeAsync(p);
        this._fileService.removeEventOriginator();
      }
    });

    this._goToDirectoryDataSub = this._fileService.goToDirectoryNotify.subscribe((p) => {
      const name = 'filetreeview-1';
      const uid = `${name}-${this.processId}`;
      if(this._fileService.getEventOriginator() === uid){
        if(!this.isRecycleBinFolder){
          this.navigateToFolder(p);
          this._fileService.removeEventOriginator();
        }
      }
    });

    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()});
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)});
    this._hideContextMenuSub = this._menuService.hideContextMenus.subscribe(() => { this.hideIconContextMenu()});
    this._creatShortCutOnDesktopSub = this._menuService.createDesktopShortcut.subscribe(()=>{this.createShortCutOnDesktop()});
  }

  ngOnInit():void{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
    this.retrievePastSessionData();
    
    if(this._fileInfo){
      // is this a URL or and Actual Folder
      if(this._fileInfo.getOpensWith === Constants.FILE_EXPLORER && !this._fileInfo.getIsFile){ //Actual Folder
        this.directory = this._fileInfo.getCurrentPath;
        const fileName = (this._fileInfo.getFileName === Constants.EMPTY_STRING)? Constants.NEW_FOLDER : this._fileInfo.getFileName;

        this.populateTraversalList();
        this.checkAndSetIfRecycleBin();
        this.setNavPathIcon(fileName, this._fileInfo.getCurrentPath);
      }
    }

    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: Constants.EMPTY_STRING,
    });
    this.pathForm = this._formBuilder.nonNullable.group({
      pathInput: Constants.EMPTY_STRING,
    });
    this.searchForm = this._formBuilder.nonNullable.group({
      searchInput: Constants.EMPTY_STRING,
    });

    this.setNavButtonsColor();
    this.getFileExplorerMenuData();
    this.storeAppState(this._fileInfo.getCurrentPath);
  }

  async ngAfterViewInit():Promise<void>{

    //this.setFileExplorerWindowToFocus(this.processId); 
    this.hidePathTextBoxOnload();
    this.changeFileExplorerLayoutCSS(this.currentViewOption);
    this.changeTabLayoutIconCntnrCSS(this.currentViewOptionId,false);

    this.pathForm.setValue({
      pathInput: (this.directory !== Constants.ROOT)? this.directory : Constants.ROOT
    })
  
    await this.loadFileTreeAsync();
    await this.setProperRecycleBinIcon();
    await this.loadFiles().then(()=>{
      setTimeout(()=>{
        this.captureComponentImg();
      },this.SECONDS_DELAY[4]) 
    });

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

  checkAndSetIfRecycleBin():void{
    if(this.directory === Constants.RECYCLE_BIN_PATH){
      this.isRecycleBinFolder = true;
      this.icon  =  `${Constants.IMAGE_BASE_PATH}empty_bin.png`;
    }
  }

  async setProperRecycleBinIcon():Promise<void>{
    if(this.directory === Constants.RECYCLE_BIN_PATH){

      const count = await this._fileService.countFolderItems(Constants.RECYCLE_BIN_PATH);
      this.icon = (count === 0) 
        ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
        :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
  
    }
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

  captureComponentImg():void{
    htmlToImage.toPng(this.fileExplorerRootContainer.nativeElement).then(htmlImg =>{
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
  
  colorTabLayoutContainer():void{
    this.tabLayoutCntnrStyle ={
      'background-color': '#403c3c'
    }
  }

  unColorTabLayoutContainer():void{
    this.tabLayoutCntnrStyle ={
      'background-color': Constants.EMPTY_STRING
    }
  }

  onMouseEnterTabLayoutBtn(iconView:ViewOptions, id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,true);
    this.changeFileExplorerLayoutCSS(iconView);

    // this should be an update of the menuData, rather than a re-generation
    this.getFileExplorerMenuData()
  }

  onMouseLeaveTabLayoutBtn(id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,false);
    this.changeFileExplorerLayoutCSS(this.defaultviewOption);
  }

  onClickTabLayoutBtn(iconView:ViewOptions, id:number):void{
    this.currentViewOptionId = id;
    this.currentViewOption = iconView;
    this.defaultviewOption = iconView;

    this.changeTabLayoutIconCntnrCSS(id,true);

    for(let i = 1; i <= 8; i++){
      if(i !== id){
        this.changeTabLayoutIconCntnrCSS(i, false);
      }
    }
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

    if(inputViewOption === ViewOptions.LIST_VIEW || inputViewOption === ViewOptions.DETAILS_VIEW || 
      inputViewOption === ViewOptions.TILES_VIEW || inputViewOption === ViewOptions.CONTENT_VIEW){
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
                                        ViewOptions.EXTRA_LARGE_ICON_VIEW, ViewOptions.LIST_VIEW, ViewOptions.DETAILS_VIEW,
                                        ViewOptions.TILES_VIEW, ViewOptions.CONTENT_VIEW];

    const LayoutOptionsCSS:ViewOptionsCSS[] = [ViewOptionsCSS.ICONS_VIEW_CSS, ViewOptionsCSS.LIST_VIEW_CSS, 
                                              ViewOptionsCSS.DETAILS_VIEW_CSS, ViewOptionsCSS.TITLES_VIEW_CSS,
                                              ViewOptionsCSS.CONTENT_VIEW_CSS];

    const layoutIdx = layoutOptions.indexOf(iconSize);
    if(layoutIdx <= 3){
      this.olClassName = LayoutOptionsCSS[0];
    } else if (layoutIdx >= 4){
      /* the icon-views has various sizes, but it is still treated as one distinct layout. 
         So, options 0 - 3 in the layoutOptions = option 0 in the cssLayoutOptions */
      const idx = layoutIdx - 3;
      this.olClassName = LayoutOptionsCSS[idx];
    }
  }

  changeIconViewBtnSize(iconSize:ViewOptions):void{

    const icon_sizes:ViewOptions[] = [ViewOptions.SMALL_ICON_VIEW, ViewOptions.MEDIUM_ICON_VIEW, ViewOptions.LARGE_ICON_VIEW, 
                                      ViewOptions.EXTRA_LARGE_ICON_VIEW];

    const fig_img_sizes:string[] = ['30px', '45px', '80px', '96px']; //small, med, large, ext large
    const btn_width_height_sizes:string[][] = [['70px', '50px'], ['90px', '70px'], ['120px', '100px'], ['140px', '120px']];
    const shortCutIconSizes:string[][] = [['8', '-12'], ['12', '-8'], ['21', '1'],  ['25', '5']];

    const iconIdx = icon_sizes.indexOf(iconSize);

    for(let i = 0; i < this.fileExplrFiles.length; i++){
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

  async goUpAlevel():Promise<void>{
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
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

      let nextDirPath = this.upPathEntries.pop() ?? Constants.EMPTY_STRING;
      if(currentDirPath === nextDirPath){
        nextDirPath = this.upPathEntries.pop() ?? Constants.EMPTY_STRING;
        this.directory = nextDirPath;
        this.prevPathEntries.push(nextDirPath);
      }else{
        this.directory = nextDirPath;
        this.prevPathEntries.push(nextDirPath);
      }

      const folderName = basename(this.directory);

      if(this.upPathEntries.length === 0){
        this.isUpBtnActive = false;
        this.upNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFiles();
    }
  }

  toggleRibbonMenu():void{
    //this.showRibbonMenu = !this.showRibbonMenu
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
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    if(this.prevPathEntries.length > 0){
      const currentDirPath =  this.directory;

      if(this.recentPathEntries.indexOf(currentDirPath) === -1){
        this.recentPathEntries.push(currentDirPath);
      }

      const idx = this.upPathEntries.indexOf(currentDirPath);
      if(idx !== -1){
        this.upPathEntries.splice(idx, 1);
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

      let nextDirPath = this.prevPathEntries.pop() ?? Constants.EMPTY_STRING;
      if(currentDirPath === nextDirPath){
        nextDirPath = this.prevPathEntries.pop() ?? Constants.EMPTY_STRING;
        this.directory = nextDirPath;
      }else{
        this.directory = nextDirPath;
      }

      const folderName = basename(this.directory);

      if(this.prevPathEntries.length === 0){
        this.isPrevBtnActive = false;
        this.prevNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFiles();
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
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    if(this.nextPathEntries.length > 0){

      const currentDirPath =  this.directory;
      this.prevPathEntries.push(currentDirPath);
      this.isPrevBtnActive = true;
      this.prevNavBtnStyle ={
        'fill': '#fff'
      }

      const nextDirPath = this.directory = this.nextPathEntries.pop() ?? Constants.EMPTY_STRING;
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
      if(this.nextPathEntries.length === 0){
        this.isNextBtnActive = false;
        this.nextNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
      this.setNavPathIcon(folderName, this.directory);
      await this.loadFiles();
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
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.borderColor = Constants.EMPTY_STRING;
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
        btnElement.style.backgroundColor = Constants.EMPTY_STRING;
        btnElement.style.borderColor = Constants.EMPTY_STRING;
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
        btnElement.style.backgroundColor = Constants.EMPTY_STRING;
        btnElement.style.borderColor = Constants.EMPTY_STRING;
      }else{
        btnElement.style.borderColor = '#ccc';
        btnElement.style.backgroundColor = '#605c5c';
      }
    }
  }

  removePaneBtnStyle(id:string):void{
    const btnElement = document.getElementById(id) as HTMLDivElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.borderColor = Constants.EMPTY_STRING;
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

  onFileExplrCntntClick():void{
    this.hidePathTextBox();
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
        await this.loadFiles();
      }
    }
  }

  private async loadFiles(showUrlFiles=true):Promise<void>{
    this.fileExplrFiles = [];
    const directoryFiles  = await this._fileService.loadDirectoryFiles(this.directory);

    if(this.directory === Constants.ROOT){
      if(!showUrlFiles){
        this.fileExplrFiles.push(...directoryFiles.filter(x => x.getFileExtension !== Constants.URL))
      }else{
        this.fileExplrFiles.push(...directoryFiles.filter(x => x.getFileExtension === Constants.URL));
      }
    }else{
      this.fileExplrFiles.push(...directoryFiles.filter(x => x.getCurrentPath !== Constants.RECYCLE_BIN_PATH)); 
    }
  }

  private async loadFileTreeAsync():Promise<void>{
    if(this.isRecycleBinFolder) return;

    const usersDir = '/Users/';
    this.fileTreeNode = [];
    this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.readDirectory(usersDir);

    const osDrive:FileTreeNode = {
      name:Constants.OSDISK, path: Constants.ROOT, isFolder: true, children:[]
    }

    // this.directory, will not be correct for all cases. Make sure to check
    for(const dirEntry of directoryEntries){
      const isFile =  await this._fileService.isDirectory(usersDir + dirEntry);
      const ftn:FileTreeNode = {
        name : dirEntry,
        path : `${usersDir}${dirEntry}`,
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
      this._fileService.resetDirectoryFiles();
      const directoryEntries  = await this._fileService.readDirectory(path);
  
      // this.directory, will not be correct for all cases. Make sure to check
      for(const dirEntry of directoryEntries){
        const isFile =  await this._fileService.isDirectory(`${path}/${dirEntry}`.replace(Constants.DOUBLE_SLASH,Constants.ROOT));
        const ftn:FileTreeNode = {
          name : dirEntry,
          path: `${path}/${dirEntry}`.replace(Constants.DOUBLE_SLASH,Constants.ROOT),
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
    this.fileTreeNavToPath = Constants.EMPTY_STRING;

    this.hideFileExplorerToolTip();
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

      this.populateTraversalList();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
  
      await this.loadFiles();
    }else{
      //APPS opened from the fileexplore do not have their windows in focus,
      // and this is due to the mouse click event that causes fileexplorer to trigger setFocusOnWindow event
      setTimeout(() => {
        this._processHandlerService.startApplicationProcess(file);
      }, this.SECONDS_DELAY[4]);
    }
  }

  async navigateToFolder(data:string[]):Promise<void>{
    console.log('navigateToFolder:', data); 
    
    const quickAccess = 'Quick access';
    const thisPC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);
    const fileName = data[0];
    const path = data[1];

    if(!this.isNavigatedBefore){
      this.prevPathEntries.push(this.directory);
      this.upPathEntries.push(this.directory);
      this.isNavigatedBefore = true;
    }

    this.isPrevBtnActive = true;
    this.displayName = fileName;
    this.fileTreeNavToPath = path;
    this.directory = (path === thisPC || path === quickAccess)? Constants.ROOT : path;

    if(path === `/Users/${fileName}`)
      this.icon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
    else
      this.icon = `${Constants.IMAGE_BASE_PATH}folder.png`;

    this.prevPathEntries.push(this.directory);
    this.upPathEntries.push(this.directory);

    if(this.recentPathEntries.indexOf(this.directory) === -1){
      this.recentPathEntries.push(this.directory);
    }

    this.populateTraversalList();
    this.setNavPathIcon(fileName, path);
    this.storeAppState(path);

    if(path === thisPC || path !== Constants.ROOT)
      await this.loadFiles();
    else if(path === Constants.ROOT)
      await this.loadFiles(false);
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

  async onTriggerRunProcess():Promise<void>{
    await this.runProcess(this.selectedFile);
  }

  onBtnClick(evt:MouseEvent, id:number):void{
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);
    this.getSelectFileSizeSumAndUnit();

    evt.stopPropagation();
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next(); 
    this.hideFileExplorerToolTip();

    const menuHeight = 213; //this is not ideal.. menu height should be gotten dynmically
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

      const rect: DOMRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
      axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);
    }
    
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);

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

   if(file.getIsFile){
      if(editNotAllowed.includes(file.getCurrentPath.replace(Constants.ROOT, Constants.EMPTY_STRING))){
        this.menuOrder = Constants.FILE_EXPLORER_UNIQUE_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Cut' || x.label === 'Delete' || x.label === 'Rename'){ /*nothing*/}
          else{
            this.menuData.push(x);
          }
        }
      }else if(this.isRecycleBinFolder){
        this.menuOrder = Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Restore' || x.label === 'Cut' || x.label === 'Delete' || x.label === 'Properties'){
            this.menuData.push(x);
          }
        }
      }else{
        //files can not be opened in terminal, pinned to start, opened in new window, pin to Quick access
        this.menuOrder = Constants.FILE_EXPLORER_FILE_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Open in new window' || x.label === 'Pin to Start' || x.label === 'Restore'){ /*nothing*/}
          else{
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
        this.menuData = this.sourceData.filter(x => x.label !== 'Restore');
      }
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
      this._menuService.hideContextMenus.next();
    }

    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }
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

  onMouseEnter(evt:MouseEvent, file:FileInfo, id:number):void{
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;

      this.setBtnStyle(id, true);
      this.showFileExplorerToolTip(evt, file);
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

  setBtnStyle(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
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
  
  removeBtnStyle(id:number):void{
    const btnElement = document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
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

  doNothing():void{/** */}

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

    console.log(`path: ${cntntPath}`);
    console.log(`action: ${action}`);

    //onPaste will be modified to handle cases such as multiselect, file or folder or both

    if(action === MenuAction.COPY){
      const result = await this._fileService.copyAsync(cntntPath, this.directory);
      if(result){
        this.refresh();
      }
    }
    else if(action === MenuAction.CUT){
      const result = await this._fileService.moveAsync(cntntPath, Constants.DESKTOP_PATH);
      if(result){
        if(cntntPath.includes(Constants.DESKTOP_PATH)){
          this._fileService.addEventOriginator(Constants.DESKTOP);
          this._fileService.dirFilesUpdateNotify.next();

          await CommonFunctions.sleep((20));
          this.refresh();
        }else{
          this.refresh();
        }
      }
    }
  }

  async onRestore():Promise<void>{
    const delay = 30;
    const srcPath = this.selectedFile.getCurrentPath;
    const originPath = this._fileService.getFolderOrigin(srcPath);
    const destPath = dirname(originPath);
    const result = await this._fileService.moveAsync(srcPath, destPath, this.selectedFile.getIsFile, true);
    if(result){
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();

      await CommonFunctions.sleep(delay);
      this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
      this._fileService.dirFilesUpdateNotify.next();
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
        const file = this.fileExplrFiles[Number(id)];
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
      const file = this.fileExplrFiles[this.selectedElementId];
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

  onDragStart(evt:any):void{1 }

  onDragEnd(evt:any):void{1 }

  setFileExplorerWindowToFocus(pid: number):void {
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  async showFileExplorerToolTip_TBD(evt: MouseEvent,  file:FileInfo):Promise<void>{

    if(this.currentViewOption === ViewOptions.CONTENT_VIEW)
      return;

    const rect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    if (!infoTip) return;

    await this.setInformationTipInfo(file);

    // Position tooltip slightly to the right and below the cursor
    if(this.currentViewOption === ViewOptions.DETAILS_VIEW)
      infoTip.style.transform = `translate(${x - 25}px, ${y - 50}px)`;
    else
       infoTip.style.transform = `translate(${x - 15}px, ${y + 10}px)`;

    if (this.fileInfoTipData.length === 0) return;

    infoTip.classList.add('visible');
  }

  async showFileExplorerToolTip(evt: MouseEvent, file: FileInfo): Promise<void> {
    if (this.currentViewOption === ViewOptions.CONTENT_VIEW) return;

    const rect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    if (!infoTip) return;

    //this.fileInfoTipData = [];
    this.currentTooltipFileId = file.getCurrentPath;
    await this.setInformationTipInfo(file);

    if (this.fileInfoTipData.length === 0) return;

    requestAnimationFrame(() => {
      const offsetX = this.currentViewOption === ViewOptions.DETAILS_VIEW ? -25 : -15;
      const offsetY = this.currentViewOption === ViewOptions.DETAILS_VIEW ? -50 : 10;

      infoTip.style.transform = `translate(${x + offsetX}px, ${y + offsetY}px)`;
      infoTip.classList.add('visible');
    });
  }



  hideFileExplorerToolTip() {
    this.currentTooltipFileId = Constants.EMPTY_STRING;
    this.fileInfoTipData = [];

    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    if (infoTip) {
      infoTip.classList.remove('visible');
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
    const capitalizedDesktop = Constants.DESKTOP.charAt(0).toUpperCase();

    const fileAuthor = 'Relampago Del Catatumbo';
    const fileType = file.getFileType;
    const fileDateModified = file.getDateModifiedUS;
    const fileSize = `${String(file.getSize)}  ${file.getFileSizeUnit}`;
    const fileName = file.getFileName;
    const isFile = file.getIsFile;
    const currentPath = dirname(file.getCurrentPath);
    const isFolder = fileType === Constants.FOLDER;
    const isRoot = currentPath === Constants.ROOT;
    const localFileId = file.getCurrentPath

    //reset
    this.fileInfoTipData = [];

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
      const fileTypeName = this.getFileTypeName(fileType);
      this.fileInfoTipData.push({label:infoTipFields[7], data:fileTypeName});
      this.fileInfoTipData.push({label:infoTipFields[3], data: fileDateModified });
      this.fileInfoTipData.push({ label: infoTipFields[6], data: fileSize });
    }
    else if(isFolder){
      if(isRoot && (standardFolders.includes(fileName) || fileName === capitalizedDesktop)){
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

  async refresh():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
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
        if(this.directory === Constants.ROOT){
          this.pathForm.setValue({
            pathInput:Constants.ROOT
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

  populateTraversalList():void{
    const tmpArray = this.directory.split(Constants.ROOT).filter(x => x !== Constants.EMPTY_STRING);
    if(tmpArray.length === 0){ 
      tmpArray[0]= Constants.THISPC; 
    }
    else{ tmpArray.unshift(Constants.THISPC); }

    if(this.directory === Constants.RECYCLE_BIN_PATH){
      this._directoryTraversalList = [];
      this._directoryTraversalList.push(Constants.RECYCLE_BIN);
    }else  if(this.directory.includes('/Users')){
      this._directoryTraversalList = tmpArray;
    }else{
      tmpArray[1] = Constants.OSDISK;
      this._directoryTraversalList = tmpArray;
    }

    console.log('this._directoryTraversalList:', this._directoryTraversalList);
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

  async onRenameFileTxtBoxDataSave():Promise<void>{
    this.isRenameActive = !this.isRenameActive;

    const figCapElmnt= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameFormElmnt= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
     const renameTxtBoxElmnt= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;
    const renameText = this.renameForm.value.renameInput as string;

    if(renameText !== Constants.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName){

      const renameResult = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText,  this.selectedFile.getIsFile);
      if(renameResult){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        //const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getContentPath) && (f.getFileName == this.selectedFile.getFileName));
        const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getCurrentPath) && (f.getFileName == this.selectedFile.getFileName));
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now().toString();
        this.fileExplrFiles[fileIdx] = this.selectedFile;

        this.renameForm.reset();
        this._menuService.resetStoreData();
        await this.loadFiles();
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
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }

    this._sessionManagmentService.addAppSession(uid, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);

    if(appSessionData !== null  && appSessionData.app_data != Constants.EMPTY_STRING){
      this.directory = appSessionData.app_data as string;
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

  onProcessSelected(rowIndex:number, btnId:number):void{
    this.selectedRow = rowIndex;
    
    if(this.selectedRow !== -1){
      this.isActive = true;
      this.isFocus = true;
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

    this.sortIcons(sortBy);
    this.getFileExplorerMenuData();
  }

  sortIcons(sortBy:string):void {
    this.fileExplrFiles = CommonFunctions.sortIconsBy(this.fileExplrFiles, sortBy);
  }

  //Methods defined as class fields, you learn somthing new every day.
  private showExtraLargeIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isExtraLargeIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.EXTRA_LARGE_ICON_VIEW, 1);
  }

  private showLargeIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isLargeIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.LARGE_ICON_VIEW, 2);
  }

  private showMediumIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isMediumIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.MEDIUM_ICON_VIEW, 3);
  }

  private showSmallIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isSmallIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.SMALL_ICON_VIEW, 4);
  }

  private showListIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isListIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.LIST_VIEW, 5);
  }

  private showDetailsIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isDetailsIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.DETAILS_VIEW, 6);
  }

  private showTilesIconsM = ():void=>{
    this.setViewFlagsToFalse();
    this.isTitleIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.TILES_VIEW, 7);
  }

  private showContentIconsM = (evt:MouseEvent):void=>{
    this.setViewFlagsToFalse();
    this.isContentIcon = true;
    this.onMouseEnterTabLayoutBtn(ViewOptions.CONTENT_VIEW, 8);
  }

  setViewFlagsToFalse():void{
    this.isExtraLargeIcon = false;
    this.isLargeIcon = false;
    this.isMediumIcon = false;
    this.isSmallIcon = false;
    this.isListIcon = false;
    this.isDetailsIcon = false;
    this.isTitleIcon = false;
    this.isContentIcon = false;
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

    const listIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'List icons', action: this.showListIconsM,
     variables:this.isListIcon,  emptyline:false, styleOption:'A' }

    const detailsIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Details icons', action:this.showDetailsIconsM,
     variables:this.isDetailsIcon, emptyline:false, styleOption:'A' }

    const titlesIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Titles icons', action: this.showTilesIconsM, 
      variables:this.isTitleIcon,  emptyline:false, styleOption:'A' }

    const contentIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Content icons', action: (evt:MouseEvent) =>  this.showContentIconsM(evt), 
      variables:this.isContentIcon,  emptyline:false, styleOption:'A' }

    const viewByMenu = [extraLargeIcon, largeIcon, mediumIcon, smallIcon, listIcon, detailsIcon, titlesIcon, contentIcon];

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

  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    let fileContent = Constants.EMPTY_STRING;
    //const directory = '/';//(inputDir)? inputDir : this.directory;
    const directory = this.directory;


    if(selectedFile.getIsFile){
      fileContent = `[InternetShortcut]
FileName=${selectedFile.getFileName} - ${Constants.SHORTCUT}
IconPath=${selectedFile.getIconPath}
FileType=${selectedFile.getFileType}
ContentPath=${selectedFile.getContentPath}
OpensWith=${selectedFile.getOpensWith}
`;
    }else{
      //
    }


    if(directory === Constants.ROOT){
      const msg = `Cheetah can't create a shortcut here.
Do you want the shortcut to be placed on the desktop instead?`;

      await this._audioService.play(this.cheetahGenericNotifyAudio);
      this._menuService.setStageData(fileContent);
      this._userNotificationService.showWarningNotification(msg);
      return;
    }

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${Constants.SHORTCUT}${Constants.URL}`;
    const result = await this._fileService.writeFileAsync(this.directory, shortCut);
    if(result){
      await this.loadFiles();
    }
  }

  async createShortCutOnDesktop(): Promise<void>{
    const shortCut:FileInfo = new FileInfo();
    const fileContent = this._menuService.getStageData();
    const dsktpPath = Constants.DESKTOP_PATH;

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${this.selectedFile.getFileName} - ${Constants.SHORTCUT}${Constants.URL}`;
    const result = await this._fileService.writeFileAsync(dsktpPath, shortCut);
    if(result){
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}
