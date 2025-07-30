/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { GeneralMenu } from 'src/app/shared/system-component/menu/menu.types';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  standalone:false,
})

export class LoginComponent implements OnInit, AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _systemNotificationServices:SystemNotificationService;
  private _sessionManagmentService:SessionManagmentService
  private _audioService:AudioService;


  loginForm!: FormGroup;
  _formBuilder!:FormBuilder
  formCntrlName = 'loginInput';

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;

  authFormTimeoutId!: NodeJS.Timeout;
  lockScreenTimeoutId!: NodeJS.Timeout;

  showUserInfo = true;
  showPasswordEntry = true;
  showLoading = false;
  showFailedEntry = false;
  showRestartShutDown = false;
  showPowerMenu = false;
  isPowerMenuVisible = false;
  isScreenLocked = true;
  isUserLogedIn = false;
  isFirstLogIn = false;

  powerMenuStyle:Record<string, unknown> = {};
  powerMenuOption = Constants.POWER_MENU_OPTION;

  readonly cheetahLogonKey = Constants.CHEETAH_LOGON_KEY;
  readonly cheetahPwrKey = Constants.CHEETAH_PWR_KEY;

  incorrectPassword = 'The password is incorrect. Try again.';
  exitMessage = Constants.EMPTY_STRING;
  authForm = 'AuthenticationForm';
  currentDateTime = 'DateTime'; 
  viewOptions = Constants.EMPTY_STRING;

  cheetahUnlockAudio = `${Constants.AUDIO_BASE_PATH}cheetah_unlock.wav`;
  cheetahRestarAndShutDownAudio = `${Constants.AUDIO_BASE_PATH}cheetah_shutdown.wav`;

  userIcon = `${Constants.ACCT_IMAGE_BASE_PATH}default_user.png`;
  pwrBtnIcon = `${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`;
  loadingGif = `${Constants.GIF_BASE_PATH}cheetah_loading.gif`;

  readonly defaultPassWord = "1234";

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_authentication';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  

  menuData:GeneralMenu[] = [];

  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, audioService:AudioService, 
              formBuilder: FormBuilder, sessionManagmentService:SessionManagmentService, systemNotificationServices:SystemNotificationService){
    this._processIdService = processIdService;
    this.processId = this._processIdService.getNewProcessId();
    this._audioService = audioService;
    this._formBuilder = formBuilder;
    this._systemNotificationServices = systemNotificationServices;
    this._sessionManagmentService = sessionManagmentService;

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._systemNotificationServices.resetLockScreenTimeOutNotify.subscribe(() => { this.resetLockScreenTimeOut()});

    this._systemNotificationServices.shutDownSystemNotify.subscribe(() => { this.shutDownOSFromDesktop()});
    this._systemNotificationServices.restartSystemNotify.subscribe((p) => { 
      if(p === Constants.RSTRT_ORDER_LOCK_SCREEN){
        this.restartOSFromDesktop()
      }
    });
  }

  ngOnInit():void {
    this.firstToDo();
    this.retrievePastSessionData();


    if(this.isUserLogedIn){
      this.showDesktop();
    }else{this.showLockScreen()}
  }

  ngAfterViewInit(): void {
    1//this._runningProcessService.showLockScreenNotify.next();
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

  firstToDo():void{
    this.loginForm = this._formBuilder.nonNullable.group({
      loginInput: '',
    });

    this.viewOptions =  this.currentDateTime;
    const secondsDelay = [1000, 360000];  // Update time every second
    this.updateTime(); // Set initial time
    this.getDate();

    setInterval(() => {
      this.updateTime();
    }, secondsDelay[0]); 

    setInterval(() => {
      this.getDate();
    }, secondsDelay[1]); 

    this._systemNotificationServices.showLockScreenNotify.next();
    this._systemNotificationServices.setIsScreenLocked(this.isScreenLocked);
    this.getPowerMenuData();
  }

  getDate():void{
    const now = new Date();
    this.currentDate = now.toLocaleString('en-US', {
      weekday: 'long', // Full day name (e.g., "Tuesday")
      month:'long',
      day:'numeric'
    });
  }

  onKeyDown(evt:KeyboardEvent):void{
    if(evt.key === Constants.BLANK_SPACE){
      this.showAuthForm();
    }
  }

  onLockScreenViewClick():void{
    this.showPowerMenu = false;
    this.showAuthForm();
  }

  showAuthForm():void{
    this.viewOptions = this.authForm;
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'blur(40px)';
      lockScreenElmnt.style.transition = 'backdrop-filter 0.4s ease';

      this.startAuthFormTimeOut();
    }
  }

  startAuthFormTimeOut():void{
    const secondsDelay = 60000; //wait 1 min
    this.authFormTimeoutId = setTimeout(() => {
      this.loginForm.controls[this.formCntrlName].setValue(null);
      this.showDateTime();
    }, secondsDelay);
  }

  showDateTime():void{
    this.viewOptions = this.currentDateTime;
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  onEnteringPassword(evt?:KeyboardEvent):void{
    const secondsDelays = [2500,3000]; //2.5 & 3 seconds
    if(evt?.key === "Enter"){
      const loginTxt = this.loginForm.value.loginInput as string;
      if(loginTxt === this.defaultPassWord){
        this.isUserLogedIn = true;
        this.showPasswordEntry = false;
        this.showLoading = true;
        setTimeout(() => {
          this.showDesktop();
        }, secondsDelays[0]);
      }else{
        this.showPasswordEntry = false;
        this.showLoading = true;
        setTimeout(() => {
          this.showLoading = false;
          this.showFailedEntry = true
        }, secondsDelays[1]);

        this.loginForm.controls[this.formCntrlName].setValue(null);
      }
    }
    this.resetAuthFormTimeOut();
  }

  onBtnClick():void{
    this.resetAuthFormState();
  }

  resetAuthFormTimeOut():void{
    clearTimeout(this.authFormTimeoutId);
    this.startAuthFormTimeOut();
  }

  resetAuthFormTimeOutOnly():void{
    clearTimeout(this.authFormTimeoutId);
  }

  showDesktop():void{ 
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '-1';
      lockScreenElmnt.style.backdropFilter = 'none';

      this.isScreenLocked = false;
      this._systemNotificationServices.showDesktopNotify.next();
      this._systemNotificationServices.setIsScreenLocked(this.isScreenLocked );
      this.startLockScreenTimeOut();

      if(this.isUserLogedIn && this.isFirstLogIn)
          this._audioService.play(this.cheetahUnlockAudio);

      this.resetAuthFormState();
      this.storeState(Constants.SIGNED_IN);
    }
  }

  showLockScreen(isShtDwnOrRstrt?:boolean):void{
    this.viewOptions = (isShtDwnOrRstrt === undefined)? this.currentDateTime : this.authForm;

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '6';
      lockScreenElmnt.style.backdropFilter = 'none';

      this.isScreenLocked = true;
      this.isFirstLogIn = true;
      this.loginForm.controls[this.formCntrlName].setValue(null);
      this._systemNotificationServices.showLockScreenNotify.next();
      this._systemNotificationServices.setIsScreenLocked(this.isScreenLocked);
      this.storeState(Constants.SIGNED_OUT);
    }
  }

  startLockScreenTimeOut():void{
    if(!this.isScreenLocked){
      const secondsDelay = 240000; //wait 4 mins;
      this.lockScreenTimeoutId = setTimeout(() => {
        this.showLockScreen();
      }, secondsDelay);
    }
  }

  resetLockScreenTimeOut():void{
    if(!this.isScreenLocked){
      clearTimeout(this.lockScreenTimeoutId);
      this.startLockScreenTimeOut();
    }
  }

  resetAuthFormState():void{
    this.showUserInfo = true;
    this.showPasswordEntry = true;
    this.showLoading = false;
    this.showFailedEntry = false;
    this.showRestartShutDown = false;
  }

  getPowerMenuData():void{
    this.menuData = [
      {icon:`${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`, label: 'Shut down', action: this.shutDownOSFromLockScreen.bind(this) },
      {icon:`${Constants.IMAGE_BASE_PATH}cheetah_restart.png`, label: 'Restart', action:this.restartOSFromLockScreen.bind(this)}
    ];
  }

  onPowerBtnClick(evt:MouseEvent):void{
    //The onLockScreenViewClick also listens for a click event. hence, i have to delay the response of onPowerBtnClick
    setTimeout(() => {
      if(!this.showPowerMenu && !this.isPowerMenuVisible){
        this.showPowerMenu = true;

        const powerBtnElmt = document.getElementById('powerBtnCntnr'); 
        if(powerBtnElmt){
          const pbRect = powerBtnElmt.getBoundingClientRect();
          powerBtnElmt.style.backgroundColor = Constants.EMPTY_STRING;
  
          this.powerMenuStyle = {
            'position':'absolute',
            'transform':`translate(${String(pbRect.x - 50)}px, ${String(pbRect.y - 352)}px)`,
            'z-index': 6,
          }
          this.isPowerMenuVisible = true;
          this.onPwdFieldRemoveFocus();
        }
      }else{
        this.showPowerMenu = false;
        this.isPowerMenuVisible = false;
      }

      evt.preventDefault();
      
    }, 10);
  }

  onPowerBtnMouseEnter():void{
    const powerBtnElmt = document.getElementById('powerBtnCntnr') as HTMLDivElement; 
    if(!this.showPowerMenu){
      if(powerBtnElmt){
        powerBtnElmt.style.backgroundColor = '#b8b6b6';
      }
    }
  }

  onPowerBtnMouseLeave():void{
    const powerBtnElmt = document.getElementById('powerBtnCntnr') as HTMLDivElement; 
    if(powerBtnElmt){
      powerBtnElmt.style.backgroundColor = '';
    }
  }

  changeLockScreenLogonPosition(top:number):void{
    const lsLogonElmnt = document.getElementById('lockscreen-logon-container') as HTMLDivElement; 
    if(lsLogonElmnt){
      lsLogonElmnt.style.top = `${top}%`;
    }
  }

  hidePowerBtn():void{
    const lsPwrBtn = document.getElementById('lockScreenPowerCntnr') as HTMLDivElement; 
    if(lsPwrBtn){
      lsPwrBtn.style.display = 'none';
    }
  }

  showPowerBtn():void{
    const lsPwrBtn = document.getElementById('lockScreenPowerCntnr') as HTMLDivElement; 
    if(lsPwrBtn){
      lsPwrBtn.style.display = 'block';
    }
  }

  resetFields():void{
    this.showUserInfo = false;
    this.showPasswordEntry = false;
    this.showLoading = false
    this.showFailedEntry = false;
  }

  shutDownOSFromLockScreen():void{
    const delay = 6000; // 6 secs
    this.resetFields();
    this.changeLockScreenLogonPosition(40);
    this.hidePowerBtn();
    this.exitMessage = 'Shutting down';
    this.showRestartShutDown = true;
    this._audioService.play(this.cheetahRestarAndShutDownAudio);
    this._systemNotificationServices.setSystemMessage(Constants.SYSTEM_SHUT_DOWN);
    this.storeState(Constants.SIGNED_OUT);
    this.storePwrState(Constants.SYSTEM_SHUT_DOWN);

    setTimeout(() => {
      this.showPowerOnOffScreen();
    }, delay);
  }

  shutDownOSFromDesktop():void{
    this.showLockScreen(true);
    this.shutDownOSFromLockScreen();
  }

  restartOSFromLockScreen():void{
    const delay = 5500; // 5.5secs
    this.resetFields();
    this.changeLockScreenLogonPosition(40);
    this.hidePowerBtn();
    this.exitMessage = 'Restarting';
    this.showRestartShutDown = true;
    this._audioService.play(this.cheetahRestarAndShutDownAudio);
    this._systemNotificationServices.setSystemMessage(Constants.SYSTEM_RESTART);
    this.storeState(Constants.SIGNED_OUT);
    this.storePwrState(Constants.SYSTEM_RESTART);
 
    setTimeout(() => {
      this.showPowerOnOffScreen();
      this._systemNotificationServices.restartSystemNotify.next(Constants.RSTRT_ORDER_PWR_ON_OFF_SCREEN);
    }, delay);
  }

  restartOSFromDesktop():void{
    this.showLockScreen(true);
    this.restartOSFromLockScreen();
  }

  showPowerOnOffScreen():void{
    const powerOnOffElmnt = document.getElementById('powerOnOffCmpnt') as HTMLDivElement;
    if(powerOnOffElmnt){
      powerOnOffElmnt.style.zIndex = '7';
      powerOnOffElmnt.style.display = 'block';

      this.resetAuthFormState();
      this.changeLockScreenLogonPosition(25);
      this.showPowerBtn();
      this.storeState(Constants.SIGNED_OUT);

      this.viewOptions = this.currentDateTime;
      this.removeLockScreenBackDrop();
      this.resetAuthFormTimeOutOnly();
      // raise events to close opened apps
    }
  }

  removeLockScreenBackDrop():void{
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  onPwdFieldClick():void{
    const lockScreenPwdElmnt = document.getElementById('lockScreenPwdTxtBox'); 
    if(lockScreenPwdElmnt){
      lockScreenPwdElmnt.style.backgroundColor = '#fff';
      lockScreenPwdElmnt.style.backdropFilter = 'none';
      lockScreenPwdElmnt.focus();
    }
  }

  onPwdFieldRemoveFocus():void{
    const lockScreenPwdElmnt = document.getElementById('lockScreenPwdTxtBox'); 
    if(lockScreenPwdElmnt){
      lockScreenPwdElmnt.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      lockScreenPwdElmnt.style.backdropFilter = 'opacity(50)';
      lockScreenPwdElmnt.blur();
    }
  }

  storeState(state:string):void{
    this._sessionManagmentService.addSession(this.cheetahLogonKey, state);
  }

  storePwrState(state:string):void{
    this._sessionManagmentService.addSession(this.cheetahPwrKey, state);
  }
  
  retrievePastSessionData():void{
    const sessionData = this._sessionManagmentService.getSession(this.cheetahLogonKey) as string;
    console.log('login-psession:', sessionData);
    if(!sessionData || sessionData === Constants.SIGNED_OUT){
      this.isUserLogedIn = false;
      this.isFirstLogIn = true;
    }else{ 
      this.isUserLogedIn = true;
      this.isFirstLogIn = false;
    }
  }
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
