import { Constants } from "src/app/system-files/constants";
import { IframeScreenSaver, PreloadType, ScreenSaver, VideoScreenSaver } from "./login.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LoginHelpers {
    let initDelayTimeoutId:NodeJS.Timeout | null = null;
    let activeElement:HTMLVideoElement | HTMLIFrameElement | null = null;
    let screenSaverConfig:ScreenSaver | null = null;
    let isCurrentDateTimeVisibleOnLogonForm: boolean = false;
    let isScreenLocked: boolean = false;
    let logInCounter:number = 0;

    export const startWebScreenSaver =(config:ScreenSaver | null):HTMLVideoElement | HTMLIFrameElement | undefined =>{
        if(!config){
            console.warn("LoginHelpers: WebScreenSaver config is null.");
            return;
        }

        const container = config.elRef;
        if(!container){
            console.warn("LoginHelpers: No container element found for screensaver.");
            return;
        }

        // Defensive: tear down any saver that is already active or still
        // pending BEFORE starting a new one. Without this, switching saver
        // kinds (video <-> dynamic) -- or any second start() without an
        // intervening stop() -- orphans the previous HTMLVideoElement /
        // HTMLIFrameElement: cleanupElement is never called on it, so the old
        // video keeps decoding/holding its source and stays attached to the
        // DOM while activeElement is overwritten with the new node, and the
        // old initDelayTimeoutId is overwritten without being cleared.
        // stopWebSceenSaver is a no-op when nothing is active/pending, so this
        // is always safe to call here.
        stopWebSceenSaver();

        screenSaverConfig = config;

        // Build the concrete DOM element for this saver kind. Both variants are
        // absolutely positioned to fully cover the lock screen container.
        const element = (config.kind === "video")
            ? buildVideoElement(config)
            : buildIframeElement(config);

        initDelayTimeoutId = setTimeout(() => {
            container.appendChild(element);
            attachDeactivationListeners(config.elRef);
            activeElement = element;
        }, Constants.PRIMARY_SCREEN_SAVER_DELAY);

        return element;
    }

    const buildVideoElement = (config:VideoScreenSaver):HTMLVideoElement =>{
        const video = document.createElement("video");
        video.src = config.videoSrc;
        video.autoplay = config.autoPlay;
        video.muted = config.muted;
        video.loop = config.loop;
        video.playsInline = config.playsInline;
        video.preload = config.preload;
        video.style.width = config.width;
        video.style.height = config.height;
        // Fill the entire lockscreen: pin to all four edges and crop any
        // overflow so the video covers the area regardless of its own aspect
        // ratio (object-fit:cover) instead of letterboxing inside the box.
        video.style.objectFit = 'cover';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        return video;
    }

    const buildIframeElement = (config:IframeScreenSaver):HTMLIFrameElement =>{
        const iframe = document.createElement("iframe");
        // iframe.src = config.src;   (if you decide to go back to .html instead of .ssvr) should not be set directly to avoid download issues on GitHub Pages; see below.
        iframe.style.width = config.width;
        iframe.style.height = config.height;
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.border = '0';
        // Sandbox the dynamic saver so the hosted HTML page can run its own
        // scripts/WebGL but is denied same-origin access, top-level navigation,
        // popups, etc. A self-contained canvas/WebGL saver needs none of those.
        iframe.setAttribute('sandbox', 'allow-scripts');

        // Load the saver markup via srcdoc instead of pointing src at the
        // .ssvr file directly. GitHub Pages does not recognise the .ssvr
        // extension and serves it as application/octet-stream, which the
        // browser tries to DOWNLOAD rather than render inline; because the
        // frame is sandboxed without 'allow-downloads' that download is
        // blocked and logged, and the saver never appears. srcdoc hands the
        // browser the HTML directly, so it is always parsed as a document
        // regardless of the server's Content-Type. (Local dev servers happen
        // to serve .ssvr as text/html, which is why this only broke on
        // gh-pages.) The fetch resolves long before the element is appended
        // (PRIMARY_SCREEN_SAVER_DELAY), and setting srcdoc after attach still
        // renders, so the async assignment is safe either way.
        fetch(config.src)
            .then((res) => res.text())
            .then((html) => { iframe.srcdoc = html; })
            .catch((err) => console.warn("LoginHelpers: failed to load dynamic screensaver:", err));

        return iframe;
    }

    const cleanupElement =(element:HTMLVideoElement | HTMLIFrameElement | null):void =>{
        if(!element) return;

        if(element instanceof HTMLVideoElement){
            element.pause();                      // stop playback
            element.src = Constants.EMPTY_STRING; // release source
            element.load();                       // force browser to unload
        }
        element.remove();                         // remove from DOM (unloads iframe)
    }

    export const stopWebSceenSaver = ():void =>{
        cleanupElement(activeElement);
        cleanupTimeout();
        removeDeactivationListeners(screenSaverConfig?.elRef);

        activeElement = null;
        screenSaverConfig = null;
    }

      /**
     * Pause playback (without removing video from DOM). No-op for iframe savers.
     */
    export const pauseWebScreenSaver = (): void => {
        if(activeElement instanceof HTMLVideoElement && !activeElement.paused){
            activeElement.pause();
        }
    }

    /**
     * Resume playback (if a video saver exists and is paused). No-op for iframe savers.
     */
    export const resumeWebScreenSaver = (): void => {
        if (activeElement instanceof HTMLVideoElement && activeElement.paused) {
            void activeElement.play().catch((err) => {
                console.warn("LoginHelpers: Unable to resume video playback:", err);
            });
        }
    };

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
        return {kind:"video",
                elRef:elRef, 
                videoSrc:videoSrc,
                autoPlay:autoPlay, 
                muted:muted, 
                loop:loop, 
                playsInline:playsInline, 
                preload:preload,
                height:height, 
                width:width  
                // height: `${elRef?.offsetHeight}px`, 
                // width:`${elRef?.offsetWidth}px` 
        }
    }

    export const createIframeScreenSaver = (
        elRef:HTMLDivElement,
        src:string,
        width = '100%',
        height = '100%'
    ):IframeScreenSaver =>{
        return {kind:"iframe",
                elRef:elRef,
                src:src,
                width:width,
                height:height
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
        cleanupElement(activeElement);

        initDelayTimeoutId = setTimeout(()=>{
            if(isCurrentDateTimeVisibleOnLogonForm && isScreenLocked && logInCounter > 0){
                startWebScreenSaver(screenSaverConfig);
            }
        }, Constants.SECONDARY_SCREEN_SAVER_DELAY);
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

    export const updateIsCurrentDateTimeOnLogonForm = (isLogonForm:boolean):void =>{
        isCurrentDateTimeVisibleOnLogonForm = isLogonForm;
    }

    export const updateIsScreenLocked = (isScrnLckd :boolean):void =>{
        isScreenLocked = isScrnLckd;
    }

    export const updateLogInCounter = (counter:number):void =>{
        logInCounter = counter;
    }

}