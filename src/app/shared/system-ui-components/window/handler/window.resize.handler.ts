import { WindowService } from 'src/app/shared/system-service/window.service';
import { NgResizableEvent, WindowResizeHost, WindowResizeInfo } from '../windows.types';

/**
 * Owns the trio of resize handlers (commit, live, remote-driven) that
 * the primary window used to carry inline.
 *
 * - `onRZStop` runs when the user releases a resize handle: commit the
 *   final dimensions and persist.
 * - `onRZResizing` fires continuously while the handle is dragged. The
 *   ngResizable directive already updates the host element's CSS size
 *   visually, so the only job here is to broadcast the live dimensions
 *   so apps embedded in the window can grow/shrink in lockstep.
 * - `onRZWindow` is the inbound side: invoked when ANOTHER part of the
 *   system (e.g. a maximize from a different window's title bar) tells
 *   us to take on a specific size.
 */
export class WindowResizeHandler {
  private _host!: WindowResizeHost;
  private _windowService!: WindowService;

  bind(host: WindowResizeHost, windowService: WindowService): void {
    this._host = host;
    this._windowService = windowService;
  }

  /** Commit the final dimensions on resize-end. */
  onRZStop(input: NgResizableEvent): void {
    this._host.windowWidthPx  = Number(input.size.width);
    this._host.windowHeightPx = Number(input.size.height);
    this._host.applySizeStyles();
    this._host.syncStatePositionSize();
  }

  /**
   * Fires continuously while the user drags a resize handle. The
   * ngResizable directive owns the CSS size update; we just broadcast
   * the live dimensions so hosted apps stay in lockstep.
   */
  onRZResizing(input: NgResizableEvent): void {
    const widthPx  = Number(input.size.width);
    const heightPx = Number(input.size.height);
    if (!widthPx || !heightPx) return;

    const resize: WindowResizeInfo = { pId: this._host.processId, widthPx, heightPx };
    this._windowService.resizeProcessWindowNotify.next(resize);
  }

  /**
   * Inbound resize: another part of the system requested this window
   * to take on a specific size. Bails if the window state has been
   * torn down (no matching WindowState in the service).
   */
  onRZWindow(input: WindowResizeInfo): void {
    const ws = this._windowService.getWindowState(this._host.processId);
    if (!ws) return;

    this._host.windowHeightPx = input.heightPx;
    this._host.windowWidthPx  = input.widthPx;
    this._host.applySizeStyles();
    this._host.syncStatePositionSize();
  }
}
export { WindowResizeHost };

