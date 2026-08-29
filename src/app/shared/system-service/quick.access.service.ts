import { Injectable } from '@angular/core';
import { BaseService } from '../../system-files/base/base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { QuickAccessEntry } from 'src/app/system-files/commons/common.interfaces';
import { FileInfo } from 'src/app/system-files/fs/file.info';

/**
 * Tracks files/folders the user opens and how often. Entries with a higher
 * open `count` rise to the top (ties broken by most-recent interaction), so the
 * list is a "quick access" of the user's most-used items.
 *
 * The public API speaks FileInfo (add/remove take a FileInfo), but only a lean
 * QuickAccessEntry is persisted — never the whole FileInfo. FileInfo carries
 * file *content* (_contentBuffer/_stringBuffer) plus point-in-time stat fields
 * that go stale, and its ArrayBuffer doesn't survive JSON. We store just the
 * identity + what's needed to render/launch the tile, and rebuild a FileInfo on
 * demand via toFileInfo().
 *
 * Persisted to localStorage (same approach as ActivityHistoryService /
 * SystemMetricService) — the data is tiny structured metadata, so a virtual-FS
 * file + custom parser would add layers without saving memory.
 */
@Injectable({
    providedIn: 'root'
})
export class QuickAccessService implements BaseService {

    private _processIdService!:ProcessIDService;
    private _runningProcessService!:RunningProcessService;
    private _entries!: QuickAccessEntry[];

    private readonly STORAGE_KEY = 'quick_access';
    // Cap the list so storage/memory stays bounded (the user flagged memory
    // use). When exceeded, the lowest-priority entry (lowest count, then oldest
    // interaction) is dropped on the next add.
    private readonly MAX_ENTRIES = 30;

    name = 'quick_access_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'tracks frequently opened files and folders';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._entries = [];

        this.loadFromStorage();

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    /**
     * Record that `file` was opened. First open adds a lean entry; subsequent
     * opens bump its count and interaction time. Identity is the file's current
     * path, so renames/moves surface as a new entry (matching how the item is
     * addressed on disk).
     */
    add(file: FileInfo): void {
        const path = file.getCurrentPath;
        if(!path) return;

        const existing = this._entries.find(e => e.path === path);
        if(existing){
            existing.count += 1;
            existing.lastInteractionTS = Date.now();
        }else{
            this._entries.push({
                path: path,
                name: file.getFileName,
                icon: file.getIconPath,
                opensWith: file.getOpensWith,
                fileType: file.getFileType,
                isFile: file.getIsFile,
                count: 1,
                lastInteractionTS: Date.now(),
            });
            this.trimToCap();
        }

        this.save();
    }

    /** Remove `file` from the quick-access list (matched by current path). */
    remove(file: FileInfo): void {
        if(this._entries.length === 0) return;

        const originalLength = this._entries.length;
        this._entries = this._entries.filter(e => e.path !== file.getCurrentPath);

        // Only persist if something actually changed.
        if(this._entries.length < originalLength)
            this.save();
    }

    /** Drop every tracked entry and clear the persisted blob. */
    clear(): void {
        if(this._entries.length === 0) return;

        this._entries = [];
        this.save();
    }

    /** Entries ordered most-used first (count desc, then most-recent first). */
    getEntries(): QuickAccessEntry[] {
        return [...this._entries].sort(this.byPriorityDesc);
    }

    /**
     * The quick-access list as ready-to-render FileInfo objects (most-used
     * first). Lets consumers (e.g. the file explorer's frequent-folders pane)
     * drop the hardcoded stub data and bind real, persisted items.
     */
    getQuickAccessFiles(): FileInfo[] {
        return this.getEntries().map(e => this.toFileInfo(e));
    }

    /**
     * Rebuild a usable FileInfo from a stored entry — mirrors how the file
     * explorer hand-builds FileInfo tiles (icon/path/name/opensWith setters).
     * contentPath falls back to the path for real files/folders.
     */
    toFileInfo(entry: QuickAccessEntry): FileInfo {
        const fileInfo = new FileInfo();
        fileInfo.setIconPath = entry.icon;
        fileInfo.setCurrentPath = entry.path;
        fileInfo.setContentPath = entry.path;
        fileInfo.setFileName = entry.name;
        fileInfo.setFileType = entry.fileType;
        fileInfo.setIsFile = entry.isFile;
        fileInfo.setOpensWith = entry.opensWith;
        return fileInfo;
    }

    /** Highest count first; break ties with the most recent interaction. */
    private byPriorityDesc = (a: QuickAccessEntry, b: QuickAccessEntry): number => {
        if(b.count !== a.count) return b.count - a.count;
        return b.lastInteractionTS - a.lastInteractionTS;
    };

    /** Keep only the top MAX_ENTRIES by priority, dropping the weakest. */
    private trimToCap(): void {
        if(this._entries.length <= this.MAX_ENTRIES) return;
        this._entries = [...this._entries].sort(this.byPriorityDesc).slice(0, this.MAX_ENTRIES);
    }

    private save(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._entries));
    }

    private loadFromStorage(): void {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if(!data) return;
        try {
            const parsed = JSON.parse(data) as QuickAccessEntry[];
            if(Array.isArray(parsed)){
                // Coerce each field so a legacy/partial blob can't inject
                // undefineds that later break rendering. Skip entries with no
                // path (the identity key).
                this._entries = parsed
                    .filter(e => typeof e?.path === 'string' && e.path.length > 0)
                    .map(e => ({
                        path: e.path,
                        name: typeof e.name === 'string' ? e.name : Constants.EMPTY_STRING,
                        icon: typeof e.icon === 'string' ? e.icon : Constants.EMPTY_STRING,
                        opensWith: typeof e.opensWith === 'string' ? e.opensWith : Constants.EMPTY_STRING,
                        fileType: typeof e.fileType === 'string' ? e.fileType : Constants.EMPTY_STRING,
                        isFile: typeof e.isFile === 'boolean' ? e.isFile : true,
                        count: typeof e.count === 'number' ? e.count : 1,
                        lastInteractionTS: typeof e.lastInteractionTS === 'number'
                            ? e.lastInteractionTS
                            : Date.now(),
                    }));
            }
        } catch {
            // Corrupt blob — start fresh rather than crash the OS boot path.
            this._entries = [];
        }
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
