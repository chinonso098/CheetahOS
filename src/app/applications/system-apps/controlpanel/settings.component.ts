import { Component, Input, OnInit, AfterViewInit,  OnDestroy, HostListener, HostBinding, ElementRef, ViewChild } from '@angular/core';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';

import { FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as htmlToImage from 'html-to-image';
import {basename, extname} from 'path';


import { AppDirectory } from 'src/app/system-files/app.directory';
import { ScreenshotSetting, SettingsMenuOption } from './settings.interface';
import { SettingsHelper } from './settings.helper';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';



@Component({
  selector: 'cos-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class SettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('settingsContainer', {static: true}) settingsContainer!: ElementRef; 
  @Input() priorUId = Constants.EMPTY_STRING;


  // Local-disk icon shown in the System > Storage pane.
  readonly storageDiskImg = `${Constants.IMAGE_BASE_PATH}os_disk_1.png`;

  readonly HOME_VIEW = 'Home';
  readonly SYSTEM_VIEW = 'System';
  readonly SYSTEM_VIEW_EXTRA = 'Screen, sound, notification'
  readonly APPS_VIEW = 'Apps';
  readonly APPS_VIEW_EXTRA = 'Uninstall, default, optional features';
  readonly PERSONALIZATION_VIEW = 'Personalize';
  readonly PERSONALIZATION_VIEW_EXTRA = 'Background, lock screen, colors';
  // The settings panel currently shown (Home / System / Apps / Personalize).
  // Mutable navigation state, not a constant.
  currentView = this.HOME_VIEW;

  readonly HOME_HOME = 'Home';

  readonly SYSTEM_ABOUT = 'About';
  readonly SYSTEM_NOTIFICATION = 'Notifications & actions';
  readonly SYSTEM_STORAGE = 'Storage';
  readonly SYSTEM_SCREEN = 'Screen';
  readonly SYSTEM_CLIPBOARD = 'Clipboard';

  // The Apps panel currently has a single sub-pane.
  readonly APPS_FEATURES = 'Apps & features';

  readonly PERSONALIZATION_DESKTOP_BACKGROUND = 'Desktop';
  readonly PERSONALIZATION_LOCKSCREEN = 'Lock screen';
  readonly PERSONALIZATION_TASKBAR = 'Taskbar';
  readonly PERSONALIZATION_COLORS = 'Colors';

  readonly THEME_DARK = Constants.THEME_DARK;
  readonly THEME_LIGHT = Constants.THEME_LIGHT;

  readonly LOCKSCREEN_BACKGROUND_PICTURE = Constants.BACKGROUND_PICTURE;
  readonly LOCKSCREEN_BACKGROUND_SOLID_COLOR = Constants.BACKGROUND_SOLID_COLOR;
  readonly LOCKSCREEN_BACKGROUND_MIRROR = Constants.BACKGROUND_MIRROR;
  readonly LOCKSCREEN_SLIDE_SHOW = Constants.BACKGROUND_SLIDE_SHOW;

  readonly DESKTOP_BACKGROUND_PICTURE = Constants.BACKGROUND_PICTURE;
  readonly DESKTOP_BACKGROUND_SOLID_COLOR = Constants.BACKGROUND_SOLID_COLOR;
  readonly DESKTOP_BACKGROUND_SLIDE_SHOW = Constants.BACKGROUND_SLIDE_SHOW;
  readonly DESKTOP_BACKGROUND_DYNAMIC = Constants.BACKGROUND_DYNAMIC;

  readonly SLIDE_SHOW_COLOR = Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR;
  readonly SLIDE_SHOW_PICTURE = Constants.BACKGROUND_SLIDE_SHOW_PICTURE;

  readonly TASKBAR_COMBINATION_NEVER = Constants.TASKBAR_COMBINATION_NEVER;
  readonly TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS = Constants.TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS;

  readonly SCREEN_SAVER_VIDEO = Constants.SCREEN_SAVER_VIDEO;
  readonly SCREEN_SAVER_DYNAMIC = Constants.SCREEN_SAVER_DYNAMIC;

  readonly CAPTURE_VANTA_BACKGROUND_ONLY = 1;
  readonly CAPTURE_COLOR_BACKGROUND_ONLY = 2;
  readonly CAPTURE_FOREGROUND_ONLY = 3;
  readonly MERGE_BACKGROUND_AND_FOREGROUND = 4;

  lockScreenBkgrndOption = Constants.EMPTY_STRING;
  lockScreenSlideShowOption = Constants.EMPTY_STRING;
  lockScreenTimeoutOption = Constants.EMPTY_STRING;
  desktopBkgrndOption = Constants.EMPTY_STRING;
  taskBarPositionOption = 'Bottom';
  taskBarCombinationOption = Constants.EMPTY_STRING;
  screenSaverTypeOption = Constants.EMPTY_STRING;
  screenSaverContentOption = Constants.EMPTY_STRING;

  priorColorViewDesktopBkgrndImage = Constants.EMPTY_STRING;

  accentColor = Constants.EMPTY_STRING;
  // Mirrored to the host as `.st-accent-surfaces` so the mini desktop preview
  // (start-menu / taskbar surfaces) tints with the accent, matching the desktop.
  @HostBinding('class.st-accent-surfaces') showAccentColorOnStartMenuAndTaskbar = false;
  // Mirrored to the host as `.st-titlebar-accent` so the mini desktop preview's
  // app title bar (heading) tints with the accent, matching real windows.
  @HostBinding('class.st-titlebar-accent') showAccentColorOnTitleBarsAndWindowBoarder = false;
  // Frosts the desktop / file-explorer / file-tree context menus (a dedicated
  // effect, independent of the global transparency toggle). Not host-bound (the
  // mini desktop preview has no context menu); only persists the setting that
  // <cos-menu> reads.
  applyTransparencyEffectToContextMenu = false;
  // Tints the frosted context menus with a soft accent. Only meaningful while
  // applyTransparencyEffectToContextMenu is on. Not host-bound.
  applyAccentColorToTransparentMenu = false;
  // Dedicated title-bar / window-border transparency, separate from the general
  // transparency effect: when on, window title bars (and the File Explorer header)
  // go frosted. Not host-bound; only persists the setting the window/header read.
  applyTransparencyEffectOnTitleBarAndWindowBorder = false;

  searchBarForm!: FormGroup;

  searchPlaceHolder = 'Find a setting';

  readonly screenViewText = 
`Enable viewport bounds enforcement to prevent windows from being dragged off-screen.`;

  readonly clipboardText =
`When you copy or cut something in Cheetah, it's copied to the
 clipboad for you to paste.`;

  readonly clipboardHistoryText = 
`Save multiple items to the clipboard to use later. Press the
 Ctrl + Shift + V key to view your clipboard history and paste
 from it.`;

 isSaveClipboardHistory = true;
 isEnforceViewPortBound = true;
 isAutoHideTaskBar = false;
 isScreenSaverActive = false;
 // Mirrored to the host as `.st-transparency-on` so the mini desktop preview
 // (start-menu / taskbar surfaces) shows the glass/solid look live.
 @HostBinding('class.st-transparency-on') isTransparencyEffectsActive = false;
 clipboardSaveStateText = Constants.ON;
 autoHideTaskBarText = Constants.OFF;
 isScreenSaverActiveText = Constants.OFF;
 isTransparencyEffectsActiveText = Constants.OFF;
 enforceViewPortBoundText = Constants.ON;

 // System > Notifications & actions pane toggle state.
 // The first option is disabled in the UI (matches Windows, which only enables it
 // once lock-screen notifications are permitted); the other two default to On.
 isShowNotificationsOnLockScreen = false;
 isShowRemindersAndVoipOnLockScreen = true;
 isGetNotificationsFromApps = true;
 showNotificationsOnLockScreenText = Constants.OFF;
 showRemindersAndVoipOnLockScreenText = Constants.ON;
 getNotificationsFromAppsText = Constants.ON;

  selectedSystemOption = this.SYSTEM_SCREEN;
  selectedPersonalizationOption = this.PERSONALIZATION_DESKTOP_BACKGROUND;
  prevSelectedPersonalizationOption = this.PERSONALIZATION_DESKTOP_BACKGROUND;

  selectedApplicationOption = this.APPS_FEATURES;
  selectedIdx = 0;

  lockScreenPictureOptions!:string[];
  desktopPictureOptions!:string[];
  colorOptions!:string[];
  recentColorOptions!:string[];
  cheetahColorOptions!:string[];
  settingsOptions!:SettingsMenuOption[];
  systemOptions!:SettingsMenuOption[];
  personalizationOptions!:SettingsMenuOption[];
  applicationOptions!:SettingsMenuOption[];

  // Installed-apps list shown in the Apps > Apps & features pane.
  applicationList!:{ icon:string, name:string }[];

  // Resolves the installed-app catalogue and per-app icons for the apps list.
  private readonly _appDirectory = new AppDirectory();

  // Friendly display names for the catalogue's lowercase app keys.
  private static readonly _appDisplayNames: Record<string, string> = {
    audioplayer: 'Audio Player', chatter: 'Chatter', cheetah: 'Cheetah',
    clippy: 'Clippy', clipboard: 'Clipboard', fileexplorer: 'File Explorer',
    taskmanager: 'Task Manager', terminal: 'Terminal', videoplayer: 'Video Player',
    photoviewer: 'Photo Viewer', runsystem: 'Run', texteditor: 'Text Editor',
    settings: 'Settings', hello: 'Hello', greeting: 'Greeting', jsdos: 'JS-DOS',
    ruffle: 'Ruffle', codeeditor: 'Code Editor', markdownviewer: 'Markdown Viewer',
    starfield: 'Starfield', boids: 'Boids', particleflow: 'Particle Flow',
    snippingtool: 'Snipping Tool',
    pdfviewer: 'PDF Viewer'
  };

  lockScreenBackgroundOptions = [
    { value: 0, label: this.LOCKSCREEN_BACKGROUND_PICTURE },
    { value: 1, label: this.LOCKSCREEN_BACKGROUND_SOLID_COLOR},
    { value: 2, label: this.LOCKSCREEN_BACKGROUND_MIRROR }
    //{ value: 3, label: this.LOCKSCREEN_SLIDE_SHOW }
  ];

  lockScreenTimeOutOptions = [
    { value: 60000, label: '1 Minute'},
    { value: 180000, label: '3 Minutes'},
    { value: 300000, label: '5 Minutes'},
    { value: 600000, label: '10 Minutes'},
    { value: 1200000, label: '20 Minutes'},
  ];

  desktopBackgroundOptions = [
    { value: 0, label: this.LOCKSCREEN_BACKGROUND_PICTURE },
    { value: 1, label: this.LOCKSCREEN_BACKGROUND_SOLID_COLOR},
    { value: 2, label: this.DESKTOP_BACKGROUND_DYNAMIC }
    //{ value: 3, label: this.DESKTOP_BACKGROUND_SLIDE_SHOW }
  ];

  slideShowOptions = [
    { value: 0, label: this.SLIDE_SHOW_PICTURE },
    { value: 1, label: this.SLIDE_SHOW_COLOR}
  ];

  taskbarPositionOptions = [
    { value: 0, label: 'Bottom' }
  ];

  taskbarCombinationOptions = [
    { value: 0, label: this.TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS },
    { value: 1, label: this.TASKBAR_COMBINATION_NEVER}
  ];

  // Screen-saver type (dropdown 1) and the per-type saver lists (dropdown 2).
  // Each saver pairs its display label with the bare file name; the full path is
  // resolved from the matching base path when the saver is launched.
  screenSaverTypeOptions = [
    { value: 0, label: this.SCREEN_SAVER_VIDEO },
    { value: 1, label: this.SCREEN_SAVER_DYNAMIC },
  ];

  videoScreenSaverOptions = [
    { value: 0, label: 'Cloud Timelapse', file: 'cloud_timelapse.mp4' },
    { value: 1, label: 'Falling Leaves',  file: 'falling_leaves.mp4' },
    { value: 2, label: 'Gentle Moments',  file: 'gentle_moments.mp4' },
    { value: 3, label: 'Moon Light Ride', file: 'moon_light_ride.mp4' },
    { value: 4, label: 'Wishing Stars',   file: 'wishing_stars.mp4' },
  ];

  dynamicScreenSaverOptions = [
    { value: 0, label: 'Flower Box',   file: 'flowerbox.ssvr' },
    { value: 1, label: 'Bouncy Balls', file: 'bouncyballs.ssvr' },
    { value: 2, label: '3D Pipes',     file: '3dpipes.ssvr' },
    { value: 3, label: '3D Maze',    file: '3dmaze.ssvr' },
  ];

  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;

  // System > Storage pane display state. Populated by getStorageData() when the
  // pane is opened. The capacity comes from Constants.STORAGE_CAPACITY and the
  // used amount from the FileService; "free" is simply capacity minus used.
  storageCapacityText = Constants.EMPTY_STRING;
  storageUsedText = Constants.EMPTY_STRING;
  storageFreeText = Constants.EMPTY_STRING;
  storageUsedPercent = 0;

  // System > About pane: static "Cheetah specifications" rows, sourced entirely
  // from the OS_* constants. Declared as label/value pairs so the template can
  // render them with a simple *ngFor instead of repeating markup per row.
  readonly aboutSpecs: { label: string, value: string }[] = [
    { label: 'Edition', value: Constants.OS_NAME },
    { label: 'Version', value: Constants.OS_VERSION },
    { label: 'OS build', value: Constants.OS_BUILD },
    { label: 'Architecture', value: Constants.OS_ARCHITECTURE },
  ];

  retrievedBackgroundType = Constants.EMPTY_STRING;
  retrievedBackgroundValue = Constants.EMPTY_STRING;


  isLockScreenBkgrndDropDownOpen = false;
  isLockScreenSlideShowDropDownOpen = false;
  isLockScreenTimeoutDropDownOpen = false;
  isDesktopBkgrndDropDownOpen = false;
  isTaskbarPositionDropDownOpen = false;
  isTaskbarCombinationDropDownOpen = false;
  isScreenSaverTypeDropDownOpen = false;
  isScreenSaverContentDropDownOpen = false;

  // Holds the active background-preview slideshow timer, or undefined when no
  // slideshow is running. Cleared in stopSlideShow() / ngOnDestroy().
  slideShowIntervalId?: NodeJS.Timeout;

  readonly MIN_WIDTH_PX = 480; 
  readonly MIN_HEIGHT_PX = 320;
  
  isMaximizable = true;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}settings.png`;
  name = 'settings';
  processId = 0;
  type = ComponentType.System
  displayName = Constants.EMPTY_STRING;

  @HostBinding('class.theme-light') isLightTheme = false;
  private _themeChangeSub!: Subscription;

  /**
   * Drives the Settings `--st-accent` token from the global personalization
   * accent (`DEFAULT_ACCENT_COLOR`). Bound on the host so every rule that
   * consumes `var(--st-accent)` (toggles, checkboxes, dropdown selection,
   * hover borders, indicators, theme-mode button, storage bar, etc.) recolors
   * to the chosen accent. Matches the accent directly, independent of the
   * "Show accent color" surface toggle.
   */
  @HostBinding('style.--st-accent') stAccentColor = Constants.DEFAULT_ACCENT_COLOR_VALUE;
  private _accentChangeSub!: Subscription;
  private _changeContentSub?: Subscription;

  /**
   * A pending deep-link target (e.g. from the desktop "Personalize" menu),
   * decoded from the launch trigger in ngOnInit and applied in ngAfterViewInit
   * once the view has rendered. Null for a normal launch.
   */
  private _pendingDeepLink: { view: string, option: string } | null = null;

  constructor(
    private _processIdService:ProcessIDService,
    private _runningProcessService:RunningProcessService,
    private _windowService:WindowService,
    private _defaultService:DefaultService,
    private _themeService:ThemeService,
    private _fileService:FileService,
    private _processHandlerService:ProcessHandlerService,
    private _formBuilder:FormBuilder) {
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });

    this.applyAccentColor();
    this._accentChangeSub = this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
      if(key === Constants.DEFAULT_ACCENT_COLOR){
        this.applyAccentColor();
      }
    });

    // Preload the surface-accent + transparency states so the mini desktop
    // preview renders correctly on any personalization view, not just after
    // the Colors pane has been opened.
    this.getShowAccentColorStartMenuAndTaskbarData();
    this.getShowAccentColorTitleBarsAndWindowBordersData();
    this.getContextMenuEffectsData();
    this.getTransparencyEffectsData();
    this.getShowTransparencyEffectOnTitleBarAndWindowBorderData();

    this.searchBarForm = this._formBuilder.nonNullable.group({
      searchBarText: Constants.EMPTY_STRING,
    });

    // this._searchBoxChangeSub = this.searchBarForm.get('searchBarText')?.valueChanges
    //   .pipe(debounceTime(delay))
    //   .subscribe(value => {
    //     this.currentSearchString = value;
    //     this.handleSearch(value);
    //   });

    this.settingsOptions = this.generateControlPanelOptions();
    this.systemOptions = this.generateSystemOptions();
    this.personalizationOptions = this.generatePersonalizationOptions();
    this.applicationOptions = this.generateApplicationOptions();
    this.applicationList = this.generateApplicationList();

    // Deep-link support: a launch may target a specific view (e.g. the desktop
    // "Personalize" context-menu entry). Read any target queued for this launch
    // now; it is applied in ngAfterViewInit once the view has rendered. Also react
    // to re-launches while already open (single-instance, file-backed app fires
    // changeProcessContentNotify) so the deep-link works in that case too.
    this._pendingDeepLink = this.parseDeepLink(this._processHandlerService.getLastProcessTrigger(this.name));
    this._changeContentSub = this._runningProcessService.changeProcessContentNotify
      .subscribe(() => { void this.applyPendingDeepLink(); });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.captureComponentImg();
    await this.applyPendingDeepLink();
  }

  ngOnDestroy(): void {
    // a wired bug. I shouldn't have to do this.
    this.stopSlideShow();
    this._themeChangeSub?.unsubscribe();
    this._accentChangeSub?.unsubscribe();
    this._changeContentSub?.unsubscribe();
  }

  /**
   * Decode a launch trigger into a deep-link target, or null when it is a normal
   * (non-deep-link) launch. Payload shape: currentPath === SETTINGS_DEEP_LINK and
   * contentPath === "<view>:<option>".
   */
  private parseDeepLink(file: FileInfo): { view: string, option: string } | null {
    if(!file || file.getCurrentPath !== Constants.SETTINGS_DEEP_LINK)
      return null;

    const [view, option] = file.getContentPath.split(Constants.COLON);
    return { view, option: option ?? Constants.EMPTY_STRING };
  }

  /**
   * Apply a pending deep-link target (navigating to the requested view/pane).
   * Called on first render (ngAfterViewInit) and on re-launch while already open
   * (changeProcessContentNotify). On the re-launch path it first pulls any freshly
   * queued trigger; getLastProcessTrigger returns an empty FileInfo for unrelated
   * relaunches (audioplayer, etc.), which decodes to null, so this is a safe no-op
   * in those cases.
   */
  private async applyPendingDeepLink(): Promise<void> {
    const fresh = this.parseDeepLink(this._processHandlerService.getLastProcessTrigger(this.name));
    if(fresh)
      this._pendingDeepLink = fresh;

    if(!this._pendingDeepLink)
      return;

    const { view, option } = this._pendingDeepLink;
    this._pendingDeepLink = null;

    if(view === this.PERSONALIZATION_VIEW){
      // Switch to the Personalization view, then delegate the sub-pane selection to
      // the same handler the sidebar uses, so every flag/side-effect (prev/selected
      // option, selectedIdx, per-pane data loads, preview init) matches a real click.
      // A final screenshot is taken because that handler's personalization branch
      // returns before its own captureComponentImg().
      this.currentView = this.PERSONALIZATION_VIEW;
      const idx = Math.max(this.personalizationOptions.findIndex(o => o.title === option), 0);
      await this.handleMenuSelection(this.personalizationOptions[idx].title, idx, undefined, this.PERSONALIZATION_VIEW);
      await this.captureComponentImg();
    }
  }

  /**
   * Sets `--st-accent` to the chosen personalization accent color (which always
   * has a default).
   */
  private applyAccentColor():void{
    this.stAccentColor = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.settingsContainer, this.processId, this.name, this.icon, this._windowService);
  }
  
  toggleLockScreenBkgrndDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isLockScreenBkgrndDropDownOpen = !this.isLockScreenBkgrndDropDownOpen;
  }

  toggleLockScreenSlideShowDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isLockScreenSlideShowDropDownOpen = !this.isLockScreenSlideShowDropDownOpen;
  }

  toggleLockScreenTimeOutDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isLockScreenTimeoutDropDownOpen = !this.isLockScreenTimeoutDropDownOpen;
  }

  toggleDesktopBkgrndDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isDesktopBkgrndDropDownOpen = !this.isDesktopBkgrndDropDownOpen;
  }

  toggleTaskBarPositionDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isTaskbarPositionDropDownOpen = !this.isTaskbarPositionDropDownOpen;
  }

  toggleTaskBarCombinationDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isTaskbarCombinationDropDownOpen = !this.isTaskbarCombinationDropDownOpen;
  }

  toggleScreenSaverTypeDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isScreenSaverTypeDropDownOpen = !this.isScreenSaverTypeDropDownOpen;
  }

  toggleScreenSaverContentDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isScreenSaverContentDropDownOpen = !this.isScreenSaverContentDropDownOpen;
  }

  @HostListener('document:click')
  onOutsideClick(): void {
    this.isLockScreenBkgrndDropDownOpen = false;
    this.isLockScreenSlideShowDropDownOpen = false;
    this.isLockScreenTimeoutDropDownOpen = false;
    this.isDesktopBkgrndDropDownOpen = false;
    this.isTaskbarCombinationDropDownOpen = false;
    this.isTaskbarPositionDropDownOpen = false;
    this.isScreenSaverTypeDropDownOpen = false;
    this.isScreenSaverContentDropDownOpen = false;
  }

  getLockScreenBackgroundData():void{
    const defaultBkgrnd = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND));    
    this.retrievedBackgroundType = defaultBkgrnd[0];
    this.retrievedBackgroundValue = defaultBkgrnd[1];
    this.lockScreenBkgrndOption  = defaultBkgrnd[0];

    if(defaultBkgrnd[0] === this.LOCKSCREEN_SLIDE_SHOW){
      this.lockScreenSlideShowOption =  defaultBkgrnd[1];
    }
  }

  getDesktopBackgroundData():void{
    const defaultBkgrnd = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND));
    this.retrievedBackgroundType = defaultBkgrnd[0];
    this.retrievedBackgroundValue = defaultBkgrnd[1];
    this.desktopBkgrndOption  = defaultBkgrnd[0];
  }

  getTaskbarData():void{
    const defaultTaskBarComb = this._defaultService.getDefaultSetting(Constants.DEFAULT_TASKBAR_COMBINATION);
    const defaultAutoHideTaskBar = this._defaultService.getDefaultSetting(Constants.DEFAULT_AUTO_HIDE_TASKBAR);
    this.taskBarCombinationOption  = defaultTaskBarComb;
    this.isAutoHideTaskBar = (defaultAutoHideTaskBar === Constants.TRUE)? true : false;
  }

  getLockScreenTimeOutData():void{
    const defaultTimeOut = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT));
    this.lockScreenTimeoutOption = defaultTimeOut[0];
  }

  getScreenSaverData():void{
    const scrSvrState = this._defaultService.getDefaultSetting(Constants.DEFAULT_SCREEN_SAVER_STATE);
    this.isScreenSaverActive = (scrSvrState === Constants.ON)? true : false;
    this.isScreenSaverActiveText = (this.isScreenSaverActive)? Constants.ON : Constants.OFF;

    // Hydrate the type + saver dropdowns from the stored "Type:fileName" value.
    const saver = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_SCREEN_SAVER));
    this.screenSaverTypeOption = saver[0];
    this.screenSaverContentOption = this.resolveSaverLabel(saver[0], saver[1]);
  }

  getTransparencyEffectsData():void{
    const transparencyEffectsState = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT);
    this.isTransparencyEffectsActive = (transparencyEffectsState === Constants.TRUE)? true : false;
    this.isTransparencyEffectsActiveText = (this.isTransparencyEffectsActive)? Constants.ON : Constants.OFF;
  }

  getAccentColorData():void{
   this.accentColor = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
  }

  getShowAccentColorStartMenuAndTaskbarData():void{
    const showAccentColorState = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR);
    this.showAccentColorOnStartMenuAndTaskbar = (showAccentColorState === Constants.TRUE)? true : false;
  }

  getShowAccentColorTitleBarsAndWindowBordersData():void{
    const showAccentColorState = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS);
    this.showAccentColorOnTitleBarsAndWindowBoarder = (showAccentColorState === Constants.TRUE)? true : false;
  }

  getContextMenuEffectsData():void{
    const transparencyState = this._defaultService.getDefaultSetting(Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU);
    this.applyTransparencyEffectToContextMenu = (transparencyState === Constants.TRUE)? true : false;

    const accentState = this._defaultService.getDefaultSetting(Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU);
    this.applyAccentColorToTransparentMenu = (accentState === Constants.TRUE)? true : false;
  }

  getShowTransparencyEffectOnTitleBarAndWindowBorderData():void{
    const state = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER);
    this.applyTransparencyEffectOnTitleBarAndWindowBorder = (state === Constants.TRUE)? true : false;
  }

  // Map a stored "Type"/"fileName" pair back to the saver's display label.
  private resolveSaverLabel(type:string, file:string):string{
    const pool = (type === this.SCREEN_SAVER_VIDEO)? this.videoScreenSaverOptions : this.dynamicScreenSaverOptions;
    return pool.find(x => x.file === file)?.label ?? Constants.EMPTY_STRING;
  }

  /**
   * Loads the persisted "save clipboard history" preference so the toggle and its
   * On/Off label reflect the value chosen in a previous session.
   * The flag is stored as Constants.TRUE / Constants.FALSE, mirroring the
   * convention used by the auto-hide-taskbar setting.
   */
  getClipboardData():void{
    const savedClipboardState = this._defaultService.getDefaultSetting(Constants.DEFAULT_CLIP_BOARD_STATE);
    this.isSaveClipboardHistory = (savedClipboardState === Constants.TRUE);
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? Constants.ON : Constants.OFF;
  }

  /**
   * Computes the figures shown in the System > Storage pane.
   *
   *  - Total capacity is the fixed virtual-disk size (Constants.STORAGE_CAPACITY).
   *  - Used bytes come from the FileService, which tracks the live drive usage.
   *  - Free bytes are the remainder.
   *
   * Used is clamped to the capacity so the progress bar can never exceed 100%
   * and the "free" figure can never go negative, even if the drive somehow
   * reports more usage than the advertised capacity.
   */
  async getStorageData():Promise<void>{
    const totalCapacityInBytes = Constants.STORAGE_CAPACITY;
    // Lazily triggers the one-time full-drive walk on first open of this pane.
    const usedInBytes = Math.min(await this._fileService.getUsedStorageAsync(), totalCapacityInBytes);
    const freeInBytes = totalCapacityInBytes - usedInBytes;

    this.storageCapacityText = this.formatStorageSize(totalCapacityInBytes);
    this.storageUsedText = this.formatStorageSize(usedInBytes);
    this.storageFreeText = this.formatStorageSize(freeInBytes);
    this.storageUsedPercent = (totalCapacityInBytes > 0)
      ? Math.round((usedInBytes / totalCapacityInBytes) * 100)
      : 0;
  }

  /**
   * Formats a byte count into a human-readable "<value> <unit>" string
   * (e.g. "488.31 MB") using the shared size/unit helpers.
   */
  private formatStorageSize(sizeInBytes:number):string{
    const readableValue = CommonFunctions.getReadableFileSizeValue(sizeInBytes);
    const sizeUnit = CommonFunctions.getFileSizeUnit(sizeInBytes);
    return `${readableValue} ${sizeUnit}`;
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();
    this.onOutsideClick();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId 
      && this._windowService.getIsWindowInFocus()) return;
      
    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  generateControlPanelOptions():SettingsMenuOption[]{
    return [
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_VIEW, subtitle: this.SYSTEM_VIEW_EXTRA },
      { icon: Constants.EMPTY_STRING, title: this.APPS_VIEW, subtitle: this.APPS_VIEW_EXTRA },
      { icon: Constants.EMPTY_STRING, title: this.PERSONALIZATION_VIEW, subtitle: this.PERSONALIZATION_VIEW_EXTRA },
    ];
  }

  generateSystemOptions():SettingsMenuOption[]{
    return [
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_SCREEN, glyph: 'screen' },
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_NOTIFICATION, glyph: 'notification' },
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_STORAGE, glyph: 'storage' },
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_CLIPBOARD, glyph: 'clipboard' },
      { icon: Constants.EMPTY_STRING, title: this.SYSTEM_ABOUT, glyph: 'about' },
    ];
  }

  generatePersonalizationOptions():SettingsMenuOption[]{
    return [
      { icon: Constants.EMPTY_STRING, title: this.PERSONALIZATION_DESKTOP_BACKGROUND, glyph: 'desktopBackground' },
      { icon: Constants.EMPTY_STRING, title: this.PERSONALIZATION_COLORS, glyph: 'color' },
      { icon: Constants.EMPTY_STRING, title: this.PERSONALIZATION_LOCKSCREEN, glyph: 'lockScreen' },
      { icon: Constants.EMPTY_STRING, title: this.PERSONALIZATION_TASKBAR, glyph: 'taskbar' },
    ];
  }

  // The Apps panel has a single sidebar entry: "Apps & features".
  generateApplicationOptions():SettingsMenuOption[]{
    return [
      { icon: Constants.EMPTY_STRING, title: this.APPS_FEATURES, glyph: 'appsList' },
    ];
  }

  /**
   * Builds the installed-apps list for the Apps & features pane from the
   * AppDirectory catalogue, pairing each app with its icon and a friendly
   * display name (falling back to the raw catalogue key when none is mapped).
   */
  generateApplicationList():{ icon:string, name:string }[]{
    return this._appDirectory.getAppList().filter(appName => !this._appDirectory.getHiddenApp().includes(appName)).map(appName => ({
      icon: this._appDirectory.getAppIcon(appName),
      name: SettingsComponent._appDisplayNames[appName] ?? appName,
    }));
  }

  fetchColorOptions():string[]{
    return Constants.LOCKSCREEN_DESKTOP_COLORS;
  }

  fetchCheetahColorOptions():string[]{
    return Constants.CHEETAH_COLORS;
  }

  getRecentColors():string[]{    
    const recentColors = this._defaultService.getDefaultSetting(Constants.RECENT_CHEETAH_COLORS);
    return (recentColors)? recentColors.split(',') : [];
  }

  async handleSettingsPanelSelection(selection:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this.currentView = selection;

    if(selection === this.PERSONALIZATION_VIEW){
      this.getDesktopBackgroundData();
      await this.handleDropDownChoiceAndSetBkgrnd();
    }

    if(selection === this.APPS_VIEW){
      // Single sub-pane: ensure it is selected and its sidebar item highlighted.
      this.selectedApplicationOption = this.APPS_FEATURES;
      this.selectedIdx = 0;
    }

    await this.captureComponentImg();
  }

  async handleMenuSelection(selection:string, idx:number, evt:MouseEvent | undefined, view:string): Promise<void>{
    evt?.stopPropagation();

    if(idx === -1 && view === this.HOME_VIEW){
      this.currentView = this.HOME_VIEW;
      return;
    }

    if(view === this.SYSTEM_VIEW){
      this.selectedSystemOption = selection;
      this.selectedIdx = idx;

      // Lazily load the persisted clipboard preference when its pane is opened,
      // matching how the lock-screen / taskbar panes load their data on demand.
      if(selection === this.SYSTEM_CLIPBOARD)
        this.getClipboardData();

      // Compute disk usage figures when the storage pane is opened.
      if(selection === this.SYSTEM_STORAGE)
        this.getStorageData();

      return;
    }

    if(view === this.APPS_VIEW){
      this.selectedApplicationOption = selection;
      this.selectedIdx = idx;
      return;
    }

    if(view === this.PERSONALIZATION_VIEW){
      this.prevSelectedPersonalizationOption =  this.selectedPersonalizationOption;
      this.selectedPersonalizationOption = selection;
      this.selectedIdx = idx;


      if(selection ===  this.PERSONALIZATION_COLORS){
        this.recentColorOptions = this.getRecentColors();
        this.cheetahColorOptions = this.fetchCheetahColorOptions();
        this.getAccentColorData();
        this.getTransparencyEffectsData();
        this.getShowAccentColorStartMenuAndTaskbarData();
        this.getShowAccentColorTitleBarsAndWindowBordersData();
        this.getContextMenuEffectsData();
        this.getShowTransparencyEffectOnTitleBarAndWindowBorderData();
        await this.handleDropDownChoiceAndSetBkgrnd();
      }

      if(selection ===  this.PERSONALIZATION_LOCKSCREEN){
        this.getLockScreenBackgroundData();
        this.getLockScreenTimeOutData();
        this.getScreenSaverData();
        this.currentTime = SettingsHelper.updateTime();
        this.currentDate = SettingsHelper.getDate();
        await this.handleDropDownChoiceAndSetBkgrnd();
      }

      if(selection ===  this.PERSONALIZATION_DESKTOP_BACKGROUND){
        this.getDesktopBackgroundData();
        await this.handleDropDownChoiceAndSetBkgrnd();
      }

      if(selection ===  this.PERSONALIZATION_TASKBAR){
        this.getTaskbarData();
      }
      return;
    }

    await this.captureComponentImg();
  }

  changeSaveClipboardHistoryState():void{
    // The checkbox is bound via [(ngModel)], so isSaveClipboardHistory already holds
    // the new value by the time this (change) handler runs. Update the label and
    // persist the choice so it survives a reload (stored as TRUE / FALSE).
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? Constants.ON : Constants.OFF;
    const clipboardStateValue = (this.isSaveClipboardHistory)? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_CLIP_BOARD_STATE, clipboardStateValue);
  }

  changeEnforceViewPortBoundState():void{
    // The checkbox is bound via [(ngModel)], so isEnforceViewPortBound already holds
    // the new value by the time this (change) handler runs. Update the label and
    // persist the choice so it survives a reload (stored as TRUE / FALSE).
    this.enforceViewPortBoundText = (this.isEnforceViewPortBound)? Constants.ON : Constants.OFF;
    const enforceViewPortBoundValue = (this.isEnforceViewPortBound)? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS, enforceViewPortBoundValue);
  }

  setTheme(theme:string):void{
    this._themeService.setTheme(theme);
  }

  async handleDropDownChoiceAndSetBkgrnd(option?: { value: number, label: string }, evt?: MouseEvent): Promise<void>{
    if(evt)
      evt.stopPropagation();

    const delay = 50; //50 ms
    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND)? true: false;
    const isColorView = (this.selectedPersonalizationOption === this.PERSONALIZATION_COLORS)? true: false;
    const styleClasses = (isDesktopView)
    ? ['desktop-preview__background-mirror-and-picture', 'desktop-preview__background-solid-color'] 
    : ['lockscreen-preview__background-mirror-and-picture', 'lockscreen-preview__background-solid-color'];

    let activeClass = Constants.EMPTY_STRING;
    let selectedValue = Constants.EMPTY_STRING;
    let screenPrevElmnt!:HTMLDivElement;
    let isMirror = false;
    let isChanged = false;  

    if(option){
      selectedValue = option.label;
      isChanged = true;

      if(isDesktopView){
        this.desktopBkgrndOption = selectedValue;
      }else{
        this.lockScreenBkgrndOption = selectedValue;
        isMirror = (selectedValue === this.LOCKSCREEN_BACKGROUND_MIRROR);
      }
    }

    this.isLockScreenBkgrndDropDownOpen = false;
    this.isDesktopBkgrndDropDownOpen = false;
    this.stopSlideShow();

    screenPrevElmnt = (isDesktopView)
    ? document.getElementById('desktop_Preview') as HTMLDivElement 
    : document.getElementById('lockScreen_Preview') as HTMLDivElement;

    if(!screenPrevElmnt){
      await CommonFunctions.sleep(delay);
      screenPrevElmnt = (isDesktopView)
      ? document.getElementById('desktop_Preview') as HTMLDivElement 
      : document.getElementById('lockScreen_Preview') as HTMLDivElement;
    }

    if(selectedValue === Constants.BACKGROUND_PICTURE  || this.retrievedBackgroundType === Constants.BACKGROUND_PICTURE)
      await this.handlePictureBkgrnd(screenPrevElmnt, activeClass, styleClasses, isChanged, isDesktopView);

    if(selectedValue === Constants.BACKGROUND_MIRROR 
      ||selectedValue === Constants.BACKGROUND_DYNAMIC  
      || this.retrievedBackgroundType === Constants.BACKGROUND_MIRROR
      || this.retrievedBackgroundType === Constants.BACKGROUND_DYNAMIC)
      await this.handleMirrorAndDynamicBkgrnd(screenPrevElmnt, activeClass, styleClasses, isMirror, isChanged, isDesktopView)

    if(selectedValue === Constants.BACKGROUND_SOLID_COLOR  || this.retrievedBackgroundType === Constants.BACKGROUND_SOLID_COLOR)
      await this.handleSolidColorBkrgnd(screenPrevElmnt, activeClass, styleClasses, isChanged, isDesktopView);

    if(selectedValue === Constants.BACKGROUND_SLIDE_SHOW  || this.retrievedBackgroundType === Constants.BACKGROUND_SLIDE_SHOW)
      this.handleSlideShowBkgrnd(screenPrevElmnt, activeClass, styleClasses, isDesktopView, this.lockScreenSlideShowOption);


    if(isColorView){
      await CommonFunctions.sleep(delay);
      screenPrevElmnt = document.getElementById('color_Preview') as HTMLDivElement;
      const option = selectedValue || this.retrievedBackgroundType;
      this.handleColorPreviewBackground(screenPrevElmnt, activeClass, styleClasses, option);
    }
  }

  async handlePictureBkgrnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isChanged:boolean, isDesktopView:boolean): Promise<void>{
  
    if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_PICTURE  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE && isChanged)
      || (this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_PICTURE  && !isChanged)
      || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE && isChanged)){

      if(screenPrevElmnt){
        activeClass = styleClasses[0];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass);

        if(isDesktopView){
          const prevDefaultPic = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE);
          const selection = (isChanged) ? prevDefaultPic  : `${this.retrievedBackgroundValue}`;

          if(isChanged){
            //auto apply
            const defaultDesktopBackgroundValue = `${this.desktopBkgrndOption}:${selection}`;
            this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgroundValue);
          }

          //const img = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);
          screenPrevElmnt.style.backgroundImage = `url(${selection})`;
        }else{
          const defaultImg = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}bamboo_moon.jpg`;
          screenPrevElmnt.style.backgroundImage = (isChanged) 
          ? `url(${defaultImg})` 
          : `url(${this.retrievedBackgroundValue})`;
        }
      }

      if(!isDesktopView)
        this.lockScreenPictureOptions = SettingsHelper.generateLockScreenPictureOptions();
      else
        this.desktopPictureOptions = SettingsHelper.generateDesktopPictureOptions(this.desktopBkgrndOption);
    }
  }

  async handleMirrorAndDynamicBkgrnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isMirror:boolean, isChanged:boolean, isDesktopView:boolean): Promise<void>{
    activeClass = styleClasses[0];
    if(isDesktopView){
      if((this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_DYNAMIC  && !isChanged)
        || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC && isChanged)){
   
        if(screenPrevElmnt){  
          const prevDynamicImg = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG);
          const correctedPath = `${Constants.DESKTOP_IMAGE_BASE_PATH}${this.retrievedBackgroundValue}.jpg`;
          const selection = (isChanged) ? prevDynamicImg : correctedPath;
          const delay = 25; //25ms

          if(isChanged){
            //auto apply
            const defaultDesktopBackgroundValue = `${this.desktopBkgrndOption}:${this.checkAndVantaCase(selection)}`;
            this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgroundValue);
          }

          //await CommonFunctions.sleep(delay);
          //const desktopBkgrndImg = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);  
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundImage = `url(${selection})`;
        }
      }
      this.desktopPictureOptions = SettingsHelper.generateDesktopPictureOptions(this.desktopBkgrndOption);
    }else{
      if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_MIRROR  && !isChanged)
        || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR && isChanged)){

        if(isMirror){
          const defaultLockScreenBackgroundValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
          this._defaultService.updateDefaultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgroundValue);
        }
        if(screenPrevElmnt){  
          const desktopBkgrndImg = await this.getDesktopScreenShot();  
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
        }
      }
    }
  }

  async handleSolidColorBkrgnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isChanged:boolean, isDesktopView:boolean): Promise<void>{
    if(isDesktopView){
      if((this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_SOLID_COLOR  && !isChanged)
        || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR  && isChanged)){
  
        if(screenPrevElmnt){
          const delay = 25; //25ms
          activeClass = styleClasses[0];
          const prevSolidColor = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR);
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);

          if(isChanged){
            //auto apply
            const defaultDesktopBackgroundValue = `${this.desktopBkgrndOption}:${prevSolidColor}`;
            this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgroundValue);
          }

          await CommonFunctions.sleep(delay);
          const color = (isChanged) ? prevSolidColor : this.retrievedBackgroundValue ;
          // const desktopBkgrndImg = await this.getDesktopScreenShot(color);
          // screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
          screenPrevElmnt.style.backgroundColor = color;
        }
      }
    }else{
      if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && !isChanged)
        || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && isChanged)){
        if(screenPrevElmnt){
          const defaultColor = '#0c0c0c';
          activeClass = styleClasses[1];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundColor = (isChanged)? defaultColor : this.retrievedBackgroundValue ;
        }
      }
    }

    this.colorOptions = this.fetchColorOptions();
  }

  handleSlideShowBkgrnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isDesktopView:boolean, type:string):void{
    if((this.retrievedBackgroundType === this.LOCKSCREEN_SLIDE_SHOW)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_SLIDE_SHOW)
      || (this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_SLIDE_SHOW)
      || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW)){
      const images:string[] = [];

      if(isDesktopView){
        images.push(...SettingsHelper.generateDesktopPictureOptions(this.desktopBkgrndOption));
      }else{
        images.push(...SettingsHelper.generateLockScreenPictureOptions());
      }
      if(screenPrevElmnt){
        activeClass = (type === Constants.BACKGROUND_SLIDE_SHOW_PICTURE) ? styleClasses[0] : styleClasses[1];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass);

        if(type === Constants.BACKGROUND_SLIDE_SHOW_PICTURE)
          this.startPictureSlideShow(screenPrevElmnt, images);
        else
          this.startColorSlideShow(screenPrevElmnt);
      }
    }
  }

  handleColorPreviewBackground(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], option:string):void{
    if(!screenPrevElmnt) return;

    activeClass = styleClasses[0];
    this.setStyle(screenPrevElmnt, styleClasses, activeClass);

    if(option === this.DESKTOP_BACKGROUND_PICTURE){
      const prevDefaultPic = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE);
      this.priorColorViewDesktopBkgrndImage = prevDefaultPic;
      screenPrevElmnt.style.backgroundImage = `url(${prevDefaultPic})`;
      return;
    }

    if(option === this.DESKTOP_BACKGROUND_DYNAMIC){
       const prevDynamicImg = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG);
      screenPrevElmnt.style.backgroundImage = `url(${prevDynamicImg})`;
      return;
    }

    if(option === this.DESKTOP_BACKGROUND_SOLID_COLOR){
      const prevSolidColor = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR);
      screenPrevElmnt.style.backgroundColor = prevSolidColor;
      return;
    }

    screenPrevElmnt.style.backgroundImage = `url(${this.priorColorViewDesktopBkgrndImage})`;
  }

  startPictureSlideShow(screenPrevElmnt: HTMLDivElement, contentSet:string[]) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_PICTURE;
    this.startSlideShow(screenPrevElmnt, contentSet, type);
  }

  startColorSlideShow(screenPrevElmnt: HTMLDivElement) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR;
    const contentSet = this.fetchColorOptions();
    this.startSlideShow(screenPrevElmnt, contentSet, type);
  }

  startSlideShow(screenPrevElmnt: HTMLDivElement, contentSet:string[], setType:string):void {
    this.slideShowIntervalId = CommonFunctions.startSlideShow(screenPrevElmnt, contentSet, setType);
  }

  stopSlideShow():void{
    CommonFunctions.stopSlideShow(this.slideShowIntervalId);
    this.slideShowIntervalId = undefined;
  }

  setStyle(screenPrevElmnt: HTMLDivElement, styleClasses:string[], activeClass:string) {
    // 🧹 Reset previous inline styles
    CommonFunctions.resetInlineStyles(screenPrevElmnt);
    screenPrevElmnt.classList.remove(...styleClasses);
    screenPrevElmnt.classList.add(activeClass);
  }

  onLockScreenTimeoutSelect(option:{value: number, label: string }, evt: MouseEvent):void{
    evt.stopPropagation();

    this.isLockScreenTimeoutDropDownOpen = false;

    const selectedValue = option.label;
    this.lockScreenTimeoutOption = selectedValue;

    const timeOutValue = this.lockScreenTimeOutOptions.find(x => x.label === this.lockScreenTimeoutOption)?.value;
    const lockScreenTimeoutValue = `${this.lockScreenTimeoutOption}:${timeOutValue}`;
    this._defaultService.updateDefaultData(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT, lockScreenTimeoutValue);
  }

  async handleScreenPictureAndColorSelection(selection:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();

    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND )? true: false;
    let activeClass = Constants.EMPTY_STRING;

    if(isDesktopView){
      const defaultDesktopBackgroundValue = `${this.desktopBkgrndOption}:${this.checkAndVantaCase(selection)}`;
      this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgroundValue);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC)
        this._defaultService.updateDefaultData(Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG, selection);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE)
        this._defaultService.updateDefaultData(Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE, selection);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        this._defaultService.updateDefaultData(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR, selection);
        this.retrievedBackgroundValue = selection;
      }
    }else{
      const defaultLockScreenBackgroundValue = `${this.lockScreenBkgrndOption}:${selection}`;
      this._defaultService.updateDefaultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgroundValue);

      if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR)
        this.retrievedBackgroundValue = selection;
    }

    const styleClasses = (isDesktopView)
    ? ['desktop-preview__background-mirror-and-picture', 'desktop-preview__background-solid-color'] 
    : ['lockscreen-preview__background-mirror-and-picture', 'lockscreen-preview__background-solid-color'];

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_LOCKSCREEN
      && (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE
      || this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR)){

      const screenPrevElmnt =  document.getElementById('lockScreen_Preview') as HTMLDivElement;
      if(screenPrevElmnt){
        if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE){
          activeClass = styleClasses[0];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundImage =`url(${selection})`;
        }else{
          activeClass = styleClasses[1];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundColor = selection;
        }
      }
    }

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND
      && (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE
      || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC
      || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR)){

      const screenPrevElmnt =  document.getElementById('desktop_Preview') as HTMLDivElement;
      if(screenPrevElmnt){
        activeClass = styleClasses[0];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass)

        if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){
          //const img = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);
          screenPrevElmnt.style.backgroundImage =`url(${selection})`;
        }else{
          // const img = await this.getDesktopScreenShot(Constants.EMPTY_STRING, selection);
          // screenPrevElmnt.style.backgroundImage =`url(${img})`;
          screenPrevElmnt.style.backgroundColor = selection;
        }
      }
    }
  
  }

  async handleAccentColorSelection(selection:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this.handleRecentColorSelection(selection); 
    this.accentColor = selection;
    this._defaultService.updateDefaultData(Constants.DEFAULT_ACCENT_COLOR, selection);
  }

  handleRecentColorSelection(selection:string): void{
    const raiseEvt = false;
    const maxRecentColors = 5;
    const isColorInRecentColors = this.recentColorOptions.includes(selection);

    if(((this.recentColorOptions.length < maxRecentColors) && isColorInRecentColors)
      || ((this.recentColorOptions.length >= maxRecentColors) && isColorInRecentColors)) return;

    if((this.recentColorOptions.length < maxRecentColors) && !isColorInRecentColors){
      this.recentColorOptions.push(selection);

      const colors = this.recentColorOptions.join(Constants.COMMA);
      this._defaultService.updateDefaultData(Constants.RECENT_CHEETAH_COLORS, colors, raiseEvt);
    }

    if((this.recentColorOptions.length >= maxRecentColors) && !isColorInRecentColors){
      this.recentColorOptions.shift();
      this.recentColorOptions.push(selection);

      const colors = this.recentColorOptions.join(Constants.COMMA);
      this._defaultService.updateDefaultData(Constants.RECENT_CHEETAH_COLORS, colors, raiseEvt);
    }
  }

  showAccentColorOnStartAndMenuChange(): void{
    const showAccentColorValue = this.showAccentColorOnStartMenuAndTaskbar ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, showAccentColorValue);
  }

  
  onShowAccentColorOnTitleBarsChange(): void{
    const showAccentColorValue = this.showAccentColorOnTitleBarsAndWindowBoarder ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS, showAccentColorValue);
  }

  onApplyTransparencyEffectToContextMenuChange(): void{
    const value = this.applyTransparencyEffectToContextMenu ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU, value);

    // Accent requires the transparent state; if transparency is switched off,
    // drop the accent flag too so a later re-enable doesn't silently restore it.
    if(!this.applyTransparencyEffectToContextMenu && this.applyAccentColorToTransparentMenu){
      this.applyAccentColorToTransparentMenu = false;
      this._defaultService.updateDefaultData(Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU, Constants.FALSE);
    }
  }

  onApplyAccentColorToTransparentMenuChange(): void{
    const value = this.applyAccentColorToTransparentMenu ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU, value);
  }

  onShowTransparencyEffectOnTitleBarAndWindowBorderChange(): void{
    const value = this.applyTransparencyEffectOnTitleBarAndWindowBorder ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER, value);
  }

  checkAndVantaCase(path:string):string{
    const prefix = 'vanta';
    const fileName = basename(path);

    if(fileName.includes(prefix)){
      return basename(fileName, extname(fileName));
    }
     return path;
  }

  async getDesktopScreenShot(imgPath = Constants.EMPTY_STRING, colorValue = Constants.EMPTY_STRING):Promise<string>{

    // console.log('this.selectedPersonalizationOption:', this.selectedPersonalizationOption);
    // console.log('LockScreen State:', this.lockScreenBkgrndOption)
    // console.log('Desktop State:', this.desktopBkgrndOption)

    const setting = SettingsHelper.getDefaultScreenShot();
    let imgResult = Constants.EMPTY_STRING;

    // LOCKSCREEN SCREEENSHOT CASE, MIRROR DESKTOP
    /*
      1. The desktop bkgrnd is dynamic(using vanta)
      2. The desktop is a picture background
      3. The desktop is a color background
      */

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_LOCKSCREEN
      && this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR){

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){
        setting.useVantaCanvas = true;
        imgResult = await this.getDesktopScreenShotHelper(setting, this.CAPTURE_VANTA_BACKGROUND_ONLY);
      }
      
      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE 
        || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW){
          const dsktpBkGrnd = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND));

          setting.imgPath = dsktpBkGrnd[1];
          setting.isImage = true;

        imgResult = dsktpBkGrnd[1];
      }

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        const dsktpBkGrnd = SettingsHelper.splitSettingValue(this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND))
        setting.colorValue = dsktpBkGrnd[1]; setting.isColor = true;

        imgResult = await this.getDesktopScreenShotHelper(setting, this.CAPTURE_COLOR_BACKGROUND_ONLY);
      }
    }

    //DESKTOP SCREEENSHOT CASES
    if(this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND){
      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE 
        || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW
        || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){ 

          setting.onlyBackGround = false;
          setting.imgPath = imgPath;
          setting.isImage = true;
          setting.changeBackGrndColor = true;

        imgResult = await this.getDesktopScreenShotHelper(setting, this.MERGE_BACKGROUND_AND_FOREGROUND);
      }

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        setting.onlyForeGround = true;
        setting.colorValue = colorValue;
        setting.isColor = true;
        imgResult = await this.getDesktopScreenShotHelper(setting, this.CAPTURE_FOREGROUND_ONLY);
      }
    }

    return imgResult;
  }

  async getDesktopScreenShotHelper(setting:ScreenshotSetting, intent:number):Promise<string>{
    const defaultColor = '#00adef';
    let bkGrndImg = Constants.EMPTY_STRING;
    if(setting.useVantaCanvas && intent === this.CAPTURE_VANTA_BACKGROUND_ONLY){
      bkGrndImg = await this.getVantaBkgrndScreenShot();

      if(setting.onlyBackGround)
        return bkGrndImg;
    }

    if(setting.isColor && intent === this.CAPTURE_COLOR_BACKGROUND_ONLY){
      bkGrndImg =  SettingsHelper.getFalseForeGroundScreenShot(setting.colorValue);

      if(setting.onlyBackGround)
        return bkGrndImg;
    }

    if(setting.isImage && intent === this.MERGE_BACKGROUND_AND_FOREGROUND){
      const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
      const backgroundImgCntnr = new Image();
      backgroundImgCntnr.src = setting.imgPath;
      await backgroundImgCntnr.decode();

      const foreGroundImg = new Image();
      foreGroundImg.src =  await this.getForeGroundScreenShot(defaultColor , setting.changeBackGrndColor);
      await foreGroundImg.decode();

      const mergedImg = document.createElement('canvas');
      mergedImg.width = dsktpCntnrElmnt.offsetWidth;
      mergedImg.height = dsktpCntnrElmnt.offsetHeight; 
  
      const ctx = mergedImg.getContext('2d')!;
      if (!ctx) {
        console.error('Failed to get 2D rendering context.');
        return Constants.EMPTY_STRING;
      }
      // 1. Draw the Vanta background image first.
      ctx.drawImage(backgroundImgCntnr, 0, 0, mergedImg.width, mergedImg.height);
      
      // 2. Draw the HTML content on top of the background.
      ctx.drawImage(foreGroundImg, 0, 0, mergedImg.width, mergedImg.height);
      ctx.imageSmoothingEnabled = true;
  
      return mergedImg.toDataURL('image/png');
    }

    if(setting.isColor && intent === this.CAPTURE_FOREGROUND_ONLY){
      const foreGrndDataUrl = await this.getForeGroundScreenShot(setting.colorValue);
      return foreGrndDataUrl;
    }

    console.error('none of image generation cases matched');
    return Constants.EMPTY_STRING;
  }

  async getVantaBkgrndScreenShot(): Promise<string>{ 
    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    await htmlToImage.toPng(dsktpCntnrElmnt);
    const canvasElmnt = document.querySelector('.vanta-canvas') as HTMLCanvasElement;
    const bkGrndImg = canvasElmnt.toDataURL('image/png');

    return bkGrndImg;
  }

  async getForeGroundScreenShot(currentColor:string, changeBkgrndColor = false):Promise<string>{
    const colorOn = currentColor;
    const colorOff = 'transparent';

    if(changeBkgrndColor)
      SettingsHelper.changeMainDkstpBkgrndColor(colorOff);

    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    const htmlImg = await htmlToImage.toPng(dsktpCntnrElmnt);

    if(changeBkgrndColor)
      SettingsHelper.changeMainDkstpBkgrndColor(colorOn);

    return htmlImg;
  }

  // Stops a click on a preview surface from bubbling up to the document-level
  // outside-click handler (which would otherwise close open dropdowns).
  onPreviewClick(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  handleLockScreenSlideShowChoice(option: { value: number, label: string },   evt:MouseEvent):void{
    evt.stopPropagation();
    this.isLockScreenSlideShowDropDownOpen = false;

    const selectedValue = option.label;
    this.lockScreenSlideShowOption = selectedValue;

    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND)? true: false;
    if(isDesktopView){
      const defaultDesktopBackgroundValue = `${this.desktopBkgrndOption}:${selectedValue}`;
      this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgroundValue);

    }else{
      const defaultLockScreenBackgroundValue = `${this.lockScreenBkgrndOption}:${selectedValue}`;
      this._defaultService.updateDefaultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgroundValue);
    }
  }
  
  async handleTaskBarCombinationSelection(option: { value: number, label: string },  evt: MouseEvent): Promise<void>{
    evt.stopPropagation();

    const selectedValue = option.label;
    this.taskBarCombinationOption = selectedValue;
    this._defaultService.updateDefaultData(Constants.DEFAULT_TASKBAR_COMBINATION, selectedValue);
  }

  changeAutoHideTaskBarState():void{
    this.autoHideTaskBarText = (this.isAutoHideTaskBar)? Constants.ON : Constants.OFF;
    const autoHideValue = (this.isAutoHideTaskBar)? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_AUTO_HIDE_TASKBAR, autoHideValue);
  }

  changeScreenSaverState():void{
    this.isScreenSaverActiveText = (this.isScreenSaverActive)? Constants.ON : Constants.OFF;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SCREEN_SAVER_STATE, this.isScreenSaverActiveText);
  }

  changeTransparencyEffectsState():void{
    const transparencyState = (this.isTransparencyEffectsActive)? Constants.TRUE : Constants.FALSE;
    this.isTransparencyEffectsActiveText = (this.isTransparencyEffectsActive)? Constants.ON : Constants.OFF;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT, transparencyState);
  }

  handleScreenSaverTypeChoice(option: { value: number, label: string }, evt:MouseEvent):void{
    evt.stopPropagation();
    this.isScreenSaverTypeDropDownOpen = false;
    this.screenSaverTypeOption = option.label;

    // Switching type invalidates the old saver choice: default to the first saver
    // of the new type so dropdown 2 is always showing a valid selection.
    const firstSaver = (option.label === this.SCREEN_SAVER_VIDEO)
      ? this.videoScreenSaverOptions[0] : this.dynamicScreenSaverOptions[0];
    this.screenSaverContentOption = firstSaver.label;
    this.persistScreenSaverSelection(firstSaver.file);
  }

  handleScreenSaverContentChoice(option: { value: number, label: string, file: string }, evt:MouseEvent):void{
    evt.stopPropagation();
    this.isScreenSaverContentDropDownOpen = false;
    this.screenSaverContentOption = option.label;
    this.persistScreenSaverSelection(option.file);
  }

  // Persist as "Type:fileName" so the lock screen can split + launch the saver.
  private persistScreenSaverSelection(file:string):void{
    const value = `${this.screenSaverTypeOption}${Constants.COLON}${file}`;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SCREEN_SAVER, value);
  }

  // ----- System > Notifications & actions toggle handlers (stubs) -----
  // Each handler updates its On/Off label from the [(ngModel)]-bound flag.
  // Persistence / side-effects to be implemented later.

  changeShowNotificationsOnLockScreenState():void{
    this.showNotificationsOnLockScreenText = (this.isShowNotificationsOnLockScreen)? Constants.ON : Constants.OFF;
    // TODO: persist + apply lock-screen notification preference.
  }

  changeShowRemindersAndVoipOnLockScreenState():void{
    this.showRemindersAndVoipOnLockScreenText = (this.isShowRemindersAndVoipOnLockScreen)? Constants.ON : Constants.OFF;
    // TODO: persist + apply reminders / VoIP lock-screen preference.
  }

  changeGetNotificationsFromAppsState():void{
    this.getNotificationsFromAppsText = (this.isGetNotificationsFromApps)? Constants.ON : Constants.OFF;
    // TODO: persist + apply app notifications preference.
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
