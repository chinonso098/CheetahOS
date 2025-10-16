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
    Origin:string;
    CurrentLocation:string; /**When and where this information is retrieved,  */
    isDragActive:boolean;
}