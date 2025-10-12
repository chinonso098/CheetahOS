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

  readonly ON = 'On';
  readonly OFF = 'Off';

  lockScreenBkgrndOption = Constants.EMPTY_STRING;
  lockScreenTimeoutOption = Constants.EMPTY_STRING;
  desktopBkgrndOption = Constants.EMPTY_STRING;

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
 clipboardSaveStateText = this.ON;

  selectedSystemOption = this.SYSTEM_SCREEN;
  selectedPersonalizationOption = this.PERSONALIZATION_DESKTOP_BACKGROUND;
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

  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;

  retrievedBackgroundType = Constants.EMPTY_STRING;
  retrievedBackgroundValue = Constants.EMPTY_STRING;


  isLockScreenBkgrndDropDownOpen = false;
  isLockScreenTimeoutDropDownOpen = false;
  isDesktopBkgrndDropDownOpen = false;
  
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
  }

  toggleLockScreenBkgrndDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isLockScreenBkgrndDropDownOpen = !this.isLockScreenBkgrndDropDownOpen;
  }

  toggleLockScreenTimeOutDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isLockScreenTimeoutDropDownOpen = !this.isLockScreenTimeoutDropDownOpen;
  }

  toggleDesktopBkgrndDropdown(evt:MouseEvent): void {
    evt.stopPropagation();
    this.isDesktopBkgrndDropDownOpen = !this.isDesktopBkgrndDropDownOpen;
  }


  @HostListener('document:click')
  onOutsideClick(): void {
    this.isLockScreenBkgrndDropDownOpen = false;
    this.isLockScreenTimeoutDropDownOpen = false;
    this.isDesktopBkgrndDropDownOpen = false;
  }

  getLockScreenBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND).split(Constants.COLON);
    this.retrievedBackgroundType = defaultBkgrnd[0];
    this.retrievedBackgroundValue = defaultBkgrnd[1];
    this.lockScreenBkgrndOption  = defaultBkgrnd[0];
  }

  getDesktopBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON);
    this.retrievedBackgroundType = defaultBkgrnd[0];
    this.retrievedBackgroundValue = defaultBkgrnd[1];
    this.desktopBkgrndOption  = defaultBkgrnd[0];
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
      return;
    }
  }

  saveUnSaveClipBoardHisotry():void{
    //this.isSaveClipboardHistory = !this.isSaveClipboardHistory;
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? this.ON : this.OFF;
  }

  async handleDropDownChoiceAndSetBkgrnd(option?: { value: number, label: string },   evt?: any): Promise<void>{
    if(evt)
      evt.stopPropagation();

    const delay = 100; //100 ms
    const isDesktopView = (this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND )? true: false;
    const styleClasses = (isDesktopView)
    ? ['desktop-preview__background-mirror-and-picture', 'desktop-preview__background-solid-color'] 
    : ['lockscreen-preview__background-mirror-and-picture', 'lockscreen-preview__background-solid-color'];

    let activeClass = Constants.EMPTY_STRING;
    let screenPrevElmnt!:HTMLDivElement;
    let isMirror = false;
    let isChanged = false;  

    if(option){
      const selectedValue = option.label;
      isChanged = true;

      if(!isDesktopView){
        this.lockScreenBkgrndOption = selectedValue;
        isMirror = (selectedValue === this.LOCKSCREEN_BACKGROUND_MIRROR);
      }else{
        this.desktopBkgrndOption = selectedValue;
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


    await this.handlePictureBkgrnd(screenPrevElmnt, activeClass, styleClasses, isChanged, isDesktopView);

    await this.handleMirrorAndDynamicBkgrnd(screenPrevElmnt, activeClass, styleClasses, isMirror, isChanged, isDesktopView)

    await this.handleSolidColorBkrgnd(screenPrevElmnt, activeClass, styleClasses, isChanged, isDesktopView);

    this.handleSlideShowBkgrnd(screenPrevElmnt, activeClass, styleClasses, isChanged, isDesktopView);
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
          const selection = (isChanged) 
          ? 'osdrive/Cheetah/Themes/Desktop/crown_station.jpg' 
          : `${this.retrievedBackgroundValue}`;
          
          const img = await this.getDesktopScreenShot(selection);
          screenPrevElmnt.style.backgroundImage = `url(${img})`;
        }else{
          screenPrevElmnt.style.backgroundImage = (isChanged) 
          ? 'url(osdrive/Cheetah/Themes/LockScreen/bamboo_moon.jpg)' 
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
    if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_MIRROR  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR && isChanged)
      || (this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_DYNAMIC  && !isChanged)
      || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC && isChanged)){

      if(screenPrevElmnt){
        const desktopBkgrndImg = await this.getDesktopScreenShot();

        activeClass = styleClasses[0];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass);
        screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
      }
      if(isDesktopView)
        this.desktopPictureOptions = this.generateDesktopPictureOptions();
    
      if(!isDesktopView && isMirror){
        const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
        this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
      }
    }
  }

  async handleSolidColorBkrgnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isChanged:boolean, isDesktopView:boolean): Promise<void>{
    if((this.retrievedBackgroundType === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && isChanged)
      || (this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_SOLID_COLOR  && !isChanged)
      || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR  && isChanged)){
      
      if(screenPrevElmnt){
        //screenPrevElmnt.style.backgroundColor = (isChanged) ?  '#0c0c0c' : this.retrievedBackgroundValue ;
        if(isDesktopView){
          activeClass = styleClasses[0];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);

          const color =(isChanged) ? '#0c0c0c' : this.retrievedBackgroundValue ;
          const desktopBkgrndImg = await this.getDesktopScreenShot(color);
          screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;

        }else{
          activeClass = styleClasses[1];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
          screenPrevElmnt.style.backgroundColor = (isChanged)? '#0c0c0c' : this.retrievedBackgroundValue ;
        }
      }
      
      this.colorOptions = this.generateColorOptions();
    }
  }

  handleSlideShowBkgrnd(screenPrevElmnt:HTMLDivElement, activeClass:string, styleClasses:string[], isChanged:boolean, isDesktopView:boolean):void{
    if((this.retrievedBackgroundType === this.LOCKSCREEN_SLIDE_SHOW  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_SLIDE_SHOW  && isChanged)
      || (this.retrievedBackgroundType === this.DESKTOP_BACKGROUND_SLIDE_SHOW  && !isChanged)
      || (this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW  && isChanged)){

      if(isDesktopView){
        const defaultDesktopBackgrounValue = `${this.desktopBkgrndOption}:${this.desktopBkgrndOption}`;
        this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue);
      }else{
        const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
        this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
      }

      
      if(screenPrevElmnt){
        activeClass = styleClasses[0];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass);
        this.startPictureSlideShow(screenPrevElmnt)
      }


    }
  }

  startPictureSlideShow(screenPrevElmnt: HTMLDivElement) {
    throw new Error('Method not implemented.');
    screenPrevElmnt.style.backgroundColor =  '#0c0c0c';
  }

  setStyle(screenPrevElmnt: HTMLDivElement, styleClasses:string[], activeClass:string) {
    // 🧹 Reset previous inline styles
    this.resetInlineStyles(screenPrevElmnt);
    screenPrevElmnt.classList.remove(...styleClasses);
    screenPrevElmnt.classList.add(activeClass);
  }
  
  resetInlineStyles(screenPrevElmnt: HTMLDivElement) {
    screenPrevElmnt.style.backgroundImage = Constants.EMPTY_STRING;
    screenPrevElmnt.style.backgroundColor = Constants.EMPTY_STRING;
    screenPrevElmnt.style.backdropFilter = Constants.EMPTY_STRING;
    screenPrevElmnt.style.backgroundSize = Constants.EMPTY_STRING;
    screenPrevElmnt.style.backgroundRepeat = Constants.EMPTY_STRING;
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
    }else{
      const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${selection}`;
      this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
    }

    const styleClasses = (isDesktopView)
    ? ['desktop-preview__background-mirror-and-picture', 'desktop-preview__background-solid-color'] 
    : ['lockscreen-preview__background-mirror-and-picture', 'lockscreen-preview__background-solid-color'];

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE
      || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE
      || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){
      const screenPrevElmnt = (isDesktopView)
      ? document.getElementById('desktop_Preview') as HTMLDivElement 
      : document.getElementById('lockScreen_Preview') as HTMLDivElement;

      if(screenPrevElmnt){
        let img = Constants.EMPTY_STRING;
        // if(isDesktopView){ 
        //   img = await this.getDesktopScreenShot(selection);
        // }
        img = await this.getDesktopScreenShot(selection);

        activeClass = styleClasses[0];
        this.setStyle(screenPrevElmnt, styleClasses, activeClass);
        screenPrevElmnt.style.backgroundImage = (isDesktopView)? `url(${img})` : `url(${selection})`;
      }
    }

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR
      || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR ){
        
      const screenPrevElmnt = (isDesktopView)
      ? document.getElementById('desktop_Preview') as HTMLDivElement 
      : document.getElementById('lockScreen_Preview') as HTMLDivElement;

      if(screenPrevElmnt){
        if(isDesktopView){
          activeClass = styleClasses[0];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);

          const color = selection;
          const desktopBkgrndImg = await this.getDesktopScreenShot(color);
          screenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
        }else{

          activeClass = styleClasses[1];
          this.setStyle(screenPrevElmnt, styleClasses, activeClass);
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

  async getDesktopScreenShot(imgPathorColor = Constants.EMPTY_STRING):Promise<string>{

    console.log('this.selectedPersonalizationOption:', this.selectedPersonalizationOption);
    console.log('LockScreen State:', this.lockScreenBkgrndOption)
    console.log('Desktop State:', this.desktopBkgrndOption)

    let onlyBkGrnd = true, onlyForeGrnd = false, useVantaCanvas = false, imgResult = Constants.EMPTY_STRING;

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_LOCKSCREEN
      && this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR){

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){
        useVantaCanvas = true;
        imgResult = await this.getDesktopScreenShotHelper(Constants.EMPTY_STRING, onlyBkGrnd, onlyForeGrnd, useVantaCanvas);

      }else if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE 
        || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW){
          const dsktpBkGrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON)
          imgPathorColor = dsktpBkGrnd[1];
          console.log('image or color to use:', imgPathorColor);
        imgResult = await this.getDesktopScreenShotHelper(imgPathorColor, onlyBkGrnd, onlyForeGrnd,  useVantaCanvas);

      }else if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        const dsktpBkGrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON)
        const color = dsktpBkGrnd[1];
        console.log('color to use:', color);
        imgResult = await this.getDesktopScreenShotHelper(color, onlyBkGrnd, onlyForeGrnd, useVantaCanvas);
      }
    }

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_LOCKSCREEN
      && (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE
         || this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR )){

      imgResult = await this.getDesktopScreenShotHelper(imgPathorColor, onlyBkGrnd, onlyForeGrnd,  useVantaCanvas);
    }

    if(this.selectedPersonalizationOption === this.PERSONALIZATION_DESKTOP_BACKGROUND){
      onlyBkGrnd = false;

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_PICTURE 
        || this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SLIDE_SHOW){

        imgResult = await this.getDesktopScreenShotHelper(imgPathorColor, onlyBkGrnd, onlyForeGrnd,  useVantaCanvas);
      }

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_DYNAMIC){

        //make sure vanta is present
        const mergeImage = true;
        const changeBkgrndColor = true;
        imgResult = await this.getDesktopScreenShotHelper(imgPathorColor, onlyBkGrnd, onlyForeGrnd,  useVantaCanvas, mergeImage, changeBkgrndColor);
      }

      if(this.desktopBkgrndOption === this.DESKTOP_BACKGROUND_SOLID_COLOR){
        onlyForeGrnd = true;
        imgResult = await this.getDesktopScreenShotHelper(imgPathorColor, onlyBkGrnd, onlyForeGrnd,  useVantaCanvas);
      }
    }

    return imgResult;
  }

  async getDesktopScreenShotHelper(imgPathorColor = Constants.EMPTY_STRING, onlyBkGrnd:boolean, onlyForeGrnd:boolean, useVantaCanvas:boolean, mergeImage = false, changeBkgrndColor = false):Promise<string>{

    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    const useImagePath = (CommonFunctions.isPath(imgPathorColor)  && !useVantaCanvas);
    const useColorBkgrnd = (!CommonFunctions.isPath(imgPathorColor) && !useVantaCanvas);

    console.log('useImagePath:',useImagePath);
    console.log('useColorBkgrnd:', useColorBkgrnd);

    let bkGrndImg = Constants.EMPTY_STRING;
    const vantaImg = new Image();

    if(!onlyForeGrnd){
      if(useColorBkgrnd){
        bkGrndImg = await this.getFalseForeGrndScreenShot(imgPathorColor);
      }
  
      if(useImagePath)
        bkGrndImg = imgPathorColor;
  
      if(useVantaCanvas)
        bkGrndImg = await this.getVantaBkgrndScreenShot();
  
      if(onlyBkGrnd)
        return bkGrndImg;
  
      vantaImg.src = bkGrndImg;
      await vantaImg.decode();
    }

    const foreGrndImg = new Image();
    const foreGrndDataUrl = await this.getForeGrndScreenShot(imgPathorColor);

    if(!mergeImage)
        return foreGrndDataUrl;


    foreGrndImg.src = foreGrndDataUrl;
    await foreGrndImg.decode();

    const mergedImg = document.createElement('canvas');
    mergedImg.width = dsktpCntnrElmnt.offsetWidth;
    mergedImg.height = dsktpCntnrElmnt.offsetHeight; 

    const ctx = mergedImg.getContext('2d')!;
    if (!ctx) {
      console.error('Failed to get 2D rendering context.');
      return Constants.EMPTY_STRING;
    }
    // 1. Draw the Vanta background image first.
    ctx.drawImage(vantaImg, 0, 0, mergedImg.width, mergedImg.height);
    
    // 2. Draw the HTML content on top of the background.
    ctx.drawImage(foreGrndImg, 0, 0, mergedImg.width, mergedImg.height);
    ctx.imageSmoothingEnabled = true;

    return mergedImg.toDataURL('image/png');
  }
  
  async getVantaBkgrndScreenShot(): Promise<string>{ 
    const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    await htmlToImage.toPng(dsktpCntnrElmnt);
    const canvasElmnt = document.querySelector('.vanta-canvas') as HTMLCanvasElement;
    const bkGrndImg = canvasElmnt.toDataURL('image/png');

    return bkGrndImg;
  }

  async getForeGrndScreenShot(currentColor:string, changeBkgrndColor = false):Promise<string>{
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

  async getFalseForeGrndScreenShot(color: string): Promise<string> {
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
    // link.download = 'test-canva.png';
    // link.href = dataUrl;
    // link.click();
  
    return dataUrl;
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
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
