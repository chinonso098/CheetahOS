import { Component, Input, OnInit, OnDestroy, ElementRef, AfterViewInit,OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges, Renderer2 } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { ComponentType } from 'src/app/system-files/system.types';
import { MenuService } from '../../../system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessHandlerService } from '../../../system-service/process.handler.service';
import { UserNotificationService } from '../../../system-service/user.notification.service';
import { SystemNotificationService } from '../../../system-service/system.notification.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';

import { WindowState, WindowFocusHost, WindowCloseHost } from '../windows.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowHelper } from '../window.helper';
import { WindowStyleHelper } from '../window.style.helper';
import { WindowSilhouetteHandler } from '../handler/window.silhouette.handler';
import { WindowConstants } from '../window.constants';
import { WindowFocusHandler } from '../handler/window.focus.handler';
import { WindowCloseHandler } from '../handler/window.close.handler';
import { SubscriptionBag } from '../subscription.bag';

// ──────────────────────────────────────────────────────────────────────────
// Header color tokens. Kept here (not in a global theme file) so the
// secondary-window visuals can be tuned independently of the primary window.
// Values intentionally mirror PrimaryWindowComponent for visual consistency.
// The close-button hover background is driven purely by CSS.
// ────────────────────────────────────────────────────────────────────────────
const HEADER_INACTIVE_BG = 'hsla(0, 0%, 85%, 1)';
// Inactive header background used ONLY while the title-bar accent toggle is ON.
const HEADER_INACTIVE_ACCENT_BG = 'rgb(217,217,217)'; // #d9d9d9
// 1px border color for a window that is NOT focused while the accent toggle is ON.
const INACTIVE_BORDER_COLOR = 'rgb(43,43,43)'; // #2b2b2b

@Component({
  selector: 'cos-secondarywindow',
  templateUrl: './secondarywindow.component.html',
  styleUrl: './secondarywindow.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
 export class SecondaryWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy, WindowFocusHost, WindowCloseHost {

    // ────────────────────────────────────────────────────────────────────────
    // Template refs
    // ────────────────────────────────────────────────────────────────────────
    @ViewChild('secondaryWindowContainer') secondaryWindowContainer!: ElementRef;
    @ViewChild('secGlassPaneContainer') secGlassPaneContainer!: ElementRef;

    // ────────────────────────────────────────────────────────────────────────
    // Inputs
    // ────────────────────────────────────────────────────────────────────────
    @Input() runningProcessID = 0;
    @Input() processAppIcon = Constants.EMPTY_STRING;
    @Input() displayMessage = Constants.EMPTY_STRING;
    @Input() processAppName = Constants.EMPTY_STRING;
    @Input() callingProcessUId = Constants.EMPTY_STRING;
    @Input() isDialog = false;
    @Input() showTitleBarImg = false;

    // ────────────────────────────────────────────────────────────────────────
    // Injected services
    // ────────────────────────────────────────────────────────────────────────
    private _runningProcessService!:RunningProcessService;
    private _systemNotificationServices!:SystemNotificationService;
    private _windowService!:WindowService;
    private _menuService!:MenuService;
    private _processHandlerService!:ProcessHandlerService;
    private _userNotificationServices:UserNotificationService;
    private _defaultService!:DefaultService;

    // ────────────────────────────────────────────────────────────────────────
    // Internal state
    // ────────────────────────────────────────────────────────────────────────
    private _originalWindowsState!:WindowState;

    // ────────────────────────────────────────────────────────────────────────
    // Subscriptions (tracked via the bag; ngOnDestroy is a single call)
    // ────────────────────────────────────────────────────────────────────────
    private readonly _subs = new SubscriptionBag();

    // Tracks the deferred paint scheduled by `centerNotificationWindowWithinCallingProcess`
    // so it can be cancelled in ngOnDestroy. Without this, a rapid close
    // (dialog opened-and-closed within ~1ms) would fire the callback on a
    // torn-down component instance.
    private _centerWindowTimer: ReturnType<typeof setTimeout> | null = null;

    // ────────────────────────────────────────────────────────────────────────
    // Window geometry (numeric)
    // ────────────────────────────────────────────────────────────────────────
    windowTopPx = 0;
    windowLeftPx = 0;
    windowWidthPx = 0;
    windowHeightPx = 0;

    // ────────────────────────────────────────────────────────────────────────
    // Window geometry (string / template-bound)
    // ────────────────────────────────────────────────────────────────────────
    strWindowZIndex = '0';
    strWindowWidthPx = '0px';
    strWindowHeightPx = '0px';

    // ────────────────────────────────────────────────────────────────────────
    // Drag scratch values
    // ────────────────────────────────────────────────────────────────────────
    xAxisTmp = 0;
    yAxisTmp = 0;
    windowTransform = Constants.EMPTY_STRING;

    // ────────────────────────────────────────────────────────────────────────
    // Visibility / mode flags
    // ────────────────────────────────────────────────────────────────────────
    windowHide = false;
    windowMaximize = false;

    // ────────────────────────────────────────────────────────────────────────
    // Dialog / calling-process context
    // ────────────────────────────────────────────────────────────────────────
    callingProcessId = 0;
    isDialogContent = false;
    showTitleBarIcon = false

    // ────────────────────────────────────────────────────────────────────────
    // Style bindings
    // ────────────────────────────────────────────────────────────────────────
    currentWinStyles: Record<string, unknown> = {};
    headerActiveStyles: Record<string, unknown> = {};
    closeBtnStyles: Record<string, unknown> = {};
    // Inline 1px accent OUTLINE on the window container; empty string when the
    // title-bar accent toggle is OFF (then the .window-dd-box default outline
    // shows). Bound via [style.outline]. An outline (not a border) so toggling
    // the accent never reflows the content -- a border reflow leaves the
    // composited window layer's content floated until a repaint.
    windowAccentOutline = Constants.EMPTY_STRING;
    // Whitens the header text/icons so they stay readable on the accent
    // (focused) header. Only true when the toggle is ON *and* this header is
    // focused; the inactive light-grey header keeps its original dark text.
    // Bound via [class.accent-titlebar].
    isTitleBarAccentActive = false;
    // Tracks whether this window's header is currently focused/active so the
    // accent state can be recomputed live when the toggle / accent changes.
    private _isHeaderActive = false;

    // ────────────────────────────────────────────────────────────────────────
    // Identity / metadata
    // ────────────────────────────────────────────────────────────────────────
    readonly hasWindow = false; //The window cmpnt is an exception
    icon = Constants.EMPTY_STRING;
    name = 'Window';
    processId = 0;
    uniqueId = Constants.EMPTY_STRING;
    uniqueGlassPaneId = Constants.EMPTY_STRING;
    type = ComponentType.System;
    displayName = Constants.EMPTY_STRING;

    // Per-instance silhouette/glass-pane handler. Owns the hidden DIV
    // that covers this window's footprint when it is hidden / minimized /
    // hover-previewed. Scoped to this window's pane only.
    private readonly _windowSilhouetteHandler = new WindowSilhouetteHandler();

    // Per-instance focus coordinator. Owns the "who has focus / who is
    // demoted / who is hover-previewed" decisions previously duplicated
    // with PrimaryWindow. Reads host state lazily, so binding in the
    // constructor is safe even though some @Input fields aren't yet set.
    private readonly _windowFocusHandler = new WindowFocusHandler();

    // Per-instance close coordinator. Owns the silhouette teardown,
    // focus-next publish, and ngOnDestroy WindowService cleanup. Shared
    // with the primary window component. Secondary's close path is
    // synchronous (no animation) and branches dialog vs process, so the
    // orchestration still lives in `closeWindow` below.
    private readonly _windowCloseHandler = new WindowCloseHandler();


    // ════════════════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════════════════
    constructor(runningProcessService:RunningProcessService, private changeDetectorRef: ChangeDetectorRef, private renderer: Renderer2,
                windowService:WindowService, systemNotificationServices:SystemNotificationService, menuService: MenuService, 
                controlProcessService:ProcessHandlerService, notificationServices:UserNotificationService,
                defaultService:DefaultService){
      this._runningProcessService = runningProcessService;
      this._windowService = windowService;
      this._systemNotificationServices = systemNotificationServices;
      this._menuService = menuService;
      this._processHandlerService = controlProcessService;
      this._userNotificationServices = notificationServices;
      this._defaultService = defaultService;

      // Wire the focus handler. Safe to call here even though @Input-derived
      // fields are not yet populated: the handler stores a reference to
      // `this` and reads those fields lazily at method-invocation time.
      this._windowFocusHandler.bind(this, windowService, runningProcessService);
      this._windowCloseHandler.bind(this, windowService);

      // Broadcast-style subscriptions (fan out to every *other* window): keep
      // on the legacy Subjects with their in-callback guard. These don't need
      // this.processId, so wiring them in the constructor is fine.
      this._subs.add(this._windowService.removeFocusOnOtherProcessesWindowNotify.subscribe((p) => {this.removeFocusOnWindowNotMatchingPid(p)}));

      // Hover hide / restore notifications
      this._subs.add(this._windowService.hideOtherProcessesWindowNotify.subscribe((p) => {this.hideWindowNotMatchingPidOnMouseHover(p)}));
      this._subs.add(this._windowService.restoreProcessWindowOnMouseLeaveNotify.subscribe((p) => {this.restoreWindowOnMouseLeave(p)}));
      this._subs.add(this._windowService.restoreProcessesWindowNotify.subscribe(() => {this.restorePriorFocusOnWindows()}));

      // System-level state notifications
      this._subs.add(this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()}));
      this._subs.add(this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.desktopIsActive()}));

      // Show-desktop / show-open-windows menu actions
      this._subs.add(this._menuService.showTheDesktop.subscribe(() => {this.setHideAndShowAllVisibleWindows()}));
      this._subs.add(this._menuService.showOpenWindows.subscribe(() => {this.setHideAndShowAllVisibleWindows()}));

      // Personalization: accent color on title bars + 1px window border.
      this._subs.add(this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
        if(key === Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS || key === Constants.DEFAULT_ACCENT_COLOR){
          this.applyTitleBarAccentState();
        }
      }));
    }


    // ════════════════════════════════════════════════════════════════════════
    // Getters
    // ════════════════════════════════════════════════════════════════════════
    get getSecondaryWindowContainerElmnt(): HTMLElement {
      return this.secondaryWindowContainer.nativeElement;
    }


    // ════════════════════════════════════════════════════════════════════════
    // Angular lifecycle hooks
    // ════════════════════════════════════════════════════════════════════════
    ngOnInit():void{
      this.processId = this.runningProcessID;
      this.icon = this.processAppIcon;
      this.name = this.processAppName;
      this.isDialogContent = this.isDialog;
      this.showTitleBarIcon = this.showTitleBarImg;
    
      this.uniqueId = `${this.name}-${this.processId}`;
      this._runningProcessService.newProcessNotify.next(this.uniqueId);
      this._windowService.addProcessWindowToWindows(this.uniqueId); 
      this.resetHideShowWindowsList();

      // Apply the title-bar accent / window-border state up-front so the
      // border is present before the first focus event paints the header.
      this.applyTitleBarAccentState();

      // Per-pid keyed channels. MUST be wired here, not in the constructor:
      // Angular populates @Input bindings (i.e. `runningProcessID`) between
      // constructor return and ngOnInit. Subscribing earlier keys every
      // window's Subject at `undefined`, so events targeting the real pid
      // never reach this window (close/focus-next stops working).
      const pid = this.processId;
      this._subs.add(this._windowService.onFocusOnNextFor(pid).subscribe(() => this.setWindowToFocusByPid(pid)));
      this._subs.add(this._windowService.onFocusOnCurrentFor(pid).subscribe(() => this.setFocusOnThisWindow(pid)));
      this._subs.add(this._windowService.onRemoveFocusFor(pid).subscribe(() => this.setHeaderInActiveStyle()));
      this._subs.add(this._windowService.onShowOrSetFocusFor(pid).subscribe(() => this.showOrSetProcessWindowToFocusOnClick(pid)));
      this._subs.add(this._windowService.onCloseWindowFor(pid).subscribe(() => this.closeWindow()));
    }

    ngOnChanges(changes: SimpleChanges):void{
      //console.log('WINDOW onCHANGES:',changes);
      if(this.name ===  WindowConstants.WINDOW)
        this.name = this.processAppName;

      this.icon = this.processAppIcon;
      if(this.isDialog)
       this.displayName = this.displayMessage; 
      else
       this.displayName = this.processAppName;
    }

    ngAfterViewInit():void{
      this.hideGlassPaneContainer();
      // Defer the initial focus broadcast to a microtask so the cross-window
      // de-focus repaint lands in a fresh change-detection pass instead of
      // mutating already-checked sibling window bindings during this window's
      // ngAfterViewInit (which triggers NG0100). Mirrors PrimaryWindowComponent.
      queueMicrotask(() => this.setFocusOnWindowAfterInit(this.processId));

      // get defaultHeightOnOpen and defaultWidthOnOpen  
      this.windowHeightPx = this.getSecondaryWindowContainerElmnt.offsetHeight;
      this.windowWidthPx = this.getSecondaryWindowContainerElmnt.offsetWidth;
      this.strWindowZIndex =  String(WindowConstants.MAX_Z_INDEX);
      this.applySizeStyles();

      if(this.isDialog && this.callingProcessUId === Constants.EMPTY_STRING){ // file Dialog
        const rect = WindowHelper.getDesktopRect();
        if(rect){
          // top-left position that centers the element
          this.windowLeftPx = Math.round((rect.width - this.windowWidthPx) * 0.5);
          this.windowTopPx  = Math.round((rect.height - this.windowHeightPx) * 0.5);
          this.applyPositionStyles();
        }
      }else if(this.isDialog && this.callingProcessUId !== Constants.EMPTY_STRING){
        this.callingProcessId = Number(this.callingProcessUId.split(Constants.DASH)[1]);
        this.centerNotificationWindowWithinCallingProcess();
      }

      this.storeWindowStateAfterViewInit();
      this.changeDetectorRef.detectChanges();      //tell angular to run additional detection cycle after 
    }

    ngOnDestroy():void{
      // One call replaces the prior per-field unsubscribe block.
      this._subs.unsubscribeAll();

      // Cancel any pending centering paint so the callback can't fire on a
      // destroyed component. Harmless if already nulled out by the callback.
      if (this._centerWindowTimer !== null) {
        clearTimeout(this._centerWindowTimer);
        this._centerWindowTimer = null;
      }

      // Guarantee WindowService state is cleaned up regardless of how the
      // window was closed (X button, dialog dismiss, programmatic close,
      // shutdown). All remove* ops are idempotent so this is safe to run
      // after `closeWindow` has already done part of it.
      this._windowCloseHandler.cleanupServiceState();
    }


    // ════════════════════════════════════════════════════════════════════════
    // Initial state setup
    // ════════════════════════════════════════════════════════════════════════
    storeWindowStateAfterViewInit():void{
      const clamped = WindowHelper.computeClampedPosition(this.windowLeftPx, this.windowTopPx, this.windowWidthPx, this.windowHeightPx, WindowConstants.TASKBAR_HEIGHT_PX );
      if(!clamped){
        console.warn('Clamped in undefined');
        return;
      }

      this.windowLeftPx = clamped.leftPx;
      this.windowTopPx  = clamped.topPx;
      this.applyPositionStyles();

      this._originalWindowsState = {
        appName: this.name,
        pId: this.processId,
        widthPx: this.windowWidthPx,
        heightPx: this.windowHeightPx,
        leftPx: clamped.leftPx,
        topPx: clamped.topPx,
        zIndex: WindowConstants.MAX_Z_INDEX,   // placeholder, service will normalize
        isVisible: true,
      };

      this._windowService.addWindowState(this._originalWindowsState);
      this._windowService.addProcessWindowIDWithHighestZIndex(this.processId);
      this.createSilhouette();
    }

    centerNotificationWindowWithinCallingProcess():void{
      const primWindElmnt = document.getElementById(`primWinCmpnt-${this.callingProcessUId}`) as HTMLElement;
      if(!primWindElmnt) return;

      const winRect = primWindElmnt.getBoundingClientRect();
      this.windowTopPx = winRect.y + (winRect.height * 0.25);
      this.windowLeftPx = winRect.x + (winRect.width * 0.25);

      // Stored so ngOnDestroy can cancel it if the dialog is torn down before
      // the 1ms tick fires (rapid open/close sequence during shutdown, etc.).
      this._centerWindowTimer = setTimeout(() => {
        this._centerWindowTimer = null;
        this.applyPositionStyles();
        this.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
        this.setHeaderActive(this.processId);
      }, 1);
    }


    // ════════════════════════════════════════════════════════════════════════
    // Geometry / style helpers
    // ════════════════════════════════════════════════════════════════════════
    private clampToContainer():void{
      const clampData = WindowHelper.clampToContainer(this.secondaryWindowContainer, this.windowLeftPx, this.windowTopPx, WindowConstants.EDGE_PAD_PX, WindowConstants.TASKBAR_HEIGHT_PX);
      if(!clampData) return;

      this.windowLeftPx = clampData.leftPx;
      this.windowTopPx  = clampData.topPx;
    }

    /**
     * WindowFocusHost: the handler calls this to repaint THIS window's
     * z-index/opacity. Public (rather than private) so the handler can
     * invoke it. The `_isWindowVisible` arg exists only to satisfy the
     * WindowFocusHost interface (primary uses it) -- secondary ignores it.
     */
    applyOpacityZ(zIndex: number, opacity: number, _isWindowVisible?: boolean): void {
      this.currentWinStyles = WindowStyleHelper.applyStyle(this.currentWinStyles, this.windowLeftPx,
         this.windowTopPx, zIndex, opacity);
    }

    private applyPositionStyles(): void {
      const zIndex = this.windowHide ? WindowConstants.HIDDEN_Z_INDEX : this.strWindowZIndex;
      const opacity = this.windowHide ? 0 : 1;

      this.currentWinStyles = WindowStyleHelper.applyStyle(this.currentWinStyles, this.windowLeftPx,
         this.windowTopPx, Number(zIndex), opacity);
    }

    private applySizeStyles(): void {
      this.strWindowHeightPx = `${this.windowHeightPx}px`;
      this.strWindowWidthPx =  `${this.windowWidthPx}px`;
    }

    /**
     * Mirror this window's current pos/size/z-index into the central
     * WindowService store. Helper does the pure field copy; the service
     * read/write lives here.
     */
    private syncStatePositionSize(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws) return;
      WindowHelper.applyPositionSize(ws, this.windowLeftPx, this.windowTopPx,
        this.windowWidthPx, this.windowHeightPx, this.strWindowZIndex);
      this._windowService.addWindowState(ws);
    }


    // ════════════════════════════════════════════════════════════════════════
    // Header / button styling
    //   - setHeaderActive / setHeaderInActive are pid-targeted: a service
    //     broadcast hits every window instance, and each one decides whether
    //     the message is meant for it. The `pId` guard at the top of each
    //     method is what makes that work.
    //   - The dead `setBtnFocus` helper that previously hard-coded the close
    //     button's hover background was removed; the close button hover state
    //     is driven by CSS, not by a TS method.
    // ════════════════════════════════════════════════════════════════════════
    setHeaderInActive(pId:number):void{ this._windowFocusHandler.setHeaderInActive(pId); }
    setHeaderActive(pId:number):void{ this._windowFocusHandler.setHeaderActive(pId); }

    // ════════════════════════════════════════════════════════════════════════
    // WindowFocusHost implementation
    // ════════════════════════════════════════════════════════════════════════
    // The focus handler reads these accessors lazily; safe even though
    // some @Input-derived fields are not populated until ngOnInit.
    get windowName(): string { return this.name; }
    get isHidden(): boolean { return this.windowHide; }
    get windowComponentIdPrefix(): string { return 'secWinCmpnt'; }

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
     *          HEADER_INACTIVE_ACCENT_BG (#2b2b2b), a 1px accent border is
     *          drawn around the window, and the header text/icons switch to
     *          white (via .accent-titlebar) so they stay readable.
     *   - OFF: focused header uses the default system color (#ffffff),
     *          inactive header uses HEADER_INACTIVE_BG, no border,
     *          original dark header text.
     * Re-run on focus changes and whenever the toggle / accent color changes.
     */
    private applyTitleBarAccentState(): void {
      const accentOn = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS) === Constants.TRUE;
      const accent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);

      const activeBg = accentOn ? accent : Constants.DEFAULT_SYSTEM_COLOR_2;
      const inactiveBg = accentOn ? HEADER_INACTIVE_ACCENT_BG : HEADER_INACTIVE_BG;
      this.headerActiveStyles = { 'background-color': this._isHeaderActive ? activeBg : inactiveBg };
      this.windowAccentOutline = accentOn ? `1px solid ${this._isHeaderActive ? accent : INACTIVE_BORDER_COLOR}` : Constants.EMPTY_STRING;
      this.isTitleBarAccentActive = accentOn && this._isHeaderActive;
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

    // Note: `onAfterFocusAcquired` and `onShowOrSetFocusForHidden` are
    // deliberately NOT implemented here. Secondary (dialog) windows have
    // no minimize/restore concept and don't snapshot bounds, so the
    // handler's optional hooks default to no-ops.


    // ════════════════════════════════════════════════════════════════════════
    // Silhouette / glass pane
    // ════════════════════════════════════════════════════════════════════════
    createSilhouette():void{
      this.uniqueGlassPaneId = `secGP-${this.uniqueId}`;

      // Bind once (renderer + container + pane id never change for the life
      // of this window), seed the geometry, then create the hidden pane DIV.
      this._windowSilhouetteHandler.bind(this.renderer, this.secGlassPaneContainer, this.uniqueGlassPaneId);
      this._windowSilhouetteHandler.sync({
        leftPx: this.windowLeftPx, topPx: this.windowTopPx,
        widthPx: this.windowWidthPx, heightPx: this.windowHeightPx,
      });
      this._windowSilhouetteHandler.create();
    }

    /**
     * Push the window's current position into the silhouette handler.
     * Called before every show/hide/position op so the pane is aligned with
     * the window's current coordinates.
     */
    setSilhouetteState():void{
      this._windowSilhouetteHandler.sync({ leftPx: this.windowLeftPx, topPx: this.windowTopPx });
    }

    /**
     * WindowCloseHost: thin wrapper so the close handler can tear down
     * the silhouette without holding a direct silhouette reference.
     */
    removeSilhouette(): void {
      this._windowSilhouetteHandler.remove();
    }

    showSilhouette(pId: number): void {
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      this._windowSilhouetteHandler.show();
    }

    hideSilhouette(pId:number):void{
      if(this.processId !== pId) return;

      this.setSilhouetteState();
      this._windowSilhouetteHandler.hide();
    }

    showGlassPaneContainer() {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.showContainer();
    }

    hideGlassPaneContainer() {
      this.setSilhouetteState();
      this._windowSilhouetteHandler.hideContainer();
    }


    // ════════════════════════════════════════════════════════════════════════
    // Z-index / visibility helpers
    // ════════════════════════════════════════════════════════════════════════
    updateWindowZIndex(window: WindowState, zIndex:number):void{
      this._windowFocusHandler.updateWindowZIndex(window, zIndex);
    }

    setWindowToPriorHiddenState(ws: WindowState, zIndex: number): void {
      this._windowFocusHandler.setWindowToPriorHiddenState(ws, zIndex);
    }

    showOnlyWindowById(pId: number): void {
      this._windowFocusHandler.showOnlyWindowById(pId);
    }


    // ════════════════════════════════════════════════════════════════════════
    // Mouse / drag handlers
    // ════════════════════════════════════════════════════════════════════════
    onMouseDown(pId:number, evt:MouseEvent):void{
      evt.stopPropagation();
      this._windowService.setWindowDragActive();
      this.setFocusOnThisWindow(pId);
      this._windowService.currentProcessInFocusNotify.next(pId);
    }

    onHeaderClick(evt:MouseEvent):void{
      evt.stopPropagation();
      //this._windowFocusHandler.onHeaderClick(evt);
    }

    onDragEnded(event: CdkDragEnd): void {
      // CDK gives a clean delta since drag started
      const delta = event.distance;

      // Commit delta into absolute left/top
      this.windowLeftPx += delta.x;
      this.windowTopPx  += delta.y;

      // Clamp, apply, sync
      this.clampToContainer();
      this.applyPositionStyles();
      this.syncStatePositionSize();
      this.setSilhouetteState();
      this._windowSilhouetteHandler.position();

      // Important: reset the drag transform so we don't accumulate drift
      event.source.reset();
      this._windowService.setWindowDragInActive();
    }


    // ════════════════════════════════════════════════════════════════════════
    // Hide / show window(s)
    // ════════════════════════════════════════════════════════════════════════
    setHideAndShowAllVisibleWindows():void{
      const ws = this._windowService.getWindowState(this.processId);
      if(!ws || ws.pId !== this.processId) return;

      this.windowHide = !this.windowHide;

      if(ws.isVisible && this.windowHide){
        ws.isVisible = false;
        ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
        this._windowService.addWindowState(ws);
        this._windowService.addProcessIDToHiddenOrVisibleWindows(this.processId);

        this.setHeaderInActive(ws.pId);
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
      }
      else if(!ws.isVisible && !this.windowHide ){
        const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();

        if(windowList.includes(this.processId)){
          ws.isVisible = true;
          this._windowService.addWindowState(ws);

          const window_with_highest_zIndex = this._windowService.getProcessWindowIDWithHighestZIndex();
          if(window_with_highest_zIndex === this.processId){
            this.setFocusOnThisWindow(ws.pId);
            this._windowService.currentProcessInFocusNotify.next(ws.pId);
          }
          else{
            this.setWindowToPriorHiddenState(ws, WindowConstants.MIN_Z_INDEX);
          }
        }
      }
    }

    resetHideShowWindowsList():void{
      this._windowService.resetHiddenOrVisibleWindowsList();
      this._menuService.updateTaskBarContextMenu.next();
    }


    // ════════════════════════════════════════════════════════════════════════
    // Close
    // ════════════════════════════════════════════════════════════════════════
    onCloseBtnClick(evt:MouseEvent):void{
      evt.stopPropagation();
      this.closeWindow();
    }

    closeWindow(): void {
      // Re-entrancy guard: secondary windows can be closed by TWO paths --
      // the X button (onCloseBtnClick) and the `closeWindowProcessNotify`
      // channel (currently fired by properties.component). If both fire we'd
      // otherwise call closeDialogMsgBox / closeApplicationProcess twice and
      // publish focus-on-next twice. `beginClose` returns false on the second
      // call AND tears down the silhouette as a side effect (so the explicit
      // setSilhouetteState/removeSilhouette lines below are unnecessary).
      if (!this._windowCloseHandler.beginClose()) return;

      this._windowService.removeWindowState(this.processId);

      if(this.isDialogContent) //Close dialog or process
        this._userNotificationServices.closeDialogMsgBox(this.processId);
      else {
        const process = this._runningProcessService.getProcess(this.processId);
        if(process)
          this._processHandlerService.closeApplicationProcess(process);
      }
      this._windowService.cleanupWindowDataForApp(this.uniqueId);
      this._windowCloseHandler.publishFocusOnNext();
    }


    // ════════════════════════════════════════════════════════════════════════
    // Focus management
    // ════════════════════════════════════════════════════════════════════════
    /**
     * Public focus entry-point invoked by drag/mouse-down handlers and by the
     * `focusOnCurrentProcessWindowNotify` service broadcast. Bails early if
     * the broadcast wasn't meant for this window, or if this window is
     * currently hidden (focusing a hidden window would briefly steal z-index
     * from the visible one).
     */
    setFocusOnThisWindow(pId:number):void{
      this._windowFocusHandler.setFocusOnThisWindow(pId);

      if(this._menuService.getIsContextMenuOpen())
        this._menuService.closeAllContextMenus();
    }

    setFocusOnWindowAfterInit(pId:number):void{
      this._windowFocusHandler.setFocusOnWindowAfterInit(pId);
    }

    setWindowToFocusByPid(pId:number):void{
      this._windowFocusHandler.setWindowToFocusByPid(pId);
    }

    private setFocusOnWindowAndUpdateStates(pId:number):void{
      this._windowFocusHandler.setFocusOnWindowAndUpdateStates(pId);
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

    showOrSetProcessWindowToFocusOnClick(pId:number):void{
      this._windowFocusHandler.showOrSetProcessWindowToFocusOnClick(pId);
    }


    // ════════════════════════════════════════════════════════════════════════
    // Hover handlers
    // ════════════════════════════════════════════════════════════════════════
    setWindowToFocusOnMouseHover(pId:number):void{
      this._windowFocusHandler.setWindowToFocusOnMouseHover(pId);
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


    // ════════════════════════════════════════════════════════════════════════
    // System-level state reactions
    // ════════════════════════════════════════════════════════════════════════
    resetLockScreenTimeOut():void{
      this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
    }

    lockScreenIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (ws && ws.isVisible) {
        this.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
      }
    }

    desktopIsActive(): void {
      const ws = this._windowService.getWindowState(this.processId);
      if (!ws || !ws.isVisible) return;

      const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
      const z = ws.pId === topPid ? WindowConstants.MAX_Z_INDEX : WindowConstants.MIN_Z_INDEX;
      this.applyOpacityZ(z, 1);
    }


    // ════════════════════════════════════════════════════════════════════════
    // Misc helpers
    // ════════════════════════════════════════════════════════════════════════
    /**
     * this method returns a process that has a windows, with a visible state
     * @returns Process
     */
    getNextProcess():Process | undefined{
      return this._windowFocusHandler.getNextProcess();
    }
}
