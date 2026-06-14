import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { FileInfo } from "src/app/system-files/file.info";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { SessionManagementService } from "./session.management.service";
import { DefaultService } from "./defaults.services";

/**
 * A single item retained by the clipboard data bank. One entry is created
 * for every Copy / Cut the user performs (on the desktop or in file explorer).
 */
export interface ClipboardEntry {
    id: string;
    action: string;       // MenuAction.COPY | MenuAction.CUT
    path: string;         // path used by paste
    displayName: string;  // file / folder name shown in the flyout
    iconPath: string;     // icon shown next to the entry
    isFile: boolean;
    pinned: boolean;
    timestamp: number;
}

/**
 * ClipboardService
 * ----------------
 * The clipboard data bank backing the Windows-10-style clipboard flyout
 * (summoned with Windows + V).
 *
 * Responsibilities:
 *  - Retain a capped, most-recent-first history of copied / cut items.
 *  - Persist that history to the user session so it survives reloads.
 *  - Notify the open clipboard window when the history changes.
 *
 * Copy / Cut surfaces (desktop, file explorer) push entries here via
 * `addFileEntry`; the clipboard component reads them back via `getEntries`.
 */
@Injectable({
    providedIn: 'root'
})
export class ClipboardService implements BaseService {

    private _processIdService!: ProcessIDService;
    private _runningProcessService!: RunningProcessService;
    private _sessionManagementService!: SessionManagementService;
    private _defaultService!: DefaultService;

    /** Most-recent-first list of clipboard items. */
    private _entries: ClipboardEntry[] = [];

    /** Upper bound on retained (non-pinned) items, mirroring Windows 10. */
    private readonly MAX_ENTRIES = 25;

    private readonly _sessionKey = Constants.CLIPBOARD_DATA;

    /** Fired whenever the data bank changes so an open flyout can re-render. */
    clipboardChangeNotify: Subject<void> = new Subject<void>();

    name = 'clipboard_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'maintains the clipboard data bank';

    constructor(processIDService: ProcessIDService, runningProcessService: RunningProcessService,
        sessionManagementService: SessionManagementService, defaultService: DefaultService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._sessionManagementService = sessionManagementService;
        this._defaultService = defaultService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.loadFromSession();
    }

    /** True when clipboard history is enabled in the user's default settings. */
    isClipboardEnabled(): boolean {
        return this._defaultService.getDefaultSetting(Constants.DEFAULT_CLIP_BOARD_STATE) === Constants.TRUE;
    }

    /**
     * Record a Copy / Cut of `file` in the data bank. The newest entry is kept
     * at the front; an existing entry for the same path is replaced (so the item
     * bubbles back to the top instead of duplicating).
     */
    addFileEntry(file: FileInfo, action: string): void {
        // Honour the user's clipboard-history toggle: when it's off, copy/cut
        // still works for an immediate paste, but nothing is retained here.
        if (!this.isClipboardEnabled()) {
            return;
        }

        const path = file.getCurrentPath;
        if (!path || path === Constants.EMPTY_STRING) {
            return;
        }

        const entry: ClipboardEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            action,
            path,
            displayName: file.getFileName || path,
            iconPath: file.getIconPath || `${Constants.IMAGE_BASE_PATH}generic_program.png`,
            isFile: file.getIsFile,
            pinned: false,
            timestamp: Date.now()
        };

        // Drop any prior (non-pinned) entry pointing at the same path so the
        // item resurfaces at the top rather than piling up duplicates.
        this._entries = this._entries.filter(e => !(e.path === path && !e.pinned));
        this._entries.unshift(entry);

        this.enforceCap();
        this.persist();
        this.clipboardChangeNotify.next();
    }

    /** Returns the data bank, pinned items first, newest first within each group. */
    getEntries(): ClipboardEntry[] {
        const pinned = this._entries.filter(e => e.pinned);
        const unpinned = this._entries.filter(e => !e.pinned);
        return [...pinned, ...unpinned];
    }

    /** Remove a single entry by id. */
    removeEntry(id: string): void {
        this._entries = this._entries.filter(e => e.id !== id);
        this.persist();
        this.clipboardChangeNotify.next();
    }

    /** Clear every entry that is not pinned (mirrors "Clear all"). */
    clearAll(): void {
        this._entries = this._entries.filter(e => e.pinned);
        this.persist();
        this.clipboardChangeNotify.next();
    }

    /** Toggle the pinned flag on an entry. Pinned items survive "Clear all". */
    togglePin(id: string): void {
        const entry = this._entries.find(e => e.id === id);
        if (entry) {
            entry.pinned = !entry.pinned;
            this.persist();
            this.clipboardChangeNotify.next();
        }
    }

    private enforceCap(): void {
        const pinned = this._entries.filter(e => e.pinned);
        const unpinned = this._entries.filter(e => !e.pinned).slice(0, this.MAX_ENTRIES);
        this._entries = [...pinned, ...unpinned];
    }

    private persist(): void {
        this._sessionManagementService.addSession(this._sessionKey, this._entries);
    }

    private loadFromSession(): void {
        const saved = this._sessionManagementService.getSession(this._sessionKey) as ClipboardEntry[];
        if (Array.isArray(saved)) {
            this._entries = saved;
        }
    }

    private getProcessDetail(): Process {
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
    }

    private getServiceDetail(): Service {
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
    }
}
