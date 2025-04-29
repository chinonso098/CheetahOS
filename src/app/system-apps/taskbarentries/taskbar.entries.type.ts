export interface TaskBarIconInfo{
    pid:number,
    uid:string,
    iconPath:string,
    defaultIconPath:string,
    opensWith:string,
    appName:string,
    displayName:string
    showLabel:string,
    isRunning:boolean,
    isPinned:boolean
}


export interface IconAppCurrentState{
    showLabel:string,
    isRunning:boolean
}