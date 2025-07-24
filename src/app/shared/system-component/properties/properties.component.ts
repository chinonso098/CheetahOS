/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { basename, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FileService } from 'src/app/shared/system-service/file.service';

import { Process } from 'src/app/system-files/process';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ProcessIDService } from '../../system-service/process.id.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { WindowService } from '../../system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css',
  standalone:false,
})

export class PropertiesComponent implements BaseComponent, OnChanges{
  @Input() fileInput!:FileInfo;

  private _fileService:FileService;
  private _runningProcessService:RunningProcessService;
  private _processIdService:ProcessIDService
  private _windowService:WindowService;

  fileFolder = 'File folder';
  osDisk = 'OSDisk';
 
  fileDate:Date= new Date();
  isFile = true;
  isInRecycleBin = false;
  isRootFolder = false;
  URL = Constants.URL;
  readonly capacity = 512_050_500;
 
  type = ComponentType.System;
  hasWindow = false;

  name = Constants.EMPTY_STRING;
  icon = Constants.EMPTY_STRING;
  origin = Constants.EMPTY_STRING;
  iconPath = Constants.EMPTY_STRING;
  contains = Constants.EMPTY_STRING;
  location = Constants.EMPTY_STRING;
  opensWith = Constants.EMPTY_STRING;
  displayMgs = Constants.EMPTY_STRING;
  displayName = Constants.EMPTY_STRING;
  fileSizeUnit = Constants.EMPTY_STRING;

  circumference: number = 2 * Math.PI * 35; // Circumference for a circle with radius 45
  strokeDashoffset: number = this.circumference; // Initialize to full offset (all white)

  processId = 0;
  fileSize = 0;
  fileSize2 = 0;
  fileSizeOnDisk = 0;
  fileSizeOnDisk2 = 0;
  availableSpace = 0;
  availableSpace2 = 0;
  capacity2 = 0;

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
    await this.doStuff();
  }

  async doStuff():Promise<void> {
    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    const currPath = dirname(this.fileInput.getCurrentPath);
    this.location = `C: ${currPath}`;
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
    this.iconPath = this.fileInput.getIconPath;
    this.opensWith = this.fileInput.getOpensWith;
    this.hiddenName = `${Constants.WIN_EXPLR + this.fileInput.getFileName}`;
    this._runningProcessService.addProcess(this.getComponentDetail());
    this.isFile = this.fileInput.getIsFile;
    this.isInRecycleBin = (currPath.includes(Constants.RECYCLE_BIN_PATH));
    this.isRootFolder = (currPath === Constants.ROOT);

    if(this.fileInput.getIsFile){
      this.getFileSize();

      if(this.isInRecycleBin){
        this.fileFolder = this.fileInput.getFileType;
        this.getOrigin();
      }
    }
    
    if(!this.fileInput.getIsFile){
      this.icon = this.fileInput.getIconPath;

      if(!this.isRootFolder)
        await this.getFolderContentDetails();

      await this.getFolderSizeData();
      if(this.isInRecycleBin){
        this.getOrigin();
      }

      if(this.isRootFolder){
        this.fileFolder = 'Local Disk';
        this.icon = `${Constants.IMAGE_BASE_PATH}os_disk_1.png`;
        this.name = `${this.fileFolder} (C:) Properties`;
        this.location = 'BrowserFS';
      }
    }
  }

  async getFolderContentDetails():Promise<void>{
    const count =  await this._fileService.countFolderItems(this.fileInput.getCurrentPath);

    if(count === 0){
      this.contains = '0 Files, 0 Folders';
    }else{
      this.contains = await this._fileService.getFullCountOfFolderItems(this.fileInput.getCurrentPath);
    }
  }

  getFileSize():void{
    this.fileSize = this.fileInput.getSize;
    this.fileSize2 = this.fileInput.getSizeInBytes;

    const tmpFilesOnDisk = this.getRandomNumber(this.fileInput.getSizeInBytes);
    this.fileSizeOnDisk = CommonFunctions.getReadableFileSizeValue(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed( 0));

    this.fileSizeUnit = this.fileInput.getFileSizeUnit;
    this.fileDate = this.fileInput.getDateModified;
  }

  async getFolderSizeData():Promise<void>{
    const folderSize = await this._fileService.getFolderSizeAsync(this.fileInput.getCurrentPath);
    this.fileSize = CommonFunctions.getReadableFileSizeValue(folderSize);
    this.fileSize2 = folderSize;

    const tmpFilesOnDisk = this.getRandomNumber(folderSize);
    this.fileSizeOnDisk = CommonFunctions.getReadableFileSizeValue(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed(0));

    this.fileSizeUnit  = CommonFunctions.getFileSizeUnit(folderSize);
    this.fileDate = this.fileInput.getDateModified;

    if(this.isRootFolder){
      this.availableSpace = this.capacity - folderSize;
      this.availableSpace2 = CommonFunctions.getReadableFileSizeValue(this.availableSpace);
      this.capacity2 =  CommonFunctions.getReadableFileSizeValue(this.capacity);
      this.updateCapacityImg(folderSize);
    }
  }

  updateCapacityImg(used:number): void {
      // Calculate stroke-dashoffset based on the input value
      // 100% progress means 0 offset, 0% means full offset
      this.strokeDashoffset = this.circumference * (1 - used/ this.capacity);
  }

  getOrigin():void{
    const cntntOrigin = this._fileService.getFolderOrigin(this.fileInput.getCurrentPath);
    if(cntntOrigin !== Constants.EMPTY_STRING)
      this.origin = basename(dirname(cntntOrigin));
    else
      this.origin = 'Unkown';
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

