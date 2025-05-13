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
    isPinned:boolean,
    isOtherPinned:boolean,
    instanceCount:number
}


export interface IconAppCurrentState{
    showLabel:string,
    isRunning:boolean
}