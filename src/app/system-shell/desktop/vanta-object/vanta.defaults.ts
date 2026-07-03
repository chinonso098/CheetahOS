/* eslint-disable @typescript-eslint/no-inferrable-types */

import { BIRDS, GLOBE, HALO, RINGS, WAVE } from "./vanta.interfaces";

// §1.5 — `:any` return types replaced with the concrete config
// interfaces.  Made possible by the matching §1.5 fix in
// vanta.interfaces.ts that swapped the literal-only optional fields
// for proper primitive types (e.g. `color?: number` instead of
// `color?: 0x274c`).

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace VantaDefaults {

    export const getDefaultWave = (color: number): WAVE => {
        const defaultWaveConfig: WAVE = {
            el: '#vantaCntnr',
            color: color,
            waveHeight: 30,
            shininess: 40,
            waveSpeed: 0.2,
            zoom: 1.3,
            scale: 1.20,
            mouseControls: false,
        };
        return defaultWaveConfig;
    };

    export const getDefaultGlobe = (bkgrndColor: number, color: number, color2: number): GLOBE => {
        const defaultGlobeConfig: GLOBE = {
            el: '#vantaCntnr',
            backgroundColor: bkgrndColor,
            color: color,
            color2: color2,
            size: 1,
        };
        return defaultGlobeConfig;
    };

    export const getDefaultBird = (bkgrndColor: number, bkgAlpha: number, color: number, color2: number, colorMode: BIRDS['colorMode']): BIRDS => {
        const defaultBirdConfig: BIRDS = {
            el: '#vantaCntnr',
            backgroundColor: bkgrndColor,
            backgroundAlpha: bkgAlpha,
            // Legacy: VANTA BIRDS uses `color1`, but the original code passed
            // `color: color`.  Preserved byte-for-byte — see the `color`
            // alias added to the BIRDS interface for context.  This function
            // is currently unreferenced; revisit when it's wired in.
            color: color,
            color2: color2,
            colorMode: colorMode,
        };
        return defaultBirdConfig;
    };

    export const getDefaultRings = (bkgrndColor: number = 0x4072a7, bkgAlpha: number, color: number): RINGS => {
        const defaultRingsConfig: RINGS = {
            el: '#vantaCntnr',
            backgroundColor: bkgrndColor,
            backgroundAlpha: bkgAlpha,
            color: color,
        };
        return defaultRingsConfig;
    };

    export const getDefaultHalo = (bkgrndColor: number, baseColor: number): HALO => {
        const defaultHaloConfig: HALO = {
            el: '#vantaCntnr',
            backgroundColor: bkgrndColor,
            baseColor: baseColor,
        };
        return defaultHaloConfig;
    };

}