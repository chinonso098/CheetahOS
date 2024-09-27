import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from '../../system-service/menu.services';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})

export class PropertiesComponent implements OnChanges{
  @Input() fileInput!:FileInfo;

  private _fileService:FileService;
  private _menuService:MenuService;
  private _consts:Constants = new Constants();

  URL = this._consts.URL;

  propertyId = 0;
  type = ComponentType.System;
  displayMgs = '';
  name = '';
  location = '';
  icon = '';

  constructor(fileInfoService:FileService, menuService:MenuService){
    this._fileService = fileInfoService;
    this._menuService = menuService;
    this.propertyId = this.generatePropertyId();
  }

  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    this.location = dirname(this.fileInput.getCurrentPath);
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
  }

  onClosePropertyView():void{
    this._menuService.closePropertiesView.next(this.propertyId);
  }

  private generatePropertyId(): number{
    const min = Math.ceil(500);
    const max = Math.floor(999);
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}

