import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup } from '@angular/forms';

import * as htmlToImage from 'html-to-image';

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
  private _hideStartMenuSub!:Subscription;

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

  readonly PERSONALIZATION_DESKTOP_BACKGROUND = 'Background';
  readonly PERSONALIZATION_LOCKSCREEN = 'Lock screen';
  readonly PERSONALIZATION_TASKBAR = 'Taskbar';
  //readonly PERSONALIZATION_COLOR = 'Color';

  readonly LOCKSCREEN_BACKGROUND_PICTURE = Constants.LOCKSCREEN_BACKGROUND_PICTURE;
  readonly LOCKSCREEN_BACKGROUND_SOLID_COLOR = Constants.LOCKSCREEN_BACKGROUND_SOLID_COLOR;
  readonly LOCKSCREEN_BACKGROUND_MIRROR = Constants.LOCKSCREEN_BACKGROUND_MIRROR;

  readonly ON = 'On';
  readonly OFF = 'Off';

  lockScreenBkgrndOption = Constants.EMPTY_STRING;
  lockScreenTimeoutOption = Constants.EMPTY_STRING;

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
  colorOptions!:string[];
  settingsOptions!:string[][];
  systemOptions!:string[][];
  personalizationOptions!:string[][];

  lockScreenBackgroundOptions = [
    { value: 0, label: this.LOCKSCREEN_BACKGROUND_PICTURE },
    { value: 1, label: this.LOCKSCREEN_BACKGROUND_SOLID_COLOR},
    { value: 2, label: this.LOCKSCREEN_BACKGROUND_MIRROR }
  ];

  lockScreenTimeOutOptions = [
    { value: 30000, label: '30 Seconds'},
    { value: 60000, label: '1 Minute'},
    { value: 120000, label: '2 Minutes'},
    { value: 240000, label: '4 Minutes'},
    { value: 480000, label: '8 Minutes'}
  ];

  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;

  retrievedLockScreenBackgroundType = Constants.EMPTY_STRING;
  retrievedLockScreenBackgroundValue = Constants.EMPTY_STRING;
  
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

  getLockScreenBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND).split(Constants.COLON);
    this.retrievedLockScreenBackgroundType = defaultBkgrnd[0];
    this.retrievedLockScreenBackgroundValue = defaultBkgrnd[1];
    this.lockScreenBkgrndOption  = defaultBkgrnd[0];
  }

  getLockScreenTimeOutData():void{
    const defaultTimeOut = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT).split(Constants.COLON);
    this.lockScreenTimeoutOption = defaultTimeOut[0];
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

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

  handleSettingsPanelSelection(selection:string, evt:MouseEvent):void{
    evt.stopPropagation();
    this.DEFAULT_VIEW = selection;
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
        await this.handleDropDownChoiceAndSetLockScreenBkgrnd();
      }
      
      return;
    }
  }

  saveUnSaveClipBoardHisotry():void{
    //this.isSaveClipboardHistory = !this.isSaveClipboardHistory;
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? this.ON : this.OFF;
  }

  async handleDropDownChoiceAndSetLockScreenBkgrnd(event?: any): Promise<void>{
    const delay = 100; //100 ms
    const styleClasses = ['lockscreen_preview_background_mirror_and_picture', 'lockscreen_preview_background_solid_color'];
    let activeClass = Constants.EMPTY_STRING;
    let lockScreenPrevElmnt!:HTMLDivElement;
    let isMirror = false;
    let isChanged = false;  

    if(event){
      const selectedValue = event.target.value;
      this.lockScreenBkgrndOption = selectedValue;
      isMirror = (selectedValue === this.LOCKSCREEN_BACKGROUND_MIRROR)
      isChanged = true;
    }

 
    lockScreenPrevElmnt = document.getElementById('lockScreen_Preview') as HTMLDivElement;
    if(!lockScreenPrevElmnt){
      await CommonFunctions.sleep(delay);
      lockScreenPrevElmnt = document.getElementById('lockScreen_Preview') as HTMLDivElement;
    }

    if((this.retrievedLockScreenBackgroundType === this.LOCKSCREEN_BACKGROUND_PICTURE  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE && isChanged)){

      if(lockScreenPrevElmnt){
        activeClass = styleClasses[0];
        this.setStyle(lockScreenPrevElmnt, styleClasses, activeClass);
        lockScreenPrevElmnt.style.backgroundImage = (isChanged) 
        ? 'url(osdrive/Cheetah/Themes/LockScreen/bamboo_moon.jpg)' 
        : `url(${this.retrievedLockScreenBackgroundValue})`;
      }

      this.lockScreenPictureOptions = this.generateLockScreenPictureOptions();
    }


    if((this.retrievedLockScreenBackgroundType === this.LOCKSCREEN_BACKGROUND_MIRROR  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR && isChanged)){

      if(lockScreenPrevElmnt){
        const desktopBkgrndImg = await this.getDesktopScreenShot();
        activeClass = styleClasses[0];
        this.setStyle(lockScreenPrevElmnt, styleClasses, activeClass);
        lockScreenPrevElmnt.style.backgroundImage = `url(${desktopBkgrndImg})`;
      }

      if(isMirror){
        const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
        this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
      }
    }


    if((this.retrievedLockScreenBackgroundType === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && !isChanged)
      || (this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR  && isChanged)){
      
      if(lockScreenPrevElmnt){
        activeClass = styleClasses[1];
        this.setStyle(lockScreenPrevElmnt, styleClasses, activeClass);
        lockScreenPrevElmnt.style.backgroundColor = (isChanged) ?  '#0c0c0c' : this.retrievedLockScreenBackgroundValue ;
      }

      this.colorOptions = this.generateColorOptions();
    }
  }

  setStyle(lockScreenPrevElmnt: HTMLDivElement, styleClasses:string[], activeClass:string) {
    // 🧹 Reset previous inline styles
    this.resetInlineStyles(lockScreenPrevElmnt);
    lockScreenPrevElmnt.classList.remove(...styleClasses);
    lockScreenPrevElmnt.classList.add(activeClass);
  }
  
  resetInlineStyles(lockScreenPrevElmnt: HTMLDivElement) {
    lockScreenPrevElmnt.style.backgroundImage = Constants.EMPTY_STRING;
    lockScreenPrevElmnt.style.backgroundColor = Constants.EMPTY_STRING;
    lockScreenPrevElmnt.style.backdropFilter = Constants.EMPTY_STRING;
    lockScreenPrevElmnt.style.backgroundSize = Constants.EMPTY_STRING;
    lockScreenPrevElmnt.style.backgroundRepeat = Constants.EMPTY_STRING;
  }

  onLockScreenTimeoutSelect(event: any):void{
    const selectedValue = event.target.value;
    this.lockScreenTimeoutOption = selectedValue;

    const timeOutValue = this.lockScreenTimeOutOptions.find(x => x.label === this.lockScreenTimeoutOption)?.value;

    const defaultLockScreenBackgrounValue = `${this.lockScreenTimeoutOption}:${timeOutValue}`;
    this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT, defaultLockScreenBackgrounValue);
  }

  handleLockScreenPictureAndColorSelection(selection:string, evt:MouseEvent):void{
    evt.stopPropagation();

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR){
      const lockScreenPrevElmnt = document.getElementById('lockScreen_Preview') as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundColor = selection;
        lockScreenPrevElmnt.style.width = '320px';
        lockScreenPrevElmnt.style.minHeight = '180px';
        lockScreenPrevElmnt.style.backgroundImage = 'none';
        lockScreenPrevElmnt.style.backdropFilter = 'none';
      }
    }

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE){
      const lockScreenPrevElmnt = document.getElementById('lockScreen_Preview')  as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundImage = `url(${selection})`;
        lockScreenPrevElmnt.style.backdropFilter = 'none';
        lockScreenPrevElmnt.style.backgroundColor = 'transparent';
        /* cover or 'contain', 'auto', or specific dimensions */
        lockScreenPrevElmnt.style.backgroundSize = 'cover';
        lockScreenPrevElmnt.style.backgroundRepeat = 'no-repeat';
      }
    }

    const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${selection}`;
    this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue);
  }


  async getDesktopScreenShot():Promise<string>{
    const dsktpCntnrElmnt = document.getElementById('vanta') as HTMLElement;
    const canvasElmnt = document.querySelector('.vanta-canvas') as HTMLCanvasElement;

      const htmlImg = await htmlToImage.toPng(dsktpCntnrElmnt);
      const vantaImg = new Image();
      const bkgrndImg =  canvasElmnt.toDataURL('image/png');
      vantaImg.src = bkgrndImg;

      return bkgrndImg
      //await vantaImg.decode();

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
