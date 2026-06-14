import { ElementRef } from '@angular/core';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowConstants } from '../window.constants';
import { WindowHelper } from '../window.helper';
import { WindowBoundsState, WindowCascadeHost } from '../windows.types';


/**
 * Owns the "where does a newly opened window go?" decision and the
 * "where would the NEXT instance of this app go?" bookkeeping.
 *
 * Why this lives in its own class:
 *   - `stackWindow` walks a per-app cascade cursor stored on the service;
 *     `updateWindowBoundsState` updates that same cursor after each drag.
 *     Keeping them together makes the relationship obvious.
 *   - Pure layout math + service I/O. No DOM mutation beyond what the
 *     host's `applyPositionStyles` does on its own.
 *
 * Lifecycle: construct once per window, call `bind(host, ws)` before
 * any other method. `stackWindow` may be called from ngAfterViewInit;
 * `updateWindowBoundsState` is called from drag / focus paths.
 */
export class WindowCascadeHandler {
  private _host!: WindowCascadeHost;
  private _windowService!: WindowService;

  bind(host: WindowCascadeHost, windowService: WindowService): void {
    this._host = host;
    this._windowService = windowService;
  }

  /**
   * Place this window using a per-app cascade pattern:
   *   - First instance lands near desktop center.
   *   - Each subsequent instance steps down-right by CASCADE_STEP_PX.
   *   - If the step would push the window off the desktop, the cursor
   *     wraps back to center.
   * The final placement is then clamped to the usable desktop rectangle
   * (excluding the taskbar) with an EDGE_PAD_PX margin.
   */
  stackWindow(): void {
    const containerRect = WindowHelper.getDesktopRect();
    const winEl = this._host.windowContainer?.nativeElement as HTMLElement | undefined;
    if (!containerRect || !winEl) return;

    const winRect = winEl.getBoundingClientRect();

    const step = WindowConstants.CASCADE_STEP_PX;
    const pad = WindowConstants.EDGE_PAD_PX;

    const usableHeight = containerRect.height - WindowConstants.TASKBAR_HEIGHT_PX;

    // Center baseline.
    const centerLeft = Math.round((containerRect.width - winRect.width) / 2);
    const centerTop  = Math.round((usableHeight - winRect.height) / 2);

    // Clamp bounds.
    const maxLeft = Math.max(pad, containerRect.width - winRect.width - pad);
    const maxTop  = Math.max(pad, usableHeight - winRect.height - pad);

    // Per-app cascade cursor.
    let bounds = this._windowService.getProcessWindowBounds(this._host.uniqueId);

    if (!bounds) {
      // First instance: start near center.
      bounds = {
        xOffset: centerLeft,
        yOffset: centerTop,
        xBoundsSubtraction: 0,
        yBoundsSubtraction: 0,
      };
    } else {
      // Next instance: cascade.
      bounds.xOffset += step;
      bounds.yOffset += step;
    }

    // Wrap if overflow.
    if (bounds.xOffset > maxLeft || bounds.yOffset > maxTop) {
      bounds.xOffset = centerLeft;
      bounds.yOffset = centerTop;
    }

    this._windowService.addProcessWindowBounds(this._host.uniqueId, bounds);
    this._host.windowLeftPx = Math.min(Math.max(bounds.xOffset, pad), maxLeft);
    this._host.windowTopPx  = Math.min(Math.max(bounds.yOffset, pad), maxTop);

    this._host.applyPositionStyles();
    this._host.syncStatePositionSize();
  }

  /**
   * After a drag or programmatic move commits, refresh the per-app
   * cascade cursor so the NEXT instance of the same app cascades from
   * the user's most recently chosen position.
   */
  updateWindowBoundsState(): void {
    const current = this._windowService.getProcessWindowBounds(this._host.uniqueId);
    const next: WindowBoundsState = current ?? { xOffset: 0, yOffset: 0, xBoundsSubtraction: 0, yBoundsSubtraction: 0 };

    // Store the current committed absolute px position.
    next.xOffset = this._host.windowLeftPx;
    next.yOffset = this._host.windowTopPx;
    next.xBoundsSubtraction = 0;
    next.yBoundsSubtraction = 0;

    this._windowService.addProcessWindowBounds(this._host.uniqueId, next);
  }
}
