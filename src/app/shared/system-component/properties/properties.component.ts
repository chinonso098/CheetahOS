import {Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from '../../system-service/menu.services';
import { RunningProcessService } from '../../system-service/running.process.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})

export class PropertiesComponent implements OnChanges,  OnDestroy{
  @Input() fileInput!:FileInfo;

  private _fileService:FileService;
  private _menuService:MenuService;
  private _runningProcessService:RunningProcessService;

  private _deskTopIsActiveSub!:Subscription;
  private _lockScreenIsActiveSub!:Subscription;

  URL = Constants.URL;

  propertyId = 0;
  type = ComponentType.System;
  displayMgs = '';
  name = '';
  location = '';
  icon = '';

  constructor(fileInfoService:FileService, menuService:MenuService, runningProcessService:RunningProcessService){
    this._fileService = fileInfoService;
    this._menuService = menuService;
    this._runningProcessService = runningProcessService;
    this.propertyId = this.generatePropertyId();

    this._runningProcessService.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._runningProcessService.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    this.location = dirname(this.fileInput.getCurrentPath);
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
  }

  ngOnDestroy(): void {
    this._deskTopIsActiveSub?.unsubscribe();
    this._lockScreenIsActiveSub?.unsubscribe();
  }

  onClosePropertyView():void{
    this._menuService.closePropertiesView.next(this.propertyId);
  }

  private generatePropertyId(): number{
    //This is still a component, compoenets are retrieved by id. 
    const min = 500;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

  lockScreenIsActive():void{
    const propElmnt = document.getElementById(`propDisplay-${this.propertyId}`) as HTMLDivElement;
    if(propElmnt) {
      propElmnt.style.zIndex = '0';
    }
  }

  desktopIsActive():void{
    const propElmnt = document.getElementById(`propDisplay-${this.propertyId}`) as HTMLDivElement;
    if(propElmnt) {
      propElmnt.style.zIndex = '2';
    }
  }
}

