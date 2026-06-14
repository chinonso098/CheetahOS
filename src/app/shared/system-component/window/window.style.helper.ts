/**
 * Per-window styling helper.
 *
 * Originally this file contained both inline-style composition AND glass-pane
 * (silhouette) management. The silhouette responsibility was extracted to
 * `WindowSilhouetteController` so each concern lives in one place: this file
 * now does nothing except build the `[ngStyle]` object bound to a window.
 *
 * `applyStyle` is pure (no reads or writes to anything except its inputs),
 * so it lives as a `static` method — no instance is required.
 */
export class WindowStyleHelper {

  /**
   * Build the inline-style object bound to a window via `[ngStyle]`. Pure: it
   * doesn't read or write any helper state.
   */
  static applyStyle(inputStyle: Record<string, unknown>, windowLeftPx: number, windowTopPx: number,
    zIndex: number, opacity: number, isVisible: boolean = true): Record<string, unknown> {

    return {
      ...inputStyle,
      left: `${windowLeftPx}px`,
      top: `${windowTopPx}px`,
      transform: isVisible ? 'translate(0, 0)' : 'translate(0, 0) scale(1)',
      'z-index': zIndex,
      opacity
    };
  }
}