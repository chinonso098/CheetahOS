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


  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 11000;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'CheetahOS';
  version = 'Version: 2.10.27';
  year = `\u00A9 ${new Date().getFullYear()}`;

  constructor( menuService:MenuService) { 
    this._menuService = menuService;
  }

  onClosePropertyView():void{
    this._menuService.closePropertiesView.next(this.processId);
  }
}