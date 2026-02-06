export interface WindowState{
    pId: number,
    appName:string
    width:number,
    height:number,
    leftPx:number,
    topPx:number,
    zIndex:number,
    isVisible:boolean,
    isMaximized?:boolean,
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

export interface WindowResizeInfo{
    pId:number;
    width:number;
    height:number;
}