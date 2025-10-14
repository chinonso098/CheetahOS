import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

import { FormBuilder, FormGroup } from '@angular/forms';
import * as htmlToImage from 'html-to-image';
import {basename, extname} from 'path';

import { CommonFunctions } from 'src/app/system-files/common.functions';
import { ScreenshotSetting } from './settings.interface';
import { interval } from 'rxjs';


@Component({
  selector: 'cos-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class SettingsComponent implements OnInit, OnDestroy {

  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _defaultService:DefaultService;
  private _windowService:WindowService;


  readonly homeImg = `${Constants.IMAGE_BASE_PATH}cp_home.png`;
  readonly aboutImg = `${Constants.IMAGE_BASE_PATH}cp_info.png`;
  readonly notificationImg = `${Constants.IMAGE_BASE_PATH}cp_notification.png`;
  readonly storageImg = `${Constants.IMAGE_BASE_PATH}cp_storage.png`;
  readonly screenImg = `${Constants.IMAGE_BASE_PATH}cp_screen.png`;
  readonly clipboardImg = `${Constants.IMAGE_BASE_PATH}cp_clipboard.png`;

  readonly systemImg = `${Constants.IMAGE_BASE_PATH}cp_system.png`;
  readonly appsImg = `${Constants.IMAGE_BASE_PATH}cp_apps.png`;
  readonly personalizationImg = `${Constants.IMAGE_BASE_PATH}cp_personalization.png`;

  readonly desktopBackgrounImg = `${Constants.IMAGE_BASE_PATH}cp_background.png`;
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
  DEFAULT_VIEW = this.HOME_VIEW;

  readonly HOME_HOME = 'Home';

  readonly SYSTEM_ABOUT = 'About';
  readonly SYSTEM_NOTIFICATION = 'Notifications & actions';
  readonly SYSTEM_STORAGE = 'Storage';
  readonly SYSTEM_SCREEN = 'Screen';
  readonly SYSTEM_CLIPBOARD = 'Clipboard';

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
  taskBarPostionOption = 'Bottom';
  taskBarCombinationOption = Constants.EMPTY_STRING;

  private _formBuilder:FormBuilder;
  searchBarForm!: FormGroup;

  searchPlaceHolder = 'Find a setting';

  readonly clipboardText =
`When you copy or cut something in Cheetah, it's copied to the
 clipboad for you to paste.`;

  readonly clipboardHisotryText = 
`Save multiple items to the clipboard to use later. Press the
 Cheetah logo key + V to view your clipboard history and paste
 from it.`;

 isSaveClipboardHistory = true;
 isAutoHideTaskBar = false;
 clipboardSaveStateText = Constants.ON;
 autoHideTaskBarText = Constants.OFF;

  selectedSystemOption = this.SYSTEM_SCREEN;
  selectedPersonalizationOption = this.PERSONALIZATION_DESKTOP_BACKGROUND;
  prevSelectedPersonalizationOption = this.PERSONALIZATION_DESKTOP_BACKGROUND;

  selectedApplicationOption = Constants.EMPTY_STRING;
  selectedIdx = 0;

  lockScreenPictureOptions!:string[];
  desktopPictureOptions!:string[];
  colorOptions!:string[];
  settingsOptions!:string[][];
  systemOptions!:string[][];
  personalizationOptions!:string[][];

  lockScreenBackgroundOptions = [
    { value: 0, label: this.LOCKSCREEN_BACKGROUND_PICTURE },
    { value: 1, label: this.LOCKSCREEN_BACKGROUND_SOLID_COLOR},
    { value: 2, label: this.LOCKSCREEN_BACKGROUND_MIRROR },
    { value: 3, label: this.LOCKSCREEN_SLIDE_SHOW }
  ];

  lockScreenTimeOutOptions = [
    { value: 30000, label: '30 Seconds'},
    { value: 60000, label: '1 Minute'},
    { value: 120000, label: '2 Minutes'},
    { value: 240000, label: '4 Minutes'},
    { value: 480000, label: '8 Minutes'}
  ];

  desktopBackgroundOptions = [
    { value: 0, label: this.LOCKSCREEN_BACKGROUND_PICTURE },
    { value: 1, label: this.LOCKSCREEN_BACKGROUND_SOLID_COLOR},
    { value: 2, label: this.DESKTOP_BACKGROUND_DYNAMIC },
    { value: 3, label: this.DESKTOP_BACKGROUND_SLIDE_SHOW }
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

  retrievedBackgroundType = Constants.EMPTY_STRING;
  retrievedBackgroundValue = Constants.EMPTY_STRING;


  isLockScreenBkgrndDropDownOpen = false;
  isLockScreenSlideShowDropDownOpen = false;
  isLockScreenTimeoutDropDownOpen = false;
  isDesktopBkgrndDropDownOpen = false;
  isTaskbarPostionDropDownOpen = false;
  isTaskbarCombinationDropDownOpen = false;

  SlideShowIntervalId!: NodeJS.Timeout;
  
  isMaximizable = false;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}settings.png`;
  name = 'settings';
  processId = 0;
  type = ComponentType.System
  displayName = Constants.EMPTY_STRING;


  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService,  windowService:WindowService, 
               defaultService:DefaultService, formBuilder:FormBuilder) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._defaultService = defaultService
    this._formBuilder = formBuilder;

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
  }

  ngOnDestroy(): void {
    // a wired bug. I shouldn't have to do this.
    this.stopSlideShow();
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

  toggleTaskBarPostionDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isTaskbarPostionDropDownOpen = !this.isTaskbarPostionDropDownOpen;
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
    this.isTaskbarPostionDropDownOpen = false;
  }

  getLockScreenBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND).split(Constants.COLON);
    this.retrievedBackgroundType = defaultBkgrnd[0];
    this.retrievedBackgroundValue = defaultBkgrnd[1];
    this.lockScreenBkgrndOption  = defaultBkgrnd[0];

    if(defaultBkgrnd[0] === this.LOCKSCREEN_SLIDE_SHOW){
      this.lockScreenSlideShowOption =  this.SLIDE_SHOW_COLOR; // defaultBkgrnd[1];
    }
  }

  getDesktopBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON);
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
    const defaultTimeOut = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT).split(Constants.COLON);
    this.lockScreenTimeoutOption = defaultTimeOut[0];
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    this.onOutsideClick();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  generateControlPanelOptions():string[][]{
    const options = [[this.systemImg, this.SYSTEM_VIEW, this.SYSTEM_VIEW_EXTRA], [this.appsImg, this.APPS_VIEW,  this.APPS_VIEW_EXTRA],  
                     [this.personalizationImg, this.PERSONALIZATION_VIEW, this.PERSONALIZATION_VIEW_EXTRA]];
    return options;
  }

  generateSystemOptions():string[][]{
    const options = [[this.screenImg, this.SYSTEM_SCREEN], [this.notificationImg, this.SYSTEM_NOTIFICATION],  
                     [this.storageImg, this.SYSTEM_STORAGE], [this.clipboardImg, this.SYSTEM_CLIPBOARD], [this.aboutImg, this.SYSTEM_ABOUT]];
    return options;
  }

  generatePersonalizationOptions():string[][]{
    const options = [[this.desktopBackgrounImg, this.PERSONALIZATION_DESKTOP_BACKGROUND], [this.lockScreenImg, this.PERSONALIZATION_LOCKSCREEN],  
                     [this.taskbarImg, this.PERSONALIZATION_TASKBAR]];
    return options;
  }

  generateColorOptions():string[]{
    const options = ['#fe8d00', '#e91022', '#d13337', '#c30052', '#bf0077', '#9a0088', '#871499', '#754caa',
                    '#0f893e', '#0c7d10', '#008473', '#2b7d9a', '#0063b1', '#6a68d6', '#8f8cd6', '#8664ba',
                    '#008386', '#45695f', '#525f54', '#7e7360', '#4c4a48', '#4f5d6b', '#4a545a', '#000203'];
    return options;
  }

  generateLockScreenPictureOptions():string[]{
    const options:string[] = [];
    const lockScreenImgPath = Constants.LOCK_SCREEN_IMAGE_BASE_PATH;
    const lockScreenImages = ['bamboo_moon.jpg', 'duck_lake.jpeg', 'forza_5.jpeg', 'highland_view.jpg',
                              'leaf_colors.jpg', 'lofi_coffee.jpeg', 'mountain_babel.jpg', 'mystic_isle.jpg', 
                              'over_the_ocean.jpg', 'paradise_island.jpg', 'purple_reign.jpg', 'win_xp_bliss.jpeg'];

    lockScreenImages.forEach( imgName =>{ options.push(`${lockScreenImgPath}${imgName}`) });
    return options;
  }

  generateDesktopPictureOptions():string[]{
    const options:string[] = [];
    const desktopImgPath = Constants.DESKTOP_IMAGE_BASE_PATH;
    const isDyanmicBkgrnd = (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC )? true: false;

    const desktopImages = (isDyanmicBkgrnd)
    ?['vanta_wave.jpg', 'vanta_halo.jpg', 'vanta_ring.jpg', 'vanta_globe.jpg', 'vanta_bird.jpg']
    :['crown_station.jpg', 'cyber_city.jpg', 'fractal_design.jpeg', 'landscape.jpg',
    'mineral_heart.jpg', 'summer_vibe.jpg', 'sun_set.jpg', 'win_seven.jpg'];

    desktopImages.forEach( imgName =>{ options.push(`${desktopImgPath}${imgName}`) });
    return options;
  }

  async handleSettingsPanelSelection(selection:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    this.DEFAULT_VIEW = selection;

    if(selection === this.PERSONALIZATION_VIEW){
      this.getDesktopBackgroundData();
      await this.handleDropDownChoiceAndSetBkgrnd();
    }
  }

  async handleMenuSelection(selection:string, idx:number, evt:MouseEvent, view:string): Promise<void>{
    evt.stopPropagation();

    if(idx === -1 && view === this.HOME_VIEW){
      this.DEFAULT_VIEW = this.HOME_VIEW;
      return;
    }

    if(view === this.SYSTEM_VIEW){
      this.selectedSystemOption = selection;
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
        this.updateTime();
        this.getDate();
        await this.handleDropDownChoiceAndSetBkgrnd();
      }

      if(selection ===  this.PERSONALIZATION_DESKTOP_BACKGROUND){
        this.getDesktopBackgroundData();
        await this.handleDropDownChoiceAndSetBkgrnd();
      }

      if(selection ===  this.PERSONALIZATION_TASKBAR){
        this.getTaskbarData();
        this.handleTaskbarChoice();
      }
      return;
    }
  }

  saveUnSaveClipBoardHisotry():void{
    //this.isSaveClipboardHistory = !this.isSaveClipboardHistory;
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? Constants.ON : Constants.OFF;
  }

  async handleDropDownChoiceAndSetBkgrnd(option?: { value: number, label: string },   evt?: any): Promise<void>{
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
      this.handleSlideShowBkgrnd(screenPrevElmnt, activeClass, styleClasses, isDesktopView, this.retrievedBackgroundValue);
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
            const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${selection}`;
            this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);
          }

          const img = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);
          screenPrevElmnt.style.backgroundImage = `url(${img})`;
        }else{
          const defaultImg = 'osdrive/Cheetah/Themes/LockScreen/bamboo_moon.jpg';
          screenPrevElmnt.style.backgroundImage = (isChanged) 
          ? `url(${defaultImg})` 
          : `url(${this.retrievedBackgroundValue})`;
        }
      }

      if(!isDesktopView)
        this.lockScreenPictureOptions = this.generateLockScreenPictureOptions();
      else
        this.desktopPictureOptions = this.generateDesktopPictureOptions();
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
            const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${this.checkAndVantaCase(selection)}`;
            this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);
          }

          await CommonFunctions.sleep(delay);
          const desktopBkgrndImg = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);  
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
        }
      }
      this.desktopPictureOptions = this.generateDesktopPictureOptions();
    }else{
      if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_MIRROR  && !isChanged)
        || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR && isChanged)){

        if(isMirror){
          const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
          this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
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
          activeClass = styleClasses[0];
          const prevSolidColor = this._defaultService.getDefaultSetting(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR);
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);

          const color =(isChanged) ? prevSolidColor: this.retrievedBackgroundValue ;
          const desktopBkgrndImg = await this.getDesktopScreenShot(color);
          screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;

          if(isChanged){
            //auto apply
            const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${prevSolidColor}`;
            this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);
          }
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
        const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${type}`;
        this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);
        images.push(...this.generateDesktopPictureOptions());
      }else{
        const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${type}`;
        this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
        images.push(...this.generateLockScreenPictureOptions());
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
    this.SlideShowIntervalId = CommonFunctions.startSlideShow(screenPrevElmnt, contentSet, setType);
  }

  stopSlideShow():void{
    CommonFunctions.stopSlideShow(this.SlideShowIntervalId);
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
    const defaultLockScreenBackgrounValue = `${this.lockScreenTimeoutOption}:${timeOutValue}`;
    this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT, defaultLockScreenBackgrounValue);
  }

  async handleScreenPictureAndColorSelection(selection:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();

    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND )? true: false;
    let activeClass = Constants.EMPTY_STRING;

    if(isDesktopView){
      const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${this.checkAndVantaCase(selection)}`;
      this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC)
        this._defaultService.setDefultData(Constants.DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG, selection);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE)
        this._defaultService.setDefultData(Constants.DEFAULT_PREVIOUS_DESKTOP_PICTURE, selection);

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR)
        this._defaultService.setDefultData(Constants.DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR, selection);
    }else{
      const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${selection}`;
      this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
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

        if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){;
          const img = await this.getDesktopScreenShot(selection, Constants.EMPTY_STRING);
          screenPrevElmnt.style.backgroundImage =`url(${img})`;
        }else{
          const img = await this.getDesktopScreenShot(Constants.EMPTY_STRING, selection);
          screenPrevElmnt.style.backgroundImage =`url(${img})`;
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

    const setting = this.getDefaultScreenShot();
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
          const dsktpBkGrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON);

          setting.imgPath = dsktpBkGrnd[1];
          setting.isImage = true;
          console.log('image to use:', dsktpBkGrnd[1]);

        imgResult = dsktpBkGrnd[1];
      }

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        const dsktpBkGrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON)
        setting.colorValue = dsktpBkGrnd[1]; setting.isColor = true;

        console.log('color to use:', dsktpBkGrnd[1]);
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
      bkGrndImg =  this.getFalseForeGroundScreenShot(setting.colorValue);

      if(setting.onlyBackGround)
        return bkGrndImg;
    }

    if(setting.isImage && intent === this.MERGE_BACKGROUND_AND_FOREGROUND){
      const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
      const backGroungImgCntnr = new Image();
      backGroungImgCntnr.src = setting.imgPath;
      await backGroungImgCntnr.decode();

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
      ctx.drawImage(backGroungImgCntnr, 0, 0, mergedImg.width, mergedImg.height);
      
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
      this.changeMainDkstpBkgrndColor(colorOff);

    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    const htmlImg = await htmlToImage.toPng(dsktpCntnrElmnt);

    if(changeBkgrndColor)
      this.changeMainDkstpBkgrndColor(colorOn);

    return htmlImg;
  }

   getFalseForeGroundScreenShot(color: string): string {
    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;

    const canvas = document.createElement('canvas');
    canvas.width = dsktpCntnrElmnt.offsetWidth;
    canvas.height = dsktpCntnrElmnt.offsetHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    const dataUrl = canvas.toDataURL('image/png');
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    // const link = document.createElement('a');
    // link.download = 'test-img.png';
    // link.href = dataUrl;
    // link.click();
  
    return dataUrl;
  }

  private getDefaultScreenShot():ScreenshotSetting{
    return{ imgPath: Constants.EMPTY_STRING, 
            isImage:false,
            colorValue:Constants.EMPTY_STRING,
            isColor:false,
            onlyBackGround:true, 
            onlyForeGround:false,
            useVantaCanvas:false,
            mergeImage:false,
            changeBackGrndColor:false}
  }
  
  private changeMainDkstpBkgrndColor(color: string): void {
    const mainElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    if (mainElmnt) {
      mainElmnt.style.backgroundColor = color;
    }
  }

  shhhh(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  handleTaskbarChoice(option?: { value: number, label: string },   evt?:MouseEvent):void{

  }

  updateTime():void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    //const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    this.currentTime = `${formattedHours}:${formattedMinutes}`;
  }

  getDate():void{
    const now = new Date();
    this.currentDate = now.toLocaleString('en-US', {
      weekday: 'long', // Full day name (e.g., "Tuesday")
      month:'long',
      day:'numeric'
    });
  }
  
  async handleTaskBarCombinationSelection(option: { value: number, label: string },  evt: any): Promise<void>{
    evt.stopPropagation();

    const selectedValue = option.label;
    this.taskBarCombinationOption = selectedValue;
    this._defaultService.setDefultData(Constants.DEFAULT_TASKBAR_COMBINATION, selectedValue);
  }

  saveUnSaveAutoHideTaskBar():void{
    this.autoHideTaskBarText = (this.isAutoHideTaskBar)? Constants.ON : Constants.OFF;
    const autoHideValue = (this.isAutoHideTaskBar)? Constants.TRUE : Constants.FALSE;
    const defaultAutoHideValue = `${autoHideValue}`;
    this._defaultService.setDefultData(Constants.DEFAULT_AUTO_HIDE_TASKBAR, defaultAutoHideValue);
  }
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
