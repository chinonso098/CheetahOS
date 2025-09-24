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
    lastOpened:number
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
    iconPath:string
}

export interface OpensWith{
    fileType:string,
    appName:string,
    appIcon:string
}