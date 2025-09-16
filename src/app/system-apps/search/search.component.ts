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

  private _renderer:Renderer2

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _systemNotificationServices:SystemNotificationService;

  private isSearchWindowVisible = false;

  searchIcon = `${Constants.IMAGE_BASE_PATH}taskbar_search.png`;

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

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  showSearchBox():void{

    console.log('search box should be visible')
    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'display', 'block');
    this._renderer.setStyle(searchDiv, 'z-index', '3');
  }

  hideSearchBox():void{
    if(!this.cheetahSearchDiv) return;

    console.log('search box should not be visible')

    const  searchDiv = this.cheetahSearchDiv.nativeElement;
    this._renderer.setStyle(searchDiv, 'z-index', '-1')
    this._renderer.setStyle(searchDiv, 'display', 'none')
  }

  desktopIsActive():void{ }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}

