import { FileTreeNode } from "src/app/system-files/common.interfaces";

/**
 * Pure, recursive tree-data manipulation for the File Explorer navigation tree.
 * Stateless — operates only on the data passed in, never on component state.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerFileTreeHelper {

    /**
     * Return a NEW tree with `newChildren` appended to the node whose `path`
     * matches `nodePath`. The tree is rebuilt immutably (no in-place mutation
     * of the caller's nodes) and the search recurses through every level.
     */
    export const addChildrenToNode = (treeData:FileTreeNode[], nodePath:string, newChildren:FileTreeNode[]):FileTreeNode[] => {
        const updatedTreeData:FileTreeNode[] = [];

        for(let i = 0; i < treeData.length; i++){
            const node = treeData[i];
            const updatedNode:FileTreeNode = { name: node.name, path: node.path, isFolder: node.isFolder, children: node.children || [] };

            // If the current node matches the target path, add the new children.
            if(node.path === nodePath){
                for(const child of newChildren)
                    updatedNode.children.push(child);
            }

            // Recurse into existing children.
            if(node.children)
                updatedNode.children = addChildrenToNode(node.children, nodePath, newChildren);

            updatedTreeData.push(updatedNode);
        }

        return updatedTreeData;
    }
}
