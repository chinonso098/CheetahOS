import { AfterViewInit, OnInit,OnDestroy, Component, ElementRef, NgZone, ViewChild, HostListener} from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';


import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ESheepHandler } from './esheep/esheep.handler';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { ClippyService } from './clippy/clippy.service';
import { DesktopBackgroundHandler } from './background/desktop.background.handler';
import { TaskbarMenuHandler } from './taskbar-menu/taskbar.menu.handler';
import { DesktopIconsHandler } from './desktop-icons/desktop.icons.handler';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

import * as htmlToImage from 'html-to-image';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Constants } from 'src/app/system-files/constants';

import { TaskBarIconInfo } from '../taskbarentries/taskbar.entries.type';

import { IconsSizes } from './desktop.types';
import { DesktopGeneralHelper } from './desktop.general.helper';
import { DesktopContextMenuHelper } from './desktop.context.menu.helper';
import { DesktopStyleHelper } from './desktop.style.helper';
import { DesktopIconFileOpsHandler } from './desktop-icon-file-ops/desktop.icon.file.ops.handler';
import { DesktopRootElements } from './desktop.types';
import { concatMap } from 'rxjs';
import { NestedMenu, NestedMenuItem } from 'src/app/shared/system-ui-components/menu/menu.types';
import { SortBys } from 'src/app/system-files/commons/common.enums';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';
import { DialogMessage, DialogTitle } from 'src/app/shared/system-ui-components/dialog/dialog.types';

@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  // DesktopBackgroundService is provided at the COMPONENT scope (§1.1.2)
  // — not `providedIn: 'root'` — so the service can inject this
  // component's host ElementRef for `removeVantaJSSideEffect()` and so
  // its lifetime is tied to the (never-destroyed) desktop instance.
  // TaskbarMenuHandler is component-scoped for consistency (§1.1.3).
  // DesktopIconsHandler is component-scoped for consistency (§1.1.4).
  // DesktopIconFileOpsHandler is component-scoped (§1.1.4.4); it
  // sibling-injects DesktopIconsHandler so it must share the same
  // provider list (same instance, not a fresh one).
  providers: [DesktopBackgroundHandler, TaskbarMenuHandler, DesktopIconsHandler, DesktopIconFileOpsHandler],
  animations: [
    trigger('slideStatusAnimation', [
      state('slideOut', style({ right: '-488px' })),
      state('slideIn', style({ right: '8px' })),

      transition('* => slideIn', [
        animate('250ms ease-in')
      ]),
      transition('slideIn => slideOut', [
        animate('550ms ease-out')
      ]),
    ])
  ]
})

export class DesktopComponent implements OnInit, OnDestroy, AfterViewInit{
  // §1.4 — singleton DOM refs.  All five elements live at the top of
  // the template (none nested inside *ngIf/@if/*ngFor) so `static: true`
  // is safe and they are populated in time for `ngOnInit`.  Bundled into
  // a `DesktopRootElements` and passed to every handler that needs DOM
  // access; helpers receive the specific `HTMLElement` they need as a
  // function argument (helpers stay pure per §1.1.5).
  @ViewChild('desktopContainer',       {static: true}) desktopContainer!: ElementRef<HTMLElement>;
  @ViewChild('desktopIconOl',          {static: true}) desktopIconOl!: ElementRef<HTMLElement>;
  @ViewChild('desktopIconCloneCntnr',  {static: true}) desktopIconCloneCntnr!: ElementRef<HTMLElement>;
  @ViewChild('selectPaneContainer',    {static: true}) selectPaneContainer!: ElementRef<HTMLElement>;
  @ViewChild('invalidCharsToolTip',    {static: true}) invalidCharsToolTip!: ElementRef<HTMLElement>;

  // #region Fields & Component State

  private _fileService!:FileService
  private _menuService!:MenuService;
  private _audioService!:AudioService;
  private _windowService!:WindowService;
  private _defaultService!:DefaultService;
  private _processIdService!:ProcessIDService;
  private _processHandlerService!:ProcessHandlerService;
  private _runningProcessService!:RunningProcessService;
  private _systemNotificationServices!:SystemNotificationService;
  private _userNotificationService!:UserNotificationService;
  private _activityHistoryService!:ActivityHistoryService;
  // Extracted from this component in §1.1.1 — owns the Clippy spawn loop
  // and its cascaded tear-down. See ClippyService for behaviour details.
  private _clippyService!:ClippyService;

   private _eSheepHandler!:ESheepHandler;

  // Owns the desktop background subsystem (Vanta lifecycle, picture
  // cycling, color walker). Extracted from this component in §1.1.2.
  // Provided at the COMPONENT scope (see @Component.providers) so it
  // can inject this component's host ElementRef.
  private readonly _desktopBackgroundHandler!:DesktopBackgroundHandler;
  // Owns the taskbar preview-window and icon tooltip (§1.1.3.1). Public
  // because the template binds to its fields directly via
  // `taskbarMenu.<field>` (preview/tooltip *ngIf, style, text, etc).
  // Will grow to own the taskbar app-icon menu (§1.1.3.2) and the
  // taskbar context menu (§1.1.3.3) in subsequent stages.
  readonly taskbarMenu!: TaskbarMenuHandler;

  // Owns the desktop icons display surface (§1.1.4.1): view-by modes,
  // sort-by modes, auto-align / auto-arrange flags, icon visibility,
  // and icon-size styles. Public so the template can bind directly via
  // `iconsHandler.<field>`. Will grow in §1.1.4.2 (selection) and
  // §1.1.4.3 (drag).
  readonly iconsHandler!: DesktopIconsHandler;

  // Owns the per-icon context-menu, clipboard (Copy/Cut/Paste/Pin),
  // shortcut creation, and the currently-selected file state
  // (§1.1.4.4). `selectedFile` / `propertiesViewFile` are PUBLIC on
  // the handler because rename + delete (still on the component
  // until §1.1.4.5) need to read them.
  readonly iconFileOps!: DesktopIconFileOpsHandler;

  private _elRef:ElementRef;
  // §3.A — used by `ngAfterViewInit` to register the desktop-root
  // `mousemove` listener OUTSIDE Angular's zone so per-pixel work
  // (resetting the lock-screen timeout) does NOT trigger a
  // change-detection cycle.  Re-enters the zone only when the
  // taskbar is auto-hidden and the cursor enters the bottom gutter
  // (the only branch that actually mutates view-bound state).
  private readonly _ngZone: NgZone;
  // `_formBuilder` injection moved to DesktopIconFileOpsHandler (§1.1.4.5).
  // The rename form is built inside the handler's constructor so the
  // template binding `[formGroup]="iconFileOps.renameForm"` is valid
  // on the first paint.

  // Color walker / Vanta-effect state moved to DesktopBackgroundService
  // (§1.1.2). Component no longer touches the Vanta effect or HSL state.

  // View-by, sort-by, auto-align/auto-arrange flags, `showDesktopIcons`,
  // and the readonly view/sort label constants moved to
  // DesktopIconsHandler (§1.1.4.1). Template + menu builders now read
  // them via `iconsHandler.<field>`.

  isShiftSubMenuLeft = false;
  // `isTaskBarHidden` + `isTaskBarTemporarilyVisible` moved to
  // TaskbarMenuHandler (§1.1.3.3). Component reads via `taskbarMenu.<flag>`.
  // `isDragFromDesktopActive` moved to DesktopIconsHandler (§1.1.4.3).
  // Component reads via `iconsHandler.isDragFromDesktopActive` from
  // `onDrop` (the only remaining consumer).
  isDesktopTheCaller = true;
  showDesktopScreenShotPreview = false;
  showVolumeCntrl = false;
  showOverflowPane = false;
  // `confirmDelete` + `moveToRecycleBinOnDelete` moved to
  // DesktopIconFileOpsHandler (§1.1.4.5).

  dsktpPrevImg = Constants.EMPTY_STRING;
  slideState = 'slideOut';

  // `startVantaWaveColorChg` and the wave-color interval state moved to
  // DesktopBackgroundService (§1.1.2).

  dskTopCntxtMenuStyle:Record<string, unknown> = {};
  // Taskbar context-menu style + option moved to TaskbarMenuHandler (§1.1.3.3).
  // App-icon menu style moved to TaskbarMenuHandler (§1.1.3.2).
  // Preview window + tooltip styles moved to TaskbarMenuHandler (§1.1.3.1).

  deskTopMenuOption =  Constants.NESTED_MENU_OPTION;
  // All taskbar surfaces now live on TaskbarMenuHandler and the
  // template binds via `taskbarMenu.<field>`. Migrated state:
  //   §1.1.3.1 preview window + tooltip
  //   §1.1.3.2 app-icon menu
  //   §1.1.3.3 empty-area context menu, visibility flags, merge state
  // `menuOrder` moved to DesktopIconFileOpsHandler (§1.1.4.4).
  // Template binds via `iconFileOps.menuOrder`.

  // `showDesktopIconCntxtMenu` moved to DesktopIconFileOpsHandler
  // (§1.1.4.4). Template binds via `iconFileOps.showDesktopIconCntxtMenu`.
  showDesktopCntxtMenu = false;
  // `showTskBarCntxtMenu` moved to TaskbarMenuHandler (§1.1.3.3).

  // Preview window + tooltip timer ids moved to TaskbarMenuHandler
  // (§1.1.3.1) along with the methods that own them.
  // Clippy spawn/timer state was extracted to ClippyService (§1.1.1).
  // Color-change interval id moved to DesktopBackgroundService (§1.1.2).
  // `invalidCharTimeOutId` moved to DesktopIconFileOpsHandler (§1.1.4.5).

  private readonly DESKTOP_SCREEN_SHOT_DIRECTORY ='/Users/Pictures/Screen-Shots';
  private readonly TERMINAL_APP ="terminal";
  private readonly TEXT_EDITOR_APP ="texteditor";
  private readonly CODE_EDITOR_APP ="codeeditor";
  private readonly MARKDOWN_VIEWER_APP ="markdownviewer";
  private readonly SETTINGS_APP ="settings";
  // Deep-link payload for the settings app. These two literals must match
  // SettingsComponent.PERSONALIZATION_VIEW and .PERSONALIZATION_DESKTOP_BACKGROUND
  // respectively (the strings the settings app decodes). They are stable UI labels.
  private readonly SETTINGS_PERSONALIZE_VIEW ="Personalize";
  private readonly SETTINGS_PERSONALIZE_DESKTOP ="Desktop";
  private readonly TASK_MANAGER_APP ="taskmanager";
  // CLIPPY_APP moved into ClippyService (§1.1.1).
  private readonly PHOTOS_APP = "photoviewer";

  // Vanta config objects, lookup tables, picture list, walker constants,
  // current-index, and the in-flight switch guard moved to
  // DesktopBackgroundService (§1.1.2). Only the desktop-context-menu
  // delay constant remains here — it's used by menu-handling code, not
  // by the background subsystem.
  private readonly DESKTOP_MENU_DELAY = 250; //250ms
  // One render tick for Angular to paint a freshly-added desktop icon's
  // `*ngFor` row before we open its in-place rename textbox (§ auto-rename
  // on New Folder / New Text File).
  private readonly NEW_ICON_RENDER_DELAY = 60; //60ms

  readonly cheetahDsktpIconSortKey = 'cheetahDsktpIconSortKey';
  readonly cheetahDsktpIconSizeKey = 'cheetahDsktpIconSizeKey';
  readonly cheetahDsktpHideTaskBarKey = 'cheetahDsktpHideTaskBarKey';

  deskTopMenu:NestedMenu[] = [];
  // `taskBarContextMenuData` moved to TaskbarMenuHandler (§1.1.3.3).
  // `taskBarAppIconMenuData` moved to TaskbarMenuHandler (§1.1.3.2).

  // `isRenameActive` moved to DesktopIconFileOpsHandler (§1.1.4.5).
  // The icons-handler reads it via the `getIsRenameActive` closure
  // re-pointed in `ngOnInit`.
  // `isIconInFocusDueToPriorAction`, `isIconBtnClickEvt`,
  // `currIconId`, `prevIconId`, `iconBtnClickCnt`,
  // `isMultiSelectActive`,
  // `areMultipleIconsHighlighted`, `markedBtnIds`,
  // `multiSelectElmnt`, `multiSelectStartingPosition`, and
  // `desktopClickCounter` moved to DesktopIconsHandler (§1.1.4.2).
  // (`isMultiSelectEnabled` latch was removed entirely — see the
  // notes on `isMultiSelectActive` and `activateMultiSelect` in
  // DesktopIconsHandler.)
  // Component reads/writes the public ones via `iconsHandler.<field>`.

  isWindowDragActive = false;

  // `selectedFile` and `propertiesViewFile` moved to
  // DesktopIconFileOpsHandler (§1.1.4.4). Both PUBLIC on the
  // handler.
  private screenShot!:FileInfo;
  // `draggedElementId` moved to DesktopIconsHandler (§1.1.4.3).
  // `renameFileTriggerCnt` + `currentIconName` moved to
  // DesktopIconFileOpsHandler (§1.1.4.5) alongside the rename form.

  // `iconCntxtMenuStyle` moved to DesktopIconFileOpsHandler (§1.1.4.4).
  // Template binds via `iconFileOps.iconCntxtMenuStyle`.
  // Icon-size / shortcut / caption / btn styles + the GRID_SIZE /
  // ROW_GAP / MIN/MID/MAX grid constants moved to DesktopIconsHandler
  // (§1.1.4.1). Template binds via `iconsHandler.<field>`.

  SECONDS_DELAY:number[] = [6000, 250, 4000, 350];

  // VANTA_STYLE_STRIP_DELAY_MS moved to DesktopBackgroundService (§1.1.2).
  readonly RESTORE_PRIOR_OPEN_APPS_DELAY_MS = 4000; //4s
  // `renameForm` moved to DesktopIconFileOpsHandler (§1.1.4.5).
  // Template binds via `[formGroup]="iconFileOps.renameForm"`.

  // `desktopClickCounter`, `multiSelectElmnt`, `multiSelectStartingPosition`,
  // and `markedBtnIds` moved to DesktopIconsHandler (§1.1.4.2). Drag
  // state (`movedBtnIds`) moved to DesktopIconsHandler (§1.1.4.3).

  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;
  // `emptyTrashAudio` moved to DesktopIconFileOpsHandler (§1.1.4.5)
  // alongside `onEmptyRecycleBinHelper`, the only consumer.
  readonly systemNotificationAudio = `${Constants.AUDIO_BASE_PATH}cheetah_notify_system_generic.wav`;
  readonly shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;
  readonly cameraImg = `${Constants.IMAGE_BASE_PATH}camera.png`
  readonly closeImg = `${Constants.IMAGE_BASE_PATH}x_32.png`

  readonly screenShotText = `
  Screenshots are saved in the screenshots folder.
  Click on the image to view it in photos app.
  `;

  // `movedBtnIds` moved to DesktopIconsHandler (§1.1.4.3).
  // `files:FileInfo[]` moved to DesktopIconFileOpsHandler (§1.1.4.5).
  // Template's `*ngFor` binds via `iconFileOps.files`; the icons-
  // handler reads via the `getFiles` closure re-pointed in `ngOnInit`.

  // `sourceData` and `menuData` moved to DesktopIconFileOpsHandler
  // (§1.1.4.4). §1.1.4.5 collapsed the `setFileOpsActions` bridge
  // — every `sourceData` row now wires directly to a handler-owned
  // method.

  // `dsktpMngrMenuOption` moved to DesktopIconFileOpsHandler
  // (§1.1.4.4). Template binds via `iconFileOps.dsktpMngrMenuOption`.
  // `desktopBackgroundType` / `desktopBackgroundValue` moved to
  // DesktopBackgroundService (§1.1.2).

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'desktop';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  // `directory` moved to DesktopIconFileOpsHandler (§1.1.4.5). Read
  // via `iconFileOps.directory`.

  // #endregion

  // #region Constructor & Subscriptions

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService, 
              audioService:AudioService, menuService:MenuService, 
              fileService:FileService, windowService:WindowService, systemNotificationServices:SystemNotificationService,
              userNotificationService:UserNotificationService, activityHistoryService:ActivityHistoryService,
              defaultService: DefaultService, elRef:ElementRef, clippyService:ClippyService,
              backgroundService:DesktopBackgroundHandler, taskbarMenu:TaskbarMenuHandler,
              iconsHandler:DesktopIconsHandler, iconFileOps:DesktopIconFileOpsHandler,
              ngZone:NgZone, eSheepHandler:ESheepHandler){ 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = triggerProcessService;
    this._menuService = menuService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._eSheepHandler = eSheepHandler;
    this._systemNotificationServices = systemNotificationServices;
    this._userNotificationService = userNotificationService;
    this._activityHistoryService = activityHistoryService;
    this._defaultService = defaultService;
    this._elRef = elRef;
    this._clippyService = clippyService;
    this._desktopBackgroundHandler = backgroundService;
    this.taskbarMenu = taskbarMenu;
    this.iconsHandler = iconsHandler;
    this.iconFileOps = iconFileOps;
    // §3.A — see field-level comment on `_ngZone`.
    this._ngZone = ngZone;

    // these are subs, but the desktop cmpnt is not going to be destroyed
    this._menuService.showTaskBarAppIconMenu.pipe(concatMap((p) =>this.onShowTaskBarAppIconMenu(p))).subscribe();
    this._menuService.showTaskBarConextMenu.pipe(concatMap((p) =>this.onShowTaskBarContextMenu(p))).subscribe();
    this._audioService.showVolumeControlNotify.pipe(concatMap(() => this.showVolumeControl())).subscribe();
    this._menuService.showOverFlowMenu.pipe(concatMap(() => this.showSysTrayOverFlowPane())).subscribe();

    this._menuService.closeContextMenu.subscribe((ownerUId) => {
      if(ownerUId === this.name) // targeted: desktop owns every menu it renders
        this.resetIconBtnsAndContextMenus();
    });

    this._windowService.hideProcessPreviewWindowNotify.subscribe(() => { this.taskbarMenu.hidePreview(); });
    this._windowService.keepProcessPreviewWindowNotify.subscribe(() => { this.taskbarMenu.keepPreview(); });
    this._windowService.windowDragIsActive.subscribe(() => {this.isWindowDragActive = true;});
    this._windowService.windowDragIsInActive.subscribe(() => {this.isWindowDragActive = false;}); 
    this._audioService.hideVolumeControlNotify.subscribe(() => { this.hideVolumeControl()});
    this._windowService.showProcessPreviewWindowNotify.subscribe((p) => { this.taskbarMenu.showPreview(p); });

    this._fileService.dirFilesUpdateNotify.subscribe(async () =>{
      if(this._fileService.getEventOriginator() === this.name){
        await this.iconFileOps.loadFiles();
        this._fileService.removeEventOriginator();
      }
    });

    // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destroyed
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {
      this.desktopIsActive();
    })

    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {
      this.lockScreenIsActive();
    });

    // `_menuService.updateTaskBarContextMenu` is now subscribed inside
    // TaskbarMenuHandler (§1.1.3.3) since it only mutates state owned
    // by the handler.
    this._systemNotificationServices.showTaskBarToolTipNotify.subscribe((p)=>{this.taskbarMenu.showTooltip(p); });
    this._systemNotificationServices.hideTaskBarToolTipNotify.subscribe(() => {this.taskbarMenu.hideTooltip(); });

    this._defaultService.defaultSettingsChangeNotify.subscribe(async (p) => {
      try {
        if (p === Constants.DEFAULT_DESKTOP_BACKGROUND) {
          this._desktopBackgroundHandler.getDesktopBackgroundData();
          await this._desktopBackgroundHandler.setDesktopBackgroundData();
        }
        if (p === Constants.DEFAULT_AUTO_HIDE_TASKBAR) {
          this.taskbarMenu.setOrUpdateTaskBarVisibilityState();
        }
        if (p === Constants.DEFAULT_TASKBAR_COMBINATION) {
          this.taskbarMenu.setOrUpdateTaskBarCombinationState();
        }
      } catch (err) {
        console.error('defaultSettingsChangeNotify handler failed:', err);
      }
    });

    // The background subsystem emits this whenever a switch finishes (or
    // is a no-op at the bounds) and the caller's icon/context menus need
    // to be reset. Subject-based dispatch lets the service stay UI-agnostic
    // while still preserving the original "dropped, not queued" semantics
    // — the in-flight reject path deliberately does NOT emit (§1.1.2).
    this._desktopBackgroundHandler.menuResetNeeded$.subscribe(() => {
      this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    });

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  // #endregion

  // #region Lifecycle Hooks

  async ngOnInit():Promise<void>{
    this.uniqueId = `${this.name}-${this.processId}`;

    // §3-followup — bundle the desktop's singleton DOM refs FIRST so
    // we can hand them to the background handler BEFORE
    // `setDesktopBackgroundData()` runs.  Previously the background
    // handler was wired in `ngAfterViewInit`, which meant its
    // `vantaCntnr` getter returned `null` during the initial paint —
    // every if-block in `setDesktopBackgroundData` short-circuited
    // and the desktop never rendered its picture/color/dynamic
    // background until the user clicked "next background" (which
    // hits a different code path).  Safe to do here because all five
    // `@ViewChild` bindings use `static: true` and resolve in
    // `ngOnInit`.
    const rootElements: DesktopRootElements = this.getRootElements();
    this._desktopBackgroundHandler.init(rootElements);

    this._desktopBackgroundHandler.getDesktopBackgroundData();
    await this._desktopBackgroundHandler.setDesktopBackgroundData();

    // §1.4 — `rootElements` (hoisted above for the background
    // handler) is also handed to every other handler so the entire
    // desktop subsystem can resolve DOM nodes via @ViewChild instead
    // of `document.getElementById`.

    // Wire the icons handler's cross-cut callbacks BEFORE the first
    // `getDesktopMenuData()` call so the menu-rebuild + refresh +
    // sort callbacks are in place when any user toggle fires
    // (§1.1.4.1).
    //
    // §1.1.4.2 adds bridges for the selection logic: it needs to close
    // every other desktop surface on click (hideDesktopContextMenuAndOthers),
    // commit/abort the rename form (isFormDirty), read the rename-active
    // and window-drag-active flags, and clear the file-service drag
    // staging when a selection is wiped.
    //
    // §1.1.4.3 adds two accessor bridges for the drag pipeline
    // (uniqueId — the `${name}-${processId}` stamp used by the file
    // explorer to recognise desktop-originated drops, and the icon
    // list itself). The `correctMisalignedIcons` callback was RETIRED
    // here because `movedBtnIds` moved into the handler and
    // `autoAlignIcon` now invokes the alignment helper directly.
    //
    // §1.1.4.5 re-points four callbacks from the component to
    // `iconFileOps` (which now owns `files`, `refresh`, the rename
    // form, and `isRenameActive`). The iconsHandler is unchanged —
    // only the closure target moves.
    this.iconsHandler.init({
      refresh: (trueRefresh: boolean) => this.iconFileOps.refresh(trueRefresh),
      // §1.5 — lambda parameter tightened from `string` to `SortBys`
      // so the closure matches the handler's already-typed init shape
      // (`sortIcons: (sortBy: SortBys) => void`).  No runtime change.
      sortIcons: (sortBy: SortBys) => this.sortIcons(sortBy),
      rebuildDesktopMenu: () => this.getDesktopMenuData(),
      hideDesktopContextMenuAndOthers: (isDesktopTheCaller: boolean) =>
        this.hideDesktopContextMenuAndOthers(isDesktopTheCaller),
      isFormDirty: () => this.iconFileOps.isFormDirty(),
      getIsRenameActive: () => this.iconFileOps.isRenameActive,
      getIsWindowDragActive: () => this.isWindowDragActive,
      getIsStartMenuOpen: () => this._menuService.isStartMenuOpen,
      clearDragAndDropFile: () => this._fileService.removeDragAndDropFile(),
      getUniqueId: () => this.uniqueId,
      getFiles: () => this.iconFileOps.files,
      // Keyboard-navigation bridges. The icons handler resolves the
      // currently-focused icon to an index; the component aims the
      // file-ops action (open / rename / delete) at the matching
      // FileInfo. For rename and delete we set `iconFileOps.selectedFile`
      // first because both methods read it for the single-icon branch.
      // (Delete's multi-select branch ignores `selectedFile` and reads
      // `markedBtnIds` directly — setting it anyway is harmless.)
      onTriggerOpenForId: (id: number) => {
        const file = this.iconFileOps.files[id];
        if (file) this.runApplication(file);
      },
      onTriggerRenameForId: (id: number) => {
        const file = this.iconFileOps.files[id];
        if (file) {
          this.iconFileOps.selectedFile = file;
          this.iconFileOps.onRenameFileTxtBoxShow();
        }
      },
      onTriggerDeleteForId: (id: number) => {
        const file = this.iconFileOps.files[id];
        if (file) {
          this.iconFileOps.selectedFile = file;
          this.iconFileOps.onDelete();
        }
      },
      // §1.4 — singleton DOM refs, used by the multi-select pane,
      // icon-grid sizing, and drag-clone container.
      elements: rootElements,
    });

    // Wire the file-ops handler (§1.1.4.4 + §1.1.4.5). It owns the
    // icon context-menu, clipboard (Copy/Cut/Paste/Pin), shortcut
    // creation, `selectedFile` / `propertiesViewFile`, the icon
    // list (`files`), the rename form + flags, and the delete
    // user-pref flags.
    //
    // `runApplication` is the only remaining cross-cut callback —
    // it stays on the component because it touches the
    // process + audio + activity-history triad (desktop
    // orchestration). The handler forwards "Open" row clicks back
    // through this callback.
    //
    // §1.1.4.5 retired the `refresh` + `loadFiles` callbacks AND
    // the `setFileOpsActions` bridge entirely — the handler now
    // owns every action wired from `sourceData`.
    this.iconFileOps.init({
      runApplication: (file: FileInfo) => this.runApplication(file),
      // §1.4 — singleton DOM refs, used by the icon context-menu
      // bounds helper and the invalid-chars tooltip.
      elements: rootElements,
    });

    // §1.4 — the taskbar menu handler reads the desktop root height
    // when computing the temporary-show gutter; give it the same
    // ElementRef bundle the other handlers received.
    this.taskbarMenu.setRootElements(rootElements);

    this.getDesktopMenuData();
    this.taskbarMenu.initContextMenuData(this.openTaskManager.bind(this));
    this.taskbarMenu.setOrUpdateTaskBarVisibilityState();
    this.taskbarMenu.setOrUpdateTaskBarCombinationState();
  }

  async ngAfterViewInit():Promise<void>{
    // §3-followup — `_desktopBackgroundHandler.init(...)` was moved
    // to `ngOnInit` (BEFORE `setDesktopBackgroundData()`).  Leaving
    // the call here as well would re-stamp `_elements` with the same
    // refs and then re-evaluate `startVantaWaveColorChg`, which can
    // double-start the color walker on the wave background.  The
    // background subsystem still owns its color-walker interval
    // internally (§1.1.2) — the component just no longer drives it
    // from here.

    this._clippyService.init();

    // §3.A — register the desktop-root `mousemove` listener
    // imperatively, OUTSIDE Angular's zone.  The template no longer
    // carries `(mousemove)="performTasks($event)"` because doing so
    // forced a full change-detection cycle on every pixel of cursor
    // movement.  The common-case work in `performTasks` (resetting
    // the lock-screen timer via `Subject.next()`) does not need
    // change-detection at all.  The uncommon case (auto-hide
    // taskbar peek-show) re-enters the zone here so subscribers'
    // views still update.
    //
    // No teardown needed: the desktop cmpnt is the never-destroyed
    // root cmpnt (see existing comments in the constructor about
    // long-lived Subject subscriptions for the same reason).
    const vantaEl = this.desktopContainer.nativeElement;
    this._ngZone.runOutsideAngular(() => {
      vantaEl.addEventListener('mousemove', (evt: MouseEvent) => {
        if (this.taskbarMenu.isTaskBarHidden) {
          // Re-enter the zone so taskbar visibility subscribers tick.
          this._ngZone.run(() => this.performTasks(evt));
        } else {
          // Outside-zone fast path: no view-bound state changes.
          this.performTasks(evt);
        }
      });
    });

    //this._backgroundService.removeVantaJSSideEffect(); #TBD
    await CommonFunctions.sleep(this.SECONDS_DELAY[3]);
    await this.iconFileOps.loadFiles();
  }

  ngOnDestroy(): void {
    // Vanta effect tear-down is owned by DesktopBackgroundService (§1.1.2).
  }

  /**
   * Global keyboard shortcut handler. Listens at the window level (the desktop
   * is always present) so the shortcut works regardless of which surface has
   * focus. Currently handles:
   *   - Ctrl + Shift + V  → toggle the clipboard flyout.
   *   - Windows + V       → toggle the clipboard flyout (best-effort).
   *   - Ctrl + Shift + L  → lock the screen.
   *
   * NOTE: Windows + V is the OS-level Clipboard History shortcut. The operating
   * system intercepts it before the browser ever sees the event, so we cannot
   * reliably handle it (and `preventDefault()` has no effect on OS-reserved
   * hotkeys). Ctrl + Shift + V is the dependable, browser-capturable shortcut;
   * the Win + V branch is kept only for the rare cases where the event does
   * reach the page.
   */
  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(evt: KeyboardEvent): void {
    const isV = evt.key === 'v' || evt.key === 'V';
    const isL = evt.key === 'l' || evt.key === 'L';
    if (!isV && !isL) {
      return;
    }

    const ctrlShift = evt.ctrlKey && evt.shiftKey && !evt.altKey && !evt.metaKey;
    const winV = evt.metaKey;

    if (ctrlShift && isV || winV) {
      evt.preventDefault();
      this._processHandlerService.toggleClipboard();
    }

    if (ctrlShift && isL) {
      evt.preventDefault();
      const isScreenLocked = this._systemNotificationServices.getIsScreenLocked();
      if (isScreenLocked) return; // already locked, ignore the shortcut}
 
      this._systemNotificationServices.lockScreenNotify.next();
    }
  }

  /**
   * §1.4 — bundle the desktop's five singleton DOM refs (populated by
   * `@ViewChild`) into a typed `DesktopRootElements` snapshot for the
   * handlers and helpers.
   *
   * Private + invoked twice (once in `ngOnInit` for the handlers
   * wired there, once in `ngAfterViewInit` for the background
   * handler) — the call is cheap (object literal of five ElementRef
   * references) and keeping it as a method avoids stashing a field
   * we'd then have to keep in sync.
   */
  private getRootElements(): DesktopRootElements {
    return {
      vantaCntnr:             this.desktopContainer,
      desktopIconOl:          this.desktopIconOl,
      desktopIconCloneCntnr:  this.desktopIconCloneCntnr,
      multiSelectPane:        this.selectPaneContainer,
      invalidCharsToolTip:    this.invalidCharsToolTip,
    };
  }

  // #endregion

  // #region Desktop Background, Vanta & Colors
  // The entire background subsystem (Vanta lifecycle, picture cycling,
  // HSL color walker, switchBackground orchestration) was extracted into
  // DesktopBackgroundService in §1.1.2. See `./background/desktop.background.service.ts`.
  // #endregion

  // #region Random Helpers
  // (Clippy lifecycle was extracted to ClippyService in §1.1.1.)

  getRandomInt(min:number, max:number):number{
    return Math.floor(Math.random() * (max - min) + min);
  }

  // #endregion

  // #region Desktop Context Menu & Screenshot

  async showDesktopContextMenu(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    evt.preventDefault();

    // Children that render their own context menu (windows, taskbar) all
    // stopPropagation, so this handler only runs for genuine empty-desktop
    // right-clicks — no eventOriginator doubling guard needed anymore.
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

    const menuHeight = 306; //this is not ideal.. menu height should be gotten dynmically
    const menuWidth = 210;
    this.showDesktopCntxtMenu = true;

    // §1.4 — pass the desktop root ElementRef.nativeElement so the
    // helper doesn't have to `document.getElementById('vantaCntnr')`.
    const result = DesktopContextMenuHelper.checkAndHandleDesktopCntxtMenuBounds(evt, menuHeight, menuWidth, this.desktopContainer.nativeElement);
    const axis = result[0];
    this.isShiftSubMenuLeft = result[1];

    this.dskTopCntxtMenuStyle = {
      'position':'absolute',
      'width': '210px', 
      'transform':`translate(${String(axis.xAxis + 2)}px, ${String(axis.yAxis)}px)`,
      'z-index': Constants.Z_INDEX_DESKTOP_ICON_CONTEXT_MENU,
      'opacity': 1
    }

    this._menuService.openContextMenu(this.name); // desktop owns the open menu
    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
  }

  shiftViewSubMenu():void{ this.shiftNestedMenuPosition(0); }

  shiftSortBySubMenu():void{this.shiftNestedMenuPosition(1);  }

  shiftNewSubMenu():void { this.shiftNestedMenuPosition(8); }

  shiftNestedMenuPosition(i:number):void{
    const nestedMenu =  document.getElementById(`dmNestedMenu-${i}`) as HTMLDivElement;
    if(nestedMenu){
      if(this.isShiftSubMenuLeft){
        nestedMenu.style.left = '-98%';
      }
      else{
        nestedMenu.style.left = '98%';
      }
    }
  }

  async captureComponentImg(): Promise<void>{
    const storeImgDelay = 500; // .5 sec
    const slideOutDelay = 3000; // 3 secs
    const hideDesktopScreenShotDelay = 1000; // 1 secs
    const colorOff = 'transparent';
    const colorOn = '#00adef';

    await CommonFunctions.sleep(100) // sleep for a bit to let the cntxt menu dis-appear 

    try{
      // §1.4 — helpers now receive their target element from the
      // caller instead of looking it up via `document.getElementById`.
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOff, this.desktopContainer.nativeElement);
      //'#vanta > canvas'
      const dsktpCntnr = this.desktopContainer.nativeElement;
      const canvasElmnt = document.querySelector('.vanta-canvas') as HTMLCanvasElement;

      if(!dsktpCntnr){
        console.error('Desktop container or Vanta canvas not found.');
        return;
      }

      if(!canvasElmnt){
        console.warn('Vanta canvas not found. Skipping Vanta');
      }

      this.showDesktopScreenShotPreview = true;
      const finalImg = await this.mergeGeneratedImages(dsktpCntnr, canvasElmnt);
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOn, this.desktopContainer.nativeElement);

      this.slideState = 'slideIn';
      this.dsktpPrevImg = finalImg;

      await this._audioService.play(this.systemNotificationAudio);
      await CommonFunctions.sleep(storeImgDelay);
      await this.saveGeneratedImage(finalImg);

      await CommonFunctions.sleep(storeImgDelay);
      this._fileService.dirFilesUpdateNotify.next();

      await CommonFunctions.sleep(slideOutDelay);
      this.slideState = 'slideOut';

      await CommonFunctions.sleep(hideDesktopScreenShotDelay);
      this.showDesktopScreenShotPreview = false;

    }catch (err){
      console.error('Screenshot capture failed:', err);
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOn, this.desktopContainer.nativeElement);
      this.showDesktopScreenShotPreview = false;
    }
  }

  closeScreenShotPreview():void{
    this.showDesktopScreenShotPreview = false;
    this.screenShot = new FileInfo();
  }

  private async saveGeneratedImage(finalImg:string): Promise<void>{
    this.screenShot = new FileInfo();
    const timeStamp = DesktopGeneralHelper.getScreenShotTimeStamp();
    const fileName = `Screenshot ${timeStamp}.png`;
    this.screenShot.setFileName = fileName;
    this.screenShot.setCurrentPath = `${this.DESKTOP_SCREEN_SHOT_DIRECTORY}/${fileName}`;
    this.screenShot.setStringBuffer = finalImg;
    this.screenShot.setIconPath = finalImg;
    this.screenShot.setFileType = '.png';

    await this._fileService.writeFileAsync(this.DESKTOP_SCREEN_SHOT_DIRECTORY, this.screenShot);
    this.screenShot.setOpensWith = 'photoviewer';

    //###. if file explr is not running at the time of creation, this may be skipped 
    this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
  }

  private async mergeGeneratedImages(dsktpCntnr:HTMLElement, canvasElmnt:HTMLCanvasElement):Promise<string>{
    const htmlImg = await htmlToImage.toPng(dsktpCntnr);

    const vantaImg = new Image();
    if(canvasElmnt){
      const bkgrndImg =  canvasElmnt.toDataURL('image/png');
      vantaImg.src = bkgrndImg;
      await vantaImg.decode();
    }
  
    const foreGrndImg = new Image();
    foreGrndImg.src = htmlImg;
    await foreGrndImg.decode();

    const mergedImg = document.createElement('canvas');
    mergedImg.width = dsktpCntnr.offsetWidth;
    mergedImg.height = dsktpCntnr.offsetHeight; 

    const ctx = mergedImg.getContext('2d')!;
    if (!ctx) {
      console.error('Failed to get 2D rendering context.');
      return Constants.EMPTY_STRING;
    }

    // 1. Draw the Vanta background image first.
    if(canvasElmnt)
      ctx.drawImage(vantaImg, 0, 0, mergedImg.width, mergedImg.height);
    
    // 2. Draw the HTML content on top of the background.
    ctx.drawImage(foreGrndImg, 0, 0, mergedImg.width, mergedImg.height);
    ctx.imageSmoothingEnabled = true;

    return mergedImg.toDataURL('image/png');
  }

  // #endregion

  // #region File / Folder Creation, Menu Reset, Lock Screen & Auto-Show Taskbar

  async createFolder():Promise<void>{
    const folderName = Constants.NEW_FOLDER;
    const requestID = CommonFunctions.generateID(8);
    const result =  await this._fileService.createFolderAsync(Constants.DESKTOP_PATH, folderName, requestID);

    //if folder creation is successful, add it to the desktop icon list.
    //skipping the refresh of the desktop icon list to avoid flickering of the newly created folder icon
    if(result.ok){      
      //await this.iconFileOps.refresh();

      const trueFolderName = this._fileService.getFileOrFolderNameByRequestId(requestID);
      const trueFolderPath = `${Constants.DESKTOP_PATH}/${trueFolderName}`;
      const newFolder = await this._fileService.getFileInfoAsync(trueFolderPath);
     this.iconFileOps.addFileToFiles(newFolder);

     // Windows-style "New > Folder": drop the freshly created icon straight
     // into rename mode with its default name pre-selected/highlighted.
     await this.enterRenameModeForNewIcon(newFolder);
    }
  }

  /**
   * Put a newly-created desktop icon straight into in-place rename mode with
   * its default name pre-selected — mirrors the Windows "New > Folder /
   * Text Document" behaviour.
   *
   * Only fires when the desktop icons are actually visible ("Show desktop
   * icons" toggled on); when they're hidden the rename textbox has no
   * on-screen target, so we skip it.
   *
   * The icon was just pushed to `iconFileOps.files`, so it is the last entry;
   * its index is the id the template stamps onto `figCap{i}` /
   * `renameContainer{i}` / `renameTxtBox{i}`. We route selection through the
   * icons-handler's `executeIconClickTasks(id)` — the SAME entry point the
   * icon context-menu "Rename" uses — so the click-bookkeeping flags
   * (`isIconBtnClickEvt`, `iconBtnClickCnt`, `currIconId`, `markedBtnIds`)
   * are set identically. Without them `handleIconHighLightState()` can't
   * detect the "was renaming, then clicked empty desktop / another icon"
   * sequence and the icon gets stuck in rename mode. We then point
   * `selectedFile` at the new icon and wait one render tick for Angular to
   * paint the new `*ngFor` row before opening the textbox (the three DOM
   * elements above must exist for the textbox to show + focus + select).
   */
  private async enterRenameModeForNewIcon(newIcon:FileInfo):Promise<void>{
    if(!this.iconsHandler.showDesktopIcons)
      return;

    const newIconIndex = this.iconFileOps.files.length - 1;
    // Mirror the icon-context-menu rename path: set curr/prev icon ids,
    // the click flags, and the marked-buttons set so the icon can later
    // exit rename mode on a click-away.
    this.iconsHandler.executeIconClickTasks(newIconIndex);
    this.iconFileOps.selectedFile = newIcon;

    // let the new *ngFor row paint so figCap/renameContainer/renameTxtBox exist
    await CommonFunctions.sleep(this.NEW_ICON_RENDER_DELAY);
    this.iconFileOps.onRenameFileTxtBoxShow();
  }

  async createTextFile():Promise<void>{
    const fileName = Constants.NEW_TEXT_FILE;
    const requestID = CommonFunctions.generateID(8);

    const tmpTxtFile = new FileInfo();
    tmpTxtFile.setFileName = fileName
    tmpTxtFile.setStringBuffer = Constants.BLANK_SPACE;
    const result =  await this._fileService.writeFileAsync(Constants.DESKTOP_PATH, tmpTxtFile, requestID);

    //if file creation is successful, add it to the desktop icon list.
    //skipping the refresh of the desktop icon list to avoid flickering of the newly created file icon
    if(result){      
      //await this.iconFileOps.refresh();
      const trueFileName = this._fileService.getFileOrFolderNameByRequestId(requestID);
      const trueFilePath = `${Constants.DESKTOP_PATH}/${trueFileName}`;
      const newTxtFile = await this._fileService.getFileInfoAsync(trueFilePath);
      this.iconFileOps.addFileToFiles(newTxtFile);

     // Windows-style "New > Text Document": drop the freshly created icon
     // straight into rename mode with its default name pre-selected/highlighted.
     await this.enterRenameModeForNewIcon(newTxtFile);
    }
  }

  hideDesktopContextMenuAndOthers(isDesktopTheCaller:boolean):void{
    this.showDesktopCntxtMenu = false;
    this.iconFileOps.showDesktopIconCntxtMenu = false;
    this.taskbarMenu.hideAppIconMenu();
    this.taskbarMenu.hideContextMenu();
    this.isShiftSubMenuLeft = false;

    if(this.showVolumeCntrl){
      this.showVolumeCntrl = false;
      this._audioService.hideVolumeControlNotify.next(Constants.EMPTY_STRING);
    }

    if(this.showOverflowPane){
      this.showOverflowPane = false;
      this._menuService.hideOverFlowMenu.next(Constants.EMPTY_STRING);
    }

    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
    this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
    this._menuService.hideStartMenu.next();

    this.closePwrDialogBox();
    this.closeAppSelectionDialogBox();

    // Close whatever menu is open (a window's, if any). Skip our own id so the
    // targeted close doesn't bounce back into this method via the subscription.
    if(isDesktopTheCaller)
      this._menuService.closeAllContextMenus(this.name);
  }

  /**
   * Desktop-root mousemove handler.  Two responsibilities:
   *   1. Reset the lock-screen idle timeout (pure `Subject.next()` —
   *      no view-bound state changes).
   *   2. If the taskbar is in auto-hide mode AND the cursor is in
   *      the bottom gutter, peek-show it.
   *
   * §3.A — invoked imperatively from the `mousemove` listener
   * registered in `ngAfterViewInit` OUTSIDE Angular's zone.  The
   * common-case branch (taskbar not hidden) does zero view-bound
   * work, so we stay outside the zone and avoid a per-pixel
   * change-detection cycle.  Only when `isTaskBarHidden` is true do
   * we re-enter the zone (via the listener's `_ngZone.run`) so
   * subscribers to `showTaskBarNotify` / `hideTaskBarNotify` can
   * update their views.
   */
  performTasks(evt:MouseEvent):void{
    this.resetLockScreenTimeOut();

    if(this.taskbarMenu.isTaskBarHidden){
      this.taskbarMenu.showTaskBarTemporarily(evt);
    }
  }

  resetLockScreenTimeOut():void{
    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
  }

  closePwrDialogBox():void{
    const pId = this._systemNotificationServices.getPwrDialogPid();
    if(pId !== 0){
      this._userNotificationService.closeDialogMsgBox(pId);
    }
  }

  closeAppSelectionDialogBox():void{
    const pId = this._systemNotificationServices.getAppSelectionDialogPid();
    if(pId !== 0){
      this._userNotificationService.closeDialogMsgBox(pId);
    }
  }

  // `showTaskBarTemporarily` moved to TaskbarMenuHandler (§1.1.3.3).
  // The dead self-cancelling `setInterval(10ms)` helper that used to
  // accompany it was removed in §2.x and is documented in the handler.

  // #endregion

  // #region Volume Control & System Tray Overflow

  async showVolumeControl(): Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);
    this.showVolumeCntrl = true;
  }

  hideVolumeControl():void{
    this.showVolumeCntrl = false;
  }

  async showSysTrayOverFlowPane(): Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);
    this.showOverflowPane = true;
  }

  hideSysTrayOverFlowPane():void{
    this.showOverflowPane = false;
  }

  // #endregion

  // #region View / Sort / Arrange / Refresh / Icon Visibility

  // View-by, sort-by, auto-arrange / auto-align, and hide/show desktop
  // icon methods moved to DesktopIconsHandler (§1.1.4.1). The desktop's
  // right-click View / Sort By submenus call into the handler now.
  // `refresh()` moved to DesktopIconFileOpsHandler (§1.1.4.5) along
  // with the icon list (`files`) and `loadFiles`. The icons-handler
  // invokes refresh via the `refresh` callback re-pointed in
  // `ngOnInit` (`(trueRefresh) => this.iconFileOps.refresh(trueRefresh)`),
  // and the desktop-context-menu "Refresh" row is now bound directly
  // to `iconFileOps.refresh.bind(iconFileOps)`.

  // #endregion

  // #region Background Navigation & Vanta Switching

  /**
   * Step backwards through the background list. Thin wrapper around the
   * background service's `switchBackground(-1)` — kept here (instead of
   * binding the service method directly) because the context menu builds
   * its action with `.bind(this)` and rebinding to the service would also
   * require updating menu construction; the wrapper preserves binding.
   * Menu reset is fired from the service via `menuResetNeeded$` to keep
   * the "dropped, not queued" rapid-click semantics intact (§1.1.2).
   */
  async previousBackground():Promise<void>{
    await this._desktopBackgroundHandler.switchBackground(-1);
  }

  /** Step forwards through the background list. See `previousBackground`. */
  async nextBackground():Promise<void>{
    await this._desktopBackgroundHandler.switchBackground(+1);
  }

  // #endregion

  // #region App Launchers

  /**
   * Single orchestration point for "launch one of the well-known
   * desktop apps".  Pulls the descriptor from the pure helper, then
   * runs the two service-side steps the helper used to do itself:
   * activity tracking + process spawn (§1.1.5: helpers stay pure;
   * the service triad lives here).
   */
  private launchApp(appName: string, screenShot?: FileInfo): void {
    const desc = DesktopGeneralHelper.prepareAppLaunch(appName, screenShot);
    if (desc.activityToTrack) {
      CommonFunctions.trackActivity(this._activityHistoryService, desc.activityToTrack);
    }
    this._processHandlerService.runApplication(desc.file);
  }

  openTerminal():void{
    this.launchApp(this.TERMINAL_APP);
  }

  openTextEditor():void{
    this.launchApp(this.TEXT_EDITOR_APP);
  }

  async createAppShortCut():Promise<void>{
    const appName = await this._userNotificationService.showCreateShortcutNotification();

    if(!appName) return;

    const shortcut = new FileInfo();
    shortcut.setFileName = appName.at(0)?.toUpperCase() + appName.slice(1);
    shortcut.setCurrentPath = `${Constants.DESKTOP_PATH}/${appName}${Constants.URL}`;
    shortcut.setFileType = Constants.URL;
    shortcut.setFileExtension = Constants.URL;
    shortcut.setIconPath =  this._fileService.getAppAssociaton(appName);
    console.log('createAppShortCut shortcut IconPath:', this._fileService.getAppAssociaton(appName));
    shortcut.setOpensWith = appName;
    shortcut.setIsFile = true;

    await this.iconFileOps.createShortCut(shortcut);
  }

  openMarkDownViewer():void{
    this.launchApp(this.MARKDOWN_VIEWER_APP);
  }

  /**
   * Deep-link: open Settings straight to Personalization > Desktop, skipping the
   * Home tile + sidebar clicks. Encodes the target as "<view>:<option>" in the
   * trigger's contentPath and marks it a deep-link via currentPath. Works whether
   * Settings is closed (cold start, read in ngOnInit) or already open (single-
   * instance re-launch fires changeProcessContentNotify). Built inline + launched
   * directly (not via launchApp) because it needs a custom FileInfo payload.
   */
  openPersonalizationSettings():void{
    const file = new FileInfo();
    file.setOpensWith = this.SETTINGS_APP;               // route to the settings app
    file.setCurrentPath = Constants.SETTINGS_DEEP_LINK;  // mark as a deep-link launch
    file.setContentPath =
      `${this.SETTINGS_PERSONALIZE_VIEW}${Constants.COLON}${this.SETTINGS_PERSONALIZE_DESKTOP}`;
    this._processHandlerService.runApplication(file);
  }

  openTaskManager():void{
    this.launchApp(this.TASK_MANAGER_APP);
  }

  async openPhotos(): Promise<void>{
    const delay = 1000; //1 sec
    this.showDesktopScreenShotPreview = false;
    await CommonFunctions.sleep(delay);
    this.launchApp(this.PHOTOS_APP, this.screenShot);
  }

  // #endregion

  // #region Menu Builders & Taskbar Menu Actions

  buildViewByMenu():NestedMenuItem[]{

    // View-by toggles + visibility live on DesktopIconsHandler (§1.1.4.1).
    // Re-bind their `this` to the handler so the menu helpers can invoke
    // them as bare callbacks without losing context.
    //
    // §1.3: the three view-by checkmarks are derived inline from the
    // single `iconSize` enum field on the handler (the 3-boolean cluster
    // it replaced).  The helper signature stays boolean-based so it
    // remains a generic menu-builder — we do the enum→bool projection
    // here, at the only call site.
    const h = this.iconsHandler;
    const funct = (h.showDesktopIcons) ? h.hideDesktopIcon.bind(h) : h.showDesktopIcon.bind(h);
    const viewByMenu = DesktopGeneralHelper.handleBuildViewByMenu(
      h.viewBySmallIcon.bind(h),  h.iconSize === IconsSizes.SMALL_ICONS,
      h.viewByMediumIcon.bind(h), h.iconSize === IconsSizes.MEDIUM_ICONS,
      h.viewByLargeIcon.bind(h),  h.iconSize === IconsSizes.LARGE_ICONS,
      h.autoArrangeIcon.bind(h),  h.autoArrangeIcons,
      h.autoAlignIcon.bind(h),    h.autoAlignIcons,
      funct,                      h.showDesktopIcons);

    return viewByMenu;
  }

  buildSortByMenu(): NestedMenuItem[]{

    // Sort-by toggles live on DesktopIconsHandler (§1.1.4.1).  Same
    // rebinding pattern as `buildViewByMenu` above.
    //
    // §1.3: derived inline from the single `sortBy` enum field on the
    // handler (the 4-boolean cluster it replaced).  Initial state
    // (`sortBy === null`) leaves every checkmark off, matching the
    // prior all-booleans-false initial behaviour.
    const h = this.iconsHandler;
    const sortByMenu = DesktopGeneralHelper.handleBuildSortByMenu(
      h.sortByNameM.bind(h),         h.sortBy === SortBys.NAME,
      h.sortBySizeM.bind(h),         h.sortBy === SortBys.SIZE,
      h.sortByItemTypeM.bind(h),     h.sortBy === SortBys.ITEM_TYPE,
      h.sortByDateModifiedM.bind(h), h.sortBy === SortBys.DATE_MODIFIED);

    return sortByMenu
  }

  // Context-menu row builders (showTheDesktop, resetMenuOption,
  // showOpenWindows, hide/showTheTaskBar, merge/unMergeTaskBarButton)
  // moved to TaskbarMenuHandler (§1.1.3.3).

  buildNewMenu(): NestedMenuItem[]{
    const newFolder:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action: this.createFolder.bind(this),  variables:true , 
      emptyline:false, styleOption:'C'}

    const textEditor:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}text_file.png`, label:'Text File',  action:this.createTextFile.bind(this),  variables:true , 
      emptyline:false, styleOption:'C'}

    const shortcut:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}shortcut.png`, label:'Shortcut',  action: this.createAppShortCut.bind(this),  variables:true , 
        emptyline:false, styleOption:'C'}

    const sortByMenu = [newFolder, textEditor, shortcut ]

    return sortByMenu;
  }

  getDesktopMenuData():void{
    const empty = Constants.EMPTY_STRING;
    this.deskTopMenu = [
        {icon1:empty,  icon2:empty, label:MenuAction.VIEW, nest:this.buildViewByMenu(), action: ()=>empty, action1: this.shiftViewSubMenu.bind(this), emptyline:false},
        {icon1:empty,  icon2:empty, label:MenuAction.SORTBY, nest:this.buildSortByMenu(), action: ()=>empty, action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
        {icon1:empty,  icon2:empty, label: MenuAction.REFRESH, nest:[], action:this.iconFileOps.refresh.bind(this.iconFileOps), action1: ()=> empty, emptyline:true},
        {icon1:empty,  icon2:empty, label: MenuAction.PASTE, nest:[], action:this.iconFileOps.onPaste.bind(this.iconFileOps), action1: ()=> empty, emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}terminal.png`, icon2:empty, label:MenuAction.OPEN_IN_TERMINAL, nest:[], action: this.openTerminal.bind(this), action1: ()=> '', emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}camera.png`, icon2:empty, label:MenuAction.SCREEN_SHOT, nest:[], action: this.captureComponentImg.bind(this), action1: ()=> '', emptyline:false},
        {icon1:empty,  icon2:empty, label:MenuAction.NEXT_BACKGROUND, nest:[], action: this.nextBackground.bind(this), action1: ()=> empty, emptyline:false},
        {icon1:empty,  icon2:empty, label:MenuAction.PREVIOUS_BACKGROUND, nest:[], action: this.previousBackground.bind(this), action1: ()=> empty, emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}personalize.png`, icon2:empty, label:MenuAction.PERSONALIZE, nest:[], action: this.openPersonalizationSettings.bind(this), action1: ()=> empty, emptyline:true},
        {icon1:empty,  icon2:empty, label:MenuAction.NEW, nest:this.buildNewMenu(), action: ()=> empty, action1: this.shiftNewSubMenu.bind(this), emptyline:true},
        {icon1:`${Constants.IMAGE_BASE_PATH}esheep.png`,  icon2:empty, label: this._eSheepHandler.isActive ? MenuAction.STOP_ESHEEP : MenuAction.START_ESHEEP, nest:[], action: this.toggleESheep.bind(this), action1: ()=> empty, emptyline:false},
        {icon1:empty,  icon2:empty, label:MenuAction.MANY_THANKS, nest:[], action: this.openMarkDownViewer.bind(this), action1: ()=> empty, emptyline:false}
      ]
  }

  /**
   * Desktop context-menu action: toggle the eSheep desktop pet on/off.
   * Rebuilds the menu afterwards so the row flips between
   * 'Start eSheep' and 'Stop eSheep' to match the new state.
   */
  async toggleESheep():Promise<void>{
    try{
      await this._eSheepHandler.toggle();
    }catch(err){
      console.error('toggleESheep failed', err);
    }
    this.getDesktopMenuData();
  }

  // `getTaskBarContextData` moved to TaskbarMenuHandler (§1.1.3.3)
  // as `initContextMenuData`. The handler is given the
  // `openTaskManager` launcher because Task Manager is the one row
  // the handler cannot self-service (launching apps requires desktop
  // state).

  // buildVantaEffect() moved to DesktopBackgroundService (§1.1.2).

  resetIconBtnsAndContextMenus(isDesktopTheCaller = false):void{
    this.hideDesktopContextMenuAndOthers(isDesktopTheCaller);

    // Don't wipe the icon-selection bookkeeping while a rename is in flight.
    // `btnStyleAndValuesReset` clears `currIconId` + the click flags AND calls
    // `removeBtnStyle(currIconId)`, which does `figCap.style.removeProperty('display')`
    // — un-hiding the caption the rename textbox replaced. This method is now
    // reached mid-rename because selecting "Rename" from the icon context menu
    // triggers `MenuComponent.onMenuItemClick` → `closeAllContextMenus()` →
    // the desktop's `closeContextMenu` subscription. The old menu design
    // dismissed via a click that bubbled to `handleIconHighLightState`, which
    // already guards this same reset with `if(!getIsRenameActive())`; we mirror
    // that guard here so the caption stays hidden and the icon keeps the
    // curr-id + click flags that click-away needs to commit/cancel the rename.
    if(!this.iconFileOps.isRenameActive)
      this.iconsHandler.btnStyleAndValuesReset();
  }

  // #endregion

  // #region Taskbar App Icon & Context Menus

  /**
   * Bridge from the menu-service Subject (`showTaskBarAppIconMenu`) to
   * the handler that actually owns the menu state (§1.1.3.2). This thin
   * orchestrator stays on the component because:
   *   - It triggers a desktop-wide reset (`resetIconBtnsAndContextMenus`)
   *     that closes ALL menus, not just the taskbar's.
   *   - The DESKTOP_MENU_DELAY sleep is a desktop-level concern (it
   *     lets prior reset propagate before drawing the new menu) and is
   *     shared by `onShowTaskBarContextMenu` as well.
   * Once the reset is done, control passes to the handler.
   */
  async onShowTaskBarAppIconMenu(data:unknown[]): Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

    const rect = data[0] as DOMRect;
    const tskBarIcon = data[1] as TaskBarIconInfo;
    this.taskbarMenu.openAppIconMenu(rect, tskBarIcon);
    this._menuService.openContextMenu(this.name); // desktop owns the open menu
  }

  /**
   * Thin orchestrator: desktop-wide reset + DESKTOP_MENU_DELAY sleep,
   * then delegate to the handler. The bounds-checker (in
   * DesktopContextMenuHelper) returns `isShiftSubMenuLeft`, which is a
   * DESKTOP-level flag shared with the desktop's own right-click menu
   * (which has nested submenus that need the shift). The handler
   * returns it from `openContextMenu` so we can keep that flag in sync
   * without leaking desktop concerns into the handler.
   */
  async onShowTaskBarContextMenu(evt:MouseEvent):Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);
    this.isShiftSubMenuLeft = this.taskbarMenu.openContextMenu(evt);
    this._menuService.openContextMenu(this.name); // desktop owns the open menu
  }

  // hide/showTaskBarContextMenu wrappers removed — callers now use
  // `this.taskbarMenu.hideContextMenu()` directly (no extra indirection).

  // App-icon menu helpers (`switchBetweenPinAndUnpin`,
  // `countInstaceAndSetMenu`) and action handlers
  // (`initApplicationFromTaskBar`, `closeApplicationFromTaskBar`,
  // `pinApplicationFromTaskBar`, `unPinApplicationFromTaskBar`) all
  // moved to TaskbarMenuHandler (§1.1.3.2).

  // #endregion

  // #region Taskbar Preview Window & Tooltip

  // Preview window + tooltip logic moved to TaskbarMenuHandler (§1.1.3.1).
  // The handler owns: timing constants (350/100/300/1000/5000 ms),
  // timer ids, the previous-app debounce, the appIconMenuShouldHide$
  // cross-cut, and all positioning math. See
  // ./taskbar-menu/taskbar.menu.handler.ts.

  // #endregion

  // #region Drag & Drop / File Loading

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    event.stopPropagation();
  
    const dragInfo = this._systemNotificationServices.getDragEventInfo();
    if(dragInfo && dragInfo.origin.includes(Constants.FILE_EXPLORER)){
      const files = this._fileService.getDragAndDropFile();
      if (!files?.length) return;

      const delay = 50; //50ms
      const destPath = this.iconFileOps.directory;

      // Use allSettled (not all) so we get per-file outcomes \u2014 either a
      // resolved boolean from moveAsync (true=ok, false=service-level
      // failure) or a rejection if moveAsync ever throws. With Promise.all
      // a single rejection collapses every other result, hiding which
      // files actually moved \u2014 fatal for "what's the UI supposed to
      // show now?" decisions.
      const moveOutcomes = await Promise.allSettled(
        files.map(f => this._fileService.moveAsync(f.getCurrentPath, destPath, f.getIsFile))
      );

      const succeededFiles: typeof files = [];
      const failedFiles: typeof files = [];
      moveOutcomes.forEach((outcome, i) => {
        const file = files[i];
        if(outcome.status === 'fulfilled' && outcome.value === true){
          succeededFiles.push(file);
        }else{
          failedFiles.push(file);
        }
      });

      // IMPORTANT: clear drag state BEFORE any refresh / further awaits so
      // we don't leak it if something below throws. The previous version
      // skipped this entirely on the failure path \u2014 the drag info would
      // stick around and contaminate the next drop.
      this._systemNotificationServices.removeDragEventInfo();

      // Notify the file explorer + refresh the desktop only if SOMETHING
      // actually moved. The view has to match reality \u2014 hiding a partial
      // move from the UI is the worst possible outcome (the user can no
      // longer reason about where their files are).
      if(succeededFiles.length > 0){
        //I am using the ! to denote anything not containing /user/Desktop in its path, is from the file explr
        const cameFromFileExplr = succeededFiles.some(f => !f.getCurrentPath.includes(Constants.DESKTOP_PATH));
        if(cameFromFileExplr){
          this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
          this._fileService.dirFilesUpdateNotify.next();
          await CommonFunctions.sleep(delay);
        }
        await this.iconFileOps.refresh();
      }

      // Surface partial / total failure to the user. We don't try to roll
      // back the successful moves: that would itself partial-fail, and it
      // would undo work the user explicitly asked for. Better to tell the
      // truth about what happened.
      if(failedFiles.length > 0){
        const sampleNames = failedFiles.slice(0, 3).map(f => f.getFileName).join(', ');
        const moreSuffix = failedFiles.length > 3 ? `, +${failedFiles.length - 3} more` : Constants.EMPTY_STRING;

        const title = (succeededFiles.length === 0) ? DialogTitle.FILE_SVC_MOVE_FAILED : DialogTitle.FILE_SVC_MOVE_INCOMPLETE;
        const msg = DialogMessage.FILE_SVC_MOVE_INCOMPLETE_OR_FAILED
            .replace(DialogMessage.placeholder, `${failedFiles.length}`)
            .replace(DialogMessage.placeholder1, `${files.length}`)
            .replace(DialogMessage.placeholder2, sampleNames)
            .replace(DialogMessage.placeholder3, moreSuffix);
            
        console.error('onDrop partial/total failure:', { failed: failedFiles.map(f => f.getCurrentPath) });
        this._userNotificationService.showErrorNotification(msg, title);
      }
      return;
    }

    if(!CommonFunctions.conditionalDrop(event) && this.iconsHandler.isDragFromDesktopActive){
      console.warn('Drop failed due to condition.');
      return;
    }else{
      const droppedFiles:File[] = [];
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        droppedFiles.push(...files);
      }
      
      if(droppedFiles.length >= 1){
        const result =  await this._fileService.writeFilesAsync(this.iconFileOps.directory, droppedFiles);
        if(result){
          await this.iconFileOps.refresh();
        }
      }
    }
  }

  // `loadFiles()` moved to DesktopIconFileOpsHandler (§1.1.4.5).
  // Component subscribers (dirFilesUpdateNotify) and the prior-app
  // restorer call `this.iconFileOps.loadFiles()` directly.

  // removeVantaJSSideEffect() moved to DesktopBackgroundService (§1.1.2).

  // #endregion

  // #region Desktop Icon: Run / Click / Context Menu / Properties

  async runApplication(file:FileInfo):Promise<void>{
    console.log('DesktopIconFileOpsHandler.onTriggerRunApplication', file);
    await this._audioService.play(this.cheetahNavAudio);
    CommonFunctions.handleTracking(this._activityHistoryService, file);
    this._processHandlerService.runApplication(file);
    this.iconsHandler.btnStyleAndValuesReset();
  }

  /**
   * §3.B — `trackBy` for the icon `*ngFor` in the template.  Pins
   * each `<li>` to a stable identity (`${currentPath}|${fileName}`)
   * so Angular reuses the per-icon DOM subtree (img + form +
   * textarea + 4 styled containers) across `loadFiles()`,
   * `sortIcons()`, `removeDeletedFiles()`, and rename refreshes
   * instead of tearing it down and rebuilding from scratch.  The
   * composite key handles same-named files in different folders
   * (the desktop can hold both via shortcuts).
   */
  trackByDesktopIcon = (_: number, file: FileInfo): string =>
    `${file.getCurrentPath}|${file.getFileName}`;

  onDesktopIconClick(evt:MouseEvent, id:number):void{
    // Click handling is owned by DesktopIconsHandler (§1.1.4.2). The
    // template still calls `onDesktopIconClick` so existing per-icon
    // bindings keep working; this thin wrapper just forwards.
    this.iconsHandler.onDesktopIconClick(evt, id);
  }

  // `onTriggerRunApplication`, `onShowDesktopIconCntxtMenu`,
  // `showPropertiesWindow`, `doNothing` moved to
  // DesktopIconFileOpsHandler (§1.1.4.4). `runApplication` stays here
  // because it touches process + audio + activity-history services
  // (desktop orchestration), and the handler forwards `Open` row
  // clicks via the `runApplication` init() callback.

  // #endregion

  // #region Clipboard (Cut / Copy / Paste / Pin)

  // All clipboard methods (`onCopy`, `onCut`, `onPaste`,
  // `pinIconToTaskBar`) moved to DesktopIconFileOpsHandler
  // (§1.1.4.4). The handler self-services the menu rows via its
  // `sourceData` actions; no template binding changes were needed
  // for these (they were never directly bound from the template).

  // #endregion

  // #region Mouse Hover / Multi-Select / Icon Highlight State

  // All hover / click / multi-select / lasso state and methods moved to
  // DesktopIconsHandler (§1.1.4.2). The template binds directly to
  // `iconsHandler.<method>` for the events, except `onDesktopIconClick`
  // which keeps a thin wrapper above (so the icon-click forwarding stays
  // co-located with `runApplication` / `onShowDesktopIconCntxtMenu`).

  // #endregion

  // #region Drag Source Handlers & Icon Position Moves

  // All drag-source state (`isDragFromDesktopActive`,
  // `draggedElementId`, `movedBtnIds`) and methods (`onDragOver`,
  // `onDragStart`, `onDragEnd`, `moveBtnIconsToNewPositionAlignOff/On`)
  // moved to DesktopIconsHandler (§1.1.4.3). The template binds the
  // (dragover) / (dragstart) / (dragend) events directly to
  // `iconsHandler.<method>`. (drop) stays on the component because
  // `onDrop` does heavy file-service orchestration that migrates
  // with the file-ops handler in §1.1.4.5.

  // #endregion

  // #region Icon Sort & Size Helpers

  // §1.5 — parameter tightened from `string` to `SortBys`.  All four
  // callers (`sortByNameM/SizeM/ItemTypeM/DateModifiedM` on the icons
  // handler) already pass `SortBys.*` members, and the downstream
  // `CommonFunctions.sortIconsBy(files, sortBy: string)` still accepts
  // the underlying string literal because `SortBys` is a string enum.
  sortIcons(sortBy: SortBys): void {
    this.iconFileOps.files = CommonFunctions.sortIconsBy(this.iconFileOps.files, sortBy);
  }

  // `changeIconsSize` + `changeGridRowColSize` moved to
  // DesktopIconsHandler (§1.1.4.1). They mutate the icon-size / grid
  // styles which now live on the handler.

  // #endregion

  // #region Delete / Recycle Bin / Shortcut

  // `onDelete`, `removeDeletedFiles`, `onEmptyRecycleBin`,
  // `onEmptyRecycleBinHelper`, `onConfirmDelete`, and
  // `onDeleteMoveToRecycleBin` moved to DesktopIconFileOpsHandler
  // (§1.1.4.5) alongside the icon list (`files`) and the delete
  // user-pref flags. The context-menu rows wire directly to the
  // handler.

  async createShortCut(): Promise<void>{
    // Thin wrapper kept for any external/test callers; the menu row
    // is wired directly to the handler. Forwards to the handler so
    // there's one implementation.
    await this.iconFileOps.createShortCut();
  }

  // `createShortCutHelper` moved to DesktopIconFileOpsHandler
  // (§1.1.4.4).

  // #endregion

  // #region Rename

  // `onInputChange`, `isFormDirty`, `onRenameFileTxtBoxShow`,
  // `onRenameFileTxtBoxDataSave`, and `onRenameFileTxtBoxHide`
  // moved to DesktopIconFileOpsHandler (§1.1.4.5) alongside the
  // rename form (`renameForm`), the rename flags
  // (`isRenameActive`, `currentIconName`, `renameFileTriggerCnt`,
  // `invalidCharTimeOutId`), and the filename allow-list regex.
  // The template's `(ngSubmit)` / `(keydown)` events now bind
  // directly to `iconFileOps.*`. The icons-handler reads
  // `isFormDirty` + `getIsRenameActive` via the closures
  // re-pointed in `ngOnInit`.

  // #endregion

  // #region Activation / Session Restore / Default Settings Application

  async restorePriorOpenApps(): Promise<void>{
    const raiseEvent = false;
    const restorePriorOpenedApps = this._defaultService.getDefaultSetting(Constants.DEFAULT_RESTORE_USER_OPENED_APPS);
    if(restorePriorOpenedApps === Constants.FALSE)
      return;

    // Read-only check: have we already restored this session?
    const isPriorOpenedAppsRestored = this._defaultService.getDefaultSetting(Constants.DEFAULT_IS_USER_OPENED_APPS_RESTORED);
    if(isPriorOpenedAppsRestored === Constants.TRUE)
      return;

    this._processHandlerService.fetchPriorSessionInfo();

    console.log('check for apps re-open......');
    await CommonFunctions.sleep(this.RESTORE_PRIOR_OPEN_APPS_DELAY_MS);
    this._processHandlerService.checkAndRestore();

    // Persist the restored flag directly. Previously the local variable
    // was reassigned to Constants.TRUE before this call, but it was never
    // read again \u2014 a misleading "looks like state, isn't" pattern. Pass
    // the literal so the intent is obvious.
    this._defaultService.updateDefaultData(Constants.DEFAULT_IS_USER_OPENED_APPS_RESTORED, Constants.TRUE, raiseEvent);
  }
  

  lockScreenIsActive():void{
    this._clippyService.stop();
    this._eSheepHandler.stop();
    this.getDesktopMenuData();
    this.iconsHandler.hideDesktopIcon(); 
    this.hideVolumeControl();
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    this.taskbarMenu.hidePreview();
    this.taskbarMenu.hideTooltip();
    this.closePwrDialogBox();
    this.closeAppSelectionDialogBox
  }

  desktopIsActive():void{
    this.iconsHandler.showDesktopIcon();

    // `restorePriorOpenApps` is async, but we DELIBERATELY do not await
    // it here for two reasons:
    //   1. This method is fired from a subscriber callback that doesn't
    //      await its handler — there's no caller to surface a returned
    //      promise to anyway.
    //   2. Restoring prior-session apps may take several seconds
    //      (it awaits `SECONDS_DELAY[2]` = 4000ms internally), and we
    //      don't want to block the desktop becoming interactive on it.
    // The `void` prefix makes the intent explicit ("yes, I know this
    // returns a promise; yes, I'm ignoring it on purpose") and silences
    // `no-floating-promises` lint rules. The `.catch` guarantees any
    // rejection inside the restoration pipeline surfaces as a console
    // error instead of an unhandled-promise-rejection warning that the
    // user has no way to act on.
    void this.restorePriorOpenApps().catch(err => {
      console.error('desktopIsActive: restorePriorOpenApps failed', err);
    });

    //this._clippyService.start();
  }

  // setDesktopBackgroundData() moved to DesktopBackgroundService (§1.1.2).

  // setOrUpdateTaskBarVisibilityState + setOrUpdateTaskBarCombinationState
  // moved to TaskbarMenuHandler (§1.1.3.3).

  // #endregion

  // #region Component Metadata

  private getComponentDetail():Process{
    Constants.D = CommonFunctions.computeNoiseBasedValue();
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  // #endregion
}