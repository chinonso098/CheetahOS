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
}


export interface WindowBoundsState{
    xOffset: number,
    yOffset: number,
    yBoundsSubtraction:number,
    xBoundsSubtraction:number,
}