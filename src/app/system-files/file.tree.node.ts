export interface FileTreeNode{
    name: string;
    isFile:boolean;
    children: FileTreeNode[];
}