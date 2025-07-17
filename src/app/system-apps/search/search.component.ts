/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnDestroy } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  standalone:false,
})

export class SearchComponent implements OnDestroy {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _hideSearchSub!:Subscription;
  private isSearchWindowVisible = false;

  searchIcon = `${Constants.IMAGE_BASE_PATH}taskbar_search.png`;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'search';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._hideSearchSub = this._menuService.hideStartMenu.subscribe(() => { this.hideSearchWindow()});
  }

  ngOnDestroy(): void {
    // this._hideStartMenuSub?.unsubscribe();
    1
  }

  showSearchWindow():void{
    1
    // if(!this.isSearchWindowVisible){
    //   this._menuService.showStartMenu.next();
    //   this.isSearchWindowVisible = true;
    // }
    // else{
    //   const uid = `${this.name}-${this.processId}`;
    //   this._runningProcessService.addEventOriginator(uid);

    //   this._menuService.hideStartMenu.next();
    //   this.isSearchWindowVisible = false;
    // }
  }

  hideSearchWindow():void{
    1
    // const uid = `${this.name}-${this.processId}`;
    // const evtOriginator = this._runningProcessService.getEventOrginator();
    // if(evtOriginator !== uid){
    //   this.isSearchWindowVisible = false;
    // }
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
