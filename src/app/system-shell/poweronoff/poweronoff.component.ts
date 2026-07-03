/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';

import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-poweronoff',
  templateUrl: './poweronoff.component.html',
  styleUrl: './poweronoff.component.css',
  standalone:false,
})
export class PowerOnOffComponent implements OnInit, OnDestroy {

  // System-notification subscriptions. In normal operation this component is a
  // single instance created once at page load and never destroyed (only a
  // browser refresh tears it down), so these live for the whole session. They
  // are still kept as fields so ngOnDestroy can release them as a safety net
  // should the component ever become destroyable.
  private _restartSub?: Subscription;
  private _shutDownSub?: Subscription;

  // Id of the "powering on" message ticker started in simulateBusy(). Tracked
  // so it can be cancelled if the component is destroyed or the power state
  // changes mid-sequence (restart / shutdown), preventing a stale interval from
  // calling showLockScreen() after the view has moved on. Browser setInterval
  // returns a number, hence ReturnType<typeof setInterval> rather than NodeJS.Timeout.
  private _startUpIntervalId?: ReturnType<typeof setInterval>;

  readonly cheetahPwrKey = Constants.CHEETAH_PWR_KEY;
  readonly cheetahMobileBannerKey = Constants.CHEETAH_MOBILE_BANNER_KEY;

  isSystemPowered = false;
  isFirstPwrOn = true;
  showPowerBtn = true;
  pwrBtnIcon = `${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`;
  showStartUpGif = false;
  startUpGif = `${Constants.GIF_BASE_PATH}cheetah_starting_up.gif`;
  loadingMessage = 'Pwr On';

  // Mobile "not optimized" banner. Bound to the template; shown at most once per
  // browser (the "seen" flag is persisted via the session service, so a refresh
  // or return visit will not show it again). mobileBannerMessage is filled in
  // with the detected OS/browser so the notice is specific to the device.
  showMobileBanner = false;
  mobileBannerMessage = Constants.EMPTY_STRING;

  powerOnAudio = `${Constants.AUDIO_BASE_PATH}cheetah_start_up_2.mp3`;
  powerOffAudio = `${Constants.AUDIO_BASE_PATH}cheetah_shutdown.wav`;

  startUpMessages: string[] = ['Initializing...',  'Loading resources...', 'Setting up system', 'Almost done...'];


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_pwr_mgt';
  processId = 0;
  type = ComponentType.System;

  // Services are injected as private constructor parameters (parameter
  // properties) so Angular assigns them directly to fields, removing the
  // manual field-by-field copying boilerplate.
  constructor(private _runningProcessService:RunningProcessService, private _processIdService:ProcessIDService,
              private _audioService:AudioService, private _systemNotificationService:SystemNotificationService,
              private _sessionManagementService:SessionManagementService){
    // Process registration must happen as the component is created so the rest
    // of the system sees this process immediately.
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  async ngOnInit(): Promise<void> {
    // Subscriptions live in ngOnInit (not the constructor) so they are set up
    // after Angular has finished wiring the component. registerNotificationHandlers
    // runs exactly once for the component's lifetime (see class note above).
    this.registerNotificationHandlers();

    this.retrievePastSessionData();
    this.maybeShowMobileBanner();
    if(this.isSystemPowered){
      await this.showLockScreen();
    }
  }

  ngOnDestroy(): void {
    // Safety net only: this component is created once and is not destroyed in
    // normal use (only a browser refresh ends its life), so this rarely — if
    // ever — runs. The meaningful interval cleanup happens in simulateRestart()
    // and thingsToDoOnShutDown(), which do fire. Kept here for correctness in
    // case the component is ever torn down.
    this.clearStartUpInterval();
    this._restartSub?.unsubscribe();
    this._shutDownSub?.unsubscribe();
  }

  /**
   * Wires up the system power notifications:
   *  - restartSystemNotify: re-runs the power-on sequence when the restart
   *    order targets this screen.
   *  - shutDownSystemNotify: runs the shutdown housekeeping. concatMap ensures
   *    each shutdown's async work completes before the next is processed.
   */
  private registerNotificationHandlers(): void {
    this._restartSub = this._systemNotificationService.restartSystemNotify.subscribe((p) => {
      if(p === Constants.RSTRT_ORDER_PWR_ON_OFF_SCREEN){
        this.simulateRestart();
      }
    });

    this._shutDownSub = this._systemNotificationService.shutDownSystemNotify
      .pipe(concatMap(() => this.thingsToDoOnShutDown())).subscribe();
  }

  /**
   * Shows the "not optimized for mobile" banner the first time CheetahOS is
   * opened on a mobile device. The "already seen" flag is persisted through the
   * session service (localStorage), so the banner appears at most once per
   * browser and stays dismissed across refreshes and return visits.
   */
  private maybeShowMobileBanner(): void {
    // Only mobile devices get the notice, and only if it hasn't been shown yet.
    if(!this.isMobileDevice() || this.hasSeenMobileBanner()){
      return;
    }

    const os = CommonFunctions.getOS();
    const browser = CommonFunctions.getBrowser();
    this.mobileBannerMessage =
      `CheetahOS is a desktop-first experience and isn't optimized for mobile ` +
      `devices (detected ${os} · ${browser}). For the best experience, open it ` +
      `on a desktop or laptop.`;

    this.showMobileBanner = true;

    // Record immediately so the banner is genuinely one-time: even if the user
    // never taps "dismiss", it won't reappear on the next load.
    this._sessionManagementService.addSession(this.cheetahMobileBannerKey, Constants.TRUE);
  }

  /**
   * Determines whether the current device is a mobile device, using the shared
   * getOS / getBrowser helpers. getOS reports 'iOS' or 'Android' for the major
   * mobile platforms; getBrowser is checked as a fallback for user agents that
   * advertise themselves as "Mobile" (e.g. mobile Firefox/Chrome on platforms
   * getOS classifies generically).
   */
  private isMobileDevice(): boolean {
    const os = CommonFunctions.getOS();
    const browser = CommonFunctions.getBrowser();

    const mobileOperatingSystems = ['iOS', 'Android'];
    const isMobileOs = mobileOperatingSystems.includes(os);
    const isMobileBrowser = /Mobile/i.test(browser);

    return isMobileOs || isMobileBrowser;
  }

  /** True once the mobile banner has been shown in this browser before. */
  private hasSeenMobileBanner(): boolean {
    return this._sessionManagementService.getSession(this.cheetahMobileBannerKey) === Constants.TRUE;
  }

  /** Hides the mobile banner when the user dismisses it. */
  dismissMobileBanner(): void {
    this.showMobileBanner = false;
  }

  powerOnSystem():void{
    if(this.showPowerBtn){
      this.showPowerBtn = false;
      this.storeState(Constants.SYSTEM_ON);
      this.simulateBusy();
    }
  }

  simulateBusy():void{
    // Defensive: cancel any ticker already in flight so a rapid power-on /
    // restart can never leave two intervals running at once.
    this.clearStartUpInterval();

    this.showStartUpGif = true;
    this.isSystemPowered = true;
    let index = 0;
    this.loadingMessage = 'Powering On';
    const secondsDelay = 1200; //1.2 seconds

    // Cycle through the start-up messages, then reveal the lock screen. The id
    // is stored so the interval can be cleared from clearStartUpInterval().
    this._startUpIntervalId = setInterval(async() => {
      if(index < this.startUpMessages.length){
        this.loadingMessage = this.startUpMessages[index];
        index++;
      }else{
        this.clearStartUpInterval();
        await this.showLockScreen();
      }
    }, secondsDelay);
  }

  async simulateRestart(): Promise<void> {
    // A restart may arrive while the start-up ticker is mid-sequence; stop it
    // before driving a fresh power-on so messages don't overlap.
    this.clearStartUpInterval();

    this.isFirstPwrOn = true;
    this.isSystemPowered = false;
    this.showPowerBtn = false;
    this.loadingMessage = Constants.EMPTY_STRING;
    const delay = 1000;

    await CommonFunctions.sleep(delay);
    this.showStartUpGif = true;
    this.loadingMessage = Constants.EMPTY_STRING;
    this.simulateBusy();
  }

  /** Cancels the start-up message ticker if it is currently running. */
  private clearStartUpInterval(): void {
    if(this._startUpIntervalId !== undefined){
      clearInterval(this._startUpIntervalId);
      this._startUpIntervalId = undefined;
    }
  }

  async showLockScreen(): Promise<void>{
    this.revertSettings();

    // NOTE: the power-on/off screen and the lock screen are coordinated across
    // components via shared element ids rather than Angular bindings. The login
    // component re-shows this same #powerOnOffCmpnt element (display:block,
    // z-index:7) in its showPowerOnOffScreen(). Because that ownership is split
    // between two components, we intentionally keep raw getElementById access
    // here instead of an [style] binding, which would fight the login
    // component's direct DOM writes.
    const powerOnOffElmnt = document.getElementById('powerOnOffCmpnt') as HTMLDivElement;
    if(powerOnOffElmnt){
      powerOnOffElmnt.style.zIndex = '-2';
      powerOnOffElmnt.style.display = 'none';

      // play startup sound
      if(this.isSystemPowered && this.isFirstPwrOn){
        await this._audioService.play(this.powerOnAudio);
        this.isFirstPwrOn = false;
      }
    }

    // The lock screen itself is owned by the login component; reach it by id
    // and move focus there so the user can type their password immediately.
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.focus();
    }
  }


  async thingsToDoOnShutDown():Promise<void>{
    // A shutdown can land while the start-up ticker is still running; cancel it
    // so it can't flip the view back to the lock screen after we reset state.
    this.clearStartUpInterval();

    const delay = 6250; //6.25 secss
    await CommonFunctions.sleep(delay);

    this.isFirstPwrOn = true;
    this.isSystemPowered = false;
    this.showStartUpGif = false;
    this.showPowerBtn = true;
    this.loadingMessage = 'Pwr On';
  }

  revertSettings():void{
    this.showStartUpGif = false;
    this.showPowerBtn = true;
    this.loadingMessage = 'Pwr On';
  }

  storeState(state:string):void{
    this._sessionManagementService.addSession(this.cheetahPwrKey, state);
  }
  
  retrievePastSessionData():void{
    const sessionData = this._sessionManagementService.getSession(this.cheetahPwrKey) as string;
    if(!sessionData || sessionData === Constants.SYSTEM_SHUT_DOWN){
      this.isSystemPowered = false;
      this.isFirstPwrOn = true;
    }else{ 
      this.isSystemPowered = true;
      this.isFirstPwrOn = false;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
