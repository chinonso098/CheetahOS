export interface TaskBarIconInfo{
    pId:number,
    uId:string,
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

export interface RectLite { 
    left: number; 
    top: number; 
    width: number; 
    height: number; 
    right: number
}