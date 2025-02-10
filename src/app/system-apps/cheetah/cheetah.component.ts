import { Component} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
import { Constants } from "src/app/system-files/constants";
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"]
})

export class CheetahComponent implements BaseComponent {
  private _menuService:MenuService;
  private _processIdService:ProcessIDService;
    private _runningProcessService:RunningProcessService;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 11000;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'cheetah';
  version = 'Version: 2.10.27';
  year = `\u00A9 ${new Date().getFullYear()}`;

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