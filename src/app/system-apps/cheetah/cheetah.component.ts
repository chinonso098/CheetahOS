import { Component} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
import { Constants } from "src/app/system-files/constants";
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { BaseComponent } from 'src/app/system-base/base/base.component';

@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"]
})

export class CheetahComponent implements BaseComponent {
  private _menuService:MenuService;
  private _consts:Constants = new Constants();

  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${this._consts.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'CheetahOS';
  year = `\u00A9 ${new Date().getFullYear()}`;

  constructor( menuService:MenuService) { 
    this._menuService = menuService;
    this.processId = 11000;
  }



  onClosePropertyView():void{
    this._menuService.closePropertiesView.next(this.processId);
  }





  // private _fileService:FileService;

  // private _consts:Constants = new Constants();

  // URL = this._consts.URL;

  // propertyId = 0;
  // type = ComponentType.System;
  // displayMgs = '';
  // name = '';
  // location = '';
  // icon = '';

  // constructor(fileInfoService:FileService, menuService:MenuService){
  //   this._fileService = fileInfoService;
  //   this._menuService = menuService;
  //   this.propertyId = this.generatePropertyId();
  // }

  // ngOnChanges(changes: SimpleChanges):void{
  //   //console.log('DIALOG onCHANGES:',changes);
  //   this.displayMgs = `${this.fileInput.getFileName} `;
  //   this.name = this.fileInput.getFileName;
  //   this.location = dirname(this.fileInput.getCurrentPath);
  //   this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
  // }



}