export interface IconAppState {
    uid:string,
    pid:number,
    appName:string,
    showLabel:string,
    isRunning:boolean
}


export interface TaskBarFileInfo{
    pid:number,
    uid:string,
    iconPath:string,
    opensWith:string,
    appName:string,
    showLabel:string,
    isRunning:boolean
}


export interface IconAppCurrentState{
    showLabel:string,
    isRunning:boolean
}