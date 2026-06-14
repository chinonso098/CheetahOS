/**
 * VANTA.js effect-config interfaces.
 *
 * §1.5 — the previous version pinned every optional field to a single
 * literal value (e.g. `backgroundColor?: 0x131a43`).  That made the
 * interfaces effectively unusable because no real caller (e.g.
 * `VantaDefaults.getDefaultHalo`) could legally assign a *different*
 * `backgroundColor` and still satisfy the type.  The literal numbers
 * were author-as-documentation, not author-as-type.  We restore
 * proper primitive types and keep the original literals as inline
 * `// default: <value>` comments so the intent isn't lost.
 *
 * No optional flag is marked as `false`-only / `true`-only anymore for
 * the same reason: those literals locked callers into the documented
 * default and provided zero type safety.
 */

export interface HALO {
    el: string;
    mouseControls?: boolean;     // default: false
    touchControls?: boolean;     // default: true
    gyroControls?: boolean;      // default: false
    minHeight?: number;          // default: 200
    minWidth?: number;           // default: 200
    backgroundColor?: number;    // default: 0x131a43
    baseColor?: number;          // default: 0x1a59
    size?: number;               // default: 1
    amplitudeFactor?: number;    // default: 1
    xOffset?: number;            // default: 0
    yOffset?: number;            // default: 0
}

export interface BIRDS {
    el: string;
    mouseControls?: boolean;     // default: true
    touchControls?: boolean;     // default: true
    gyroControls?: boolean;      // default: false
    minHeight?: number;          // default: 200
    minWidth?: number;           // default: 200
    backgroundColor?: number;    // default: 0x7192f
    backgroundAlpha?: number;    // default: 1
    baseColor?: number;          // default: 0x1a59
    /**
     * Legacy alias preserved for `VantaDefaults.getDefaultBird` which
     * passes `color: color`.  The first-class VANTA BIRDS field is
     * `color1`; some forks/older docs accept plain `color`.  Kept
     * optional so both spellings remain legal.
     */
    color?: number;
    color1?: number;             // default: 0xff0000
    color2?: number;             // default: 0xd1ff
    quantity?: number;           // default: 5
    birdSize?: number;           // default: 1
    wingSpan?: number;           // default: 30
    speedLimit?: number;         // default: 5
    separation?: number;         // default: 20
    alignment?: number;          // default: 20
    cohesion?: number;           // default: 20
    colorMode?: 'lerp' | 'variance' | 'lerpGradient' | 'varianceGradient';
}

export interface WAVE {
    el: string;
    mouseControls?: boolean;     // default: false
    touchControls?: boolean;     // default: true
    gyroControls?: boolean;      // default: false
    minHeight?: number;          // default: 200
    minWidth?: number;           // default: 200
    scale?: number;              // default: 1.20
    scaleMobile?: number;        // default: 1.00
    color?: number;              // default: 0x274c
    shininess?: number;          // default: 45
    waveHeight?: number;         // default: 30
    waveSpeed?: number;          // default: 0.20
    zoom?: number;               // default: 1.3
}

export interface RINGS {
    el: string;
    mouseControls?: boolean;     // default: false
    touchControls?: boolean;     // default: true
    gyroControls?: boolean;      // default: false
    minHeight?: number;          // default: 200
    minWidth?: number;           // default: 200
    scale?: number;              // default: 1.00
    scaleMobile?: number;        // default: 1.00
    color?: number;              // default: 0x88ff00
    backgroundColor?: number;    // default: 0x202428
    backgroundAlpha?: number;    // default: 1
}

export interface GLOBE {
    el: string;
    mouseControls?: boolean;     // default: true
    touchControls?: boolean;     // default: true
    gyroControls?: boolean;      // default: false
    minHeight?: number;          // default: 200
    minWidth?: number;           // default: 200
    scale?: number;              // default: 1.00
    scaleMobile?: number;        // default: 1.00
    color?: number;              // default: 0xff3f81
    color2?: number;             // default: 0xffffff
    backgroundColor?: number;    // default: 0x23153c
    size?: number;               // default: 1
}

/**
 * Union of every concrete Vanta effect config — useful for fields that
 * hold "the active effect's config".
 */
export type VantaConfig = WAVE | RINGS | HALO | GLOBE | BIRDS;

/**
 * Minimal handle returned by every VANTA.* factory.  The factories
 * return rich objects but we only model the surface this codebase
 * actually touches:
 *   • `destroy()`           — called from `destroyVanta`.
 *   • `options.color`       — read by the wave-color walker.
 *   • `setOptions({color})` — called by the wave-color walker.
 *
 * If a future caller needs more methods, extend this interface rather
 * than reverting to `any`.
 */
export interface VantaEffect {
    destroy(): void;
    /** Live config bag.  Optional because VANTA populates it lazily. */
    options?: { color?: number } & Record<string, unknown>;
    /** Patches the live config.  Returns the effect for chaining. */
    setOptions(patch: { color?: number } & Record<string, unknown>): VantaEffect;
}

/**
 * Shape of the `window.VANTA` global installed by VANTA's bundled
 * scripts after they finish loading.  Each factory takes its concrete
 * config and returns a `VantaEffect` handle.
 */
export interface VantaGlobal {
    WAVES: (cfg: WAVE) => VantaEffect;
    RINGS: (cfg: RINGS) => VantaEffect;
    HALO:  (cfg: HALO)  => VantaEffect;
    GLOBE: (cfg: GLOBE) => VantaEffect;
    BIRDS: (cfg: BIRDS) => VantaEffect;
}