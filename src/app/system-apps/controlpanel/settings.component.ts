import { Component, Input, OnInit, AfterViewInit,  OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { FileService } from 'src/app/shared/system-service/file.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

import { FormBuilder, FormGroup } from '@angular/forms';
import * as htmlToImage from 'html-to-image';
import {basename, extname} from 'path';

import { CommonFunctions } from 'src/app/system-files/common.functions';
import { AppDirectory } from 'src/app/system-files/app.directory';
import { ScreenshotSetting, SettingsMenuOption } from './settings.interface';
import { SettingsHelper } from './settings.helper';


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


  readonly homeImg = `${Constants.IMAGE_BASE_PATH}cp_home.png`;
  readonly aboutImg = `${Constants.IMAGE_BASE_PATH}cp_info.png`;
  readonly notificationImg = `${Constants.IMAGE_BASE_PATH}cp_notification.png`;
  readonly storageImg = `${Constants.IMAGE_BASE_PATH}cp_storage.png`;
  readonly screenImg = `${Constants.IMAGE_BASE_PATH}cp_screen.png`;
  readonly clipboardImg = `${Constants.IMAGE_BASE_PATH}cp_clipboard.png`;

  readonly systemImg = `${Constants.IMAGE_BASE_PATH}cp_system.png`;
  readonly appsImg = `${Constants.IMAGE_BASE_PATH}cp_apps.png`;
  readonly personalizationImg = `${Constants.IMAGE_BASE_PATH}cp_personalization.png`;

  // Icon shown next to the single "Apps & features" item in the Apps sidebar.
  readonly appsListImg = `${Constants.IMAGE_BASE_PATH}cp_app_list.png`;

  // Local-disk icon shown in the System > Storage pane.
  readonly storageDiskImg = `${Constants.IMAGE_BASE_PATH}os_disk_1.png`;

  readonly desktopBackgroundImg = `${Constants.IMAGE_BASE_PATH}cp_background.png`;
  readonly taskbarImg = `${Constants.IMAGE_BASE_PATH}cp_taskbar.png`;
  readonly lockScreenImg = `${Constants.IMAGE_BASE_PATH}cp_lockscreen.png`;
  readonly colorImg = `${Constants.IMAGE_BASE_PATH}cp_color.png`;

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
  //readonly PERSONALIZATION_COLOR = 'Color';

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
 clipboardSaveStateText = Constants.ON;
 autoHideTaskBarText = Constants.OFF;
 isScreenSaverActiveText = Constants.OFF;
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


  constructor(
    private _processIdService:ProcessIDService,
    private _runningProcessService:RunningProcessService,
    private _windowService:WindowService,
    private _defaultService:DefaultService,
    private _fileService:FileService,
    private _formBuilder:FormBuilder) {
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
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
  }

  async ngAfterViewInit(): Promise<void> {
    await this.captureComponentImg();
  }

  ngOnDestroy(): void {
    // a wired bug. I shouldn't have to do this.
    this.stopSlideShow();
    
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

  @HostListener('document:click')
  onOutsideClick(): void {
    this.isLockScreenBkgrndDropDownOpen = false;
    this.isLockScreenSlideShowDropDownOpen = false;
    this.isLockScreenTimeoutDropDownOpen = false;
    this.isDesktopBkgrndDropDownOpen = false;
    this.isTaskbarCombinationDropDownOpen = false;
    this.isTaskbarPositionDropDownOpen = false;
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
  getStorageData():void{
    const totalCapacityInBytes = Constants.STORAGE_CAPACITY;
    const usedInBytes = Math.min(this._fileService.getUsedStorage(), totalCapacityInBytes);
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

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;
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
      { icon: this.systemImg, title: this.SYSTEM_VIEW, subtitle: this.SYSTEM_VIEW_EXTRA },
      { icon: this.appsImg, title: this.APPS_VIEW, subtitle: this.APPS_VIEW_EXTRA },
      { icon: this.personalizationImg, title: this.PERSONALIZATION_VIEW, subtitle: this.PERSONALIZATION_VIEW_EXTRA },
    ];
  }

  generateSystemOptions():SettingsMenuOption[]{
    return [
      { icon: this.screenImg, title: this.SYSTEM_SCREEN },
      { icon: this.notificationImg, title: this.SYSTEM_NOTIFICATION },
      { icon: this.storageImg, title: this.SYSTEM_STORAGE },
      { icon: this.clipboardImg, title: this.SYSTEM_CLIPBOARD },
      { icon: this.aboutImg, title: this.SYSTEM_ABOUT },
    ];
  }

  generatePersonalizationOptions():SettingsMenuOption[]{
    return [
      { icon: this.desktopBackgroundImg, title: this.PERSONALIZATION_DESKTOP_BACKGROUND },
      { icon: this.lockScreenImg, title: this.PERSONALIZATION_LOCKSCREEN },
      { icon: this.taskbarImg, title: this.PERSONALIZATION_TASKBAR },
    ];
  }

  // The Apps panel has a single sidebar entry: "Apps & features".
  generateApplicationOptions():SettingsMenuOption[]{
    return [
      { icon: this.appsListImg, title: this.APPS_FEATURES },
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

  generateColorOptions():string[]{
    return Constants.LOCKSCREEN_DESKTOP_COLORS;
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

  async handleMenuSelection(selection:string, idx:number, evt:MouseEvent, view:string): Promise<void>{
    evt.stopPropagation();

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

  async handleDropDownChoiceAndSetBkgrnd(option?: { value: number, label: string }, evt?: MouseEvent): Promise<void>{
    if(evt)
      evt.stopPropagation();

    const delay = 50; //50 ms
    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND)? true: false;
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

          screenPrevElmnt.style.backgroundImage = color;
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

    this.colorOptions = this.generateColorOptions();
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

  startPictureSlideShow(screenPrevElmnt: HTMLDivElement, contentSet:string[]) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_PICTURE;
    this.startSlideShow(screenPrevElmnt, contentSet, type);
  }

  startColorSlideShow(screenPrevElmnt: HTMLDivElement) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR;
    const contentSet = this.generateColorOptions();
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

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR)
        this._defaultService.updateDefaultData(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR, selection);
    }else{
      const defaultLockScreenBackgroundValue = `${this.lockScreenBkgrndOption}:${selection}`;
      this._defaultService.updateDefaultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgroundValue);
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
    const defaultAutoHideValue = `${autoHideValue}`;
    this._defaultService.updateDefaultData(Constants.DEFAULT_AUTO_HIDE_TASKBAR, defaultAutoHideValue);
  }

  changeScreenSaverState():void{
    this.isScreenSaverActiveText = (this.isScreenSaverActive)? Constants.ON : Constants.OFF;
    this._defaultService.updateDefaultData(Constants.DEFAULT_SCREEN_SAVER_STATE, this.isScreenSaverActiveText);
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
