/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';

import {WindowResizeInfo, WindowResizeHost, WindowState, 
        WindowMaximizeHost, WindowFocusHost, NgResizableEvent, 
        WindowVisibilityHost, WindowCloseHost, WindowCascadeHost, WindowDragHost, 
        ClampedPosition} from '../windows.types';

import { AnimationEvent } from '@angular/animations';

import { Process } from 'src/app/system-files/process';
import { SystemNotificationService } from '../../../system-service/system.notification.service';
import { MenuService } from '../../../system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { WindowConstants } from '../window.constants';
import { WindowStyleHelper } from '../window.style.helper';
import { WindowSilhouetteHandler } from '../handler/window.silhouette.handler';
import { WindowHelper } from '../window.helper';
import { WindowFocusHandler } from '../handler/window.focus.handler';
import { WindowMaximizeHandler } from '../handler/window.maximize.handler';
import { WindowCascadeHandler } from '../handler/window.cascade.handler';
import { WindowResizeHandler } from '../handler/window.resize.handler';
import { WindowVisibilityHandler } from '../handler/window.visibility.handler';
import { WindowCloseHandler } from '../handler/window.close.handler';
import { WindowDragHandler } from '../handler/window.drag.handler';
import { SubscriptionBag } from '../subscription.bag';
import { openCloseAnimation, hideShowAnimation, maximizeRestoreAnimation } from '../window.animations';


// Header background colors. Kept here (and not in WindowConstants) because
// they are presentation concerns specific to this component.
const HEADER_INACTIVE_BG = 'rgb(56,56,56)';
// Inactive header background used ONLY while the title-bar accent toggle is ON.
const HEADER_INACTIVE_ACCENT_BG = 'rgb(43,43,43)'; // #2b2b2b
// 1px border color for a window that is NOT focused while the accent toggle is ON.
const INACTIVE_BORDER_COLOR = 'rgb(43,43,43)'; // #2b2b2b
//const CLOSE_BTN_HOVER_BG = 'rgb(139,10,20)';

 @Component({
   selector: 'cos-primarywindow',
   templateUrl: './primarywindow.component.html',
   animations: [openCloseAnimation, hideShowAnimation, maximizeRestoreAnimation],
   styleUrls: ['./primarywindow.component.css'],
   standalone:false,
 })
 export class PrimaryWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy, WindowFocusHost, WindowMaximizeHost, WindowCascadeHost, WindowResizeHost, WindowVisibilityHost, WindowCloseHost, WindowDragHost {
   @ViewChild('primaryWindowContainer') primaryWindowContainer!: ElementRef;
   @ViewChild('primGlassPaneContainer') primGlassPaneContainer!: ElementRef;

   @Input() runningProcessID = 0;  
   @Input() processAppIcon = Constants.EMPTY_STRING;  
   @Input() processAppName = Constants.EMPTY_STRING;  
   @Input() priorUId = Constants.EMPTY_STRING;  
   @Input() isMaximizable = true;  
   @Input() minimumWindowHeight = 240;
   @Input() minimumWindowWidth = 160;
   @Input() turnOffWindowOpenCloseAnimation = false;  
   @Input() turnOffWindowStacking = false;  

   private _renderer: Renderer2;
   private _runningProcessService!:RunningProcessService;
   private _sessionManagementService!:SessionManagementService;
   private _systemNotificationServices!:SystemNotificationService;
   private _windowService!:WindowService;
   private _originalWindowsState!:WindowState;
   private _menuService!:MenuService;
    private _defaultService!:DefaultService;

   // All RxJS subscriptions owned by this component are tracked here so
   // ngOnDestroy is a single `unsubscribeAll` call. Replaces the prior
   // 14 individual `_xSub!: Subscription` fields and matching unsub lines.
   private readonly _subs = new SubscriptionBag();

  hideWindow = false;
  disableWindowAnimation = false;
  windowOpenCloseAction = WindowConstants.OPEN;
  windowHideShowAction = WindowConstants.VISIBLE;
  windowMaxRestoreAction = WindowConstants.RESTORE;

  minWindowWidthPx = 240;
  minWindowHeightPx = 160;

  windowTransform =  'translate(0,0)';
  hsZIndex = 2;
  // Genie params for the hide/show animation. Recomputed each toggle so the
  // window shrinks toward (or grows from) THIS window's taskbar entry instead
  // of a fixed downward slide. Defaults match the prior static behaviour and
  // are used when the taskbar entry can't be located.
  hsGenieT0 = 'translate(0, 0) scale(1)';
  hsGenieT50 = 'translate(0, 80px) scale(0.82)';
  hsGenieT100 = 'translate(0, 140px) scale(0.7)';
  windowTopPx = 0;
  windowLeftPx = 0;
  windowWidthPx = 0;
  windowHeightPx = 0;

  strWindowZIndex = '0';
  strWindowWidthPx = '0px';
  strWindowHeightPx = '0px';
  // String-form copies of the current top/left, used as params for the
  // maximize/restore animation. Without these, the inline `left:0;top:0`
  // set by the maximized state would never be cleared on restore
  // (the animation engine does not clear unmentioned properties, and
  // ngStyle's KeyValueDiffer wouldn't notice a re-set to the same value).
  strWindowLeftPx = '0px';
  strWindowTopPx  = '0px';

  isWindowMaximizable = true;
  isWindowInFullScreenMode = false;
  currentStyles: Record<string, unknown> = {};
  headerActiveStyles: Record<string, unknown> = {}; 
  // Inline 1px accent OUTLINE on the window container; empty string when the
  // title-bar accent toggle is OFF (then the .window-dd-box default outline
  // shows). Bound via [style.outline]. Deliberately an outline, not a border:
  // a border changes the box and reflows the content, but the window sits on a
  // composited layer (will-change:transform) that fails to re-raster the new
  // content position until a repaint -- so the content visibly floated up a few
  // px until you hovered a title-bar button. An outline never affects layout.
  windowAccentOutline = Constants.EMPTY_STRING;
  // Tracks whether this window's header is currently the focused/active one,
  // so the accent state can be recomputed live when the toggle/accent changes.
  private _isHeaderActive = false;
  // Mirrors the DEFAULT_SHOW_TRANSPARENCY_EFFECT toggle to `.window-transparent`
  // so the window body drops its solid #808080 fill and reveals the desktop.
  isTransparencyOn = false;
  closeBtnStyles: Record<string, unknown> = {};

  readonly hasWindow = false; //The window cmpnt is an exception
  icon = Constants.EMPTY_STRING;
  name = 'Window';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  uniqueGlassPaneId = Constants.EMPTY_STRING;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  // Per-instance silhouette/glass-pane handler. Owns the hidden DIV that
  // covers this window's footprint when it is hidden / minimized / hover-
  // previewed. Each window owns its own handler so calls (show, hide,
  // position, remove) are correctly scoped to this window's pane.
  private readonly _windowSilhouetteHandler = new WindowSilhouetteHandler();

  // Per-instance focus coordinator. Owns the "who has focus / who is
  // demoted / who is hover-previewed" decisions previously duplicated
  // across Primary and Secondary windows. Wired via `bind(...)` in the
  // constructor, which is safe because the handler reads host state
  // (e.g. processId) lazily at method-invocation time, not at bind time.
  private readonly _windowFocusHandler = new WindowFocusHandler();

  // Per-instance maximize / restore coordinator. Owns the full-screen
  // entry/exit dance (geometry snapshot, animation trigger, z-index
  // sync) and the three button/double-click entry points.
  private readonly _windowMaximizeHandler = new WindowMaximizeHandler();

  // Per-instance cascade coordinator. Owns the initial placement
  // (`stackWindow`) and the per-app cascade-cursor bookkeeping
  // (`updateWindowBoundsState`).
  private readonly _windowCascadeHandler = new WindowCascadeHandler();

  // Per-instance resize coordinator. Owns the three ngResizable handlers
  // and the inbound "please take this size" broadcast.
  private readonly _windowResizeHandler = new WindowResizeHandler();

  // Per-instance visibility coordinator. Owns the minimize / restore /
  // show-desktop / lock-screen lifecycle. Co-locates the focus-handoff
  // publish (focusOnNextProcessWindowNotify / noProcessInFocusNotify) that
  // the Action #1 regression depended on, so future edits can't lose it.
  private readonly _windowVisibilityHandler = new WindowVisibilityHandler();

  // Per-instance close coordinator. Owns the close-animation timing,
  // re-entrancy guard, silhouette teardown, focus-next publish, and
  // ngOnDestroy WindowService cleanup. Shared with secondary windows.
  private readonly _windowCloseHandler = new WindowCloseHandler();

  // Per-instance drag coordinator. Owns the CDK drag mouse-down / drag-
  // end handlers (focus on grab, clamp / repaint / sync on release,
  // silhouette + cascade-cursor follow-up, drag-active broadcast pair).
  private readonly _windowDragHandler = new WindowDragHandler();
  

    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, renderer: Renderer2,
                windowService:WindowService, sessionManagementService: SessionManagementService, systemNotificationServices:SystemNotificationService,
                menuService: MenuService, defaultService: DefaultService){
      this._runningProcessService = runningProcessService;
      this._sessionManagementService = sessionManagementService;
      this._windowService = windowService;
      this._systemNotificationServices = systemNotificationServices;
      this._menuService = menuService;
      this._defaultService = defaultService;
      this._renderer = renderer

      // Wire the focus handler. Safe to call here even though @Input-derived
      // fields (processId, uniqueId) are not yet populated: the handler
      // only stores a reference to `this` and reads those fields lazily.
      this._windowFocusHandler.bind(this, windowService, runningProcessService);
      this._windowMaximizeHandler.bind(this, windowService);
      this._windowCascadeHandler.bind(this, windowService);
      this._windowResizeHandler.bind(this, windowService);
      this._windowVisibilityHandler.bind(this, windowService, menuService);
      this._windowCloseHandler.bind(this, windowService);
      this._windowDragHandler.bind(this, windowService, defaultService);

      // Broadcast-style subscriptions (fan out to every *other* window): keep
      // on the legacy Subjects with their in-callback guard. These don't need
      // this.processId, so wiring them in the constructor is fine.
      this._subs.add(this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindowNotMatchingPid(p)}));
      this._subs.add(this._windowService.setProcessWindowToFocusOnMouseHoverNotify.subscribe((p) => {this.setWindowToFocusOnMouseHover(p)}));
      this._subs.add(this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.hideWindowNotMatchingPidOnMouseHover(p)}));
      this._subs.add(this._windowService.restoreProcessWindowOnMouseLeaveNotify.subscribe((p) => {this.restoreWindowOnMouseLeave(p)}));
      this._subs.add(this._windowService.restoreProcessesWindowNotify.subscribe(() => {this.restorePriorFocusOnWindows()}));

      this._subs.add(this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()}));
      this._subs.add(this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()}));

      this._subs.add(this._menuService.showTheDesktop.subscribe(() => {this.setHideAndShowAllVisibleWindows()}));
      this._subs.add(this._menuService.showOpenWindows.subscribe(() => { this.setHideAndShowAllVisibleWindows() }));

      // Personalization: accent color on title bars + 1px window border, and the
      // dedicated title-bar/border transparency toggle. All three feed the header
      // background/border recompute.
      this._subs.add(this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
        if(key === Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS
          || key === Constants.DEFAULT_ACCENT_COLOR
          || key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER){
          this.applyTitleBarAccentState();
        }
        if(key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT){
          this.applyTransparencyState();
        }
      }));
    }

    get getPrimaryWindowContainerElmnt(): HTMLElement {
      return this.primaryWindowContainer.nativeElement;
    }

    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.retrievePastSessionData();

      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();

      // Apply the title-bar accent / window-border state up-front so the
      // border is present before the first focus event paints the header.
      this.applyTitleBarAccentState();
      this.applyTransparencyState();

      // Per-pid keyed channels. MUST be wired here, not in the constructor:
      // Angular populates @Input bindings (i.e. `runningProcessID`) between
      // constructor return and ngOnInit. Subscribing earlier keys every
      // window's Subject at `undefined`, so the bridge in WindowService
      // never finds a subscriber when a publisher targets the real pid --
      // and "focus on next window after close/hide" silently no-ops.
      const pid = this.processId;
      this._subs.add(this._windowService.onRestoreOrMinimizeFor(pid).subscribe(() => this.restoreHiddenWindow(pid)));
      this._subs.add(this._windowService.onFocusOnNextFor(pid).subscribe(() => this.setWindowToFocusAndResetWindowBoundsByPid(pid)));
      this._subs.add(this._windowService.onFocusOnCurrentFor(pid).subscribe(() => this.setFocusOnThisWindow(pid)));
      this._subs.add(this._windowService.onShowOrSetFocusFor(pid).subscribe(() => this.showOrSetProcessWindowToFocusOnClick(pid)));
      this._subs.add(this._windowService.onResizeFor(pid).subscribe(info => this.onRZWindow(info)));
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      // Defer the initial focus broadcast to a microtask. Run synchronously it
      // de-focuses every *other* window during THIS window's ngAfterViewInit,
      // mutating their already-checked [style.outline] accent binding (active
      // accent -> inactive) inside the same change-detection cycle, which
      // throws NG0100 (ExpressionChangedAfterItHasBeenChecked). Deferring lets
      // that repaint land in a fresh change-detection pass.
      queueMicrotask(() => this.setFocusOnWindowAfterInit(this.processId));

      // Capture the initial rendered size (defaultHeightOnOpen / defaultWidthOnOpen).
      this.windowHeightPx = this.getPrimaryWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getPrimaryWindowContainerElmnt.offsetWidth;
      this.strWindowZIndex =  String(WindowConstants.MAX_Z_INDEX);
      this.applySizeStyles();

      // Decide initial position:
      //   - Default windows cascade so multiple instances don't stack on top of each other.
      //   - Windows that opt out of stacking (e.g. the file-transfer dialog) are centered
      //     on the desktop instead. This branch used to incorrectly require
      //     `turnOffWindowOpenCloseAnimation` as well, which left non-animated dialogs
      //     stuck at (0,0).
      if (!this.turnOffWindowStacking) {
        this.stackWindow();
      } else {
        this.centerWindowOnDesktop();
      }

      this.storeWindowStateAfterViewInit();
      this.changeDetectorRef.detectChanges();  // run one extra change-detection cycle after the size/position updates above
    }

    /**
     * Position this window in the visual center of the desktop area. Used for
     * windows that opt out of the cascade behavior.
     */
    private centerWindowOnDesktop(): void {
      const rect = WindowHelper.getDesktopRect();
      if (!rect) return;

      this.windowLeftPx = Math.round((rect.width  - this.windowWidthPx)  * 0.5);
      this.windowTopPx  = Math.round((rect.height - this.windowHeightPx) * 0.5);
      this.applyPositionStyles();
      this.syncStatePositionSize();
    }

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);
      if(this.name === WindowConstants.WINDOW)
        this.name = this.processAppName;

      this.displayName = this.processAppName;
      this.icon = this.processAppIcon;
      this.isWindowMaximizable = this.isMaximizable;
      this.minWindowHeightPx = this.minimumWindowHeight;
      this.minWindowWidthPx = this.minimumWindowWidth;

      if(this.turnOffWindowOpenCloseAnimation && this.turnOffWindowStacking){ // file transfer dialog
        this.disableWindowAnimation = true;
      }
    }

    ngOnDestroy():void{
      // One call replaces the prior per-field unsubscribe block.
      this._subs.unsubscribeAll();

      // Guarantee WindowService state is cleaned up regardless of how the
      // window was closed (X button, task manager, terminal exit,
      // programmatic close, shutdown, etc.). Idempotent -- safe to run
      // after an animated close has already done part of this work.
      this._windowCloseHandler.cleanupServiceState();
    }

    storeWindowStateAfterViewInit():void{
      // Optionally clamp the initial position to the desktop bounds. When
      // the user has DEFAULT_ENFORCE_VIEWPORT_BOUNDS disabled, the
      // window keeps whatever position cascade/centerWindowOnDesktop chose
      // and `this.windowLeftPx` / `this.windowTopPx` are already up to date.
      const enforce = (this._defaultService.getDefaultSetting(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS) === Constants.TRUE) ? true : false;

      if(enforce){
        const clamped: ClampedPosition | undefined = WindowHelper.computeClampedPosition(this.windowLeftPx, this.windowTopPx, this.windowWidthPx, this.windowHeightPx, WindowConstants.TASKBAR_HEIGHT_PX );
        if(!clamped){
          console.warn('Clamped in undefined');
          return;
        }

        this.windowLeftPx = clamped.leftPx;
        this.windowTopPx  = clamped.topPx;
        this.applyPositionStyles();
      }

      // Always seed the saved state from the CURRENT live coordinates.
      // Previously this read from `clamped?.leftPx ?? 0` in the
      // non-enforced branch, which made `clamped` undefined and silently
      // zeroed leftPx/topPx -- causing maximize/restore (and any future
      // consumer of the saved state) to snap the window to (0,0).
      this._originalWindowsState = {
        appName: this.name,
        pId: this.processId,
        widthPx: this.windowWidthPx,
        heightPx: this.windowHeightPx,
        leftPx: this.windowLeftPx,
        topPx: this.windowTopPx,
        zIndex: WindowConstants.MAX_Z_INDEX,
        isVisible: true,
      };

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();
    }

    /**
     * WindowFocusHost: the handler calls this to repaint THIS window's
     * z-index/opacity. Public (rather than private) so the handler can
     * invoke it; behavior is identical to the prior private helper.
     */
    applyOpacityZ(zIndex: number, opacity: number, isWindowVisible:boolean = true): void {

      if(isWindowVisible)
        this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
          this.windowTopPx, zIndex, opacity);
      else
        this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
          this.windowTopPx, zIndex, opacity, isWindowVisible);
    }

    /** Public (was private) so cascade / maximize controllers can invoke it. */
    applyPositionStyles(): void {
      const zIndex = this.hideWindow ? WindowConstants.HIDDEN_Z_INDEX : this.strWindowZIndex;
      const opacity = this.hideWindow ? 0 : 1;

      // Keep the string-form left/top in sync so the maximize/restore
      // animation's `winLeft` / `winTop` params reflect the current position.
      this.strWindowLeftPx = `${this.windowLeftPx}px`;
      this.strWindowTopPx  = `${this.windowTopPx}px`;

      this.currentStyles = WindowStyleHelper.applyStyle(this.currentStyles, this.windowLeftPx,
         this.windowTopPx, Number(zIndex), opacity);
    }

    /**
     * Mirror this window's current pos/size/z-index into the central
     * WindowService store so other parts of the system (task previews,
     * focus restoration, persistence) see fresh values.
     *
     * Public (was private) so cascade / resize controllers can invoke it.
     */
    syncStatePositionSize(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws) return;
      WindowHelper.applyPositionSize(ws, this.windowLeftPx, this.windowTopPx,
        this.windowWidthPx, this.windowHeightPx, this.strWindowZIndex);
      this._windowService.addWindowState(ws);
    }

    /** Public (was private) so maximize / resize controllers can invoke it. */
    applySizeStyles(): void {
      this.strWindowHeightPx = `${this.windowHeightPx}px`;
      this.strWindowWidthPx =  `${this.windowWidthPx}px`;
      this._renderer.setStyle(this.primaryWindowContainer.nativeElement, 'width', `${this.windowWidthPx}px`);
      this._renderer.setStyle(this.primaryWindowContainer.nativeElement, 'height', `${this.windowHeightPx}px`);

      // Push fresh size into the silhouette and apply it to the live pane.
      this._windowSilhouetteHandler.sync({ widthPx: this.windowWidthPx, heightPx: this.windowHeightPx });
      this._windowSilhouetteHandler.syncSize();
    }

    // ════════════════════════════════════════════════════════════════════════
    // WindowFocusHost implementation
    // ════════════════════════════════════════════════════════════════════════
    // The focus handler reads these accessors lazily; safe even though
    // some @Input-derived fields are not populated until ngOnInit.
    get windowName(): string { return this.name; }
    get isHidden(): boolean { return this.hideWindow; }
    get windowComponentIdPrefix(): string { return 'primWinCmpnt'; }
    /**
     * Resolved at change-detection time and bound to `[cdkDragBoundary]` in
     * the template. Returns the desktop container selector when the user's
     * DEFAULT_ENFORCE_VIEWPORT_BOUNDS setting is on, otherwise an empty
     * string -- CDK's drag-ref runs `document.querySelector('')` which
     * yields null and effectively disables the boundary, allowing the
     * window to be dragged partially or fully off-screen.
     *
     * Why an empty string instead of null:
     *   - The directive's input is typed `string | HTMLElement | ElementRef`
     *     and does not accept null at the template-typecheck level.
     *   - `''` is the canonical "no boundary" sentinel inside CDK Drag.
     *
     * Why a getter (rather than caching a field):
     *   - The user can toggle the setting at runtime from the control
     *     panel; a getter picks up the change on the next CD cycle without
     *     any explicit re-bind.
     *   - `DefaultService.getDefaultSetting` is a cheap Map.get, so the
     *     per-cycle read is negligible.
     */
    get dragBoundarySelector(): string {
      const enforce = this._defaultService.getDefaultSetting(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS) === Constants.TRUE;
      return enforce ? '#vantaCntnr' : Constants.EMPTY_STRING;
    }
    /** WindowFocusHost: paint the header in the active color (no pid check). */
    setHeaderActiveStyle(): void {
      this._isHeaderActive = true;
      this.applyTitleBarAccentState();
    }

    /** WindowFocusHost: paint the header in the inactive color (no pid check). */
    setHeaderInActiveStyle(): void {
      this._isHeaderActive = false;
      this.applyTitleBarAccentState();
    }

    /**
     * Recomputes the title-bar background + the 1px window border from the
     * "Show accent color on title bars and window borders" personalization
     * toggle (DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS).
     *   - ON : active header uses the accent color, inactive header uses
     *          HEADER_INACTIVE_ACCENT_BG (#2b2b2b), and a 1px accent border
     *          is drawn around the window.
     *   - OFF: focused header uses the default system color, inactive header
     *          uses HEADER_INACTIVE_BG, no border.
     * Re-run on focus changes and whenever the toggle / accent color changes.
     */
    private applyTitleBarAccentState(): void {
      const accentOn = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS) === Constants.TRUE;
      const accent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
      const transparencyOn = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER) === Constants.TRUE;

      let activeBg = accentOn ? accent : Constants.DEFAULT_SYSTEM_COLOR;
      let inactiveBg = accentOn ? HEADER_INACTIVE_ACCENT_BG : HEADER_INACTIVE_BG;

      // Title-bar/border transparency is its OWN opt-in toggle (separate from the
      // general transparency effect): when ON, the header background goes
      // translucent so the window's acrylic backdrop shows through. Accent ON
      // keeps a soft accent tint; accent OFF is a plain translucent theme surface.
      // OFF keeps the solid fills, so the title bar stays opaque even when the
      // rest of the OS is frosted.
      if(transparencyOn){
        // A touch softer: ease the accent slightly toward the neutral system
        // color before frosting so the accented title bar reads gentler than a
        // full-strength accent.
        if(accentOn){
          activeBg = `color-mix(in srgb, ${accent} 78%, ${Constants.DEFAULT_SYSTEM_COLOR})`;
        }
        activeBg = `color-mix(in srgb, ${activeBg} 68%, transparent)`;
        inactiveBg = `color-mix(in srgb, ${inactiveBg} 68%, transparent)`;
      }

      this.headerActiveStyles = { 'background-color': this._isHeaderActive ? activeBg : inactiveBg };
      this.windowAccentOutline = accentOn ? `1px solid ${this._isHeaderActive ? accent : INACTIVE_BORDER_COLOR}` : Constants.EMPTY_STRING;
    }

    /**
     * Reflects the DEFAULT_SHOW_TRANSPARENCY_EFFECT toggle. ON: the window body
     * background goes transparent so the acrylic content can reveal the desktop.
     * OFF: the body returns to its solid #808080 fill.
     */
    private applyTransparencyState(): void {
      this.isTransparencyOn = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) === Constants.TRUE;
    }

    /** WindowFocusHost: show THIS window's silhouette pane unconditionally. */
    showSilhouettePane(): void {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.show();
    }

    /** WindowFocusHost: hide THIS window's silhouette pane unconditionally. */
    hideSilhouettePane(): void {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.hide();
    }

    /** WindowFocusHost: snapshot the window bounds after a focus acquisition. */
    onAfterFocusAcquired(): void {
      this.updateWindowBoundsState();
    }

    /** WindowFocusHost: taskbar click on a hidden window → restore it. */
    onShowOrSetFocusForHidden(): void {
      this.restoreHiddenWindow(this.processId);
    }

    /**
     * WindowCascadeHost: the cascade handler reads the live container
     * ElementRef so it can measure the rendered window. Exposed as an
     * accessor (rather than passing the ref through `bind`) because
     * @ViewChild fields are populated after construction.
     */
    get windowContainer(): ElementRef | undefined {
      return this.primaryWindowContainer;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Focus methods (thin forwarders to the focus handler)
    // ════════════════════════════════════════════════════════════════════════
    setHeaderInActive(pId:number):void{ this._windowFocusHandler.setHeaderInActive(pId); }
    setHeaderActive(pId:number):void{ this._windowFocusHandler.setHeaderActive(pId); }

    showSilhouette(pId:number): void {
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      this._windowSilhouetteHandler.show();
    }

    showGlassPaneContainer() {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.showContainer();
    }

    hideSilhouette(pId:number):void{
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      this._windowSilhouetteHandler.hide();
    }

    hideGlassPaneContainer() {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.hideContainer();
    }
   
    onHideBtnClick(pId:number, evt:MouseEvent):void{
      evt.stopPropagation();
      
      if(this.processId !== pId) return;
      this.setHideAndShow();
    }

    restoreHiddenWindow(pId:number):void{
      if(this.processId !== pId) return;
      this.setHideAndShow();
    }

    updateWindowZIndex(window: WindowState, zIndex:number):void{
      this._windowFocusHandler.updateWindowZIndex(window, zIndex);
    }

    syncFullScreenWindowZIndexForProcess(pId:number, zIndex:number):void{ // this may be deleted
      if(this.processId !== pId) return;

      this.strWindowZIndex =   String(zIndex);
      this.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
    }

    setWindowToPriorHiddenState(window: WindowState, zIndex: number): void {
      this._windowFocusHandler.setWindowToPriorHiddenState(window, zIndex);
    }

    onMaximizeBtnClick(evt: MouseEvent): void {
      this._windowMaximizeHandler.onMaximizeBtnClick(evt);
    }

    onRestoreBtnClick(evt: MouseEvent): void {
      this._windowMaximizeHandler.onRestoreBtnClick(evt);
    }

    onTitleBarDoubleClick(evt:MouseEvent):void{
      this._windowMaximizeHandler.onTitleBarDoubleClick(evt);
    }

    onMouseDown(pId:number):void{
      this._windowDragHandler.onMouseDown(pId);
    }

    onDragEnded(event: CdkDragEnd): void {
      this._windowDragHandler.onDragEnded(event);
    }

    onRZStop(input: NgResizableEvent):void{
      this._windowResizeHandler.onRZStop(input);
    }

    // Fires continuously while the user drags a resize handle. ngResizable
    // already updates the host element's size visually, so we only need to
    // broadcast the live dimensions so hosted apps can grow/shrink in step.
    onRZResizing(input: NgResizableEvent):void{
      this._windowResizeHandler.onRZResizing(input);
    }

    onRZWindow(input:WindowResizeInfo):void{
      this._windowResizeHandler.onRZWindow(input);
    }

    setHideAndShow():void{
      // Only recompute when hiding (window still visible at full size). On
      // restore the window is already collapsed at the taskbar, so measuring
      // it yields ~0 delta; keep the hide-time targets so restore reverses.
      if (!this.hideWindow) this.computeMinimizeGenieTargets();
      this._windowVisibilityHandler.setHideAndShow();
    }

    setHideAndShowAllVisibleWindows():void{
      // Same as setHideAndShow: capture targets only when about to hide so the
      // restore plays the same path in reverse.
      if (!this.hideWindow) this.computeMinimizeGenieTargets();
      this._windowVisibilityHandler.setHideAndShowAllVisibleWindows();
    }

    /**
     * Recompute the hide/show genie params so the window animates toward (and
     * back out of) ITS taskbar entry. Falls back to the default downward slide
     * when the window container or its taskbar entry can't be measured (e.g.
     * merged-mode entries have no per-pid id). Scaling toward the translated
     * point makes the window appear to collapse into / expand from the entry.
     */
    computeMinimizeGenieTargets():void{
      const winEl: HTMLElement | undefined = this.primaryWindowContainer?.nativeElement;
      const entryEl = document.querySelector<HTMLElement>(`[id^="tskbar-"][id$="-${this.processId}"]`);
      if (!winEl || !entryEl) {
        this.hsGenieT0 = 'translate(0, 0) scale(1)';
        this.hsGenieT50 = 'translate(0, 80px) scale(0.82)';
        this.hsGenieT100 = 'translate(0, 140px) scale(0.7)';
        return;
      }
      const w = winEl.getBoundingClientRect();
      const t = entryEl.getBoundingClientRect();
      const dx = Math.round((t.left + t.width / 2) - (w.left + w.width / 2));
      const dy = Math.round((t.top + t.height / 2) - (w.top + w.height / 2));
      this.hsGenieT0 = 'translate(0, 0) scale(1)';
      this.hsGenieT50 = `translate(${Math.round(dx / 2)}px, ${Math.round(dy / 2)}px) scale(0.5)`;
      this.hsGenieT100 = `translate(${dx}px, ${dy}px) scale(0.08)`;
    }

    hideShowAnimationDone(event: AnimationEvent) {
      this._windowVisibilityHandler.hideShowAnimationDone(event);
    }

    resetHideShowWindowsList():void{
      this._windowVisibilityHandler.resetHideShowWindowsList();
    }

    private setMaximizeOrRestore(maxWindow: boolean): void {
      this._windowMaximizeHandler.setMaximizeOrRestore(maxWindow);
    }

    stackWindow():void{
      this._windowCascadeHandler.stackWindow();
    }

    updateWindowBoundsState(): void {
      this._windowCascadeHandler.updateWindowBoundsState();
    }

    createSilhouette():void{
      this.uniqueGlassPaneId = `primGP-${this.uniqueId}`;

      // Bind once (renderer + container + pane id never change for the life
      // of this window), seed the geometry, then create the hidden pane DIV.
      this._windowSilhouetteHandler.bind(this._renderer, this.primGlassPaneContainer, this.uniqueGlassPaneId);
      this._windowSilhouetteHandler.sync({
        leftPx: this.windowLeftPx, topPx: this.windowTopPx,
        widthPx: this.windowWidthPx, heightPx: this.windowHeightPx,
      });
      this._windowSilhouetteHandler.create();
    }

    /**
     * Push the window's current position into the silhouette handler.
     * Called before every show/hide/position op so the pane is aligned with
     * the window's current coordinates (size is pushed in `applySizeStyles`).
     */
    setSilhouetteState():void{
      this._windowSilhouetteHandler.sync({ leftPx: this.windowLeftPx, topPx: this.windowTopPx });
    }

    /**
     * WindowDragHost: thin wrapper so the drag handler can nudge the
     * silhouette without holding a reference to the silhouette handler.
     */
    positionSilhouette(): void {
      this._windowSilhouetteHandler.position();
    }

    /**
     * WindowCloseHost: thin wrapper so the close handler can tear down
     * the silhouette without holding a direct silhouette reference.
     */
    removeSilhouette(): void {
      this._windowSilhouetteHandler.remove();
    }

    async onCloseBtnClick(evt:MouseEvent):Promise<void>{
      evt.stopPropagation();

      // Re-entrancy guard: if the user mashes the X button or another path
      // (taskbar context menu, programmatic close) also fires close, only
      // the first call should do the work. Without this we would call
      // `closeProcessNotify` twice and race the animation tear-down.
      // `beginClose` also tears down the silhouette so it doesn't linger
      // over the taskbar/desktop while the close animation plays.
      if (!this._windowCloseHandler.beginClose()) return;

      if(!this.turnOffWindowOpenCloseAnimation)
        this.windowOpenCloseAction = WindowConstants.CLOSE;

      await this._windowCloseHandler.waitForCloseAnimation();

      const process = this._runningProcessService.getProcess(this.processId);
      if(process){
        this._runningProcessService.closeProcessNotify.next(process);
        // cleanupWindowDataForApp is idempotent and will also run in ngOnDestroy.
        this._windowService.cleanupWindowDataForApp(this.uniqueId);
      }

      this._windowCloseHandler.publishFocusOnNext();
    }

    setFocusOnThisWindow(pId:number):void{
      this._windowFocusHandler.setFocusOnThisWindow(pId);
    }

    setFocusOnWindowAfterInit(pId:number):void{
      this._windowFocusHandler.setFocusOnWindowAfterInit(pId);
    }

    setWindowToFocusOnMouseHover(pId:number):void{
      this._windowFocusHandler.setWindowToFocusOnMouseHover(pId);
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are set out of focus 
     */
    removeFocusOnWindowNotMatchingPid(pId:number):void{
      this._windowFocusHandler.removeFocusOnWindowNotMatchingPid(pId);
    }

    restorePriorFocusOnWindows():void{
      this._windowFocusHandler.restorePriorFocusOnWindows();
    }

    /**
     * the pId of the current window currently in focus is passed. if the pId of other windows do not match,
     * then they are hidden by setting z -index = 0
     */
    hideWindowNotMatchingPidOnMouseHover(pId:number):void{
      this._windowFocusHandler.hideWindowNotMatchingPidOnMouseHover(pId);
    }

    restoreWindowOnMouseLeave(pId:number):void{
      this._windowFocusHandler.restoreWindowOnMouseLeave(pId);
    }

    //the window positioning is acting wonky, but it is kinda 50% there
    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      this._windowFocusHandler.showOrSetProcessWindowToFocusOnClick(pId);
    }

    setWindowToFocusAndResetWindowBoundsByPid(pId:number):void{
      this._windowFocusHandler.setWindowToFocusAndResetWindowBoundsByPid(pId);
    }

    setFocusOnWindowAndUpdateStates(pId:number):void{
      this._windowFocusHandler.setFocusOnWindowAndUpdateStates(pId);
    }

    showOnlyWindowById(pId: number): void {
      this._windowFocusHandler.showOnlyWindowById(pId);
    }

    resetLockScreenTimeOut():void{
      this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
    }

    lockScreenIsActive(): void {
      this._windowVisibilityHandler.lockScreenIsActive();
    }

    desktopIsActive(): void {
      this._windowVisibilityHandler.desktopIsActive();
    }

    /**
     * this method returns a process that has a windows, with a visible state
     * @returns Process
     */
    getNextProcess():Process | undefined{
      return this._windowFocusHandler.getNextProcess();
    }

    retrievePastSessionData():void{
      // The session blob exists only to carry forward window position/size
      // information across reloads. Once this window has been re-created the
      // data is no longer needed, so consume-and-delete is the right policy.
      //
      // Order of operations for context:
      //   1. App component constructor runs.
      //   2. Window component constructor runs.
      //   3. Window component ngOnChanges (inputs land).
      //   4. Window component ngOnInit (this method is called from here).
      const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
      if(appSessionData !== null && appSessionData.window !== undefined){
        this._sessionManagementService.removeAppSession(this.priorUId);
      }
    }

}