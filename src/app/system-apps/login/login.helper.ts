import { Constants } from "src/app/system-files/constants";
import { PreloadType, VideoScreenSaver } from "./login.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LoginHelpers {
    let initDelayTimeoutId!:NodeJS.Timeout;
    let vidRef:HTMLVideoElement | null;
    let wssRef:VideoScreenSaver | null;

    export const startWebScreenSaver =(wss:VideoScreenSaver | null):HTMLVideoElement | undefined =>{
        if(!wss){
            console.log('WebScreen Saver Object is null');
            return;
        }

        wssRef = wss;
        const video = document.createElement("video");
        video.src = wss.videoSrc;
        video.autoplay = wss.autoPlay;
        video.muted = wss.muted;
        video.loop = wss.loop;
        video.playsInline = wss.playsInline;
        video.preload = wss.preload;
        video.style.width = wss.width;
        video.style.height = wss.height;

        const container =  wss.elRef;
        if(container){
            initDelayTimeoutId = setTimeout(() => {
                container.appendChild(video);
                listenForWindowEvents(wss.elRef);
                vidRef = video;
            }, Constants.SCREEN_SAVER_DELAY);
        }
        return video;
    }

    const pauseWebScreenSaver =(video:HTMLVideoElement | null):void =>{
        if(video){
            video.pause();           // stop playback
            video.src = "";          // release source
            video.load();            // force browser to unload
            video.remove();          // remove from DOM
        }
    }

    export const stopWebSceenSaver = ():void =>{
        pauseWebScreenSaver(vidRef);
        vidRef = null;
        wssRef = null;
        if(initDelayTimeoutId)
            clearTimeout(initDelayTimeoutId);
    }

    export const getVideoScreenSaver = (
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

    const listenForWindowEvents = (elRef: HTMLDivElement):void=>{
        elRef.addEventListener('click', deactivate);
        elRef.addEventListener('mousemove', deactivate);
        elRef.addEventListener('mousedown', deactivate);
        elRef.addEventListener('keydown',  deactivate);
    }

    const deactivate = ():void=>{
        if(initDelayTimeoutId)
            clearTimeout(initDelayTimeoutId);

        pauseWebScreenSaver(vidRef);

        initDelayTimeoutId = setTimeout(()=>{
            startWebScreenSaver(wssRef)
        }, Constants.SCREEN_SAVER_DELAY);
    };

}