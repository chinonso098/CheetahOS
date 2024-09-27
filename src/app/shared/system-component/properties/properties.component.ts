import {ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FileService } from 'src/app/shared/system-service/file.service';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})

export class PropertiesComponent implements OnChanges {
  @Input() fileInput!:FileInfo;

  private _fileService:FileService;
  private _consts:Constants = new Constants();

  URL = this._consts.URL;

  propertiesId = 0;
  type = ComponentType.System;
  displayMgs = '';
  name = '';
  location = '';
  icon = '';

  constructor(private changeDetectorRef: ChangeDetectorRef, fileInfoService:FileService){
    this._fileService = fileInfoService;
    this.propertiesId = this.generatePropertyId();
  }


  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);

    this.displayMgs = `${this.fileInput.getFileName} Properties`;
    this.name = this.fileInput.getFileName;
    this.location = dirname(this.fileInput.getCurrentPath);
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);

    console.log('DIALOG onCHANGES:',this.icon);
  }


  onCloseDialogBox():void{
    //this._notificationServices.closeDialogBoxNotify.next(this.propertyId);
  }

  private generatePropertyId(): number{
    const min = Math.ceil(500);
    const max = Math.floor(999);
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

}
