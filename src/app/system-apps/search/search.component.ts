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
  private _formBuilder:FormBuilder;
  private _fileSearchIndex:FileSearchIndex[] = [];

  searchBarForm!: FormGroup;

  defaultsearchIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchAllIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchFileIcon = `${Constants.IMAGE_BASE_PATH}search_file.png`;
  searchMusicIcon = `${Constants.IMAGE_BASE_PATH}search_music.png`;
  searchVideoIcon = `${Constants.IMAGE_BASE_PATH}search_video.png`;
  searchFolderIcon = `${Constants.IMAGE_BASE_PATH}search_folder.png`;
  searchPictureIcon = `${Constants.IMAGE_BASE_PATH}search_picture.png`;
  searchApplicatiionIcon = `${Constants.IMAGE_BASE_PATH}search_app.png`;

  searchPlaceHolder = ' Search now';

  optionsMenuToggle = false;
  showOptionsMenu = false;
  showSearchResult = false

  showBestMatchSection = true;
  showFilesSection = true;
  showFoldersSection = true;
  showApplicationSection = true;
  showOthersSection = false;

  isAppPresent = false;
  isFolderPresent = false;
  isFilePresent = false;

  isSearchWindowVisible = false;

  bestMatchFor = Constants.EMPTY_STRING;  
  otherSectionName = Constants.EMPTY_STRING;
  otherSectionFocusType = Constants.EMPTY_STRING;
  
  menuOptions!:string[][];
  filteredFileSearchIndex:FileSearchIndex[] = [];
  onlyAppsSearchIndex:FileSearchIndex[] = [];
  onlyFilesSearchIndex:FileSearchIndex[] = [];
  onlyFoldersSearchIndex:FileSearchIndex[] = [];

  selectedOptionID = 0;
  bestMatch!:FileSearchIndex;

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

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  readonly name = 'search';
  processId = 0;
  type = ComponentType.System
  displayName = Constants.EMPTY_STRING;

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, menuService:MenuService,
                systemNotificationServices:SystemNotificationService, renderer:Renderer2, formBuilder:FormBuilder,
                fileIndexerService:FileIndexerService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationServices = systemNotificationServices;
    this._fileIndexerService = fileIndexerService
    this.bestMatch = {type: Constants.EMPTY_STRING, name:'Test', srcPath:Constants.EMPTY_STRING, iconPath:this.icon}

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
    this.searchBarForm = this._formBuilder.nonNullable.group({
      searchBarText: Constants.EMPTY_STRING,
    });

    this.searchBarForm.get('searchBarText')?.valueChanges.subscribe(value => {
      this.handleSearch(value);
    });

    this.menuOptions = this.generateOptions();
  }

  ngAfterViewInit(): void {
    this._fileSearchIndex = this._fileIndexerService.getFileIndex();
  }

  ngOnDestroy(): void {}

  showSearchBox():void{
    this.isSearchWindowVisible = true;
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'block');
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

  selectOption(evt:MouseEvent, id:number):void{
    evt.stopPropagation();

    const previousId = this.selectedOptionID;
    this.selectedOptionID = id;

    const [icon, searchFocus] = this.menuOptions[id];
    this.defaultsearchIcon = icon;
    //this.changeSearchFocus(searchFocus);
    this.hideShowSearchSections(searchFocus)

    if (previousId !== id) {
      this.updateOptionStyle(previousId, "rgba(41,41, 41, 0.75)");
    }

    this.updateOptionStyle(id, "#76B9ED");
    this.hideOptionsMenuDD();
  }

  onMouseEnter(id:number):void{
    this.updateOptionStyle(id, "#ccc");
  }

  onMouseLeave(id:number):void{    
    const color = (id === this.selectedOptionID)? "#76B9ED" : "";
    this.updateOptionStyle(id, color);
  }

  private updateOptionStyle(id: number, color: string): void {
    const liElement = document.getElementById(`dd-option-${id}`) as HTMLLIElement | null;
    if (liElement) {
      liElement.style.backgroundColor = color;
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
    this.getBestMatch();
    this.checkIfSectionIsPresent();

    console.log('filteredFileIndex:', this.filteredFileSearchIndex);
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
    this.showBestMatchSection = true;

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

  checkIfSectionIsPresent():void{
    this.resetSectionBucket();

    this.isAppPresent = this.isTypePresent(this.APPS);
    this.onlyAppsSearchIndex = this.filterByType(this.APPS);

    this.isFilePresent = (this.isTypePresent(this.DOCUMENTS) || this.isTypePresent(this.PHOTOS) 
                          || this.isTypePresent(this.MUSIC) || this.isTypePresent(this.VIDEOS));

    this.onlyFilesSearchIndex.push(...this.filterByType(this.DOCUMENTS));
    this.onlyFilesSearchIndex.push(...this.filterByType(this.PHOTOS));
    this.onlyFilesSearchIndex.push(...this.filterByType(this.MUSIC));
    this.onlyFilesSearchIndex.push(...this.filterByType(this.VIDEOS));

    this.isFolderPresent = this.isTypePresent(this.FOLDERS);
    this.onlyFoldersSearchIndex = this.filterByType(this.FOLDERS);
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

  getBestMatch():void{

  }

  desktopIsActive():void{ }

  changeSearchFocus(focus:string):void{
    let focusPath = Constants.EMPTY_STRING;

    //if focuse is All, pull everything, apps included,
    if(focus === this.OPTION_ALL || focus === this.OPTION_APPS || focus === this.OPTION_FOLDERS){


    }else{

    }

    //if files, exclude folders 
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}

