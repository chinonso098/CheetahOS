import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { BaseService } from "./base.service.interface";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { AppDirectory } from "src/app/system-files/app.directory";

import { FileService } from "./file.service";
import { RunningProcessService } from "./running.process.service";
import { ProcessIDService } from "./process.id.service";
import { fileIndexChangeOperationType, FileIndexIDs } from "src/app/system-files/common.enums";

import {extname, basename, dirname} from 'path';
import { FileSearchIndex } from "src/app/system-files/common.interfaces";
import { BehaviorSubject, Subject } from "rxjs";

/**
 * FileIndexerService
 * -------------------------------------------------------------------------
 * Purpose
 *   Maintains an in-memory, flat search index of:
 *     1. Installed applications (from AppDirectory).
 *     2. Every user-visible file and folder under USER_BASE_PATH
 *        (recursively), excluding the Recycle Bin and shortcut (.url) files.
 *
 *   The index is consumed by the search UI (search.component.ts) to power
 *   the start-menu / global search box. Each entry is a flat record
 *   (FileSearchIndex) describing where the item lives, what icon to show,
 *   and which app opens it.
 *
 * Lifecycle
 *   - Constructed once at app boot (providedIn: 'root').
 *   - file.service.ts kicks off the initial walk by calling
 *     `indexDirectoryAsync()` after the virtual FS is ready.
 *   - As files are created / deleted / renamed through file.service.ts,
 *     it calls `addNotify` / `deleteNotify` / `updateNotify` to keep the
 *     index in sync incrementally (no full re-walk needed).
 *
 * Notifications
 *   - `fileIndexChangeOperation`: emits 'ADD' | 'DELETE' | 'UPDATE' after
 *     each successful mutation. Search re-fetches the index on each emit.
 *   - `IndexingInProgress` (BehaviorSubject): true while a walk is
 *     running, false otherwise. BehaviorSubject lets late subscribers
 *     immediately see the current state instead of missing a one-shot
 *     emission.
 *
 * Concurrency
 *   Walks are serialized through `_indexQueue` so two simultaneous
 *   `indexDirectoryAsync` calls cannot interleave their reads and push
 *   duplicate entries into `_Index`. All mutating push paths funnel
 *   through `pushIfAbsent`, which dedupes against `_indexedPaths`.
 *
 * The `static instance` field exists purely so file.service.ts can
 * reach back into this service without creating a circular DI graph.
 */
@Injectable({
    providedIn: 'root'
})

export class FileIndexerService implements BaseService{
    /**
     * Back-reference so FileService can grab the singleton without
     * declaring it as a constructor dependency (which would form a
     * circular DI: FileIndexerService injects FileService).
     */
    static instance:FileIndexerService;

    /** Authoritative flat list of every indexed item. Order = insertion. */
    private _Index:FileSearchIndex[] = [];

    /**
     * O(1) dedupe set, mirrors the keys we consider "unique" for entries
     * already present in `_Index`. For normal entries the key is the
     * `srcPath`. For APPS entries (which all share srcPath='None') the
     * key is `APPS::<appName>` -- see pushIfAbsent().
     */
    private _indexedPaths:Set<string> = new Set<string>();

    /** Apps don't change at runtime, so we only enumerate them once. */
    private _appsIndexed = false;

    /**
     * Promise queue used to serialize index walks. Every call to
     * indexDirectoryAsync chains onto this promise, guaranteeing that
     * two walks can never run concurrently and double-push entries.
     * Errors are swallowed on the queue itself (a failed walk shouldn't
     * poison subsequent walks); callers still see the rejection on the
     * returned promise.
     */
    private _indexQueue:Promise<void> = Promise.resolve();

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _fileService!:FileService;

    private _appDirectory:AppDirectory;

    /**
     * Fires after each successful mutation of the index. Payload is the
     * operation type (ADD/DELETE/UPDATE). Search components subscribe to
     * this and call getFileIndex() to refresh their working copy.
     */
    fileIndexChangeOperation: Subject<string> = new Subject<string>();

    /**
     * `true` while a directory walk is in progress, `false` otherwise.
     * BehaviorSubject (not plain Subject) so a subscriber that connects
     * after a walk has already started immediately receives `true`
     * instead of waiting for the next state transition.
     */
    IndexingInProgress: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    /** Folder name we never want in the index. */
    private readonly ENTRY_TO_EXCLUDE = 'Recycle Bin';
    /** Absolute path that anchors the Recycle Bin exclusion. */
    private readonly PATH_TO_EXCLUDE = Constants.RECYCLE_BIN_PATH;
    
    name = 'file_indexing_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles file indexing';

    /**
     * Wires up dependencies and registers the indexer as both a "process"
     * and a "service" with the running-process registry (so it shows up in
     * the task manager / services list). The `static instance` assignment
     * lets FileService reach back into this singleton without forming a
     * circular DI cycle.
     */
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService) {
        this._appDirectory = new AppDirectory();
        FileIndexerService.instance = this;
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._fileService = fileService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    /**
     * Public entry point to (re)index a subtree.
     *
     * Chains onto `_indexQueue` so concurrent callers run serially.
     * The returned promise resolves once *this caller's* walk has
     * completed. The internal queue catches errors so that a failed
     * walk does not prevent subsequent walks from running.
     *
     * @param path Root of the subtree to index. Defaults to the user
     *             home (USER_BASE_PATH). When called from `addNotify`
     *             for a newly created folder this will be that folder.
     */
    public indexDirectoryAsync(path = Constants.USER_BASE_PATH):Promise<void>{
        const next = this._indexQueue.then(() => this._indexDirectoryAsyncImpl(path));
        // Swallow on the queue tail so one failure doesn't block future walks.
        // Callers still see the rejection via the `next` reference returned below.
        this._indexQueue = next.catch(() => undefined);
        return next;
    }

    /**
     * Performs the actual walk. Wrapped in a try/finally so that
     * IndexingInProgress is always flipped back to `false`, even on
     * exceptions, preventing the UI from getting stuck in a "busy" state.
     */
    private async _indexDirectoryAsyncImpl(path:string):Promise<void>{
        const queue:string[] = [];
        const sizeBefore = this._Index.length;

        this.IndexingInProgress.next(true);
        try{
            queue.push(path);
            this.indexApps();                 // no-op after the first run
            await this.indexDirectoryHelperAsync(queue);
        }finally{
            this.IndexingInProgress.next(false);
            // Notify subscribers (e.g. search component) when the walk
            // actually added new entries. Without this, the initial boot
            // walk would silently populate the index and consumers that
            // captured an empty snapshot in ngAfterViewInit would never
            // refresh -- leaving Recommends/Recents blank.
            if(this._Index.length > sizeBefore){
                this.fileIndexChangeOperation.next(fileIndexChangeOperationType.ADD);
            }
        }
    }

    /**
     * Breadth-first traversal of `queue`. Each tick:
     *   1. Skips Recycle Bin paths.
     *   2. Reads child entries for the current directory.
     *   3. For each child, dispatches to `helperCoreAsync` which decides
     *      whether the child is a file (push leaf) or directory (push
     *      folder entry AND enqueue it for further walking).
     *   4. If the directory turned out to be empty, indexes the folder
     *      itself so empty folders are still searchable. The user root
     *      (USER_BASE_PATH) is intentionally skipped here -- we don't
     *      want "/Users" itself appearing as a search hit.
     *
     * Implemented as a `while` loop (not recursion) to avoid building a
     * deep promise chain on large file systems.
     */
    private async indexDirectoryHelperAsync(queue:string[]): Promise<void> {
        while(queue.length > 0){
            const filePath = queue.shift() || Constants.EMPTY_STRING;

            // Skip the Recycle Bin and anything inside it.
            if(this.isInRecycleBin(filePath)) continue;

            const directoryEntries = await this._fileService.readDirectory(filePath);
            for(const entry of directoryEntries){
                const entryPath = `${filePath}/${entry}`;
                await this.helperCoreAsync(queue, entryPath, entry);
            }

            // Empty-folder case: the loop above pushed nothing, so push the
            // folder itself here -- otherwise empty folders would be invisible
            // to search. Skip the user root: we don't want "/Users" as a hit.
            if(directoryEntries.length === 0 && filePath !== Constants.USER_BASE_PATH){
                const isFile = false;
                const entry = basename(filePath);
                const fileInfo = await this._fileService.getFileInfo(filePath);
                // Prefer the real values from FileInfo; fall back to sensible
                // defaults only when the service couldn't resolve them.
                const iconPath = fileInfo.getIconPath || this.handleNonAppIcons(entry, isFile);
                const opensWith = fileInfo.getOpensWith || Constants.FILE_EXPLORER;
                const dateModified = (fileInfo.getDateModified as unknown as Date) || new Date();

                this.pushIfAbsent(this.getFileSearchIndex(
                    FileIndexIDs.FOLDERS, entry, fileInfo.getCurrentPath || filePath,
                    fileInfo.getContentPath || Constants.EMPTY_STRING, iconPath, opensWith, dateModified));
            }
        }
    }

    /**
     * Core per-entry handler: classifies an item as a file or a folder,
     * builds the FileSearchIndex record, and queues directories for
     * further walking.
     *
     * Exclusion rules:
     *   - Anything inside the Recycle Bin is skipped outright.
     *   - A literal entry named "Recycle Bin" is skipped (belt-and-
     *     -braces, in case PATH_TO_EXCLUDE changes).
     *   - Shortcut files (extension === '.url') are skipped because
     *     they are surfaced via their target instead.
     *
     * @param queue Mutable BFS queue; directories are pushed onto it
     *              so the walker visits them next.
     * @param path  Absolute path of this entry.
     * @param entry Base name of this entry.
     */
    private async helperCoreAsync(queue:string[], path:string, entry:string):Promise<void>{
        const entryPath =  path;
        if(this.isInRecycleBin(entryPath) || entry === this.ENTRY_TO_EXCLUDE) return;

        const stat = (await this._fileService.getStatAsync(entryPath));
        const fileInfo = await this._fileService.getFileInfo(entryPath);
        if(stat.isDirectory){
            const isFile = false;
            const iconPath = fileInfo.getIconPath || this.handleNonAppIcons(entry, isFile);
            this.pushIfAbsent(this.getFileSearchIndex(
                FileIndexIDs.FOLDERS, entry, fileInfo.getCurrentPath, fileInfo.getContentPath,
                iconPath, fileInfo.getOpensWith, fileInfo.getDateModified as unknown as Date));
            // Enqueue so the BFS walks into this directory.
            queue.push(entryPath);
        }else{
            const isFile = true;
            const hasExt = false;
            // Exclude shortcut files (.url); their target is indexed instead.
            const ext = extname(entry);
            if(ext === Constants.URL) return;

            // Choose icon: prefer the resolved icon on FileInfo, otherwise
            // synthesize one based on whether the file has an extension.
            const iconPath = fileInfo.getIconPath
                || (ext !== Constants.EMPTY_STRING
                    ? this.handleNonAppIcons(entry)
                    : this.handleNonAppIcons(entry, isFile, hasExt));

            this.pushIfAbsent(this.getFileSearchIndex(
                this.determinFileType(entryPath), entry, fileInfo.getCurrentPath, fileInfo.getContentPath,
                iconPath, fileInfo.getOpensWith, fileInfo.getDateModified as unknown as Date));
        }
    }

    /**
     * Enumerates installed applications from AppDirectory and pushes
     * one APPS entry per app. Guarded by `_appsIndexed` because apps
     * are static at runtime and there is no need to re-enumerate them
     * on every directory walk.
     *
     * APPS entries deliberately use srcPath='None' (apps have no path
     * in the virtual FS) and a 1970-01-01 dateModified sentinel so they
     * sort consistently if a consumer ever sorts by date.
     */
    private indexApps(): void {
        if(this._appsIndexed) return;

        const entryPath = 'None';
        const installApps = this._appDirectory.getAppList();
        const date = new Date('1970-01-01');
        for(const app of installApps){
            this.pushIfAbsent(this.getFileSearchIndex(FileIndexIDs.APPS, app, entryPath, Constants.EMPTY_STRING,
                this._appDirectory.getAppIcon(app), app, date));
        }
        this._appsIndexed = true;
    }

    /**
     * Single chokepoint for inserting into `_Index`. Uses `_indexedPaths`
     * as an O(1) dedupe set so the same entry is never indexed twice,
     * regardless of how many times the walker visits it.
     *
     * Keying:
     *   - APPS entries share srcPath='None', so they are keyed as
     *     `APPS::<name>` to keep multiple apps distinct.
     *   - Everything else is keyed by srcPath, which is unique per
     *     file/folder in the virtual FS.
     */
    private pushIfAbsent(entry:FileSearchIndex):void{
        const key = (entry.type === FileIndexIDs.APPS)
            ? `${entry.type}::${entry.name}`
            : entry.srcPath;
        if(this._indexedPaths.has(key)) return;
        this._indexedPaths.add(key);
        this._Index.push(entry);
    }

    /**
     * Returns true for the Recycle Bin itself or any descendant path.
     * Used everywhere we accept an external path to guarantee the
     * Recycle Bin is never indexed even if a caller hands us a path
     * that lives inside it.
     */
    private isInRecycleBin(path:string):boolean{
        return path === this.PATH_TO_EXCLUDE || path.startsWith(`${this.PATH_TO_EXCLUDE}/`);
    }

    /** Tiny factory that constructs the FileSearchIndex record shape. */
    private getFileSearchIndex(type:string, name:string, srcPath:string, contentPath:string, iconPath:string, opensWith:string, dateModified:Date):FileSearchIndex{
        return{ type:type, name:name, srcPath:srcPath, contentPath:contentPath, iconPath:iconPath, opensWith:opensWith,  dateModified: dateModified}
    }

    /**
     * Fallback icon resolver for non-app entries when FileInfo did not
     * supply an iconPath. Three cases:
     *   - Folder           => generic folder icon.
     *   - File with ext    => icon of the app that opens that ext.
     *   - File without ext => generic "unknown" icon.
     */
    private handleNonAppIcons(fileName:string, isFile = true, hasExt = true):string{
        const folderIcon = 'folder_2.png';
        const unknownIcon = 'unknown.png'
        if(!isFile){
            return `${Constants.IMAGE_BASE_PATH}${folderIcon}`;
        }else{
            if(hasExt){
                const opensWith = this._fileService.getOpensWith(extname(fileName));
                return `${Constants.IMAGE_BASE_PATH}${opensWith.appIcon}`;
            }else{
                return `${Constants.IMAGE_BASE_PATH}${unknownIcon}`;
            }
        }
    }

    /**
     * Maps a file's extension to a coarse search-category id:
     *   MUSIC, VIDEOS, PHOTOS, or DOCUMENTS (the catch-all).
     * The search UI uses this for grouping/filtering hits by kind.
     */
    private determinFileType(path:string):string{
        const extension = extname(path);

        if(Constants.AUDIO_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.MUSIC;

        if(Constants.VIDEO_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.VIDEOS;

        if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.PHOTOS;

        return FileIndexIDs.DOCUMENTS;
    }

    /**
     * Incremental "file/folder was just created" notification.
     *
     * Behavior:
     *   - Recycle Bin paths are ignored.
     *   - Already-indexed paths are a no-op (idempotent).
     *   - For a file: indexes the single leaf.
     *   - For a folder: first indexes the folder entry itself so it is
     *     immediately searchable, then walks its subtree so children are
     *     picked up too. (The walker alone would only pick up children;
     *     this ensures non-empty new folders also appear in search.)
     *
     * Emits `ADD` once the operation completes.
     */
    public async addNotify(path:string, isFile:boolean): Promise<void>{
        if(this.isInRecycleBin(path)) return;

        const fileName = basename(path);
        const isPresent = this._indexedPaths.has(path);

        if(isPresent){
            console.info('Duplication avoided, file is already present in the index');
            return;
        }

        if(isFile){
            // Pass an empty queue so helperCoreAsync only handles this leaf.
            await this.helperCoreAsync([], path, fileName);
        }else{
            // For a folder, push the folder record first (the walker only pushes
            // child entries when iterating, never the root of the walk), then
            // recurse so children are indexed too. Failures fetching folder
            // info are non-fatal; we still try to walk children.
            try{
                const fileInfo = await this._fileService.getFileInfo(path);
                const iconPath = fileInfo.getIconPath || this.handleNonAppIcons(fileName, false);
                this.pushIfAbsent(this.getFileSearchIndex(
                    FileIndexIDs.FOLDERS, fileName, fileInfo.getCurrentPath || path,
                    fileInfo.getContentPath || Constants.EMPTY_STRING, iconPath,
                    fileInfo.getOpensWith || Constants.FILE_EXPLORER,
                    (fileInfo.getDateModified as unknown as Date) || new Date()));
            }catch(err){
                console.warn('addNotify: failed to fetch folder info', path, err);
            }
            await this.indexDirectoryAsync(path);
        }

        this.fileIndexChangeOperation.next(fileIndexChangeOperationType.ADD);
    }

    /**
     * Incremental "file/folder was just removed" notification.
     *
     * File case:   remove the single matching entry.
     * Folder case: remove the folder entry AND every descendant whose
     *              srcPath starts with `<path>/`. This is critical:
     *              without the prefix sweep, deleting a folder would
     *              leave its children orphaned in the index.
     *
     * Only emits `DELETE` when at least one entry was actually removed,
     * so subscribers don't churn when called for an already-removed path.
     */
    public deleteNotify(path:string, isFile:boolean):void{
        if(!path) return;
        const folderPrefix = `${path}/`;

        const before = this._Index.length;
        this._Index = this._Index.filter(entry => {
            if(isFile){
                if(entry.srcPath === path){
                    this._indexedPaths.delete(entry.srcPath);
                    return false;   // drop
                }
                return true;        // keep
            }
            // Folder: drop the folder itself and any descendants.
            if(entry.srcPath === path || entry.srcPath.startsWith(folderPrefix)){
                this._indexedPaths.delete(entry.srcPath);
                return false;
            }
            return true;
        });

        if(this._Index.length !== before){
            this.fileIndexChangeOperation.next(fileIndexChangeOperationType.DELETE);
        }
    }

    /**
     * Incremental "file/folder was renamed" notification.
     *
     * Inputs:
     *   path         - the NEW absolute path (post-rename).
     *   oldFileName  - the previous basename (used to reconstruct old path).
     *   isFile       - whether the renamed item is a file.
     *
     * For a file:
     *   - Update `name` and `srcPath` on the matching entry.
     *   - If the extension changed, re-derive `type` (MUSIC/VIDEOS/...)
     *     and `iconPath` so search categorization stays correct.
     *
     * For a folder:
     *   - Update the folder entry itself, AND
     *   - Rewrite the prefix of every descendant entry's srcPath so
     *     children continue to resolve to the right location.
     *
     * Only emits `UPDATE` when at least one entry actually changed.
     */
    public updateNotify(path:string, oldFileName:string, isFile:boolean):void{
        if(!path || !oldFileName) return;

        const parent = dirname(path);
        const oldPath = `${parent}/${oldFileName}`;
        const newName = basename(path);
        let changed = false;

        for(let i = 0; i < this._Index.length; i++){
            const entry = this._Index[i];

            if(entry.srcPath === oldPath){
                // Rename the entry itself. Keep `_indexedPaths` in sync by
                // removing the old key before mutating, then re-adding the new.
                this._indexedPaths.delete(entry.srcPath);
                entry.srcPath = path;
                entry.name = newName;
                if(isFile){
                    const ext = extname(newName);
                    if(ext !== Constants.EMPTY_STRING){
                        entry.type = this.determinFileType(path);
                        entry.iconPath = this.handleNonAppIcons(newName);
                    }else{
                        // Extension was stripped on rename -> revert to generic icon.
                        entry.iconPath = this.handleNonAppIcons(newName, true, false);
                    }
                }
                this._indexedPaths.add(entry.srcPath);
                changed = true;
                continue;
            }

            // Folder rename: rewrite the prefix of any descendant srcPath
            // so e.g. /a/b/c.txt becomes /a/B/c.txt when /a/b -> /a/B.
            if(!isFile){
                const oldPrefix = `${oldPath}/`;
                if(entry.srcPath.startsWith(oldPrefix)){
                    this._indexedPaths.delete(entry.srcPath);
                    entry.srcPath = `${path}/${entry.srcPath.substring(oldPrefix.length)}`;
                    this._indexedPaths.add(entry.srcPath);
                    changed = true;
                }
            }
        }

        if(changed){
            this.fileIndexChangeOperation.next(fileIndexChangeOperationType.UPDATE);
        }
    }

    /**
     * Public accessor for the current index. Returns a *shallow copy* so
     * callers cannot accidentally (or maliciously) mutate the internal
     * `_Index` array. The element objects themselves are still shared
     * by reference -- callers must not mutate them either.
     */
    public getFileIndex():FileSearchIndex[]{
        return [...this._Index];
    }

    /** Process record for the running-process service (purely for visibility). */
    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    /** Service record for the services panel. */
    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }

}