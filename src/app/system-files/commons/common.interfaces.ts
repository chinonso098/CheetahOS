export interface FileContent {
    iconPath: string;
    fileName: string;
    fileType: string;
    contentPath: string;
    opensWith: string;
}

export interface ActivityHistory{
    type:string,
    name:string,
    path:string,
    count:number,
    lastInteractionTS:number
}

export interface QuickAccessEntry{
    path:string,        // getCurrentPath — identity key (unique per entry)
    name:string,        // getFileName
    icon:string,        // getIconPath   — lets the tile render without a disk read
    opensWith:string,   // getOpensWith  — lets a click launch without re-resolving
    fileType:string,    // getFileType   — needed to rebuild a usable FileInfo (folder vs file)
    isFile:boolean,     // getIsFile
    count:number,       // number of opens; higher rises to the top
    lastInteractionTS:number // tie-breaker when counts are equal
}

export interface Activity{
    type:string, 
    name:string, 
    path:string, 
    oldFileName:string, 
    isRename?:boolean
}

export interface FileTreeNode{
    name: string;
    path:string;
    isFolder:boolean;
    children: FileTreeNode[];
}

export interface FileSearchIndex{
    type:string,
    name:string,
    srcPath:string,
    contentPath:string,
    iconPath:string,
    opensWith: string,
    dateModified: Date;
}

export interface OpensWith{
    fileType:string,
    apps:AppOpeningSelection[]
}

export interface AppOpeningSelection{
    isDefault:boolean,
    appName:string,
    appIcon:string
}

export interface ShortCut{
    iconPath:string;
    fileName:string;
    fileType:string;
    contentPath:string;
    opensWith:string;
}

export interface DragEventInfo{
    origin:string;
    currentLocation:string; /**When and where this information is retrieved,  */
    isDragActive:boolean;
}

export interface InformationUpdate{
    pId:number,
    appName:string,
    info:string[]
}

export interface AppUsage{
    name:string,
    launchCount:number,
    totalActiveMs:number,
    lastLaunchTS:number
}

export interface SystemMetricsSnapshot{
    sessionStartTS:number,
    uptimeMs:number,
    runningProcessCount:number,
    runningServiceCount:number,
    appUsage:AppUsage[]
}
