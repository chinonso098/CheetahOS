import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation, Input} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileInfo } from 'src/app/system-files/file.info';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Subscription } from 'rxjs';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { ViewOptions } from './fileexplorer.enums';
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
  private _directoryFilesEntires!:FileEntry[];
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

  _isBtnClickEvt= false;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = Constants.MINUS_ONE;
  private prevSelectedElementId = Constants.MINUS_ONE; 
  private hideCntxtMenuEvtCnt = Constants.NUM_ZERO;
  private btnClickCnt = Constants.NUM_ZERO;
  private renameFileTriggerCnt = Constants.NUM_ZERO; 
  private currentIconName = Constants.EMPTY_STRING;
  private blankSpaceClickCntr = Constants.NUM_ZERO; 

  isSearchBoxNotEmpty = false;
  showPathHistory = false;
  onClearSearchIconHover = false;
  onSearchIconHover = false;
  showIconCntxtMenu = false;
  showFileExplrCntxtMenu = false;
  showFileSizeAndUnit = false;
  iconCntxtCntr = Constants.NUM_ZERO;
  fileExplrCntxtCntr = Constants.NUM_ZERO;
  selectFilesSizeSum = Constants.EMPTY_STRING;
  selectFilesSizeUnit = Constants.EMPTY_STRING;
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

  olClassName = 'ol-iconview-grid';
  btnTypeRibbon = 'Ribbon';
  btnTypeFooter = 'Footer';


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
  currentViewOptionId = Constants.NUM_THREE;
  
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

  fileInfoTipData = [{label:Constants.EMPTY_STRING, data:Constants.EMPTY_STRING}];

  fileType = Constants.EMPTY_STRING;
  fileAuthor = Constants.EMPTY_STRING;
  fileSize = Constants.EMPTY_STRING;
  fileDimesions = Constants.EMPTY_STRING;
  fileDateModified = Constants.EMPTY_STRING;

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
  processId = Constants.NUM_ZERO;
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
        this.loadFilesInfoAsync();
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
    })
    this._goToDirectoryDataSub = this._fileService.goToDirectoryNotify.subscribe((p) => {
      const name = 'filetreeview-1';
      const uid = `${name}-${this.processId}`;
      if(this._fileService.getEventOriginator() === uid){
        if(!this.isRecycleBinFolder){
          this.navigateToFolder(p);
          this._fileService.removeEventOriginator();
        }
      }
    })

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
        this.getProperRecycleBinIcon();
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
    await this.loadFilesInfoAsync().then(()=>{
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


  getProperRecycleBinIcon():void{
    if(this.directory === Constants.RECYCLE_BIN_PATH){
      this.isRecycleBinFolder = true;

      // const count = await this._fileService.getCountOfFolderItemsAsync(Constants.RECYCLE_BIN_PATH);
      // this.icon  = (count === Constants.NUM_ZERO) 
      //   ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
      //   :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;

      this.icon  =  `${Constants.IMAGE_BASE_PATH}empty_bin.png`;
        
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

  onMouseEnterTabLayoutBtn(iconView:string, id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,true);
    this.changeFileExplorerLayoutCSS(iconView);
  }

  onMouseLeaveTabLayoutBtn(id:number):void{
    this.changeTabLayoutIconCntnrCSS(id,false);
    this.changeFileExplorerLayoutCSS(this.defaultviewOption);
  }

  onClickTabLayoutBtn(iconView:any, id:number):void{

    console.log('i was called');

    this.currentViewOptionId = id;
    this.currentViewOption = iconView;
    this.defaultviewOption = iconView;

    this.changeTabLayoutIconCntnrCSS(id,true);

    for(let i = Constants.NUM_ONE; i <= Constants.NUM_EIGHT; i++){
      if(i !== id){
        this.changeTabLayoutIconCntnrCSS(i, false);
      }
    }
  }

  toggleLargeIconsView():void{
    this.currentViewOption = this.largeIconsView;
    this.changeLayoutCss( this.currentViewOption );
    this.changeOrderedlistStyle( this.currentViewOption );
    this.changeIconViewBtnSize( this.currentViewOption );
  }

  toggleDetailsView():void{
    this.currentViewOption = this.detailsView;
    this.changeLayoutCss( this.currentViewOption );
    this.changeOrderedlistStyle( this.currentViewOption );
    this.changeIconViewBtnSize( this.currentViewOption );
  }

  changeFileExplorerLayoutCSS(inputViewOption:any):void{
    if(inputViewOption === this.smallIconsView || inputViewOption === this.mediumIconsView ||inputViewOption === this.largeIconsView || inputViewOption === this.extraLargeIconsView){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
      this.changeIconViewBtnSize(inputViewOption);
    }

    if(inputViewOption === this.listView || inputViewOption === this.detailsView || inputViewOption === this.tilesView || inputViewOption === this.contentView){
      this.currentViewOption = inputViewOption;
      this.changeLayoutCss(inputViewOption);
      this.changeOrderedlistStyle(inputViewOption);
    }
  }

  changeTabLayoutIconCntnrCSS(id:number, isMouseHover:boolean):void{
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
          btnElement.style.backgroundColor = Constants.EMPTY_STRING;
          btnElement.style.border = Constants.EMPTY_STRING;
          btnElement.style.margin = '0';
        }
      }    
    }
  }


  changeLayoutCss(iconSize:string):void{

    const layoutOptions:string[] = [this.smallIconsView, this.mediumIconsView, this.largeIconsView, this.extraLargeIconsView,
                              this.listView,this.detailsView,this.tilesView,this.contentView];
    const cssLayoutOptions:string[] = ['iconview', 'listview', 'detailsview', 'tilesview', 'contentview']
    const layoutIdx = layoutOptions.indexOf(iconSize)

    if(layoutIdx <= Constants.NUM_THREE){
      this.olClassName = 'ol-iconview-grid';
    }
    else if (layoutIdx >= Constants.NUM_FOUR){
      /*
         the icon-views has various sizes, but it is still treated as one distinct layout. 
         So, options 0 - 3 in the layoutOptions = option 0 in the cssLayoutOptions
       */
      const idx = layoutIdx - Constants.NUM_THREE;
      this.olClassName = `ol-${cssLayoutOptions[idx]}-grid`;
    }
  }

  changeIconViewBtnSize(iconSize:string):void{

    const icon_sizes:string[] = [this.smallIconsView, this.mediumIconsView, this.largeIconsView, this.extraLargeIconsView];
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
        btnElmnt.style.width = btn_width_height_sizes[iconIdx][Constants.NUM_ZERO];
        btnElmnt.style.height = btn_width_height_sizes[iconIdx][Constants.NUM_ONE];
      }

      if(imgElmnt){
        imgElmnt.style.width = fig_img_sizes[iconIdx];
        imgElmnt.style.height = fig_img_sizes[iconIdx];
      }

      if(figCapElmnt){
        figCapElmnt.style.width = btn_width_height_sizes[iconIdx][Constants.NUM_ZERO];
      }

      if(shortCutElmt){
        shortCutElmt.style.width = shortCutIconSizes[iconIdx][Constants.NUM_ZERO];
        shortCutElmt.style.height = shortCutIconSizes[iconIdx][Constants.NUM_ZERO];
        shortCutElmt.style.bottom = shortCutIconSizes[iconIdx][Constants.NUM_ONE];
      }
    }
  }

  changeOrderedlistStyle(iconView:string):void{
    const icon_sizes:string[] = [this.smallIconsView,this.mediumIconsView,this.largeIconsView,this.extraLargeIconsView];
    const btn_width_height_sizes = [['70px', '50px'], ['90px', '70px'], ['120px', '100px'],  ['140px', '120px']];
    const iconIdx = icon_sizes.indexOf(iconView);
    
    const olElmnt = document.getElementById(`olElmnt-${this.processId}`) as HTMLElement;

    if(iconView == this.smallIconsView || iconView == this.mediumIconsView ||iconView == this.largeIconsView || iconView == this.extraLargeIconsView){
      if(olElmnt){
        olElmnt.style.gridTemplateColumns = `repeat(auto-fill,${btn_width_height_sizes[iconIdx][Constants.NUM_ZERO]})`;
        olElmnt.style.gridTemplateRows = `repeat(auto-fill,${btn_width_height_sizes[iconIdx][Constants.NUM_ONE]})`;
        olElmnt.style.rowGap = '20px';
        olElmnt.style.columnGap = '5px';
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
    if(this.upPathEntries.length > Constants.NUM_ZERO){
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

      if(this.upPathEntries.length === Constants.NUM_ZERO){
        this.isUpBtnActive = false;
        this.upNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
      this.setNavPathIcon(folderName,this.directory);
      await this.loadFilesInfoAsync();
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
    if(this.prevPathEntries.length > Constants.NUM_ZERO){
      const currentDirPath =  this.directory;

      if(this.recentPathEntries.indexOf(currentDirPath) === Constants.MINUS_ONE){
        this.recentPathEntries.push(currentDirPath);
      }

      const idx = this.upPathEntries.indexOf(currentDirPath);
      if(idx != Constants.MINUS_ONE){
        this.upPathEntries.splice(idx, Constants.NUM_ONE);
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

      if(this.prevPathEntries.length === Constants.NUM_ZERO){
        this.isPrevBtnActive = false;
        this.prevNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
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
    if(this.nextPathEntries.length > Constants.NUM_ZERO){

      const currentDirPath =  this.directory;
      this.prevPathEntries.push(currentDirPath);
      this.isPrevBtnActive = true;
      this.prevNavBtnStyle ={
        'fill': '#fff'
      }

      const nextDirPath = this.directory = this.nextPathEntries.pop() ?? Constants.EMPTY_STRING;
      const idx = this.upPathEntries.indexOf(nextDirPath)

      if (idx !== Constants.MINUS_ONE) {
           this.upPathEntries.splice(idx, Constants.NUM_ONE);
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
      if(this.nextPathEntries.length === Constants.NUM_ZERO){
        this.isNextBtnActive = false;
        this.nextNavBtnStyle ={
          'fill': '#ccc'
        }
      }

      await this._audioService.play(this.cheetahNavAudio);
      this.populateTraversalList();
      this.setNavPathIcon(folderName, this.directory);
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
    
    if(droppedFiles.length >= Constants.NUM_ONE){
      const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
      if(result){
        await this.loadFilesInfoAsync();
      }
    }
  }

  private async loadFilesInfoAsync(showUrlFiles=true):Promise<void>{
    this.fileExplrFiles = [];
    this._fileService.resetDirectoryFiles();
    let directoryEntries  = await this._fileService.getDirectoryEntriesAsync(this.directory);

    //console.log('directoryEntries:',directoryEntries); //TBD

    if(this.directory === Constants.ROOT){
      if(!showUrlFiles){
        const filteredDirectoryEntries = directoryEntries.filter(x => !x.includes(Constants.URL));
        directoryEntries = filteredDirectoryEntries;
        this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(filteredDirectoryEntries,this.directory);
      }
      else{
        const filteredDirectoryEntries = directoryEntries.filter(x => x.includes(Constants.URL));
        directoryEntries = filteredDirectoryEntries;
        this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(filteredDirectoryEntries,this.directory); 
      }
    }else{
      this._directoryFilesEntires = this._fileService.getFileEntriesFromDirectory(directoryEntries,this.directory);
    }

    for(let i = 0; i < directoryEntries.length; i++){
      const fileEntry = this._directoryFilesEntires[i];
      const fileInfo = await this._fileService.getFileInfoAsync(fileEntry.getPath);

      if(fileInfo.getCurrentPath !== Constants.RECYCLE_BIN_PATH)
        this.fileExplrFiles.push(fileInfo)
    }
  }

  private async loadFileTreeAsync():Promise<void>{
    if(this.isRecycleBinFolder) return;

    const usersDir = '/Users/';
    this.fileTreeNode = [];
    this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.getDirectoryEntriesAsync(usersDir);

    const osDrive:FileTreeNode = {
      name:Constants.OSDISK, path: Constants.ROOT, isFolder: true, children:[]
    }

    // this.directory, will not be correct for all cases. Make sure to check
    for(const dirEntry of directoryEntries){
      const isFile =  await this._fileService.checkIfDirectoryAsync(usersDir + dirEntry);
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

    console.log('updateFileTreeAsync called', path);

    if(!this.fileTreeHistory.includes(path)){
      const tmpFileTreeNode:FileTreeNode[] = [];
      this._fileService.resetDirectoryFiles();
      const directoryEntries  = await this._fileService.getDirectoryEntriesAsync(path);
  
      // this.directory, will not be correct for all cases. Make sure to check
      for(const dirEntry of directoryEntries){
        const isFile =  await this._fileService.checkIfDirectoryAsync(`${path}/${dirEntry}`.replace(Constants.DOUBLE_SLASH,Constants.ROOT));
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

      if(this.recentPathEntries.indexOf(this.directory) === Constants.MINUS_ONE){
        this.recentPathEntries.push(this.directory);
      }

      this.populateTraversalList();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
  
      await this.loadFilesInfoAsync();
    }else{
      //APPS opened from the fileexplore do not have their windows in focus,
      // and this is due to the mouse click event that causes fileexplorer to trigger setFocusOnWindow event
      setTimeout(() => {
        this._processHandlerService.startApplicationProcess(file);
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
    this.directory = (path === thisPC)? Constants.ROOT : path;

    if(path === `/Users/${fileName}`)
      this.icon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
    else
      this.icon = `${Constants.IMAGE_BASE_PATH}folder.png`;

    this.prevPathEntries.push(this.directory);
    this.upPathEntries.push(this.directory);

    if(this.recentPathEntries.indexOf(this.directory) == -1){
      this.recentPathEntries.push(this.directory);
    }

    this.populateTraversalList();
    this.setNavPathIcon(fileName, path);
    this.storeAppState(path);

    if(path === thisPC || path !== Constants.ROOT)
      await this.loadFilesInfoAsync();
    else if(path === Constants.ROOT)
      await this.loadFilesInfoAsync(false);
  }

  setNavPathIcon(fileName:string, directory:string):void{
    console.log(`fileexplorer - setNavPathIcon: fileName:${fileName} -----  directory:${directory}`)

    if(directory === `/Users/${fileName}` || directory === Constants.RECYCLE_BIN_PATH){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder_small.png`;
    }
    else if((fileName === 'OSDisk (C:)' && directory === Constants.ROOT)){
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
    this._audioService.play(this.cheetahNavAudio);
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

    const rect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const axis = this.checkAndHandleMenuBounds(rect, evt, menuHeight);
    
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
      'transform':`translate(${String(axis.xAxis)}px, ${String(axis.yAxis)}px)`,
      'z-index': Constants.NUM_TWO,
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
      'z-index': Constants.NUM_TWO,
    }

    evt.preventDefault();
    evt.stopPropagation();
  }


  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  hideIconContextMenu(evt?:MouseEvent, caller?:string):void{
    this.showIconCntxtMenu = false;
    this.showFileExplrCntxtMenu = false;
    this.isShiftSubMenuLeft = false;
    this.iconCntxtCntr = Constants.NUM_ZERO;
    this.fileExplrCntxtCntr = Constants.NUM_ZERO;
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
    if((this.getIsBtnClickEvt() && this.btnClickCnt >= Constants.NUM_ONE) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt === Constants.NUM_ZERO)){  
      
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= Constants.NUM_ZERO)
          this.setBtnStyle(this.selectedElementId, false);
      }
      if(!this.isRenameActive){
        this.btnClickCnt = Constants.NUM_ZERO;
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
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= Constants.NUM_ONE) && (!this.getIsBtnClickEvt() && this.btnClickCnt === Constants.NUM_ZERO)){
        this.isIconInFocusDueToCurrentAction = false;
        this.blankSpaceClickCntr++;

        if(!this.areMultipleIconsHighlighted){
          console.log('Second Case Triggered:', this.areMultipleIconsHighlighted);
          this.btnStyleAndValuesChange();
        }

        //reset after clicking on the folder 2wice
        if(this.blankSpaceClickCntr >= Constants.NUM_ONE && !this.areMultipleIconsHighlighted){
          this.blankSpaceClickCntr = Constants.NUM_ZERO;
        }else if(this.blankSpaceClickCntr >= Constants.NUM_TWO && this.areMultipleIconsHighlighted){
          console.log('turn off - fileExplr areMultipleIconsHighlighted-1')
  
          this.removeClassAndStyleFromBtn();
          this.btnStyleAndValuesChange();

          this.markedBtnIds = [];
          this.areMultipleIconsHighlighted = false;
          this.blankSpaceClickCntr = Constants.NUM_ZERO;
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
    this.hideCntxtMenuEvtCnt = Constants.NUM_ZERO;
   
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
    if(btnElement){
      btnElement.style.backgroundColor = '#4c4c4c';
      btnElement.style.border = '0.5px solid #3c3c3c';

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
          btnElement.style.backgroundColor = Constants.EMPTY_STRING;
          btnElement.style.border = '0.5px solid white'
        }
      }
    }
  }

  btnStyleAndValuesReset():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesReset');
    this.btnClickCnt = Constants.NUM_ZERO;
    this.removeBtnStyle(this.selectedElementId);
    this.removeBtnStyle(this.prevSelectedElementId);
    this.selectedElementId = Constants.MINUS_ONE;
    this.prevSelectedElementId = Constants.MINUS_ONE;
    this.btnClickCnt = Constants.NUM_ZERO;
    this.isIconInFocusDueToPriorAction = false;
  }

  btnStyleAndValuesChange():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesChange');
    this.btnClickCnt = Constants.NUM_ZERO;
    this.prevSelectedElementId = this.selectedElementId;
    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
    this.setBtnStyle(this.selectedElementId, false);
    //this.removeBtnStyle(this.prevSelectedElementId);
  }
  
  removeBtnStyle(id:number):void{
    const btnElement = document.getElementById(`btnElmnt-${this.processId}-${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.border = '0.5px solid transparent'
    }
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

          await CommonFunctions.sleep((Constants.NUM_TWENTY));
          this.refresh();
        }else{
          this.refresh();
        }
      }
    }
  }

  async onRestore():Promise<void>{
    const srcPath = this.selectedFile.getCurrentPath;
    const originPath = this._fileService.getFolderOrigin(srcPath);
    const destPath = dirname(originPath);
    const result = await this._fileService.moveAsync(srcPath, destPath, this.selectedFile.getIsFile, true);
    if(result){
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();

      await CommonFunctions.sleep((Constants.NUM_FIFTEEN * Constants.NUM_TWO));
      this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
      this._fileService.dirFilesUpdateNotify.next();
    }
  }

  checkAndHandleMenuBounds(rect:DOMRect, evt:MouseEvent, menuHeight:number):MenuPosition{
    let xAxis = Constants.NUM_ZERO;
    let yAxis = Constants.NUM_ZERO;
    let horizontalShift = false;
    let verticalShift = false;

    const horizontalMax = rect.right
    const verticalMax = rect.bottom;
    const horizontalDiff =  horizontalMax - evt.clientX;
    const verticalDiff = verticalMax - evt.clientY;
    const menuWidth = 210;
    const subMenuWidth = 205;
    const taskBarHeight = Constants.NUM_FIVE;

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

  shiftViewSubMenu():void{ this.shiftNestedMenuPosition(Constants.NUM_ZERO); }

  shiftSortBySubMenu():void{this.shiftNestedMenuPosition(Constants.NUM_ONE);  }

  shiftNewSubMenu():void { this.shiftNestedMenuPosition(Constants.NUM_SIX); }

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
      this.setDivWithAndSize(this.multiSelectElmnt, Constants.NUM_ZERO, Constants.NUM_ZERO, Constants.NUM_ZERO, Constants.NUM_ZERO, false);
    }

    this.multiSelectElmnt = null;
    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    const markedBtnCount = this.getCountOfAllTheMarkedButtons();
    if(markedBtnCount === Constants.NUM_ZERO)
      this.areMultipleIconsHighlighted = false;
    else{
      this.areMultipleIconsHighlighted = true;
      this.getIDsOfAllTheMarkedButtons();
    }
    this.getSelectFileSizeSumAndUnit();
  }

  updateDivWithAndSize(evt:MouseEvent):void{
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
    let sum = Constants.NUM_ZERO;

    if(this.markedBtnIds.length > Constants.NUM_ZERO){
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
      if(file.getIsFile){
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
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  showFileExplorerToolTip(evt: MouseEvent,  file:FileInfo) {
    const rect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    if (!infoTip) return;

    this.setInformationTipInfo(file);

    // Position tooltip slightly to the right and below the cursor
    infoTip.style.transform = `translate(${x - Constants.NUM_FIFTEEN}px, ${y + Constants.NUM_TEN}px)`;

    // Show it using class
    infoTip.classList.add('visible');
  }

  hideFileExplorerToolTip() {
    const infoTip = document.getElementById(`fx-information-tip-${this.processId}`) as HTMLDivElement;
    if (infoTip) {
      infoTip.classList.remove('visible');
    }
  }

  setInformationTipInfo(file:FileInfo):void{
    const infoTipFields = ['Author:', 'Item type:','Date created:','Date modified:', 'Dimesions:', 'General', 'Size:','Type:'];
    const fileAuthor = 'Relampago Del Catatumbo';
    const fileType = file.getFileType;
    const fileDateModified = file.getDateModifiedUS;
    const fileSize = `${String(file.getSize)}  ${file.getFileSizeUnit}`;
    const fileName = file.getFileName;
    const isFile = file.getIsFile;

    //reset
    this.fileInfoTipData = [];

    if(Constants.IMAGE_FILE_EXTENSIONS.includes(file.getFileType)){
      const img = new Image();
      img.src = file.getContentPath;
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const imgDimensions = `${width} x ${height}`;

        this.fileInfoTipData.push({label:infoTipFields[1], data:`${file.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING).toLocaleUpperCase()} File`});
        this.fileInfoTipData.push({label:infoTipFields[4], data:imgDimensions })
        this.fileInfoTipData.push({label:infoTipFields[6], data:fileSize })
      };
      img.onerror = (err) => {
        console.error("Failed to load image", err);
      };
    }

    if(isFile && fileType !== Constants.FOLDER){
      const fileTypeName = this.getFileTypeName(fileType);
      this.fileInfoTipData.push({label:infoTipFields[7], data:fileTypeName});
      this.fileInfoTipData.push({label:infoTipFields[3], data: fileDateModified });
      this.fileInfoTipData.push({label:infoTipFields[6], data:fileSize });
    }

    if(fileType === Constants.FOLDER){
      if(fileName === Constants.DESKTOP.charAt(Constants.NUM_ZERO).toUpperCase() || fileName === 'Documents' || fileName === 'Downloads'){
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified })
      }else if(fileName === 'Music'){
        this.fileInfoTipData.push({label:Constants.EMPTY_STRING, data:'Contains music and other audio files' })
      }else if(fileName === 'Videos'){
        this.fileInfoTipData.push({label:Constants.EMPTY_STRING, data:'Contains movies and other video files' })
      }else if(fileName === 'Pictures' ){
        this.fileInfoTipData.push({label:Constants.EMPTY_STRING, data:'Contains digital photos, images and graphic files'})
      }else{
        this.fileInfoTipData.push({label:infoTipFields[7], data:fileType });
        this.fileInfoTipData.push({label:infoTipFields[2], data:fileDateModified });
      }
    }
  }

  getFileTypeName(fileExt:string):string{
    for(const map of Constants.FILE_EXTENSION_MAP){
      if(map[Constants.NUM_ZERO] === fileExt) {
         return map[Constants.NUM_ONE];
      }
    }

    return 'Unknown File';
  }

  async refresh():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
    await this.loadFilesInfoAsync();
  }

  async onDeleteFile():Promise<void>{
    const desktopRefreshDelay = 1000;
    let result = false;

    result = await this._fileService.deleteAsync(this.selectedFile.getCurrentPath, this.selectedFile.getIsFile);
    if(result){
      this._menuService.resetStoreData();
      await this.loadFilesInfoAsync();

      await CommonFunctions.sleep(desktopRefreshDelay)
      this._fileService.addEventOriginator(Constants.DESKTOP);
      this._fileService.dirFilesUpdateNotify.next();
    }
  }


  onKeyPress(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_.]+$';
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

  autoResize() {
    const renameTxtBoxElmt = document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLTextAreaElement;
    if(renameTxtBoxElmt){
      renameTxtBoxElmt.style.height = 'auto'; // Reset the height
      renameTxtBoxElmt.style.height = `${renameTxtBoxElmt.scrollHeight}px`; // Set new height
    }
  }

  onInputChange():void{
    const SearchTxtBox = document.getElementById(`searchTxtBox-${this.processId}`) as HTMLInputElement;
    const charLength = SearchTxtBox.value.length
    if( charLength > Constants.NUM_ZERO){
      this.isSearchBoxNotEmpty = true;
    }else if( charLength <= Constants.NUM_ZERO){
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
    if(tmpArray.length === Constants.NUM_ZERO){ 
      tmpArray[Constants.NUM_ZERO]= Constants.THISPC; 
    }
    else{ tmpArray.unshift(Constants.THISPC); }

    if(this.directory === Constants.RECYCLE_BIN_PATH){
      this._directoryTraversalList = [];
      this._directoryTraversalList.push(Constants.RECYCLE_BIN);
    }else  if(this.directory.includes('/Users')){
      this._directoryTraversalList = tmpArray;
    }else{
      tmpArray[Constants.NUM_ONE] = Constants.OSDISK;
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
      if(this.renameFileTriggerCnt > Constants.NUM_ONE){
        this.onRenameFileTxtBoxHide();
        this.renameFileTriggerCnt = Constants.NUM_ZERO;
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

    if(renameText !== Constants.EMPTY_STRING && renameText.length !== Constants.NUM_ZERO && renameText !== this.currentIconName){
      const result = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText,  this.selectedFile.getIsFile);

      if(result){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        //const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getContentPath) && (f.getFileName == this.selectedFile.getFileName));
        const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath == this.selectedFile.getCurrentPath) && (f.getFileName == this.selectedFile.getFileName));
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now();
        this.fileExplrFiles[fileIdx] = this.selectedFile;

        this.renameForm.reset();
        this._menuService.resetStoreData();
        await this.loadFilesInfoAsync();
      }
    }else{
      this.renameForm.reset();
    }

    this.setBtnStyle(this.selectedElementId, false);
    this.renameFileTriggerCnt = Constants.NUM_ZERO;

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
      if(this.searchHistory.length > Constants.NUM_ZERO){
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
        if(this.pathHistory.length > Constants.NUM_ZERO){
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
    this.onMouseEnterTabLayoutBtn(this.extraLargeIconsView, Constants.NUM_ONE);
  };

  private showLargeIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.largeIconsView, Constants.NUM_TWO);
   
  }

  private showMediumIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.mediumIconsView, Constants.NUM_THREE);
   
  }

  private showSmallIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.smallIconsView, Constants.NUM_FOUR);
   
  }

  private showListIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.listView, Constants.NUM_FIVE);
   
  }

  private showDetailsIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.detailsView, Constants.NUM_SIX);
    
  }

  private showTilesIconsM = ():void=>{
    this.onMouseEnterTabLayoutBtn(this.tilesView, Constants.NUM_SEVEN);
    
  }

  private showContentIconsM = (evt:MouseEvent):void=>{
    this.onMouseEnterTabLayoutBtn(this.contentView, Constants.NUM_EIGHT);
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
      variables:this.isTitleIcon,  emptyline:false, styleOption:'A' }

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

    return sortByMenu
  }

  buildNewMenu(): NestedMenuItem[]{
    const newFolder:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action:()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const textEditor:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}text_editor.png`, label:'Rich Text',  action:  ()=> console.log(),  variables:true , 
      emptyline:false, styleOption:'C' }

    const sortByMenu = [newFolder, textEditor ]

    return sortByMenu
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

      this._audioService.play(this.cheetahGenericNotifyAudio);
      this._menuService.setStageData(fileContent);
      this._userNotificationService.showWarningNotification(msg);
      return;
    }

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${Constants.SHORTCUT}${Constants.URL}`;
    const result = await this._fileService.writeFileAsync(this.directory, shortCut);
    if(result){
      await this.loadFilesInfoAsync();
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
