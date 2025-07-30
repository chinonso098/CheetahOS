import { Component, OnDestroy } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-startbutton',
  templateUrl: './startbutton.component.html',
  styleUrls: ['./startbutton.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class StartButtonComponent implements OnDestroy {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
    private _hideStartMenuSub!:Subscription;

  private isStartMenuVisible = false;

  hasWindow = false;
  hover = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startbutton';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._hideStartMenuSub = this._menuService.hideStartMenu.subscribe(() => { this.hideStartMenu()});
  }

  ngOnDestroy(): void {
    this._hideStartMenuSub?.unsubscribe();
  }

  showStartMenu(evt:MouseEvent):void{
    if(!this.isStartMenuVisible){
      this._menuService.showStartMenu.next();
      this.isStartMenuVisible = true;
    }else{
      this._menuService.hideStartMenu.next();
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
