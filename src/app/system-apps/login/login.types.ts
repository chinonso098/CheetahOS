
export type PreloadType = "" | "none" | "metadata" | "auto";

export interface VideoScreenSaver{
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