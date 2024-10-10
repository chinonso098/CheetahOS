import { Component, Input, OnDestroy } from '@angular/core';
import {NestedMenu, GeneralMenu } from './menu.item';
import { MenuService } from '../../system-service/menu.services';
import { Subscription } from 'rxjs';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnDestroy{

  @Input() generalMenu: GeneralMenu[] = [];
  @Input() nestedMenu: NestedMenu[] = [];
  @Input() fileExplorerMenu: NestedMenu[] = [];
  @Input() menuType = '';
  @Input() menuOrder = '';  

  private _menuService:MenuService;
  private _storeDataSub!:Subscription;
  private _consts:Constants = new Constants();

  readonly paste = 'Paste';
  readonly fileExplrMngrMenuOption = this._consts.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  readonly tskBarMenuOption = this._consts.TASK_BAR_MENU_OPTION;
  readonly defaultFileMenuOrder = this._consts.DEFAULT_FILE_MENU_ORDER;
  readonly defaultFolderMenuOrder = this._consts.DEFAULT_FOLDER_MENU_ORDER;
  readonly fileExplrFolderMenuOrder = this._consts.FILE_EXPLORER_FOLDER_MENU_ORDER;
  readonly fileExplrFileMenuOrder = this._consts.FILE_EXPLORER_FILE_MENU_ORDER;
  readonly fileExplrUniqueMenuOrder = this._consts.FILE_EXPLORER_UNIQUE_MENU_ORDER;

  isPasteActive!:boolean;
  keys: string[] = [];

  constructor(menuService:MenuService) { 
    this._menuService = menuService;
    this.isPasteActive = this._menuService.getPasteState();
    this._storeDataSub = this._menuService.storeData.subscribe(p => {

      const path = p[0];
      const actions = p[1];

      this._menuService.setPath(path);
      this._menuService.setActions(actions);
      this._menuService.setPasteState(true);
    })
  }
  

  ngOnDestroy(): void {
    this._storeDataSub?.unsubscribe();
  }

  onMenuItemClick(action: () => void): void {
    action();
  }

  onMenuItemHover(action1: () => void): void {
    action1();
  }

  getKeys(obj: any):void{
    this.keys = Object.keys(obj);
  }
}
