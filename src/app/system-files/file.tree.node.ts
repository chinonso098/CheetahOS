export interface FileTreeNode{
    name: string;
    path:string;
    isFolder:boolean;
    children: FileTreeNode[];
}