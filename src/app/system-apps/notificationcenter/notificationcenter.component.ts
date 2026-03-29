import { Component, OnDestroy, effect } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { MenuService } from 'src/app/shared/system-service/menu.services';

@Component({
  selector: 'cos-notificationcenter',
  templateUrl: './notificationcenter.component.html',
  styleUrls: ['./notificationcenter.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class NotificationCenterComponent implements OnDestroy {
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _menuService!:MenuService;

  private isStartMenuVisible = false;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'notificationcenter';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    effect(() => {
      if(this._menuService.hideStartMenu() > 0) {
        this.hideStartMenu();
      }
    });
  }

  ngOnDestroy(): void {
  }

  showStartMenu(evt:MouseEvent):void{
    if(!this.isStartMenuVisible){
      this._menuService.showStartMenu.update(v => v + 1);
      this.isStartMenuVisible = true;
    }else{
      this._menuService.hideStartMenu.update(v => v + 1);
    }

    evt.stopPropagation();
  }

  hideStartMenu():void{
    this.isStartMenuVisible = false;
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
