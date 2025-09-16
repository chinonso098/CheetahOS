/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit, OnDestroy, Renderer2, ElementRef, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

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

  searchAll = `${Constants.IMAGE_BASE_PATH}search_all.png`;
  searchFile = `${Constants.IMAGE_BASE_PATH}search_file.png`;
  searchMusic = `${Constants.IMAGE_BASE_PATH}search_music.png`;
  searchVideo = `${Constants.IMAGE_BASE_PATH}search_video.png`;
  searchFolder = `${Constants.IMAGE_BASE_PATH}search_folder.png`;
  searchPicture = `${Constants.IMAGE_BASE_PATH}search_picture.png`;
  searchApplicatiion = `${Constants.IMAGE_BASE_PATH}search_app.png`;

  isShowOptionsMenu = false;
  showOptionsMenu = false;
  menuOptions!:string[][];

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'search';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, menuService:MenuService,
                systemNotificationServices:SystemNotificationService, renderer:Renderer2) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._systemNotificationServices = systemNotificationServices;

    this._renderer = renderer;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._menuService.hideSearchBox.subscribe(() => { this.hideSearchBox()});
    this._menuService.showSearchBox.subscribe(() => { this.showSearchBox()});

    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.hideSearchBox()});
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnInit(): void {
    this.menuOptions = this.generateOptions();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  showSearchBox():void{
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'block');
    this._renderer.setStyle(searchDiv, 'z-index', '3');
  }

  hideSearchBox():void{
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
    }else{
      this.showOptionsMenu = true;
      this.isShowOptionsMenu = true;
    }
  }

  generateOptions():string[][]{
    const options = [[this.searchAll, 'All'], [this.searchApplicatiion, 'Apps'], [this.searchFile, 'Documents'],
                     [this.searchFolder, 'Folders'], [this.searchMusic, 'Music'], [this.searchPicture, 'Photos'],
                     [this.searchVideo, 'Videos']];
    return options;
  }

  selectOption(evt:MouseEvent, id:number):void{

  }

  onMouseEnter(id:number):void{

  }

  onMouseLeave(id:number):void{
    
  }

  desktopIsActive():void{ }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}

