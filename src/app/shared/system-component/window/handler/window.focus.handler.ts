import { WindowService } from 'src/app/shared/system-service/window.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Process } from 'src/app/system-files/process';
import { WindowConstants } from '../window.constants';
import { WindowHelper } from '../window.helper';
import { WindowFocusHost, WindowState } from '../windows.types';


/**
 * Per-window focus coordination logic, factored out of PrimaryWindow and
 * SecondaryWindow (which used to carry near-identical copies).
 *
 * Lifecycle:
 *   - Construct one instance per window component (as a plain class field).
 *   - Call `bind(host, windowService, runningProcessService)` from the
 *     component's constructor or ngOnInit. Until `bind` runs, no controller
 *     method may be invoked.
 *
 * Threading / Angular notes:
 *   - The controller holds NO Angular references (no Renderer, no ElementRef,
 *     no NgZone). All DOM mutation goes through `WindowHelper.setFocusOnDiv`
 *     or back through the host's presentation primitives.
 *   - All per-pid guards live INSIDE the controller. Components no longer
 *     duplicate `if (this.processId !== pId) return;` everywhere.
 */
export class WindowFocusHandler {
  private _host!: WindowFocusHost;
  private _windowService!: WindowService;
  private _runningProcessService!: RunningProcessService;

  /** One-time wiring. Must be called before any other method. */
  bind(host: WindowFocusHost, windowService: WindowService, runningProcessService: RunningProcessService): void {
    this._host = host;
    this._windowService = windowService;
    this._runningProcessService = runningProcessService;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Header styling (pid-guarded so broadcast subjects can fan to all windows)
  // ════════════════════════════════════════════════════════════════════════
  setHeaderActive(pId: number): void {
    if (this._host.processId !== pId) return;
    this._host.setHeaderActiveStyle();
  }

  setHeaderInActive(pId: number): void {
    if (this._host.processId !== pId) return;
    this._host.setHeaderInActiveStyle();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Z-index / opacity helpers
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Mutate a WindowState to the given z-index, then push it back into the
   * service AND repaint THIS window's host element. No-ops if the state
   * does not belong to this window (pid mismatch).
   */
  updateWindowZIndex(ws: WindowState, zIndex: number): void {
    if (this._host.processId !== ws.pId) return;

    this._host.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
    ws.zIndex = zIndex;
    this._windowService.addWindowState(ws);
  }

  /**
   * Repaint THIS window's z-index/opacity without writing back to service
   * state. Used when a window's hidden state must be preserved (e.g.
   * during a "hide everything but the hovered window" pass).
   */
  setWindowToPriorHiddenState(ws: WindowState, zIndex: number): void {
    if (this._host.processId !== ws.pId) return;
    this._host.applyOpacityZ(zIndex, zIndex > 0 ? 1 : 0);
  }

  /**
   * Briefly elevate THIS window to TMP_MAX_Z_INDEX so a hover can preview
   * it above its peers without disturbing the persisted z-order.
   */
  showOnlyWindowById(pId: number): void {
    const ws = this._windowService.getWindowState(pId);
    if (!ws || ws.pId !== pId || ws.pId !== this._host.processId) return;

    const z = WindowConstants.TMP_MAX_Z_INDEX;
    // Primary preserves opacity when the window is in its hidden visual
    // state; secondary ignores the third arg. Pass through ws.isVisible.
    this._host.applyOpacityZ(z, 1, ws.isVisible);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Focus acquisition
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Top-level focus entry-point invoked by the `focusOnCurrentProcessWindow`
   * channel and by drag/mouse-down handlers. Bails early if the broadcast
   * wasn't meant for this window, or if this window is currently hidden.
   *
   * Why the unique-id guard rather than just `pId === processId`?
   *   The broadcast carries only a pid. Two windows could in principle
   *   share a pid temporarily (during teardown). Comparing the full
   *   uniqueId (`name-pid`) makes the guard immune to that race.
   */
  setFocusOnThisWindow(pId: number): void {
    const uId = `${this._host.windowName}-${pId}`;
    if (this._host.uniqueId !== uId || this._host.isHidden) return;

    this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
    this.setFocusOnWindowAndUpdateStates(pId);
    // Primary snapshots window bounds here so a later minimize can restore
    // to the exact same geometry. Secondary leaves this hook unimplemented.
    this._host.onAfterFocusAcquired?.();
  }

  /**
   * Used by initialization paths that need to broadcast focus without
   * touching this window's own z-index (the act of creating the window
   * has already done that).
   */
  setFocusOnWindowAfterInit(pId: number): void {
    this._windowService.removeFocusOnOtherProcessesWindowNotify.next(pId);
    this._windowService.currentProcessInFocusNotify.next(pId);
    this.setHeaderActive(pId);
  }

  /**
   * Raise THIS window's z-index to MAX. Idempotent in the sense that
   * being already at MAX still re-records "highest z-index" and refocuses
   * the DOM node, but it does not bump z-index further.
   */
  setFocusOnWindowAndUpdateStates(pId: number): void {
    const ws = this._windowService.getWindowState(pId);
    if (!ws || ws.pId !== pId || ws.pId !== this._host.processId) return;

    const winCmpntId = `${this._host.windowComponentIdPrefix}-${this._host.windowName}-${this._host.processId}`;

    if (ws.zIndex < WindowConstants.MAX_Z_INDEX) {
      ws.zIndex = WindowConstants.MAX_Z_INDEX;
      this._windowService.addWindowState(ws);
      this._windowService.addProcessWindowIDWithHighestZIndex(pId);

      this._host.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
      this.setHeaderActive(pId);
      WindowHelper.setFocusOnDiv(winCmpntId);
    } else if (ws.zIndex === WindowConstants.MAX_Z_INDEX) {
      this._windowService.addProcessWindowIDWithHighestZIndex(pId);
      this._host.applyOpacityZ(WindowConstants.MAX_Z_INDEX, 1);
      this.setHeaderActive(pId);
      WindowHelper.setFocusOnDiv(winCmpntId);
    }
  }

  /**
   * Focus by pid, but only if the window is currently visible. Used by
   * the "focus on next" path triggered by close/hide of another window.
   */
  setWindowToFocusByPid(pId: number): void {
    if (this._host.processId !== pId) return;

    const ws = this._windowService.getWindowState(this._host.processId);
    if (!ws || !ws.isVisible) return;

    this.setFocusOnWindowAndUpdateStates(ws.pId);
  }

  /**
   * Like `setWindowToFocusByPid`, but ALSO snapshots the new bounds.
   * Primary uses this for the "focus on next" path because the next
   * window's restore-from-minimize geometry needs to be re-anchored.
   */
  setWindowToFocusAndResetWindowBoundsByPid(pId: number): void {
    if (this._host.processId !== pId) return;

    const ws = this._windowService.getWindowState(this._host.processId);
    if (!ws || !ws.isVisible) return;

    this.setFocusOnWindowAndUpdateStates(ws.pId);
    this._host.onAfterFocusAcquired?.();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Anti-focus broadcasts
  // ════════════════════════════════════════════════════════════════════════
  /**
   * `pId` is the window that just took focus. Every OTHER window must
   * demote its header and z-index. Hidden windows are skipped (we don't
   * want to repaint something that's intentionally off-screen).
   */
  removeFocusOnWindowNotMatchingPid(pId: number): void {
    if (this._host.processId === pId) return;

    const ws = this._windowService.getWindowState(this._host.processId);
    if (!ws || !ws.isVisible) return;

    this.setHeaderInActive(ws.pId);
    this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
  }

  /**
   * Sweep all visible windows: the one with the highest persisted z-index
   * becomes active; all others go to MIN. Used to recover from transient
   * states (e.g. lock screen dismissal).
   */
  restorePriorFocusOnWindows(): void {
    const states = this._windowService.getWindowStates();
    const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();

    for (let i = 0; i < states.length; i++) {
      const ws = states[i];
      if (!ws || !ws.isVisible) continue;

      if (ws.pId !== topPid) {
        this.setHeaderInActive(ws.pId);
        this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
      } else {
        this.setHeaderActive(ws.pId);
        this.updateWindowZIndex(ws, WindowConstants.MAX_Z_INDEX);
      }
      // Hide the silhouette in case a hover preview left it visible.
      this.hideSilhouetteForState(ws);
    }
  }

  /**
   * Helper: route the pid-guarded "hide silhouette" through the host. Pulled
   * out because `restorePriorFocusOnWindows` is the only caller that uses
   * the pid from a foreign WindowState rather than `this._host.processId`.
   */
  private hideSilhouetteForState(ws: WindowState): void {
    if (this._host.processId !== ws.pId) return;
    this._host.hideSilhouettePane();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Taskbar-click entry point
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Triggered when a taskbar entry is clicked. Behavior depends on the
   * window's current visibility:
   *   - Hidden  → restore (primary only; secondary has no hidden semantics)
   *   - Visible → re-focus
   */
  showOrSetProcessWindowToFocusOnClick(pId: number): void {
    if (this._host.processId !== pId) return;

    const ws = this._windowService.getWindowState(pId);
    if (!ws) return;

    if (!ws.isVisible) {
      // Secondary windows don't implement this hook (dialogs can't be
      // minimized). For them, an invisible state is a no-op.
      this._host.onShowOrSetFocusForHidden?.();
    } else {
      this.setFocusOnThisWindow(ws.pId);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Hover handlers (taskbar-preview-driven)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Hover on a taskbar preview: temporarily raise THIS window so the user
   * can see it without losing the current focus state of the other
   * windows. The companion "hide others" broadcast handles the rest.
   */
  setWindowToFocusOnMouseHover(pId: number): void {
    this._windowService.hideOtherProcessesWindowNotify.next(pId);
    const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();

    if (this._host.processId !== pId) return;

    if (pId === topPid) this.setHeaderActive(pId);

    // Drop our own silhouette (we're going to render for real) and elevate.
    this._host.hideSilhouettePane();
    this.showOnlyWindowById(pId);
  }

  /**
   * Counterpart to `setWindowToFocusOnMouseHover`: every OTHER visible
   * window is silhouetted-and-demoted while one window is hover-previewed.
   * Hidden windows just get repainted at the hidden z-index (no silhouette).
   */
  hideWindowNotMatchingPidOnMouseHover(pId: number): void {
    if (this._host.processId === pId) return;

    const ws = this._windowService.getWindowStates().find(p => p.pId === this._host.processId);
    if (!ws) return;

    if (ws.isVisible) {
      this._host.showSilhouettePane();
      this.updateWindowZIndex(ws, WindowConstants.HIDDEN_Z_INDEX);
    } else {
      this.setWindowToPriorHiddenState(ws, WindowConstants.HIDDEN_Z_INDEX);
    }
  }

  /**
   * Hover leaves a taskbar preview: restore the state we had before the
   * hover preview took over. The one window that was the prior "top" gets
   * MAX z-index; all other visible windows go to MIN; hidden windows are
   * repainted at HIDDEN.
   */
  restoreWindowOnMouseLeave(pId: number): void {
    const ws = this._windowService.getWindowState(pId);
    if (!ws) return;

    const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();

    if (ws.isVisible) {
      if (ws.pId !== topPid) {
        this.setHeaderInActive(ws.pId);
        this.updateWindowZIndex(ws, WindowConstants.MIN_Z_INDEX);
      } else {
        this.setHeaderActive(ws.pId);
        this.updateWindowZIndex(ws, WindowConstants.MAX_Z_INDEX);
      }
    } else {
      this.setWindowToPriorHiddenState(ws, WindowConstants.HIDDEN_Z_INDEX);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Pure queries
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Returns the Process that owns the window currently at the top of the
   * visible stack -- i.e. the window we should hand focus to next after
   * this one closes or hides. Returns undefined if no visible window
   * remains.
   */
  getNextProcess(): Process | undefined {
    const nextPid = this._windowService.getNextPidInWindowStateList();
    return this._runningProcessService.getProcesses().find(p => p.getProcessId === nextPid);
  }
}
