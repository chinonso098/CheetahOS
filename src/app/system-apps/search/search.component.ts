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

  searchPlaceHolder = 'Search';

  isShowOptionsMenu = false;
  showOptionsMenu = false;
  menuOptions!:string[][];

  selectedOptionID = 0;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'search';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, menuService:MenuService,
                systemNotificationServices:SystemNotificationService, renderer:Renderer2, formBuilder:FormBuilder,
                fileIndexerService:FileIndexerService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationServices = systemNotificationServices;
    this._fileIndexerService = fileIndexerService

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
      searchBarText: this.searchPlaceHolder,
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
    this.isShowOptionsMenu = false;

    if(!this.cheetahSearchDiv) return;

    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'z-index', '-1')
    this._renderer.setStyle(searchDiv, 'display', 'none')
  }

  hideShowOptions(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this.isShowOptionsMenu){
      this.showOptionsMenu = false;
      this.isShowOptionsMenu = false;

      this.selectedOptionID = 0;
      this.defaultsearchIcon = this.searchAllIcon;
    }else{
      this.showOptionsMenu = true;
      this.isShowOptionsMenu = true;
    }

    setTimeout(() => {
      this.onMouseLeave(this.selectedOptionID);
    }, 50);
  }

  generateOptions():string[][]{
    const options = [[this.searchAllIcon, 'All'], [this.searchApplicatiionIcon, 'Apps'], [this.searchFileIcon, 'Documents'],
                     [this.searchFolderIcon, 'Folders'], [this.searchMusicIcon, 'Music'], [this.searchPictureIcon, 'Photos'],
                     [this.searchVideoIcon, 'Videos']];
    return options;
  }

  selectOption(evt:MouseEvent, id:number):void{
    evt.stopPropagation();

    const currentSelectedOptionID = this.selectedOptionID;
    this.selectedOptionID = id;

    this.defaultsearchIcon = this.menuOptions[id][0];
    const searchFocus = this.menuOptions[id][1];
    this.changeSearchFocus(searchFocus);

    if(currentSelectedOptionID !== this.selectedOptionID){
      const liElmnt = document.getElementById(`dd-option-${currentSelectedOptionID}`) as HTMLLIElement;
      if(liElmnt){
        liElmnt.style.backgroundColor = '#fff';
      }
    }
    const liElmnt = document.getElementById(`dd-option-${id}`) as HTMLLIElement;
    if(liElmnt){
      liElmnt.style.backgroundColor = '#76B9ED';
    }
  }

  onMouseEnter(id:number):void{
    const liElmnt = document.getElementById(`dd-option-${id}`) as HTMLLIElement;
    if(liElmnt){
      liElmnt.style.backgroundColor = '#ccc';
    }
  }

  onMouseLeave(id:number):void{    
    if(id === this.selectedOptionID){
      const liElmnt = document.getElementById(`dd-option-${id}`) as HTMLLIElement;
      if(liElmnt){
        liElmnt.style.backgroundColor = '#76B9ED';
      }
    }else{
      const liElmnt = document.getElementById(`dd-option-${id}`) as HTMLLIElement;
      if(liElmnt){
        liElmnt.style.backgroundColor = '#fff';
      }
    }
  }

  onKeyDownInInputBox(evt:KeyboardEvent):void{
    console.log('evt.key:',evt.key);

    let searchString = this.searchBarForm.value.searchBarText as string;
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
    if(focus === 'All' || focus === 'Apps' || focus === 'Folders'){


    }else{

    }

    //if files, exclude folders 
  }

  desktopIsActive():void{ }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}

