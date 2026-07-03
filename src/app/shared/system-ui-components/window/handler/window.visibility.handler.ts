import { AnimationEvent } from '@angular/animations';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Process } from 'src/app/system-files/process';
import { WindowState, WindowVisibilityHost } from '../windows.types';
import { WindowConstants } from '../window.constants';

/**
 * Owns the per-window "minimize / restore / show-desktop / lock-screen"
 * visibility lifecycle for primary windows.
 *
 * Why this lives in its own class:
 *   - The hide/show flow has THREE distinct triggers (the window's own
 *     hide button, the global "show desktop" toggle, the lock-screen
 *     dimmer) that share state and must agree on which window currently
 *     owns focus. Co-locating them documents the contract.
 *   - It cleanly separates from the focus controller: visibility
 *     decides "who is visible", focus decides "who is on top among
 *     the visible". The two cooperate through a tiny host surface
 *     (`getNextProcess`, `setFocusOnThisWindow`, ...) instead of
 *     reaching into each other.
 *   - Mistakes in this area caused the Action #1 regression (focus
 *     was not handed off after a window was hidden). Keeping the
 *     publishing of `focusOnNextProcessWindowNotify` /
 *     `noProcessInFocusNotify` in a single dedicated file makes
 *     that contract impossible to miss in future edits.
 *
 * No DOM mutation happens here. The controller mutates host state and
 * asks the host to repaint (`applyOpacityZ`, `setHeaderInActive`, ...).
 */
export class WindowVisibilityHandler {
    private _host!: WindowVisibilityHost;
    private _windowService!: WindowService;
    private _menuService!: MenuService;

    /**
     * Wire the controller. Safe to call from a component constructor:
     * we keep references only; all host state is read lazily when a
     * method runs.
     */
    bind(host: WindowVisibilityHost, windowService: WindowService, menuService: MenuService): void {
        this._host = host;
        this._windowService = windowService;
        this._menuService = menuService;
    }

    // ── Per-window hide toggle ────────────────────────────────────────────
    /**
     * Flip THIS window between hidden and visible. Called by the window's
     * own hide button and by the per-pid "please restore" channel.
     *
     * On hide we hand focus to the next eligible process (or publish the
     * no-focus signal). Forgetting either of those publishes is what
     * caused the prior focus-handoff regression -- they live here so the
     * contract is in one place.
     */
    setHideAndShow(): void {
        const host = this._host;
        const ws = this._windowService.getWindowState(host.processId);
        if (!ws || ws.pId !== host.processId) return;

        host.hideWindow = !host.hideWindow;
        host.windowHideShowAction = host.hideWindow ? WindowConstants.HIDDEN : WindowConstants.VISIBLE;

        if (host.hideWindow) {
            // Hiding: demote in store, drop header focus, fade out, hand
            // focus to the next eligible window.
            ws.isVisible = false;
            ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
            this._windowService.addWindowState(ws);
            this._windowService.removeProcessIDToHiddenOrVisibleWindows(ws.pId);

            host.setHeaderInActive(ws.pId);
            host.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);

            const nxtProcess: Process | undefined = host.getNextProcess();
            if (nxtProcess) {
                this._windowService.focusOnNextProcessWindowNotify.next(nxtProcess.getProcessId);
                this._windowService.currentProcessInFocusNotify.next(nxtProcess.getProcessId);
            } else {
                this._windowService.noProcessInFocusNotify.next();
            }
        } else {
            // Restoring: if we were full-screen when hidden, re-apply the
            // proper z-index before showing so we come back on top.
            if (host.isWindowInFullScreenMode) {
                host.syncFullScreenWindowZIndexForProcess(host.processId, ws.zIndex);
            }
            ws.isVisible = true;
            this._windowService.addWindowState(ws);
            host.setFocusOnThisWindow(ws.pId);

            this._windowService.currentProcessInFocusNotify.next(ws.pId);
            this.resetHideShowWindowsList();
        }
    }

    // ── Global "show desktop / show open windows" toggle ─────────────────
    /**
     * Broadcast handler for the taskbar's "show desktop" / "show open
     * windows" toggle. Each open window receives this call and decides
     * for itself whether to hide or restore.
     *
     * Note: we deliberately do NOT toggle `hideWindow` at the top of the
     * method. Doing so flipped the flag even for windows that took
     * neither branch (e.g. windows the user had already hidden by hand),
     * which left `hideWindow` out of sync with `ws.isVisible`. The flip
     * now happens INSIDE each branch that actually acts.
     */
    setHideAndShowAllVisibleWindows(): void {
        const host = this._host;
        const ws = this._windowService.getWindowState(host.processId);
        if (!ws || ws.pId !== host.processId) return;

        if (ws.isVisible) {
            // visible -> hide as part of "show desktop". Remember THIS
            // window in the hidden list so the inverse op knows it can
            // restore it (and not windows the user hid manually).
            host.hideWindow = true;

            ws.isVisible = false;
            ws.zIndex = WindowConstants.HIDDEN_Z_INDEX;
            this._windowService.addWindowState(ws);
            this._windowService.addProcessIDToHiddenOrVisibleWindows(host.processId);

            host.setHeaderInActive(ws.pId);
            host.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
        } else {
            // hidden -> only restore windows that *we* hid via "show
            // desktop". Anything the user hid manually stays hidden.
            const windowList = this._windowService.getProcessIDOfHiddenOrVisibleWindows();
            if (!windowList.includes(host.processId)) return;

            host.hideWindow = false;

            if (host.isWindowInFullScreenMode) {
                host.syncFullScreenWindowZIndexForProcess(host.processId, ws.zIndex);
            }

            ws.isVisible = true;
            this._windowService.addWindowState(ws);

            // Only the would-be top window gets real focus; everything
            // else slots back in at its prior depth so the visual stack
            // matches what the user had before "show desktop" ran.
            const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
            if (topPid === host.processId) {
                host.setFocusOnThisWindow(ws.pId);
                this._windowService.currentProcessInFocusNotify.next(ws.pId);
            } else {
                host.setWindowToPriorHiddenState(ws, WindowConstants.MIN_Z_INDEX);
            }
        }
    }

    /**
     * Snap the cosmetic z-index of the hide/show animation to its rest
     * value once the animation finishes. Keeping this here mirrors where
     * the hide/show flag is owned.
     */
    hideShowAnimationDone(event: AnimationEvent): void {
        this._host.hsZIndex = event.toState === 'hidden'
            ? WindowConstants.HIDDEN_Z_INDEX
            : WindowConstants.MAX_Z_INDEX;
    }

    /**
     * Clear the "windows hidden by 'show desktop'" bookkeeping list and
     * ask the taskbar context menu to refresh (the menu reflects whether
     * a "show desktop" toggle is currently in effect).
     */
    resetHideShowWindowsList(): void {
        this._windowService.resetHiddenOrVisibleWindowsList();
        this._menuService.updateTaskBarContextMenu.next();
    }

    // ── Lock screen / show-desktop dimming ───────────────────────────────
    /**
     * When the lock screen comes up, every currently-visible window
     * fades out behind it. We do NOT change the window's hidden state
     * here -- the user is just being prevented from seeing the contents.
     */
    lockScreenIsActive(): void {
        const ws: WindowState | null = this._windowService.getWindowState(this._host.processId);
        if (ws && ws.isVisible) {
            this._host.applyOpacityZ(WindowConstants.HIDDEN_Z_INDEX, 0);
        }
    }

    /**
     * When the "show desktop" peek ends (i.e. the desktop is asked to
     * reveal windows again), restore opacity. The top-z window gets
     * MAX_Z_INDEX, everything else MIN_Z_INDEX so the visual stack is
     * the same as before the peek.
     */
    desktopIsActive(): void {
        const ws: WindowState | null = this._windowService.getWindowState(this._host.processId);
        if (!ws || !ws.isVisible) return;

        const topPid = this._windowService.getProcessWindowIDWithHighestZIndex();
        const z = ws.pId === topPid ? WindowConstants.MAX_Z_INDEX : WindowConstants.MIN_Z_INDEX;
        this._host.applyOpacityZ(z, 1);
    }
}
