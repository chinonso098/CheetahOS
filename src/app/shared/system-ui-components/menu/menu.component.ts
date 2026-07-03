import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { NestedMenu, GeneralMenu, CheckableMenu } from './menu.types';
import { MenuService } from '../../system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { ThemeService } from '../../system-theme/theme';
import { DefaultService } from '../../system-service/defaults.services';
import { applyEffect } from "src/osdrive/Cheetah/System/Fluent Effect";
import { MenuAction } from './menu.enums';

@Component({
  selector: 'cos-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class MenuComponent implements OnInit, OnDestroy {

  // Mirrors the global light/dark theme onto the host so the menu's CSS can
  // swap its palette via the :host(.theme-light) variable overrides. Every
  // menu instance subscribes to the same root ThemeService, so all context
  // menus stay in sync with the rest of the system.
  @HostBinding('class.theme-light') isLightTheme = false;

  // Taskbar context / app-icon menus only: when the "Show accent color on Start
  // and taskbar" toggle is ON, these menus adopt the same accent surface as the
  // Start menu / taskbar (white text + accent tint). OFF -> plain light/dark theme.
  @HostBinding('class.menu-accent-on') isAccentOnTaskbar = false;
  // Context menus (desktop + file-explorer context, icon menus, file tree) have
  // their OWN dedicated transparency toggle, independent of the global effect and
  // the taskbar menus. ON -> the menus become frosted glass (light/dark surface).
  @HostBinding('class.menu-other-transparent') isOtherMenuTransparent = false;
  // Tints the frosted context menus with a SOFT accent. Only takes effect while
  // .menu-other-transparent is also on; OFF -> plain light/dark frosted menus.
  @HostBinding('class.menu-accent-other-on') isAccentOnOtherMenus = false;
  // When transparency effects are ON, the taskbar menus take a frosted-glass look.
  @HostBinding('class.menu-transparent') isTransparencyOn = false;
  // Accent color fed to the taskbar menus' surface/hover tints.
  @HostBinding('style.--menu-accent') menuAccent = Constants.DEFAULT_ACCENT_COLOR_VALUE;

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
  private _themeService: ThemeService;
  private _defaultService: DefaultService;
  private _themeChangeSub?: Subscription;
  private _settingsChangeSub?: Subscription;

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

  constructor(menuService: MenuService, themeService: ThemeService, defaultService: DefaultService) {
    this._menuService = menuService;
    this._themeService = themeService;
    this._defaultService = defaultService;
    this.isPasteActive = this._menuService.getPasteState();
  }

  ngOnInit(): void {
    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });

    this.applyTaskbarMenuSurfaceState();
    this._settingsChangeSub = this._defaultService.defaultSettingsChangeNotify.subscribe((key: string) => {
      if (key === Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR
        || key === Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU
        || key === Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU
        || key === Constants.DEFAULT_ACCENT_COLOR
        || key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) {
        this.applyTaskbarMenuSurfaceState();
      }
    });
  }

  ngOnDestroy(): void {
    this._themeChangeSub?.unsubscribe();
    this._settingsChangeSub?.unsubscribe();
  }

  // Mirrors the Start-menu / taskbar accent + transparency wiring onto the two
  // taskbar menus (app-icon + context). Accent ON -> accent surface; transparency
  // ON -> frosted glass. Both are scoped to the .dm-tskbar-* selectors in CSS.
  // Also reads the two DEDICATED context-menu toggles that drive the desktop /
  // file-explorer / file-tree menus (.dm-vertical-menu / .dm-nested-vertical-menu):
  // one frosts them, the other tints that frost with a soft accent.
  private applyTaskbarMenuSurfaceState(): void {
    this.isAccentOnTaskbar = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR) === Constants.TRUE;
    this.isOtherMenuTransparent = this._defaultService.getDefaultSetting(Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU) === Constants.TRUE;
    this.isAccentOnOtherMenus = this._defaultService.getDefaultSetting(Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU) === Constants.TRUE;
    this.isTransparencyOn = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) === Constants.TRUE;
    this.menuAccent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
  }

  // Maps a menu item's label to the key of its inline (theme-aware) SVG glyph,
  // or an empty string when the item has no built-in glyph (callers then fall
  // back to the item's own image, if any). Inline SVGs are filled with
  // currentColor so they flip between light and dark with the menu.
  glyphFor(label: string): string {
    switch (label) {
      case MenuAction.CUT: return 'cut';
      case MenuAction.COPY: return 'copy';
      case MenuAction.PASTE: return 'paste';
      case MenuAction.DELETE: return 'delete';
      case MenuAction.REFRESH: return 'refresh';
      case MenuAction.RENAME: return 'rename';
      case MenuAction.PROPERTIES: return 'properties';
      case MenuAction.CREATE_SHORTCUT: return 'shortcut';
      case MenuAction.PIN_TO_TASKBAR: return 'pin';
      case MenuAction.PIN_TO_QUICK_ACCESS: return 'pin';
      case MenuAction.PIN_TO_START: return 'pin';
      case MenuAction.UNPIN_FROM_TASKBAR: return 'unpin';
      case MenuAction.CLOSE_WINDOW:
      case MenuAction.CLOSE_ALL_WINDOWS: return 'close';
      case MenuAction.VIEW: return 'view';
      case MenuAction.SORTBY: return 'sort';
      case MenuAction.NEW: return 'new';
      case MenuAction.PREVIOUS_BACKGROUND: return 'prev_background';
      case MenuAction.NEXT_BACKGROUND: return 'next_background';
      case MenuAction.OPEN_IN_NEW_WINDOW: return 'new_window';

      // case MenuAction.OPEN_IN_TERMINAL: return 'terminal';
      // case MenuAction.TASK_MANAGER: return 'task_manager';
      // case MenuAction.SHOW_THE_DESKTOP: return 'show_desktop';
      // case MenuAction.SHOW_OPEN_WINDOWS: return 'show_open_windows';
      // case MenuAction.HIDE_THE_TASKBAR: return 'hide_taskbar';
      // case MenuAction.MERGE_TASKBAR_ICONS: return 'merge_taskbar_icons';
      // case MenuAction.UNMERGE_TASKBAR_ICONS: return 'unmerge_taskbar_icons';
      // case MenuAction.SHOW_THE_TASKBAR: return 'show_taskbar';

      default: return Constants.EMPTY_STRING;
    }
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
    // Stop the click here so selecting a menu option never bubbles to the
    // underlying surface (e.g. the File Explorer <ol>'s click handler, which
    // would otherwise clear selection / re-trigger window focus). This makes
    // every menu item behave consistently, including the no-arg item actions
    // that don't stop propagation themselves.
    evt.stopPropagation();
    action(evt);

    // A selection fulfills the menu's purpose, so dismiss it — except the
    // checkable variant (Task Manager columns), which intentionally stays open
    // so several toggles can be made in one go. This dismissal used to happen as
    // a side effect of the click bubbling to the host surface, which we now stop
    // above; closing centrally keeps every other menu variant consistent.
    if(this.menuType !== this.checkableMenuOption)
      this._menuService.closeAllContextMenus();
  }

  // Invoked when a nested menu item is hovered. Runs the item's hover handler.
  onMenuItemHover(action1: () => void): void {
    action1();
  }
}

