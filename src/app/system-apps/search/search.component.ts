/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { FileIndexerService } from 'src/app/shared/system-service/file.indexer.services';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FormBuilder, FormGroup } from '@angular/forms';

import { ActivityType, FileIndexIDs } from "src/app/system-files/common.enums";
import { FileSearchIndex } from 'src/app/system-files/common.interfaces';
import { debounceTime, Subscription } from 'rxjs';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import {basename, dirname, extname} from 'path';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';
import { CommonFunctions } from 'src/app/system-files/common.functions';

@Component({
  selector: 'cos-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  standalone:false,
})

export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cheetahSearchDiv', {static: true}) cheetahSearchDiv!: ElementRef<HTMLDivElement>;
  private _renderer:Renderer2;

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _menuService!:MenuService;
  private _systemNotificationServices!:SystemNotificationService;
  private _fileIndexerService!:FileIndexerService;
  private _activityHistoryService!:ActivityHistoryService;
  private _processHandlerService!:ProcessHandlerService;

  private _formBuilder:FormBuilder;
  private _fileSearchIndex:FileSearchIndex[] = [];

  // Holds the form value-changes subscription so it can be torn down in ngOnDestroy.
  private _searchBoxChangeSub?:Subscription;
  // Collects every long-lived subscription created in the constructor so they can
  // all be unsubscribed together when the component is destroyed (prevents leaks).
  private _subscriptions:Subscription[] = [];

  searchBarForm!: FormGroup;

  defaultsearchIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  readonly searchAllIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  readonly searchPinIcon = `${Constants.IMAGE_BASE_PATH}search_pin.png`;
  readonly searchOpenIcon = `${Constants.IMAGE_BASE_PATH}search_open.png`;
  readonly searchCopyIcon = `${Constants.IMAGE_BASE_PATH}search_copy.png`;
  readonly searchFileIcon = `${Constants.IMAGE_BASE_PATH}search_file.png`;
  readonly searchMusicIcon = `${Constants.IMAGE_BASE_PATH}search_music.png`;
  readonly searchVideoIcon = `${Constants.IMAGE_BASE_PATH}search_video.png`;
  readonly searchFolderIcon = `${Constants.IMAGE_BASE_PATH}search_folder.png`;
  readonly searchPictureIcon = `${Constants.IMAGE_BASE_PATH}search_picture.png`;
  readonly searchApplicatiionIcon = `${Constants.IMAGE_BASE_PATH}search_app.png`;
  readonly cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;

  readonly NAVIGATE_TO_PATH = 1;
  readonly RUN_APP = 2;

  searchPlaceHolder = ' Type here to search....';
  openApp = 'Open';
  openSrcPath = 'Open file location';
  copySrcPath = 'Copy path'

  optionsMenuToggle = false;
  showOptionsMenu = false;
  showSearchResult = false

  showBestMatchView = true;
  showNoMatchFoundView = false;
  noMatchImg = this.cheetahIcon;
  noMatchText = Constants.EMPTY_STRING;

  showFilesSection = true;
  showFoldersSection = true;
  showApplicationSection = true;
  showOthersSection = false;

  isAppPresent = false;
  isFilePresent = false;
  isNotFound = false;
  isFolderPresent = false;
  isSearchWindowVisible = false;

  hasRecents = false;

  bestMatchId = -1;
  prefixType = Constants.EMPTY_STRING;
  bestMatchFor = Constants.EMPTY_STRING;  
  otherSectionName = Constants.EMPTY_STRING;
  otherSectionFocusType = Constants.EMPTY_STRING;
  
  menuOptions!:string[][];
  filteredFileSearchIndex:FileSearchIndex[] = [];
  onlyAppsSearchIndex:FileSearchIndex[] = [];
  onlyFilesSearchIndex:FileSearchIndex[] = [];
  onlyFoldersSearchIndex:FileSearchIndex[] = [];

  onlyTopApps:FileSearchIndex[] = [];
  onlyRecents:FileSearchIndex[] = [];
  onlyRecommends:FileSearchIndex[] = [];

  selectedOptionID = 0;
  selectedResultSetOptionId = 0;
  selectedResultSetOptionType = Constants.EMPTY_STRING;

  fileInfo!:FileInfo;
  bestMatch!:FileSearchIndex;
  selectedResultSetOption!:FileSearchIndex;

  // --- Keyboard navigation state ---------------------------------------
  // A flat, top-to-bottom ordered view of every currently-visible result
  // item (Best match, then Apps, Files, Folders / Others). Each entry
  // carries what `applyResultSetSelection` needs to highlight it and what
  // `openSearchResult` needs to launch it. Rebuilt whenever the result set
  // changes so arrow-key navigation always matches what is on screen.
  private _navList:{file:FileSearchIndex; id:number; prefix:string}[] = [];
  // Index into `_navList` of the keyboard-focused item (-1 = nothing).
  private _navIndex = -1;

  readonly APPS = FileIndexIDs.APPS.toString();
  readonly DOCUMENTS = FileIndexIDs.DOCUMENTS.toString();
  readonly FOLDERS = FileIndexIDs.FOLDERS.toString();
  readonly MUSIC = FileIndexIDs.MUSIC.toString();
  readonly PHOTOS = FileIndexIDs.PHOTOS.toString();
  readonly VIDEOS = FileIndexIDs.VIDEOS.toString();

  private readonly OPTION_ALL = 'All';
  private readonly OPTION_APPS = 'Apps';
  private readonly OPTION_DOCUMENTS = 'Documents';
  private readonly OPTION_FOLDERS = 'Folders';
  private readonly OPTION_MUSIC = 'Music';
  private readonly OPTION_PHOTOS = 'Photos';
  private readonly OPTION_VIDEOS = 'Videos';

  private currentSearchFocus = this.OPTION_ALL;
  private currentSearchString = Constants.EMPTY_STRING;

  readonly DEFAULT_SEARCH_VIEW = 'defaultView'
  readonly RESULT_SEARCH_VIEW = 'resultView';

  currentViewOption = this.DEFAULT_SEARCH_VIEW;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  readonly name = 'search';
  processId = 0;
  type = ComponentType.System
  displayName = Constants.EMPTY_STRING;

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, menuService:MenuService,
              systemNotificationServices:SystemNotificationService, renderer:Renderer2, formBuilder:FormBuilder,
              fileIndexerService:FileIndexerService, activityHistoryService:ActivityHistoryService, processHandlerService :ProcessHandlerService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;

    this._menuService = menuService;
    this._fileIndexerService = fileIndexerService;
    this._processHandlerService = processHandlerService;
    this._activityHistoryService = activityHistoryService;
    this._systemNotificationServices = systemNotificationServices;

    this._renderer = renderer;
    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    // Track every subscription so ngOnDestroy can release them and avoid leaks.
    this._subscriptions.push(
      this._menuService.hideSearchBox.subscribe((p) => {
        if(p !== this.name)  //guard against the endless self-notify loop
          this.hideSearchBox();
      }),
      this._menuService.showSearchBox.subscribe(() => { this.showSearchBox(); }),
      this._systemNotificationServices.showLockScreenNotify.subscribe(() => { this.hideSearchBox(); }),
      this._systemNotificationServices.showDesktopNotify.subscribe(() => { this.desktopIsActive(); }),
      this._fileIndexerService.fileIndexChangeOperation.subscribe(() => { this.fetchIndex(); })
    );
  }

  ngOnInit(): void {
    const delay = 200; //200ms
    this.searchBarForm = this._formBuilder.nonNullable.group({
      searchBarText: Constants.EMPTY_STRING,
    });

    this._searchBoxChangeSub = this.searchBarForm.get('searchBarText')?.valueChanges
      .pipe(debounceTime(delay))
      .subscribe(value => {
        this.currentSearchString = value;
        // Preserve the active filter while typing. Without passing
        // currentSearchFocus, every keystroke reverted to "All" (which includes
        // folders), so a folder could win Best match even when filtering by a
        // non-folder option.
        this.handleSearch(value, this.currentSearchFocus);
      });

    this.menuOptions = this.generateOptions();
    this.onlyTopApps = this.getTopApps();
    this.onlyRecents = this.getRecents();
  }

  ngAfterViewInit(): void {
    this._fileSearchIndex = this._fileIndexerService.getFileIndex();
  }

  ngOnDestroy(): void {
    // Release the form value-changes stream and every constructor subscription.
    this._searchBoxChangeSub?.unsubscribe();
    this._subscriptions.forEach(sub => sub.unsubscribe());
    this._subscriptions = [];
  }

  fetchIndex(): void {
    this._fileSearchIndex  = [];
    this._fileSearchIndex = this._fileIndexerService.getFileIndex();
  }

  showSearchBox():void{
    this.isSearchWindowVisible = true;
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'flex');
    this._renderer.setStyle(searchDiv, 'z-index', '3');

    // The initial indexer walk does not emit `fileIndexChangeOperation`,
    // so our local `_fileSearchIndex` may still be the empty snapshot we
    // grabbed in ngAfterViewInit. Pull the latest snapshot every time the
    // box opens so Recommends/Recents are computed against fresh data.
    this.fetchIndex();
    this.onlyRecommends = this.getRecommendedApps();
    this.onlyRecents = this.getRecents();
  }

  hideSearchBox():void{
    if(!this.isSearchWindowVisible) return;

    this.showOptionsMenu = false;
    this.optionsMenuToggle = false;
    this.isSearchWindowVisible = false;

    if(!this.cheetahSearchDiv) return;

    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'z-index', '-1');
    this._renderer.setStyle(searchDiv, 'display', 'none');

    this.searchBarForm.reset();

    this._menuService.hideSearchBox.next(this.name);
  }

  hideShowOptions(evt:MouseEvent):void{
    const delay = 25; //25ms
    evt.stopPropagation();

    if(this.optionsMenuToggle){
      this.hideOptionsMenuDD();

      this.selectedOptionID = 0;
      this.defaultsearchIcon = this.searchAllIcon;
    }else{
      this.showOptionsMenuDD();
    }

    setTimeout(() => { this.onMouseLeave(this.selectedOptionID); }, delay);
  }

  // Swallows clicks inside the search bar so they don't bubble up to the
  // outer container (which would close the search box).
  stopEventPropagation(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  private showOptionsMenuDD():void{
    this.showOptionsMenu = true;
    this.optionsMenuToggle = true;
  }

  private hideOptionsMenuDD():void{
    this.showOptionsMenu = false;
    this.optionsMenuToggle = false;
  }

  generateOptions():string[][]{
    const options = [[this.searchAllIcon, this.OPTION_ALL], [this.searchApplicatiionIcon, this.OPTION_APPS], 
                     [this.searchFileIcon, this.OPTION_DOCUMENTS], [this.searchFolderIcon, this.OPTION_FOLDERS],
                     [this.searchMusicIcon, this.OPTION_MUSIC], [this.searchPictureIcon, this.OPTION_PHOTOS],
                     [this.searchVideoIcon, this.OPTION_VIDEOS]];
    return options;
  }

  getTopApps():FileSearchIndex[]{
    const options:FileSearchIndex[] = [];
    const date = new Date('1970-01-01');

    options.push({type:'APPS', name:'terminal', srcPath:'None', opensWith:'terminal', 
                  iconPath:'osdrive/Cheetah/System/Imageres/terminal.png', contentPath:'', dateModified: date});

    options.push({type:'APPS', name:'particleflow', srcPath:'None', opensWith:'particleflow', 
                  iconPath:'osdrive/Cheetah/System/Imageres/particles.png', contentPath:'', dateModified: date});   

    options.push({type:'APPS', name:'starfield', srcPath:'None', opensWith:'starfield', 
                  iconPath:'osdrive/Cheetah/System/Imageres/star_field.png', contentPath:'', dateModified: date});  

    options.push({type:'APPS', name:'boids', srcPath:'None', opensWith:'boids', 
                  iconPath:'osdrive/Cheetah/System/Imageres/bird_oid.png', contentPath:'', dateModified: date});

    options.push({type:'APPS', name:'codeeditor', srcPath:'None', opensWith:'codeeditor', 
                  iconPath:'osdrive/Cheetah/System/Imageres/vs_code.png', contentPath:'', dateModified: date});
    return options;
  }

  getRecents():FileSearchIndex[]{
    const MAX_RECENTS = 4;
    const activityHistory = this._activityHistoryService.getActivitesHistory().filter(x => x.type !== ActivityType.FOLDERS);
    const lastFour = activityHistory.slice(-MAX_RECENTS);

    // Substring matching (`x.name.includes(y.name)`) used to let a single
    // recent like "test" pull in every indexed file containing "test",
    // overflowing the list. Resolve each recent to at most one index entry
    // (prefer exact match, fall back to substring), then hard-cap the result.
    const seen = new Set<string>();
    const options:FileSearchIndex[] = [];
    for(const recent of lastFour){
      const match = this._fileSearchIndex.find(x => x.name === recent.name)
                 ?? this._fileSearchIndex.find(x => x.name.includes(recent.name));
      if(match){
        const key = `${match.name}|${match.srcPath}`;
        if(!seen.has(key)){
          seen.add(key);
          options.push(match);
          if(options.length >= MAX_RECENTS) break;
        }
      }
    }
    return options;
  }

  getRecommendedApps():FileSearchIndex[]{
    const options:FileSearchIndex[] = [];
    const recommendation:string[] = ['Super Street Fighter 2 Turbo', 'rero', 'starfield', 'watr-fluid'];
    
    options.push(...this._fileSearchIndex.filter(x => recommendation.some(y => x.name.includes(y))));
    return options;
  }

  selectResultSetOption(evt:MouseEvent, file: FileSearchIndex, id:number, prefix:string):void{
    evt.stopPropagation();

    // Keep keyboard navigation in sync with the mouse: point the nav cursor
    // at whatever the user just clicked so a subsequent arrow key continues
    // from here instead of jumping back to the best match.
    this.syncNavIndex(id, prefix);
    this.applyResultSetSelection(file, id, prefix);
  }

  /**
   * Highlights a result item and mirrors it into the detail pane. Shared by
   * the mouse click handler (`selectResultSetOption`) and keyboard navigation
   * (`moveNavigation`) so both paths behave identically.
   */
  private applyResultSetSelection(file: FileSearchIndex, id:number, prefix:string):void{
    const prevPreFix = this.prefixType;
    const prevSelectedResultSetOptionId = this.selectedResultSetOptionId;
    this.prefixType = prefix;
    this.selectedResultSetOptionId = id;
    this.selectedResultSetOption = file;
    this.getSelectedResultSetOptionType(file);

    // The best match has its own dedicated highlight element; toggle it on
    // only when the best match itself is the active item.
    this.handleBestMatchHightLight(id === this.bestMatchId);

    this.updateResultSetOptionStyle(prevSelectedResultSetOptionId, Constants.EMPTY_STRING, prevPreFix);
    this.updateResultSetOptionStyle(this.selectedResultSetOptionId, '#ccc', prefix);
  }

  // #region Keyboard navigation

  /**
   * Single keydown entry point for the search input.
   *
   * 1. ANY key press counts as user activity, so reset the lock-screen idle
   *    timeout (same pattern as DesktopComponent.resetLockScreenTimeOut).
   *    This covers both plain typing and arrow-key navigation.
   * 2. When results are showing, Arrow Up/Down move the highlight through the
   *    flat result list and Enter opens the highlighted item.
   */
  onSearchKeyDown(evt:KeyboardEvent):void{
    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();

    if(!this.showSearchResult || this._navList.length === 0)
      return;

    switch(evt.key){
      case 'ArrowDown':
        evt.preventDefault(); // stop the caret from jumping inside the textbox
        this.moveNavigation(1);
        break;
      case 'ArrowUp':
        evt.preventDefault();
        this.moveNavigation(-1);
        break;
      case 'Enter':
        evt.preventDefault();
        this.openActiveNavItem();
        break;
    }
  }

  /**
   * Rebuilds the flat, top-to-bottom list of navigable result items in the
   * exact order they appear on screen. Called after every successful search
   * so arrow navigation always matches the rendered sections.
   */
  private buildNavigationList():void{
    const list:{file:FileSearchIndex; id:number; prefix:string}[] = [];

    if(this.showBestMatchView && this.bestMatch){
      list.push({file: this.bestMatch, id: this.bestMatchId, prefix: Constants.EMPTY_STRING});
    }
    if(this.showApplicationSection && this.isAppPresent){
      this.onlyAppsSearchIndex.forEach((f, i) => list.push({file: f, id: i, prefix: 'app'}));
    }
    if(this.showFilesSection && this.isFilePresent){
      this.onlyFilesSearchIndex.forEach((f, i) => list.push({file: f, id: i, prefix: 'file'}));
    }
    if(this.showFoldersSection && this.isFolderPresent){
      this.onlyFoldersSearchIndex.forEach((f, i) => list.push({file: f, id: i, prefix: 'folder'}));
    }
    if(this.showOthersSection && this.isFilePresent){
      this.onlyFilesSearchIndex.forEach((f, i) => list.push({file: f, id: i, prefix: 'other'}));
    }

    this._navList = list;
    // The best match is auto-selected after a search, so start the cursor on
    // it (index 0). First Arrow Down then steps to the next item.
    this._navIndex = list.length > 0 ? 0 : -1;
  }

  /** Clears keyboard-navigation state (no results / back to default view). */
  private resetNavigationList():void{
    this._navList = [];
    this._navIndex = -1;
  }

  /** Moves the highlight by `step` (+1 down, -1 up) with wrap-around. */
  private moveNavigation(step:number):void{
    const count = this._navList.length;
    this._navIndex = (this._navIndex + step + count) % count;

    const item = this._navList[this._navIndex];
    this.applyResultSetSelection(item.file, item.id, item.prefix);
    this.scrollNavItemIntoView(item);
  }

  /** Opens the currently highlighted result via the shared launch path. */
  private openActiveNavItem():void{
    if(this._navIndex < 0 || this._navIndex >= this._navList.length)
      return;

    const item = this._navList[this._navIndex];
    this.openSearchResult(item.file, this.RUN_APP);
  }

  /**
   * Re-points the keyboard cursor at a clicked item so that subsequent arrow
   * keys continue from the mouse selection. No-op if the item isn't in the
   * current nav list.
   */
  private syncNavIndex(id:number, prefix:string):void{
    const idx = this._navList.findIndex(n => n.id === id && n.prefix === prefix);
    if(idx >= 0)
      this._navIndex = idx;
  }

  /** Keeps the highlighted row visible while navigating with the keyboard. */
  private scrollNavItemIntoView(item:{id:number; prefix:string}):void{
    const elementId = (item.id === this.bestMatchId)
      ? 'best-match-option'
      : `${item.prefix}-result-set-option-${item.id}`;
    document.getElementById(elementId)?.scrollIntoView({block: 'nearest'});
  }

  // #endregion

  selectOption(evt:MouseEvent, id:number):void{
    evt.stopPropagation();

    const previousId = this.selectedOptionID;
    this.selectedOptionID = id;

    const [icon, searchFocus] = this.menuOptions[id];
    this.defaultsearchIcon = icon;
    this.noMatchImg = (searchFocus === this.OPTION_ALL)? this.cheetahIcon : icon;
    this.currentSearchFocus = searchFocus;

    this.handleSearch(this.currentSearchString, searchFocus);
    //this.hideShowSearchSections(searchFocus);
    //this.checkIfSectionIsPresent(searchFocus);

    if (previousId !== id) {
      this.updateOptionStyle(previousId, "rgba(41,41, 41, 0.75)");
    }

    this.updateOptionStyle(id, "#76B9ED");
    this.hideOptionsMenuDD();
  }

  onMouseEnter(id:number):void{
    this.updateOptionStyle(id, '#ccc');
  }

  onMouseLeave(id:number):void{    
    const color = (id === this.selectedOptionID)? '#76B9ED' : Constants.EMPTY_STRING;
    this.updateOptionStyle(id, color);
  }

  private updateOptionStyle(id: number, color: string): void {
    const liElement = document.getElementById(`dd-option-${id}`) as HTMLLIElement;
    if (liElement) {
      liElement.style.backgroundColor = color;
    }
  }

  private updateResultSetOptionStyle(id: number, color: string, prefix: string): void {
    const divElmnt = document.getElementById(`${prefix}-result-set-option-${id}`) as HTMLDivElement
    if (divElmnt) {
      divElmnt.style.backgroundColor = color;
    }
  }

  handleSearch(searchString:string, searchFocus = this.OPTION_ALL):void{
    if(searchString.length === 0 || searchString.trim() === Constants.EMPTY_STRING){
      this.resetFilteredArray();
      return;
    }

    // A non-empty query always switches the panel from the default view to the
    // result view. (Previously the missing braces made `showSearchResult` run
    // unconditionally anyway; this makes that intent explicit.)
    this.currentViewOption = this.RESULT_SEARCH_VIEW;
    this.showSearchResult = true;

    if(searchFocus === this.OPTION_ALL)
      this.filteredFileSearchIndex = this._fileSearchIndex.filter(f => f.name.toLowerCase().includes(searchString.toLowerCase()));
    else
      this.filteredFileSearchIndex = this._fileSearchIndex.filter(f => f.name.toLowerCase().includes(searchString.toLowerCase()) 
                                                               && f.type === searchFocus.toUpperCase());

    //console.log('filteredFileIndex:', this.filteredFileSearchIndex);

    if(this.filteredFileSearchIndex.length === 0){
      const on = false;
      this.showNoMatchFoundView = true;
      this.showBestMatchView = false;
      this.isNotFound = true;
      this.noMatchText = `No result found for "${searchString}"`;

      this.handleBestMatchHightLight(on);
      this.showOnlyBestMatchSection();
      this.resetNavigationList();
    }else{
      this.showNoMatchFoundView = false;
      this.showBestMatchView = true;
      this.isNotFound = false;

      // 1. Decide which sections are allowed to show for the current focus.
      // 2. Pick the single best match from the full result set.
      // 3. Populate each section (excluding the best match) and flag presence.
      this.hideShowSearchSections(searchFocus);
      this.computeBestMatch(searchString);
      this.populateResultSections(searchFocus);

      // 4. Rebuild the keyboard-navigable list to match the rendered sections.
      this.buildNavigationList();
    }
  }

  resetFilteredArray():void{
    this.filteredFileSearchIndex = [];

    this.showSearchResult = false;
    this.currentViewOption = this.DEFAULT_SEARCH_VIEW;
    this.resetNavigationList();
  }

  focusOnInput(evt:MouseEvent):void{
    evt.stopPropagation();
    const searchBarTxtBoxElm = document.getElementById('searchBarTxtBox') as HTMLInputElement;
    if(searchBarTxtBoxElm){
      searchBarTxtBoxElm?.focus();
    }
  }

  hideShowSearchSections(focus:string):void{
    this.showBestMatchView = true;

    this.showApplicationSection = (focus === this.OPTION_ALL || focus === this.OPTION_APPS);

    this.showFilesSection = (focus === this.OPTION_ALL);

    this.showFoldersSection = (focus === this.OPTION_ALL || focus === this.OPTION_FOLDERS);

    this.showOthersSection = (focus === this.OPTION_DOCUMENTS || focus === this.OPTION_MUSIC 
                              || focus === this.OPTION_VIDEOS || focus === this.OPTION_PHOTOS);

    if(this.showOthersSection){
      this.otherSectionFocusType = (focus === this.OPTION_DOCUMENTS) 
        ? this.DOCUMENTS : (focus === this.OPTION_MUSIC) 
        ? this.MUSIC : (focus === this.OPTION_VIDEOS) 
        ? this.VIDEOS : this.PHOTOS
    }

    this.bestMatchFor = (this.showOthersSection)? focus.toLowerCase() : Constants.EMPTY_STRING;                          
    this.otherSectionName = (this.showOthersSection)? focus : Constants.EMPTY_STRING;
  }

  /**
   * Builds the Apps / Folders / Files section buckets for the current focus and
   * flags which sections actually have content.
   *
   * The current best match is excluded from these buckets so it is not listed
   * twice (it already appears in the dedicated "Best match" section). A section
   * is "present" when its bucket is non-empty AFTER that exclusion - so a type
   * whose only hit IS the best match correctly collapses, while sibling results
   * of other types still show. (This replaces the old two-pass
   * checkIfSectionIsPresent + removeDuplicateEntry dance and fixes the edge case
   * where a singleton best match hid unrelated files in the Files section.)
   */
  populateResultSections(focus:string):void{
    this.resetSectionBucket();

    // Identity rule matches the previous removeDuplicateEntry: same name + path.
    const withoutBestMatch = this.filteredFileSearchIndex.filter(
      f => !(this.bestMatch && f.name === this.bestMatch.name && f.srcPath === this.bestMatch.srcPath));

    if(focus === this.OPTION_ALL || focus === this.OPTION_APPS){
      this.onlyAppsSearchIndex = withoutBestMatch.filter(f => f.type === this.APPS);
      this.isAppPresent = this.onlyAppsSearchIndex.length > 0;
    }

    if(focus === this.OPTION_ALL || focus === this.OPTION_FOLDERS){
      this.onlyFoldersSearchIndex = withoutBestMatch.filter(f => f.type === this.FOLDERS);
      this.isFolderPresent = this.onlyFoldersSearchIndex.length > 0;
    }

    // The "Files" bucket aggregates document/media types. Which types depend on
    // the focus: "All" shows everything, a specific media focus shows only it.
    const fileTypesForFocus = this.getFileTypesForFocus(focus);
    if(fileTypesForFocus.length > 0){
      this.onlyFilesSearchIndex = withoutBestMatch.filter(f => fileTypesForFocus.includes(f.type));
      this.isFilePresent = this.onlyFilesSearchIndex.length > 0;
    }
  }

  /** Maps a search focus to the document/media types that belong in the Files section. */
  private getFileTypesForFocus(focus:string):string[]{
    switch(focus){
      case this.OPTION_ALL:       return [this.DOCUMENTS, this.PHOTOS, this.MUSIC, this.VIDEOS];
      case this.OPTION_DOCUMENTS: return [this.DOCUMENTS];
      case this.OPTION_PHOTOS:    return [this.PHOTOS];
      case this.OPTION_MUSIC:     return [this.MUSIC];
      case this.OPTION_VIDEOS:    return [this.VIDEOS];
      default:                    return []; // Apps / Folders focus: no Files section
    }
  }

  showOnlyBestMatchSection():void{
    this.resetSectionBucket();

    this.isAppPresent  = false;
    this.isFolderPresent = false;
    this.isFilePresent = false;
  }

  async handleBestMatchHightLight(toggle:boolean): Promise<void>{
    const delay = 25; //25ms

    await CommonFunctions.sleep(delay);

    const bestMatchElmnt = document.getElementById('best-match-option') as HTMLDivElement;
    if(bestMatchElmnt){
      bestMatchElmnt.style.backgroundColor = (toggle) ? '#76B9ED' : Constants.EMPTY_STRING;
    }
  }

  getSelectedResultSetOptionType(file:FileSearchIndex):void{
    const ext = extname(file.name);

    // Only documents/media derive their label from the file extension. Apps and
    // folders are labelled below. NOTE: this must be `&&` - with `||` the
    // condition is always true (a type can't be both APPS and FOLDERS at once).
    if(file.type !== this.APPS && file.type !== this.FOLDERS){
      if(ext && ext !== Constants.EMPTY_STRING){
        this.selectedResultSetOptionType = `${ext.toUpperCase().replace(Constants.DOT, Constants.EMPTY_STRING)} File`;
      }
    }

    if(file.type === this.APPS){
      this.selectedResultSetOptionType = 'App';
    }else if(file.type === this.FOLDERS){
      this.selectedResultSetOptionType = 'Folder';
    }
  }

  resetSectionBucket():void{    
    this.onlyAppsSearchIndex = [];
    this.onlyFilesSearchIndex = [];
    this.onlyFoldersSearchIndex = [];
  }

  /**
   * Scores every filtered result and selects the single highest-scoring entry
   * as the best match. Also primes the detail pane to show that entry.
   * Bucket population / de-duplication is handled separately by
   * populateResultSections.
   */
  computeBestMatch(searchString:string):void{
    const on = true;
    let maxScore = 0;

    this.filteredFileSearchIndex.forEach(file =>{
      const searchScore = this.searchScore(file, searchString);
      if(maxScore < searchScore){
        maxScore = searchScore;
        this.bestMatch = file;
        this.selectedResultSetOption = file;
        this.selectedResultSetOptionId = this.bestMatchId;
        this.getSelectedResultSetOptionType(file);
      }
    });

    this.handleBestMatchHightLight(on);
  }

  /**
   * Ranks a single result against the query and returns a score in [0, 100].
   *
   * Design: every signal contributes a RAW score, all raw scores are summed,
   * and the TOTAL is normalised once at the end. This is the key fix over the
   * previous version, where only the text-match signal was normalised (to
   * 0–100) and the metadata signals were then added raw on top - that let
   * folder/frequency/recency outweigh actual match quality. Normalising the
   * combined total keeps every signal on the same scale.
   *
   * Approximate raw upper bounds (sum ~= MAX_RAW):
   *   - text match (prefix/contains) ~ 31
   *   - frequency of use             ~ 25
   *   - recency of use               ~ 10
   *   - folder priority              ~ 10
   *   - extension priority           ~  5
   */
  searchScore(file:FileSearchIndex, searchString:string):number{
    const name = file.name.toLowerCase();
    const query = searchString.toLowerCase();

    // An exact name match is always the strongest possible signal.
    if (name === query) return 100;

    const rawScore =
        this.matchQualityScore(file, searchString) // text relevance (prefix/contains)
      + this.frequencyOfUse(file)                   // how often it has been opened
      + this.recencyOfUse(file)                     // how recently it has been opened
      + this.folderPriority(file.srcPath)           // lives in a "special" user folder
      + this.extensionPriority(file.name);          // common/preferred file type

    const MAX_RAW = 85; // safe upper bound for the summed raw signals
    return Math.min(100, (rawScore / MAX_RAW) * 100);
  }

  /**
   * RAW text-relevance score (the caller normalises the combined total).
   * A query that prefixes the name scores highest (and longer prefixes score
   * more); a query merely contained in the name scores less, and the earlier
   * it appears the better.
   */
  matchQualityScore(file: FileSearchIndex, searchString: string): number {
    const name = file.name.toLowerCase();
    const query = searchString.toLowerCase();

    if (name.startsWith(query)) {
      return 13 + query.length * 2;
    }

    const index = name.indexOf(query);
    if (index >= 0) {
      return Math.max(8, query.length - index);
    }

    return 0;
  }

  frequencyOfUse(file:FileSearchIndex):number{
    const w = 5;
    const defaultType = 'FILE'; //document, music, videos, pictures, ...

    const type = (file.type === this.APPS || file.type === this.FOLDERS) ? file.type : defaultType;
    const activityHistory = this._activityHistoryService.getActivityHistory(file.name, file.srcPath, type);

    if(activityHistory){
      //logarithmic scaling freqScore=w⋅log(1+f)
      const frequency = activityHistory.count;
      return w * Math.log(1 + frequency);
    }

    return 1;
  }

  recencyOfUse(file: FileSearchIndex): number {
    const maxScore = 10;   // score at d = 0 (today)
    const minScore = 1;    // floor
    const decay = 0.5;     // decay constant tuned to your sequence

    const defaultType = 'FILE'; //document, music, videos, pictures, ...
    const type = (file.type === this.APPS || file.type === this.FOLDERS) ? file.type : defaultType;

    const activityHistory = this._activityHistoryService.getActivityHistory(file.name, file.srcPath, type);
    if (activityHistory) {
      const now = Date.now();
      const diffMs = now - activityHistory.lastInteractionTS;
      const daysAgo = diffMs / (1000 * 60 * 60 * 24); // difference in days

      // sanitize input (no negatives, round down)
      const d = Math.max(0, Math.floor(daysAgo));

      // logarithmic decay S(d)=A−B⋅log(d)
      const score = maxScore - decay * Math.log(d + 1);
      return Math.max(minScore, score)
    }

    return minScore
  }

  folderPriority(path:string):number{
    const specialFolders = [
      '/Users/Documents/',
      '/Users/Downloads/',
      '/Users/Desktop/',
      '/Users/Music/',
      '/Users/Pictures/',
      '/Users/Games/'
    ];

    return specialFolders.some(f => path.startsWith(f)) ? 10 : 2;
  }

  extensionPriority(filename: string): number {
    const preferred = [".pdf", ".txt", ".mp3", ".mp4", ".png", ".jpg", ".jpeg"];
    const ext = extname(filename).toLowerCase();

    return preferred.includes(ext) ? 5 : 1;
  }

  handlePath(file:FileSearchIndex, intent:number, evt:MouseEvent):void{
    evt.stopPropagation();
    this.openSearchResult(file, intent);
  }

  /**
   * Launches a result (app/file/folder). Shared by the mouse click handler
   * (`handlePath`) and keyboard "Enter" (`openActiveNavItem`).
   */
  private openSearchResult(file:FileSearchIndex, intent:number):void{
    /**
     * files of type APPS should under no circumstance be able to call this method
     * MUSIC, DOCUMENT, VIDEO, PICTURES, all fall under the umbrella of file
     */
    const fileInfo = new FileInfo();
    fileInfo.setFileName = this.removeExt(file.name);
    if(file.type !== this.FOLDERS){
      fileInfo.setIsFile = (intent === this.RUN_APP)?  true : false;
      fileInfo.setOpensWith = (intent === this.RUN_APP)? file.opensWith : Constants.FILE_EXPLORER;
      fileInfo.setCurrentPath = (intent === this.RUN_APP)? file.srcPath : dirname(file.srcPath);

      if(file.type !== this.APPS && intent === this.RUN_APP){
        fileInfo.setContentPath = file.contentPath
      }
    }else  if(file.type === this.FOLDERS){
      fileInfo.setIsFile = false;
      fileInfo.setOpensWith = Constants.FILE_EXPLORER;
      fileInfo.setCurrentPath = file.srcPath;
    }

    this._processHandlerService.runApplication(fileInfo);
    this.hideSearchBox();
  }

  copyPath(file:FileSearchIndex, evt:MouseEvent):void{
    evt.stopPropagation();

    const action = MenuAction.COPY;
    const path = file.srcPath;
    this._menuService.setStoreData([path, action]);

    this.hideSearchBox();
  }

  removeExt(name:string):string{
    return basename(name, extname(name));
  }

  // Placeholder hook invoked when the desktop becomes active. Intentionally a
  // no-op for now, but kept so the showDesktopNotify subscription has a single
  // well-named extension point if behaviour is needed later.
  desktopIsActive():void{ }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}