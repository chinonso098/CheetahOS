import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowDragHost } from '../windows.types';
import { WindowConstants } from '../window.constants';
import { WindowHelper } from '../window.helper';
import { Constants } from 'src/app/system-files/constants';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';

/**
 * Owns pointer-down and drag-end handling for the primary window.
 *
 * Why this lives in its own class:
 *   - The CDK drag handlers do four discrete jobs in sequence (clamp,
 *     repaint, sync service state, nudge silhouette + cascade cursor)
 *     that previously lived inline in the component. Isolating them
 *     makes the order of operations explicit and easy to audit.
 *   - The "drag is active / drag is inactive" broadcast around the
 *     close-animation pause is easy to forget on either end. Keeping
 *     both publishes in one method guarantees they pair correctly.
 *   - The full-screen guard at the top of `onDragEnded` must also
 *     publish the "inactive" broadcast so the rest of the system
 *     doesn't think a drag is still in progress -- a previous bug.
 */
export class WindowDragHandler {
    private _host!: WindowDragHost;
    private _windowService!: WindowService;
    private _defaultService!: DefaultService;

    /** Wire the controller. */
    bind(host: WindowDragHost, windowService: WindowService, defaultService: DefaultService): void {
        this._host = host;
        this._windowService = windowService;
        this._defaultService = defaultService;
    }

    /**
     * Pointer-down on the title bar. Broadcasts "drag-is-active" so other
     * subsystems (silhouettes, hover previews) can step back, then
     * promotes this window to focus.
     */
    onMouseDown(pId: number, evt:MouseEvent): void {
        evt.stopPropagation();
        
        if (this._host.processId !== pId) return;
        
        this._windowService.setWindowDragActive();
        this._host.setFocusOnThisWindow(pId);
        this._windowService.currentProcessInFocusNotify.next(pId);
    }

    /**
     * CDK drag end. Commits the drag delta into absolute coordinates,
     * clamps against the desktop bounds, repaints, syncs the service
     * state, nudges the silhouette, and updates the per-app cascade
     * cursor so the next instance starts from here.
     *
     * Full-screen guard is at the top: maximized windows can't be
     * dragged. We still emit `windowDragIsInActive` so subscribers
     * don't get stuck thinking a drag is in flight.
     */
    onDragEnded(event: CdkDragEnd): void {
        const host = this._host;

        if (host.isWindowInFullScreenMode) {
            // dragging full-screen window is not allowed
            this._windowService.setWindowDragInActive();
            return;
        }

        // CDK gives a clean delta since drag started.
        const delta = event.distance;

        // Commit delta into absolute left/top.
        host.windowLeftPx += delta.x;
        host.windowTopPx  += delta.y;

        // Clamp, repaint, sync.
        this.clampToContainer();
        host.applyPositionStyles();
        host.syncStatePositionSize();

        // Update silhouette to follow the new pos.
        host.setSilhouetteState();
        host.positionSilhouette();

        // Per-app cascade starting point bookkeeping.
        host.updateWindowBoundsState();

        // IMPORTANT: reset the drag transform so we don't accumulate drift.
        event.source.reset();
        this._windowService.setWindowDragInActive();
    }

    /**
     * Clamp the host's current top/left into the desktop bounds. Kept
     * private; only the drag-end path needs it (initial placement uses
     * its own clamping via `WindowHelper.computeClampedPosition`).
     *
     * Behavior is gated by the `DEFAULT_ENFORCE_VIEWPORT_BOUNDS` user
     * setting. When disabled, windows are allowed to be dragged anywhere
     * (including partially off-screen).
     */
    private clampToContainer(): void {
        const host = this._host;
        const containerRef = host.windowContainer;
        if (!containerRef) return;

        // Read the flag defensively: if the DefaultService isn't wired (e.g.
        // in a test stub) treat it as "do not enforce" rather than throwing,
        // because a throw here would abort the caller (`onDragEnded`) before
        // it can reset the CDK drag transform -- which produced the
        // "window jumps around on drag" symptom.
        const enforce = this._defaultService
            ? this._defaultService.getDefaultSetting(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS) === Constants.TRUE
            : false;
        if (!enforce) return;

        const clampData = WindowHelper.clampToContainer(
            containerRef,
            host.windowLeftPx,
            host.windowTopPx,
            WindowConstants.EDGE_PAD_PX,
            WindowConstants.TASKBAR_HEIGHT_PX,
        );
        if (!clampData) return;

        host.windowLeftPx = clampData.leftPx;
        host.windowTopPx  = clampData.topPx;
    }
}
