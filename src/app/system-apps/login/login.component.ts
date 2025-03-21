import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})

export class LoginComponent implements OnInit, AfterViewInit {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _audioService:AudioService;

  loginForm!: FormGroup;
  _formBuilder!:FormBuilder
  formCntrlName = 'loginInput';

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  authFormTimeoutId!: NodeJS.Timeout;
  lockScreenTimeoutId!: NodeJS.Timeout;

  isScreenLocked = true;

  showPasswordEntry = true;
  showLoading = false;
  showFailedEntry = false;

  incorrectPassword = 'The password is incorrect. Try again.'
  authForm = 'AuthenticationForm';
  currentDateTime = 'DateTime'; 
  viewOptions = Constants.EMPTY_STRING;

  defaultAudio = `${Constants.AUDIO_BASE_PATH}cheetah_unlock.wav`;
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
  

  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService,audioService:AudioService, formBuilder: FormBuilder){
    this._processIdService = processIdService;
    this.processId = this._processIdService.getNewProcessId();
    this._audioService = audioService;
    this._formBuilder = formBuilder;

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._runningProcessService.resetLockScreenTimeOutNotify.subscribe(() => { this.resetLockScreenTimeOut()});
  }

  ngOnInit():void {

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

    this._runningProcessService.showLockScreenNotify.next();
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

  onClick():void{
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


  showDesktop():void{ 
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '-1';
      lockScreenElmnt.style.backdropFilter = 'none';

      this.isScreenLocked = false;
      this._runningProcessService.showDesktopNotify.next();
      this.startLockScreenTimeOut();
      this._audioService.play(this.defaultAudio);

      this.resetAuthFormState();
    }
  }

  showLockScreen():void{
    this.viewOptions = this.currentDateTime;
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.zIndex = '6';
      lockScreenElmnt.style.backdropFilter = 'none';

      this.isScreenLocked = true;
      this._runningProcessService.showLockScreenNotify.next();
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
    this.showPasswordEntry = true;
    this.showLoading = false;
    this.showFailedEntry = false;
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
