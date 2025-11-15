export interface WindowState{
    pId: number,
    appName:string
    width:number,
    height:number,
    xAxis:number,
    yAxis:number,
    transform?:string,
    zIndex:number,
    isVisible:boolean,
}


export interface WindowBoundsState{
    xOffset: number,
    yOffset: number,
    yBoundsSubtraction:number,
    xBoundsSubtraction:number,
}