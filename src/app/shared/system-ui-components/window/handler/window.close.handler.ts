import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { WindowCloseHost } from '../windows.types';

/**
 * Shared close + ngOnDestroy cleanup helper for both primary and
 * secondary windows.
 *
 * Why this lives in its own class:
 *   - The ngOnDestroy WindowService cleanup block was duplicated byte-
 *     for-byte between Primary and Secondary. Same for the "focus next
 *     process after close" publish at the tail of each close method.
 *   - Each component still owns its close ORCHESTRATION (primary is
 *     animated + uses `closeProcessNotify`; secondary is synchronous
 *     and branches dialog vs process) and just calls the helpers
 *     below for the shared bits.
 *   - The primary close needs to wait the full close-animation length
 *     before tearing the process down, which is captured by
 *     `runCloseAnimation` so the constant lives in one place.
 */
export class WindowCloseHandler {
    /**
     * Must be >= the longest open/close animation duration in
     * window.animations.ts so we don't tear the DOM down mid-animation.
     */
    static readonly CLOSE_ANIMATION_MS = 450;

    private _host!: WindowCloseHost;
    private _windowService!: WindowService;

    /** True once the close path has started -- used as a re-entrancy guard. */
    private _isClosing = false;

    /** Wire the controller. */
    bind(host: WindowCloseHost, windowService: WindowService): void {
        this._host = host;
        this._windowService = windowService;
    }

    /** Re-entrancy flag for animated close paths. */
    get isClosing(): boolean { return this._isClosing; }

    /**
     * Mark the close path as started and tear down the silhouette so it
     * doesn't linger over the taskbar/desktop while the close animation
     * plays. Returns `false` if a close is already in flight (caller
     * should bail) and `true` on the first call.
     */
    beginClose(): boolean {
        if (this._isClosing) return false;
        this._isClosing = true;

        // Tear down the silhouette immediately. WindowService state is
        // intentionally NOT removed here -- subscriptions that fire
        // during the close animation (focus shuffles, hover, etc.) still
        // need to be able to look up this window. The final service
        // cleanup happens in `cleanupServiceState`, called from
        // ngOnDestroy after Angular tears the component down.
        this._host.setSilhouetteState();
        this._host.removeSilhouette();
        return true;
    }

    /**
     * Block for the close-animation duration so the visual animation
     * completes before the caller fires the process-close notify.
     */
    async waitForCloseAnimation(): Promise<void> {
        await CommonFunctions.sleep(WindowCloseHandler.CLOSE_ANIMATION_MS);
    }

    /**
     * Publish "focus moves to the next process" after a window has
     * closed. Both flavors do this identically at the tail of their
     * close method, so it lives here.
     */
    publishFocusOnNext(): void {
        const nxt = this._host.getNextProcess();
        if (!nxt) return;
        this._windowService.focusOnNextProcessWindowNotify.next(nxt.getProcessId);
        this._windowService.currentProcessInFocusNotify.next(nxt.getProcessId);
    }

    /**
     * Idempotent WindowService state cleanup invoked from `ngOnDestroy`.
     *
     * Always called, regardless of how the window was closed (X button,
     * task manager, terminal exit, programmatic close, shutdown). Every
     * underlying remove* is safe to repeat, so calling this after a
     * full close path is harmless.
     */
    cleanupServiceState(): void {
        const host = this._host;
        if (!host.uniqueId) return;

        // Clear any lingering "drag is active" broadcast. The window
        // container's `(mousedown)` fires `windowDragIsActive` before the
        // CDK drag begins, but its `(cdkDragEnded)` counterpart only fires
        // if an actual drag happened. Closing a window via the X button is
        // a plain click (mousedown -> click -> destroy) with no drag, so
        // the matching `windowDragIsInActive` never fired and subscribers
        // (e.g. the desktop, which gates its lasso multi-select on this
        // flag) stayed stuck thinking a drag was still in flight until a
        // full page reload. Publishing it here -- on every destroy path --
        // guarantees the flag is reset no matter how the window closed.
        this._windowService.windowDragIsInActive.next();

        this._windowService.removeWindowState(host.processId);
        this._windowService.removeProcessIDToHiddenOrVisibleWindows(host.processId);
        this._windowService.cleanupWindowDataForApp(host.uniqueId);
        // Free per-pid keyed Subjects registered when the component
        // was wired up, so they don't accumulate over app lifetime.
        this._windowService.releaseChannelsForPid(host.processId);
    }
}

// Re-export the animation duration so components can keep using a
// dotted reference without importing the class twice.
export const WINDOW_CLOSE_ANIMATION_MS = WindowCloseHandler.CLOSE_ANIMATION_MS;
