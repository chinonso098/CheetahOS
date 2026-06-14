/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ViewChildren, QueryList, ElementRef, ViewEncapsulation, Input} from '@angular/core';
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
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { GeneralMenu, MenuPosition, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.types';
import { Constants } from 'src/app/system-files/constants';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ClipboardService } from 'src/app/shared/system-service/clipboard.service';
import { ActivityType, SortBys, UserNotificationType } from 'src/app/system-files/common.enums';
import { DragEventInfo, FileTreeNode } from 'src/app/system-files/common.interfaces';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { FileExplorerContextMenuHelper } from './fileexplorer.context.menu.helper';
import { FileExplorerGeneralHelper } from './fileexplorer.general.helper';
import { FileExplorerFileTreeHelper } from './fileexplorer.file.tree.helper';
import { FileExplorerSearchHelper } from './fileexplorer.search.helper';
import { FileExplorerTooltipHelper } from './fileexplorer.tooltip.helper';
import { FileExplorerMultiSelectHelper } from './fileexplorer.multi.select.helper';
import { FileExplorerPathHelper } from './fileexplorer.path.helper';
import { FileExplorerKeyboardHelper } from './fileexplorer.keyboard.helper';

@Component({
  selector: 'cos-fileexplorer',
  templateUrl: './fileexplorer.component.html',
  styleUrls: ['./fileexplorer.component.css'],
  standalone:false,
})

export class FileExplorerComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy {
  //#region Fields & Constants
  @ViewChild('fileExplorerMainContainer', {static: true}) fileExplrMainCntnr!: ElementRef; 
  @ViewChild('fileExplorerRootContainer', {static: true}) fileExplorerRootContainer!: ElementRef; 
  @ViewChild('fileExplorerContentContainer', {static: true}) fileExplrCntntCntnr!: ElementRef;
  @ViewChild('navExplorerContainer', {static: true}) navExplorerCntnr!: ElementRef; 
  // Refactor #11.a — path text box now driven by `isPathEditing` + this ref
  // instead of `document.getElementById('pathTxtBox-' + processId)`. static:false
  // because the input may not exist at the very first CD pass (its [style.display]
  // can defer focusability).
  @ViewChild('pathInputRef', {static: false}) pathInputRef?: ElementRef<HTMLInputElement>;
  // Refactor #11.b — used only to measure the breadcrumb container's width so
  // the path-history dropdown can match it (minus a small inset). static:true
  // because the container exists from the first render.
  @ViewChild('navPathContainer', {static: true}) navPathContainer!: ElementRef<HTMLElement>;
  // Refactor #11.h — typed ref to the lasso pane. Replaces
  // `document.getElementById('fileExplrMultiSelectPane')`, which previously
  // resolved against the whole document and could (with two FileExplorers
  // open) hand back the wrong window's pane. static:false because the pane
  // lives inside the dynamic `<ol>` template subtree.
  @ViewChild('selectPaneContainer', {static: false}) selectPaneContainer?: ElementRef<HTMLDivElement>;
  // Refactor #11.h — per-instance list of icon-view buttons (one per file in
  // `fetchedFiles`, in *ngFor order). Replaces the global
  // `document.querySelectorAll('.iconview-button')` scan used by the lasso,
  // which crossed FileExplorer instance boundaries. The QueryList is naturally
  // scoped to this component's template.
  @ViewChildren('iconBtn') iconBtnRefs!: QueryList<ElementRef<HTMLElement>>;

  // Keyboard navigation — typed ref to the `<ol>` list container. The list is
  // made focusable (tabindex="0" in the template) so it can receive arrow/Enter
  // keydown events. Per-instance, so keyboard focus in window A never reaches
  // window B's list.
  @ViewChild('fileExplorerListContainer', {static: false}) fileExplrListCntnr?: ElementRef<HTMLOListElement>;

  @Input() priorUId = Constants.EMPTY_STRING;
 
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _fileService!:FileService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _userNotificationService!:UserNotificationService;
  private _windowService!:WindowService;
  private _menuService!:MenuService;
  private _clipboardService!:ClipboardService;
  private _audioService!:AudioService;
  private _systemNotificationService!:SystemNotificationService;
  private _activityHistoryService!:ActivityHistoryService;
  private _defaultService!: DefaultService;
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
  private _windowResizeSub!: Subscription;
  // (Refactor #12) `_createShortCutOnDesktopSub` removed — the field was
  // declared and unsubscribed in ngOnDestroy but never assigned anywhere
  // (no service ever called .subscribe() into it). Dropping it removes a
  // dead unsubscribe call and a misleading field. If desktop-shortcut
  // notifications are reintroduced later, declare the Subscription at
  // assignment time so the lifecycle is obvious.
  
  private isActive = false;
  private isFocus = false;
  private isPrevBtnActive = false;
  private isNextBtnActive = false;
  private isUpBtnActive = true;
  // (`isNavigatedBefore` was removed in fix #2 — `runApplication` now uses the
  // same "push current dir, then mutate" pattern as `navigateTo`/`navigateToFolder`,
  // so no first-time gating is needed.)
  private isRenameActive = false;
  // Refactor #11.i — dropped `private` so the template can read these in
  // [class.is-selected-*] bindings. Still write-restricted by convention.
  isIconInFocusDueToCurrentAction = false;
  isIconInFocusDueToPriorAction = false;
  // Refactor #11.i — which icon (in fetchedFiles index order) the mouse is
  // currently over. -1 means none. Drives `.is-hovered` via [class.*] on
  // the icon button. Replaces the old `document.getElementById(...)` +
  // `style.backgroundColor/border` writes in `setBtnStyle`/`removeBtnStyle`.
  // Per-instance — hover state in window A cannot bleed into window B.
  hoveredElementId = -1;
  private isHideCntxtMenuEvt= false;
  private isShiftSubMenuLeft = false;
  private isRecycleBinFolder = false;
  private isDragFromFileExplorerActive = false;

  invalidCharTimeOutId!: NodeJS.Timeout;

  _isBtnClickEvt= false;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  // Refactor #11.i — dropped `private` so the template can read this in
  // [class.is-selected-*] / [class.is-hovered] bindings.
  selectedElementId = -1;
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
  // --- Search state -------------------------------------------------------
  // True while a search walk is running; drives the loading overlay.
  isSearching = false;
  // True while search RESULTS are shown in place of the directory listing.
  // Lets the clear/empty-query paths know to restore the normal folder view.
  isShowingSearchResults = false;
  // Refactor #11.a — true while the breadcrumb is swapped for an editable
  // path input. Drives [style.display] on the path-display / form / input.
  // Per-instance (each FileExplorer has its own field) so two open windows
  // don't toggle each other's path editor.
  isPathEditing = false;
  // Refactor #11.b — visibility of the search-input recent-searches dropdown.
  // Per-instance, so opening the dropdown in window A leaves window B alone.
  isSearchHistoryVisible = false;
  // Refactor #11.b — px width applied to the path-history dropdown when it
  // is opened. Re-measured on every open so the dropdown tracks resizes of
  // the parent FileExplorer window.
  pathHistoryWidthPx = 0;
  // (Refactor #11.c) The `onClearSearchIconHover` / `onSearchIconHover` /
  // `clearSearchStyle` / `searchStyle` fields were removed here. Hover
  // styling on the search / clear-search icons is now pure CSS, scoped to
  // `.active` — see span.head-search-cntnr{1,2}.active(:hover) in the .css.
  showIconCntxtMenu = false;
  showFileExplrCntxtMenu = false;
  quickAccessFolderSection = false;
  quickAccessFilesSection = false;
  showFileSizeAndUnit = false;
  showAFolderSelected = false;
  iconCntxtCntr = 0;
  fileExplrCntxtCntr = 0;
  selectFilesSizeSum = Constants.EMPTY_STRING;
  selectFilesSizeUnit = Constants.EMPTY_STRING;

  readonly ZIP = '.zip';
  readonly ROOT = Constants.ROOT;
  readonly THIS_PC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);
  readonly EMPTY_STRING = Constants.EMPTY_STRING
  readonly QUICK_ACCESS = 'Quick access';
  fileTreeNavToPath = Constants.EMPTY_STRING

  fileExplrCntxtMenuStyle:Record<string, unknown> = {};
  // (Refactor #11.f) CSS `transform` for the invalid-chars warning tooltip,
  // bound via [style.transform] on .tool-tip-container. Replaces the previous
  // `document.getElementById('invalidChars-' + processId).style.transform = ...`
  // pattern. Per-instance, so two open FileExplorers cannot reposition each
  // other's tooltip.
  invalidCharsTooltipTransform = '';
  // (Refactor #11.g) Bound to .fx-information-tip-container in the template.
  // Replaces document.getElementById('fx-information-tip-' + processId) +
  // imperative style.left/top/position + classList.add('visible'). Each
  // FileExplorer instance owns its own three fields, so the file-info
  // tooltip in window A is fully independent of window B's.
  infoTipLeftPx = 0;
  infoTipTopPx = 0;
  isInfoTipVisible = false;
  prevNavBtnStyle:Record<string, unknown> = {};
  nextNavBtnStyle:Record<string, unknown> = {};
  recentNavBtnStyle:Record<string, unknown> = {};
  upNavBtnStyle:Record<string, unknown> = {};
  upNavBtnCntnrStyle:Record<string, unknown> = {};
  tabLayoutCntnrStyle:Record<string, unknown> = {};
  ribbonMenuBtnStyle:Record<string, unknown> = {};
  // (Refactor #11.d) Removed: `ribbonMenuCntnrStyle`, `btnTypeRibbon`,
  // `btnTypeFooter`. They drove the colorBtnCntnr/uncolorBtnCntnr/
  // colorRibbonMenuCntnr/uncolorRibbonMenuCntnr methods, which have all
  // been replaced by CSS :hover rules on the three relevant containers
  // (.fileexp-header__question-cntnr, .fileexp-footer__details-cntnr,
  // .fileexp-footer__large-icon-cntnr).

  olClassName = ViewOptionsCSS.ICONS_VIEW_CSS;
  // (Refactor #11.j) Per-icon-size CSS class applied to the same <ol> alongside
  // `olClassName`. Possible values: 'view-small' / 'view-medium' / 'view-large'
  // / 'view-xlarge' / 'view-details'. CSS rules under `.ol-iconview-grid.view-*`
  // own all grid/button/image/caption/shortcut dimensions, replacing the old
  // imperative loops in `changeIconViewBtnSize` / `changeOrderedlistStyle`
  // that wrote inline styles on every fetched-file icon. Default matches the
  // default `currentViewOption = MEDIUM_ICON_VIEW`.
  viewSizeClass = 'view-medium';
  // (Bugfix follow-up to #11.i) `selectedRow` was a parallel selection state
  // only used by details view via `[class.active]="i === selectedRow"`. It
  // duplicated `selectedElementId` and didn't participate in the
  // current/prior/hover state machine, so a clicked row never deselected on
  // empty-space clicks. Details rows now bind the same three
  // [class.is-*] classes as icon-view buttons (see template), driven by
  // selectedElementId / isIconInFocusDueTo* / hoveredElementId / markedBtnIds.

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
  TOOL_TIP_DELAY:number = 450; //450ms
  
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

    /* Floors mirror the CSS min-width/min-height so the resize handler
     ignores transient sub-min sizes during drag. */
  readonly MIN_WIDTH_PX = 560;
  readonly MIN_HEIGHT_PX = 360;

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

  searchHistory:string[] = [];
  pathHistory:string[] = [];
  // Per-directory cache of recursively-collected files, reused across searches
  // so repeated/expanding searches don't re-walk the same subtrees.
  private _searchIndexCache = new Map<string, FileInfo[]>();

  sourceData:GeneralMenu[] = [
    {icon:Constants.EMPTY_STRING, label: 'Open', action: this.onTriggerRunApplication.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in new window', action: this.openInANewWindow.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Open in Terminal', action: this.openInTerminal.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Pin to Start', action: this.doNothing.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Send to Zip', action: this.onZip.bind(this) },
    {icon:Constants.EMPTY_STRING, label: 'Extract All...', action: this.onUnZip.bind(this) },
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
  fileDateModified = Constants.EMPTY_STRING;
  currentTooltipFileId = Constants.EMPTY_STRING;

  readonly shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;
  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;

  fileExplorerBoundedRect!:DOMRect;
  multiSelectStartingPosition!:MouseEvent | null;

  // Refactor #11.h — lasso pane geometry/visibility, bound to
  // #selectPaneContainer in the template via [class.visible] +
  // [style.transform] + [style.width.px] + [style.height.px]. The constant
  // pane styling (background, border, backdrop-filter, position, z-index)
  // now lives in CSS (.lasso-pane / .lasso-pane.visible) instead of being
  // re-applied on every mousemove.
  lassoVisible = false;
  lassoLeftPx = 0;
  lassoTopPx = 0;
  lassoWidthPx = 0;
  lassoHeightPx = 0;

  // Refactor #11.h — selection set (icon indices). Was a `string[]` with the
  // DOM class list as a parallel source of truth; now the Set is the single
  // source of truth and the `.fileexplr-multi-select-highlight` class is
  // driven by `[class.fileexplr-multi-select-highlight]="markedBtnIds.has(i)"`.
  markedBtnIds: Set<number> = new Set<number>();
  movedBtnIds:string[] = [];

  mountPath:string = Constants.EMPTY_STRING;

  icon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
  navPathIcon = `${Constants.IMAGE_BASE_PATH}this_pc.png`;
  isMaximizable = true;
  readonly name = 'fileexplorer';
  processId = 0;
  type = ComponentType.System;
  directory = Constants.ROOT;
  displayName = 'fileexplorer';
  hasWindow = true;

  //#endregion Fields & Constants

  //#region Constructor & Lifecycle
  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService, 
              triggerProcessService:ProcessHandlerService, formBuilder: FormBuilder, sessionManagementService:SessionManagementService, 
              menuService:MenuService, notificationService:UserNotificationService, windowService:WindowService, 
              audioService:AudioService, systemNotificationService:SystemNotificationService, activityHistoryService:ActivityHistoryService,
              defaultService: DefaultService, clipboardService:ClipboardService) { 

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
    this._formBuilder = formBuilder;
    this._defaultService = defaultService;
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
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });
    this._hideContextMenuSub = this._menuService.hideContextMenus.subscribe((p) => {
      if(p !== this.name) // don't answer your own call
        this.hideIconContextMenu();
    });

  }

  ngOnInit():void{
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

    // BUG FIX (#5): `_fileInfo` is optional (it's never assigned for some
    // launch paths, e.g. when File Explorer is opened from the Start menu
    // or restored from a session without a seeded FileInfo). The original
    // code unconditionally dereferenced `this._fileInfo.getCurrentPath`
    // here, which threw "Cannot read properties of undefined" and aborted
    // the rest of init. Fall back to the already-resolved `this.directory`
    // (which `retrievePastSessionData` / the guarded block above will have
    // populated; otherwise it still holds its class-default of `ROOT`).
    const initialPath = this._fileInfo ? this._fileInfo.getCurrentPath : this.directory;
    this.storeAppState(initialPath);
  }

  async ngAfterViewInit():Promise<void>{
    // (Refactor #11.a) `hidePathTextBoxOnload()` removed — the path-edit
    // input is now bound to `isPathEditing` which defaults to false, so the
    // form/input are hidden from the very first render without any
    // imperative DOM mutation needed at boot.
    // (Refactor #11.e) `changeTabLayoutIconCntnrCSS(this.currentViewOptionId, false)`
    // removed — the tab-layout icon row (`tabLayoutIconCntnr-*` spans) lives only
    // in `fileexplorer_old/`; the active template never rendered those elements,
    // so the document.getElementById lookup always returned null and the call
    // was a no-op.
    // (Refactor #11.j) was: changeFileExplorerLayoutCSS(currentViewOption).
    // Direct call to the new single-helper now that the imperative trio is
    // gone.
    this.applyViewClasses(this.currentViewOption);

    this.pathForm.setValue({
      pathInput: (this.directory !== Constants.ROOT)? this.directory : Constants.ROOT
    })

    await this.loadFileTreeAsync();
    await this.setProperRecycleBinIcon();
    await this.loadFiles();

    await CommonFunctions.sleep(this.SECONDS_DELAY[4])
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
    this._windowResizeSub?.unsubscribe();
    this._fetchDirectoryDataSub?.unsubscribe();
    this._goToDirectoryDataSub?.unsubscribe();
    // (Refactor #12) `_createShortCutOnDesktopSub?.unsubscribe()` removed
    // along with the dead field declaration above.
  }
  //#endregion Constructor & Lifecycle

  //#region State, Session & Button-Click Flag
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

    if(appSessionData !== null  && appSessionData.appData !== Constants.EMPTY_STRING){
      this.directory = appSessionData.appData as string;
    }
  }
  //#endregion State, Session & Button-Click Flag

  //#region Window Management (focus / maximize / minimize / resize)
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
      this.onWindowResize();
    }
  }

  minimizeWindow(_arg?:number[]):void{
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
  }

  onWindowResize():void{
    // CSS now drives layout (flex column root + flex row content with min-height:0).
    // Just strip any leftover inline px that older imperative code may have written.
    const targets: (ElementRef | undefined)[] = [
      this.fileExplrMainCntnr,
      this.fileExplrCntntCntnr,
      this.navExplorerCntnr,
    ];
    for(const ref of targets){
      const el = ref?.nativeElement as HTMLElement | undefined;
      if(!el) continue;
      el.style.height = '';
      el.style.width = '';
    }
  }
  //#endregion Window Management (focus / maximize / minimize / resize)

  //#region Navigation Button Styling
  setNavButtonsColor():void{
    // Initial colours for the nav arrows in the header.
    // Derive every fill from the corresponding `is*BtnActive` flag so the
    // class-level defaults are the single source of truth. (Cleanup #10:
    // previously the Up button was hard-coded to '#fff' regardless of
    // `isUpBtnActive`, while Prev/Next were hard-coded to '#ccc' regardless
    // of their flags — fine today, but it would silently lie about state
    // if any default changed.)
    const activeFill = '#fff';
    const inactiveFill = '#ccc';

    this.prevNavBtnStyle    = { fill: this.isPrevBtnActive ? activeFill : inactiveFill };
    this.nextNavBtnStyle    = { fill: this.isNextBtnActive ? activeFill : inactiveFill };
    this.upNavBtnStyle      = { fill: this.isUpBtnActive   ? activeFill : inactiveFill };

    // `recentNavBtnStyle` and `ribbonMenuBtnStyle` have no paired "active"
    // flag at init time — they remain at their static initial colours.
    this.recentNavBtnStyle  = { fill: inactiveFill };
    this.ribbonMenuBtnStyle = { fill: activeFill };
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
  //#endregion Navigation Button Styling

  //#region Path Navigation (back / forward / up)
  private normalizePath(path: string): string {
    return FileExplorerPathHelper.normalizePath(path, Constants.ROOT);
  }

  private getParentPath(path: string): string {
    return FileExplorerPathHelper.getParentPath(path, Constants.ROOT);
  }

  private rebuildUpStackFromCurrent(): void {
    // "Up" should take you to parent, then parent's parent, etc.
    this.upPathEntries = FileExplorerPathHelper.buildUpStack(
      this.directory, Constants.ROOT, Constants.RECYCLE_BIN_PATH);

    this.isUpBtnActive = this.upPathEntries.length > 0;
    this.upNavBtnStyle = { fill: this.isUpBtnActive ? '#fff' : '#ccc' };
  }

  private async navigateTo(targetPath: string, kind: string): Promise<void>{

    const next = this.normalizePath(targetPath);
    const cur  = this.normalizePath(this.directory);

    if(this.mountPath !== Constants.EMPTY_STRING && !next.includes(this.mountPath)){
      this.mountPath = Constants.EMPTY_STRING;
    }

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

    const detectedMount = this._fileService.findMountPointForPath(next);
    if(detectedMount !== Constants.EMPTY_STRING){
      this.mountPath = detectedMount;
      this.directory = detectedMount;
    }else{
      // Apply directory
      this.directory = next;
    }

    this.generateFileAndUpdateProcess(); // this must happen after directory is set;

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
    await this.captureComponentImg();
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
  //#endregion Path Navigation (back / forward / up)

  //#region Navigation Pane & Misc Nav UI
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
  //#endregion Navigation Pane & Misc Nav UI

  //#region File Tree
  private async loadFileTreeAsync():Promise<void>{
    if(this.isRecycleBinFolder) return;

    this.fileTreeNode = [];
    //this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.readDirectory(Constants.USER_BASE_PATH);
    const osDrive:FileTreeNode = {name:Constants.OSDISK, path: Constants.ROOT, isFolder: true, children:[]}

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
        const entryPath = `${path}/${dirEntry}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        const stat =  await this._fileService.getStatAsync(entryPath);
        const ftn:FileTreeNode = { name: dirEntry,  path: entryPath, isFolder: stat.isDirectory, children: [] }
        tmpFileTreeNode.push(ftn);
      }
  
      const res =  FileExplorerFileTreeHelper.addChildrenToNode(this.fileTreeNode, path, tmpFileTreeNode);
      this.fileTreeNode = res;
      this.fileTreeHistory.push(path);
    }
  }
  //#endregion File Tree

  //#region Folder Navigation (from tree / breadcrumb)
  async navigateToFolder(data: string[]): Promise<void> {
    console.log('navigateToFolder:', data);

    this.hideIconContextMenu(undefined, this.name);
    // Reset any prior mounted zip path when navigating via the file tree / breadcrumb.
    // BUG FIX (#1): this was previously `===` (a comparison whose result was discarded),
    // so a stale mount path from a previously opened .zip persisted across navigations
    // and caused `navigateTo` to keep treating us as "inside the mount".
    this.mountPath = Constants.EMPTY_STRING;

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
    if(targetDir !== curDir){
      this.prevPathEntries.push(curDir);
      this.nextPathEntries = []; // new branch => forward is invalid
    }

    // --- UI state ---
    this.isPrevBtnActive = this.prevPathEntries.length > 0;
    this.displayName = fileName;

    // `fileTreeNavToPath` is the "highlight in tree" target. The tree has no
    // node for the synthetic ROOT view, so blank it out in that case; for
    // every other path we highlight the navigated location.
    // (Cleanup #7: previous code wrote this via a ternary and then re-applied
    // the same blanking with a duplicate `if (rawPath === ROOT)` branch.)
    this.fileTreeNavToPath = (rawPath === Constants.ROOT) ? Constants.EMPTY_STRING : rawPath;

    // --- Apply navigation ---
    this.directory = targetDir;
    this.generateFileAndUpdateProcess(); // this must happen after directory is set;

    // --- Icon ---
    if(rawPath === `/Users/${fileName}`){
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
    // `loadFiles()` defaults `showOnlyUrlFiles=true`, which only matters when
    // `this.directory === ROOT` (it picks .url shortcut tiles vs. real files).
    // ROOT view -> show the non-shortcut listing; anywhere else -> defaults.
    // (Cleanup #7: original was a tautological `if (a || !b) ... else if (b) ...`
    // chain — `rawPath === thisPC || rawPath !== ROOT` is just `rawPath !== ROOT`.)
    if(rawPath === Constants.ROOT)
      await this.loadFiles(false);
    else
      await this.loadFiles();

    await CommonFunctions.sleep(this.SECONDS_DELAY[4]);
    await this.captureComponentImg();
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
  //#endregion Folder Navigation (from tree / breadcrumb)

  //#region Path Text Box, Breadcrumbs & Image Capture
  /**
   * Swap the breadcrumb display for the editable path input.
   *
   * (Refactor #11.a) Replaces three `document.getElementById(...-{processId})`
   * lookups + manual style mutations with a single boolean flag that the
   * template binds via [style.display]. Multi-instance safe by construction —
   * each FileExplorer instance owns its own `isPathEditing` field.
   */
  showPathTextBox(evt:MouseEvent):void{
    evt.stopPropagation();
    this.focusWindow();

    // Seed the input with the path the user is about to edit. Matches the
    // pre-refactor behaviour: while the history dropdown is open and we're
    // at ROOT, show the bare ROOT marker; otherwise show the current dir.
    if(this.showPathHistory){
      if(this.directory === Constants.ROOT)
        this.pathForm.setValue({ pathInput: Constants.ROOT });
    } else {
      this.pathForm.setValue({ pathInput: this.directory });
    }

    this.isPathEditing = true;

    // Defer focus/select to the next macrotask so Angular has flushed the
    // [style.display] binding and the browser has had a paint tick — an
    // element with display:none cannot be focused, and microtasks run
    // BEFORE zone-triggered change detection completes.
    setTimeout(() => {
      const el = this.pathInputRef?.nativeElement;
      el?.focus();
      el?.select();
    }, 0);
  }

  /**
   * (Refactor #11.a) Reverts the input/form back to the breadcrumb display.
   * Wired to (focusout) on the nav anchor — identical wiring as before, only
   * the visibility mechanism changed.
   */
  hidePathTextBox():void{
    this.isPathEditing = false;
  }

  /**
   * Navigate to the path the user typed into the address bar.
   *
   * Wired to the path form's (ngSubmit) (Enter key). Resolves the raw input to
   * an absolute path, verifies it exists, and either navigates there (folder)
   * or opens its containing folder (file). If the location can't be found, a
   * 'Location not found' error notification is raised and we stay put.
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
      await this.navigateToFolder([Constants.ROOT, Constants.ROOT]);
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
    await this.navigateToFolder([basename(destDir), destDir]);
  }

  /**
   * Populates `_directoryTraversalList` with the breadcrumb trail for the
   * current directory (delegated to the path helper).
   * RECYCLE_BIN_PATH → [RECYCLE_BIN]
   * user path like /Users/Bob/Documents → [THISPC, Users, Bob, Documents]
   * non-user path like /System/Library → [THISPC, System, Library]
   * root / → [THISPC, OSDISK] (stable breadcrumb)
   */
  generateBreadCrumbs(): void {
    this._directoryTraversalList = FileExplorerPathHelper.buildBreadCrumbs(this.directory, {
      root: Constants.ROOT,
      thisPc: Constants.THISPC,
      recycleBinPath: Constants.RECYCLE_BIN_PATH,
      recycleBin: Constants.RECYCLE_BIN,
      userBasePath: Constants.USER_BASE_PATH,
      osDisk: Constants.OSDISK,
      empty: Constants.EMPTY_STRING,
    });
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.fileExplorerRootContainer, this.processId, this.name, this.icon, this._windowService, { useJpeg: true, maxWidth: 320 });
  }
  //#endregion Path Text Box, Breadcrumbs & Image Capture

  //#region View / Layout (icon sizes, ordered list)
  toggleLargeIconsView():void{
    this.currentViewOption = ViewOptions.LARGE_ICON_VIEW;
    this.applyViewClasses(this.currentViewOption);
  }

  toggleDetailsView():void{
    this.currentViewOption = ViewOptions.DETAILS_VIEW;
    this.applyViewClasses(this.currentViewOption);
  }

  // (Refactor #11.j) `changeFileExplorerLayoutCSS` removed — it was just a
  // thin dispatcher over `changeLayoutCss` + `changeOrderedlistStyle` +
  // `changeIconViewBtnSize`. Replaced by `applyViewClasses` which sets both
  // CSS classes the template needs ([ngClass]="[olClassName, viewSizeClass]")
  // and works uniformly for icon views and details view.

  // (Refactor #11.e) Removed: `changeTabLayoutIconCntnrCSS(id, isMouseHover)`.
  // It mutated background/border/margin on `#tabLayoutIconCntnr-<pid>-<id>`
  // spans that only exist in the legacy `fileexplorer_old/` template. In the
  // active component the getElementById lookup always returned null, so every
  // branch fell through silently. If the tab-layout icon row is ever brought
  // back, re-implement it as a CSS-class-driven binding (e.g. [class.is-active]
  // + [class.is-hover] or pure :hover) rather than the imperative pattern.

  /**
   * Refactor #11.j: single source of truth for the two CSS classes that
   * drive layout. Replaces the imperative trio `changeLayoutCss` (set
   * `olClassName`) + `changeOrderedlistStyle` (write inline grid styles on
   * the <ol>) + `changeIconViewBtnSize` (loop over fetched files writing
   * inline width/height on each icon button / image / caption / shortcut).
   * All of that geometry now lives in `.ol-iconview-grid.view-*` CSS rules,
   * so this helper just picks the right two class names. Multi-instance
   * safe: writes to per-component fields only, no DOM lookups.
   */
  private applyViewClasses(view:ViewOptions):void{
    if(view === ViewOptions.DETAILS_VIEW){
      this.olClassName = ViewOptionsCSS.DETAILS_VIEW_CSS;
      this.viewSizeClass = 'view-details';
      return;
    }

    this.olClassName = ViewOptionsCSS.ICONS_VIEW_CSS;
    switch(view){
      case ViewOptions.SMALL_ICON_VIEW:        this.viewSizeClass = 'view-small';  break;
      case ViewOptions.LARGE_ICON_VIEW:        this.viewSizeClass = 'view-large';  break;
      case ViewOptions.EXTRA_LARGE_ICON_VIEW:  this.viewSizeClass = 'view-xlarge'; break;
      case ViewOptions.MEDIUM_ICON_VIEW:
      default:                                 this.viewSizeClass = 'view-medium'; break;
    }
  }

  // (Refactor #11.j) `changeLayoutCss`, `changeIconViewBtnSize` and
  // `changeOrderedlistStyle` were all deleted. The first only set the
  // `<ol>` class — now handled by `applyViewClasses`. The latter two looped
  // over `fetchedFiles` writing inline width/height/grid styles on every
  // icon element by `document.getElementById('...-${pid}-${i}')`. They had
  // three problems: (1) per-icon DOM mutation that didn't survive `*ngFor`
  // re-renders, requiring the toggles to be called again; (2) every fileexplorer
  // instance shared the same scan path, so a slow second instance would
  // contend with the first — the per-process id suffix saved us from cross-talk
  // but the lookup cost still scaled with O(processes × icons); (3) DETAILS_VIEW
  // crashed when it indexed past the end of the size tables. CSS rules under
  // `.ol-iconview-grid.view-small/.view-medium/.view-large/.view-xlarge` now
  // own all that geometry — set the class once on the <ol>, every descendant
  // picks it up via cascade. Multi-instance safe by construction.
  //#endregion View / Layout (icon sizes, ordered list)

  //#region Ribbon Menu Styling
  questionBtn():void{
   // no-op
  }

  // (Refactor #11.d) Removed methods:
  //   colorRibbonMenuCntnr, uncolorRibbonMenuCntnr  — dead (no template ref).
  //   colorBtnCntnr, uncolorBtnCntnr                — replaced by CSS :hover.
  //#endregion Ribbon Menu Styling

  //#region Run Application & Selection (clicks / hovers)
  async runApplication(file:FileInfo, evt?:MouseEvent):Promise<void>{
    if(evt)
      evt.stopPropagation();

    console.log('fileexplorer-runApplication:',file)
    this.fileTreeNavToPath = Constants.EMPTY_STRING;

    this.hideToolTip();
    CommonFunctions.handleTracking(this._activityHistoryService, file);
    await this._audioService.play(this.cheetahNavAudio);

    if(this.isRecycleBinFolder){
      this._menuService.showPropertiesView.next(file);
      return;
    }

    const isFolder = (file.getOpensWith === Constants.FILE_EXPLORER 
      && file.getFileName !== Constants.FILE_EXPLORER) 
      && file.getFileType === Constants.FOLDER;

    const isZipFile = (file.getOpensWith === Constants.FILE_EXPLORER 
      && file.getFileType === this.ZIP)

    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    if(isFolder || isZipFile){

      // --- Navigation stack maintenance ---------------------------------
      // IMPORTANT: capture `fromDir` BEFORE the zip-mount block below runs,
      // because that block mutates `this.directory` to the mount path. If
      // we read `this.directory` after the mount, the back stack would
      // record the mount path instead of the folder we are leaving from
      // (regression seen when opening a .zip from /Users/Games: Back
      // jumped all the way to "/" because /Users/Games was never pushed).
      const fromDir = this.directory;

      // Track whether the mount was established THIS call. Needed because
      // `this.mountPath` can be non-empty in two very different cases:
      //   (a) we just mounted in this call         -> target = mountPath
      //   (b) we are drilling INTO an existing mount
      //       (clicking a folder inside the zip)   -> target = file.getCurrentPath
      // Without this distinction, drilling deeper inside a mounted zip
      // collapses to "target == current" and navigation silently no-ops.
      let mountedThisCall = false;

      if(isZipFile && this.mountPath === Constants.EMPTY_STRING){
        const detectedMount = this._fileService.findMountPointForPath(file.getCurrentPath);
        if(detectedMount !== Constants.EMPTY_STRING){
          this.mountPath = detectedMount;
          this.directory = detectedMount;
        }else{
          const mountPath = await this.getZipFileMountPath(file.getCurrentPath);
          this.directory = mountPath; this.mountPath = mountPath;
        }
        mountedThisCall = true;
      }

      // Resolve the target directory:
      //   - URL shortcut       -> follow getContentPath
      //   - zip mounted now    -> the mount path that the block above set
      //   - everything else    -> the file's own current path
      // (Bug fixes #2 / #3 / #4 — see prior comment block. Forward history
      // is invalidated on any real navigation; Up stack is rebuilt from the
      // resolved directory's actual parent chain by `rebuildUpStackFromCurrent`.)
      let targetDir: string;
      if(file.getCurrentPath.includes(Constants.URL)){
        targetDir = file.getContentPath;
      }else if(mountedThisCall){
        targetDir = this.directory; // already set to mountPath above
      }else{
        targetDir = file.getCurrentPath;
      }

      // Only mutate history if we are actually changing directories.
      if(targetDir !== fromDir){
        this.prevPathEntries.push(fromDir);
        this.nextPathEntries = []; // new branch -> forward history is invalid
      }

      this.directory = targetDir;
      this.displayName = file.getFileName;
      this.icon = file.getIconPath;

      // Rebuild Up stack from the new directory's real parent chain.
      this.rebuildUpStackFromCurrent();

      // Back button reflects actual back-stack depth.
      this.isPrevBtnActive = this.prevPathEntries.length > 0;
      this.prevNavBtnStyle = { fill: this.isPrevBtnActive ? '#fff' : '#ccc' };

      // Forward stack was just cleared (when navigating) -> forward is inactive.
      this.isNextBtnActive = this.nextPathEntries.length > 0;
      this.nextNavBtnStyle = { fill: this.isNextBtnActive ? '#fff' : '#ccc' };

      if(this.recentPathEntries.indexOf(this.directory) === -1){
        this.recentPathEntries.push(this.directory);
      }

      this.generateBreadCrumbs();
      this.setNavPathIcon(file.getFileName, file.getCurrentPath);
      this.storeAppState(file.getCurrentPath);
      this.updatedProcesss(file);
  
      await this.loadFiles();
      await CommonFunctions.sleep(this.SECONDS_DELAY[4])
     await this.captureComponentImg();
      
      return;
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
    // Refactor #11.i: previously called `setBtnStyle(id, true)` to paint the
    // selected icon imperatively. The same visual is now produced by the
    // [class.is-selected-current] binding on the icon button — it activates
    // automatically because `doBtnClickThings` set `selectedElementId = id`
    // and `isIconInFocusDueToCurrentAction = true`.
    this.getSelectFileSizeSumAndUnitOrFolders();
    // Keyboard navigation: move DOM focus to the list container so subsequent
    // arrow/Enter keys are captured by `onFileExplorerKeyDown`. Details-view
    // rows are not focusable, so without this the first keypress after a click
    // would be lost. preventScroll keeps the viewport steady.
    this.selectedFile = this.fetchedFiles[id];
    this.fileExplrListCntnr?.nativeElement.focus({preventScroll: true});

    evt.stopPropagation();
  }

  supressPropagation(evt:MouseEvent):void{
    evt.stopPropagation();
    evt.preventDefault()
  }

  //#region Keyboard Navigation
  /**
   * Keyboard navigation for the file list (`<ol>`, made focusable via
   * tabindex="0"). Supports Windows-Explorer-style keys:
   *   ArrowLeft/Right  — previous / next item
   *   ArrowUp/Down     — up / down one grid row (icon view) or one row (details)
   *   Home / End       — first / last item
   *   Enter            — open / activate the selected item
   *   F2               — rename the selected item
   *   Escape           — clear the selection
   * Multi-instance safe: navigation reads only this component's `fetchedFiles`
   * and `iconBtnRefs`; no global document scans.
   */
  onFileExplorerKeyDown(evt:KeyboardEvent):void{
    // The rename textbox owns its own keys (handled by `onKeyPress`); don't
    // hijack typing/Enter while a rename is in progress.
    if(this.isRenameActive) return;

    const total = this.fetchedFiles.length;
    if(total === 0) return;

    const current = this.selectedElementId; // -1 when nothing is selected
    const isDetailsView = this.currentViewOption === this.detailsView;
    const columns = isDetailsView ? 1 : this.getIconViewColumnCount();
    let handled = true;

    // Grid-movement keys resolve to an index; action keys fall through below.
    const nextIndex = FileExplorerKeyboardHelper.computeNextIndex(evt.key, current, total, columns);
    if(nextIndex !== null){
      this.selectIconByIndex(nextIndex);
    }else{
      switch(evt.key){
        case 'Enter':
          if(current >= 0 && current < total){
            void this.runApplication(this.fetchedFiles[current]);
          }
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
   * Select the item at `index` from the keyboard. Reuses `doBtnClickThings`
   * (the same path a single mouse click takes) so the existing
   * [class.is-selected-current] binding paints the highlight, then updates the
   * footer size readout and scrolls the item into view.
   */
  private selectIconByIndex(index:number):void{
    if(index < 0 || index >= this.fetchedFiles.length) return;

    // Keyboard navigation is single-select — drop any lasso multi-selection.
    if(this.markedBtnIds.size > 0){
      this.markedBtnIds.clear();
      this.areMultipleIconsHighlighted = false;
    }

    this.hoveredElementId = -1; // clear stale hover paint so the keyboard selection shows
    this.doBtnClickThings(index);
    this.selectedFile = this.fetchedFiles[index];
    this.propertiesViewFile = this.fetchedFiles[index];
    this.getSelectFileSizeSumAndUnitOrFolders();
    this.scrollSelectedIntoView(index);
  }

  /**
   * Count the icons on the first grid row by comparing each button's top
   * offset to the first button's. Works for the CSS `auto-fill` grid at any
   * view size and stays correct when the window is resized. Returns 1 when
   * there are no icon buttons (e.g. details view) or only one item.
   */
  private getIconViewColumnCount():number{
    const refs = this.iconBtnRefs?.toArray() ?? [];
    if(refs.length <= 1) return 1;

    const firstTop = refs[0].nativeElement.getBoundingClientRect().top;
    let columns = 0;
    for(const ref of refs){
      const top = ref.nativeElement.getBoundingClientRect().top;
      if(Math.abs(top - firstTop) < 1) columns++;
      else break;
    }
    return Math.max(columns, 1);
  }

  /**
   * Scroll the selected item into view. Icon view uses the per-instance
   * `iconBtnRefs`; details view falls back to the row's processId-qualified id
   * (unique per instance). Keyboard focus stays on the `<ol>` so the next key
   * keeps reaching `onFileExplorerKeyDown`.
   */
  private scrollSelectedIntoView(index:number):void{
    let element:HTMLElement | undefined;
    if(this.currentViewOption === this.detailsView){
      element = document.getElementById(`trElmnt-${this.processId}-${index}`) ?? undefined;
    }else{
      element = this.iconBtnRefs?.toArray()[index]?.nativeElement;
    }
    element?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }
  //#endregion Keyboard Navigation

  // Refactor #11.i: `onQuickAccessMouseEnter` / `onQuickAccessMouseLeave` /
  // `onQuickAcessShowIconContextMenu` were removed — the Quick Access section
  // (which referenced `btnElmnt-file/folder-*` and `fileExplrQAFiles/Folder-*`
  // ids) exists only in `fileexplorer_old/`. The methods were dead in the
  // active component.

  onMouseEnter(id:number):void{
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;
      // Refactor #11.i: just record which icon the mouse is over. The
      // template's [class.is-hovered] binding paints the bg/border. No DOM
      // lookup, no per-instance leak.
      this.hoveredElementId = id;
    }
  }

  async showToolTip(evt:MouseEvent, file:FileInfo):Promise<void>{
    await this.showFileExplorerToolTip(evt, file);
  }

  onMouseLeave(id:number):void{
    this.isMultiSelectEnabled = true;
    this.hideToolTip();

    // Refactor #11.i: clearing `hoveredElementId` removes `.is-hovered`. If
    // the icon is the currently-selected one and selection is in the "prior"
    // (post-click / post-context-menu) phase, the [class.is-selected-prior]
    // binding will now light up automatically (the white ring look). This
    // preserves the legacy `setBtnStyle(id, false)` behaviour for that case.
    if(this.hoveredElementId === id){
      this.hoveredElementId = -1;
    }
  }

  doNothing():void{/** */}

  async openInTerminal():Promise<void>{
    const terminal ="terminal";
    const selectedFile = this.selectedFile;

    if(selectedFile.getIsFile){
      console.warn('Cannot open file in Terminal');
      return;
    }
    selectedFile.setOpensWith = terminal;
    await this.runApplication(selectedFile);
  }

  async openInANewWindow():Promise<void>{
    const selectedFile = this.selectedFile;

    if(selectedFile.getIsFile){
      console.warn('Cannot open file in File Explorer');
      return;
    }
    selectedFile.setOpensWith = Constants.FILE_EXPLORER;
    await this.runApplication(selectedFile);
  }

  updateTableFieldSize(data:string[]) {
    // Column-resize events are handled by the directive;
    // reserved for future per-cell width synchronization.
  }

  // (Bugfix follow-up to #11.i) `onProcessSelected` removed. It set a
  // duplicate `selectedRow` field that didn't honor the
  // current/prior/hover state machine. Details rows now go through the
  // same `onBtnClick` / `onMouseEnter` / `onMouseLeave` / `handleIconHighLightState`
  // path as icon-view buttons, so selection clears on empty-space click etc.
  //#endregion Run Application & Selection (clicks / hovers)

  //#region Context Menu (build / show / hide / position)
  // Refactor #11.i: `onQuickAcessShowIconContextMenu` removed — it was dead
  // in the active component (only `fileexplorer_old/` still references the
  // Quick Access section and its `fileExplrQAFiles/Folder-*` ids).

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    evt.preventDefault();
    evt.stopPropagation();

    // looking at what Windows does, at any given time. there is only one context window open
    this._menuService.hideContextMenus.next(this.name); 
    this.hideToolTip();

    const menuHeight = (file.getIsFile)? 225 : 344; //this is not ideal.. menu height should be gotten dynmically
    this.iconCntxtCntr++;

    const contentRect:DOMRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const axis = this.checkAndHandleMenuBounds(contentRect, evt, menuHeight);
    
    const uId = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uId);

    this.adjustIconContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file
    this.isIconInFocusDueToPriorAction = false;
    this.showFileExplrCntxtMenu = false;

    if(!this.showIconCntxtMenu)
      this.showIconCntxtMenu = !this.showIconCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);
    // Refactor #11.i: previously `setBtnStyle(id, true)`. Painting is now
    // handled by [class.is-selected-current] reacting to `selectedElementId`
    // and `isIconInFocusDueToCurrentAction` (both updated by doBtnClickThings).

    this.fileExplrCntxtMenuStyle = {
      'position': 'absolute', 
      'left':`${Math.round(axis.xAxis)}px`,
      'top':`${Math.round(axis.yAxis)}px`,
      'z-index': 2,
    }
  }

  adjustIconContextMenuData(file:FileInfo):void{
    // Pure filtering lives in the helper; we just apply the result.
    const [menuData, menuOrder] = FileExplorerContextMenuHelper.adjustIconContextMenuData(file, this.sourceData, this.isRecycleBinFolder);
    this.menuData = menuData;
    this.menuOrder = menuOrder;
  }


  onShowFileExplorerContextMenu(evt:MouseEvent):void{
    evt.stopPropagation();
    evt.preventDefault();

    this.showExpandTreeIcon = false;
    this.showIconCntxtMenu = false;
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
      'left':`${Math.round(axis.xAxis)}px`,
      'top':`${Math.round(axis.yAxis)}px`,
      'z-index': 2,
    }
  }

  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  hideIconContextMenu(evt?:MouseEvent, caller?:string):void{
    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }

    this.showIconCntxtMenu = false;
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
  }

  checkAndHandleMenuBounds(rect:DOMRect, evt:MouseEvent, menuHeight:number):MenuPosition{
    // Placement geometry lives in the helper; it also tells us whether nested
    // sub-menus must flip left, which we keep on the component for the template.
    const [position, isShiftSubMenuLeft] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(rect, evt, menuHeight);
    this.isShiftSubMenuLeft = isShiftSubMenuLeft;
    return position;
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
    return FileExplorerGeneralHelper.handleBuildViewByMenu(
      this.showExtraLargeIconsM, this.isExtraLargeIcon,
      this.showLargeIconsM, this.isLargeIcon,
      this.showMediumIconsM, this.isMediumIcon,
      this.showSmallIconsM, this.isSmallIcon,
      this.showDetailsIconsM, this.isDetailsIcon);
  }

  buildSortByMenu(): NestedMenuItem[]{
    return FileExplorerGeneralHelper.handleBuildSortByMenu(
      this.sortByNameM.bind(this), this.isSortByName,
      this.sortBySizeM.bind(this), this.isSortBySize,
      this.sortByItemTypeM.bind(this), this.isSortByItemType,
      this.sortByDateModifiedM.bind(this), this.isSortByDateModified);
  }

  buildNewMenu(): NestedMenuItem[]{
    return FileExplorerGeneralHelper.handleBuildNewMenu();
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
  //#endregion Context Menu (build / show / hide / position)

  //#region Icon Highlight & Button State
  handleIconHighLightState():void{
    this.hideShowFileSizeAndUnit();
    this.showAFolderSelected = false;

    //First case - I'm clicking only on the folder icons
    if((this.getIsBtnClickEvt() && this.btnClickCnt >= 1) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt === 0)){  
      
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= 0)
          // Refactor #11.i: previously `setBtnStyle(this.selectedElementId, false)`.
          // The flag flip is enough — [class.is-selected-prior] picks it up.
          this.isIconInFocusDueToPriorAction = true;
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

          // Refactor #11.h: removeClassAndStyleFromBtn() now clears the Set
          // itself; this explicit reassignment is preserved for clarity.
          this.markedBtnIds.clear();
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

    // Refactor #11.i: previously `removeBtnStyle(prevSelectedElementId)` when
    // selection moved to a new icon. The old icon now loses its
    // [class.is-selected-*] automatically because `selectedElementId` changed.
  }

  // Refactor #11.i: `setBtnStyle(id, isMouseHover, btnElementInput?)` and
  // `removeBtnStyle(id, btnElementInput?)` were deleted. The per-icon
  // bg/border that they painted via document.getElementById is now produced
  // by three CSS classes on `.iconview-button`, bound via [class.*]:
  //   .is-hovered          — hoveredElementId === i (when not multi-selected)
  //   .is-selected-current — selectedElementId === i && isIconInFocusDueToCurrentAction
  //   .is-selected-prior   — selectedElementId === i && isIconInFocusDueToPriorAction (and not hovered)
  // The multi-select highlight (.fileexplr-multi-select-highlight) suppresses
  // all three (the bindings include `!markedBtnIds.has(i)`), matching the
  // legacy behaviour where the lasso style took precedence.

  btnStyleAndValuesReset():void{
    this.setIsBtnClickEvt(false, 'btnStyleAndValuesReset');
    this.btnClickCnt = 0;
    // Refactor #11.i: previously `removeBtnStyle(selectedElementId)` +
    // `removeBtnStyle(prevSelectedElementId)`. Clearing the ids below makes
    // both icons stop matching every `.is-selected-*` binding, so Angular CD
    // removes the classes for us — no DOM writes needed.
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
    // Refactor #11.i: previously `setBtnStyle(selectedElementId, false)`.
    // Toggling the two focus flags above is enough; the
    // [class.is-selected-prior] binding lights up automatically.
  }

  // Refactor #11.i: `removeBtnStyle(id, btnElementInput?)` deleted — see the
  // multi-line note above `doBtnClickThings`. Call sites either no longer
  // need it (CD-driven) or were updated to manipulate the driver fields.
  //#endregion Icon Highlight & Button State

  //#region Multi-Select (lasso, selection sum)
  /**
   * (Refactor #11.h) Begin a lasso drag. The pane element is reached via the
   * `selectPaneContainer` ViewChild (per-instance) rather than a global
   * document.getElementById — this is the fix for the cross-instance pane
   * leak that occurred when two FileExplorers were open.
   */
  activateMultiSelect(evt:MouseEvent):void{
    this.fileExplorerBoundedRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    if(this.isMultiSelectEnabled && this.selectPaneContainer){
      this.isMultiSelectActive = true;
      this.multiSelectStartingPosition = evt;
    }
    evt.stopPropagation();
  }

  /**
   * (Refactor #11.h) End a lasso drag. Hides the pane via the bound
   * `lassoVisible` flag (CSS handles the rest) and finalizes the selection
   * count / sum using the per-instance Set.
   */
  deActivateMultiSelect():void{
    this.lassoVisible = false;
    this.lassoLeftPx = 0;
    this.lassoTopPx = 0;
    this.lassoWidthPx = 0;
    this.lassoHeightPx = 0;

    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    // The Set is already the source of truth — no need to re-scan the DOM
    // for `.fileexplr-multi-select-highlight` like the old getIDs/getCount
    // helpers did (which also globbed across other FileExplorer instances).
    this.areMultipleIconsHighlighted = this.markedBtnIds.size > 0;
    this.getSelectFileSizeSumAndUnitOrFolders();
  }

  /**
   * (Refactor #11.h) Update the lasso pane geometry as the mouse moves.
   * Writes to component fields (bound on the pane) instead of mutating 9
   * inline styles per mousemove tick. Geometry is computed by the helper.
   */
  updateDivWithAndSize(evt:MouseEvent):void{
    if(!this.isMultiSelectEnabled) return;
    if(!this.multiSelectStartingPosition || !this.isMultiSelectActive) return;

    const lasso = FileExplorerMultiSelectHelper.computeLassoRect(
      this.fileExplorerBoundedRect, this.multiSelectStartingPosition, evt);

    this.lassoLeftPx = lasso.left;
    this.lassoTopPx = lasso.top;
    this.lassoWidthPx = lasso.width;
    this.lassoHeightPx = lasso.height;
    this.lassoVisible = true;

    this.highlightSelectedItems(lasso.left, lasso.top, lasso.width, lasso.height);

    evt.stopPropagation();
  }

  /**
   * (Refactor #11.h) Mark icons that intersect the lasso rectangle. Iterates
   * this component's own QueryList of icon buttons (per-instance) instead of
   * `document.querySelectorAll('.iconview-button')` — which would otherwise
   * include buttons in any other open FileExplorer window.
   *
   * Hit-test math lives in the helper; only the input list and the highlight
   * sink (Set vs. DOM classList) are component concerns.
   */
  highlightSelectedItems(initX: number, initY: number, width: number, height: number): void {
    if(!this.iconBtnRefs) return;
    const selectionRect = FileExplorerMultiSelectHelper.computeSelectionBounds(
      initX, initY, width, height, this.fileExplorerBoundedRect);

    // ViewChildren preserves *ngFor index order, so `idx` matches the file id
    // used everywhere else (fetchedFiles[idx], btnElmnt-{pid}-{idx}, etc.).
    this.iconBtnRefs.forEach((btnRef, idx) => {
      const btnIconRect = btnRef.nativeElement.getBoundingClientRect();
      if(FileExplorerMultiSelectHelper.intersects(btnIconRect, selectionRect)){
        // Refactor #11.i/#11.h: when the currently-single-selected icon gets
        // pulled into the lasso, mark it. The `[class.is-selected-*]`
        // bindings include `!markedBtnIds.has(i)`, so adding the index to
        // the Set suppresses the single-select look automatically — no
        // imperative DOM cleanup needed any more.
        this.markedBtnIds.add(idx);
      } else {
        this.markedBtnIds.delete(idx);
      }
    });
  }

  /**
   * (Refactor #11.h) Compatibility shim — a handful of legacy call sites
   * still ask for the count. Backed by the Set's size now.
   */
  getCountOfAllTheMarkedButtons():number{
    return this.markedBtnIds.size;
  }

  getSelectFileSizeSumAndUnitOrFolders():void{
    let sum = 0; let aFolderIsSelected = false;

    if(this.markedBtnIds.size > 0){
      for(const id of this.markedBtnIds){
        const file = this.fetchedFiles[id];
        if(file.getIsFile){
          sum += file.getSizeInBytes;
        }else{
          this.hideShowFileSizeAndUnit();
          if(!aFolderIsSelected){
            aFolderIsSelected = true;
            this.showAFolderSelected = true;
          }
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
        this.showAFolderSelected = false;
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

  /**
   * (Refactor #11.h/#11.i) Clear the multi-select highlight. Emptying the
   * Set is enough — Angular CD removes
   * `[class.fileexplr-multi-select-highlight]` from each affected icon.
   * No DOM walk, no per-icon style cleanup (single-select styling is also
   * CD-driven now).
   */
  removeClassAndStyleFromBtn():void{
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
  //#endregion Multi-Select (lasso, selection sum)

  //#region Zip / Unzip
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
  //#endregion Zip / Unzip

  //#region Clipboard (Copy / Cut / Paste / Restore)
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
  //#endregion Clipboard (Copy / Cut / Paste / Restore)

  //#region Drag & Drop
  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    event.stopPropagation();
  
    const dragInfo = this._systemNotificationService.getDragEventInfo();
    if(dragInfo){ //&& (dragInfo.Origin.includes(Constants.FILE_EXPLORER) || dragInfo.Origin.includes(Constants.DESKTOP_PATH))
      // Pull (and clear) the queued drag payload from the shared FileService.
      const queuedFiles = this._fileService.getDragAndDropFile();
      if (!queuedFiles?.length) return;

      const delay = 50; //50ms
      const destPath = this.directory;

      // Same-directory guard: skip any file whose parent folder is already the
      // drop target. Now that icons are draggable, a user can drag an icon and
      // release it back onto its own File Explorer; without this guard
      // `moveAsync` would "move" the file onto itself, which the underlying
      // write (flag 'wx') treats as a name collision — producing a duplicate
      // "name (1)" copy and deleting the original. Files already here are no-ops.
      const files = queuedFiles.filter(f => dirname(f.getCurrentPath) !== destPath);
      if(files.length === 0){
        this._systemNotificationService.removeDragEventInfo();
        return;
      }

      // Use allSettled (not all) so a single failure/throw doesn't mask the
      // outcome of the other files. We need to know exactly which files moved
      // so the view can reflect reality after a partial move.
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

      // Clear drag state before any further awaits so it can't leak if a later
      // step throws.
      this._systemNotificationService.removeDragEventInfo();

      if(succeededFiles.length > 0){
        // Files NOT under the Desktop path came from a File Explorer window —
        // tell other explorers to refresh their (now-emptier) source folder.
        const cameFromFileExplr = succeededFiles.some(f => !f.getCurrentPath.includes(Constants.DESKTOP_PATH));
        if(cameFromFileExplr){
          this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
          this._fileService.dirFilesUpdateNotify.next();
          await CommonFunctions.sleep(delay);
        }
        await this.refresh();
      }

      // Surface partial / total failure to the user instead of silently
      // swallowing it. We don't roll back the successful moves — that would
      // itself partial-fail and undo work the user asked for.
      if(failedFiles.length > 0){
        const sampleNames = failedFiles.slice(0, 3).map(f => f.getFileName).join(', ');
        const moreSuffix = failedFiles.length > 3 ? `, +${failedFiles.length - 3} more` : '';
        const title = (succeededFiles.length === 0) ? 'Move failed' : 'Some files could not be moved';
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
   * Drag SOURCE: fired when the user starts dragging an icon/row (index
   * `draggedIndex`). Registers the file(s) being dragged with the shared
   * FileService queue so a drop target (Desktop or another File Explorer) can
   * pick them up, and publishes a `DragEventInfo` identifying this window as
   * the origin.
   *
   * Payload transport note: the file objects travel through the FileService
   * queue (`addDragAndDropFile`), NOT through `event.dataTransfer`. The native
   * dataTransfer can only carry OS-level File objects, so all in-app drags use
   * the service as the cross-component channel.
   */
  onDragStart(evt:DragEvent, draggedIndex:number):void{
    // Decide which files travel with this drag:
    //  - If a multi-selection exists AND the grabbed icon is part of it, drag
    //    the whole selection.
    //  - Otherwise drag only the grabbed icon, and make it the active
    //    single-selection so the highlight matches what is being moved.
    let indicesToDrag:number[];
    if(this.markedBtnIds.size > 0 && this.markedBtnIds.has(draggedIndex)){
      indicesToDrag = Array.from(this.markedBtnIds);
    }else{
      indicesToDrag = [draggedIndex];
      this.doBtnClickThings(draggedIndex);
    }

    // Resolve indices to FileInfo objects, dropping any out-of-range entries.
    const filesToDrag = indicesToDrag
      .map(idx => this.fetchedFiles[idx])
      .filter((file):file is FileInfo => !!file);

    // Nothing valid to move — cancel the native drag so no stale state lingers.
    if(filesToDrag.length === 0){
      evt.preventDefault();
      return;
    }

    this.isDragFromFileExplorerActive = true;

    // Hand the payload to the shared queue for the drop target to read back.
    filesToDrag.forEach(file => this._fileService.addDragAndDropFile(file));

    // Publish this drag's identity. `origin` embeds this window's name + PID;
    // the Desktop drop handler matches on `Constants.FILE_EXPLORER`.
    const uId = `${this.name}-${this.processId}`;
    const dragEvtInfo:DragEventInfo = {
      origin: uId,
      currentLocation: Constants.EMPTY_STRING,
      isDragActive: this.isDragFromFileExplorerActive
    };
    this._systemNotificationService.setDropEventInfo(dragEvtInfo);

    // Hint the browser this is a move. The resulting `dropEffect` is what
    // onDragEnd inspects to tell a successful drop from a cancelled one.
    if(evt.dataTransfer){
      evt.dataTransfer.effectAllowed = 'move';
    }
  }

  /**
   * Drag SOURCE cleanup: fired when the drag ends (whether dropped or not).
   *
   * A drop on a valid target consumes the queued files and clears the drag
   * info itself. But if the user released over a non-droppable area or pressed
   * Esc, the native `dropEffect` stays `'none'` and no drop handler ran — so we
   * clear the leftover payload here to stop it leaking into the next drop.
   */
  onDragEnd(evt:DragEvent):void{
    this.isDragFromFileExplorerActive = false;

    const wasDropped = !!evt.dataTransfer && evt.dataTransfer.dropEffect !== 'none';
    if(!wasDropped){
      this._fileService.removeDragAndDropFile();
      this._systemNotificationService.removeDragEventInfo();
    }
  }
  //#endregion Drag & Drop

  //#region Tooltips (file info / invalid chars)
  /**
   * (Refactor #11.g) Position + reveal the file-info tooltip.
   *
   * Previously this method called document.getElementById to grab the
   * tooltip div, then mutated `style.position/left/top` and added a
   * `visible` class. The position is now bound via [style.left.px] /
   * [style.top.px] and visibility via [class.visible] in the template.
   *
   * `position: absolute` is no longer set imperatively — the base CSS rule
   * for `.fx-information-tip-container` already declares it.
   *
   * We still defer the `visible` flip into requestAnimationFrame so that
   * Angular's change detection flushes the new left/top BEFORE the opacity
   * transition starts. Otherwise the tooltip would briefly animate from its
   * previous position. zone.js patches rAF, so setting fields inside the
   * callback still triggers CD.
   */
  private async showFileExplorerToolTip(evt:MouseEvent, file: FileInfo): Promise<void> {
    const rect:DOMRect = this.fileExplrCntntCntnr.nativeElement.getBoundingClientRect();
    const mousePoistionX = evt.clientX - rect.left;
    const mousePositionY = evt.clientY - rect.top;

    this.currentTooltipFileId = file.getCurrentPath;
    await this.setInformationTipInfo(file);

    if(this.fileInfoTipData.length === 0) return;

    requestAnimationFrame(() => {
      // Coordinates are relative to the content container, which is the tooltip's
      // offsetParent (position: relative). So we just nudge it slightly below the
      // cursor. (Previously offsetX=180 / offsetY=80 compensated for the nav pane
      // width + header height — only valid when the offsetParent was the full
      // file-explorer container; it pushed the tip far from the cursor once the
      // content container became the offsetParent.)
      const offsetX = 0;
      const offsetY = 18;

      this.infoTipLeftPx = Math.round(mousePoistionX + offsetX);
      this.infoTipTopPx  = Math.round(mousePositionY + offsetY);
      this.isInfoTipVisible = true;
    });
  }

  /**
   * (Refactor #11.g) Hide the file-info tooltip.
   *
   * Resetting the position fields to 0 isn't strictly required — the
   * `[class.visible]` removal alone hides the element via opacity:0 +
   * visibility:hidden in the CSS. We zero them anyway so the next show
   * doesn't briefly flash at the stale coordinates if the rAF callback
   * fires before the new left/top are written.
   */
  hideToolTip():void {
    this.currentTooltipFileId = Constants.EMPTY_STRING;
    this.fileInfoTipData = [];
    this.isInfoTipVisible = false;
    this.infoTipLeftPx = 0;
    this.infoTipTopPx = 0;
  }

  async setInformationTipInfo(file:FileInfo):Promise<void>{
    // The tip rows are assembled by the helper; we inject this window's I/O.
    this.fileInfoTipData = await FileExplorerTooltipHelper.buildInformationTip(file, {
      getFolderSizeAsync: (path:string) => this._fileService.getFolderSizeAsync(path),
      getFolderOrigin: (path:string) => this._fileService.getFolderOrigin(path),
      getFilesAndFolders: (path:string) => this.getAListOfFilesAndFoldersInCurrentDirectory(path),
      isRecycleBinFolder: this.isRecycleBinFolder,
    });
  }

  getFileTypeName(fileExt:string):string{
    return  CommonFunctions.getFileTypeName(fileExt);
  }

  /**
   * (Refactor #11.f) Position the invalid-filename-chars tooltip just below
   * the active rename input and reveal it.
   *
   * Previously this method called document.getElementById on both the tooltip
   * AND the rename form, then mutated `style.transform` directly. The tooltip
   * lookup is gone — the value is now written to `invalidCharsTooltipTransform`
   * and Angular flushes it through [style.transform] in the template.
   *
   * NOTE: the rename-form lookup remains for now — the rename forms are
   * generated inside an *ngFor and a dedicated ViewChildren refactor for them
   * is out of scope for #11.f. The id pattern already includes `processId`,
   * so the lookup is multi-instance safe.
   */
  showInvalidCharsToolTip():void{
    const renameFormElmnt = document.getElementById(
      `renameForm-${this.processId}-${this.selectedElementId}`
    ) as HTMLElement | null;
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
  //#endregion Tooltips (file info / invalid chars)

  //#region Search & Path History
  onInputChange():void{
    // (Refactor #11.c) Source the value from the reactive form instead of
    // document.getElementById('searchTxtBox-' + processId). The form is
    // bound via formControlName="searchInput", so its value is authoritative.
    const value = (this.searchForm.value.searchInput as string | null) ?? Constants.EMPTY_STRING;
    this.isSearchBoxNotEmpty = value.length > 0;
    // No reset*Highlight() calls needed \u2014 toggling `isSearchBoxNotEmpty`
    // switches the `.active` class on the search/clear icons; CSS handles
    // the colors and the :hover state automatically.
  }

  onClearSearchTextBox():void{
    // (Refactor #11.c) Clear the input through the reactive form instead of
    // reaching into the DOM by id. No more searchTxtBox-<processId> lookup.
    this.searchForm.patchValue({ searchInput: Constants.EMPTY_STRING });
    this.isSearchBoxNotEmpty = false;
    // Clearing the box also leaves search-results mode and restores the listing.
    if(this.isShowingSearchResults){
      void this.exitSearchResults();
    }
    // No reset*Highlight() calls needed — toggling `isSearchBoxNotEmpty` off
    // removes the `.active` class, and the CSS `:hover` rule scoped to
    // `.active` stops applying automatically.
  }

  // (Refactor #11.c) Removed methods:
  //   handleClearSearchIconHighlights, handleSearchIconHighlights,
  //   resetClearSearchIconHiglight,    resetSearchIconHiglight
  // All four were maintaining hover state in TS — now handled by pure CSS
  // :hover on span.head-search-cntnr{1,2}.active.

  /**
   * Run a file-name search.
   *
   * Strategy (per the request): start at the current directory and expand the
   * scope outward one ancestor level at a time, up to root — so a hit close to
   * where the user is browsing surfaces first and we avoid indexing all of root
   * unless the walk actually reaches it. Subtrees are memoised in
   * `_searchIndexCache`, so an expanding/repeat search reuses already-walked
   * directories instead of re-reading them.
   */
  async onSearch():Promise<void>{
    const searchText = ((this.searchForm.value.searchInput as string | null) ?? Constants.EMPTY_STRING).trim();

    // Empty query: nothing to search. If results are showing, restore the
    // normal directory listing; otherwise just no-op.
    if(searchText.length === 0){
      if(this.isShowingSearchResults){
        await this.exitSearchResults();
      }
      return;
    }

    // Hide the recent-search dropdown and remember this term for next time.
    this.isSearchHistoryVisible = false;
    this.addToSearchHistory(searchText);

    // Selection state is keyed by list index, so it would be meaningless once
    // the listing is replaced by results — clear it before swapping content.
    this.btnStyleAndValuesReset();
    this.markedBtnIds.clear();
    this.areMultipleIconsHighlighted = false;

    // Show the loading overlay while the (potentially deep) walk runs.
    this.isSearching = true;
    this.isShowingSearchResults = true;
    this.fetchedFiles = [];

    try{
      this.fetchedFiles = await this.runIncrementalSearch(this.directory, searchText);
    }finally{
      // Always clear the spinner, even if a walk threw partway through.
      this.isSearching = false;
    }
  }

  /**
   * Leave search-results mode and restore the real directory listing.
   * `loadFiles()` clears `isShowingSearchResults`, so this is the single place
   * that "un-searches" the view.
   */
  private async exitSearchResults():Promise<void>{
    await this.loadFiles();
  }

  /**
   * Search the file system for files whose name contains `query`, starting at
   * `currentDirectory` and expanding up to root. The engine itself lives in
   * `FileExplorerSearchHelper`; here we just inject this window's file loader,
   * cache and path helpers.
   */
  private runIncrementalSearch(currentDirectory:string, query:string):Promise<FileInfo[]>{
    return FileExplorerSearchHelper.runIncrementalSearch(currentDirectory, query, {
      loadDirectoryFiles: (path:string) => this._fileService.loadDirectoryFiles(path),
      cache: this._searchIndexCache,
      normalizePath: (path:string) => this.normalizePath(path),
      getParentPath: (path:string) => this.getParentPath(path),
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

  isFormDirty(): void {
    if(this.renameForm.dirty === true){
      this.onRenameFileTxtBoxDataSave();
  
    }else if(this.renameForm.dirty === false){
      this.renameFileTriggerCnt ++;
      if(this.renameFileTriggerCnt > 1){
        this.onRenameFileTxtBoxHide();
        this.renameFileTriggerCnt = 0;
      }
    }
  }

  /**
   * (Refactor #11.b) Show the recent-search dropdown when the search input is
   * clicked, provided there's something to show. Replaces the old
   * `document.getElementById('searchHistory-' + processId).style.display = 'block'`
   * pattern with a per-instance boolean bound via [style.display] in the template.
   */
  showSearchHistory(evt:MouseEvent):void{
    this.focusWindow();

    if(this.searchHistory.length > 0){
      this.isSearchHistoryVisible = true;
    }

    evt.stopPropagation();
  }

  /** (Refactor #11.b) Hide the recent-search dropdown. Wired to (focusout). */
  hideSearchHistory():void{
    this.isSearchHistoryVisible = false;
  }

  /**
   * (Refactor #11.b) Toggle the path-history dropdown open/closed.
   *
   * The dropdown's width is matched to the breadcrumb container's current
   * width (minus a 25px inset for the right-side controls) every time it is
   * opened. We measure on demand instead of binding to a getter so we don't
   * call offsetWidth on every change-detection pass, and we measure on each
   * open so the dropdown follows window resizes that happen while closed.
   */
  hideshowPathHistory():void{
    this.showPathHistory = !this.showPathHistory;

    if(this.showPathHistory && this.pathHistory.length > 0){
      const containerEl = this.navPathContainer?.nativeElement;
      if(containerEl){
        this.pathHistoryWidthPx = Math.max(0, containerEl.offsetWidth - 25);
      }
    }
  }

  /** (Refactor #11.b) Force-close the path-history dropdown. */
  hidePathHistory():void{
    this.showPathHistory = false;
  }
  //#endregion Search & Path History

  //#region Recycle Bin & Directory Listing
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


  async getAListOfFilesAndFoldersInCurrentDirectory(fPath:string):Promise<string[]>{
    const directoryFiles = await this._fileService.loadDirectoryFiles(fPath);
    return FileExplorerGeneralHelper.summarizeDirectoryContents(directoryFiles);
  }
  //#endregion Recycle Bin & Directory Listing

  //#region Load / Refresh / Delete
  onFileExplrCntntClick():void{
    this.hidePathTextBox();
  }

  /**
   * loadFiles by default, when the path is root, will only fetch url files
   * @param showOnlyUrlFiles 
   */
  private async loadFiles(showOnlyUrlFiles=true):Promise<void>{
    // Loading a real directory listing always means we're no longer showing
    // search results, so leaving search-results mode is centralised here.
    this.isShowingSearchResults = false;
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
    // A manual refresh may follow file-system changes, so the cached search
    // index could be stale — drop it and let the next search rebuild it.
    this.invalidateSearchIndex();

    if(evt)
      evt.stopPropagation();

    await this.loadFiles();
  }

  // async onDeleteFile___():Promise<void>{

  //   const desktopRefreshDelay = 1000;
  //   const callerUId = `${this.name}-${this.processId}`;
  //   const isAlreadyInRecycleBin = false;

  //   const result = await this._fileService.deleteAsync(this.selectedFile.getCurrentPath, this.selectedFile.getIsFile, isAlreadyInRecycleBin,
  //     { file: this.selectedFile, callerUId }
  //   );

  //   if(result){
  //     this._menuService.resetStoreData();
  //     await this.loadFiles();

  //     await CommonFunctions.sleep(desktopRefreshDelay)
  //     this._fileService.addEventOriginator(Constants.DESKTOP);
  //     this._fileService.dirFilesUpdateNotify.next();
  //   }
  // }

  async onDeleteFile(): Promise<void> {
    const isAlreadyInRecycleBin = false;
    const callerUId = `${this.name}-${this.processId}`;

    // Determine which files to delete
    const filesToDelete = (this.areMultipleIconsHighlighted)
      ? Array.from(this.markedBtnIds).map(id => this.fetchedFiles[id])
      : [this.selectedFile];

    // Run deletions concurrently — the service handles confirm-delete (first file only) and file-in-use checks
    const results = await Promise.all(
      filesToDelete.map((f, i) => this._fileService.deleteAsync(f.getCurrentPath, f.getIsFile, isAlreadyInRecycleBin,
        { file: f, skipConfirmDialog: i > 0, callerUId }
      ))
    );

    // If all deletions succeeded
    if (!results.every(Boolean)) return; 

    this.removeDeletedFiles(filesToDelete);
    if (this.areMultipleIconsHighlighted) 
      this._fileService.removeDragAndDropFile();
    else 
      this._menuService.resetStoreData();
  }

  removeDeletedFiles(deletedFiles: FileInfo[]): void {
    this.fetchedFiles = this.fetchedFiles.filter(file =>
      !deletedFiles.some(
        del => del.getFileName === file.getFileName && del.getCurrentPath === file.getCurrentPath
      )
    );
  }
  //#endregion Load / Refresh / Delete

  //#region Rename (keypress, show/save/hide textbox)

  onKeyPress(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_.\\s-]+$';

    if(this.invalidCharTimeOutId){
      clearTimeout(this.invalidCharTimeOutId);
    }

    if(evt.key === 'Enter'){
      evt.preventDefault(); // prevent newline in textarea
      this.isFormDirty(); // trigger form submit logic

      return true;
    }
    
    // else if(evt.key.length > 1){
    //   // non-printable keys (ArrowRight, Home, Shift, etc.) — allow but skip resize
    //   return true;
    // }
    
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
        this.invalidCharTimeOutId = setTimeout(()=>{  this.hideInvalidCharsToolTip(); },this.SECONDS_DELAY[2])  // hide after 6 secs
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
        //const fileIdx = this.fileExplrFiles.findIndex(f => (f.getCurrentPath === this.selectedFile.getContentPath) && (f.getFileName === this.selectedFile.getFileName));
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

    // Refactor #11.i: previously `setBtnStyle(selectedElementId, false)`. The
    // rename flow ends with the icon still selected (prior-action phase), so
    // we flip the focus flags and let [class.is-selected-prior] paint it.
    this.isIconInFocusDueToCurrentAction = false;
    this.isIconInFocusDueToPriorAction = true;
    this.renameFileTriggerCnt = 0;

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
  //#endregion Rename (keypress, show/save/hide textbox)

  //#region Sort & Layout Selection (menu helpers)
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
    // (Refactor #11.j) was: changeLayoutCss + changeOrderedlistStyle +
    // changeIconViewBtnSize. Now a single class-binding update on the <ol>.
    this.currentViewOption = inputViewOption;
    this.applyViewClasses(inputViewOption);
  }
  

  setViewFlagsToFalse():void{
    this.isExtraLargeIcon = false;
    this.isLargeIcon = false;
    this.isMediumIcon = false;
    this.isSmallIcon = false;
    this.isDetailsIcon = false;
  }
  //#endregion Sort & Layout Selection (menu helpers)

  //#region Shortcut Creation
  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    const directory = this.directory;
    const fileContent = this.generateShortcuContent(selectedFile);
    shortCut.setStringBuffer = fileContent;

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
  //#endregion Shortcut Creation

  //#region Process / Component Helpers
  private generateFileAndUpdateProcess():void{
    const updateFile = new FileInfo();
    updateFile.setOpensWith = Constants.FILE_EXPLORER 
    updateFile.setCurrentPath = this.directory;
    updateFile.setIsFile = false;
    this.updatedProcesss(updateFile);
  }

  private updatedProcesss(file:FileInfo):void{
    const updtProcesss =  new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, file);
    this._runningProcessService.updateProccess(updtProcesss);
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }
  //#endregion Process / Component Helpers
}