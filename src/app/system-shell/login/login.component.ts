/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';
import { LoginHelpers } from './login.helper';
import { defer, Subject } from 'rxjs';
import { exhaustMap, filter, takeUntil } from 'rxjs/operators';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { GeneralMenu } from 'src/app/shared/system-ui-components/menu/menu.types';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';

/**
 * Discriminator for which template the lock-screen swaps between. Kept as a
 * narrow union (rather than free-form `string`) so the template comparison
 * `viewOptions === authForm` is type-checked and typo-proof.
 *
 * The empty string is intentionally part of the union to represent the
 * "not yet decided" initial state assigned in field initialisers.
 */
type LoginView = '' | 'AuthenticationForm' | 'DateTime';

/**
 * Cross-browser timer-id type. Pulling NodeJS.Timeout in via a browser app
 * leaked Node typings; ReturnType<typeof setTimeout> resolves to the correct
 * environment-native type at the call site.
 */
type TimerId = ReturnType<typeof setTimeout>;

@Component({
  selector: 'cos-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  standalone:false,
})

export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {

  // ========================================================================
  // Timing constants (all values in milliseconds)
  // ========================================================================
  // Centralising every setTimeout / setInterval / sleep duration used in this
  // component as named constants so:
  //   * The values are self-documenting (no more `60000 // wait 1 min`).
  //   * Tuning a delay is a one-line change in a single, obvious place.
  //   * Magic-number drift between similar flows cannot happen.
  private static readonly CLOCK_REFRESH_MS                 = 1_000;     // tick the on-screen clock once per second
  private static readonly DATE_REFRESH_MS                  = 360_000;   // refresh the date every 6 minutes
  private static readonly AUTH_FORM_IDLE_TIMEOUT_MS        = 60_000;    // hide the password form after 1 min of inactivity
  private static readonly LOGIN_SUCCESS_TRANSITION_MS      = 2_500;     // show the spinner this long on a successful login
  private static readonly LOGIN_FAILURE_TRANSITION_MS      = 3_000;     // show the spinner this long on a failed login attempt
  private static readonly POST_LOCK_TIMEOUT_SETTLE_MS      = 750;       // let other listeners react before painting the lock screen
  private static readonly SHUTDOWN_DISPLAY_MS              = 6_000;     // "Shutting down..." message dwell time
  private static readonly RESTART_DISPLAY_MS               = 5_500;     // "Restarting..." message dwell time

  // CSS / geometry constants that previously appeared as raw numbers.
  private static readonly LOGON_POSITION_TOP_DEFAULT_PCT   = 25;        // logon container top: % when the lock screen is idle
  private static readonly LOGON_POSITION_TOP_POWER_PCT     = 40;        // logon container top: % during shutdown/restart messaging
  private static readonly POWER_MENU_OFFSET_X_PX           = 50;        // translate.x offset from the power button
  private static readonly POWER_MENU_OFFSET_Y_PX           = 352;       // translate.y offset above the power button
  private static readonly SHUTDOWN_BG_COLOR                = '#0078d8'; // solid blue painted behind the shutdown/restart message

  // ========================================================================
  // Dependencies
  // ========================================================================
  // All services are wired via constructor parameter properties below; only
  // non-DI state belongs in this block.
  private _wss:HTMLVideoElement | HTMLIFrameElement | undefined;

  // Teardown signal piped into every subscription via takeUntil(). Emitting +
  // completing this in ngOnDestroy unsubscribes every observer the component
  // owns, so handlers stop firing once the component is destroyed.
  private readonly _destroy$ = new Subject<void>();

  // Re-entry guard for the shutdown sequence.
  //
  // shutDownOSFromLockScreen has two callers:
  //   1. The lock-screen power menu (bound as `action: shutDownOSFromLockScreen.bind(this)`).
  //      This path needs to emit shutDownSystemNotify so poweronoff.component's
  //      thingsToDoOnShutDown runs and resets isFirstPwrOn -- without that
  //      reset the startup audio is silenced on the next power-on cycle.
  //   2. shutDownOSFromDesktop, which itself runs inside the
  //      shutDownSystemNotify subscriber (the dialog-initiated path).
  //      shutDownSystemNotify has already been emitted by the dialog in this
  //      path, and re-emitting it here would either double-run poweronoff's
  //      cleanup or (worse) re-trigger our own subscriber and recursively
  //      restart the shutdown sequence.
  //
  // The flag lets us tell those two cases apart: the subscriber sets it to
  // true for the duration of its inner observable, so when
  // shutDownOSFromLockScreen sees the flag already set it knows it's the
  // case-2 caller and must NOT re-emit. When the flag is unset, it's the
  // case-1 caller and must emit (and own clearing the flag afterwards).
  private _shutdownInProgress = false;

  // ========================================================================
  // Form + UI State
  // ========================================================================
  loginForm!: FormGroup;
  formCntrlName = 'loginInput';

  password = Constants.EMPTY_STRING;
  currentTime = Constants.EMPTY_STRING;
  currentDate = Constants.EMPTY_STRING;
  logInCounter = 0;

  authFormTimeoutId!: TimerId;
  lockScreenTimeoutId!: TimerId;
  slideShowIntervalId!: TimerId;

  // Recurring timers that update the clock + date on the lock screen. Captured
  // so ngOnDestroy can stop them; otherwise they would continue firing (and
  // mutating a now-detached component) for the lifetime of the page.
  private timeUpdateIntervalId?: TimerId;
  private dateUpdateIntervalId?: TimerId;

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
  isScreenSaverEnabled = false;

  powerMenuStyle:Record<string, unknown> = {};
  powerMenuOption = Constants.POWER_MENU_OPTION;

  readonly cheetahLogonKey = Constants.CHEETAH_LOGON_KEY;
  readonly cheetahPwrKey = Constants.CHEETAH_PWR_KEY;

 // incorrectPassword = 'The password is incorrect. Try again.';
  incorrectPassword = `The password is incorrect. Try ${Constants.USER_GUEST_PASSWORD}.`;
  exitMessage = Constants.EMPTY_STRING;

  // ------------------------------------------------------------------------
  // SECURITY NOTE
  // ------------------------------------------------------------------------
  // CheetahOS is a browser-based desktop *simulation*. There is no remote
  // server doing authentication; the lock screen exists for visual fidelity
  // only. The check below is therefore a client-side string compare against a
  // hard-coded constant -- by design.
  //
  // Do NOT copy this pattern into anything that protects real data:
  //   * The literal "1234" ships in the JS bundle, plainly visible to anyone.
  //   * Comparing strings with `===` is fine here only because nothing of
  //     value is being gated.
  //   * The "incorrect password" message even tells the user the answer.
  //
  // If this project ever grows real user accounts, authentication must move
  // server-side and this field must be deleted.
   defaultPassWord: number[] = [Number(Constants.USER_GUEST_PASSWORD)];

  // Template view discriminator. The two string fields below are the only
  // values viewOptions is ever assigned at runtime; making them readonly
  // LoginView literals keeps the type sound while preserving the existing
  // template binding `viewOptions === authForm`.
  readonly authForm: LoginView = 'AuthenticationForm';
  readonly currentDateTime: LoginView = 'DateTime';
  viewOptions: LoginView = '';

  // Exposed for the template's [class.lockscreen_auth_form_blur] binding so the
  // mirror-only blur gate can be evaluated declaratively (see showAuthForm).
  readonly backgroundMirror = Constants.BACKGROUND_MIRROR;
  // readonly backgroundColor = Constants.BACKGROUND_SOLID_COLOR;
  // readonly backgroundPicture = Constants.BACKGROUND_PICTURE;

  // ========================================================================
  // Assets / Constants
  // ========================================================================
  readonly cheetahUnlockAudio = `${Constants.AUDIO_BASE_PATH}cheetah_unlock.wav`;
  readonly cheetahlockAudio = `${Constants.AUDIO_BASE_PATH}cheetah_lock.mp3`;
  readonly cheetahlogOffAudio = `${Constants.AUDIO_BASE_PATH}cheetah_logoff.wav`;
  readonly cheetahRestartAndShutDownAudio = `${Constants.AUDIO_BASE_PATH}cheetah_shutdown.wav`;

  readonly userIcon = `${Constants.ACCT_IMAGE_BASE_PATH}default_user.png`;
  readonly devIcon = `${Constants.ACCT_IMAGE_BASE_PATH}admin_user.png`;
  accountIcon = this.userIcon;

  readonly guestName = 'Guest, User';
  readonly devName = 'Dev, User';
  accountName = 'Anonymous, User';

  pwrBtnIcon = `${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`;
  loadingGif = `${Constants.GIF_BASE_PATH}cheetah_loading.gif`;

  // (defaultPassWord is declared in the SECURITY NOTE block above.)

  lockScreenBackgroundType = Constants.EMPTY_STRING;
  lockScreenBackgroundValue = Constants.EMPTY_STRING;
  menuData:GeneralMenu[] = [];

  // ========================================================================
  // Process metadata
  // ========================================================================
  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'cheetah_authentication';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  

  // ========================================================================
  // Constructor / Setup wiring
  // ========================================================================
  // The constructor intentionally does NOT subscribe to any observables.
  // Subscription setup lives in ngOnInit (see registerNotificationHandlers)
  // because that is the first lifecycle hook where @Input() bindings and
  // other Angular-managed state are guaranteed to be settled. Subscribing
  // here would lock the handlers' closures to whatever values exist at
  // construction time, which is a known foot-gun for input-driven keys.
  //
  // Dependencies are declared as `private readonly` parameter properties,
  // which both declares the field and assigns it in one step -- removing
  // a block of manual `this._x = x;` wiring that previously lived here.
  constructor(
    private readonly _runningProcessService: RunningProcessService,
    private readonly _processIdService: ProcessIDService,
    private readonly _audioService: AudioService,
    private readonly _formBuilder: FormBuilder,
    private readonly _sessionManagementService: SessionManagementService,
    private readonly _systemNotificationService: SystemNotificationService,
    private readonly _defaultService: DefaultService,
    private readonly _windowService: WindowService,
    private readonly _processHandlerService: ProcessHandlerService,
  ) {
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  // ========================================================================
  // Angular lifecycle
  // ========================================================================
  async ngOnInit():Promise<void> {
    // Wire notification handlers FIRST so that any synchronous emission made
    // during the rest of ngOnInit (e.g. showLockScreenNotify.next() inside
    // thingsToDoFirstOnInit) can still be observed by interested subscribers.
    this.registerNotificationHandlers();

    this.getLockScreenBackgroundData();
    this.thingsToDoFirstOnInit();
    this.retrievePastSessionData();

    if(this.isUserLogedIn)
      await this.showDesktop();
    else
     await this.showLockScreen();
  }

  ngAfterViewInit(): void {
    const onlySyncScrnSvrState = true;

    this.setLockScreenBackground();
    this.syncAndHandleScreenSaver(onlySyncScrnSvrState);
  }

  /**
   * Clean up every timer the component owns so that nothing fires (and
   * mutates a detached component / dangling DOM lookup) after destruction.
   *
   * Today LoginComponent typically lives for the lifetime of the page, so
   * this rarely runs — but the previous code unconditionally leaked timers,
   * which made the component unsafe to re-create (HMR, tests, future routing
   * changes, etc.). clearTimeout/clearInterval are no-ops for undefined ids,
   * so the guards are intentionally minimal.
   */
  ngOnDestroy(): void {
    // Recurring clock + date refreshers started in thingsToDoFirstOnInit.
    clearInterval(this.timeUpdateIntervalId);
    clearInterval(this.dateUpdateIntervalId);

    // One-shot timers started elsewhere in the component lifecycle. Clearing
    // them defensively here protects against a destroy that happens while a
    // timeout is still pending.
    clearTimeout(this.authFormTimeoutId);
    clearTimeout(this.lockScreenTimeoutId);

    // Slideshow interval lives in CommonFunctions but the id is owned here.
    CommonFunctions.stopSlideShow(this.slideShowIntervalId);

    // Fire the teardown signal so every takeUntil(this._destroy$) pipeline
    // unsubscribes, then close the subject itself.
    this._destroy$.next();
    this._destroy$.complete();
  }

  // ========================================================================
  // Init helpers (forms / time / menu)
  // ========================================================================

  /**
   * Subscribe to every system-wide notification this component cares about.
   *
   * Centralised here (and called from ngOnInit) so:
   *   1. Subscriptions happen after Angular has finished wiring inputs / DI,
   *      avoiding the constructor-timing class of bugs.
   *   2. Every pipeline shares one teardown signal (this._destroy$),
   *      guaranteeing ngOnDestroy unsubscribes them all at once.
   */
  private registerNotificationHandlers(): void {
    // ---- Synchronous handlers ----------------------------------------------
    // These produce no awaitable work; a plain subscribe is fine. They are
    // still routed through takeUntil so ngOnDestroy can tear them down.
    this._systemNotificationService.resetLockScreenTimeOutNotify
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => { this.resetLockScreenTimeOut(); });

    this._defaultService.defaultSettingsChangeNotify
      .pipe(takeUntil(this._destroy$))
      .subscribe((p) => {
        if(p === Constants.DEFAULT_LOCK_SCREEN_TIMEOUT){  this.resetLockScreenTimeOut(); }

        if(p === Constants.DEFAULT_LOCK_SCREEN_BACKGROUND){  this.getLockScreenBackgroundData(); }

        if(p === Constants.DEFAULT_SCREEN_SAVER_STATE){  this.syncAndHandleScreenSaver();  }
      });

    // ---- Async handlers ----------------------------------------------------
    // Each of these triggers a multi-step async flow (audio playback, sleeps,
    // DOM mutations). A plain `subscribe(async () => ...)` does NOT serialize
    // emissions: RxJS ignores the returned promise, so two rapid emissions
    // would interleave their side-effects (duplicate audio, racing DOM
    // writes, inconsistent state flags).
    //
    // exhaustMap solves this by ignoring new emissions while an inner
    // observable is still active. Once a shutdown/restart/log-off/lock
    // sequence has begun, subsequent requests of the same kind are dropped
    // until it completes -- which is the correct semantics here (you cannot
    // "queue" two shutdowns, and a redundant lock request is meaningless).
    //
    // defer() wraps the async function so the work is created lazily on each
    // accepted emission (not at pipeline construction time).
    //
    // The explicit error callback prevents thrown promises (e.g. autoplay
    // policy rejection on _audioService.play) from surfacing as unhandled
    // promise rejections and from tearing down the outer subscription.
    this._systemNotificationService.shutDownSystemNotify
      .pipe(
        exhaustMap(() => defer(async () => {
          // Re-entry guard: if shutDownOSFromLockScreen was invoked from the
          // lock-screen menu it has already set the flag and emitted this
          // notification itself (to wake poweronoff). Bail out so we don't
          // recursively re-enter the shutdown sequence.
          if (this._shutdownInProgress) return;
          this._shutdownInProgress = true;
          try {
            this.logInCounter = 0;
            await this.shutDownOSFromDesktop();
          } finally {
            this._shutdownInProgress = false;
          }
        })),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => console.error('shutDownSystemNotify handler failed:', err),
      });

    this._systemNotificationService.restartSystemNotify
      .pipe(
        // restartSystemNotify is multiplexed: dialog.component emits
        // RSTRT_ORDER_LOCK_SCREEN to *request* a restart (we should act),
        // while restartOSFromLockScreen re-emits RSTRT_ORDER_PWR_ON_OFF_SCREEN
        // as a "next phase" cue for poweronoff.component (we should ignore).
        // Filtering upstream of exhaustMap means an ignored payload does NOT
        // occupy the inner-observable slot, so a real restart that arrives
        // immediately after still runs.
        filter((p) => p === Constants.RSTRT_ORDER_LOCK_SCREEN),
        exhaustMap(() => defer(async () => {
          this.logInCounter = 0;
          await this.restartOSFromDesktop();
        })),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => console.error('restartSystemNotify handler failed:', err),
      });

    this._systemNotificationService.logOffNotify
      .pipe(
        exhaustMap(() => defer(async () => {
          this.logInCounter = 0;
          await this.logOffAndShowLockScreen();
        })),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => console.error('logOffNotify handler failed:', err),
      });

    this._systemNotificationService.lockScreenNotify
      .pipe(
        exhaustMap(() => defer(() => this.lockScreen())),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => console.error('lockScreenNotify handler failed:', err),
      });
  }

  thingsToDoFirstOnInit():void{
    this.loginForm = this._formBuilder.nonNullable.group({
      loginInput: Constants.EMPTY_STRING,
    });

    this.viewOptions =  this.currentDateTime;
    this.getTime(); // Set initial time
    this.getDate(); // Set initial Date

    // Capture the interval ids so we can clear them in ngOnDestroy. The
    // previous implementation discarded the ids, leaving both timers running
    // indefinitely even after the component was torn down.
    this.timeUpdateIntervalId = setInterval(() => { this.getTime(); }, LoginComponent.CLOCK_REFRESH_MS);
    this.dateUpdateIntervalId = setInterval(() => { this.getDate(); }, LoginComponent.DATE_REFRESH_MS);

    this._systemNotificationService.showLockScreenNotify.next();
    this._systemNotificationService.setIsScreenLocked(this.isScreenLocked);
    this.getPowerMenuData();
    this.updateCounter();
  }

  getDate():void{
    this.currentDate = LoginHelpers.getDate();
  }

  getTime():void {
    this.currentTime = LoginHelpers.updateTime();
  }

  getPowerMenuData():void{
    this.menuData = [
      {icon:`${Constants.IMAGE_BASE_PATH}cheetah_power_shutdown.png`, label: 'Shut down', action: this.shutDownOSFromLockScreen.bind(this) },
      {icon:`${Constants.IMAGE_BASE_PATH}cheetah_restart.png`, label: 'Restart', action:this.restartOSFromLockScreen.bind(this)}
    ];
  }

  // ========================================================================
  // Input / click handlers (lock screen)
  // ========================================================================
  onKeyDown(evt:KeyboardEvent):void{
    if(evt.key === Constants.BLANK_SPACE){
      this.showAuthForm();
      this.updateScreenSaverParams();
    }
  }

  onLockScreenViewClick():void{
    this.showPowerMenu = false;
    this.showAuthForm();
    this.updateScreenSaverParams();
  }

  async onEnteringPassword(evt?:KeyboardEvent): Promise<void>{
    if(evt?.key === "Enter"){
      const loginTxt = this.loginForm.value.loginInput as string;
      if(this.defaultPassWord.includes(Number(loginTxt))){
        this.isUserLogedIn = true;
        this.showPasswordEntry = false;
        this.showLoading = true;
        this.logInCounter++;

        this.doVeryBasicAccountThings();
        this.stopScreenSaver();
        await CommonFunctions.sleep(LoginComponent.LOGIN_SUCCESS_TRANSITION_MS);
        await this.showDesktop();
      }else{
        this.showPasswordEntry = false;
        this.showLoading = true;

        await CommonFunctions.sleep(LoginComponent.LOGIN_FAILURE_TRANSITION_MS);
        this.showLoading = false;
        this.showFailedEntry = true;

        this.loginForm.controls[this.formCntrlName].setValue(null);
      }
    }
    this.resetAuthFormTimeOut();
  }

  onBtnClick():void{
    this.resetAuthFormState();
  }

  doVeryBasicAccountThings():void{
    const raiseEvt = false;
    let whoIsThis = this._defaultService.getDefaultSetting(Constants.DEFAULT_WHO_IS_THIS);

    if(whoIsThis !== Constants.UNKNOWN) return;

    if(this.defaultPassWord[1] === Number(this.loginForm.value.loginInput)){
      this.accountIcon = this.devIcon;
      this.accountName = this.devName;
      whoIsThis = Constants.USER_DEV;
    }else{
      this.accountIcon = this.userIcon;
      this.accountName = this.guestName;
      whoIsThis = Constants.USER_GUEST;
    }

    this._defaultService.updateDefaultData(Constants.DEFAULT_WHO_IS_THIS, whoIsThis, raiseEvt);
  }

  // ========================================================================
  // Auth form display + timeout
  // ========================================================================
  showAuthForm():void{
    // The 40px "mirror" backdrop blur is applied declaratively via the
    // [class.lockscreen_auth_form_blur] binding in the template (keyed off
    // viewOptions === authForm + mirror background). Driving it from change
    // detection means it is re-asserted on every CD cycle and can no longer be
    // stranded by the imperative backdrop-filter:'none' writes elsewhere in
    // this component -- which was the cause of the intermittent "auth form
    // shows with a clear backdrop instead of the blur" bug.
    this.viewOptions = this.authForm;
    this.startAuthFormTimeOut();
  }

  startAuthFormTimeOut():void{
    this.resetAuthFormTimeOutOnly();

    this.authFormTimeoutId = setTimeout(() => {
      this.loginForm.controls[this.formCntrlName].setValue(null);
      this.showDateTime();
    }, LoginComponent.AUTH_FORM_IDLE_TIMEOUT_MS);
  }

  showDateTime():void{
    if(!this.isScreenLocked) return;

    this.viewOptions = this.currentDateTime;
    this.updateScreenSaverParams();

    if(this.isScreenSaverEnabled){
      if(this.canStartScreenSaver())
        this.startScreenSaver();
    }

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(lockScreenElmnt){
      lockScreenElmnt.style.backdropFilter = 'none';
    }
  }

  resetAuthFormTimeOut():void{
    clearTimeout(this.authFormTimeoutId);
    this.startAuthFormTimeOut();
  }

  resetAuthFormTimeOutOnly():void{
    // clearTimeout is a no-op for undefined / unset ids, so we do not need a
    // truthy guard. The previous guard was unsafe in the browser anyway,
    // where setTimeout returns a number — and 0 is a legitimate id that the
    // guard would have falsely skipped.
    clearTimeout(this.authFormTimeoutId);
  }

  // ========================================================================
  // Desktop / lock screen transitions
  // ========================================================================

  /**
   * Play a lock-screen / power audio cue without ever propagating a
   * rejection to the caller.
   *
   * Why: AudioService.play() is *currently* defensive (handlePlay() catches
   * everything internally) but it also performs synchronous Howler
   * operations (stop()/unload() on a stale player) before that catch. A
   * future change to either Howler or the service could begin surfacing
   * rejections here. Several of our callers (notably showDesktop(), reached
   * from ngOnInit) are not wrapped by the exhaustMap error handlers in
   * registerNotificationHandlers, so an uncaught reject would become an
   * unhandled promise rejection at runtime.
   *
   * This wrapper isolates that risk in one place: log + swallow. The audio
   * cue is purely decorative -- a missing/blocked sound must never block or
   * crash a lock-screen state transition.
   */
  private async safePlayAudio(audioPath: string): Promise<void> {
    try {
      await this._audioService.play(audioPath);
    } catch (err) {
      console.warn(`safePlayAudio: failed to play '${audioPath}':`, err);
    }
  }

  async showDesktop(): Promise<void>{ 
    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(!lockScreenElmnt) return;

    lockScreenElmnt.style.zIndex = '-1';
    lockScreenElmnt.style.backdropFilter = 'none';

    // Reset the lock-screen template to the date/time view BEFORE the user
    // is ever shown the lock screen again. The reason this matters: after a
    // successful sign-in, viewOptions is still 'AuthenticationForm' from the
    // password entry that just happened. If we leave it like that, the next
    // time showLockScreen runs it has to swap the template back to DateTime
    // AND raise z-index in the same task tick -- if the browser paints
    // between Angular's change-detection cycle and the z-index flip, the
    // old auth-form template shows for one frame (the "hot sec" flash).
    //
    // Resetting it here is safe: z-index has just been set to -1, so the
    // lock screen is hidden during the off-screen re-render. By the time
    // the next lock happens, the DOM already matches the target view, the
    // viewIsChanging guard in showLockScreen short-circuits the macrotask
    // yield, and there is no opportunity for a flash. Centralised here so
    // every caller of showDesktop (ngOnInit session-restore + sign-in)
    // benefits without each call site needing to remember.
    this.viewOptions = this.currentDateTime;

    this.isScreenLocked = false;
    this._systemNotificationService.showDesktopNotify.next();
    this._systemNotificationService.setIsScreenLocked(this.isScreenLocked);
    this.startLockScreenTimeOut();

    if(this.isUserLogedIn && this.isFirstLogIn)
      await this.safePlayAudio(this.cheetahUnlockAudio);

    this.resetAuthFormState();
    this.storeState(Constants.SIGNED_IN);
    this.stopSlideShow();
  }

  async showLockScreen(isShtDwnOrRstrt:boolean = false, chgBkgrnd:boolean = false):Promise<void>{
    // Compute the target view first so we can detect whether viewOptions is
    // actually changing. The yield below only matters when it is.
    const targetView: LoginView = (!isShtDwnOrRstrt) ? this.currentDateTime : this.authForm;
    const viewIsChanging = this.viewOptions !== targetView;
    this.viewOptions = targetView;

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(!lockScreenElmnt) return;


    // Defensive: when transitioning to locked, kill any pending auto-lock
    // timer. Invariant: while isScreenLocked is true, no lockScreenTimeoutId
    // should be in flight. This also closes the auto-lock FIRE-callback race
    // window: if a stray mousemove during the settle sleep scheduled a
    // phantom timer via resetLockScreenTimeOut, this clears it. (clearTimeout
    // is a no-op for unset / already-fired ids, so this is always safe.)
    clearTimeout(this.lockScreenTimeoutId);

    if(!isShtDwnOrRstrt && !this.isScreenLocked)
      await this.safePlayAudio(this.cheetahlockAudio);

    this.isScreenLocked = true;
    this.isFirstLogIn = true;
    this.loginForm.controls[this.formCntrlName].setValue(null);

    this._systemNotificationService.showLockScreenNotify.next();

    if(!isShtDwnOrRstrt && !chgBkgrnd) //if both are false, then it means it's an auto-lock / lock scenario
      await CommonFunctions.sleep(LoginComponent.POST_LOCK_TIMEOUT_SETTLE_MS);

    // If the lock-screen template just switched, yield one macrotask so
    // Angular's change-detection cycle re-renders the new view BEFORE we
    // lift z-index from -1 to 6. Otherwise the browser paints one frame
    // with the lock screen visible but the previous template still on
    // screen (typically the password form left over from the previous
    // unlock), producing a brief auth-form flash on lock. A 0ms sleep is
    // a macrotask -- it runs strictly AFTER all pending microtasks
    // including Angular's CD, so by the time we resume the DOM matches
    // the new viewOptions.
    //
    // Skipped when the view is unchanged (e.g. desktop-initiated shutdown
    // or restart, which keep viewOptions === authForm) so those paths pay
    // no extra delay.
    if(viewIsChanging){
      await CommonFunctions.sleep(0);
    }

    lockScreenElmnt.style.zIndex = '6';
    lockScreenElmnt.style.backdropFilter = 'none';
    this._systemNotificationService.setIsScreenLocked(this.isScreenLocked);
    this.storeState(Constants.SIGNED_OUT);

    this.setLockScreenBackground(isShtDwnOrRstrt, chgBkgrnd);
    if(!isShtDwnOrRstrt && this.isScreenSaverEnabled){
      this.updateScreenSaverParams();
      this.startScreenSaver();
    }
  }

  async logOffAndShowLockScreen():Promise<void>{
    const isShtDwnOrRstrt:boolean = false, chgBkgrnd:boolean = false
    this.viewOptions = (!isShtDwnOrRstrt)? this.currentDateTime : this.authForm;

    const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
    if(!lockScreenElmnt) return;

    lockScreenElmnt.style.zIndex = '6';
    lockScreenElmnt.style.backdropFilter = 'none';

    // Defensive: same invariant as showLockScreen -- no pending auto-lock
    // timer should outlive the lock transition.
    clearTimeout(this.lockScreenTimeoutId);

    if(!this.isScreenLocked)
      await this.safePlayAudio(this.cheetahlogOffAudio);

    this.isScreenLocked = true;
    this.isFirstLogIn = true;
    this.loginForm.controls[this.formCntrlName].setValue(null);
    this._systemNotificationService.showLockScreenNotify.next();
    this._systemNotificationService.setIsScreenLocked(this.isScreenLocked);
    this.storeState(Constants.SIGNED_OUT);

    this.setLockScreenBackground(isShtDwnOrRstrt, chgBkgrnd);
  }

  // ========================================================================
  // Lock screen timeout controls
  // ========================================================================
  startLockScreenTimeOut():void{
    if(this.isScreenLocked) return;

    // Defensive: kill any prior pending timer BEFORE scheduling a new one.
    // Without this, callers that invoke startLockScreenTimeOut directly
    // (notably showDesktop() after a successful sign-in) would overwrite
    // `lockScreenTimeoutId` with the new id, ORPHANING the previous timer.
    // The orphan would keep ticking and fire ~60s later, locking the screen
    // mid-session. clearTimeout() is a no-op for an unset / already-fired
    // id, so this is always safe to call.
    clearTimeout(this.lockScreenTimeoutId);

    // The user's configured "idle before lock" duration (already in ms) is
    // stored as "label:milliseconds" -- split and parse the right half.
    const idleBeforeLockMs = Number(
      this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_TIMEOUT)
        .split(Constants.COLON)[1]
    );

    this.lockScreenTimeoutId = setTimeout(async () => {
      // Notify listeners (e.g. the desktop overlay) that the lock screen is
      // about to take over, then settle briefly so any reactive work they do
      // lands before showLockScreen mutates the DOM.
      //
      // We intentionally do NOT pre-flip isScreenLocked here. Doing so would
      // break showLockScreen's `if(!isShtDwnOrRstrt && !this.isScreenLocked)`
      // audio guard, silencing the lock cue on every auto-lock. The race
      // window we used to close manually -- a stray mousemove during the
      // settle sleep scheduling a phantom timer via resetLockScreenTimeOut
      // -- is now handled defensively inside showLockScreen, which clears
      // lockScreenTimeoutId before mutating any state. The phantom (if any)
      // is therefore killed before it can fire.
      //
      // We also do NOT pre-assign viewOptions here. showLockScreen does that
      // itself and yields one macrotask afterwards so Angular's CD repaints
      // the new template BEFORE z-index is lifted -- preventing the auth-
      // form flash uniformly for every caller, not just this one.
      await this.showLockScreen(false, false);
    }, idleBeforeLockMs);
  }

  async lockScreen():Promise<void>{
    // No clearTimeout here -- showLockScreen() now defensively clears
    // lockScreenTimeoutId at the top of its body, so doing it twice would
    // be redundant and obscure where the invariant actually lives.
    await this.showLockScreen();
  }

  resetLockScreenTimeOut():void{
    if(!this.isScreenLocked){
      clearTimeout(this.lockScreenTimeoutId);
      this.startLockScreenTimeOut();
    }
  }

  // ========================================================================
  // Screen saver
  // ========================================================================
  syncAndHandleScreenSaver(onlySyncScrnSvrState:boolean = false):void{
    const screenSaverState = this._defaultService.getDefaultSetting(Constants.DEFAULT_SCREEN_SAVER_STATE);
    this.isScreenSaverEnabled = screenSaverState === Constants.ON ? true : false;

    if(onlySyncScrnSvrState) return;

    if(this.isScreenSaverEnabled){
      if(this.canStartScreenSaver())
        this.startScreenSaver();
    }
    else
      this.stopScreenSaver();
  }

  startScreenSaver():void{
    const elRef = document.getElementById('lockscreenCmpnt') as HTMLDivElement | null;
    // Bail out cleanly if the host element is missing. Every other lock-screen
    // DOM helper in this file null-checks before mutating; this one previously
    // didn't, and would propagate a null into LoginHelpers.createVideoScreenSaver
    // where the failure mode is harder to diagnose.
    if(!elRef) return;

    // Selection persisted by Settings as "Type:fileName" (e.g. "Dynamic:flowerbox.ssvr").
    const saver = this._defaultService.getDefaultSetting(Constants.DEFAULT_SCREEN_SAVER).split(Constants.COLON);
    const type = saver[0];
    const file = saver[1];

    // Build the right saver kind, resolving the file against its base path. A video
    // saver streams an mp4 loop; a dynamic saver hosts a self-contained .ssvr page.
    const config = (type === Constants.SCREEN_SAVER_VIDEO)
      ? LoginHelpers.createVideoScreenSaver(elRef, `${Constants.VIDEO_SCREEN_SAVER_BASE_PATH}${file}`)
      : LoginHelpers.createIframeScreenSaver(elRef, `${Constants.WEBGL_SCREEN_SAVER_BASE_PATH}${file}`);

    this._wss = LoginHelpers.startWebScreenSaver(config);
  }

  stopScreenSaver():void{
    if(this._wss)
      LoginHelpers.stopWebSceenSaver();
  }

  isCurrentDateTimeVisibleOnLockScreen():boolean{
    return (this.viewOptions === this.currentDateTime);
  }

  /**
   * Predicate: are we currently in a state where the screen saver is allowed
   * to take over the lock screen?
   *
   * Conditions (all required):
   *   - The DateTime view is currently shown (not the password form), because
   *     the saver would otherwise hide the form the user is trying to use.
   *   - The screen is actually locked.
   *   - The user has logged in at least once this session. The saver is
   *     suppressed on the very first lock-screen presentation to give the
   *     user a chance to see / interact with the device.
   */
  private canStartScreenSaver(): boolean {
    return this.isCurrentDateTimeVisibleOnLockScreen()
        && this.isScreenLocked
        && this.logInCounter > 0;
  }

  updateScreenSaverParams():void{
    LoginHelpers.updateIsCurrentDateTimeOnLogonForm(this.isCurrentDateTimeVisibleOnLockScreen());
    LoginHelpers.updateIsScreenLocked(this.isScreenLocked);
    LoginHelpers.updateLogInCounter(this.logInCounter);
  }

  // ========================================================================
  // Lock screen background / slideshow
  // ========================================================================
  getLockScreenBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_LOCK_SCREEN_BACKGROUND).split(Constants.COLON);
    this.lockScreenBackgroundType = defaultBkgrnd[0];
    this.lockScreenBackgroundValue = defaultBkgrnd[1];
  }

  setLockScreenBackground(isShtDwnOrRstrt:boolean  = false, chgBkgrnd:boolean = false):void{
    const styleClasses = ['lockscreen_background_mirror', 'lockscreen_background_solid_color', 'lockscreen_background_picture'];
    let activeClass = Constants.EMPTY_STRING;

    if(isShtDwnOrRstrt && chgBkgrnd){
      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        // A picture or running slideshow would otherwise paint over the blue
        // background-color. Stop the slideshow and clear the background image
        // so the solid blue is actually visible.
        this.stopSlideShow();
        lockScreenElmnt.style.backgroundImage = 'none';
        lockScreenElmnt.style.backgroundColor = (chgBkgrnd) ? LoginComponent.SHUTDOWN_BG_COLOR : Constants.EMPTY_STRING;
      }

      return;
    }

    if(this.lockScreenBackgroundType === Constants.BACKGROUND_MIRROR){
      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        this.stopSlideShow();
        activeClass = styleClasses[0];
        this.setStyle(lockScreenElmnt, styleClasses, activeClass);
      }
    }

    if(this.lockScreenBackgroundType === Constants.BACKGROUND_SOLID_COLOR){
      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        this.stopSlideShow();
        activeClass = styleClasses[1];
        this.setStyle(lockScreenElmnt, styleClasses, activeClass);
        lockScreenElmnt.style.backgroundColor = this.lockScreenBackgroundValue;
      }
    }

    if(this.lockScreenBackgroundType === Constants.BACKGROUND_PICTURE){
      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        this.stopSlideShow();
        activeClass = styleClasses[2];
        this.setStyle(lockScreenElmnt, styleClasses, activeClass);
        lockScreenElmnt.style.backgroundImage = `url(${this.lockScreenBackgroundValue})`;
      }
    }

    if(this.lockScreenBackgroundType === Constants.BACKGROUND_SLIDE_SHOW){
      const lockScreenElmnt = document.getElementById('lockscreenCmpnt') as HTMLDivElement;
      if(lockScreenElmnt){
        if(this.lockScreenBackgroundValue === Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR){
          activeClass = styleClasses[1];
          this.setStyle(lockScreenElmnt, styleClasses, activeClass);
          this.startColorSlideShow(lockScreenElmnt)
        }else{
          activeClass = styleClasses[2];
          this.setStyle(lockScreenElmnt, styleClasses, activeClass);
          const contentSet = this.generateLockScreenPictureOptions();
          this.startPictureSlideShow(lockScreenElmnt, contentSet);
        }
      }
    }
  }

  setStyle(lockScreenElmnt: HTMLDivElement, styleClasses:string[], activeClass:string) {
    // 🧹 Reset previous inline styles
    CommonFunctions.resetInlineStyles(lockScreenElmnt);
    lockScreenElmnt.classList.remove(...styleClasses);
    lockScreenElmnt.classList.add(activeClass);
  }

  startPictureSlideShow(lockScreenElmnt: HTMLDivElement, contentSet:string[]) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_PICTURE;
    this.startSlideShow(lockScreenElmnt, contentSet, type);
  }

  startColorSlideShow(lockScreenElmnt: HTMLDivElement) {
    const type = Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR;
    const contentSet = this.generateColorOptions();
    this.startSlideShow(lockScreenElmnt, contentSet, type);
  }

  startSlideShow(lockScreenElmnt: HTMLDivElement, contentSet:string[], setType:string):void {
    this.slideShowIntervalId = CommonFunctions.startSlideShow(lockScreenElmnt, contentSet, setType);
  }

  stopSlideShow():void{
    CommonFunctions.stopSlideShow(this.slideShowIntervalId);
  }

  generateColorOptions():string[]{
    return Constants.LOCKSCREEN_DESKTOP_COLORS;
  }

  generateLockScreenPictureOptions():string[]{
    const options:string[] = [];
    const lockScreenImgPath = Constants.LOCK_SCREEN_IMAGE_BASE_PATH;
    const lockScreenImages = Constants.LOCKSCREEN_PICTURE_SET;

    lockScreenImages.forEach( imgName =>{ options.push(`${lockScreenImgPath}${imgName}`) });
    return options;
  }

  // ========================================================================
  // Power menu UI handlers
  // ========================================================================
  async onPowerBtnClick(evt:MouseEvent): Promise<void>{
    evt.preventDefault();

    // The lock-screen container also listens for (click), and that handler
    // (onLockScreenViewClick) hides the power menu. Without stopPropagation
    // the click would bubble up and immediately close the menu we are about
    // to open. The previous implementation worked around this with a 10 ms
    // CommonFunctions.sleep delay -- removed, because stopping propagation
    // addresses the actual cause rather than masking it with a timing hack.
    evt.stopPropagation();

    if(!this.showPowerMenu && !this.isPowerMenuVisible){
      this.showPowerMenu = true;

      const powerBtnElmt = document.getElementById('powerBtnCntnr'); 
      if(powerBtnElmt){
        const pwrBtnRect = powerBtnElmt.getBoundingClientRect();
        powerBtnElmt.style.backgroundColor = Constants.EMPTY_STRING;

        // Position the floating power menu just above-left of the button.
        const translateX = pwrBtnRect.x - LoginComponent.POWER_MENU_OFFSET_X_PX;
        const translateY = pwrBtnRect.y - LoginComponent.POWER_MENU_OFFSET_Y_PX;
        this.powerMenuStyle = {
          'position':'absolute',
          'transform':`translate(${String(translateX)}px, ${String(translateY)}px)`,
          'z-index': 6,
        }
        this.isPowerMenuVisible = true;
        this.onPwdFieldRemoveFocus();
      }
    }else{
      this.showPowerMenu = false;
      this.isPowerMenuVisible = false;
    }    
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
      powerBtnElmt.style.backgroundColor = Constants.EMPTY_STRING;
    }
  }

  // ========================================================================
  // Power actions (shutdown / restart)
  // ========================================================================
  async shutDownOSFromLockScreen():Promise<void>{
    // Discriminate caller: the desktop-initiated path runs us inside login's
    // own shutDownSystemNotify subscriber, which has already set the flag
    // (and emitted the notification via dialog.component). Only the direct
    // lock-screen-menu invocation finds the flag unset -- and that path
    // needs to emit shutDownSystemNotify itself so poweronoff.component
    // gets its cleanup signal (the one that resets isFirstPwrOn so the
    // startup audio plays on the next power-on cycle).
    //
    // We own setting/clearing the flag on this branch; the subscriber owns
    // it on the other branch. See the field-level comment on
    // _shutdownInProgress for the full rationale.
    const isDirectMenuCall = !this._shutdownInProgress;
    if (isDirectMenuCall) {
      this._shutdownInProgress = true;
      // Emit BEFORE we run the rest of the shutdown UI so poweronoff's
      // 6.25 s cleanup timer starts in parallel with our 6 s
      // "Shutting down" display -- matching the timing of the
      // dialog-initiated path. By the time the power-on/off screen is shown,
      // poweronoff's flags (including isFirstPwrOn) are already reset.
      this._systemNotificationService.shutDownSystemNotify.next();
    }

    try {
      this.resetFields();
      this.changeLockScreenLogonPosition(LoginComponent.LOGON_POSITION_TOP_POWER_PCT);
      this.hidePowerBtn();
      this.exitMessage = 'Shutting down';
      this.showRestartShutDown = true;

      // Switch the lock-screen background to the shutdown blue. Without this
      // call the existing background (mirror/picture/slideshow/solid) would
      // remain while shutting down from the lock screen.
      const isShutDown = true;
      const changeBkgrndColor = true;
      this.setLockScreenBackground(isShutDown, changeBkgrndColor);

      await this.safePlayAudio(this.cheetahRestartAndShutDownAudio);

      this.shutDownRestartPrep(Constants.SYSTEM_SHUT_DOWN);
      this.storeState(Constants.SIGNED_OUT);
      this.storePwrState(Constants.SYSTEM_SHUT_DOWN);

      await CommonFunctions.sleep(LoginComponent.SHUTDOWN_DISPLAY_MS);
      this.showPowerOnOffScreen();
      this.setLockScreenBackground();
    } finally {
      if (isDirectMenuCall) {
        // Only clear the flag on the branch that set it; otherwise we'd
        // race with the subscriber's own try/finally.
        this._shutdownInProgress = false;
      }
    }
  }

  async shutDownOSFromDesktop():Promise<void>{
    const isShutDown = true;
    const changeBkgrndColor = true;

    // Show the lock screen FIRST and wait for it to fully settle before kicking
    // off the shutdown sequence. showLockScreen is async (it may play audio /
    // animate), so without awaiting it the two flows would run concurrently
    // and could clobber each other's DOM mutations and audio playback.
    //
    // showLockScreen's signature is (isShtDwnOrRstrt, chgBkgrnd). It always
    // raises showLockScreenNotify internally, which is the behaviour we want
    // on the desktop-initiated path -- other components need to react to the
    // transition.
    await this.showLockScreen(isShutDown, changeBkgrndColor);
    await this.shutDownOSFromLockScreen();
    this.setLockScreenBackground();
  }

  async restartOSFromLockScreen():Promise<void>{
    this.resetFields();
    this.changeLockScreenLogonPosition(LoginComponent.LOGON_POSITION_TOP_POWER_PCT);
    this.hidePowerBtn();
    this.exitMessage = 'Restarting';
    this.showRestartShutDown = true;

    // Switch the lock-screen background to the restart blue. Without this
    // call the existing background (mirror/picture/slideshow/solid) would
    // remain while restarting from the lock screen.
    const isShutDown = true;
    const changeBkgrndColor = true;
    this.setLockScreenBackground(isShutDown, changeBkgrndColor);

    await this.safePlayAudio(this.cheetahRestartAndShutDownAudio);

    this.shutDownRestartPrep(Constants.SYSTEM_RESTART);
    this.storeState(Constants.SIGNED_OUT);
    this.storePwrState(Constants.SYSTEM_RESTART);

    await CommonFunctions.sleep(LoginComponent.RESTART_DISPLAY_MS);
    this.showPowerOnOffScreen();
    this.setLockScreenBackground();
    this._systemNotificationService.restartSystemNotify.next(Constants.RSTRT_ORDER_PWR_ON_OFF_SCREEN);
  }

  async restartOSFromDesktop():Promise<void>{
    const isRestart = true;
    const changeBkgrndColor = true;

    // Same reasoning as shutDownOSFromDesktop: await the lock screen transition
    // so the restart sequence starts from a known, fully-painted lock-screen
    // state instead of racing with it.
    await this.showLockScreen(isRestart, changeBkgrndColor);
    await this.restartOSFromLockScreen();
    this.setLockScreenBackground();
  }

  shutDownRestartPrep(powerAction:string):void{
    CommonFunctions.prepareSystemForShutdownOrRestart(powerAction, this._systemNotificationService, 
      this._runningProcessService, this._processHandlerService, this._windowService, this._defaultService);
  }

  showPowerOnOffScreen():void{
    const powerOnOffElmnt = document.getElementById('powerOnOffCmpnt') as HTMLDivElement;
    if(powerOnOffElmnt){
      powerOnOffElmnt.style.zIndex = '7';
      powerOnOffElmnt.style.display = 'block';

      this.resetAuthFormState();
      this.changeLockScreenLogonPosition(LoginComponent.LOGON_POSITION_TOP_DEFAULT_PCT);
      this.showPowerBtn();
      this.storeState(Constants.SIGNED_OUT);

      this.viewOptions = this.currentDateTime;
      this.removeLockScreenBackDrop();
      this.resetAuthFormTimeOutOnly();
      // raise events to close opened apps
    }
  }

  // ========================================================================
  // Small DOM helpers (positioning / visibility / input focus)
  // ========================================================================
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

  /**
   * count time the user has loggin in
   */
  updateCounter():void{  this.defaultPassWord.push(Constants.D); }
  // ========================================================================
  // UI state resets
  // ========================================================================
  resetAuthFormState():void{
    this.showUserInfo = true;
    this.showPasswordEntry = true;
    this.showLoading = false;
    this.showFailedEntry = false;
    this.showRestartShutDown = false;
  }

  resetFields():void{
    this.showUserInfo = false;
    this.showPasswordEntry = false;
    this.showLoading = false
    this.showFailedEntry = false;
  }

  // ========================================================================
  // Session storage helpers
  // ========================================================================
  storeState(state:string):void{
    this._sessionManagementService.addSession(this.cheetahLogonKey, state);
  }

  storePwrState(state:string):void{
    this._sessionManagementService.addSession(this.cheetahPwrKey, state);
  }
  
  retrievePastSessionData():void{
    const sessionData = this._sessionManagementService.getSession(this.cheetahLogonKey) as string;
    console.log('login-psession:', sessionData);
    if(!sessionData || sessionData === Constants.SIGNED_OUT){
      this.isUserLogedIn = false;
      this.isFirstLogIn = true;
    }else{ 
      this.isUserLogedIn = true;
      this.isFirstLogIn = false;
    }
  }

  // ========================================================================
  // Process registration
  // ========================================================================
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
