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

import { FileIndexIDs } from "src/app/system-files/common.enums";
import { FileSearchIndex } from 'src/app/system-files/file.search.index';
import { debounceTime, Subscription } from 'rxjs';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import {basename, dirname, extname} from 'path';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';

@Component({
  selector: 'cos-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  standalone:false,
})

export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cheetahSearchDiv', {static: true}) cheetahSearchDiv!: ElementRef<HTMLDivElement>;
  private _renderer:Renderer2;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _systemNotificationServices:SystemNotificationService;
  private _fileIndexerService:FileIndexerService;
  private _activityHistoryService:ActivityHistoryService;
  private _processHandlerService:ProcessHandlerService;

  private _formBuilder:FormBuilder;
  private _fileSearchIndex:FileSearchIndex[] = [];

  private _searchBoxChangeSub?:Subscription;

  searchBarForm!: FormGroup;

  defaultsearchIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchAllIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchPinIcon = `${Constants.IMAGE_BASE_PATH}search_pin.png`;
  searchOpenIcon = `${Constants.IMAGE_BASE_PATH}search_open.png`;
  searchCopyIcon = `${Constants.IMAGE_BASE_PATH}search_copy.png`;
  searchFileIcon = `${Constants.IMAGE_BASE_PATH}search_file.png`;
  searchMusicIcon = `${Constants.IMAGE_BASE_PATH}search_music.png`;
  searchVideoIcon = `${Constants.IMAGE_BASE_PATH}search_video.png`;
  searchFolderIcon = `${Constants.IMAGE_BASE_PATH}search_folder.png`;
  searchPictureIcon = `${Constants.IMAGE_BASE_PATH}search_picture.png`;
  searchApplicatiionIcon = `${Constants.IMAGE_BASE_PATH}search_app.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;

  searchPlaceHolder = ' Search now';
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

  selectedOptionID = 0;
  selectedResultSetOptionId = 0;
  selectedResultSetOptionType = Constants.EMPTY_STRING;

  fileInfo!:FileInfo;
  bestMatch!:FileSearchIndex;
  selectedResultSetOption!:FileSearchIndex;

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

  private defaultFocus = this.OPTION_ALL;

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

    this._menuService.hideSearchBox.subscribe((p) => { 
      if(p !== this.name)  //endless call with this check
        this.hideSearchBox();
    });
    this._menuService.showSearchBox.subscribe(() => { this.showSearchBox()});

    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.hideSearchBox()});
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnInit(): void {
    const delay = 200; //200ms
    this.searchBarForm = this._formBuilder.nonNullable.group({
      searchBarText: Constants.EMPTY_STRING,
    });

    this._searchBoxChangeSub = this.searchBarForm.get('searchBarText')?.valueChanges
      .pipe(debounceTime(delay))
      .subscribe(value => {
        this.handleSearch(value);
      });

    this.menuOptions = this.generateOptions();
  }

  ngAfterViewInit(): void {
    this._fileSearchIndex = this._fileIndexerService.getFileIndex();
  }

  ngOnDestroy(): void {
    this._searchBoxChangeSub?.unsubscribe();
  }

  showSearchBox():void{
    this.isSearchWindowVisible = true;
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'flex');
    this._renderer.setStyle(searchDiv, 'z-index', '3');
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

  shhhhh(evt:MouseEvent):void{
    evt.stopPropagation();
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

  selectResultSetOption(evt:MouseEvent, file: FileSearchIndex, id:number, prefix:string):void{
    evt.stopPropagation();

    const prevPreFix = this.prefixType;
    const prevSelectedResultSetOptionId = this.selectedResultSetOptionId;
    this.prefixType = prefix;
    this.selectedResultSetOptionId = id;
    this.selectedResultSetOption = file;
    this.getSelectedResultSetOptionType(file);

    if(id === this.bestMatchId){
      const on = true;
      this.handleBestMatchHightLight(on);
    } 

    if(id !== this.bestMatchId){
      const on = false;
      this.handleBestMatchHightLight(on);
    } 
    
    this.updateResultSetOptionStyle(prevSelectedResultSetOptionId, Constants.EMPTY_STRING, prevPreFix);
    this.updateResultSetOptionStyle(this.selectedResultSetOptionId, '#ccc', prefix);
  }

  selectOption(evt:MouseEvent, id:number):void{
    evt.stopPropagation();

    const previousId = this.selectedOptionID;
    this.selectedOptionID = id;

    const [icon, searchFocus] = this.menuOptions[id];
    this.defaultsearchIcon = icon;
    this.noMatchImg = (searchFocus === this.OPTION_ALL)? this.cheetahIcon : icon;
    this.defaultFocus = searchFocus;

    this.hideShowSearchSections(searchFocus);
    this.checkIfSectionIsPresent(searchFocus);

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

  handleSearch(searchString:string):void{
    if(searchString.length === 0 || searchString.trim() === Constants.EMPTY_STRING){
      this.resetFilteredArray();
      return;
    }

    if(!this.showSearchResult)
      this.showSearchResult = true;

    this.filteredFileSearchIndex = this._fileSearchIndex.filter(f => f.name.toLowerCase().includes(searchString.toLowerCase()));
    //console.log('filteredFileIndex:', this.filteredFileSearchIndex);

    if(this.filteredFileSearchIndex.length === 0){
      const on = false;
      this.showNoMatchFoundView = true;
      this.showBestMatchView = false;
      this.noMatchText = `No result found for "${searchString}"`;

      this.handleBestMatchHightLight(on);
      this.showOnlyBestMatchSection();
    }else{
      this.showNoMatchFoundView = false;
      this.showBestMatchView = true;
      this.checkIfSectionIsPresent(this.defaultFocus);
      this.getBestMatches(searchString);
      this.checkIfSectionIsPresent(this.defaultFocus, false);
    }
  }

  resetFilteredArray():void{
    this.filteredFileSearchIndex = [];
    this.showSearchResult = false;
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

  checkIfSectionIsPresent(focus:string, checkIfPresent = true):void{
    this.resetSectionBucket();

    if(focus === this.OPTION_ALL || focus === this.OPTION_APPS){
      if(checkIfPresent)
        this.isAppPresent = this.isTypePresent(this.APPS);
      this.onlyAppsSearchIndex = this.filterByType(this.APPS);
    }

    if(focus === this.OPTION_ALL || focus === this.OPTION_FOLDERS){
      if(checkIfPresent)
        this.isFolderPresent = this.isTypePresent(this.FOLDERS);
      this.onlyFoldersSearchIndex = this.filterByType(this.FOLDERS);
    }

    if(focus === this.OPTION_ALL){
      if(checkIfPresent){
        this.isFilePresent = (this.isTypePresent(this.DOCUMENTS) || this.isTypePresent(this.PHOTOS) 
                  || this.isTypePresent(this.MUSIC) || this.isTypePresent(this.VIDEOS));
      }

      this.onlyFilesSearchIndex.push(...this.filterByType(this.DOCUMENTS));
      this.onlyFilesSearchIndex.push(...this.filterByType(this.PHOTOS));
      this.onlyFilesSearchIndex.push(...this.filterByType(this.MUSIC));
      this.onlyFilesSearchIndex.push(...this.filterByType(this.VIDEOS));
    }

    if(focus === this.OPTION_DOCUMENTS){
      if(checkIfPresent)
        this.isFilePresent = this.isTypePresent(this.DOCUMENTS);
      this.onlyFilesSearchIndex.push(...this.filterByType(this.DOCUMENTS));
    }

    if(focus === this.OPTION_PHOTOS){
      if(checkIfPresent)
        this.isFilePresent = this.isTypePresent(this.PHOTOS);
      this.onlyFilesSearchIndex.push(...this.filterByType(this.PHOTOS));
    }

    if(focus === this.OPTION_MUSIC){
      if(checkIfPresent)
        this.isFilePresent =  this.isTypePresent(this.MUSIC);
      this.onlyFilesSearchIndex.push(...this.filterByType(this.MUSIC));
    }

    if(focus === this.OPTION_VIDEOS){
      if(checkIfPresent)
        this.isFilePresent = this.isTypePresent(this.VIDEOS);
      this.onlyFilesSearchIndex.push(...this.filterByType(this.VIDEOS));
    }
  }

  showOnlyBestMatchSection():void{
    this.resetSectionBucket();

    this.isAppPresent  = false;
    this.isFolderPresent = false;
    this.isFilePresent = false;
  }

  handleBestMatchHightLight(toggle:boolean):void{
    const delay = 25; //25ms

    setTimeout(() => {
      const bestMatchElmnt = document.getElementById('best-match-option') as HTMLDivElement;
      if(bestMatchElmnt){
        bestMatchElmnt.style.backgroundColor = (toggle) ? '#ccc' : '';
      }
    }, delay);
  }

  getSelectedResultSetOptionType(file:FileSearchIndex):void{
    const ext = extname(file.name);

    if(file.type !== this.APPS || file.type !== this.FOLDERS){ 
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

  isTypePresent(type:string):boolean{
    return  this.filteredFileSearchIndex.some(f => f.type === type);
  }

  filterByType(type:string):FileSearchIndex[]{
    return  this.filteredFileSearchIndex.filter(f => f.type === type);
  }

  resetSectionBucket():void{    
    this.onlyAppsSearchIndex = [];
    this.onlyFilesSearchIndex = [];
    this.onlyFoldersSearchIndex = [];
  }

  getBestMatches(searchString:string):void{
    const on = true;
    let maxScore = 0;

    this.filteredFileSearchIndex.forEach(file =>{
      const searchScore = (this.searchScore(file, searchString));
      //console.log(`searchName:${file.name}  -  searchName:${file.name}  -  search scores: ${searchScore}`);
      if(maxScore < searchScore){
        maxScore = searchScore;
        this.bestMatch = file;
        this.selectedResultSetOption = file;
        this.selectedResultSetOptionId = this.bestMatchId;
        this.getSelectedResultSetOptionType(file);
      }
    });

    this.handleBestMatchHightLight(on);
    this.removeDuplicateEntry(this.bestMatch);
  }

  removeDuplicateEntry(file: FileSearchIndex):void{
    const countOfType = this.filteredFileSearchIndex.filter(x => x.type === file.type).length;
    if(countOfType === 1){

      if(file.type === this.APPS){
        this.isAppPresent  = false;
      }else if(file.type === this.FOLDERS){
        this.isFolderPresent = false;
      }else{ //documents, music, pictures, videos, etc
        this.isFilePresent = false;
      }

    }else if(countOfType > 1){
      const result = this.filteredFileSearchIndex.filter(x => !(x.name === file.name 
                                                             && x.srcPath === file.srcPath));


      this.filteredFileSearchIndex = [];
      this.filteredFileSearchIndex.push(...result);
    }
  }

  searchScore(file:FileSearchIndex, searchString:string):number{
    const name = file.name.toLowerCase();
    const query = searchString.toLowerCase();

    // exact match dominates
    if (name === query) return 100;

    let score = 0;
    score += this.longerPrefix(file, searchString);
    score += this.frequencyOfUse(file);
    score += this.recencyOfUse(file);
    score += this.folderPriority(file.srcPath);
    score += this.extensionPriority(file.name);   

    return score;
  }

  longerPrefix(file: FileSearchIndex, searchString: string): number {
    const name = file.name.toLowerCase();
    const query = searchString.toLowerCase();

    let rawScore = 0;

    // 1. Prefix & contains scoring
    if (name.startsWith(query)) {
      rawScore += 13 + query.length * 2; 
    } else {
      const index = name.indexOf(query);
      if (index >= 0) {
        rawScore += Math.max(8, query.length - index);
      }
    }

    /**
       * Compute the raw score from all components.
          Decide on a reasonable maximum possible raw score (upper bound).
          Prefix/contains → up to ~31
          Frequency → ~25 (logarithmic scaling)
          Recency → up to 10 (logarithmic decay)
          Folder priority → up to 10
          Extension → up to 5
          Rough max = ~82
      Normalize:
      normalized = min(100, (rawScore /maxRaw) × 100)
      This way, exact matches still return 100, and other scores scale proportionally.
    */

    // 3. Normalize to 0–100
    const maxRaw = 85; // safe upper bound for raw scores
    const normalized = Math.min(100, (rawScore / maxRaw) * 100);

    return normalized;
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

  handlePath(fileSI:FileSearchIndex, evt:MouseEvent):void{
    evt.stopPropagation();

    const file = new FileInfo();
    file.setFileName = basename(fileSI.name, extname(fileSI.name));
    file.setOpensWith = Constants.FILE_EXPLORER;
    file.setIsFile = false;
    file.setCurrentPath = dirname(fileSI.srcPath);

    this._processHandlerService.runApplication(file);
    this.hideSearchBox();
  }

  copyPath(fileSI:FileSearchIndex, evt:MouseEvent):void{
    evt.stopPropagation();
    
    const action = MenuAction.COPY;
    const path = fileSI.srcPath;
    this._menuService.setStoreData([path, action]);

    this.hideSearchBox();
  }

  desktopIsActive():void{ }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}