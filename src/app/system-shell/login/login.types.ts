
export type PreloadType = "" | "none" | "metadata" | "auto";

/**
 * Discriminator for the kind of screen saver the lock screen can run.
 * 'video'  -> an HTMLVideoElement playing an mp4 from the ScreenSavers folder.
 * 'iframe' -> a sandboxed HTMLIFrameElement hosting a self-contained dynamic
 *             (e.g. WebGL/canvas) screen saver HTML page.
 */
export type ScreenSaverKind = "video" | "iframe";

export interface VideoScreenSaver{
    kind: "video",
    elRef: HTMLDivElement,
    videoSrc:string,
    autoPlay:boolean,
    muted:boolean,
    loop:boolean,
    playsInline:boolean,
    preload:PreloadType,
    width:string,
    height:string,
}

/**
 * Config for an iframe-hosted dynamic screen saver. The HTML page referenced
 * by `src` owns its own globals + render loop, so it is fully isolated from
 * the Angular app (no global collisions). The iframe is sized to fully cover
 * the lock screen, same as the video saver.
 */
export interface IframeScreenSaver{
    kind: "iframe",
    elRef: HTMLDivElement,
    src:string,
    width:string,
    height:string,
}

/**
 * Discriminated union the helper branches on via `kind`. Adding a future
 * saver type (image sequence, shader, etc.) means adding a member here.
 */
export type ScreenSaver = VideoScreenSaver | IframeScreenSaver;