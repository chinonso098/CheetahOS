export interface FileTreeNode{
    name: string;
    isFolder:boolean;
    children: FileTreeNode[];
}