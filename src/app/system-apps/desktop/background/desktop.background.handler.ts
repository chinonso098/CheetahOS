import { ElementRef, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { Constants } from 'src/app/system-files/constants';
import { Colors } from '../colorutil/colors';
import { BIRDS, GLOBE, HALO, RINGS, WAVE, VantaEffect, VantaGlobal } from '../vanta-object/vanta.interfaces';
import { VantaDefaults } from '../vanta-object/vanta.defaults';
import { DesktopRootElements } from '../desktop.types';

// VANTA.js installs a single global of this shape when its bundled scripts
// load.  §1.5 — replaced the previous `any`-shaped declaration with a
// fully-typed `VantaGlobal` (from vanta.interfaces.ts) so every factory
// call is checked against the corresponding config interface.
declare let VANTA: VantaGlobal;

/**
 * DesktopBackground — extracted from DesktopComponent (§1.1.2).
 *
 * Owns three intertwined sub-systems that all share state through the
 * single Vanta-effect / current-index pipeline:
 *
 *   1. **Vanta lifecycle.** Loads three.js + the chosen Vanta effect
 *      script on demand, builds the effect, tears it down, strips
 *      VANTA's invasive inline styles from our host element.
 *
 *   2. **Picture cycling.** Maintains the list of available picture
 *      backgrounds and applies one as a CSS background-image.
 *
 *   3. **Color walker.** When the WAVE effect is live, walks an HSL
 *      hue every 30s and cross-fades the wave color to keep the
 *      background visually alive. Pinned to a "pleasant" sat/light
 *      band so it can't produce neon or washed-out colors.
 *
 * Provided at the COMPONENT scope (in DesktopComponent.providers), NOT
 * `providedIn: 'root'`. This is deliberate: component-scoped DI gives us
 * the host element's `ElementRef` for `removeVantaJSSideEffect()`, and
 * the lifetime is correctly tied to the (never-destroyed) desktop.
 *
 * The component still owns a few things on purpose:
 *   - The `previousBackground()` / `nextBackground()` menu hooks are
 *     thin wrappers on the component because they need to be `.bind()`able
 *     to context-menu actions.
 *   - Any "after a user-driven background change, dismiss the open
 *     icon / context menus" reset is signalled via `menuResetNeeded$`
 *     and handled by the component (menu state is icons-controller scope,
 *     not background scope).
 */
@Injectable()
export class DesktopBackgroundHandler {

    // -------------------------------------------------------------------
    // Public, observable side-effects
    // -------------------------------------------------------------------

    /**
     * Emits at exactly the same points the original
     * DesktopComponent.switchBackground used to call
     * resetIconBtnsAndContextMenus — i.e. on bounds-no-op AND on
     * (try/finally) successful or failed switch. Crucially does NOT
     * emit when the in-flight guard rejects a click, matching the
     * original behaviour ("dropped, not queued").
     */
    readonly menuResetNeeded$ = new Subject<void>();

    // -------------------------------------------------------------------
    // Persisted desktop settings (parsed form). Public so the desktop
    // component can read the current type/value if it ever needs to,
    // but only the service writes to them.
    // -------------------------------------------------------------------

    desktopBackgroundType: string = Constants.EMPTY_STRING;
    desktopBackgroundValue: string = Constants.EMPTY_STRING;

    /** Whether the wave-color-change interval should run on init. */
    private startVantaWaveColorChg = false;

    // -------------------------------------------------------------------
    // Vanta state
    // -------------------------------------------------------------------

    /** The live Vanta effect, or null when nothing is currently mounted. */
    // §1.5 — the live Vanta-effect handle returned by `VANTA.WAVES(...)`
    // (or any other factory).  Replaced the previous `any` with the
    // `VantaEffect` interface from vanta.interfaces.ts, which models the
    // only surface we actually touch (`destroy()`).
    private _vantaEffect: VantaEffect | null = null;

    private waveBkgrnd: WAVE = { el: '#vantaCntnr' };
    private ringsBkgrnd: RINGS = { el: '#vantaCntnr' };
    private haloBkgrnd: HALO = { el: '#vantaCntnr' };
    private globeBkgrnd: GLOBE = { el: '#vantaCntnr' };
    private birdBkgrnd: BIRDS = { el: '#vantaCntnr' };

    // §1.5 — the lookup table is now a `readonly`-tuple so each slot has
    // its concrete effect-config type, and `.length` is a literal `5`.
    // `buildVantaEffect()` accesses individual fields directly instead
    // of indexing this array, so positional narrowing isn't needed here.
    private readonly VANTAS: readonly [WAVE, RINGS, HALO, GLOBE, BIRDS] = [
        this.waveBkgrnd, this.ringsBkgrnd, this.haloBkgrnd,
        this.globeBkgrnd, this.birdBkgrnd,
    ];

    private readonly vantaBackgroundName: string[] = [
        'vanta_wave', 'vanta_ring', 'vanta_halo', 'vanta_globe', 'vanta_bird',
    ];

    private readonly vantaBackGroundPath: string[] = [
        'osdrive/Program-Files/Backgrounds/vanta.waves.min.js',
        'osdrive/Program-Files/Backgrounds/vanta.rings.min.js',
        'osdrive/Program-Files/Backgrounds/vanta.halo.min.js',
        'osdrive/Program-Files/Backgrounds/vanta.globe.min.js',
        'osdrive/Program-Files/Backgrounds/vanta.birds.min.js',
    ];

    private selectedVantaBackgroundName: string = Constants.EMPTY_STRING;
    private selectedVantaScriptPath: string = Constants.EMPTY_STRING;

    // -------------------------------------------------------------------
    // Pictures state
    // -------------------------------------------------------------------

    /** Lazily-populated list of picture-background URLs. */
    private DESKTOP_PICTURES: string[] = [];

    // -------------------------------------------------------------------
    // Background-cycling (next/previous) state
    // -------------------------------------------------------------------

    private readonly MIN_NUMS_OF_DESKTOPS = 0;
    /**
     * Upper bound (inclusive) for `currentDesktopNum`. Updated by
     * `getDesktopBackgroundData()` based on the active background type
     * (vanta count for Dynamic, picture-set size for Picture).
     */
    private maxNumberOfDesktopsBkgrnd = this.VANTAS.length - 1;

    /** Index into either VANTAS[] or DESKTOP_PICTURES[] depending on type. */
    private currentDesktopNum = 0;

    /**
     * Re-entrancy guard for switchBackground(). The "dropped, not queued"
     * semantics is intentional — see comment on switchBackground.
     */
    private isSwitchingBackground = false;

    // -------------------------------------------------------------------
    // Color walker state
    // -------------------------------------------------------------------

    /** Hue/sat/light in [0,1) (hue) / [0,1] (sat,light). See HSL band below. */
    private _hue = 0;
    private _sat = 0;
    private _light = 0;

    /** ID of the recurring color-change interval. */
    private colorChgIntervalId: NodeJS.Timeout | undefined;

    /** Initial wave color used by VantaDefaults.getDefaultWave. */
    private readonly DEFAULT_COLOR = 0x274c;

    /** Tick interval for the color walker. 30 seconds. */
    private readonly COLOR_CHANGE_DELAY = 30000;
    /** Cross-fade duration between two color ticks. 1.5 seconds. */
    private readonly COLOR_TRANSITION_DURATION = 1500;

    /**
     * Per-tick hue advance for the smooth walk, expressed as a fraction
     * of the hue wheel (1.0 == full turn / 360°). ~0.037 = ~13° per tick,
     * so consecutive ticks land on noticeably-different but related hues
     * and the interpolated cross-fade reads as a smooth sweep around the
     * wheel. Chosen to be irrational-ish relative to 1.0 so the walk
     * doesn't cycle back to the same handful of hues every few minutes.
     */
    private static readonly HUE_STRIDE = 0.0371;
    /**
     * Probability (per color tick) of throwing out the smooth walk and
     * re-rolling to a fresh "dazzle" color. Both the smooth walk AND
     * the dazzle re-roll stay inside the DAZZLE_* HSL band, so neither
     * path can produce neon or washed-out colors — the difference is
     * just whether sat/light change on this tick (dazzle) or only hue
     * (smooth). At ~1/12 and one tick per COLOR_CHANGE_DELAY (30s),
     * that's a surprise color roughly every 6 minutes on average.
     */
    private static readonly COLOR_DAZZLE_PROBABILITY = 0.08;

    // The "pleasant" HSL band — sat in [0.35, 0.70], light in [0.35, 0.55].
    // Both the smooth walker and the dazzle re-roll are clamped here so
    // we cannot emit neon (sat>0.70), pastel (sat<0.35), washed-out
    // (light>0.55), or muddy (light<0.35) colors.
    private static readonly DAZZLE_SAT_MIN = 0.35;
    private static readonly DAZZLE_SAT_MAX = 0.70;
    private static readonly DAZZLE_LIGHT_MIN = 0.35;
    private static readonly DAZZLE_LIGHT_MAX = 0.55;

    /**
     * Delay (ms) before stripping the inline `position` and `z-index`
     * styles that VANTA.js writes onto our host element during its own
     * initialization pass. VANTA mutates the host element AFTER its
     * constructor returns — synchronously stripping the styles in
     * `removeVantaJSSideEffect()` would be undone the moment VANTA's
     * init code subsequently re-applies them. 250ms is empirically
     * long enough for VANTA's init/first-frame cycle to settle across
     * the WAVES / RINGS / HALO / GLOBE / BIRDS effects we use.
     * NOTE: still race-vulnerable on slow devices — §1 / §3 follow-up.
     */
    private readonly VANTA_STYLE_STRIP_DELAY_MS = 250;

    constructor(
        private _scriptService: ScriptService,
        private _defaultService: DefaultService,
        private _elRef: ElementRef,
    ) {
        // Seed the walker anywhere on the hue wheel (so the wave
        // background doesn't always start the same color) but pin
        // saturation/lightness to the middle of the pleasant band —
        // that's the initial "home" tone the smooth walk will rotate
        // around until a dazzle tick re-rolls it.
        this._hue = Math.random();
        this._sat = (DesktopBackgroundHandler.DAZZLE_SAT_MIN + DesktopBackgroundHandler.DAZZLE_SAT_MAX) / 2;
        this._light = (DesktopBackgroundHandler.DAZZLE_LIGHT_MIN + DesktopBackgroundHandler.DAZZLE_LIGHT_MAX) / 2;
    }

    // ===================================================================
    // Public API — called from DesktopComponent
    // ===================================================================

    /**
     * §1.4 — the desktop's singleton DOM elements (populated by the
     * component's `@ViewChild` bindings and handed to us in `init`).
     * Used in place of `document.getElementById('vantaCntnr')` calls.
     */
    private _elements: DesktopRootElements | null = null;

    /**
     * Convenience accessor for the Vanta container element.  Returns
     * `null` if `init()` hasn't run yet (which shouldn't happen because
     * the component wires us in `ngAfterViewInit`, but the optional
     * chain keeps us defensive against future re-ordering).
     *
     * §1.5 — return type tightened from the incorrect `HTMLDivElement`
     * (the underlying template element is a `<main>`, not a `<div>`) to
     * the accurate `HTMLElement`.  Every caller only uses `.style.*`
     * and `.offsetHeight`, both of which live on `HTMLElement`.
     */
    private get vantaCntnr(): HTMLElement | null {
        return this._elements?.vantaCntnr.nativeElement ?? null;
    }

    /**
     * Called from DesktopComponent.ngAfterViewInit. Starts the color
     * walker if (and only if) `setDesktopBackgroundData` previously
     * decided we're on the wave background.
     *
     * §1.4 added the `elements` parameter so the handler can resolve
     * the desktop's singleton DOM nodes via `@ViewChild` ElementRefs
     * instead of `document.getElementById('vantaCntnr')`.
     */
    init(elements: DesktopRootElements): void {
        this._elements = elements;
        if (this.startVantaWaveColorChg) {
            this.startVantaWaveColorChange();
        }
    }

    /**
     * Parse the persisted `${type}:${value}` setting into the two public
     * fields and update the cycling bounds. Tolerant of missing /
     * malformed / colon-containing values — see comments below.
     */
    getDesktopBackgroundData(): void {
        // Stored format is `${type}:${value}` (e.g. "Picture:osdrive/.../foo.jpg",
        // "Dynamic:vanta_wave"). The value half is a path-like / identifier
        // that could legitimately contain ':' in the future (data: URIs,
        // http: URLs, Windows-style absolute paths, slide-show metadata, etc).
        // The previous implementation split on every ':' and took [0]/[1],
        // which would silently truncate any such value to its first segment.
        // Split on the FIRST colon only, and tolerate a missing / malformed
        // setting by leaving both fields empty (downstream branches all key
        // off `desktopBackgroundType` and no-op for an unknown / empty type).
        const raw = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND);
        const sepIdx = raw.indexOf(Constants.COLON);

        if (sepIdx === -1) {
            // No separator found: either the setting is empty (fresh install
            // before defaults populate) or it was persisted in an unexpected
            // shape. Either way, fall back to empty rather than guessing.
            this.desktopBackgroundType = Constants.EMPTY_STRING;
            this.desktopBackgroundValue = Constants.EMPTY_STRING;
        } else {
            this.desktopBackgroundType = raw.substring(0, sepIdx);
            this.desktopBackgroundValue = raw.substring(sepIdx + 1);
        }

        if (this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC) {
            this.currentDesktopNum = 0;
            this.maxNumberOfDesktopsBkgrnd = this.VANTAS.length - 1;
        } else if (this.desktopBackgroundType === Constants.BACKGROUND_PICTURE) {
            this.currentDesktopNum = 0;
            this.loadPictureBackgrounds();
            this.maxNumberOfDesktopsBkgrnd = Constants.DESKTOP_PICTURE_SET.length - 1;
        }
    }

    /**
     * Apply the parsed background settings to the DOM. Branches on type
     * (solid color / picture / slide show / dynamic Vanta) and tears
     * down the previous mode's resources before installing the new one.
     */
    async setDesktopBackgroundData(): Promise<void> {
        const styleClasses = ['desktop_background_solid_color', 'destop_background_picture', 'destop_background_dynamic'];
        let activeClass = Constants.EMPTY_STRING;

        if (this.desktopBackgroundType === Constants.BACKGROUND_SOLID_COLOR) {
            this.startVantaWaveColorChg = false;
            this.destroyVanta();
            this.removeOldCanvas();
            this.stopVantaWaveColorChange();

            // §1.4 — was `document.getElementById('vantaCntnr')`.
            const desktopElmnt = this.vantaCntnr;
            if (desktopElmnt) {
                activeClass = styleClasses[0];
                this.setStyle(desktopElmnt, styleClasses, activeClass);
                desktopElmnt.style.backgroundColor = this.desktopBackgroundValue;
            }
        }

        if (this.desktopBackgroundType === Constants.BACKGROUND_PICTURE
            || this.desktopBackgroundType === Constants.BACKGROUND_SLIDE_SHOW) {
            this.startVantaWaveColorChg = false;
            this.destroyVanta();
            this.removeOldCanvas();
            this.stopVantaWaveColorChange();

            // §1.4 — was `document.getElementById('vantaCntnr')`.
            const desktopElmnt = this.vantaCntnr;
            if (desktopElmnt) {
                activeClass = styleClasses[1];
                this.setStyle(desktopElmnt, styleClasses, activeClass);

                if (this.desktopBackgroundType === Constants.BACKGROUND_PICTURE) {
                    // Look up the index of the saved picture in the known set. If it
                    // isn't found (e.g. an obsolete/renamed file persisted in defaults),
                    // fall back to index 0 instead of leaving currentDesktopNum at -1,
                    // which would break next/previous navigation.
                    const bkgrndIdx = this.DESKTOP_PICTURES.findIndex(x => x === this.desktopBackgroundValue);
                    this.currentDesktopNum = (bkgrndIdx >= 0) ? bkgrndIdx : 0;

                    // Only paint a background-image when we actually have a value;
                    // otherwise we'd inject `url(undefined)` into inline CSS.
                    if (this.desktopBackgroundValue) {
                        desktopElmnt.style.backgroundImage = `url(${this.desktopBackgroundValue})`;
                    }
                }
                else if (this.desktopBackgroundType === Constants.BACKGROUND_SLIDE_SHOW) {
                    // TODO: implement slideshow rotation. Previously this branch was
                    // `else 1` (a no-op expression statement) which is a parser-quirk
                    // landmine — replaced with an explicit, intentional no-op so the
                    // unimplemented path is obvious to future readers.
                }
            }
        }

        if (this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC) {
            // §1.4 — was `document.getElementById('vantaCntnr')`.
            const desktopScreenElmnt = this.vantaCntnr;
            if (desktopScreenElmnt) {
                activeClass = styleClasses[2];
                this.setStyle(desktopScreenElmnt, styleClasses, activeClass);

                const bkgrndIdx = this.vantaBackgroundName.findIndex(x => x === this.desktopBackgroundValue);
                this.currentDesktopNum = bkgrndIdx;
                await this.loadOtherVantaBackgrounds(bkgrndIdx);

                if (this.desktopBackgroundValue === 'vanta_wave') {
                    this.startVantaWaveColorChg = true;
                    this.startVantaWaveColorChange();
                }
            }
        }
    }

    /**
     * Step the active background by `delta` (±1) and load the corresponding
     * Vanta effect or picture. Serialized via `isSwitchingBackground` so
     * rapid menu clicks can't interleave two loads against the same
     * `_vantaEffect` slot — the second click is dropped, not queued, because
     * queueing would just delay-execute a switch the user no longer wants
     * (they'd have to wait through every dropped intermediate state).
     *
     * Index bounds and the `+1/-1` step direction live here so callers
     * (next/previous) stay one-liners and there's exactly one place to
     * audit for off-by-one errors.
     *
     * Emits `menuResetNeeded$` on the bounds-no-op AND on switch
     * completion / failure — but NOT on the in-flight reject, matching
     * the pre-extraction behaviour exactly.
     */
    async switchBackground(delta: 1 | -1): Promise<void> {
        if (this.isSwitchingBackground) return;

        const next = this.currentDesktopNum + delta;
        // Bounds check BEFORE flipping the guard, so a no-op click at either
        // end of the range doesn't briefly lock out the opposite-direction
        // button while we do nothing.
        if (next < this.MIN_NUMS_OF_DESKTOPS || next > this.maxNumberOfDesktopsBkgrnd) {
            this.menuResetNeeded$.next();
            return;
        }

        this.isSwitchingBackground = true;
        try {
            this.currentDesktopNum = next;
            if (this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC) {
                await this.loadOtherVantaBackgrounds(next);
            } else if (this.desktopBackgroundType === Constants.BACKGROUND_PICTURE) {
                this.loadOtherPictureBackgrounds(next);
            }
        } finally {
            // Always release the guard — even if the load threw — so the desktop
            // doesn't get permanently stuck on whatever background loaded last.
            this.isSwitchingBackground = false;
            this.menuResetNeeded$.next();
        }
    }

    /**
     * Strip VANTA's invasive inline `position: relative` and `z-index: 1`
     * from our host element. Deferred via setTimeout because VANTA writes
     * those styles AFTER its constructor returns; a synchronous strip
     * would be silently undone. See VANTA_STYLE_STRIP_DELAY_MS comment.
     */
    removeVantaJSSideEffect(): void {
        setTimeout(() => {
            const elfRef = this._elRef.nativeElement;
            if (elfRef) {
                elfRef.style.position = Constants.EMPTY_STRING;
                elfRef.style.zIndex = Constants.EMPTY_STRING;
            }
        }, this.VANTA_STYLE_STRIP_DELAY_MS);
    }

    // ===================================================================
    // Private — Vanta lifecycle
    // ===================================================================

    private destroyVanta(): void {
        if (this._vantaEffect) {
            this._vantaEffect.destroy();
            this._vantaEffect = null;

            this._scriptService.unloadScript('three_js', 'osdrive/Cheetah/System/ThreeJS/three.min.js');
            this._scriptService.unloadScript(this.selectedVantaBackgroundName, this.selectedVantaScriptPath);

            // e.g. "vanta_wave" -> "WAVE" (note: VANTA uses WAVES, RINGS, HALO, GLOBE, BIRDS)
            const parts = this.selectedVantaBackgroundName.split(Constants.UNDERSCORE);
            const effectName = parts[1]?.toUpperCase();
            // global is GC'd and a fresh copy is fetched next time.
            // §1.5 — dropped `(window as any)` in favour of casting through
            // `unknown` to a string-indexed `Record`, which is the
            // idiomatic escape hatch for dynamic global keys.
            if (effectName && effectName !== Constants.EMPTY_STRING) {
                delete (window as unknown as Record<string, unknown>)[effectName];
            }
        }
    }

    private async loadOtherVantaBackgrounds(i: number): Promise<void> {
        this.removeOldCanvas();
        const raiseEvent = false;
        const isModule = false;
        this.selectedVantaBackgroundName = this.vantaBackgroundName[i];
        this.selectedVantaScriptPath = this.vantaBackGroundPath[i];

        await this._scriptService.loadScript('three_js', 'osdrive/Cheetah/System/ThreeJS/three.min.js', isModule);
        await this._scriptService.loadScript(this.selectedVantaBackgroundName, this.selectedVantaScriptPath, isModule);

        this.buildVantaEffect(i);
        if (this.selectedVantaBackgroundName === 'vanta_wave') {
            this.startVantaWaveColorChange();
        } else {
            this.stopVantaWaveColorChange();
        }

        const defaultDesktopBackgrounValue = `${this.desktopBackgroundType}:${this.selectedVantaBackgroundName}`;
        this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue, raiseEvent);
    }

    private loadOtherPictureBackgrounds(i: number): void {
        // §1.4 — was `document.getElementById('vantaCntnr')`.
        const desktopElmnt = this.vantaCntnr;
        const raiseEvent = false;
        if (desktopElmnt) {
            this.desktopBackgroundValue = this.DESKTOP_PICTURES[i];
            desktopElmnt.style.backgroundImage = `url(${this.desktopBackgroundValue})`;

            // §3-followup — belt-and-suspenders: ensure the picture
            // CSS class (which provides `background-size: cover` +
            // `background-repeat: no-repeat`) is on the element.  In
            // the normal flow `setDesktopBackgroundData` has already
            // applied it via `setStyle`, but if that earlier call was
            // a no-op for any reason (init order, missing
            // _elements), the previously-observed symptom was the
            // image rendering at natural size instead of scaled to
            // fill the desktop.  `classList.add` is idempotent.
            desktopElmnt.classList.add('destop_background_picture');

            const defaultDesktopBackgrounValue = `${this.desktopBackgroundType}:${this.desktopBackgroundValue}`;
            this._defaultService.updateDefaultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue, raiseEvent);
        }
    }

    private buildVantaEffect(n: number): void {
        // §1.5 — each branch now references the typed bag directly
        // (e.g. `this.ringsBkgrnd: RINGS`) instead of indexing the
        // `VANTAS` union array.  That lets each factory call type-check
        // against the matching `VANTAS[i]: WAVE | RINGS | ...` union.
        try {
            if (n === 0) {
                this._vantaEffect = VANTA.WAVES(VantaDefaults.getDefaultWave(this.DEFAULT_COLOR));
            }
            if (n === 1) {
                this._vantaEffect = VANTA.RINGS(this.ringsBkgrnd);
            }
            if (n === 2) {
                this._vantaEffect = VANTA.HALO(this.haloBkgrnd);
            }
            if (n === 3) {
                this._vantaEffect = VANTA.GLOBE(this.globeBkgrnd);
            }
            if (n === 4) {
                this._vantaEffect = VANTA.BIRDS(this.birdBkgrnd);
            }
        } catch (err) {
            console.error('err:', err);
            //this.buildVantaEffect(this.CURRENT_DESTOP_NUM);
        }
    }

    private removeOldCanvas(): void {
        // §1.4 — was `document.getElementById('vantaCntnr')`.
        // §1.5 — dropped the redundant `as HTMLElement | null` cast now
        // that the `vantaCntnr` getter already returns `HTMLElement | null`.
        const vantaDiv = this.vantaCntnr;
        if (!vantaDiv) return;

        const canvases = vantaDiv.querySelectorAll('.vanta-canvas');
        canvases.forEach(canvas => vantaDiv.removeChild(canvas));
    }

    // ===================================================================
    // Private — Pictures
    // ===================================================================

    private loadPictureBackgrounds(): void {
        if (this.DESKTOP_PICTURES.length >= 7) {
            return;
        }

        const desktopImgPath = Constants.DESKTOP_IMAGE_BASE_PATH;
        const desktopImages = Constants.DESKTOP_PICTURE_SET;
        desktopImages.forEach(imgName => { this.DESKTOP_PICTURES.push(`${desktopImgPath}${imgName}`); });
    }

    // ===================================================================
    // Private — Style helper
    // ===================================================================

    private setStyle(desktopElmnt: HTMLElement, styleClasses: string[], activeClass: string): void {
        // 🧹 Reset previous inline styles.
        // §1.5 — parameter widened from `HTMLDivElement` to `HTMLElement`
        // because the desktop's vanta container is a `<main>`, not a
        // `<div>`.  `resetInlineStyles` still has the legacy
        // `HTMLDivElement` signature (shared with login + control-panel
        // subsystems), so we cast at the call boundary instead of
        // widening that helper as part of this pass.
        CommonFunctions.resetInlineStyles(desktopElmnt as HTMLDivElement);
        desktopElmnt.classList.remove(...styleClasses);
        desktopElmnt.classList.add(activeClass);
    }

    // ===================================================================
    // Private — Color walker
    // ===================================================================

    private startVantaWaveColorChange(): void {
        // Defensive: clear any previous interval before installing a new
        // one, so accidental double-starts don't leak a timer handle.
        // (The original component method did NOT clear first; this is a
        // micro-hardening that the new shape allows safely because every
        // start/stop now goes through this one method.)
        if (this.colorChgIntervalId !== undefined) {
            clearInterval(this.colorChgIntervalId);
        }
        this.colorChgIntervalId = setInterval(() => {
            this.transitionToNextColor();
        }, this.COLOR_CHANGE_DELAY);
    }

    private stopVantaWaveColorChange(): void {
        if (this.colorChgIntervalId !== undefined) {
            clearInterval(this.colorChgIntervalId);
            this.colorChgIntervalId = undefined;
        }
    }

    /**
     * Advance the color walker by one tick and return the new 24-bit color.
     *
     * Smooth tick (most of the time): rotate the hue by HUE_STRIDE, leave
     * saturation and lightness alone. The output is always inside the
     * pleasant HSL band, so no harsh / washed-out colors can leak through.
     *
     * Dazzle tick (COLOR_DAZZLE_PROBABILITY): re-roll hue AND jitter sat/
     * light within the same band. Because the caller cross-fades from the
     * current color to whatever we return, even a re-roll arrives as a
     * smooth sweep rather than a hard cut.
     */
    private getNextColor(): number {
        if (Math.random() < DesktopBackgroundHandler.COLOR_DAZZLE_PROBABILITY) {
            // Dazzle: fresh hue + new sat/light inside the pleasant band.
            this._hue = Math.random();
            this._sat = DesktopBackgroundHandler.DAZZLE_SAT_MIN +
                Math.random() * (DesktopBackgroundHandler.DAZZLE_SAT_MAX - DesktopBackgroundHandler.DAZZLE_SAT_MIN);
            this._light = DesktopBackgroundHandler.DAZZLE_LIGHT_MIN +
                Math.random() * (DesktopBackgroundHandler.DAZZLE_LIGHT_MAX - DesktopBackgroundHandler.DAZZLE_LIGHT_MIN);
        } else {
            // Smooth step: advance hue, wrap into [0, 1). Sat/light unchanged.
            this._hue = (this._hue + DesktopBackgroundHandler.HUE_STRIDE) % 1;
        }
        return Colors.hslToRgbInt(this._hue, this._sat, this._light);
    }

    /** Smoothly transitions to the next color */
    private transitionToNextColor(): void {
        // The color-change interval can fire after the Vanta effect has been
        // destroyed (e.g. user switched to a non-wave background, or the
        // background type changed to picture/solid). Guard before touching
        // _vantaEffect or its options — both can be null in that window.
        if (!this._vantaEffect || this.currentDesktopNum !== 0) {
            return;
        }

        const startColor = this._vantaEffect.options?.color;
        if (startColor === undefined || startColor === null) {
            // Effect exists but options aren't populated yet (still initialising).
            // Skip this tick rather than crash; the next tick will pick it up.
            return;
        }

        const endColor = this.getNextColor();
        const startTime = performance.now();

        const animateColorTransition = (time: number) => {
            // The effect can be torn down mid-animation too. Bail out silently
            // so an in-flight rAF callback can't crash after destroyVanta().
            if (!this._vantaEffect) return;

            const progress = Math.min((time - startTime) / this.COLOR_TRANSITION_DURATION, 1);
            const interpolatedColor = Colors.interpolateHexColor(startColor, endColor, progress);
            this._vantaEffect.setOptions({ color: interpolatedColor });

            if (progress < 1) {
                requestAnimationFrame(animateColorTransition);
            }
        };
        requestAnimationFrame(animateColorTransition);
    }
}
