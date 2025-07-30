/* eslint-disable @angular-eslint/prefer-standalone */
import { Component } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';

@Component({
  selector: 'cos-runsystem',
  templateUrl: './runsystem.component.html',
  styleUrl: './runsystem.component.css',
  standalone:false,
})
export class RunSystemComponent implements BaseComponent {

  private _menuService:MenuService;
  private _processIdService:ProcessIDService;
    private _runningProcessService:RunningProcessService;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}run.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Run';
  name = 'runsystem';

  constructor( menuService:MenuService, processIdService:ProcessIDService,  runningProcessService:RunningProcessService) { 
    this._menuService = menuService;
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  onClosePropertyView():void{
    const processToClose = this._runningProcessService.getProcess(this.processId);
    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

}
