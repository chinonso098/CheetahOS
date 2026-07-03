import { ElementRef, Renderer2 } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { WindowConstants } from "../window.constants";

/**
 * Per-window silhouette / glass-pane controller.
 *
 * A "silhouette" is a hidden DIV (the glass pane) appended into each
 * window's `glass-pane container` element. When the window is hidden,
 * minimized, or being hover-previewed from the taskbar, this DIV is
 * revealed in its place so the desktop area underneath isn't exposed.
 *
 * History: this used to live inside `WindowStyleHelper` (and before that,
 * inside a module-level singleton). Splitting it out into its own class
 * makes the responsibility explicit, keeps `WindowStyleHelper` purely
 * about CSS-style objects, and shrinks the surface area each window has
 * to wire up. Each window owns its own controller instance; calls are
 * therefore correctly scoped to that window's pane (no cross-window
 * state corruption).
 *
 * Lifecycle (typical):
 *   1. Component constructs `_silhouette = new WindowSilhouetteController()`.
 *   2. `createSilhouette()` calls `bind(renderer, container, paneId)` then
 *      `sync({width, height})` then `create()` — appends the hidden DIV.
 *   3. As the window moves / resizes, the component calls `sync({...})`
 *      then `position()` / `syncSize()` to keep the pane aligned.
 *   4. `show()` / `hide()` toggle visibility for previews and hover ops.
 *   5. `remove()` tears the DIV out of the DOM on close.
 */
export class WindowSilhouetteHandler {

  // ────────────────────────────────────────────────────────────────────────
  // Bound once via `bind()` — these don't change over the controller's life.
  // ────────────────────────────────────────────────────────────────────────
  private renderer: Renderer2 | null = null;
  private container: ElementRef<HTMLElement> | null = null;
  private glassPaneId: string = Constants.EMPTY_STRING;

  // ────────────────────────────────────────────────────────────────────────
  // Geometry — patched through `sync()` whenever the window moves/resizes.
  // ────────────────────────────────────────────────────────────────────────
  private leftPx = 0;
  private topPx = 0;
  private widthPx = 0;
  private heightPx = 0;

  /**
   * Bind the controller to its owning window's renderer, glass-pane
   * container element, and unique pane id. Call once, before `create()`.
   */
  bind(renderer: Renderer2, container: ElementRef<HTMLElement>, glassPaneId: string): void {
    this.renderer = renderer;
    this.container = container;
    this.glassPaneId = glassPaneId;
  }

  /**
   * Patch only the geometry fields present in `patch`. The next call to
   * `position()` / `syncSize()` / `show()` / `create()` reads these values.
   * Non-finite numbers are dropped (kept at their previous value) so a
   * single bad input doesn't corrupt the pane's coordinates.
   */
  sync(patch: { leftPx?: number; topPx?: number; widthPx?: number; heightPx?: number }): void {
    if (patch.leftPx   !== undefined && Number.isFinite(patch.leftPx))   this.leftPx   = patch.leftPx;
    if (patch.topPx    !== undefined && Number.isFinite(patch.topPx))    this.topPx    = patch.topPx;
    if (patch.widthPx  !== undefined && Number.isFinite(patch.widthPx))  this.widthPx  = patch.widthPx;
    if (patch.heightPx !== undefined && Number.isFinite(patch.heightPx)) this.heightPx = patch.heightPx;
  }

  /**
   * Create the (initially hidden) glass-pane DIV and append it into the
   * bound container. Idempotent in spirit — if `bind()` hasn't been called
   * yet, this no-ops rather than throwing.
   */
  create(): void {
    if (!this.renderer || !this.container) return;

    const pane = this.renderer.createElement('div');
    pane.setAttribute('id', this.glassPaneId);
    pane.style.transform = 'translate(0, 0)';
    pane.style.height = `${this.heightPx}px`;
    pane.style.width = `${this.widthPx}px`;
    pane.style.zIndex = String(WindowConstants.HIDDEN_Z_INDEX);
    pane.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    pane.style.backdropFilter = 'blur(2px)';
    pane.style.display = 'none';

    this.renderer.appendChild(this.container.nativeElement, pane);
  }

  /** Reveal the container and the pane, then re-apply position. */
  show(): void {
    this.showContainer();

    const pane = this.pane();
    if (!pane) return;

    pane.style.display = 'block';
    pane.style.zIndex = String(WindowConstants.MIN_Z_INDEX);
    this.position();
  }

  /** Hide both the pane and its parent container. */
  hide(): void {
    this.hideContainer();

    const pane = this.pane();
    if (!pane) return;

    pane.style.display = 'none';
    pane.style.zIndex = String(WindowConstants.HIDDEN_Z_INDEX);
  }

  /** Apply the current `leftPx`/`topPx` to the live pane element. */
  position(): void {
    const pane = this.pane();
    if (!pane) return;

    pane.style.position = 'absolute';
    pane.style.left = `${this.leftPx}px`;
    pane.style.top = `${this.topPx}px`;
    pane.style.transform = 'translate(0px, 0px)';
  }

  /** Apply the current `widthPx`/`heightPx` to the live pane element. */
  syncSize(): void {
    const pane = this.pane();
    if (!pane) return;

    pane.style.width = `${this.widthPx}px`;
    pane.style.height = `${this.heightPx}px`;
  }

  /** Tear the pane element out of the DOM (called on close). */
  remove(): void {
    const pane = this.pane();
    if (!pane) return;
    pane.remove();
  }

  /** Show the glass-pane container (the parent element holding the pane). */
  showContainer(): void {
    if (!this.renderer || !this.container) return;
    this.renderer.setStyle(this.container.nativeElement, 'display', 'block');
  }

  /** Hide the glass-pane container. */
  hideContainer(): void {
    if (!this.renderer || !this.container) return;
    this.renderer.setStyle(this.container.nativeElement, 'display', 'none');
  }

  /** Internal: look up the live pane DIV by id. */
  private pane(): HTMLDivElement | null {
    return document.getElementById(this.glassPaneId) as HTMLDivElement | null;
  }
}
