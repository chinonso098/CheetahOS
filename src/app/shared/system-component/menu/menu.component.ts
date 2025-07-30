import { Component, Input, OnDestroy } from '@angular/core';
import { NestedMenu, GeneralMenu } from './menu.types';
import { MenuService } from '../../system-service/menu.services';
import { Subscription } from 'rxjs';
import { Constants } from 'src/app/system-files/constants';
import { applyEffect } from "src/osdrive/Cheetah/System/Fluent Effect";
import { MenuAction } from './menu.enums';

@Component({
  selector: 'cos-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class MenuComponent implements OnDestroy{

  @Input() generalMenu: GeneralMenu[] = [];
  @Input() nestedMenu: NestedMenu[] = [];
  @Input() fileExplorerMenu: NestedMenu[] = [];
  @Input() menuType = Constants.EMPTY_STRING;
  @Input() menuOrder = Constants.EMPTY_STRING;  

  private _menuService:MenuService;
  private _storeDataSub!:Subscription;

  readonly paste = MenuAction.PASTE;
  readonly fileExplrMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  readonly tskBarAppIconMenuOption = Constants.TASK_BAR_APP_ICON_MENU_OPTION;
  readonly tskBarContextMenuOption = Constants.TASK_BAR_CONTEXT_MENU_OPTION;
  readonly pwrMenuOption = Constants.POWER_MENU_OPTION;
  readonly defaultFileMenuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
  readonly defaultFolderMenuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
  readonly fileExplrFolderMenuOrder = Constants.FILE_EXPLORER_FOLDER_MENU_ORDER;
  readonly fileExplrFileMenuOrder = Constants.FILE_EXPLORER_FILE_MENU_ORDER;
  readonly fileExplrUniqueMenuOrder = Constants.FILE_EXPLORER_UNIQUE_MENU_ORDER;
  readonly fileExplrRecycleBinMenuOrder = Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER;
  readonly recycleBinMenuOrder = Constants.RECYCLE_BIN_MENU_ORDER;

  isPasteActive!:boolean;
  keys: string[] = [];

  constructor(menuService:MenuService) { 
    this._menuService = menuService;
    this.isPasteActive = this._menuService.getPasteState();
  }


    onBtnHover():void{
      applyEffect('.dm-power-vertical-menu', {
        clickEffect: true,
        lightColor: 'rgba(255,255,255,0.1)',
        gradientSize: 35,
        isContainer: true,
        children: {
          borderSelector: '.dm-power-vertical-menu-cntnr',
          elementSelector: '.dm-power-vertical-menu-item',
          lightColor: 'rgba(255,255,255,0.3)',
          gradientSize: 35
        }
      })
    }
  
  

  ngOnDestroy(): void {
    this._storeDataSub?.unsubscribe();
  }

  onMenuItemClick(action:(evt:MouseEvent) => void, evt:MouseEvent): void {
    action(evt);
  }

  onMenuItemHover(action1: () => void): void {
    action1();
  }

  getKeys(obj: any):void{
    this.keys = Object.keys(obj);
  }
}
