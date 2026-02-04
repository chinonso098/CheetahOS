export interface WindowState{
    pId: number,
    appName:string
    width:number,
    height:number,
    leftPx:number,
    topPx:number,
    //transform?:string,
    zIndex:number,
    isVisible:boolean,
    isMaximized?:boolean,

    // NEW: hover-hide only (does not affect taskbar visibility)
    isTempHidden?: boolean;
}


export interface WindowBoundsState{
    xOffset: number,
    yOffset: number,
    yBoundsSubtraction:number,
    xBoundsSubtraction:number,
}

export interface ClampedPosition{
    leftPx: number;
    topPx: number;
}

export interface WindowPositionInfo {
  pId: number;
  leftPx: number;
  topPx: number;
}
