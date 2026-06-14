import { Component, Input } from '@angular/core';
import { NestedMenu, GeneralMenu, CheckableMenu } from './menu.types';
import { MenuService } from '../../system-service/menu.services';
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
export class MenuComponent {

  // The list of items rendered for the "flat" menu variants (file-explorer
  // manager menu, task-bar app-icon menu, task-bar context menu and power menu).
  @Input() generalMenu: GeneralMenu[] = [];

  // The list of items rendered for the nested/desktop context menu, which can
  // contain sub-menus, hover actions and a (conditionally enabled) Paste item.
  @Input() nestedMenu: NestedMenu[] = [];

  // The list of items rendered for the "checkable" menu variant. Each item
  // shows a checkmark driven by its `checked` flag (e.g. Task Manager's
  // show/hide-columns menu).
  @Input() checkableMenu: CheckableMenu[] = [];

  // Which template variant to render. Compared against the *MenuOption
  // constants below to select the matching <ng-template> in the HTML.
  @Input() menuType = Constants.EMPTY_STRING;

  // Which separator layout to apply within the flat file-explorer menu. Compared
  // against the *MenuOrder constants below to decide where divider lines appear.
  @Input() menuOrder = Constants.EMPTY_STRING;

  // Service used to read the current clipboard/paste state for the nested menu.
  private _menuService: MenuService;

  // Label of the Paste menu item, used by the template to special-case it.
  readonly paste = MenuAction.PASTE;

  // Menu-type discriminators consumed by the template's ngTemplateOutlet switch.
  readonly fileExplrMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  readonly tskBarAppIconMenuOption = Constants.TASK_BAR_APP_ICON_MENU_OPTION;
  readonly tskBarContextMenuOption = Constants.TASK_BAR_CONTEXT_MENU_OPTION;
  readonly pwrMenuOption = Constants.POWER_MENU_OPTION;
  readonly checkableMenuOption = Constants.CHECKABLE_MENU_OPTION;

  // Separator-layout discriminators consumed by the template's divider logic.
  readonly defaultFileMenuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
  readonly defaultFolderMenuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
  readonly fileExplrFolderMenuOrder = Constants.FILE_EXPLORER_FOLDER_MENU_ORDER;
  readonly fileExplrFileMenuOrder = Constants.FILE_EXPLORER_FILE_MENU_ORDER;
  readonly fileExplrUniqueMenuOrder = Constants.FILE_EXPLORER_UNIQUE_MENU_ORDER;
  readonly fileExplrRecycleBinMenuOrder = Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER;
  readonly recycleBinMenuOrder = Constants.RECYCLE_BIN_MENU_ORDER;

  // Whether the Paste menu item should be enabled. A menu is created fresh each
  // time it is opened, so reading the state once at construction reflects the
  // current clipboard contents for the lifetime of this short-lived menu.
  isPasteActive: boolean;

  constructor(menuService: MenuService) {
    this._menuService = menuService;
    this.isPasteActive = this._menuService.getPasteState();
  }

  // Applies the Fluent "spotlight" hover effect to the power menu when the
  // pointer enters it.
  onBtnHover(): void {
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
    });
  }

  // Invoked when a menu item is clicked. Runs the item's click handler, passing
  // through the originating mouse event for handlers that need it. Typing the
  // parameter as a required-event handler lets this accept both the no-arg item
  // actions (GeneralMenu/NestedMenu) and the event-aware nested sub-item actions.
  onMenuItemClick(action: (evt: MouseEvent) => void, evt: MouseEvent): void {
    action(evt);
  }

  // Invoked when a nested menu item is hovered. Runs the item's hover handler.
  onMenuItemHover(action1: () => void): void {
    action1();
  }
}

