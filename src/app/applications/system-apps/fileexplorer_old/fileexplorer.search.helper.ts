import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/fs/file.info";
/**
 * Pure search engine for the File Explorer.
 *
 * The algorithm starts at the current directory and expands its scope outward
 * one ancestor level at a time, up to root — so a hit near where the user is
 * browsing surfaces first and root is only fully walked if the search reaches
 * it. All I/O and state are injected via {@link SearchDeps}, so this module
 * stays free of Angular DI and component state.
 */



// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerSearchHelper {

    export interface SearchDeps {
        /** Reads the immediate entries of a directory (the only I/O). */
        loadDirectoryFiles:(path:string) => Promise<FileInfo[]>;
        /** Per-directory memo of recursively-collected files, owned by the caller. */
        cache:Map<string, FileInfo[]>;
        /** Path normalisation (shared with the component's path navigation). */
        normalizePath:(path:string) => string;
        /** Resolve a path's parent directory. */
        getParentPath:(path:string) => string;
        /**
         * Authoritative, QUIET directory check. `FileInfo.getIsFile` is unreliable
         * for extension-less entries (the classifier treats a file such as
         * "CHANGELOG" as a folder), so we confirm with a real stat before recursing;
         * otherwise readdir() gets called on a file and spams the console.
         */
        isDirectory:(path:string) => Promise<boolean>;
    }

    /**
     * Search the file system for files whose name contains `query`, starting at
     * `currentDirectory` and expanding up to root. De-duplicated by path,
     * closest-scope-first.
     */
    export const runIncrementalSearch = async (currentDirectory:string, query:string, deps:SearchDeps):Promise<FileInfo[]> => {
        const needle = query.toLowerCase();
        const results:FileInfo[] = [];
        const seen = new Set<string>();

        for(const scope of buildSearchScopes(currentDirectory, deps)){
            const filesUnderScope = await collectFilesRecursively(scope, deps);
            for(const file of filesUnderScope){
                const path = file.getCurrentPath;
                if(seen.has(path)){
                    // A farther scope's recursive listing is a superset of a closer
                    // one's, so already-evaluated files are skipped (stable + fast).
                    continue;
                }
                seen.add(path);

                if(file.getFileName.toLowerCase().includes(needle)){
                    results.push(file);
                }
            }
        }
        return results;
    }

    /**
     * Build the ordered list of directories to search: the current directory
     * first, then each ancestor up to (and including) root.
     */
    const buildSearchScopes = (currentDirectory:string, deps:SearchDeps):string[] => {
        const scopes:string[] = [];
        let current = deps.normalizePath(currentDirectory);

        scopes.push(current);
        while(current !== Constants.ROOT){
            current = deps.getParentPath(current);
            scopes.push(current);
        }
        return scopes;
    }

    /**
     * Return every FileInfo at or below `dirPath`, recursing into sub-folders.
     * Results are memoised in `deps.cache` so repeat/expanding walks are cheap.
     */
    const collectFilesRecursively = async (dirPath:string, deps:SearchDeps):Promise<FileInfo[]> => {
        const cached = deps.cache.get(dirPath);
        if(cached){
            return cached;
        }

        const collected:FileInfo[] = [];
        const entries = await deps.loadDirectoryFiles(dirPath);

        for(const entry of entries){
            collected.push(entry);
            // Recurse only into REAL directories. `getIsFile` is unreliable for
            // extension-less entries, so confirm with an authoritative stat before
            // recursing — this both avoids walking files as folders and silences
            // the "filesystem acting up" error readdir() logs on a non-directory.
            if(!entry.getIsFile && await deps.isDirectory(entry.getCurrentPath)){
                const childFiles = await collectFilesRecursively(entry.getCurrentPath, deps);
                collected.push(...childFiles);
            }
        }

        deps.cache.set(dirPath, collected);
        return collected;
    }
}
