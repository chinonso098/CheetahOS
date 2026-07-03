import { ElementRef } from '@angular/core';

export interface WindowState{
    pId: number,
    appName:string
    widthPx:number,
    heightPx:number,
    leftPx:number,
    topPx:number,
    zIndex:number,
    isVisible:boolean,
    isMaximized?:boolean,
}

export interface WindowBoundsState{
    xOffset: number,
    yOffset: number,
    yBoundsSubtraction:number,
    xBoundsSubtraction:number,
}

export interface ClampedPosition{
    leftPx: number;
    topPx: number;
}

export interface WindowPositionInfo {
    pId: number;
    leftPx: number;
    topPx: number;
}

export interface WindowResizeInfo{
    pId:number;
    widthPx:number;
    heightPx:number;
}


/**
 * Per-window state the cascade controller needs to drive window placement
 * (initial cascade-on-open and bookkeeping for the next instance).
 */
export interface WindowCascadeHost {
  readonly uniqueId: string;

  /**
   * Container element ref for the window. Used by `stackWindow` to read
   * the rendered window rectangle so it can compute a safe placement.
   */
  readonly windowContainer: ElementRef | undefined;

  /** Geometry the controller writes into. */
  windowLeftPx: number;
  windowTopPx: number;

  /** Repaint left/top after the controller commits a new position. */
  applyPositionStyles(): void;

  /** Push the new position into the service-tracked WindowState. */
  syncStatePositionSize(): void;
}


/**
 * Payload emitted by the `ngResizable` directive on resize events.
 * We only ever consume the new `size`, so this is intentionally narrow.
 *  * Shape of the resize event emitted by the `ngResizable` directive that
 * wraps the primary window. Intentionally narrow -- we only consume `size`.
 */
export interface NgResizableEvent {
  size: { width: number; height: number };
}

/**
 * Per-window state the resize controller needs. Geometry is mutated
 * in-place; the controller asks the host to re-apply size styles and
 * sync the service-tracked state after each mutation.
 */
export interface WindowResizeHost {
  readonly processId: number;

  /** Current size, in px. Controller writes here on every resize event. */
  windowWidthPx: number;
  windowHeightPx: number;

  /** Repaint width/height (CSS + silhouette). */
  applySizeStyles(): void;

  /** Push the new size into the service-tracked WindowState. */
  syncStatePositionSize(): void;
}

/**
 * Per-window state the maximize controller needs to read and write back
 * into the component. The controller never touches the DOM directly --
 * it asks the host to re-apply styles after geometry changes.
 */
export interface WindowMaximizeHost {
  readonly processId: number;
  readonly uniqueId: string;

  /** True when this window's `[isWindowMaximizable]` input is set. */
  readonly isWindowMaximizable: boolean;

  // Geometry (numeric, in px) ─ controller mutates these in place when
  // restoring from full-screen so the next layout pass picks up the
  // pre-maximize bounds.
  windowWidthPx: number;
  windowHeightPx: number;
  windowLeftPx: number;
  windowTopPx: number;

  /** Set/cleared as the window enters/exits full-screen mode. */
  isWindowInFullScreenMode: boolean;

  /**
   * Drives the maximize/restore Angular animation trigger
   * (WindowConstants.MAXIMIZED / RESTORE).
   */
  windowMaxRestoreAction: string;

  /** Repaint width/height (CSS + silhouette). */
  applySizeStyles(): void;

  /** Repaint left/top/z-index/opacity (also refreshes string-form coords). */
  applyPositionStyles(): void;

  /**
   * Mirror a fresh z-index into the inline style without writing back to
   * the service. Owned by the focus / z-index layer; the maximize
   * controller calls it to keep the about-to-animate window visually on top.
   */
  syncFullScreenWindowZIndexForProcess(pId: number, zIndex: number): void;
}

/**
 * Per-window state the close controller needs. Covers the bits that
 * are common to BOTH primary and secondary close paths:
 *   - silhouette teardown,
 *   - WindowService state cleanup on destroy,
 *   - "focus next process" publish after a window goes away.
 *
 * Per-flavor differences (primary uses an animated `closeProcessNotify`
 * path; secondary branches dialog vs process and runs synchronously)
 * remain in the components themselves.
 */
export interface WindowCloseHost {
  readonly processId: number;
  readonly uniqueId: string;

  /** Sync the silhouette's geometry to current window pos before remove. */
  setSilhouetteState(): void;

  /** Tear down the silhouette DIV (idempotent). */
  removeSilhouette(): void;

  /** Return the next focus-eligible Process, if any. */
  getNextProcess(): import('src/app/system-files/process').Process | undefined;
}

/**
 * Per-window state the drag controller needs. Owns the pointer-down /
 * drag-end handlers for the CDK drag wrapping the window.
 */
export interface WindowDragHost {
  readonly processId: number;
  readonly isWindowInFullScreenMode: boolean;

  /** Container element ref, used to clamp the window inside the desktop. */
  readonly windowContainer: import('@angular/core').ElementRef | undefined;

  /** Current top/left in px. Drag mutates these in place. */
  windowLeftPx: number;
  windowTopPx: number;

  /** Raise focus on this window (used on mouse-down). */
  setFocusOnThisWindow(pId: number): void;

  /** Re-apply inline left/top after drag commits the new position. */
  applyPositionStyles(): void;

  /** Push the new pos into the service-tracked WindowState. */
  syncStatePositionSize(): void;

  /** Sync silhouette geometry to the current pos, then nudge silhouette. */
  setSilhouetteState(): void;
  positionSilhouette(): void;

  /** Update the per-app cascade-cursor so the next instance starts here. */
  updateWindowBoundsState(): void;
}

/**
 * Per-window state the visibility controller needs. Visibility owns the
 * minimize/restore/show-desktop/lock-screen lifecycle; it leans on focus
 * for "who is on top" decisions through a tiny set of host hooks.
 */
export interface WindowVisibilityHost {
  readonly processId: number;

  /** True while the window is in its hidden (minimized) state. */
  hideWindow: boolean;

  /** Drives the hide/show Angular animation (HIDDEN / VISIBLE). */
  windowHideShowAction: string;

  /** Cosmetic z-index snapped at the end of the hide/show animation. */
  hsZIndex: number;

  /**
   * Recompute the hide/show genie params so the window collapses toward (and
   * grows back from) its taskbar entry. Called before flipping visibility.
   */
  computeMinimizeGenieTargets(): void;

  /** True when the window is currently maximized. */
  readonly isWindowInFullScreenMode: boolean;

  /** Paint THIS window's header in the unfocused color. */
  setHeaderInActive(pId: number): void;

  /** Repaint inline z-index / opacity for THIS window. */
  applyOpacityZ(zIndex: number, opacity: number, isWindowVisible?: boolean): void;

  /** Bring THIS window to focus (raise z, paint active header, etc.). */
  setFocusOnThisWindow(pId: number): void;

  /** Mirror a fresh z-index without writing back to the service. */
  syncFullScreenWindowZIndexForProcess(pId: number, zIndex: number): void;

  /** Restore another window to a prior depth (used on partial show-desktop). */
  setWindowToPriorHiddenState(window: WindowState, zIndex: number): void;

  /** Return the next focus-eligible Process (or undefined). */
  getNextProcess(): import('src/app/system-files/process').Process | undefined;
}

/**
 * Host interface implemented by each window component to expose the
 * presentation primitives the focus controller needs.
 *
 * Why an interface (rather than passing the component directly)?
 *   - It documents EXACTLY what state and methods the controller depends on.
 *   - It keeps the controller decoupled from the components' large public
 *     surfaces, so refactors of either side don't ripple.
 *   - It captures the few legitimate differences between PrimaryWindow and
 *     SecondaryWindow (component id prefix, hidden-window semantics,
 *     post-focus side effects) without branching inside the controller.
 */
export interface WindowFocusHost {
  /** The runtime pid of THIS window. Stable from ngOnInit onward. */
  readonly processId: number;

  /** `${name}-${processId}`. Used to compute the focusable DOM node id. */
  readonly uniqueId: string;

  /** App name, used by focus-on-this-window guard. */
  readonly windowName: string;

  /**
   * True when the component is currently in its "hidden" UI state
   * (minimized). Focus attempts must bail because focusing a hidden
   * window would briefly steal z-index from the visible one.
   *
   * Primary maps this to `hideWindow`; secondary maps it to `windowHide`.
   */
  readonly isHidden: boolean;

  /**
   * Component-id prefix used by `WindowHelper.setFocusOnDiv`. Primary
   * windows use `primWinCmpnt`; secondary (dialogs) use `secWinCmpnt`.
   */
  readonly windowComponentIdPrefix: string;

  // ── Presentation primitives ────────────────────────────────────────────
  /** Paint THIS window's header in the focused color. */
  setHeaderActiveStyle(): void;

  /** Paint THIS window's header in the unfocused color. */
  setHeaderInActiveStyle(): void;

  /**
   * Update the inline `z-index` / `opacity` style on THIS window's host
   * element. The optional `isWindowVisible` flag exists only for primary
   * (which preserves a different opacity policy when the window is in
   * the hidden state); secondary may ignore it.
   */
  applyOpacityZ(zIndex: number, opacity: number, isWindowVisible?: boolean): void;

  /**
   * Show/hide THIS window's silhouette (glass pane) overlay. Callers in
   * the controller have already verified that the operation targets this
   * window, so the implementation can call its silhouette controller
   * unconditionally.
   */
  showSilhouettePane(): void;
  hideSilhouettePane(): void;

  // ── Optional, per-component hooks ──────────────────────────────────────
  /**
   * Invoked after a focus acquisition has successfully raised this
   * window's z-index. Primary uses this to snapshot the window bounds
   * so a subsequent minimize/restore can restore them.
   */
  onAfterFocusAcquired?(): void;

  /**
   * Invoked when `showOrSetProcessWindowToFocusOnClick` discovers this
   * window is currently hidden. Primary restores it; secondary
   * (dialogs) has no hidden semantics and may leave this unimplemented.
   */
  onShowOrSetFocusForHidden?(): void;
}