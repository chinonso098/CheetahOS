import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowConstants } from '../window.constants';
import { WindowMaximizeHost } from '../windows.types';



/**
 * Owns the maximize / restore / title-bar-double-click flow that used to
 * live inline in PrimaryWindowComponent.
 *
 * Why this is split out:
 *   - The three button/double-click handlers, the shared
 *     `setMaximizeOrRestore` branch, and the geometry restore-from-state
 *     dance are all bound together; pulling them out gives the component
 *     a single field instead of four scattered methods.
 *   - No DOM access, no Angular dependencies -- this class can be
 *     instantiated in tests with a plain object host.
 *
 * Lifecycle: construct once per window, then call `bind(host, ws)` in the
 * component constructor or ngOnInit. Reads of `host.processId` happen at
 * method-invocation time, so binding before @Inputs are populated is fine.
 */
export class WindowMaximizeHandler {
  /** Title-bar height in CSS pixels. Mirrors the .css file. */
  private static readonly WINDOW_TITLE_BAR_HEIGHT_PX = 30;

  private _host!: WindowMaximizeHost;
  private _windowService!: WindowService;

  bind(host: WindowMaximizeHost, windowService: WindowService): void {
    this._host = host;
    this._windowService = windowService;
  }

  /** Maximize button click. Bails when the window isn't maximizable. */
  onMaximizeBtnClick(evt: MouseEvent): void {
    evt.stopPropagation();
    if (!this._host.isWindowMaximizable) return;
    this.setMaximizeOrRestore(true);
  }

  /** Restore button click. */
  onRestoreBtnClick(evt: MouseEvent): void {
    evt.stopPropagation();
    this.setMaximizeOrRestore(false);
  }

  /**
   * Title-bar double-click toggles between maximized and restored,
   * mirroring the standard OS gesture.
   */
  onTitleBarDoubleClick(_evt: MouseEvent): void {
    if (!this._host.isWindowMaximizable) return;
    const maxWindow = !this._host.isWindowInFullScreenMode;
    this.setMaximizeOrRestore(maxWindow);
  }

  /**
   * Core maximize/restore implementation. Public so callers (e.g. the
   * window's own keyboard shortcut path, if added later) can invoke it
   * without going through a synthetic MouseEvent.
   *
   * Restore path is intentionally exhaustive about geometry: previously
   * left/top were left untouched on restore and the window jumped to
   * (0,0) because the maximize animation had written left:0 inline. We
   * now pull every dimension back from the saved WindowState.
   */
  setMaximizeOrRestore(maxWindow: boolean): void {
    const ws = this._windowService.getWindowState(this._host.processId);
    if (!ws) return;

    this._host.isWindowInFullScreenMode = maxWindow;
    ws.isMaximized = maxWindow;

    if (maxWindow) {
      // Going into full screen. `ws` already holds the latest geometry
      // because `syncStatePositionSize` runs on every drag/resize, so it
      // doubles as the "restore target" without an extra save here.
      this._host.windowMaxRestoreAction = WindowConstants.MAXIMIZED;
      this._host.syncFullScreenWindowZIndexForProcess(this._host.processId, ws.zIndex);

      this._windowService.addEventOriginator(this._host.uniqueId);
      this._windowService.maximizeProcessWindowNotify.next();
    } else {
      // Restore from full screen: pull every dimension (size AND position)
      // back from the saved window state, then drive the animation.
      this._host.windowMaxRestoreAction = WindowConstants.RESTORE;

      this._host.windowWidthPx  = ws.widthPx  || this._host.windowWidthPx;
      this._host.windowHeightPx = ws.heightPx || this._host.windowHeightPx;
      this._host.windowLeftPx   = ws.leftPx;
      this._host.windowTopPx    = ws.topPx;

      this._host.applySizeStyles();
      // applyPositionStyles also refreshes strWindowLeftPx/strWindowTopPx,
      // which feed the `winLeft`/`winTop` animation params so restore
      // transitions left/top back to the saved values rather than 0.
      this._host.applyPositionStyles();

      this._windowService.addEventOriginator(this._host.uniqueId);
      this._windowService.minimizeProcessWindowNotify.next([
        this._host.windowWidthPx,
        this._host.windowHeightPx - WindowMaximizeHandler.WINDOW_TITLE_BAR_HEIGHT_PX,
      ]);
    }

    this._windowService.addWindowState(ws);
  }
}
