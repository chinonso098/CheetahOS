/* eslint-disable @typescript-eslint/no-inferrable-types */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace VantaDefaults {

    export const getDefaultWave = (color:number):any => {
        const defaultWaveConfig = {
            el: '#vanta',
            color: color,
            waveHeight: 30,
            shininess: 40,
            waveSpeed: 0.2,
            zoom: 1.3,
            scale: 1.20,
            mouseControls:false,
        }
        return defaultWaveConfig;
    };

    export const getDefaultGlobe = (bkgrndColor:number, color:number, color2:number):any => {
        const defaultGlobeConfig = {
            el: '#vanta',
            backgroundColor: bkgrndColor,
            color: color,
            color2: color2,
            size: 1,
        }
        return defaultGlobeConfig;
    };

    export const getDefaultBird = (bkgrndColor:number, bkgAlpha:number, color:number, color2:number, colorMode:string):any => {
        const defaultBirdConfig = {
            el: '#vanta',
            backgroundColor: bkgrndColor,
            backgroundAlpha : bkgAlpha,
            color: color,
            color2: color2,
            colorMode: colorMode,
        }
        return defaultBirdConfig;
    };

    export const getDefaultRings = (bkgrndColor:number = 0x4072a7, bkgAlpha:number, color:number):any => {
        const defaultRingsConfig = {
            el: '#vanta',
            backgroundColor: bkgrndColor,
            backgroundAlpha : bkgAlpha,
            color: color,
        }
        return defaultRingsConfig;
    };

    export const getDefaultHalo = (bkgrndColor:number, baseColor:number):any => {
        const defaultHaloConfig = {
            el: '#vanta',
            backgroundColor: bkgrndColor,
            baseColor : baseColor,
        }
        return defaultHaloConfig;
    };

}