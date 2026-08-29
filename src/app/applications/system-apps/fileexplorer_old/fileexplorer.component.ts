/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ViewChildren, QueryList, ElementRef, ViewEncapsulation, Input} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { QuickAccessService } from 'src/app/shared/system-service/quick.access.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { ClipboardService } from 'src/app/application-services/clipboard.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import {basename, dirname} from 'path';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';
import { GeneralMenu, NestedMenu, NestedMenuItem } from 'src/app/shared/system-ui-components/menu/menu.types';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { SortBys, ActivityType, UserNotificationType } from 'src/app/system-files/commons/common.enums';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileTreeNode, DragEventInfo } from 'src/app/system-files/commons/common.interfaces';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';
import { ViewOptionsCSS, ViewOptions, FileToolTip } from './fileexplorer.types';
import { DialogTitle, DialogMessage } from 'src/app/shared/system-ui-components/dialog/dialog.types';
import { FileExplorerPathHelper } from './fileexplorer.path.helper';
import { FileExplorerContextMenuHelper } from './fileexplorer.context.menu.helper';
import { FileExplorerFileTreeHelper } from './fileexplorer.file.tree.helper';
import { FileExplorerSearchHelper } from './fileexplorer.search.helper';
import { FileExplorerMultiSelectHelper } from './fileexplorer.multi.select.helper';
import { FileExplorerKeyboardHelper } from './fileexplorer.keyboard.helper';
import { FileExplorerTooltipHelper } from './fileexplorer.tooltip.helper';

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
  // The main-grid <ol>, made focusable (tabindex=0) so arrow/Enter keys reach
  // onFileExplorerKeyDown. Optional because it only exists in the non-default view.
  @ViewChild('fileExplorerListContainer', {static: false}) fileExplrListCntnr?: ElementRef<HTMLOListElement>;
  // Relocated to document.body in ngAfterViewInit so it can overflow the window
  // (every ancestor up to the window uses overflow:hidden + transform).
  @ViewChild('infoTipContainer', {static: false}) infoTipContainer?: ElementRef<HTMLElement>; 
  // The icon + empty-space context menus are relocated to document.body when
  // opened so they can extend past the window's clipped/transformed edges
  // (mirrors the tooltip fix). Each per-section cos-menu shares one ref name;
  // only one is ever rendered at a time (sections are mutually exclusive), so
  // ViewChild resolves the active one.
  @ViewChild('iconCtxMenu', {static: false, read: ElementRef}) iconCtxMenuRef?: ElementRef<HTMLElement>;
  @ViewChild('fileCtxMenu', {static: false, read: ElementRef}) fileCtxMenuRef?: ElementRef<HTMLElement>;
  // The address-bar input (Refactor: replaces document.getElementById('pathTxtBox-'+pid)).
  @ViewChild('pathInputRef', {static: false}) pathInputRef?: ElementRef<HTMLInputElement>;
  // One entry per rendered row, in *ngFor order, for whichever view template is
  // active — the view templates are mutually exclusive, so the QueryList index
  // always lines up with fetchedFiles. Replaces the global
  // document.querySelectorAll('.iconview-button') scan used by the lasso.
  @ViewChildren('iconBtn') iconBtnRefs!: QueryList<ElementRef<HTMLElement>>;

  @Input() priorUId = Constants.EMPTY_STRING;
 
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _fileService!:FileService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _userNotificationService!:UserNotificationService;
  private _clipboardService!:ClipboardService;
  private _windowService!:WindowService;
  private _menuService!:MenuService;
  private _audioService!:AudioService;
  private _systemNotificationService!:SystemNotificationService;
  private _activityHistoryService!:ActivityHistoryService;
  private _quickAccessService!:QuickAccessService;
  private _defaultService!:DefaultService;
  private _themeService!:ThemeService;
  private _formBuilder!:FormBuilder;
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
  private _folderOptionsSub!: Subscription;
  private _themeChangeSub!: Subscription;
  

  // public (was private): bound in the template via [class.fx-nav-enabled] to
  // drive the nav-button icon fill/hover in CSS (replaces the imperative
  // prev/next/upNavBtnStyle [style] fill bindings).
  isPrevBtnActive = false;
  isNextBtnActive = false;
  isUpBtnActive = true;
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
  // Class-based highlight state. `*Section` disambiguates the coexisting index
  // spaces in the This-PC default view (folders / devices / quick-access) so a
  // shared index never cross-highlights across sections.
  hoveredElementId = -1;
  hoveredSection = Constants.EMPTY_STRING;
  selectedSection = Constants.EMPTY_STRING;
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private currentIconName = Constants.EMPTY_STRING;
  private blankSpaceClickCntr = 0; 

  readonly capacity = Constants.STORAGE_CAPACITY;
  usedCapacity = 0;
  availableCapacityText = Constants.EMPTY_STRING;

  isShowFileNameWarning = false;
  isSearchBoxNotEmpty = false;
  showPathHistory = false;
  // (Refactor) address-bar edit mode + search-history dropdown visibility, bound
  // via [style.display] instead of document.getElementById(...).style.display.
  isPathEditing = false;
  isSearchHistoryVisible = false;
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
  readonly QUICK_ACCESS = Constants.QUICK_ACCESS;
  fileTreeNavToPath = Constants.EMPTY_STRING

  fileExplrCntxtMenuStyle:Record<string, unknown> = {};
  // (Refactor #11.f) CSS `transform` for the invalid-chars warning tooltip,
  // bound via [style.transform] on .tool-tip-container. Replaces the previous
  // `document.getElementById('invalidChars-' + processId).style.transform = ...`
  // pattern. Per-instance, so two open FileExplorers cannot reposition each
  // other's tooltip.
  invalidCharsTooltipTransform = Constants.EMPTY_STRING;

  olClassName = ViewOptionsCSS.ICONS_VIEW_CSS;
  // Second CSS class on the <ol> (alongside olClassName): view-small/-medium/
  // -large/-xlarge for icon views, or view-list/-details/-tiles/-content
  // otherwise. Drives all per-icon-size geometry via .ol-iconview-grid.view-*
  // CSS rules, replacing the old imperative changeIconViewBtnSize/
  // changeOrderedlistStyle DOM loops. Bound via [ngClass]="[olClassName, viewSizeClass]".
  viewSizeClass = 'view-medium';
  btnTypeRibbon = 'Ribbon';
  btnTypeFooter = 'Footer';
  selectedRow = -1;
  // Approx context-menu heights (px) used to keep the menu inside the content
  // area. Ideally measured from the rendered menu; these named constants at
  // least replace the bare magic numbers at the call sites.
  private readonly CTX_MENU_HEIGHT_FILE = 225;
  private readonly CTX_MENU_HEIGHT_FOLDER = 344;
  private readonly CTX_MENU_HEIGHT_EXPLORER = 230;

  fetchedFiles:FileInfo[] = [];
  frequentFolders:FileInfo[] = [];
  recentFiles:FileInfo[] = [];
  devicesAndDrivesFiles:FileInfo[] = [];

  fileTreeNode:FileTreeNode[] = [];
  _fileInfo!:FileInfo;
  readonly ZIP = '.zip';
  // Non-empty while a .zip is mounted and being browsed as a folder.
  mountPath:string = Constants.EMPTY_STRING;
  prevPathEntries:string[] = [];
  nextPathEntries:string[] = [];
  recentPathEntries:string[] = [];
  upPathEntries:string[] = [Constants.DESKTOP_PATH];
  _directoryTraversalList:string[] = [Constants.THISPC];
  fileTreeHistory:string[] = [];


  invalidCharTimeOutId!: NodeJS.Timeout;
  // Hover-pause (ms) before the MouseStop directive fires the file-info tooltip.
  readonly TOOL_TIP_DELAY = 450;
  // Time to let a freshly-created icon's *ngFor row paint before opening its
  // in-place rename textbox (the figCap/renameForm/renameTxtBox elements the
  // rename reads by id must exist first).
  private readonly NEW_ICON_RENDER_DELAY = 100; //100ms
  readonly GENERIC_SECONDS_DELAY= 100;
  readonly APP_TRIGGER_SECONDS_DELAY = 500;
  readonly IMAGE_CAPTURE_SECONDS_DELAY = 500;
  readonly INVALID_CHARS_SECONDS_DELAY = 6000;
  
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
  showDefaultView = false;

  openFileExplorerTo = Constants.EMPTY_STRING;
  openFolderInSameWindow = false;
  showHiddenFilesAndFolders = false;
  showFileExtensions = false;
  displayFullPathInTitleBar = false;
  showRecentlyUsedFiles = false;
  showFrequentlyUsedFolders = false;

  renameForm!: FormGroup;
  pathForm!: FormGroup;
  searchForm!: FormGroup;

  searchHistory =['Java','ProgramFile', 'Perenne'];
  pathHistory =['/Users/Vidoes','/Users/Games', '/Users/Music'];

  // Incremental-search state (ported from the pared-down build).
  isSearching = false;                                    // walk in progress -> loading overlay
  isShowingSearchResults = false;                         // results shown instead of the listing
  private _searchIndexCache = new Map<string, FileInfo[]>(); // memoized per-directory walks

  sourceData:GeneralMenu[] = [
    {icon:Constants.EMPTY_STRING, label: MenuAction.OPEN, action: this.onTriggerRunApplication.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.OPEN_WITH, action: this.showOpenWithDialog.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.OPEN_IN_NEW_WINDOW, action: this.openInANewWindow.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.PIN_TO_QUICK_ACCESS, action: this.pinToQuickAccess.bind(this) },
    {icon:`${Constants.IMAGE_BASE_PATH}terminal.png`, label: MenuAction.OPEN_IN_TERMINAL, action: this.openInTerminal.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.PIN_TO_START, action: this.doNothing.bind(this) },
    {icon:`${Constants.IMAGE_BASE_PATH}send_to_zip.png`, label: MenuAction.SEND_TO_ZIP, action: this.onZip.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.EXTRACT_ALL, action: this.onUnZip.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.CUT, action: this.onCut.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.COPY, action: this.onCopy.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.CREATE_SHORTCUT, action: this.createShortCut.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.DELETE, action: this.onDeleteFile.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.RENAME, action: this.onRenameFileTxtBoxShow.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.RESTORE, action: this.onRestore.bind(this) },
    {icon:Constants.EMPTY_STRING, label: MenuAction.PROPERTIES, action: this.showPropertiesWindow.bind(this) }
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
  // File-info tooltip position (viewport coords, the tip lives on document.body)
  // and visibility — bound via [style.left.px]/[style.top.px]/[class.visible].
  infoTipLeftPx = 0;
  infoTipTopPx = 0;
  isInfoTipVisible = false;

  readonly shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;
  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;

  fileExplorerBoundedRect!:DOMRect;
  multiSelectStartingPosition!:MouseEvent | null;
  // Lasso pane geometry — bound in the template (CSS-driven, no DOM mutation).
  lassoVisible = false;
  lassoLeftPx = 0;
  lassoTopPx = 0;
  lassoWidthPx = 0;
  lassoHeightPx = 0;

  markedBtnIds: Set<number> = new Set<number>();
  movedBtnIds:string[] = [];

  icon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
  navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
  isMaximizable = true;
  // Minimum resize dimensions (px) handed to <cos-primarywindow>. The window is
  // always resizable; these just set the lower bound (and enabling isMaximizable
  // turns on the maximize button).
  readonly MIN_WIDTH_PX = 560;
  // 360 = the root container's min-height (330px) + the 30px window title bar.
  // The window may be resized down to this height but no lower: going lower would
  // shrink the projected content slot (windowHeight - 30px titlebar) below the
  // root's 330px min-height, so the root overflows the slot's `overflow: clip`
  // and the fixed footer (the last flex child) gets cut off. Keep this in sync
  // with .file_explrorer_root_container min-height in the CSS.
  readonly MIN_HEIGHT_PX = 360;
  readonly name = 'fileexplorer';
  processId = 0;
  type = ComponentType.System;
  directory = Constants.ROOT;
  displayName = 'fileexplorer';
  hasWindow = true;

  // Bound to .fx-theme-light on the root container and on the body-relocated
  // information tip; ViewEncapsulation.None rules out the :host(.theme-light)
  // pattern the other file explorer uses.
  isLightTheme = false;



  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService, 
              triggerProcessService:ProcessHandlerService, formBuilder: FormBuilder, sessionManagementService:SessionManagementService, 
              menuService:MenuService, notificationService:UserNotificationService, windowService:WindowService, 
              audioService:AudioService, systemNotificationService:SystemNotificationService, activityHistoryService:ActivityHistoryService,
              quickAccessService:QuickAccessService, defaultService:DefaultService, clipboardService:ClipboardService,
              themeService:ThemeService) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileService = fileService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagementService = sessionManagementService;
    this._menuService = menuService;
    this._clipboardService = clipboardService;
    this._userNotificationService = notificationService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._systemNotificationService = systemNotificationService;
    this._activityHistoryService = activityHistoryService;
    this._quickAccessService = quickAccessService;
    this._defaultService = defaultService;
    this._themeService = themeService;
    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
    this.initFolderOptions();

    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });

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
          this.navigateToDirectory(p);
          this._fileService.removeEventOriginator();
        }
      }
    });

    // Maximize / minimize / restore are handled entirely by the window shell plus
    // the flexbox CSS now (root fills the window at height:100%, the main + content
    // areas flex to fill, the footer is a fixed-height flex item). The old
    // imperative height-setting subscriptions + maximizeWindow()/minimizeWindow()
    // were removed — they wrote fixed px heights that overrode the flex layout and
    // broke resize.
    // API drift: MenuService.hideContextMenus (broadcast "close everyone but me")
    // was replaced by the targeted closeContextMenu Subject. A surface now closes
    // only when the emitted uId matches its own.
    const ctxMenuUId = `${this.name}-${this.processId}`;
    this._hideContextMenuSub = this._menuService.closeContextMenu.subscribe((ownerUId:string) => {
      if(ownerUId === ctxMenuUId)
        this.hideIconContextMenu();
    });

    // Keeps already-open windows in sync with the Folder Options dialog.
    this._folderOptionsSub = this._defaultService.defaultSettingsChangeNotify.subscribe((p) => {
      if(p === Constants.DEFAULT_OPEN_FILE_EXPLORER_TO){
        // Read on the next open / root navigation, so nothing to re-render here.
        this.openFileExplorerTo =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FILE_EXPLORER_TO) || Constants.OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;
      }

      if(p === Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW){
        this.openFolderInSameWindow =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW) !== Constants.FALSE;
      }

      if(p === Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS){
        this.showHiddenFilesAndFolders =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS) === Constants.TRUE;

        console.log(`File Explorer: showHiddenFilesAndFolders changed to ${this.showHiddenFilesAndFolders}`);
      }

      if(p === Constants.DEFAULT_SHOW_FILE_EXTENSIONS){
        this.showFileExtensions =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FILE_EXTENSIONS) === Constants.TRUE;
      }

      if(p === Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR){
        this.displayFullPathInTitleBar =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR) === Constants.TRUE;
        this.generateBreadCrumbs(this.fileTreeNavToPath);
      }

      if(p === Constants.DEFAULT_SHOW_RECENTLY_USED_FILES){
        this.showRecentlyUsedFiles =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_RECENTLY_USED_FILES) !== Constants.FALSE;
      }

      if(p === Constants.DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS){
        this.showFrequentlyUsedFolders =
          this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS) !== Constants.FALSE;
      }
    })
  }

  ngOnInit():void{
    this.retrievePastSessionData();

    if(!this._fileInfo || this._fileInfo.getOpensWith !== Constants.FILE_EXPLORER) return;
        
    const fileName = (this._fileInfo.getFileName === Constants.EMPTY_STRING)? Constants.NEW_FOLDER : this._fileInfo.getFileName;
    this.displayName = fileName;

    // is this a URL or an Actual Folder
    if(!this._fileInfo.getIsFile 
      && !this._fileInfo.getIsShortCut 
      && this._fileInfo.getFileExtension !== Constants.URL){ //Actual Folder, use the current path to load the files
        
      this.directory = this._fileInfo.getCurrentPath;
      this.generateBreadCrumbs();
      this.checkAndSetIfRecycleBin();
      this.setNavPathIcon(fileName, this._fileInfo.getCurrentPath);
    }
    else{ // URL or Shortcut, use the content path to load the files
      const path = CommonFunctions.isValidPathFormat(this._fileInfo.getContentPath) ? this._fileInfo.getContentPath : Constants.ROOT;

      // If the content path is not valid, say path is 'File Explorer' 
      // root (either Quick Access or This PC)
      if(!CommonFunctions.isValidPathFormat(this._fileInfo.getContentPath)){
        this.showDefaultView = true;
        
        if(this.openFileExplorerTo === Constants.QUICK_ACCESS)
          this.fileTreeNavToPath = this.QUICK_ACCESS;
        else
          this.fileTreeNavToPath = this.THIS_PC
      }

      this.directory = path;
      this.generateBreadCrumbs(this.fileTreeNavToPath);
      this.checkAndSetIfRecycleBin();
      this.setNavPathIcon(fileName, path);
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

    this.getFileExplorerMenuData();

    // BUG FIX (#5): `_fileInfo` is optional (it's never assigned for some
    // launch paths, e.g. when File Explorer is opened from the Start menu or
    // restored from a session without a seeded FileInfo). The original code
    // unconditionally dereferenced `this._fileInfo.getCurrentPath` here, which
    // threw "Cannot read properties of undefined" and aborted the rest of init.
    // Fall back to the already-resolved `this.directory`.
    const initialPath = this._fileInfo ? this._fileInfo.getCurrentPath : this.directory;
    this.storeAppState(initialPath);
  }

  async ngAfterViewInit():Promise<void>{
    this.changeFileExplorerLayoutCSS(this.currentViewOption);

    // Lift the info tooltip out of the window subtree so it can overflow the
    // window edges instead of being clipped.
    this.relocateInfoTipToBody();

    this.pathForm.setValue({
      pathInput: (this.directory !== Constants.ROOT)? this.directory : Constants.ROOT
    })
  
    await CommonFunctions.sleep(this.GENERIC_SECONDS_DELAY);
    this.loadQuickAccessData();
    await this.loadFileTreeAsync();
    await this.setProperRecycleBinIcon();
    await this.loadFiles();
    await this.loadDevciesAndDrives();

    await CommonFunctions.sleep(this.IMAGE_CAPTURE_SECONDS_DELAY);
    await this.captureComponentImg();
  }

  ngOnDestroy(): void {

    if(this.mountPath !== Constants.EMPTY_STRING)
      this._fileService.unmountZip(this.mountPath);

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
    this._folderOptionsSub?.unsubscribe();
    this._themeChangeSub?.unsubscribe();

    // Cancel any pending invalid-chars auto-hide timer so its callback can't
    // run against a torn-down component.
    if(this.invalidCharTimeOutId)
      clearTimeout(this.invalidCharTimeOutId);

    // Remove the body-level tooltip node we relocated in ngAfterViewInit.
    // Guarded so it's a no-op if Angular's view teardown already detached it.
    const tip = this.infoTipContainer?.nativeElement;
    if(tip?.parentNode)
      tip.parentNode.removeChild(tip);

    // Detach any context-menu node this window relocated to document.body
    // (e.g. the window was closed with a menu still open).
    this.removeRelocatedMenus();
  }

  get getFileExplorerRootContainerElmnt(): HTMLElement {
    return this.fileExplorerRootContainer.nativeElement;
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

  private initFolderOptions():void{
    this.openFileExplorerTo =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FILE_EXPLORER_TO) || Constants.OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;
    this.openFolderInSameWindow =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW) !== Constants.FALSE;

    this.showHiddenFilesAndFolders =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS) === Constants.TRUE;

    console.log('showHiddenFilesAndFolders-initFolderOptions:', this.showHiddenFilesAndFolders);

    this.showFileExtensions =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FILE_EXTENSIONS) === Constants.TRUE;
    this.displayFullPathInTitleBar =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR) === Constants.TRUE;
    this.showRecentlyUsedFiles =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_RECENTLY_USED_FILES) !== Constants.FALSE;
    this.showFrequentlyUsedFolders =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS) !== Constants.FALSE;
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

    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);

    if(appSessionData !== null  && appSessionData.appData != Constants.EMPTY_STRING){
      this.directory = appSessionData.appData as string;
    }
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();
    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  // (Refactor) setNavButtonsColor + colorChevron/unColorChevron + colorUpNavBtn/
  // uncolorUpNavBtn + colorPrevNavBtn/uncolorPrevNavBtn + colorNextNavBtn/
  // uncolorNextNavBtn were removed. They imperatively wrote SVG `fill` (and the
  // up-button container background) into the *NavBtnStyle [style] objects on
  // hover / navigation. The icon colour now derives from CSS: base #ccc, the
  // `.fx-nav-enabled` class (bound to isPrevBtnActive / isNextBtnActive /
  // isUpBtnActive) paints #fff, and :hover paints the accent blue. See
  // `.img-alt-left-right svg`, `.img-alt-chevron svg`, `.figure-alt-up` in CSS.

  private normalizePath(path: string): string {
    return FileExplorerPathHelper.normalizePath(path, Constants.ROOT);
  }

  private getParentPath(path: string): string {
    return FileExplorerPathHelper.getParentPath(path, Constants.ROOT);
  }

  private rebuildUpStackFromCurrent(): void {
    // "Up" should take you to parent, then parent's parent, etc.
    // Ordered so pop() returns the immediate parent first.
    this.upPathEntries = FileExplorerPathHelper.buildUpStack(this.directory, Constants.ROOT, Constants.RECYCLE_BIN_PATH);

    this.isUpBtnActive = this.upPathEntries.length > 0;
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
    this.isNextBtnActive = this.nextPathEntries.length > 0;

    // Up state based on actual parents
    this.rebuildUpStackFromCurrent();

    // Downstream work
    const folderName = basename(this.directory);
    await this._audioService.play(this.cheetahNavAudio);
    this.generateBreadCrumbs();
    this.setNavPathIcon(folderName, this.directory);
    await this.loadFiles();
    this.resetSelectionStateAfterNavigation();

    await CommonFunctions.sleep(this.IMAGE_CAPTURE_SECONDS_DELAY);
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

  onNavPaneBtnClick():void{
    this.showNavigationPane = !this.showNavigationPane;
  }

  onPrevPaneBtnClick():void{
    this.showPreviewPane = !this.showPreviewPane;
    this.showDetailsPane = false;
  }

  onDetailPaneBtnClick():void{
    this.showDetailsPane = !this.showDetailsPane;
    this.showPreviewPane = false;
  }

  // (Refactor) The pane buttons' hover + selected highlighting was imperative
  // (onNav/Prev/DetailPaneBtnEnter/Leave + setPaneBtnStyle/removePaneBtnStyle set
  // background/border on #navPaneIconCntnr/#prevPaneIconCntnr/#detailsPaneIconCntnr
  // via getElementById). It is now pure CSS: `.view-tab-pane-top1:hover` and
  // `.tab-pane-top2-1/2:hover` + `.tab-pane-top2-1/2.active` (bound via
  // [class.active]="showPreviewPane|showDetailsPane").

  showExpandTreeIconBtn():void{
    this.showExpandTreeIcon = true;
  }

  hideExpandTreeIconBtn():void{
    this.showExpandTreeIcon = false;
  }

  private async loadDevciesAndDrives(): Promise<void>{
    const delay = 25; //25ms
    await CommonFunctions.sleep(delay);

    const file1 = new FileInfo();
    file1.setIconPath = "osdrive/Cheetah/System/Imageres/os_disk_2.png";
    file1.setCurrentPath = Constants.ROOT;
    file1.setFileName = Constants.OSDISK;
    file1.setFileType = Constants.FOLDER;
    file1.setIsFile = false;
    file1.setOpensWith = "fileexplorer";

    this.devicesAndDrivesFiles.push(file1);

    // Use the async accessor: it lazily performs the one-time full-drive walk on
    // first access (the sync getUsedStorage() just returns a baseline that is
    // still 0 until that walk runs, which left the usage bar empty when This PC
    // was opened before Settings/Properties). Clamp to capacity so the bar can
    // never exceed 100% nor the "free" figure go negative.
    const folderSizeInBytes = Math.min(await this._fileService.getUsedStorageAsync(), this.capacity);
    this.usedCapacity = ((folderSizeInBytes/this.capacity) * 100);
    const availableCapacity = this.capacity - folderSizeInBytes;
    const availableCapacity2 = CommonFunctions.getReadableFileSizeValue(availableCapacity);
    const availableCapacityUnit = CommonFunctions.getFileSizeUnit(availableCapacity);
    const capacity2 =  CommonFunctions.getReadableFileSizeValue(this.capacity);
    // Format the total with the CAPACITY's own unit. It previously reused the
    // used-folder's unit, which produced nonsense like "638 MB free of 1 MB".
    const capacityUnit = CommonFunctions.getFileSizeUnit(this.capacity);

    this.availableCapacityText = `${availableCapacity2.toFixed(0)} ${availableCapacityUnit} free of  ${capacity2.toFixed(0)} ${capacityUnit}`
  }

  private async loadFileTreeAsync():Promise<void>{
    if(this.isRecycleBinFolder) return;

    this.fileTreeNode = [];
    //this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.readDirectory(Constants.USER_BASE_PATH);

    const osDrive:FileTreeNode = {
      name:Constants.OSDISK, path: Constants.ROOT, isFolder: true, children:[]
    }

    // this.directory, will not be correct for all cases. Make sure to check
    for(const dirEntry of directoryEntries){
      const entryPath = `${Constants.USER_BASE_PATH}/${dirEntry}`;
      const stat =  await this._fileService.getStatAsync(entryPath);
      const ftn:FileTreeNode = {
        name : dirEntry,
        path : entryPath,
        isFolder: stat.isDirectory,
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
        const entryPath =  CommonFunctions.removeDoubleSlashes(`${path}/${dirEntry}`);
        const stat =  await this._fileService.getStatAsync(entryPath);
        const ftn:FileTreeNode = {
          name : dirEntry,
          path: entryPath,
          isFolder: stat.isDirectory,
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
    return FileExplorerFileTreeHelper.addChildrenToNode(treeData, nodePath, newChildren);
  }

  async navigateToDirectory(data: string[]): Promise<void> {
    const [fileName, rawPath] = data;

    // Leaving for the tree / breadcrumb drops us out of any mounted zip.
    this.mountPath = Constants.EMPTY_STRING;

    // "This PC" / "Quick access" are synthetic roots that resolve to the real
    // filesystem root; every other entry navigates straight to its own path.
    const isSpecialRoot = (rawPath === this.THIS_PC || rawPath === this.QUICK_ACCESS);
    const targetDir = isSpecialRoot ? Constants.ROOT : rawPath;

    // History: on a real change of directory, push the current dir onto the
    // back stack and invalidate the forward stack (new branch).
    const curDir = this.directory;
    if (targetDir !== curDir) {
      this.prevPathEntries.push(curDir);
      this.nextPathEntries = [];
    }

    this.isPrevBtnActive = this.prevPathEntries.length > 0;
    this.displayName = fileName;

    // Tree highlight target: blank at any root view, else the navigated path.
    this.fileTreeNavToPath = (rawPath === Constants.ROOT) ? Constants.EMPTY_STRING : rawPath;

    // Synthetic roots show the Quick-access landing view; the OS-disk root
    // shows its own file listing. (A normal folder leaves showDefaultView as-is.)
    if (isSpecialRoot)
      this.showDefaultView = true;
    else if (rawPath === Constants.ROOT)
      this.showDefaultView = false;

    this.directory = targetDir;

    // Per-user folders (/Users/<name>) get their own art; everything else the
    // generic folder icon.
    //console.log(`fileName: ${fileName}`)
    this.icon = (rawPath === `/Users/${fileName}`)
      ? `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`
      : `${Constants.IMAGE_BASE_PATH}folder.png`;

    if (this.recentPathEntries.indexOf(this.directory) === -1)
      this.recentPathEntries.push(this.directory);

    this.rebuildUpStackFromCurrent();

    this.generateBreadCrumbs(fileName);
    this.setNavPathIcon(fileName, this.directory);
    this.storeAppState(this.directory);

    // At the OS-disk root, show real files (hide the .url shortcut tiles);
    // everywhere else — including the synthetic roots — use the default listing.
    if (rawPath === Constants.ROOT)
      await this.loadFiles(false);
    else
      await this.loadFiles();

    this.resetSelectionStateAfterNavigation();

    await CommonFunctions.sleep(this.IMAGE_CAPTURE_SECONDS_DELAY);
    await this.captureComponentImg();

    // Record the visited folder in Quick Access. Synthetic roots aren't real
    // folders, so they're skipped. (This path never opens a new window.)
    if (isSpecialRoot  || rawPath === Constants.ROOT) return;

    const dir = new FileInfo();
    dir.setFileName = fileName;
    dir.setCurrentPath = rawPath;
    dir.setIsFile = false;
    dir.setIconPath = this.icon;
    dir.setFileType = Constants.FOLDER;
    this._quickAccessService.add(dir);
  }


  setNavPathIcon(fileName:string, directory:string):void{
    console.log(`fileexplorer - setNavPathIcon: fileName:${fileName} -----  directory:${directory}`)

    if(directory === `/Users/${fileName}` || directory === Constants.RECYCLE_BIN_PATH){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder_small.png`;
    }
    else if((fileName === Constants.OSDISK && directory === Constants.ROOT)){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}os_disk.png`;
    }
    else if((fileName === this.THIS_PC && directory === Constants.ROOT)){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
    }
    else if((fileName === Constants.QUICK_ACCESS && directory === Constants.ROOT)){
      this.navPathIcon = `${Constants.IMAGE_BASE_PATH}quick_access.png`;
    }
    else if(fileName === Constants.FILE_EXPLORER_NAME && directory === Constants.ROOT){
      if(this.openFileExplorerTo === Constants.QUICK_ACCESS)
        this.navPathIcon = `${Constants.IMAGE_BASE_PATH}quick_access.png`;
      else
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

    // Seed the input with the path being edited (matches the old behaviour: at
    // ROOT with the history dropdown open, show the bare ROOT marker).
    if(this.showPathHistory){
      if(this.directory === Constants.ROOT)
        this.pathForm.setValue({ pathInput: Constants.ROOT });
    }else{
      this.pathForm.setValue({ pathInput: this.directory });
    }

    this.isPathEditing = true;

    // Defer focus/select to the next macrotask so Angular has flushed the
    // [style.display] binding first — a display:none element can't be focused.
    setTimeout(() => {
      const el = this.pathInputRef?.nativeElement;
      el?.focus();
      el?.select();
    }, 0);
  }

  hidePathTextBox():void{
    this.isPathEditing = false;
  }

  /**
   * Navigate to the path the user typed into the address bar.
   *
   * Wired to the path form's (ngSubmit) (Enter key) — which previously ran
   * isFormDirty(), the *rename* textbox handler, so a typed path did nothing.
   * Resolves the raw input to an absolute path, verifies it exists, and either
   * navigates there (folder) or opens its containing folder (file). If the
   * location can't be found, an error notification is raised and we stay put.
   */
  async onPathSubmit():Promise<void>{
    const raw = ((this.pathForm.value.pathInput as string | null) ?? Constants.EMPTY_STRING).trim();

    // Empty input: just drop back to the breadcrumb view, no navigation.
    if(raw.length === 0){
      this.hidePathTextBox();
      return;
    }

    // Resolve to an absolute path: a relative entry is taken from root.
    let targetPath = raw.startsWith(Constants.ROOT) ? raw : `${Constants.ROOT}${raw}`;
    targetPath = this.normalizePath(targetPath);

    // Root is always valid — short-circuit the existence check.
    if(targetPath === Constants.ROOT){
      this.hidePathTextBox();
      await this.navigateTo(Constants.ROOT, 'push');
      return;
    }

    const stat = await this._fileService.getStatAsync(targetPath);
    if(!stat.exists){
      // Keep the editor open so the user can correct the path.
      this._userNotificationService.showErrorNotification(
        `Cheetah can't find '${targetPath}'. Check the spelling and try again.`,
        'Location not found'
      );
      return;
    }

    this.hidePathTextBox();

    // A folder opens directly; a file opens its containing folder (matches the
    // familiar "type a file path, land in its folder" behaviour).
    const destDir = stat.isDirectory ? targetPath : this.normalizePath(dirname(targetPath));
    this.fileTreeNavToPath = Constants.EMPTY_STRING;
    await this.navigateTo(destDir, 'push');
  }

  /**
   * Populates `_directoryTraversalList` with the breadcrumb trail for the
   * current directory (delegated to the path helper).
   * RECYCLE_BIN_PATH → [RECYCLE_BIN]
   * user path like /Users/Bob/Documents → [THISPC, Users, Bob, Documents]
   * non-user path like /System/Library → [THISPC, System, Library]
   * root / → [THISPC, OSDISK] (stable breadcrumb)
   */
  generateBreadCrumbs(fileName: string = Constants.EMPTY_STRING): void {
    this._directoryTraversalList = FileExplorerPathHelper.buildBreadCrumbs(this.directory, {
        root: Constants.ROOT,
        thisPc: Constants.THISPC,
        recycleBinPath: Constants.RECYCLE_BIN_PATH,
        recycleBin: Constants.RECYCLE_BIN,
        userBasePath: Constants.USER_BASE_PATH,
        osDisk: Constants.OSDISK,
        empty: Constants.EMPTY_STRING,
    }, this.displayFullPathInTitleBar);

    if(!this.displayFullPathInTitleBar && this.directory === Constants.ROOT){
      if(fileName === this.QUICK_ACCESS)
        this._directoryTraversalList = [this.QUICK_ACCESS];
      else if(fileName === this.THIS_PC)
        this._directoryTraversalList = [this.THIS_PC];
      else if(fileName === Constants.OSDISK)
        this._directoryTraversalList = [Constants.OSDISK];
    }
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.fileExplorerRootContainer, this.processId, this.name, this.icon, this._windowService);
  }
  
  onMouseEnterTabLayoutBtn(iconView:ViewOptions, _id:number):void{
    // Live-preview the hovered view. The button highlight is now pure CSS
    // (:hover on .span-tab-layout-cntnr), so no imperative styling here.
    this.changeFileExplorerLayoutCSS(iconView);

    // this should be an update of the menuData, rather than a re-generation
    this.getFileExplorerMenuData()
  }

  onMouseLeaveTabLayoutBtn(_id:number):void{
    // Revert the live preview to the committed view.
    this.changeFileExplorerLayoutCSS(this.defaultviewOption);
  }

  onClickTabLayoutBtn(iconView:ViewOptions, id:number):void{
    // Commit the selection; the ribbon highlight follows via
    // [class.active]="currentViewOptionId === N".
    this.currentViewOptionId = id;
    this.currentViewOption = iconView;
    this.defaultviewOption = iconView;
  }

  toggleLargeIconsView():void{
    this.currentViewOption = ViewOptions.LARGE_ICON_VIEW;
    this.applyViewClasses(this.currentViewOption);
  }

  toggleDetailsView():void{
    this.currentViewOption = ViewOptions.DETAILS_VIEW;
    this.applyViewClasses(this.currentViewOption);
  }

  changeFileExplorerLayoutCSS(inputViewOption:ViewOptions):void{
    this.currentViewOption = inputViewOption;
    this.applyViewClasses(inputViewOption);
  }

  /**
   * Single source of truth for the two CSS classes that drive the file grid
   * layout: `olClassName` (the base per-view grid) + `viewSizeClass` (the
   * icon-size modifier). Replaces the imperative trio changeLayoutCss +
   * changeOrderedlistStyle + changeIconViewBtnSize, which looped over
   * fetchedFiles writing inline width/height/grid styles on every icon
   * button/image/caption/shortcut and the <ol> itself (and didn't survive
   * *ngFor re-renders). All of that geometry now lives in
   * `.ol-iconview-grid.view-*` (+ the per-view grid) CSS rules, so this just
   * picks the right two class names. Writes only per-component fields — no DOM.
   */
  private applyViewClasses(view:ViewOptions):void{
    switch(view){
      case ViewOptions.LIST_VIEW:
        this.olClassName = ViewOptionsCSS.LIST_VIEW_CSS;    this.viewSizeClass = 'view-list';    return;
      case ViewOptions.DETAILS_VIEW:
        this.olClassName = ViewOptionsCSS.DETAILS_VIEW_CSS; this.viewSizeClass = 'view-details'; return;
      case ViewOptions.TILES_VIEW:
        this.olClassName = ViewOptionsCSS.TITLES_VIEW_CSS;  this.viewSizeClass = 'view-tiles';   return;
      case ViewOptions.CONTENT_VIEW:
        this.olClassName = ViewOptionsCSS.CONTENT_VIEW_CSS; this.viewSizeClass = 'view-content'; return;
    }

    // Icon views all share the base grid class; only the size modifier differs.
    this.olClassName = ViewOptionsCSS.ICONS_VIEW_CSS;
    switch(view){
      case ViewOptions.SMALL_ICON_VIEW:       this.viewSizeClass = 'view-small';  break;
      case ViewOptions.LARGE_ICON_VIEW:       this.viewSizeClass = 'view-large';  break;
      case ViewOptions.EXTRA_LARGE_ICON_VIEW: this.viewSizeClass = 'view-xlarge'; break;
      case ViewOptions.MEDIUM_ICON_VIEW:
      default:                                this.viewSizeClass = 'view-medium'; break;
    }
  }

  // (Refactor) changeTabLayoutIconCntnrCSS + colorTabLayoutContainer/
  // unColorTabLayoutContainer were removed. They imperatively set background/
  // border on #tabLayoutIconCntnr-<pid>-<n> (and the layout box) for the ribbon
  // view-mode highlight. It is now pure CSS: `.span-tab-layout-cntnr:hover` +
  // `.span-tab-layout-cntnr.active` (bound via [class.active]=
  // "currentViewOptionId === N"), and the box uses `.view-tab-layout-top1:hover`.

  // (Refactor) changeLayoutCss + changeIconViewBtnSize + changeOrderedlistStyle
  // were removed. They set the <ol> class and then looped over fetchedFiles
  // writing inline width/height/grid styles on every icon button/image/caption/
  // shortcut and the <ol> itself (via document.getElementById(`...-${pid}-${i}`)).
  // That per-icon DOM mutation didn't survive *ngFor re-renders (navigating into
  // a folder reset the sizes), cost O(processes x icons) per view change, and the
  // icon-size tables threw for non-icon views. All that geometry now lives in the
  // `.ol-iconview-grid.view-*` (+ per-view grid) CSS rules; applyViewClasses()
  // just sets the two class names bound via [ngClass]="[olClassName, viewSizeClass]".

  toggleRibbonMenu():void{
    this.showRibbonMenu = !this.showRibbonMenu
  }

  questionBtn():void{
   console.log('do somthing');
  }

  // (Refactor) colorRibbonMenuCntnr/uncolorRibbonMenuCntnr (dead: never wired in
  // the template) and colorBtnCntnr/uncolorBtnCntnr (imperative background hover
  // on the ribbon-toggle + help buttons via getElementById) were removed. The
  // hover is now pure CSS: `.figure-header-toggle:hover, .question-header-cntnr:hover`.

  async runApplication(file:FileInfo, overrideDefaultApp:boolean=false, evt?:MouseEvent ):Promise<void>{

    if(evt)
      evt.stopPropagation();

    if(!this.openFolderInSameWindow && !file.getIsFile){
      this._processHandlerService.runApplication(file);
      this.pinToQuickAccess();

      return;
    }

    //console.log('fileexplorer-runApplication:',file)
    this.fileTreeNavToPath = Constants.EMPTY_STRING;

    this.hideFileExplorerToolTip();
    CommonFunctions.handleTracking(this._activityHistoryService, file);
    await this._audioService.play(this.cheetahNavAudio);

    if(this.isRecycleBinFolder){
      this._menuService.showPropertiesView.next(file);
      return;
    }

    // Track this open in Quick Access (files & folders): first open adds the
    // item, repeat opens bump its count so the most-used rise to the top.
    if((this.showRecentlyUsedFiles && this.showFrequentlyUsedFolders))
      this._quickAccessService.add(this.selectedFile);
    else if(this.showRecentlyUsedFiles && this.selectedFile.getIsFile)
      this._quickAccessService.add(this.selectedFile);
    else if(this.showFrequentlyUsedFolders && !this.selectedFile.getIsFile)
      this._quickAccessService.add(this.selectedFile);

    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    const isZipFile = file.getOpensWith === Constants.FILE_EXPLORER && file.getFileType === this.ZIP;

    if(((file.getOpensWith === Constants.FILE_EXPLORER && file.getFileName !== Constants.FILE_EXPLORER) && file.getFileType === Constants.FOLDER) || isZipFile){
      this.showDefaultView = false;

      // Captured before the mount block below, which reassigns this.directory —
      // reading it afterwards would push the mount path onto the back stack
      // instead of the folder being left.
      const fromDir = this.directory;

      // A .zip is browsed as a folder: mount it once, then navigate to the mount
      // point. Re-entry while already mounted falls through to the normal paths
      // so drilling into sub-folders inside the archive still works.
      let mountedThisCall = false;
      if(isZipFile && this.mountPath === Constants.EMPTY_STRING){
        const detectedMount = this._fileService.findMountPointForPath(file.getCurrentPath);
        this.mountPath = (detectedMount !== Constants.EMPTY_STRING)
          ? detectedMount
          : await this.getZipFileMountPath(file.getCurrentPath);
        this.directory = this.mountPath;
        mountedThisCall = true;
      }

      let targetDir:string;
      if(mountedThisCall){
        targetDir = this.directory; // already set to the mount path above
      }else if(file.getCurrentPath.includes(Constants.URL)){
        targetDir = file.getContentPath;
      }else{
        targetDir = file.getCurrentPath;
      }

      if(targetDir !== fromDir){
        this.prevPathEntries.push(fromDir);
        this.nextPathEntries = []; // new branch -> forward history is invalid
      }

      this.directory = targetDir;
      this.displayName = file.getFileName;
      this.icon = file.getIconPath;

      this.rebuildUpStackFromCurrent();
      this.isPrevBtnActive = this.prevPathEntries.length > 0;
      this.isNextBtnActive = this.nextPathEntries.length > 0;

      if(this.recentPathEntries.indexOf(this.directory) === -1){
        this.recentPathEntries.push(this.directory);
      }

      this.generateBreadCrumbs();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
      this.pinToQuickAccess();
  
      await this.loadFiles();
      this.resetSelectionStateAfterNavigation();
      await CommonFunctions.sleep(this.IMAGE_CAPTURE_SECONDS_DELAY);
      this.captureComponentImg(); 
    }else{
      //APPS opened from the fileexplorer do not have their windows in focus,
      // and this is due to the mouse click event that causes fileexplorer to trigger setFocusOnWindow event
      await CommonFunctions.sleep(this.APP_TRIGGER_SECONDS_DELAY);
      this._processHandlerService.runApplication(file, overrideDefaultApp);
    }
  }

  async onTriggerRunApplication():Promise<void>{
    await this.runApplication(this.selectedFile);
  }

  async onZip(): Promise<void>{
    const srcPath = this.selectedFile.getCurrentPath;
    const isDir = !this.selectedFile.getIsFile;
    const delay = 50; //50ms

    const result = await this._fileService.zipEntityAsync(srcPath, isDir);
    if(result){
      await CommonFunctions.sleep(delay);
      await this.refresh();
    }
  }

  async onUnZip(): Promise<void>{
    const srcPath = this.selectedFile.getCurrentPath;
    const delay = 50; //50ms

    const uId = `${this.name}-${this.processId}`;
    const confirm = await this._userNotificationService.showZipExtractNotification(dirname(srcPath), uId);
    if(confirm){
      const result = await this._fileService.unzipEntityAsync(srcPath);
      if(result){
        await CommonFunctions.sleep(delay);
        this.refresh();
      }
    }
  }

  async getZipFileMountPath(srcPath:string): Promise<string>{
    const mountPath = await this._fileService.mountZipAsync(srcPath);
    if(mountPath) return mountPath;

    return Constants.EMPTY_STRING;
  }

  /**
   * "Open with..." menu row — shows the app-selection dialog, then
   * launches the selected application with the current file.
   * @returns 
  */
  async showOpenWithDialog(): Promise<void> {
    if(this.selectedFile.getFileExtension !== Constants.EMPTY_STRING){
      const opensWith = this._fileService.getOpensWith(this.selectedFile.getFileExtension);
      const selectedApplication = await this._userNotificationService.showApplicationSelectionNotification(opensWith);
      if(!selectedApplication) return; // user cancelled the app selection dialog

      this.selectedFile.setOpensWith = selectedApplication;
      const overrideDefaultApp = true
      this.runApplication(this.selectedFile, overrideDefaultApp);
    }
  }

  /**
   * Triggers the opening of the selected file in a new window.
   * If the selected file is not a folder, the action is ignored. 
   * @returns void
   */
  openInANewWindow():void{
    const selectedFile = this.selectedFile;

    if(selectedFile.getIsFile){
      console.warn('Cannot open file in File Explorer');
      return;
    }
    selectedFile.setOpensWith = Constants.FILE_EXPLORER;
    this._processHandlerService.runApplication(this.selectedFile);
    this.pinToQuickAccess();
  }


  onBtnClick(evt:MouseEvent, id:number, section:string = 'primary'):void{
    this.doBtnClickThings(id, section);
    this.getSelectFileSizeSumAndUnit();
    // Move DOM focus to the list container so subsequent arrow/Enter keys are
    // captured by onFileExplorerKeyDown (details-view rows aren't focusable).
    this.selectedFile = this.fetchedFiles[id];
    this.fileExplrListCntnr?.nativeElement.focus({preventScroll: true});

    evt.stopPropagation();
  }

  /**
   * Single source of truth for an icon's highlight class (replaces the imperative
   * setBtnStyle/removeBtnStyle DOM mutation). `section` disambiguates the index
   * spaces that coexist in the This-PC default view. Bound via [ngClass].
   */
  iconStateClass(i:number, section:string):string{
    // Lasso multi-select highlight only applies to the primary grid.
    if(section === 'primary' && this.markedBtnIds.has(i))
      return 'fileexplr-multi-select-highlight';

    const isSel = this.selectedElementId === i && this.selectedSection === section;
    const isHov = this.hoveredElementId === i && this.hoveredSection === section;

    if(isSel && this.isIconInFocusDueToCurrentAction) return 'fileexplr-is-selected-current';
    if(isHov) return 'fileexplr-is-hovered';
    if(isSel && this.isIconInFocusDueToPriorAction) return 'fileexplr-is-selected-prior';
    return Constants.EMPTY_STRING;
  }

  //#region Keyboard Navigation
  /**
   * Windows-Explorer-style keyboard navigation for the main grid (`<ol>`, made
   * focusable via tabindex="0"): ArrowLeft/Right prev/next, ArrowUp/Down by one
   * grid row, Home/End first/last, Enter opens, F2 renames, Escape clears.
   * Reads only this instance's `fetchedFiles` and processId-scoped DOM.
   */
  onFileExplorerKeyDown(evt:KeyboardEvent):void{
    // The rename textbox owns its own keys (onKeyPress); don't hijack them.
    if(this.isRenameActive) return;

    const total = this.fetchedFiles.length;
    if(total === 0) return;

    const current = this.selectedElementId; // -1 when nothing is selected
    const isDetailsView = this.currentViewOption === ViewOptions.DETAILS_VIEW;
    const columns = isDetailsView ? 1 : this.getIconViewColumnCount();
    let handled = true;

    const nextIndex = FileExplorerKeyboardHelper.computeNextIndex(evt.key, current, total, columns);
    if(nextIndex !== null){
      this.selectIconByIndex(nextIndex);
    }else{
      switch(evt.key){
        case 'Enter':
          if(current >= 0 && current < total)
            void this.runApplication(this.fetchedFiles[current]);
          break;
        case 'F2':
          if(current >= 0 && current < total){
            this.selectedFile = this.fetchedFiles[current];
            this.onRenameFileTxtBoxShow();
          }
          break;
        case 'Escape':
          this.btnStyleAndValuesReset();
          this.markedBtnIds.clear();
          this.areMultipleIconsHighlighted = false;
          break;
        default:
          handled = false;
      }
    }

    if(handled){
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  /**
   * Select the item at `index` from the keyboard. Reuses doBtnClickThings (the
   * mouse-click path) so the [ngClass] is-selected-current binding paints it,
   * then updates the footer size readout and scrolls the item into view.
   */
  private selectIconByIndex(index:number):void{
    if(index < 0 || index >= this.fetchedFiles.length) return;

    // Keyboard navigation is single-select — drop any lasso multi-selection.
    if(this.markedBtnIds.size > 0){
      this.markedBtnIds.clear();
      this.areMultipleIconsHighlighted = false;
    }

    this.hoveredElementId = -1; // clear stale hover paint so the keyboard selection shows
    this.hoveredSection = Constants.EMPTY_STRING;
    this.doBtnClickThings(index, 'primary');
    this.selectedFile = this.fetchedFiles[index];
    this.propertiesViewFile = this.fetchedFiles[index];
    this.getSelectFileSizeSumAndUnit();
    this.scrollSelectedIntoView(index);
  }

  /**
   * Count the icons on the first grid row by comparing each button's top offset
   * to the first button's. Works for the CSS auto-fill grid at any view size.
   * Scoped to this instance's buttons (id prefix) so it's multi-instance safe.
   */
  private getIconViewColumnCount():number{
    const buttons = Array.from(
      this.fileExplrCntntCntnr.nativeElement.querySelectorAll(`[id^="btnElmnt-${this.processId}-"]`)
    ) as HTMLElement[];
    if(buttons.length <= 1) return 1;

    const firstTop = buttons[0].getBoundingClientRect().top;
    let columns = 0;
    for(const btn of buttons){
      const top = btn.getBoundingClientRect().top;
      if(Math.abs(top - firstTop) < 1) columns++;
      else break;
    }
    return Math.max(columns, 1);
  }

  /**
   * Scroll the selected item into view. Icon/list/tiles/content views use the
   * button id; details view uses the row id. Focus stays on the <ol>.
   */
  private scrollSelectedIntoView(index:number):void{
    const element = (this.currentViewOption === ViewOptions.DETAILS_VIEW)
      ? document.getElementById(`trElmnt-${this.processId}-${index}`)
      : document.getElementById(`btnElmnt-${this.processId}-${index}`);
    element?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }
  //#endregion Keyboard Navigation

  supressPropagation(evt:MouseEvent):void{
    evt.stopPropagation();
    evt.preventDefault()
  }

  onQuickAccessMouseEnter(evt:MouseEvent, file:FileInfo, id:number, isFileSection:boolean):void{
    this.hoveredElementId = id;
    this.hoveredSection = isFileSection ? 'qa-file' : 'qa-folder';
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;
      // Tooltip is now triggered by the MouseStop directive (on hover pause),
      // not on mouseenter — prevents the tip flickering as you sweep across icons.
    }
  }

  onMouseEnter(evt:MouseEvent, file:FileInfo, id:number, section:string = 'primary'):void{
    this.hoveredElementId = id;
    this.hoveredSection = section;
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;
      // Tooltip trigger moved to MouseStop (see (mouseStop)="showToolTip(...)").
    }
  }

  onQuickAccessMouseLeave(id:number, isFileSection:boolean):void{
    this.hoveredElementId = -1;
    this.hoveredSection = Constants.EMPTY_STRING;
    this.isMultiSelectEnabled = true;
    this.hideFileExplorerToolTip();
  }
  onMouseLeave(id:number):void{
    this.hoveredElementId = -1;
    this.hoveredSection = Constants.EMPTY_STRING;
    this.isMultiSelectEnabled = true;
    this.hideFileExplorerToolTip();
  }

  /**
   * Fired by the [MouseStop] directive once the pointer pauses over an icon for
   * TOOL_TIP_DELAY ms. Positions + shows the file-info tooltip. Because it only
   * fires on a genuine hover pause (not on every mouseenter), sweeping the mouse
   * across icons no longer flickers the tip.
   */
  async showToolTip(evt:MouseEvent, file:FileInfo):Promise<void>{
    if(this.isMultiSelectActive) return;
    await this.showFileExplorerToolTip(evt, file);
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
    this._menuService.openContextMenu(`${this.name}-${this.processId}`);
    this.hideFileExplorerToolTip();

    const menuHeight = (file.getIsFile)? this.CTX_MENU_HEIGHT_FILE : this.CTX_MENU_HEIGHT_FOLDER;
    this.iconCntxtCntr++;

    // isDetailsView drives which per-section cos-menu renders (see template).
    this.isDetailsView = (this.currentViewOption === ViewOptions.DETAILS_VIEW);
    this.isNotDetailsView = !this.isDetailsView;

    // Bound the menu against the viewport (not a container): it is relocated to
    // document.body and positioned `fixed`, so viewport coordinates place it at
    // the cursor. The old container-relative math + per-section magic offsets
    // (-75/-50 details view, -10/+200/+300 quick-access) are gone.
    const viewportRect:DOMRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const [axis, isShiftSubMenuLeft] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(viewportRect, evt, menuHeight);
    this.isShiftSubMenuLeft = isShiftSubMenuLeft;

    const uId = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uId);

    [this.menuData, this.menuOrder] = FileExplorerContextMenuHelper.adjustIconContextMenuData(file, this.sourceData, this.isRecycleBinFolder);
    this.selectedFile = file;
    this.propertiesViewFile = file
    this.isIconInFocusDueToPriorAction = false;

    // Close the empty-space (explorer) menu if it's open, and detach its
    // body-relocated node so the two menus can't overlap.
    this.showFileExplrCntxtMenu = false;
    this.detachRelocatedMenu(this.fileCtxMenuRef);

    // A fresh open (vs re-positioning an already-open menu) needs the flash guard.
    const menuWasClosed = !this.showIconCntxtMenu;
    if(!this.showIconCntxtMenu)
      this.showIconCntxtMenu = !this.showIconCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);

    // On a fresh open the menu first mounts inside the transformed window where
    // position:fixed anchors to the window (wrong spot). Keep it invisible until
    // the setTimeout relocates it to document.body, then reveal — kills the
    // brief flash at the wrong position. Re-positioning an already-open menu
    // stays visible (no blink).
    this.fileExplrCntxtMenuStyle = {
      'position': 'fixed',
      'left':`${Math.round(axis.xAxis)}px`,
      'top':`${Math.round(axis.yAxis)}px`,
      'z-index': Constants.Z_INDEX_FILE_EXPLORER_CONTEXT_MENU,
      'visibility': menuWasClosed ? 'hidden' : 'visible',
    }

    // Lift the freshly-rendered menu out of the window into document.body so it
    // can extend past the window's clipped edges, then reveal it in place.
    setTimeout(() => {
      this.relocateMenuToBody(this.iconCtxMenuRef);
      if(menuWasClosed)
        this.fileExplrCntxtMenuStyle = { ...this.fileExplrCntxtMenuStyle, 'visibility': 'visible' };
    }, 0);

    evt.preventDefault();
    // Stop the right-click from bubbling to the desktop; otherwise the desktop's
    // own contextmenu handler fires too and — via the shared context-menu
    // ownership — immediately dismisses this file menu and shows the desktop's.
    evt.stopPropagation();
  }

  onShowFileExplorerContextMenu(evt:MouseEvent):void{
    this.showExpandTreeIcon = false;
    this.fileExplrCntxtCntr++;
    if(this.iconCntxtCntr >= this.fileExplrCntxtCntr)
        return;

    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.openContextMenu(`${this.name}-${this.processId}`);
    const menuHeight = this.CTX_MENU_HEIGHT_EXPLORER;

    // Bound against the viewport; the menu is relocated to document.body and
    // positioned `fixed`, so viewport coordinates place it at the cursor.
    const viewportRect:DOMRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const [axis, isShiftSubMenuLeft] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(viewportRect, evt, menuHeight);
    this.isShiftSubMenuLeft = isShiftSubMenuLeft;

    const uId = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uId);

    // Close the icon menu if it's open, and detach its body-relocated node so
    // the two menus can't overlap.
    this.showIconCntxtMenu = false;
    this.detachRelocatedMenu(this.iconCtxMenuRef);

    const menuWasClosed = !this.showFileExplrCntxtMenu;
    if(!this.showFileExplrCntxtMenu)
      this.showFileExplrCntxtMenu = !this.showFileExplrCntxtMenu;

    // Hidden until relocated (see onShowIconContextMenu) to avoid the flash.
    this.fileExplrCntxtMenuStyle = {
      'position': 'fixed',
      'left':`${Math.round(axis.xAxis)}px`,
      'top':`${Math.round(axis.yAxis)}px`,
      'z-index': Constants.Z_INDEX_FILE_EXPLORER_CONTEXT_MENU,
      'visibility': menuWasClosed ? 'hidden' : 'visible',
    }

    setTimeout(() => {
      this.relocateMenuToBody(this.fileCtxMenuRef);
      if(menuWasClosed)
        this.fileExplrCntxtMenuStyle = { ...this.fileExplrCntxtMenuStyle, 'visibility': 'visible' };
    }, 0);

    evt.preventDefault();
    evt.stopPropagation();
  }

  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  onOpenFolderOptions():void{
    // Hand off to the properties window shell running in its Folder Options mode.
    this._menuService.showFolderOptionsView.next();
  }

  hideIconContextMenu(evt?:MouseEvent, caller?:string):void{
    this.showIconCntxtMenu = false;
    this.isDetailsView = false;
    this.isNotDetailsView = true;``
    this.showFileExplrCntxtMenu = false;
    this.isShiftSubMenuLeft = false;
    this.iconCntxtCntr = 0;
    this.fileExplrCntxtCntr = 0;
    this.showExpandTreeIcon = false;

    // The open menu was relocated to document.body; *ngIf teardown won't remove
    // a node moved off its container, so detach it here to avoid orphans.
    this.removeRelocatedMenus();

    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this.focusWindow();
      this._menuService.closeAllContextMenus(`${this.name}-${this.processId}`);
    }

    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }
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
    const newFolder:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action: this.createFolder.bind(this),  variables:true , 
      emptyline:false, styleOption:'C' }

    const textEditor:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}text_file.png`, label:'Text File',  action: this.createTextFile.bind(this),  variables:true , 
      emptyline:false, styleOption:'C' }

    const sortByMenu = [newFolder, textEditor ]

    return sortByMenu;
  }


  /**
   * Context-menu "New > Folder": create an empty folder in the current
   * directory, then add it straight to the listing and drop the new icon into
   * in-place rename mode with its default name pre-selected (Windows-style).
   */
  async createFolder():Promise<void>{
    const folderName = Constants.NEW_FOLDER;
    const requestID = CommonFunctions.generateID(8);
    const result = await this._fileService.createFolderAsync(this.directory, folderName, requestID);

    if(result.ok){
      const trueFolderName = this._fileService.getFileOrFolderNameByRequestId(requestID);
      const trueFolderPath = CommonFunctions.removeDoubleSlashes(`${this.directory}/${trueFolderName}`);
      const newFolder = await this._fileService.getFileInfoAsync(trueFolderPath);

      // Add straight to the listing (no fresh directory pull) to avoid the
      // flicker of a full refresh — mirrors the desktop's New-Folder flow.
      this.fetchedFiles.push(newFolder);
      await this.enterRenameModeForNewIcon(newFolder);
    }
  }


  /**
   * Context-menu "New > Text File": create an empty .txt file in the current
   * directory, then add it straight to the listing and drop the new icon into
   * in-place rename mode with its default name pre-selected (Windows-style).
   */
  async createTextFile():Promise<void>{
    const fileName = Constants.NEW_TEXT_FILE;
    const requestID = CommonFunctions.generateID(8);

    const tmpTxtFile = new FileInfo();
    tmpTxtFile.setFileName = fileName;
    tmpTxtFile.setStringBuffer = Constants.BLANK_SPACE;
    const result = await this._fileService.writeFileAsync(this.directory, tmpTxtFile, requestID);

    if(result){
      const trueFileName = this._fileService.getFileOrFolderNameByRequestId(requestID);
      const trueFilePath = CommonFunctions.removeDoubleSlashes(`${this.directory}/${trueFileName}`);
      const newTxtFile = await this._fileService.getFileInfoAsync(trueFilePath);

      // Add straight to the listing (no fresh directory pull) to avoid the
      // flicker of a full refresh — mirrors the desktop's New-Text-File flow.
      this.fetchedFiles.push(newTxtFile);
      await this.enterRenameModeForNewIcon(newTxtFile);
    }
  }

    /**
   * Put a freshly-created icon straight into in-place rename mode with its
   * default name pre-selected. The icon was just pushed to `fetchedFiles`, so
   * it is the last row; its index is the id the template stamps onto
   * figCap/renameForm/renameTxtBox. Selection is routed through
   * `doBtnClickThings(index)` — the SAME entry point a single mouse click uses
   * — so the click-bookkeeping flags (`isBtnClickEvt`/`btnClickCnt`/
   * `selectedElementId`) are set; without them `handleIconHighLightState()`
   * can't detect the later "was renaming, then clicked away" sequence and the
   * icon would get stuck in rename mode. We then point `selectedFile` at the
   * new row and wait one render tick for Angular to paint its `*ngFor` row
   * before opening the textbox (the figCap/renameForm/renameTxtBox elements
   * must exist for the textbox to show + focus + select).
   */
  private async enterRenameModeForNewIcon(newIcon:FileInfo):Promise<void>{
    const newIconIndex = this.fetchedFiles.length - 1;

    this.doBtnClickThings(newIconIndex);
    this.selectedFile = newIcon;

    // let the new *ngFor row paint so figCap/renameForm/renameTxtBox exist
    await CommonFunctions.sleep(this.NEW_ICON_RENDER_DELAY);
    this.onRenameFileTxtBoxShow();
  }

  getFileExplorerMenuData():void{
    this.fileExplrMenu = [
          {icon1:Constants.EMPTY_STRING,  icon2: `${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:MenuAction.VIEW, nest:this.buildViewMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftViewSubMenu.bind(this), emptyline:false},
          {icon1:Constants.EMPTY_STRING,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:MenuAction.SORTBY, nest:this.buildSortByMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: MenuAction.REFRESH, nest:[], action:() => this.refresh(), action1: ()=> Constants.EMPTY_STRING, emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: MenuAction.PASTE, nest:[], action: this.onPaste.bind(this), action1: ()=> Constants.EMPTY_STRING, emptyline:false},
          {icon1:`${Constants.IMAGE_BASE_PATH}terminal.png`, icon2:Constants.EMPTY_STRING, label:MenuAction.OPEN_IN_TERMINAL, nest:[], action: this.openInTerminal.bind(this), action1: ()=> Constants.EMPTY_STRING, emptyline:false},
          {icon1:`${Constants.IMAGE_BASE_PATH}vs_code.png`, icon2:Constants.EMPTY_STRING, label:MenuAction.OPEN_WITH_CODE, nest:[], action: () => console.log('Open CodeEditor'), action1: ()=> Constants.EMPTY_STRING, emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label: MenuAction.NEW, nest:this.buildNewMenu(), action: ()=> Constants.EMPTY_STRING, action1: this.shiftNewSubMenu.bind(this), emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: MenuAction.OPTIONS, nest:[], action: this.onOpenFolderOptions.bind(this), action1: ()=> Constants.EMPTY_STRING, emptyline:true},
          {icon1:Constants.EMPTY_STRING,  icon2:Constants.EMPTY_STRING, label: MenuAction.PROPERTIES, nest:[], action: () => console.log('Properties'), action1: ()=> Constants.EMPTY_STRING, emptyline:false}
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

          this.markedBtnIds.clear();
          this.areMultipleIconsHighlighted = false;
          this.blankSpaceClickCntr = 0;
        }
      }
    }
  }

  doBtnClickThings(id:number, section:string = 'primary'):void{
    this.isIconInFocusDueToCurrentAction = true;
    this.isIconInFocusDueToPriorAction = false;
    this.prevSelectedElementId = this.selectedElementId 
    this.selectedElementId = id;
    this.selectedSection = section;

    this.setIsBtnClickEvt(true, 'doBtnClickThings');
    this.btnClickCnt++;
    this.isHideCntxtMenuEvt = false;
    this.hideCntxtMenuEvtCnt = 0;
  }

  // (Phase 3) Hover/selection highlight is now class-based via iconStateClass() +
  // [ngClass]. These two imperative DOM stylers are intentional no-op stubs so the
  // remaining state-machine callers (handleIconHighLightState, btnStyleAndValues*)
  // stay inert without needing every call site rewritten.
  setBtnStyle(_id:number, _isMouseHover:boolean, _btnElementInput?:HTMLElement):void{ /* class-based now */ }

  btnStyleAndValuesReset():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesReset');
    this.btnClickCnt = 0;
    this.selectedElementId = -1;
    this.prevSelectedElementId = -1;
    this.selectedSection = Constants.EMPTY_STRING;
    this.btnClickCnt = 0;
    this.isIconInFocusDueToPriorAction = false;
  }

  btnStyleAndValuesChange():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesChange');
    this.btnClickCnt = 0;
    this.prevSelectedElementId = this.selectedElementId;
    this.isIconInFocusDueToPriorAction = true;
    this.isIconInFocusDueToCurrentAction = false;
  }

  /**
   * Selection/hover are keyed by *ngFor index, so state left over from the
   * previous folder keeps painting whatever icon now sits at that index.
   * Must run AFTER loadFiles() or the swap-in undoes it.
   */
  private resetSelectionStateAfterNavigation():void{
    this.btnStyleAndValuesReset();
    this.isIconInFocusDueToCurrentAction = false;
    this.hoveredElementId = -1;
    this.hoveredSection = Constants.EMPTY_STRING;
    this.markedBtnIds.clear();
    this.areMultipleIconsHighlighted = false;
    this.hideShowFileSizeAndUnit();
    this.hideFileExplorerToolTip();
  }
  
  removeBtnStyle(_id:number, _btnElementInput?:HTMLElement):void{ /* class-based now (see setBtnStyle) */ }

  activateMultiSelect(evt:MouseEvent):void{
    this.fileExplorerBoundedRect =  this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    if(this.isMultiSelectEnabled){
      this.isMultiSelectActive = true;
      this.multiSelectStartingPosition = evt;
    }
    evt.stopPropagation();
  }

  deActivateMultiSelect():void{
    // Hide the lasso via its bound flag (CSS handles the rest).
    this.lassoVisible = false;
    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    // `markedBtnIds` (a Set) is the single source of truth now.
    this.areMultipleIconsHighlighted = this.markedBtnIds.size > 0;
    this.getSelectFileSizeSumAndUnit();
  }

  updateDivWithAndSize(evt:MouseEvent):void{

    if(!this.isMultiSelectEnabled) return;

    if(this.multiSelectStartingPosition){
      const lasso = FileExplorerMultiSelectHelper.computeLassoRect(this.fileExplorerBoundedRect, this.multiSelectStartingPosition, evt);

      this.lassoLeftPx = lasso.left;
      this.lassoTopPx = lasso.top;
      this.lassoWidthPx = lasso.width;
      this.lassoHeightPx = lasso.height;
      this.lassoVisible = true;

      // Update which icons fall inside the lasso.
      this.highlightSelectedItems(lasso.left, lasso.top, lasso.width, lasso.height);
    }

     evt.stopPropagation();
  }
  
  highlightSelectedItems(initX: number, initY: number, width: number, height: number): void {
    if(!this.iconBtnRefs) return;
    const selectionBounds = FileExplorerMultiSelectHelper.computeSelectionBounds(initX, initY, width, height, this.fileExplorerBoundedRect);

    // [class.fileexplr-multi-select-highlight]="markedBtnIds.has(i)" renders the
    // result — no DOM class mutation here.
    this.iconBtnRefs.forEach((btnRef, idx) => {
      if(FileExplorerMultiSelectHelper.intersects(btnRef.nativeElement.getBoundingClientRect(), selectionBounds)){
        this.markedBtnIds.add(idx);
      }else{
        this.markedBtnIds.delete(idx);
      }
    });
  }
  
  getCountOfAllTheMarkedButtons():number{
    return this.markedBtnIds.size;
  }

  getSelectFileSizeSumAndUnit():void{
    let sum = 0;

    if(this.markedBtnIds.size > 0){
      for(const id of this.markedBtnIds){
        const file = this.fetchedFiles[Number(id)];
        if(!file) continue;
        if(file.getIsFile){
          sum += file.getSizeInBytes;
        }else{
          this.hideShowFileSizeAndUnit();
          return;
        }
      }

      this.selectFilesSizeSum = String(CommonFunctions.getReadableFileSizeValue(sum));
      this.selectFilesSizeUnit = CommonFunctions.getFileSizeUnit(sum);
    }

    if(this.getIsBtnClickEvt()){
      //console.log('isBtnClickEvt:', this.getIsBtnClickEvt());
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
    // The multi-select highlight is bound via [class.fileexplr-multi-select-highlight]=
    // "markedBtnIds.has(i)", so clearing the Set removes every highlight; no DOM
    // class mutation needed.
    this.markedBtnIds.clear();
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

  onCopy():void{
    const action = MenuAction.COPY;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
    this._clipboardService.addFileEntry(this.selectedFile, action);
  }

  onCut():void{
    const action = MenuAction.CUT;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
    this._clipboardService.addFileEntry(this.selectedFile, action);
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
      const queuedFiles = this._fileService.getDragAndDropFile();
      if (!queuedFiles?.length) return;

      const delay = 50; //50ms
      const destPath = this.directory;

      // Skip files already in the drop target: moveAsync onto itself hits the
      // 'wx' write flag as a name collision, yielding a "name (1)" duplicate and
      // destroying the original.
      const files = queuedFiles.filter(f => dirname(f.getCurrentPath) !== destPath);
      if(files.length === 0){
        this._systemNotificationService.removeDragEventInfo();
        return;
      }

      // allSettled, not all: one rejection must not hide the other files' outcomes.
      const moveOutcomes = await Promise.allSettled(
        files.map(f => this._fileService.moveAsync(f.getCurrentPath, destPath, f.getIsFile))
      );

      const succeededFiles:FileInfo[] = [];
      const failedFiles:FileInfo[] = [];
      moveOutcomes.forEach((outcome, i) => {
        const file = files[i];
        if(outcome.status === 'fulfilled' && outcome.value === true){
          succeededFiles.push(file);
        }else{
          failedFiles.push(file);
        }
      });

      // Cleared before further awaits so it can't leak if a later step throws.
      this._systemNotificationService.removeDragEventInfo();

      if(succeededFiles.length > 0){
        const cameFromFileExplr = succeededFiles.some(f => !f.getCurrentPath.includes(Constants.DESKTOP_PATH));
        if(cameFromFileExplr){
          this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
          this._fileService.dirFilesUpdateNotify.next();
          await CommonFunctions.sleep(delay);
        }
        await this.refresh();
      }

      // Successful moves are not rolled back — a rollback would itself
      // partial-fail and undo work the user asked for.
      if(failedFiles.length > 0){
        const sampleNames = failedFiles.slice(0, 3).map(f => f.getFileName).join(', ');
        const moreSuffix = failedFiles.length > 3 ? `, +${failedFiles.length - 3} more` : '';
        const title = (succeededFiles.length === 0) ? DialogTitle.FILE_SVC_MOVE_FAILED : DialogTitle.FILE_SVC_MOVE_INCOMPLETE;
        const msg = `${failedFiles.length} of ${files.length} file(s) could not be moved: ${sampleNames}${moreSuffix}.`;
        console.error('onDrop partial/total failure:', { failed: failedFiles.map(f => f.getCurrentPath) });
        this._userNotificationService.showErrorNotification(msg, title);
      }
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

  /**
   * Drag SOURCE. The payload travels through the shared FileService queue, not
   * `event.dataTransfer` — dataTransfer can only carry OS-level File objects.
   */
  onDragStart(evt:DragEvent, draggedIndex:number):void{
    // Drag the whole multi-selection when the grabbed icon belongs to it,
    // otherwise drag just that icon and make it the active selection.
    let indicesToDrag:number[];
    if(this.markedBtnIds.size > 0 && this.markedBtnIds.has(draggedIndex)){
      indicesToDrag = Array.from(this.markedBtnIds);
    }else{
      indicesToDrag = [draggedIndex];
      this.doBtnClickThings(draggedIndex);
    }

    const filesToDrag = indicesToDrag
      .map(idx => this.fetchedFiles[idx])
      .filter((file):file is FileInfo => !!file);

    if(filesToDrag.length === 0){
      evt.preventDefault();
      return;
    }

    this.isDragFromFileExplorerActive = true;

    filesToDrag.forEach(file => this._fileService.addDragAndDropFile(file));

    const uId = `${this.name}-${this.processId}`;
    const dragEvtInfo:DragEventInfo = {
      origin: uId,
      currentLocation: Constants.EMPTY_STRING,
      isDragActive: this.isDragFromFileExplorerActive
    };
    this._systemNotificationService.setDropEventInfo(dragEvtInfo);

    // The resulting dropEffect is what onDragEnd reads to tell a real drop
    // from a cancelled one.
    if(evt.dataTransfer){
      evt.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragEnd(evt:DragEvent):void{
    this.isDragFromFileExplorerActive = false;

    // A real drop consumes the queue itself; a cancel (Esc / non-droppable
    // area) runs no drop handler, so clear the payload here.
    const wasDropped = !!evt.dataTransfer && evt.dataTransfer.dropEffect !== 'none';
    if(!wasDropped){
      this._fileService.removeDragAndDropFile();
      this._systemNotificationService.removeDragEventInfo();
    }
  }

  async showFileExplorerToolTip(evt: MouseEvent, file: FileInfo): Promise<void> {
    if (this.currentViewOption === ViewOptions.CONTENT_VIEW) return;

    this.currentTooltipFileId = file.getCurrentPath;
    await this.setInformationTipInfo(file);

    if (this.fileInfoTipData.length === 0) return;

    // Defer the position + visibility flip into requestAnimationFrame so Angular's
    // change detection flushes the *ngFor rows (and the new left/top) BEFORE the
    // opacity transition starts — otherwise the tip animates from a stale spot.
    requestAnimationFrame(() => {
      // The tip now lives on document.body with position:fixed, so its
      // coordinates are viewport-relative: place it at the cursor, then
      // clamp/flip so it never leaves the viewport even when the window is
      // near a screen edge.
      const tip = this.infoTipContainer?.nativeElement;

      const cursorGapY = 18; // small drop below the cursor
      const margin = 4;      // keep this gap from the viewport edges

      // visibility:hidden elements still report layout size, so we can measure
      // the fully-rendered tip.
      const tipW = tip ? tip.offsetWidth : 0;
      const tipH = tip ? tip.offsetHeight : 0;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = evt.clientX;
      let top  = evt.clientY + cursorGapY;

      // Flip to the left of the cursor if it would overflow the right edge.
      if(left + tipW + margin > vw)
        left = evt.clientX - tipW;

      // Flip above the cursor if it would overflow the bottom edge.
      if(top + tipH + margin > vh)
        top = evt.clientY - tipH - cursorGapY;

      // Final clamp so it always stays fully on-screen.
      left = Math.min(Math.max(margin, left), Math.max(margin, vw - tipW - margin));
      top  = Math.min(Math.max(margin, top),  Math.max(margin, vh - tipH - margin));

      this.infoTipLeftPx = Math.round(left);
      this.infoTipTopPx  = Math.round(top);
      this.isInfoTipVisible = true;
    });
  }

  /**
   * Move the info tooltip element out of the file-explorer window and into
   * document.body so it can extend beyond the window's clipped edges. Every
   * ancestor up to the window uses overflow:hidden and the window animates via
   * transform, so a descendant tooltip is always clipped (and a position:fixed
   * child would anchor to the transformed window, not the viewport). Angular
   * keeps full ownership of the node after the move (it addresses the element
   * by reference), so the [class.visible] / [style.left|top] bindings and the
   * *ngFor rows all keep updating.
   */
  private relocateInfoTipToBody(): void {
    const tip = this.infoTipContainer?.nativeElement;
    if(!tip) return;
    document.body.appendChild(tip);
  }

  /**
   * Lift the freshly-opened context menu out of the file-explorer window into
   * document.body (same rationale as relocateInfoTipToBody). Every ancestor up
   * to the window uses overflow:hidden and the window animates via transform, so
   * a menu left inside the window is clipped near the edges and a position:fixed
   * child would anchor to the transformed window rather than the viewport.
   * Angular keeps ownership by reference, so the *ngIf teardown + [style]
   * bindings keep working after the move.
   */
  private relocateMenuToBody(menuRef?: ElementRef<HTMLElement>): void {
    const menu = menuRef?.nativeElement;
    if(!menu) return;
    // Tag with this window's id so removeRelocatedMenus() can find + detach it
    // on close/destroy. Angular's *ngIf teardown can't remove a node we moved
    // off its container, so we own the body node's lifecycle from here on.
    menu.setAttribute('data-fe-menu-owner', String(this.processId));
    if(menu.parentElement !== document.body)
      document.body.appendChild(menu);
  }

  /**
   * Detach any context-menu node this window relocated to document.body. Called
   * when the menu is hidden and on destroy, since a node moved out of its *ngIf
   * container would otherwise linger on the body after the menu closes.
   */
  private removeRelocatedMenus(): void {
    const owned = document.querySelectorAll(`body > cos-menu[data-fe-menu-owner="${this.processId}"]`);
    owned.forEach(el => el.parentNode?.removeChild(el));
  }

  /**
   * Detach one specific relocated menu node from document.body. Used when
   * opening the other menu type so a previously-opened (and body-relocated)
   * menu doesn't linger and overlap the new one.
   */
  private detachRelocatedMenu(menuRef?: ElementRef<HTMLElement>): void {
    const el = menuRef?.nativeElement;
    if(el && el.parentNode === document.body)
      document.body.removeChild(el);
  }

  hideFileExplorerToolTip():void {
    this.currentTooltipFileId = Constants.EMPTY_STRING;
    this.fileInfoTipData = [];
    // Hiding is handled by the CSS (.visible removal → opacity/visibility). Zero
    // the coords so the next show doesn't flash at the stale position.
    this.isInfoTipVisible = false;
    this.infoTipLeftPx = 0;
    this.infoTipTopPx = 0;
  }

  async setInformationTipInfo(file:FileInfo):Promise<void>{
    // (Refactor) Tip rows are assembled by FileExplorerTooltipHelper (mirrors
    // `fileexplorer`); we inject this window's I/O + the stale-hover guard.
    // `isStillCurrent` preserves the old behaviour: if the user hovers away
    // while the folder size is resolving, the size/origin rows aren't appended.
    this.fileInfoTipData = await FileExplorerTooltipHelper.buildInformationTip(file, {
      getFolderSizeAsync: (path:string) => this._fileService.getFolderSizeAsync(path),
      getFolderOrigin: (path:string) => this._fileService.getFolderOrigin(path),
      getFileTypeName: (fileExt:string) => this.getFileTypeName(fileExt),
      isRecycleBinFolder: this.isRecycleBinFolder,
      loadImageContent: (path:string) => this._fileService.getFileInfoAsync(path),
      isStillCurrent: () => this.currentTooltipFileId === file.getCurrentPath,
    });
  }

  getFileTypeName(fileExt:string):string{
    for(const map of Constants.FILE_EXTENSION_MAP){
      if(map[0] === fileExt) {
         return map[1];
      }
    }

    return 'Unknown File';
  }

  /**
   * (Refactor #11.f) Position the invalid-filename-chars tooltip just below
   * the active rename input and reveal it.
   *
   * The tooltip element is no longer looked up via getElementById nor mutated
   * imperatively: the offset is written to `invalidCharsTooltipTransform` and
   * Angular flushes it through [style.transform] in the template. The
   * rename-form lookup remains (the rename forms are generated in an *ngFor;
   * a ViewChildren refactor for them is out of scope here). Its id already
   * includes `processId`, so the lookup is multi-instance safe.
   */
  showInvalidCharsToolTip():void{
    const renameFormElmnt = document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement | null;
    if(!renameFormElmnt) return;

    const fileRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const rect = renameFormElmnt.getBoundingClientRect();

    const x = rect.left - fileRect.left;
    const y = rect.top - fileRect.top;

    this.invalidCharsTooltipTransform = `translate(${x + 2}px, ${y + 2}px)`;
    this.isShowFileNameWarning = true;
  }

  hideInvalidCharsToolTip():void{
    this.isShowFileNameWarning = false;
  }

  onInputChange():void{
    // (Refactor) Source the value from the reactive form (formControlName=
    // "searchInput") instead of document.getElementById('searchTxtBox-'+pid).
    // Toggling isSearchBoxNotEmpty flips the .active class on the clear/go
    // icons; CSS handles the colours + :hover state.
    const value = (this.searchForm.value.searchInput as string | null) ?? Constants.EMPTY_STRING;
    this.isSearchBoxNotEmpty = value.length > 0;
  }

  onClearSearchTextBox():void{
    // (Refactor) Clear through the reactive form instead of reaching into the
    // DOM by id (searchTxtBox-<pid>).
    this.searchForm.patchValue({ searchInput: Constants.EMPTY_STRING });
    this.isSearchBoxNotEmpty = false;

    // Clearing the box also leaves search-results mode and restores the listing.
    if(this.isShowingSearchResults)
      void this.exitSearchResults();
  }

  // (Refactor) handleClearSearchIconHighlights / resetClearSearchIconHiglight /
  // handleSearchIconHighlights / resetSearchIconHiglight were removed. They
  // maintained the search clear/go icon hover backgrounds in TS via the
  // clearSearchStyle / searchStyle [style] objects. That is now pure CSS:
  // span.head-search-cntnr1/2.active (bound to isSearchBoxNotEmpty) + .active:hover.

  /**
   * Run a file-name search. Starts at the current directory and expands the
   * scope outward one ancestor level at a time up to root, so a hit close to
   * where the user is browsing surfaces first. Subtrees are memoized in
   * `_searchIndexCache`. Ported from the pared-down build (replaces the stub).
   */
  async onSearch():Promise<void>{
    const searchText = ((this.searchForm.value.searchInput as string | null) ?? Constants.EMPTY_STRING).trim();

    // Empty query: restore the listing if results are showing, else no-op.
    if(searchText.length === 0){
      if(this.isShowingSearchResults)
        await this.exitSearchResults();
      return;
    }

    this.addToSearchHistory(searchText);

    // Selection is keyed by list index, so clear it before swapping content.
    this.btnStyleAndValuesReset();
    this.markedBtnIds.clear();
    this.areMultipleIconsHighlighted = false;

    // At ROOT the quick-access "default view" hides the ol listing; results
    // must render in the listing, so leave the default view while searching.
    this.showDefaultView = false;

    this.isSearching = true;
    this.isShowingSearchResults = true;
    this.fetchedFiles = [];

    try{
      this.fetchedFiles = await this.runIncrementalSearch(this.directory, searchText);
    }finally{
      this.isSearching = false; // always clear the spinner, even if the walk threw
    }
  }

  /** Leave search-results mode and restore the real directory listing. */
  private async exitSearchResults():Promise<void>{
    this.isShowingSearchResults = false;
    if(this.directory === Constants.ROOT)
      this.showDefaultView = true;
    await this.loadFiles();
  }

  /**
   * Search the file system for files whose name contains `query`, starting at
   * `currentDirectory` and expanding up to root. Engine lives in
   * `FileExplorerSearchHelper`; here we inject this window's file loader,
   * cache and path helpers.
   */
  private runIncrementalSearch(currentDirectory:string, query:string):Promise<FileInfo[]>{
    return FileExplorerSearchHelper.runIncrementalSearch(currentDirectory, query, {
      loadDirectoryFiles: (path:string) => this._fileService.loadDirectoryFiles(path),
      cache: this._searchIndexCache,
      normalizePath: (path:string) => this.normalizePath(path),
      getParentPath: (path:string) => this.getParentPath(path),
      isDirectory: (path:string) => this._fileService.getStatAsync(path).then(s => s.isDirectory),
    });
  }

  /** Drop the cached search index so the next search re-walks fresh data. */
  private invalidateSearchIndex():void{
    this._searchIndexCache.clear();
  }

  /** Record a search term most-recent-first, de-duplicated and length-capped. */
  private addToSearchHistory(term:string):void{
    this.searchHistory = [term, ...this.searchHistory.filter(t => t !== term)].slice(0, 10);
  }

  /**
   * trackBy for the file-listing *ngFor loops. Keying rows by their path lets
   * Angular reuse existing DOM nodes across array mutations (sort / refresh /
   * search) instead of tearing down and rebuilding every icon on each change.
   */
  trackByFile(index:number, file:FileInfo):string{
    return file?.getCurrentPath ?? String(index);
  }

  isFormDirty(): void {
    // A dirty form means the user edited the name -> commit the rename;
    // otherwise just close the textbox. The old `renameFileTriggerCnt > 1`
    // gate here was a pre-menu-refactor workaround: the rename-select click
    // used to bubble up and immediately re-close the textbox, so it took two
    // triggers to stick. Now that MenuComponent.onMenuItemClick calls
    // stopPropagation, that double-trigger no longer happens and a single
    // trigger is correct.
    if(this.renameForm.dirty){
      this.onRenameFileTxtBoxDataSave();
    }else{
      this.onRenameFileTxtBoxHide();
    }
  }

  showSearchHistory(evt:MouseEvent):void{
    this.focusWindow();
    // (Refactor) visibility via bound field instead of getElementById.style.display.
    this.isSearchHistoryVisible = this.searchHistory.length > 0;
    evt.stopPropagation();
  }

  hideSearchHistory():void{
    this.isSearchHistoryVisible = false;
  }

  hideshowPathHistory():void{
    // (Refactor) toggle a bound flag; the template's [style.display] shows the
    // dropdown when it's on AND there are entries (was getElementById + inline
    // display/width via offsetWidth).
    this.showPathHistory = !this.showPathHistory;
  }

  hidePathHistory():void{
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
      :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
  }

  onFileExplrCntntClick():void{
    this.hidePathTextBox();
  }

  private async loadFiles(showUrlFiles=true):Promise<void>{
    this.isShowingSearchResults = false; // loading a real listing leaves search mode
    this.fetchedFiles = [];
    const directoryFiles  = await this._fileService.loadDirectoryFiles(this.directory);

    if(this.directory === Constants.ROOT){
      if(!showUrlFiles){
        this.fetchedFiles.push(...directoryFiles.filter(x => x.getFileExtension !== Constants.URL))
      }else{
        this.fetchedFiles.push(...directoryFiles.filter(x => x.getFileExtension === Constants.URL));
      }
    }else{
      this.fetchedFiles.push(...directoryFiles.filter(x => x.getCurrentPath !== Constants.RECYCLE_BIN_PATH)); 
    }

    //console.log('Fetched files:', this.fetchedFiles);
  }

  /**
   * Populate the Quick Access "Frequent folders" + "Recent files" panes from
   * the persisted QuickAccessService (most-used first). Folders feed the
   * frequent-folders pane; files feed the recent-files pane. Replaces the old
   * loadFalseFrequentFolders / loadFalseRecentFiles demo stubs.
   */
  private loadQuickAccessData():void{
    const quickAccessFiles = this._quickAccessService.getQuickAccessFiles();
    this.frequentFolders = quickAccessFiles.filter(f => !f.getIsFile);
    this.recentFiles = quickAccessFiles.filter(f => f.getIsFile);
  }

  /**
   * Context-menu "Pin to Quick access": explicitly add the selected item to the
   * Quick Access list (same store the open-tracking uses — pinning just seeds
   * the entry). Refresh the panes so a pin made while This PC is showing appears
   * immediately.
   */
  pinToQuickAccess():void{
    if(!this.selectedFile || this.selectedFile.getIsShortCut) return;

    if((this.showRecentlyUsedFiles && this.showFrequentlyUsedFolders))
      this._quickAccessService.add(this.selectedFile);
    else if(this.showRecentlyUsedFiles && this.selectedFile.getIsFile)
      this._quickAccessService.add(this.selectedFile);
    else if(this.showFrequentlyUsedFolders && !this.selectedFile.getIsFile)
      this._quickAccessService.add(this.selectedFile);

    this.loadQuickAccessData();
  }

  openInTerminal():void{
    const terminaApp = 'terminal';
    if(!this.selectedFile || this.selectedFile.getIsFile) return;

    this.selectedFile.setOpensWith = terminaApp;
    this._processHandlerService.runApplication(this.selectedFile);
  }

  async refresh(evt?:MouseEvent):Promise<void>{
    console.log('Refresh Called !!!!!!!')
    this.isIconInFocusDueToPriorAction = false;
    this.invalidateSearchIndex(); // next search re-walks fresh data

    if(evt)
      evt.stopPropagation();

    await this.loadFiles();
  }

  async onDeleteFile():Promise<void>{
    const desktopRefreshDelay = 1000;
    const callerUId = `${this.name}-${this.processId}`;
    const isAlreadyInRecycleBin = false;

    const filesToDelete = (this.areMultipleIconsHighlighted)
      ? Array.from(this.markedBtnIds).map(id => this.fetchedFiles[id]).filter((f):f is FileInfo => !!f)
      : [this.selectedFile];

    if(filesToDelete.length === 0) return;

    // skipConfirmDialog on all but the first: the service prompts once for the batch.
    const results = await Promise.all(
      filesToDelete.map((f, i) => this._fileService.deleteAsync(f.getCurrentPath, f.getIsFile, isAlreadyInRecycleBin,
        { file: f, skipConfirmDialog: i > 0, callerUId }
      ))
    );

    if(!results.every(Boolean)) return;

    this.removeDeletedFiles(filesToDelete);

    if(this.areMultipleIconsHighlighted){
      this._fileService.removeDragAndDropFile();
      this.markedBtnIds.clear();
      this.areMultipleIconsHighlighted = false;
    }else{
      this._menuService.resetStoreData();
    }

    await CommonFunctions.sleep(desktopRefreshDelay)
    this._fileService.addEventOriginator(Constants.DESKTOP);
    this._fileService.dirFilesUpdateNotify.next();
  }

  removeDeletedFiles(deletedFiles: FileInfo[]): void {
    this.fetchedFiles = this.fetchedFiles.filter(file =>
      !deletedFiles.some(
        del => del.getFileName === file.getFileName && del.getCurrentPath === file.getCurrentPath
      )
    );
  }

  onKeyPress(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_.\\s-]+$';

    // Clear any pending invalid-chars auto-hide timer before (re)arming, so we
    // never stack concurrent timers that fire on a possibly-destroyed component.
    if(this.invalidCharTimeOutId){
      clearTimeout(this.invalidCharTimeOutId);
    }

    if(evt.key === 'Enter'){
      evt.preventDefault(); // prevent newline in textarea
      this.isFormDirty(); // trigger form submit logic

      return true;
    }
    else{
      const isValid = new RegExp(regexStr).test(evt.key)
      if(isValid){
        this.hideInvalidCharsToolTip();
        const elmntId = `renameTxtBox-${this.processId}-${this.selectedElementId}`

        if(CommonFunctions.shouldAutoResize(elmntId))
          CommonFunctions.autoResize(elmntId);

        if(CommonFunctions.shouldMoveCursorToNextLine(elmntId))
          CommonFunctions.moveCursorToNextLine(elmntId);

        return isValid
      }else{
        this.showInvalidCharsToolTip();
        this.invalidCharTimeOutId = setTimeout(()=>{  this.hideInvalidCharsToolTip(); },this.INVALID_CHARS_SECONDS_DELAY)  // hide after 6 secs
        return isValid;
      }
    }
  }

  onRenameFileTxtBoxShow():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElement= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;

    if(!figCapElement || !renameContainerElement || !renameTxtBoxElement) return;

    figCapElement.style.display = 'none';
    renameContainerElement.style.display = 'block';
    renameTxtBoxElement.style.display = 'block';
    renameTxtBoxElement.style.zIndex = '3'; // ensure it's on top

    this.currentIconName = this.selectedFile.getFileName;
    this.renameForm.setValue({ renameInput: this.currentIconName });

    const elmntId =`renameTxtBox-${this.processId}-${this.selectedElementId}`;
    if(CommonFunctions.shouldAutoResize(elmntId)){
      CommonFunctions.autoResize(elmntId);
    }

    renameTxtBoxElement.focus();
    renameTxtBoxElement.select();
  }

  async onRenameFileTxtBoxDataSave():Promise<void>{ //##
    this.isRenameActive = !this.isRenameActive;
    const isRename = true;

    const figCapElmnt= document.getElementById(`figCapElmnt-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameFormElmnt= document.getElementById(`renameForm-${this.processId}-${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElmnt= document.getElementById(`renameTxtBox-${this.processId}-${this.selectedElementId}`) as HTMLInputElement;
    const renameText = this.renameForm.value.renameInput as string;
    const oldFileName = this.selectedFile.getFileName;
    // Capture BEFORE mutating selectedFile; activity history is keyed by the
    // path the row was originally stored under.
    const oldPath = this.selectedFile.getCurrentPath;

    if(renameText !== Constants.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName){

      const callerUId = `${this.name}-${this.processId}`;
      const renameResult = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText,  this.selectedFile.getIsFile,
        { file: this.selectedFile, callerUId }
      );
      if(renameResult){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        const fileIdx = this.fetchedFiles.findIndex(f => (f.getCurrentPath === this.selectedFile.getCurrentPath) && (f.getFileName === this.selectedFile.getFileName));
        this.selectedFile.setContentPath = renameText;
        this.selectedFile.setCurrentPath = `${dirname(this.selectedFile.getCurrentPath)}/${renameText}`;
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now().toString();
        this.fetchedFiles[fileIdx] = this.selectedFile;


        this.renameForm.reset();
        this._menuService.resetStoreData();
        //await this.loadFiles();
        const activity = CommonFunctions.getTrackingActivity(ActivityType.FILE, renameText, oldPath, oldFileName, isRename);
        CommonFunctions.trackActivity(this._activityHistoryService, activity);
      }
    }else{
      this.renameForm.reset();
    }

    // (Refactor) The rename flow ends with the icon still selected (prior-action
    // phase); flip the focus flags and let iconStateClass's prior-selected
    // highlight paint it (was the no-op setBtnStyle + renameFileTriggerCnt=0).
    this.isIconInFocusDueToCurrentAction = false;
    this.isIconInFocusDueToPriorAction = true;

    if(figCapElmnt && renameFormElmnt && renameTxtBoxElmnt){
      // Clear the inline display (don't hardcode 'block') so the caption falls
      // back to its stylesheet `display: -webkit-box`, which the 4-line clamp
      // (-webkit-line-clamp) depends on. Setting 'block' here silently disabled
      // the clamp after a rename save.
      figCapElmnt.style.display = '';
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
      // Clear the inline display (don't hardcode 'block') so the caption falls
      // back to its stylesheet `display: -webkit-box`, which the 4-line clamp
      // (-webkit-line-clamp) depends on. Setting 'block' here silently disabled
      // the clamp after a rename cancel.
      figCapElmnt.style.display = '';
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

  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    const directory = this.directory;
    const fileContent = this.generateShortcuContent(selectedFile, selectedFile.getIsShortCut);
    shortCut.setStringBuffer = fileContent;

    if(directory === Constants.ROOT){
      const title = DialogTitle.FILE_SVC_SHORTCUT;
      const msg = DialogMessage.FILE_SVC_SHORTCUT_CREATION_NOT_ALLOWED_IN_THIS_LOCATION;

      const uId = `${this.name}-${this.processId}`;
      const confirm = await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.Warning,  undefined, uId);
      const createOnDesktop = true;
      if(confirm)
        await this.createShortCutHelper(shortCut, selectedFile.getFileName, createOnDesktop);
    }
    else
      await this.createShortCutHelper(shortCut, selectedFile.getFileName);
  }

  generateShortcuContent(file:FileInfo, isShortcut: boolean):string{
    let fileContent = Constants.EMPTY_STRING;
        fileContent = `[InternetShortcut]
FileName=${file.getFileName}
IconPath=${file.getIconPath}
FileType=${file.getFileExtension}
ContentPath=${
  isShortcut 
  ? file.getContentPath 
  : (file.getIsFile) ? file.getCurrentPath || file.getContentPath : file.getCurrentPath
}
OpensWith=${file.getOpensWith}
`;
    return fileContent;
  }

  async createShortCutHelper(shortCut:FileInfo, fileName:string, createOnDesktop:boolean = false):Promise<void>{
    let result = false;
    shortCut.setFileName = `${fileName}${Constants.URL}`;
  
    if(createOnDesktop){
      // Desktop is a different surface — write to DESKTOP_PATH and fire the
      // cross-window notify so the desktop refreshes itself. This branch must
      // keep using Constants.DESKTOP_PATH; only the local branch below writes
      // to this.directory.
      result = await this._fileService.writeFileAsync(Constants.DESKTOP_PATH, shortCut);
      if(result){
        this._fileService.addEventOriginator(Constants.DESKTOP);
        this._fileService.dirFilesUpdateNotify.next();
      }
    }
    else{
      // Local branch — write into the CURRENT directory (never DESKTOP_PATH),
      // then read the true (de-duplicated) name back and push the FileInfo
      // straight into the listing to avoid a full-directory reload flicker.
      const requestID = CommonFunctions.generateID(8);
      result = await this._fileService.writeFileAsync(this.directory, shortCut, requestID);
      if(result){
        const trueName = this._fileService.getFileOrFolderNameByRequestId(requestID);
        const srcPath = CommonFunctions.removeDoubleSlashes(`${this.directory}/${trueName}`);
        const newShortCut = await this._fileService.getFileInfoAsync(srcPath);
        newShortCut.setFileName = trueName.replace(Constants.URL, Constants.EMPTY_STRING);
        this.fetchedFiles.push(newShortCut);
      }
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }
}
