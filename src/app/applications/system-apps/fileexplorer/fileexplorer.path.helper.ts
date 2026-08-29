/**
 * Pure path utilities for the File Explorer.
 *
 * These functions deal only with path strings (normalization, parent lookup,
 * and the "up" navigation stack). They take the path separator / special
 * paths as arguments so the module stays free of any app-wide Constants
 * import and is trivially testable.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerPathHelper {

    /**
     * Normalize slashes to `root` and strip a single trailing separator
     * (unless the path IS the root).
     */
    export const normalizePath = (path:string, root:string):string => {
        let p = path.replace(/\\/g, root); // collapse mixed slashes
        if(p.length > 1 && p.endsWith(root)) p = p.slice(0, -1);
        return p;
    }

    /** Return the parent of `path`. Parent of "/x" (and of "/") is "/". */
    export const getParentPath = (path:string, root:string):string => {
        const p = normalizePath(path, root);
        const lastSep = p.lastIndexOf(root);
        if(lastSep <= 0) return root;
        return p.substring(0, lastSep);
    }

    /**
     * Build the "Up" navigation stack for `directory`, ordered so that
     * `pop()` yields the immediate parent first. e.g. for "/Users/me":
     * ["/", "/Users", "/Users/me"] -> pop() => "/Users/me".
     */
    export const buildUpStack = (directory:string, root:string, recycleBinPath:string):string[] => {
        let cur = normalizePath(directory, root);
        const parents:string[] = [];

        while(cur !== root && cur !== recycleBinPath){
            cur = getParentPath(cur, root);
            parents.push(cur);
            if(cur === root) break;
        }

        return parents.reverse();
    }

    /** Labels needed to render a breadcrumb trail (keeps this module Constants-free). */
    export interface BreadCrumbLabels {
        root:string;
        thisPc:string;
        recycleBinPath:string;
        recycleBin:string;
        userBasePath:string;
        osDisk:string;
        empty:string;
    }

    /**
     * Build the breadcrumb trail for `directory`:
     *  - RECYCLE_BIN_PATH            -> [RECYCLE_BIN]
     *  - /Users/Bob/Documents        -> [THISPC, Users, Bob, Documents]
     *  - /System/Library             -> [THISPC, System, Library]
     *  - root "/"                     -> [THISPC, OSDISK]
     *
     * When `displayFullPathInTitleBar` is false the trail collapses to just the
     * leaf segment (e.g. [Documents]) and drops the leading THISPC.
     */
    export const buildBreadCrumbs = (directory:string, labels:BreadCrumbLabels, displayFullPathInTitleBar = true):string[] => {
        const segments = directory.split(labels.root).filter(x => x !== labels.empty);

        const crumbs = displayFullPathInTitleBar ? segments : segments.slice(-1);
        const trail:string[] = displayFullPathInTitleBar ? [labels.thisPc, ...crumbs] : [...crumbs];

        // Special case: Recycle Bin.
        if(directory === labels.recycleBinPath){
            return [labels.recycleBin];
        }

        // User base path: show the real segments as-is (THISPC + /Users/...).
        if(directory.includes(labels.userBasePath)){
            return trail;
        }

        // Non-user paths: show a stable disk label after THISPC (index 1).
        if(trail.length === 1){
            trail.push(labels.osDisk);
        }else if(directory === labels.root){
            trail[1] = labels.osDisk;
        }

        return trail;
    }
}
