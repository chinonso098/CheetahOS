import { Component, Input, OnDestroy } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-controlpanel',
  templateUrl: './controlpanel.component.html',
  styleUrls: ['./controlpanel.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class ControlPanelComponent implements OnDestroy {

  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _windowService:WindowService;
  private _hideStartMenuSub!:Subscription;
  
  isMaximizable = false;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}settings.png`;
  name = 'controlpanel';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService, 
               windowService:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnDestroy(): void {
    this._hideStartMenuSub?.unsubscribe();
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
