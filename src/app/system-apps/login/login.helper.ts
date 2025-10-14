import { Constants } from "src/app/system-files/constants";
import { PreloadType, VideoScreenSaver } from "./login.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LoginHelpers {
    let initDelayTimeoutId:NodeJS.Timeout | null = null;
    let videoRef:HTMLVideoElement | null = null;
    let screenSaverConfig:VideoScreenSaver | null = null;

    export const startWebScreenSaver =(config:VideoScreenSaver | null):HTMLVideoElement | undefined =>{
        if(!config){
            console.warn("LoginHelpers: WebScreenSaver config is null.");
            return;
        }

        screenSaverConfig = config;
        const video = document.createElement("video");
        video.src = config.videoSrc;
        video.autoplay = config.autoPlay;
        video.muted = config.muted;
        video.loop = config.loop;
        video.playsInline = config.playsInline;
        video.preload = config.preload;
        video.style.width = config.width;
        video.style.height = config.height;

        const container =  config.elRef;
        if (!container) {
            console.warn("LoginHelpers: No container element found for screensaver.");
            return;
        }

        initDelayTimeoutId = setTimeout(() => {
            container.appendChild(video);
            attachDeactivationListeners(config.elRef);
            videoRef = video;
        }, Constants.SCREEN_SAVER_DELAY);

        return video;
    }

    const cleanupVideo =(video:HTMLVideoElement | null):void =>{
        if(video){
            video.pause();           // stop playback
            video.src = Constants.EMPTY_STRING;          // release source
            video.load();            // force browser to unload
            video.remove();          // remove from DOM
        }
    }

    export const stopWebSceenSaver = ():void =>{
        cleanupVideo(videoRef);
        cleanupTimeout();
        removeDeactivationListeners(screenSaverConfig?.elRef);

        videoRef = null;
        screenSaverConfig = null;
    }

    /**
     * Clears any pending timeout.
     */
    const cleanupTimeout = (): void => {
        if (initDelayTimeoutId) {
            clearTimeout(initDelayTimeoutId);

            initDelayTimeoutId = null;
        }
    };

    export const createVideoScreenSaver = (
        elRef:HTMLDivElement, 
        videoSrc:string, 
        autoPlay = true, 
        muted = true, 
        loop = true, 
        playsInline = true, 
        preload:PreloadType = 'auto', 
        width = '100%', 
        height = '100%'
    ):VideoScreenSaver =>{
        return {elRef:elRef, 
                videoSrc:videoSrc,
                autoPlay:autoPlay, 
                muted:muted, 
                loop:loop, 
                playsInline:playsInline, 
                preload:preload, 
                height:height, 
                width:width 
        }
    }

    const attachDeactivationListeners = (elRef: HTMLDivElement):void=>{
        if (!elRef) return;

        const events = ["click", "mousemove", "mousedown", "keydown"];
        for (const evt of events) 
            elRef.addEventListener(evt, deactivate);
    }

      /**
     * Removes event listeners from the container element.
     */
    const removeDeactivationListeners = (elRef?: HTMLDivElement): void => {
        if (!elRef) return;

        const events = ["click", "mousemove", "mousedown", "keydown"];
        for (const evt of events) 
            elRef.removeEventListener(evt, deactivate);
    };

    const deactivate = ():void=>{
        cleanupTimeout();
        cleanupVideo(videoRef);

        initDelayTimeoutId = setTimeout(()=>{
            startWebScreenSaver(screenSaverConfig)
        }, Constants.SCREEN_SAVER_DELAY);
    };

    export const updateTime=(): string=>{
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        //const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
        return`${formattedHours}:${formattedMinutes}`;
    }

    export const getDate =():string =>{
        const now = new Date();
        return now.toLocaleString('en-US', {
          weekday: 'long', // Full day name (e.g., "Tuesday")
          month:'long',
          day:'numeric'
        });
    }

}