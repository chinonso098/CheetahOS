import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FileService } from 'src/app/shared/system-service/file.service';

import { Process } from 'src/app/system-files/process';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ProcessIDService } from '../../system-service/process.id.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { WindowService } from '../../system-service/window.service';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})

export class PropertiesComponent implements BaseComponent, OnChanges{
  @Input() fileInput!:FileInfo;

  private _fileService:FileService;
  private _runningProcessService:RunningProcessService;
  private _processIdService:ProcessIDService
  private _windowService:WindowService;


  URL = Constants.URL;

  processId = 0;
  type = ComponentType.System;
  hasWindow = false;
  displayMgs = Constants.EMPTY_STRING;
  displayName = Constants.EMPTY_STRING;
  name = Constants.EMPTY_STRING;
  private hiddenName = Constants.EMPTY_STRING
  location = Constants.EMPTY_STRING;
  icon = Constants.EMPTY_STRING;
  private hiddenIcon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
      windowService:WindowService,fileInfoService:FileService) { 
    this._processIdService = processIdService;
    this._fileService = fileInfoService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    //this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    this.location = dirname(this.fileInput.getCurrentPath);
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
    this.hiddenName = `${Constants.WIN_EXPLR + this.fileInput.getFileName}`;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  onClosePropertyView():void{
    this._windowService.closeWindowProcessNotify.next(this.processId);
  }

  setPropertyWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.hiddenName, this.hiddenIcon, this.hasWindow, this.type)
  }

}

