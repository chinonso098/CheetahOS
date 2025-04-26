export interface TaskBarFileInfo{
    pid:number,
    uid:string,
    iconPath:string,
    opensWith:string,
    appName:string,
    showLabel:string,
    isRunning:boolean,
    isPinned:boolean
}


export interface IconAppCurrentState{
    showLabel:string,
    isRunning:boolean
}