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

  readonly fileFolder = 'File folder';
 
  fileDate:Date= new Date();
  isFile = true;
  URL = Constants.URL;
 
  type = ComponentType.System;
  hasWindow = false;

  name = Constants.EMPTY_STRING;
  icon = Constants.EMPTY_STRING;
  iconPath = Constants.EMPTY_STRING;
  contains = Constants.EMPTY_STRING;
  location = Constants.EMPTY_STRING;
  opensWith = Constants.EMPTY_STRING;
  displayMgs = Constants.EMPTY_STRING;
  displayName = Constants.EMPTY_STRING;
  fileSizeUnit = Constants.EMPTY_STRING;

  processId = Constants.NUM_ZERO;
  fileSize = Constants.NUM_ZERO;
  fileSize2 = Constants.NUM_ZERO;
  fileSizeOnDisk = Constants.NUM_ZERO;
  fileSizeOnDisk2 = Constants.NUM_ZERO;

  private hiddenName = Constants.EMPTY_STRING
  private hiddenIcon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, windowService:WindowService,
              fileInfoService:FileService){ 
    this._processIdService = processIdService;
    this._fileService = fileInfoService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService = runningProcessService;
    //this._runningProcessService.addProcess(this.getComponentDetail());
  }

  async ngOnChanges(changes: SimpleChanges):Promise<void>{
    //console.log('DIALOG onCHANGES:',changes);

    console.log('fileInput', this.fileInput);

    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    this.location = dirname(this.fileInput.getCurrentPath);
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
    this.iconPath = this.fileInput.getIconPath;
    this.opensWith = this.fileInput.getOpensWith;
    this.hiddenName = `${Constants.WIN_EXPLR + this.fileInput.getFileName}`;
    this._runningProcessService.addProcess(this.getComponentDetail());
    this.isFile = this.fileInput.getIsFile;

    if(this.fileInput.getIsFile)
      this.getFileSize();

    if(!this.fileInput.getIsFile){
      await this.getFolderContentDetails();
      await this.getFolderSizeData()
    }
  }

  async getFolderContentDetails():Promise<void>{
    const count =  await this._fileService.getCountOfFolderItemsAsync(this.fileInput.getCurrentPath);

    if(count === Constants.NUM_ZERO){
      this.contains = '0 Files, 0 Folders';
    }else{
      this.contains = await this._fileService.getDetailedCountOfFolderItemsAsync(this.fileInput.getCurrentPath);
    }
  }

  getFileSize():void{
    this.fileSize = this.fileInput.getSize1;
    this.fileSize2 = this.fileInput.getSize;

    const tmpFilesOnDisk = this.getRandomNumber(this.fileInput.getSize);
    this.fileSizeOnDisk = this.getSize(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed(0));

    this.fileSizeUnit = this.fileInput.getFileSizeUnit;
    this.fileDate = this.fileInput.getDateModified;
  }

  async getFolderSizeData():Promise<void>{
    const folderSize =  await this._fileService.getFolderSizeASync(this.fileInput.getCurrentPath);
    this.fileSize = this.getSize(folderSize);
    this.fileSize2 = folderSize;

    const tmpFilesOnDisk = this.getRandomNumber(folderSize);
    this.fileSizeOnDisk = this.getSize(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed(0));

    this.getFolderSizeUnit(folderSize);
    this.fileDate = this.fileInput.getDateModified;
  }

  getFolderSizeUnit(size:number):void{
    if(size >= 0 && size <= 999){
        this.fileSizeUnit = 'B';
    }

    if(size >= 1000 && size <= 999999){
      this.fileSizeUnit = 'KB';
    }

    if(size >= 1000000 && size <= 999999999){
      this.fileSizeUnit = 'MB';
    }
  }

  getSize(size:number):number{
      let  tmpSize = 0

      if(size>= 0 && size<= 999){
          tmpSize = size;
      }

      if(size>= 1000 && size<= 999999){
          tmpSize= Math.round((size/1000) * 100) /100;
      }

      if(size>= 1000000 && size<= 999999999){
          tmpSize = Math.round((size/1000000) * 100) / 100;
      }

      return tmpSize;
  }

  onClosePropertyView():void{
    this._windowService.closeWindowProcessNotify.next(this.processId);
  }

  private getRandomNumber(x:number): number{
    const fivePercent = x * 0.05;
    const randomAddition = Math.random() * fivePercent; // random number from 0 to 5% of x
    const result = x + randomAddition;

    // Limit to 2 decimal places
    return parseFloat(result.toFixed(2));
  }

  setPropertyWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.hiddenName, this.hiddenIcon, this.hasWindow, this.type)
  }

}

