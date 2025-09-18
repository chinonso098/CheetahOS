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

  private _fileIndex!:string[][];


  searchBarForm!: FormGroup;

  defaultsearchIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchAllIcon = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchFileIcon = `${Constants.IMAGE_BASE_PATH}search_file.png`;
  searchMusicIcon = `${Constants.IMAGE_BASE_PATH}search_music.png`;
  searchVideoIcon = `${Constants.IMAGE_BASE_PATH}search_video.png`;
  searchFolderIcon = `${Constants.IMAGE_BASE_PATH}search_folder.png`;
  searchPictureIcon = `${Constants.IMAGE_BASE_PATH}search_picture.png`;
  searchApplicatiionIcon = `${Constants.IMAGE_BASE_PATH}search_app.png`;

  searchPlaceHolder = 'Search now';

  optionsMenuToggle = false;
  showOptionsMenu = false;
  showSearchResult = false

  showBestMatchSection = true;
  showFilesSection = true;
  showFoldersSection = true;
  showApplicationSection = true;
  showOthersSection = false;
  otherSectionName = Constants.EMPTY_STRING;
  bestMatchFor = Constants.EMPTY_STRING;
  
  menuOptions!:string[][];
  filteredFileIndex!:string[][];

  selectedOptionID = 0;

  readonly APPS = FileIndexIDs.APPS.toString();
  readonly DOCUMENTS = FileIndexIDs.DOCUMENTS.toString();
  readonly FOLDERS = FileIndexIDs.FOLDERS.toString();
  readonly MUSIC = FileIndexIDs.MUSIC.toString();
  readonly PHOTOS = FileIndexIDs.PHOTOS.toString();
  readonly VIDEOS = FileIndexIDs.VIDEOS.toString();

  readonly OPTION_ALL = 'All';
  readonly OPTION_APPS = 'Apps';
  readonly OPTION_DOCUMENTS = 'Documents';
  readonly OPTION_FOLDERS = 'Folders';
  readonly OPTION_MUSIC = 'Music';
  readonly OPTION_PHOTOS = 'Photos';
  readonly OPTION_VIDEOS = 'Videos';

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'search';
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
    this._fileIndex = [[]];
    this._fileIndex.pop();
    this.filteredFileIndex = [[]];
    this.filteredFileIndex.pop()

    this._renderer = renderer;
    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._menuService.hideSearchBox.subscribe(() => { this.hideSearchBox()});
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
    this._fileIndex = this._fileIndexerService.getFileIndex();
  }

  ngOnDestroy(): void {}

  showSearchBox():void{
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'block');
    this._renderer.setStyle(searchDiv, 'z-index', '3');
  }

  hideSearchBox():void{
    this.showOptionsMenu = false;
    this.optionsMenuToggle = false;

    if(!this.cheetahSearchDiv) return;

    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'z-index', '-1')
    this._renderer.setStyle(searchDiv, 'display', 'none')
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
    this.changeSearchFocus(searchFocus);

    if (previousId !== id) {
      this.updateOptionStyle(previousId, "#fff");
    }

    this.updateOptionStyle(id, "#76B9ED");
    this.hideOptionsMenuDD();
  }

  onMouseEnter(id:number):void{
    this.updateOptionStyle(id, "#ccc");
  }

  onMouseLeave(id:number):void{    
    const color = (id === this.selectedOptionID)? "#76B9ED" : "#fff";
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

    //this.filteredFileIndex = this._fileIndex.filter(e => e.indexOf(searchString) !== -1) 
    //console.log('_fileIndex:', this._fileIndex);

    this.filteredFileIndex = this._fileIndex.filter(
      ([type, name, srcPath, imgPath]) => name.includes(searchString));

    console.log('filteredFileIndex:', this.filteredFileIndex);
  }

  resetFilteredArray():void{
    this.filteredFileIndex = [[]];
    this.filteredFileIndex.pop();

    this.showSearchResult = false;
  }

  focusOnInput(evt:MouseEvent):void{
    evt.stopPropagation();
    const searchBarTxtBoxElm = document.getElementById('searchBarTxtBox') as HTMLInputElement;
    if(searchBarTxtBoxElm){
      searchBarTxtBoxElm?.focus();
    }
  }

  changeSearchFocus(focus:string):void{
    let focusPath = Constants.EMPTY_STRING;

    //if focuse is All, pull everything, apps included,
    if(focus === this.OPTION_ALL || focus === this.OPTION_APPS || focus === this.OPTION_FOLDERS){


    }else{

    }

    //if files, exclude folders 
  }

  hideShowSearchSections(focus:string):void{
    this.showBestMatchSection = true;

    this.showApplicationSection = (focus === this.OPTION_ALL || focus === this.OPTION_APPS);

    this.showFilesSection = (focus === this.OPTION_ALL);

    this.showFoldersSection = (focus === this.OPTION_ALL || focus === this.OPTION_FOLDERS);

    this.showOthersSection = (focus === this.OPTION_DOCUMENTS || focus === this.OPTION_MUSIC 
                              || focus === this.OPTION_VIDEOS || focus === this.OPTION_MUSIC);

    this.otherSectionName = (this.showOthersSection)? focus : Constants.EMPTY_STRING;
    this.bestMatchFor = (this.showOthersSection)? focus.toLowerCase() : Constants.EMPTY_STRING;
  }

  desktopIsActive():void{ }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}

