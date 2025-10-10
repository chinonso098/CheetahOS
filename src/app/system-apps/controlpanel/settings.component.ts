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

  readonly lckScrImg1 = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}duck_lake.png`;
  readonly lckScrImg2 = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}above_the_ocean.png`;
  readonly lckScrImg3 = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}highlands.png`;
  readonly lckScrImg4 = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}leafs.png`;
  readonly lckScrImg5 = `${Constants.LOCK_SCREEN_IMAGE_BASE_PATH}cafe.png`;

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

  lockScreenBkgrndOption = 'Mirror';
  lockScreenTimeoutOption = '1 Minute';


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
    { value: 60000, label: '1 Minute' },
    { value: 120000, label: '3 Minutes'},
    { value: 300000, label: '5 Minutes' },
    { value: 600000, label: '10 Minutes' }
  ];

  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;

  lockScreenBackgroundType = Constants.EMPTY_STRING;
  lockScreenBackgroundValue = Constants.EMPTY_STRING;
  
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
    this._hideStartMenuSub?.unsubscribe();
  }

  getLockScreenBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND).split(Constants.COLON);
    this.lockScreenBackgroundType = defaultBkgrnd[0];
    this.lockScreenBackgroundValue = defaultBkgrnd[1];
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
    const options = [this.lckScrImg1, this.lckScrImg2, this.lckScrImg3, this.lckScrImg4, this.lckScrImg5];
    return options;
  }

  handleSettingsPanelSelection(selection:string, evt:MouseEvent):void{
    evt.stopPropagation();
    this.DEFAULT_VIEW = selection;
  }

  handleMenuSelection(selection:string, idx:number, evt:MouseEvent, view:string):void{
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
        this.updateTime();
        this.getDate();
      }
      
      return;
    }
  }

  saveUnSaveClipBoardHisotry():void{
    //this.isSaveClipboardHistory = !this.isSaveClipboardHistory;
    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? this.ON : this.OFF;
  }

  onLockScreenBkgrndDropDownSelect(event: any):void{
    const selectedValue = event.target.value;
    this.lockScreenBkgrndOption = selectedValue;

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_SOLID_COLOR){
      const lockScreenPrevElmnt = document.getElementById(`lockScreenPrev-${this.processId}`) as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundColor = this.lockScreenBackgroundValue;
        lockScreenPrevElmnt.style.width = '320px';
        lockScreenPrevElmnt.style.minHeight = '180px';
        lockScreenPrevElmnt.style.backgroundImage = 'none';
        lockScreenPrevElmnt.style.backdropFilter = 'none';
      }

      this.colorOptions = this.generateColorOptions();
    }

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE){
      const lockScreenPrevElmnt = document.getElementById(`lockScreenPrev-${this.processId}`) as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundImage = `url(${this.lockScreenBackgroundValue})`;
        lockScreenPrevElmnt.style.backdropFilter = 'none';
        lockScreenPrevElmnt.style.backgroundColor = 'transparent';
        /* cover or 'contain', 'auto', or specific dimensions */
        lockScreenPrevElmnt.style.backgroundSize = 'cover';
        lockScreenPrevElmnt.style.backgroundRepeat = 'no-repeat';
      }

      this.lockScreenPictureOptions = this.generateLockScreenPictureOptions();
    }

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_MIRROR){

      const lockScreenPrevElmnt = document.getElementById(`lockScreenPrev-${this.processId}`)  as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundImage = 'none';
        lockScreenPrevElmnt.style.backdropFilter = 'none';
        lockScreenPrevElmnt.style.backgroundColor = 'transparent';
      }

      const defaultLockScreenBackgrounValue = `${this.lockScreenBkgrndOption}:${this.lockScreenBkgrndOption}`;
      this._defaultService.setDefultData(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, defaultLockScreenBackgrounValue)
    }
  }

  shhhh(evt:MouseEvent):void{
    evt.stopPropagation();
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
      const lockScreenPrevElmnt = document.getElementById(`lockScreenPrev-${this.processId}`) as HTMLDivElement;
      if(lockScreenPrevElmnt){
        lockScreenPrevElmnt.style.backgroundColor = selection;
        lockScreenPrevElmnt.style.width = '320px';
        lockScreenPrevElmnt.style.minHeight = '180px';
        lockScreenPrevElmnt.style.backgroundImage = 'none';
        lockScreenPrevElmnt.style.backdropFilter = 'none';
      }
    }

    if(this.lockScreenBkgrndOption === this.LOCKSCREEN_BACKGROUND_PICTURE){
      const lockScreenPrevElmnt = document.getElementById(`lockScreenPrev-${this.processId}`)  as HTMLDivElement;
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
