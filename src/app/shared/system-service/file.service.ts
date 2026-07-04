import { Injectable } from "@angular/core";
import { FileInfo } from "src/app/system-files/fs/file.info";
import { InformationUpdate, ShortCut } from "src/app/system-files/commons/common.interfaces";
import {extname, basename, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FSModule } from "src/osdrive/Cheetah/System/BrowserFS/node/core/FS";
import { FileMetaData } from "src/app/system-files/fs/file.metadata";

import { Subject } from "rxjs";
import * as BrowserFS from 'src/osdrive/Cheetah/System/BrowserFS/browserfs'
import { Buffer} from 'buffer';
import osDriveFileSystemIndex from '../../../osdrive.json';
import ini  from 'ini';
import { FileContent } from "src/app/system-files/commons/common.interfaces";
import { ProcessType } from "src/app/system-files/system.types";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { BaseService } from "../../system-files/base/base.service.interface";
import { DefaultService } from "./defaults.services";
import { ProcessIDService } from "./process.id.service";
import { FileIndexerService } from "./file.indexer.services";
import { RunningProcessService } from "./running.process.service";
import { UserNotificationService } from "./user.notification.service";
import { SessionManagementService } from "./session.management.service";
import { SystemNotificationService } from "./system.notification.service";

import { OpensWith } from "src/app/system-files/commons/common.interfaces";
import { zipSync, unzipSync } from "fflate";
import { CommonFunctions } from "src/app/system-files/commons/common.functions";
import { FileTransferUpdate, FileTransferCopyOptions, FileTransferCount, FileTransferMoveOptions, FileOperationCheck, FolderMoveQueueItem, FileStat } from "src/app/system-files/fs/file.system.types";
import { UserNotificationType } from "src/app/system-files/commons/common.enums";
import { AppDirectory } from "src/app/system-files/app.directory";
import { DialogMessage, DialogTitle } from "../system-ui-components/dialog/dialog.types";


@Injectable({
    providedIn: 'root'
})
export class FileService implements BaseService{ 
    // Per-operation abort controllers keyed by dialogPId so concurrent transfers do not cancel each other.
    private _abortControllers: Map<number, AbortController> = new Map();
  
    private _fileSystem!:FSModule;
    private _initPromise!:Promise<boolean>;
    private _fileExistsMap!:Map<string, string>; 
    private _newFileOrFolderNameMap!:Map<string, string>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _fileDragAndDrop!:FileInfo[];
    private _appDirectory!:AppDirectory;
    private _eventOriginator = Constants.EMPTY_STRING;
    private _mountedZips:Map<string, string> = new Map<string, string>(); // mountPoint -> srcPath
    private static readonly _utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    private static readonly _utf8DecoderLenient = new TextDecoder('utf-8');

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _userNotificationService!:UserNotificationService
    private _systemNotificationService:SystemNotificationService;
    private _sessionManagementService!:SessionManagementService;
    private _fileIndexerService!:FileIndexerService;
    private _defaultService:DefaultService;

    /**
     * Lazy accessor for the file indexer. The indexer is normally assigned
     * in postInitBrowserFs(), but BrowserFS init is asynchronous and the
     * static `FileIndexerService.instance` may not be populated yet when
     * the very first file operation runs (e.g. an early screenshot save).
     * This getter resolves the singleton on demand and caches it once
     * available. Callers must still null-check, because the indexer may
     * legitimately not exist yet on the very first call.
     */
    private get fileIndexer(): FileIndexerService | undefined {
        if(!this._fileIndexerService){
            this._fileIndexerService = FileIndexerService.instance;
        }
        return this._fileIndexerService;
    }

    private _isCalculated = false;
    private _usedStorageSizeInBytes = 0;
    private _dialogPIdToCancel = 0;

    dirFilesUpdateNotify: Subject<void> = new Subject<void>();
    fetchDirectoryDataNotify: Subject<string> = new Subject<string>();
    goToDirectoryNotify: Subject<string[]> = new Subject<string[]>();
    cancelFileTransferNotify: Subject<number> = new Subject<number>();

    readonly fileServiceRestoreKey = Constants.FILE_SVC_RESTORE_KEY;
    readonly fileServiceIterateKey = Constants.FILE_SVC_FILE_ITERATE_KEY;
    readonly FILE_TRANSFER_DIALOG_APP_NAME = 'fileTransferDialog';

    // Concurrency limit (adjust as needed)
    private readonly CONCURRENCY_LIMIT = 8;
    // Maximum number of retries when generating unique file/folder names
    private readonly MAX_DUPLICATE_RETRIES = 25;

    name = 'file_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagementService:SessionManagementService, systemNotificationService:SystemNotificationService, defaultService:DefaultService){ 
        this.initBrowserFS();
        this._fileExistsMap =  new Map<string, string>();
        this._restorePoint =  new Map<string, string>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
        this._newFileOrFolderNameMap = new Map<string, string>();
        this._appDirectory = new AppDirectory();
        this._fileDragAndDrop = [];

        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._userNotificationService = userNotificationService;
        this._sessionManagementService = sessionManagementService;
        this._systemNotificationService = systemNotificationService;
        this._defaultService = defaultService;

        this.cancelFileTransferNotify.subscribe((p) =>{
            this.terminateTransfer(p);
            this.pIdToTerminate(p);
        });

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.retrievePastSessionData(this.fileServiceRestoreKey);
        this.retrievePastSessionData(this.fileServiceIterateKey);
    }

    private initBrowserFS(): void {
        this._initPromise = new Promise<boolean>((resolve) => {
           // setTimeout(() => {
                this.initBrowserFsAsync().then((success) => {
                    if (success) {
                        this.postInitBrowserFs();
                    } else {
                        console.warn("BrowserFS failed to initialize.");
                    }
                    resolve(success);
                });
           // }, 0);
        });
    }

    private async initBrowserFsAsync():Promise<boolean>{
        if(this._fileSystem)
            return true;
 
        const currentURL = CommonFunctions.getCurrentURL();
        console.log('currentURL:',currentURL);
        
        return new Promise<boolean>((resolve) => {
            BrowserFS.configure(
                {
                    fs: "MountableFileSystem",
                    options:{
                        '/':{
                            fs: 'OverlayFS',
                            options:{
                                readable:{
                                    fs: 'XmlHttpRequest', 
                                    options:{
                                        index: osDriveFileSystemIndex, 
                                        baseUrl:`${currentURL}osdrive`
                                    }
                                },
                                writable:{
                                    fs:"IndexedDB", 
                                    options: {
                                        storeName: "browser-fs-cache"
                                    }
                                }
                            },
                        },  
                    }
                },
                (err) =>{
                    if(err){  
                        console.error('initBrowserFs Error:', err)
                        return resolve(false);
                    }
                    try {
                        this._fileSystem = BrowserFS.BFSRequire('fs');
                        // console.log('initBrowserFsAsync: File system initialized successfully.');
                        return resolve(true);
                    } catch (initErr) {
                        console.error('initBrowserFsAsync: BFSRequire failed', initErr);
                        return resolve(false);
                    }
                }
            );
        });
    }

    private async postInitBrowserFs(): Promise<void> {
        const delay = 100; //100ms
        // NOTE: the full-drive storage walk is intentionally NOT performed here.
        // It is deferred and computed lazily on first access via
        // getUsedStorageAsync() (Settings storage pane / drive Properties),
        // keeping the boot path free of an expensive whole-drive traversal.
        this._fileIndexerService = FileIndexerService.instance;

        await CommonFunctions.sleep(delay);
        // Guard: if Angular hasn't constructed FileIndexerService yet for any
        // reason, skip the initial walk rather than crashing. Subsequent
        // operations will lazy-resolve via the `fileIndexer` getter.
        if(this._fileIndexerService){
            await this._fileIndexerService.indexDirectoryAsync();
        }else{
            console.warn('postInitBrowserFs: FileIndexerService.instance not ready; skipping initial index walk');
        }
    }   

    // public async isDirectory(path:string):Promise<boolean> {
    //     await this._initPromise;
    //     return new Promise<boolean>((resolve) =>{
    //         this._fileSystem.stat(path,(err, stats) =>{
    //             if(err){
    //                 console.error('checkIfDirectoryAsync: Failed to get stats →', err);
    //                 return resolve(false);
    //             }
    //             return resolve(stats ? stats.isDirectory() : false);
    //         });
    //     });
    // }

    /**
     * Stat helper that returns the raw isDirectory + size in a single call,
     * letting callers avoid the common pattern of `isDirectory()` + `geFileMetaData()`
     * (which previously issued 2–3 stat calls per entry).
     */
    public async getStatAsync(path: string): Promise<FileStat>{
        await this._initPromise;
        return new Promise<FileStat>((resolve) => {
            this._fileSystem.stat(path, (err, stats) => {
                if(err || !stats){
                    return resolve({ isDirectory: false, size: 0, exists: false });
                }
                return resolve({ isDirectory: stats.isDirectory(), size: stats.size || 0, exists: true });
            });
        });
    }

    public async exists(path: string):Promise<boolean> {
        await this._initPromise;
        return new Promise<boolean>((resolve) => {
            this._fileSystem.exists(path, (exists) => {
                // console.log(`checkIfExistsAsync: ${exists ? 'Already exists' : 'Does not exist'}`, exists);
                resolve(exists);
            });
        });
    }

    public async copyAsync(srcPath:string, destPath:string, isFile?:boolean):Promise<boolean>{
        const isDirectory = (isFile === undefined) ? (await this.getStatAsync(srcPath)).isDirectory : !isFile;

        const filesTrasnferedCount:FileTransferCount = { fileCount: 0};
        const firstMsg = DialogMessage.FILE_SVC_ESTIMATING;
        const title = DialogTitle.FILE_SVC_COPYING;
        const dialogPId = this.initFileTransfer(firstMsg, title);
        const abortController = new AbortController();
        this._abortControllers.set(dialogPId, abortController);
        const signal = abortController.signal;
        this.sendUpdate(dialogPId);

        let result: boolean;
        let deltaSize = 0;
        try {
            if(isDirectory){
                // Single merged traversal returns count + size, avoids 3 separate tree walks.
                const stats = await this.traverseFolderAsync(srcPath);
                deltaSize = stats.size;
                result = await this.copyFolderHandlerAsync({arg0:Constants.EMPTY_STRING, srcPath, destPath, filesToTransferCount: stats.files, dialogPId, fileTransferCount:filesTrasnferedCount, currentSize:stats.size, signal});
            } else {
                result = await this.copyFileAsync(srcPath, destPath);
                if(result){
                    const meta = await this.getStatAsync(srcPath);
                    deltaSize = meta.size;
                    // Emit a single "100% complete" update so the transfer dialog
                    // leaves the Estimating animation and auto-closes. Without this
                    // the dialog stays stuck in the estimating state for single-file
                    // copies (which never go through copyFolderHandlerAsync).
                    const fileName = this.getNameFromPath(srcPath);
                    filesTrasnferedCount.fileCount = 1;
                    const transferUpdate = this.genFileTransferUpdate(
                        srcPath, destPath, 1, 1, 0, 0, 0, fileName
                    );
                    this.sendFileTransferUpdate(dialogPId, transferUpdate);
                }
            }
        } finally {
            this._abortControllers.delete(dialogPId);
        }

        if(result && deltaSize > 0 && this._isCalculated){
            // Incremental update avoids re-scanning the whole drive after every transfer.
            // Only applied once a baseline exists; before that the next
            // getUsedStorageAsync() computes a fresh, correct total from scratch.
            this._usedStorageSizeInBytes += deltaSize;
        }
        return result;
    }

    private async copyFileAsync(srcPath:string, destPath:string):Promise<boolean>{
        const name = this.getNameFromPath(srcPath);
        const destinationPath = `${this.pathCorrection(destPath)}/${name}`;

        const readResult = await this.readRawAsync(srcPath);
        if(!readResult){
            return false;
        }

        const writeRes = await this.writeRawHandlerAsync(destinationPath, readResult);
        if(writeRes.ok){
            const isFile = true;
            // Best-effort: indexer may not be ready on very early writes.
            await this.fileIndexer?.addNotify(writeRes.finalPath, isFile);
        }

        return writeRes.ok;
    }

    /**
     * Run several file copies in parallel using a single shared semaphore so the total
     * number of in-flight I/O operations stays bounded across the whole recursion.
     * @param options 
     * @returns 
     */
    private async copyFolderHandlerAsync(options: FileTransferCopyOptions): Promise<boolean> {
        const { srcPath, destPath, filesToTransferCount: fileCount, dialogPId, fileTransferCount: copiedFiles, signal } = options;

        const createFolderResult = await this.createFolderAsync(destPath, this.getNameFromPath(srcPath));
        if(!createFolderResult.ok) return false;
        const folderName = this.getNameFromPath(createFolderResult.finalPath);

        // The shared limiter is created on the first (top-level) call and reused on recursion.
        // IMPORTANT: the limiter is only used for leaf file I/O. Recursion into subfolders
        // MUST NOT run inside a limiter slot, otherwise parents holding slots while waiting
        // for children that also need slots will deadlock once depth >= concurrency limit.
        const limiter = options.limiter ?? this.createLimiter(this.CONCURRENCY_LIMIT);
        const passOptions = { ...options, limiter };

        if (dialogPId === this._dialogPIdToCancel && signal.aborted) {
            console.warn("Transfer aborted.");
            this._dialogPIdToCancel = 0;
            return false;
        }

        const loadedDirectoryEntries = await this.readDirectory(srcPath);

        // Stat all entries in parallel (cheap, no limiter needed).
        const entryStats = await Promise.all(loadedDirectoryEntries.map(async directoryEntry => {
            const entryPath = `${srcPath}/${directoryEntry}`;
            const st = await this.getStatAsync(entryPath);
            return { directoryEntry, entryPath, st };
        }));

        const subDirs: Array<{ directoryEntry: string; entryPath: string }> = [];
        const fileTasks: Promise<boolean>[] = [];

        for(const { directoryEntry, entryPath, st } of entryStats){
            if(st.isDirectory){
                subDirs.push({ directoryEntry, entryPath });
                continue;
            }

            const entrySize = st.size;
            fileTasks.push(limiter(async () => {
                if (dialogPId === this._dialogPIdToCancel && signal.aborted) {
                    return false;
                }
                const start = performance.now();
                const result = await this.copyFileAsync(entryPath, `${destPath}/${folderName}`);
                const end = performance.now();
                const duration = end - start;

                if(result){
                    copiedFiles.fileCount++;
                    const itemsRemaining = fileCount - copiedFiles.fileCount;
                    const timeRemaining = duration * itemsRemaining;
                    options.currentSize = Math.max(0, (options.currentSize ?? 0) - entrySize);
                    const itemsRemainingSize = options.currentSize;

                    const transferUpdate = this.genFileTransferUpdate(
                        srcPath,
                        destPath,
                        fileCount,
                        copiedFiles.fileCount,
                        timeRemaining,
                        itemsRemaining,
                        itemsRemainingSize,
                        directoryEntry
                    );
                    this.sendFileTransferUpdate(dialogPId, transferUpdate);
                    return true;
                }

                console.error(`file:${entryPath} failed to copy to destination:${destPath}/${folderName}`);
                return false;
            }));
        }

        // Wait for file-level copies at this level.
        const fileResults = await Promise.allSettled(fileTasks);
        const fileFailed = fileResults.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));

        // Recurse into subdirectories OUTSIDE the limiter so we never deadlock.
        const subResults = await Promise.allSettled(subDirs.map(({ entryPath }) =>
            this.copyFolderHandlerAsync({ ...passOptions, srcPath: entryPath, destPath: `${destPath}/${folderName}` })
        ));
        const subFailed = subResults.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));

        return !(fileFailed || subFailed);
    }

    public async createFolderAsync(directory: string, folderName: string, requestId: string =Constants.EMPTY_STRING): Promise<{ ok: boolean; finalPath: string }> {
        const folderPath =  CommonFunctions.removeDoubleSlashes(`${directory}/${folderName}`);
        const result = await this.createFolderHandlerAsync(folderPath);

        if(result.ok){
            console.log(`createFolderAsync: folder created at ${result.finalPath}`);
            console.log(`folderName: folder created is ${basename(result.finalPath)}`);
            if (requestId !== Constants.EMPTY_STRING) {
                this._newFileOrFolderNameMap.set(requestId, basename(result.finalPath));
            }
            // Best-effort: indexer may not be ready on very early folder creates.
            await this.fileIndexer?.addNotify(result.finalPath, false);
        }

        return result;
    }

    /**
     * Creates a folder and handles duplicate folder names gracefully.
     * Returns the path of the folder that was actually created (which may differ
     * from `folderPath` when a duplicate name was encountered and an incremented
     * unique name was used).
     */
    private async createFolderHandlerAsync(folderPath: string): Promise<{ ok: boolean; finalPath: string }> {
        const createResult = await this.createFolderRawAsync(folderPath);

        if (createResult === 0) {
            this._fileExistsMap.set(folderPath, String(0));
            this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
            return { ok: true, finalPath: folderPath };
        }

        if (createResult === 1) {
            for (let attempt = 0; attempt < this.MAX_DUPLICATE_RETRIES; attempt++) {
                const uniqueFolderPath = CommonFunctions.removeDoubleSlashes(this.IncrementFileName(folderPath));
                const retryResult = await this.createFolderRawAsync(uniqueFolderPath);

                if (retryResult === 0) {
                    this._fileExistsMap.set(uniqueFolderPath, String(0));
                    this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                    return { ok: true, finalPath: uniqueFolderPath };
                }

                if (retryResult !== 1) {
                    console.error(`createFolderAsync: unexpected error on retry ${attempt + 1}`);
                    return { ok: false, finalPath: folderPath };
                }
            }

            console.error(`createFolderAsync: exceeded ${this.MAX_DUPLICATE_RETRIES} retries`);
            return { ok: false, finalPath: folderPath };
        }

        return { ok: false, finalPath: folderPath };
    }

    /**
     * Attempts to create a folder at the given path.
     * Returns:
     * 0 = success
     * 1 = already exists
     * 2 = other error
     */
    private async createFolderRawAsync(folderPath: string): Promise<number> {
        return new Promise<number>((resolve) => {
            this._fileSystem.mkdir(folderPath, 0o777, (err) => {
                if (!err) {
                    return resolve(0);
                }

                if (err.code === 'EEXIST') {
                    console.warn(`Folder already exists: ${folderPath}`);
                    return resolve(1);
                }

                console.error(`Error creating folder: ${err}`);
                return resolve(2);
            });
        });
    }

    private async updateFileTimestampsAsync(path: string, mtime?: Date): Promise<void> {
        return new Promise<void>((resolve) => {
            const now = new Date();
            if(mtime){
                this._fileSystem.utimes(path, now, mtime, (err) => {
                    if(err){ console.error('updateAccessTimeAsync error:', err); }
                    resolve();
                });
            }else{
                this._fileSystem.utimes(path, now, now, (err) => {
                    if(err){ console.error('updateAccessTimeAsync error:', err); }
                    resolve();
                });
            }
        });
    }

    public async geFileMetaDataAsync(path: string): Promise<FileMetaData> {
        return new Promise((resolve) =>{
            this._fileSystem.exists(path, (exists)=>{
                if(!exists){
                    console.error('geFileMetaData: path does not exist:', path);
                    return resolve(new FileMetaData());
                }

                this._fileSystem.stat(path, (err, stats) =>{
                    if(err){
                        console.error('geFileMetaData error:', err);
                        return resolve(new FileMetaData());
                    }
                    resolve(new FileMetaData(stats?.atime, stats?.ctime, stats?.mtime, stats?.size, stats?.blksize, stats?.mode, stats?.isDirectory()));
                });
           });
        });
    }

    public async getFileAsTextAsync(path:string): Promise<string> {
        if (!path) {
            console.error('getFileAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        const readResult = await this.readRawAsync(path);
        if(readResult)
            return readResult.toString();
        else
            return Constants.EMPTY_STRING;
    }

    /**
     * 
     * @param path 
     * @returns Promise
     * 
     * Read File and Convert to Blob URL:
     * It returns a new promise that attempts to read the file from the given path using the filesystem's readFile method.
     * If there's an error reading the file, it logs the error and rejects the promise.
     * If the file is read successfully, it converts the file contents (buffer) into a Blob URL using the bufferToUrl method.
     * It then resolves the promise with the Blob URL.
     */
    public async getFileAsBlobAsync(path:string): Promise<string> {
        if (!path) {
            console.error('getFileBlobAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        const readResult = await this.readRawAsync(path);
        if(readResult)
            return  this.bufferToUrl(readResult);
        else
            return Constants.EMPTY_STRING;
    }

    /**
     * Build the *direct* HTTP URL for a file that physically lives in the
     * read-only osdrive layer. BrowserFS mounts that layer with
     * `baseUrl = ${location.href}osdrive`, so a virtual path such as
     * `/Users/Videos/clip.mp4` is served at `osdrive/Users/Videos/clip.mp4`
     * (the same relative form already used to load scripts/styles elsewhere,
     * e.g. `osdrive/Program-Files/Videojs/video.min.js`).
     *
     * Returning a direct URL — instead of reading the whole file into a blob —
     * lets the browser stream large media via HTTP range requests (supported by
     * static hosts such as GitHub Pages), so a 25 MB video is not fully
     * downloaded (and pinned in memory) before playback can begin.
     *
     * NOTE: this only resolves files in the pristine osdrive image. Files the
     * user created/copied live in the writable IndexedDB overlay and are NOT
     * reachable by this URL, so callers must keep a blob fallback for them.
     */
    public getDirectFileUrl(path: string): string {
        if(!path) return Constants.EMPTY_STRING;
        const normalized = path.startsWith(Constants.ROOT) ? path : `${Constants.ROOT}${path}`;
        return this.toAbsoluteOsdriveUrl(`osdrive${normalized}`);
    }

    /**
     * Resolve an already-osdrive-prefixed relative path (e.g. `osdrive/Users/Music/song.mp3`)
     * to an ABSOLUTE url anchored at the document base (<base href>).
     *
     * When the app is hosted under a sub-path (e.g. a GitHub Pages project site
     * served from /<repo>/), media libraries such as Howler and Video.js re-resolve
     * a relative or root-absolute string against the origin root instead of
     * <base href>, producing 404s like `https://host/osdrive/...` instead of
     * `https://host/<repo>/osdrive/...`. Anchoring to document.baseURI yields the
     * correct url in every deploy layout (dev `/`, project sub-path, custom domain).
     */
    public toAbsoluteOsdriveUrl(osdriveRelativePath: string): string {
        if(!osdriveRelativePath) return Constants.EMPTY_STRING;
        return new URL(osdriveRelativePath, document.baseURI).href;
    }

    private async readRawAsync(srcPath: string): Promise<Buffer | undefined>{
        return new Promise((resolve) => {
            this._fileSystem.readFile(srcPath, (readErr, contents = Buffer.from(Constants.EMPTY_STRING)) => {
                if (!readErr) {
                    return resolve(contents);
                }

                console.error('readRawAsync error:', readErr);
                return resolve(undefined);
            });
        });
    }

    public async readDirectory(path:string):Promise<string[]>{
        if (!path) {
            console.error('getEntriesFromDirectoryAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        await this._initPromise;
        
        return new Promise<string[]>((resolve) => {
             this._fileSystem.readdir(path, function(err, files) {
                if(err){
                    console.error("Dang! The filesystem is acting up:", err);
                    return resolve([]);
                }
                return resolve(files || []);
            });
        });
    }

    /**
     * Extracts the file or folder name from a full path.
     * - If the path is a file, returns the file name with extension (e.g. "Test.png").
     * - If the path is a folder, returns the last folder name (e.g. "Images").
     *
     * @param path Full file or directory path
     * @returns File or folder name
     */
    private getNameFromPath(path: string): string {
        return basename(path);
    }

	async loadDirectoryFiles(path: string): Promise<FileInfo[]>{
		try{
            const directoryEntries = await this.readDirectory(path);
            // Load entries in parallel (bounded) and tolerate per-file failures so one
            // bad entry doesn't blank the whole listing.
            const limiter = this.createLimiter(this.CONCURRENCY_LIMIT);
            const results = await Promise.all(directoryEntries.map(entry => limiter(async () => {
                const entryPath = CommonFunctions.removeDoubleSlashes(`${path}/${entry}`);
                try {
                    // PERF: a directory *listing* must never download heavy file
                    // *content* (video/audio/swf/pdf can be tens of MB each, fetched
                    // over HTTP by the osdrive backend). Pass loadContent=false so only
                    // lightweight metadata + generic type icons are resolved here; the
                    // real content is materialized later, on open (see
                    // ProcessHandlerService.runApplication / the media players).
                    return await this.getFileInfoAsync(entryPath, false);
                } catch(err) {
                    console.error('loadDirectoryFiles: entry failed', entryPath, err);
                    return null;
                }
            })));
            return results.filter((f): f is FileInfo => f !== null);
		}catch(err){
			console.error('loadDirectoryFiles:',err);
			return [];
		}
	}

	public async getFileInfoAsync(path:string, loadContent = true):Promise<FileInfo>{
 
        const defaultOpensWith = Constants.EMPTY_STRING;
        let fileInfo = new FileInfo();

        const useImage = true;
		let isFile = true;
        const extension = extname(path);
        const fileMetaData = await this.geFileMetaDataAsync(path);
        //await this.updateAccessTimeAsync(path, fileMetaData.getModifiedDate); //##.
        fileMetaData.setAccessDate = new Date();
        
        if(!extension){ // 9.9 out of 10 times, this is a folder (no extension) and not a file (with extension)
            const fc = await this.setOtherFolderProps(path, fileMetaData.getIsDirectory) as FileContent;
            fileInfo = this.populateFileInfo(path, fileMetaData, !isFile, defaultOpensWith, Constants.EMPTY_STRING, !useImage, undefined, fc);
            fileInfo.setIconPath = await this.changeFolderIcon(fc.fileName, fc.iconPath, path);
            fileInfo.setOpensWith = Constants.FILE_EXPLORER;
            fileInfo.setIsFile = false;
            isFile = false;
        }
        else if(extension === Constants.URL){
            const sc = await this.getShortCutFromURLAsync(path);
            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, defaultOpensWith, Constants.EMPTY_STRING, useImage, sc);
            fileInfo.setIsShortCut = true;
        }
        else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)
			|| Constants.VIDEO_FILE_EXTENSIONS.includes(extension)
			|| Constants.AUDIO_FILE_EXTENSIONS.includes(extension)
			|| Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension)){

			let fileContent:FileContent | undefined = undefined;
			const resolved = this.getOpensWith(extension);

			// PERF: image/video/audio content can each be many megabytes, and NONE of
			// it is needed to *list* or *index* a file — the explorer and desktop always
			// render a generic per-type icon (image_file.png, video_file.png,
			// music_file.png; see getOpensWith/populateFileInfo), never the file's actual
			// bytes. The decoded content is only consumed by the viewers themselves
			// (photoviewer/videoplayer/audioplayer), so we materialize it solely when the
			// file is being opened (loadContent === true) and skip it while listing.
			// Source files are never pre-loaded here (the code editor reads them on open).
			const fileType = resolved.fileType;
			const isPreviewableMedia = fileType === 'image' || fileType === 'video' || fileType === 'audio';

			if(isPreviewableMedia && loadContent)
                fileContent = await this.getFileContentFromB64DataUrlAsync(path, resolved.fileType) as FileContent;

            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, resolved.apps[0].appName, resolved.apps[0].appIcon, !useImage, undefined, fileContent);

        }else if(Constants.KNOWN_FILE_EXTENSIONS.includes(extension)){
            const resolved = this.getOpensWith(extension);

            let fileContent:FileContent | undefined = undefined;
			// PERF: swf/pdf are the only "known" types whose content is pre-loaded, and
			// like audio/video above it can be large — so defer it until the file is
			// opened (loadContent === true) and skip it during listing/indexing.
			if((resolved.fileType === 'swf' ||resolved.fileType === 'pdf') && loadContent)
                fileContent = await this.getFileContentFromB64DataUrlAsync(path, resolved.fileType) as FileContent;

            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, resolved.apps[0].appName, resolved.apps[0].appIcon, !useImage, undefined, fileContent);
		} else{
            fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}unknown.png`;
            fileInfo.setCurrentPath = path;
            fileInfo.setDateAccessed = fileMetaData.getAccessDate;
            fileInfo.setDateCreated = fileMetaData.getCreatedDate;
            fileInfo.setDateModified = fileMetaData.getModifiedDate;
            fileInfo.setSizeInBytes = fileMetaData.getSize;
            fileInfo.setBlkSizeInBytes = fileMetaData.getBlkSize;
            fileInfo.setFileName = basename(path, extname(path));
            fileInfo.setFileExtension = extension;
        }
        this.addAppAssociaton(fileInfo.getOpensWith, fileInfo.getIconPath, isFile);

        return fileInfo;
    }

	public getOpensWith(extension: string): OpensWith{
		const empty = Constants.EMPTY_STRING;
		const isAudioFile = Constants.AUDIO_FILE_EXTENSIONS.includes(extension);
		if(isAudioFile)
			return {fileType:'audio', apps: [{ isDefault: true, appName: 'audioplayer', appIcon: 'music_file.png' }]};

		const isVideoFile = Constants.VIDEO_FILE_EXTENSIONS.includes(extension);
		if(isVideoFile)
			return {fileType:'video', apps: [{ isDefault: true, appName: 'videoplayer', appIcon: 'video_file.png' }]};

		const isImageFile = Constants.IMAGE_FILE_EXTENSIONS.includes(extension);
		if(isImageFile)
			return {fileType:'image', apps: [{ isDefault: true, appName: 'photoviewer', appIcon: 'image_file.png' }]};

		const isSourceFile = Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension);
		if(isSourceFile)
			return {fileType:'source', apps: [{ isDefault: true, appName: 'codeeditor', appIcon: 'code_file.png' }] };


		const cleanedExt = extension.replace(Constants.DOT, empty);
		const knownFileHandlers: Record<string, OpensWith> = {
			'.wasm': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'codeeditor', appIcon: 'wasm_file.png' }] },
			'.txt': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'texteditor', appIcon: 'text_file.png' },
                                                    { isDefault: false, appName: 'codeeditor', appIcon: 'code_file.png' }]},
			'.properties': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'texteditor', appIcon: 'text_file.png' },
                                                    { isDefault: false, appName: 'codeeditor', appIcon: 'code_file.png' }] },
			'.log': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'texteditor', appIcon: 'text_file.png' },
                                                    { isDefault: false, appName: 'codeeditor', appIcon: 'code_file.png' }] },
			'.md': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'markdownviewer', appIcon: 'markdown_file.png' },
                                                    { isDefault: false, appName: 'codeeditor', appIcon: 'code_file.png' }] },
			'.jsdos': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'jsdos', appIcon: 'js-dos_file.png' }] },
			'.swf': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'ruffle', appIcon: 'swf_file.png' }] },
			'.pdf': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'pdfviewer', appIcon: 'pdf_file.png' }] },
            '.zip': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'fileexplorer', appIcon: 'zip_file.png' }] },
            '.ssvr': { fileType: cleanedExt, apps: [{ isDefault: true, appName: 'screensaverviewer', appIcon: 'scrn_saver.png' }, 
                                                    { isDefault: false, appName: 'codeeditor', appIcon: 'code_file.png' }] },
		};

		if (knownFileHandlers[extension]) {
			return knownFileHandlers[extension];
		}

		return {fileType:empty, apps: [{ isDefault: true, appName: empty, appIcon: empty }]};
    }

	populateFileInfo(path:string, fileMetaData:FileMetaData, isFile:boolean, opensWith:string, imageName?:string, useImage=false, shortCut?:ShortCut, fileCntnt?:FileContent):FileInfo{
        const fileInfo = new FileInfo();
        const img = `${Constants.IMAGE_BASE_PATH}${imageName}`;

        fileInfo.setCurrentPath = path;
        if(shortCut !== undefined){
            fileInfo.setIconPath = (useImage)? shortCut.iconPath || img : img;
            fileInfo.setContentPath = shortCut.contentPath || Constants.EMPTY_STRING;
            fileInfo.setFileType = shortCut.fileType || extname(path);
            fileInfo.setFileName = shortCut.fileName || basename(path, extname(path));
            fileInfo.setOpensWith = shortCut.opensWith || opensWith;
        }else{
            fileInfo.setIconPath = (useImage)? fileCntnt?.iconPath || img : img;
            fileInfo.setContentPath = fileCntnt?.contentPath || Constants.EMPTY_STRING;
            fileInfo.setFileType = fileCntnt?.fileType || extname(path);
            fileInfo.setFileName = fileCntnt?.fileName || basename(path, extname(path));
            fileInfo.setOpensWith = fileCntnt?.opensWith || opensWith;
        }
        fileInfo.setIsFile = isFile;
        fileInfo.setDateAccessed = fileMetaData.getAccessDate;
        fileInfo.setDateCreated = fileMetaData.getCreatedDate;
        fileInfo.setDateModified = fileMetaData.getModifiedDate;
        fileInfo.setSizeInBytes = fileMetaData.getSize;
        fileInfo.setBlkSizeInBytes = fileMetaData.getBlkSize;
        fileInfo.setMode = fileMetaData.getMode;
        fileInfo.setFileExtension = extname(path);

        return fileInfo;
    }

    public async getFileContentFromB64DataUrlAsync(path:string, contentType:string):Promise<FileContent> {

        return new Promise<FileContent>((resolve)  =>{
            this._fileSystem.readFile(path, (err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.error('getFileContentFromB64DataUrl error:', err);
                    return resolve(this.populateFileContent());
                }

                // Cheap probe: a data URL always starts with the ASCII bytes "data:".
                // Avoid decoding (and re-decoding) potentially multi-MB binary buffers.
                const looksLikeDataUrl = contents.length >= 5
                    && contents[0] === 0x64 && contents[1] === 0x61
                    && contents[2] === 0x74 && contents[3] === 0x61
                    && contents[4] === 0x3a;

                if(!looksLikeDataUrl){
                    return resolve(this.createFileContentFromBuffer(contents, contentType, path));
                }

                // Decode only the leading slice for the data:image vs data:* check.
                const prefix = FileService._utf8DecoderLenient.decode(contents.subarray(0, Math.min(contents.length, 64)));
                const isImage = prefix.startsWith('data:image');
                const utf8Data = FileService._utf8DecoderLenient.decode(contents);
                const commaIdx = utf8Data.indexOf(Constants.COMMA);
                if(commaIdx < 0){
                    return resolve(this.createFileContentFromBuffer(contents, contentType, path));
                }
                const base64Data = utf8Data.substring(commaIdx + 1);
                const binaryData = Buffer.from(base64Data, 'base64');
                const fileUrl = this.bufferToUrl(binaryData);
                return resolve(this.createFileContent(fileUrl, path, isImage));
            });
        });
    }

    private isDataUrl(utf8Data: string):boolean{
        const dataPrefix = utf8Data.substring(0, 5);
        const isDataUrl = (dataPrefix === 'data:');

        return isDataUrl;
    }

	private createFileContentFromBuffer(buffer: Buffer, contentType: string, path: string): FileContent {
		const fileUrl = this.bufferToUrl(buffer);
		return this.createFileContent(fileUrl, path, contentType === 'image');
	}

	private createFileContent(fileUrl: string,  path: string, isImage: boolean): FileContent {
		const fileName = basename(path, extname(path));
		return isImage
			? this.populateFileContent(fileUrl, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING)
			: this.populateFileContent(Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING);
	}    

    private populateFileContent(iconPath = Constants.EMPTY_STRING, fileName = Constants.EMPTY_STRING, fileType = Constants.EMPTY_STRING, contentPath = Constants.EMPTY_STRING, opensWith = Constants.EMPTY_STRING ):FileContent{
		return{
			iconPath: iconPath, fileName: fileName, fileType: fileType, contentPath: contentPath, opensWith: opensWith
		}
	}

    private populateShortCut(iconPath = Constants.EMPTY_STRING, fileName = Constants.EMPTY_STRING, fileType = Constants.EMPTY_STRING, contentPath = Constants.EMPTY_STRING, opensWith = Constants.EMPTY_STRING ):ShortCut{
		return{
            iconPath:iconPath, fileName:fileName, fileType:fileType, contentPath:contentPath, opensWith:opensWith
        }
	}

    public async getShortCutFromURLAsync(path: string): Promise<ShortCut> {
        await this._initPromise;
        return new Promise<ShortCut>((resolve) => {
            this._fileSystem.readFile(path, (err, contents = Buffer.from(Constants.EMPTY_STRING)) => {
                if (err) {
                    console.error('getShortCutAsync error:', err);
                    return resolve(this.createEmptyShortCut());
                }

                const stage = contents.toString();
                let shortCut;
                try {
                    shortCut = ini.parse(stage) || {
                        InternetShortcut: {
                            FileName: Constants.EMPTY_STRING,
                            IconPath: Constants.EMPTY_STRING,
                            FileType: Constants.EMPTY_STRING,
                            ContentPath: Constants.EMPTY_STRING,
                            OpensWith: Constants.EMPTY_STRING
                        }
                    };
                } catch (parseErr) {
                    console.error('INI parse error:', parseErr);
                    resolve(this.createEmptyShortCut());
                    return;
                }

                if (typeof shortCut === 'object') {
                    const iSCut = shortCut['InternetShortcut'] || {};
                    const fileName = iSCut['FileName'] || Constants.EMPTY_STRING;
                    const iconPath = iSCut['IconPath'] || Constants.EMPTY_STRING;
                    const fileType = iSCut['FileType'] || Constants.EMPTY_STRING;
                    const contentPath = iSCut['ContentPath'] || Constants.EMPTY_STRING;
                    const opensWith = iSCut['OpensWith'] || Constants.EMPTY_STRING;

                    resolve(this.populateShortCut(iconPath, fileName, fileType, contentPath, opensWith));
                } else {
                    resolve(this.createEmptyShortCut());
                }
            });
        });
    }

    private createEmptyShortCut(): ShortCut {
        const empty = Constants.EMPTY_STRING;
        return this.populateShortCut(empty, empty, empty, empty, empty);
    }

    private async changeFolderIcon(fileName:string, iconPath:string, path:string):Promise<string>{
		const iconMaybe = `/Cheetah/System/Imageres/${fileName.toLocaleLowerCase()}_folder.png`;

        if(path === Constants.RECYCLE_BIN_PATH){
            const count = await this.countFolderItems(Constants.RECYCLE_BIN_PATH);
            return (count === 0) 
                ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
                :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
        }

        if(path !== `/Users/${fileName}`)
            return iconPath;

		const result = await this.exists(iconMaybe);
        if(result){ 
            return `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
        }
		return iconPath;
    }

	private async setOtherFolderProps(path:string, isDirectory:boolean):Promise<FileContent>{
        const fileName = basename(path, extname(path));
        let iconFile = Constants.EMPTY_STRING;
        const fileType = Constants.FOLDER;
        const opensWith = Constants.FILE_EXPLORER;

		try{
			//const isDirectory = await this.isDirectory(path);
			if(!isDirectory){
				iconFile= `${Constants.IMAGE_BASE_PATH}unknown.png`;
				return this.populateFileContent(iconFile, fileName, Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING);
			}

			const count = await this.countFolderItems(path);
			if(count === 0){
				iconFile = `${Constants.IMAGE_BASE_PATH}empty_folder.png`;
				return this.populateFileContent(iconFile, fileName, fileType, fileName, opensWith);
			}

			iconFile = `${Constants.IMAGE_BASE_PATH}folder_w_c.png`;
			return this.populateFileContent(iconFile, fileName, fileType, fileName, opensWith);
		}catch (err){
			console.error('setOtherFolderProps:', err)
			return this.populateFileContent(iconFile, fileName, fileType, Constants.EMPTY_STRING, opensWith);
		}
    }

    private async renameDirectoryAsync(srcPath:string, destPath:string):Promise<boolean>{
        const folderToProcessingQueue:FolderMoveQueueItem[] = [];
        const folderToDeleteStack:string[] = [];

        const directoryPath = dirname(srcPath);
        const newName = this.getNameFromPath(destPath);

        const directoryExists = await this.exists(destPath);
        if(directoryExists){
            const title = DialogTitle.FILE_SVC_FOLDER_EXISTS;
            const msg =  DialogMessage.FILE_SVC_FOLDER_EXISTS.replace(DialogMessage.placeholder, newName);
            this._userNotificationService.showErrorNotification(msg, title);
            return false;
        }

        // Create destination folder with the exact user-supplied name (no duplicate-rename retry,
        // because we already verified it does not exist above).
        const createDest = await this.createFolderAsync(directoryPath, newName);
        if(!createDest.ok) return false;

        // Single merged traversal for count + size.
        const stats = await this.traverseFolderAsync(srcPath);
        const dirFilesCount = stats.files;
        const folderSize = stats.size;

        const firstMsg = DialogMessage.FILE_SVC_ESTIMATING;
        const title = DialogTitle.FILE_SVC_MOVING;

        const dialogPId = this.initFileTransfer(firstMsg, title);
        const abortController = new AbortController();
        this._abortControllers.set(dialogPId, abortController);
        const signal = abortController.signal;
        this.sendUpdate(dialogPId);

        const filesMovedCount:FileTransferCount = { fileCount: 0};

        // Contents of srcPath go directly into the newly created destPath (no extra wrapper).
        folderToProcessingQueue.push({ src: srcPath, parentDest: destPath, isRoot: true });

        let isRenameSuccessful = false;
        try {
            isRenameSuccessful = await this.moveHandlerAsync({
                folderToProcessingQueue,
                folderToDeleteStack,
                filesToMoveCount:dirFilesCount,
                dialogPId,
                filesMovedCount,
                currentSize:folderSize,
                signal,
                moveFolderItself: false
            });
        } finally {
            this._abortControllers.delete(dialogPId);
        }

        if(isRenameSuccessful){
            await this.deleteEmptyFolders(folderToDeleteStack);
        }

        // An empty folder (or one containing only empty sub-folders) has 0 files to
        // move, so moveHandlerAsync never emits a per-file progress update and the
        // transfer dialog never receives the 100%-complete signal that auto-closes
        // it. Close it explicitly so it doesn't hang on "Estimating..." forever.
        if(dirFilesCount === 0)
            this._userNotificationService.closeDialogMsgBox(dialogPId);

        return isRenameSuccessful;
    }

    //virtual filesystem, use copy and then delete
    public async moveAsync(srcPath: string, destPath: string, isFile?: boolean, isRecycleBin?: boolean, check?:FileOperationCheck): Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles the file-in-use check
        if(check && this.isFileInUse(check.file.getCurrentPath)){
            await this.showFileInUseNotification(check.file, check.callerUId);
            return false;
        }

        const isDirectory = (isFile === undefined) ? (await this.getStatAsync(srcPath)).isDirectory : !isFile;

        let firstMsg = DialogMessage.FILE_SVC_ESTIMATING;
        let dialogPId = 0;
        const filesMovedCount:FileTransferCount = { fileCount: 0};
        
        if(isDirectory){
            const folderToProcessingQueue:FolderMoveQueueItem[] = [];
            const folderToDeleteStack:string[] = [];

            // Single merged traversal for count + size.
            const stats = await this.traverseFolderAsync(srcPath);
            const dirFilesCount = stats.files;
            const folderSize = stats.size;

            if(destPath === Constants.RECYCLE_BIN_PATH){
                const size = CommonFunctions.getReadableFileSizeValue(folderSize);         
                const sizeUnit  = CommonFunctions.getFileSizeUnit(folderSize);
        
                const title = DialogTitle.FILE_SVC_PREPAIRING_TO_RECYCLE.replace(DialogTitle.placeholder, `from:${basename(srcPath)}`);
                firstMsg = DialogMessage.FILE_SVC_PREPAIRING_TO_RECYCLE
                    .replace(DialogMessage.placeholder, `${dirFilesCount}`)
                    .replace(DialogMessage.placeholder1, `${size}`)
                    .replace(DialogMessage.placeholder2, `${sizeUnit}`);
                    
                dialogPId = this.initDeleteProcess(firstMsg, title);
                this.sendUpdate(dialogPId);
            }else{
                const title = DialogTitle.FILE_SVC_MOVING;
                dialogPId = this.initFileTransfer(firstMsg, title);
                this.sendUpdate(dialogPId);
            }

            const abortController = new AbortController();
            this._abortControllers.set(dialogPId, abortController);
            const signal = abortController.signal;

            // If destPath already exists, move whole tree under it (creating srcName inside it).
            // Otherwise treat destPath as the new target name: create it, then move contents in.
            const destExists = await this.exists(destPath);
            let parentDest: string;
            if(destExists){
                parentDest = destPath;
            } else {
                const createDest = await this.createFolderAsync(dirname(destPath), this.getNameFromPath(destPath));
                if(!createDest.ok){
                    this._abortControllers.delete(dialogPId);
                    return false;
                }
                parentDest = createDest.finalPath;
            }
            folderToProcessingQueue.push({
                src: srcPath,
                parentDest,
                isRoot: true,
            });

            let result = false;
            try {
                result = await this.moveHandlerAsync({
                    folderToProcessingQueue,
                    folderToDeleteStack,
                    filesToMoveCount:dirFilesCount,
                    dialogPId,
                    filesMovedCount,
                    currentSize:folderSize,
                    signal,
                    isRecycleBin,
                    moveFolderItself: destExists,
                });
            } finally {
                this._abortControllers.delete(dialogPId);
            }

            if(result){
                if(isRecycleBin)
                    this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint);
   
                await this.deleteEmptyFolders(folderToDeleteStack);
            }

            // An empty folder (or one containing only empty sub-folders) has 0 files to
            // move, so moveHandlerAsync never emits a per-file progress update and the
            // transfer/delete dialog never receives the 100%-complete signal that
            // auto-closes it. Close it explicitly so it doesn't hang indefinitely.
            if(dirFilesCount === 0)
                this._userNotificationService.closeDialogMsgBox(dialogPId);

            return result;
        }else{
            if(isRecycleBin)
                this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint);

            return await this.moveFileAsync(srcPath, destPath, undefined, isRecycleBin);
        }
    }

    private async moveHandlerAsync(options: FileTransferMoveOptions): Promise<boolean> {
        const { folderToProcessingQueue, folderToDeleteStack, filesToMoveCount, dialogPId,
            filesMovedCount, signal, isRecycleBin = false, moveFolderItself = true } = options;

        const limiter = options.limiter ?? this.createLimiter(this.CONCURRENCY_LIMIT);

        while (folderToProcessingQueue.length > 0) {
            if((dialogPId === this._dialogPIdToCancel) && signal.aborted){
                this._dialogPIdToCancel = 0;
                console.warn("Move operation aborted.");
                return false;
            }

            const item = folderToProcessingQueue.shift()!;
            const { src, parentDest, isRoot } = item;
            folderToDeleteStack.push(src);

            // Determine the directory into which this folder's files/subdirs are placed.
            // For "contents only" mode (rename), the root's contents go directly into parentDest.
            let targetDir: string;
            if (isRoot && !moveFolderItself) {
                targetDir = parentDest;
            } else {
                const folderName = this.getNameFromPath(src);
                const createRes = await this.createFolderAsync(parentDest, folderName);
                if (!createRes.ok) {
                    console.error(`folder:${parentDest}/${folderName} creation failed`);
                    return false;
                }
                targetDir = createRes.finalPath;
            }

            const entries = await this.readDirectory(src);
            const tasks: Promise<boolean>[] = [];

            for (const entry of entries) {
                const fullSrcPath = `${src}/${entry}`;
                if((dialogPId === this._dialogPIdToCancel) && signal.aborted){
                    this._dialogPIdToCancel = 0;
                    console.warn("Move operation aborted.");
                    return false;
                }

                tasks.push(limiter(async () => {
                    const st = await this.getStatAsync(fullSrcPath);
                    if (st.isDirectory) {
                        folderToProcessingQueue.push({ src: fullSrcPath, parentDest: targetDir });
                        return true;
                    }

                    const start = performance.now();
                    const result = await this.moveFileAsync(fullSrcPath, targetDir, undefined, isRecycleBin);
                    const end = performance.now();
                    const duration = end - start;

                    if (result) {
                        filesMovedCount.fileCount++;
                        const itemsRemaining = filesToMoveCount - filesMovedCount.fileCount;
                        const estimatedRemainingTime = duration * itemsRemaining;
                        options.currentSize = Math.max(0, (options.currentSize ?? 0) - st.size);
                        const transferUpdate = this.genFileTransferUpdate(
                            src, targetDir, filesToMoveCount,
                            filesMovedCount.fileCount, estimatedRemainingTime,
                            itemsRemaining, options.currentSize, entry
                        );
                        this.sendFileTransferUpdate(dialogPId, transferUpdate);
                        return true;
                    }
                    console.error(`file:${fullSrcPath} failed to move to destination:${targetDir}`);
                    return false;
                }));
            }

            const results = await Promise.allSettled(tasks);
            const failed = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));
            if (failed) return false;
        }

        return true;
    }

    //virtual filesystem, use copy and then delete.
    private async moveFileAsync(srcPath: string, destPath: string, generatePath?: boolean, isRecycleBin?: boolean): Promise<boolean> {
        let destinationPath = Constants.EMPTY_STRING;
        if (generatePath === undefined || generatePath){
            const fileName = this.getNameFromPath(srcPath);
            destinationPath = CommonFunctions.removeDoubleSlashes(`${destPath}/${fileName}`);
        } else {
            destinationPath = destPath;
        }

        const readResult = await this.readRawAsync(srcPath);
        if(!readResult) return false;

        // For auto-generated dest paths (move into a folder), allow collision retry by
        // appending a counter; for explicit destination paths (rename), fail on collision
        // so the user-requested name is honoured.
        const allowRename = (generatePath === undefined || generatePath);
        let writeResult = await this.writeRawAsync(destinationPath, readResult, 'wx');

        if(writeResult === 1 && allowRename){
            for (let attempt = 0; attempt < this.MAX_DUPLICATE_RETRIES && writeResult === 1; attempt++) {
                destinationPath = CommonFunctions.removeDoubleSlashes(this.IncrementFileName(destinationPath));
                writeResult = await this.writeRawAsync(destinationPath, readResult, 'wx');
            }
        }

        if(writeResult !== 0)
            return false;

        return await this.deleteFileAsync(srcPath);
    }

    //O for success, 1 for file already present, 2 other error
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    private async writeRawAsync(destPath: string, content:any, flag:string = 'wx'): Promise<number>{
        // Normalize binary payloads to a Buffer. BrowserFS.writeFile only reliably
        // persists a string or Buffer; a raw ArrayBuffer (e.g. from fetch/streamed
        // downloads or File.arrayBuffer() uploads) is written as 0 bytes otherwise.
        const writable = this.toWritableContent(content);
        return new Promise((resolve) => {
            this._fileSystem.writeFile(destPath, writable, { flag: flag }, (writeErr) => {
                if(!writeErr){
                    //console.log('Succes writing content');
                    return resolve(0);
                }

                if(writeErr && writeErr?.code === 'EEXIST'){
                    console.warn('file already present:', writeErr)
                    return resolve(1);
                }

                console.error('Error writing file:', writeErr);
                return resolve(2);
            });
        });
    }

    /**
     * Coerce a write payload into something BrowserFS persists correctly.
     * Strings pass through untouched; ArrayBuffers and typed-array views are
     * wrapped in a Buffer (without copying when possible).
     */
    private toWritableContent(content:any):any{
        if(content instanceof ArrayBuffer){
            return Buffer.from(content);
        }
        if(ArrayBuffer.isView(content) && !Buffer.isBuffer(content)){
            const view = content as ArrayBufferView;
            return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
        }
        return content;
    }

    /**
     * handles instances where a file being written alredy exist in a given location.
     * Returns the path that was actually written, which may differ from `destPath` when
     * a duplicate name was encountered and an incremented unique name was used.
     */
    private async writeRawHandlerAsync(destPath:string, cntnt:any):Promise<{ ok: boolean; finalPath: string }>{
        const writeResult = await this.writeRawAsync(destPath, cntnt, 'wx');
        if(writeResult === 0){
            this._fileExistsMap.set(destPath, String(0));
            this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
            return { ok: true, finalPath: destPath };
        }

        if(writeResult === 1){
            for (let attempt = 0; attempt < this.MAX_DUPLICATE_RETRIES; attempt++) {
                const newFileName = CommonFunctions.removeDoubleSlashes(this.IncrementFileName(destPath));
                const writeRetry = await this.writeRawAsync(newFileName, cntnt, 'wx');

                if(writeRetry === 0){
                    this._fileExistsMap.set(newFileName, String(0));
                    this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                    return { ok: true, finalPath: newFileName };
                }

                if (writeRetry !== 1) {
                    console.error(`writeRawHandlerAsync: unexpected error on retry ${attempt + 1}`);
                    return { ok: false, finalPath: destPath };
                }
            }

            console.error(`writeRawHandlerAsync: exceeded ${this.MAX_DUPLICATE_RETRIES} retries`);
            return { ok: false, finalPath: destPath };
        }

        return { ok: false, finalPath: destPath };
    }

    public async writeFilesAsync(directory: string, files: File[]): Promise<boolean> {
        // Use file.arrayBuffer() (native streaming) instead of FileReader.readAsDataURL
        // and process uploads in bounded parallel for substantial speedup with many files.
        const limiter = this.createLimiter(this.CONCURRENCY_LIMIT);
        const results = await Promise.all(files.map(file => limiter(async () => {
            try {
                const buffer = await file.arrayBuffer();
                const newFile: FileInfo = new FileInfo();
                newFile.setFileName = file.name;
                newFile.setContentBuffer = buffer;
                newFile.setCurrentPath = `${this.pathCorrection(directory)}/${file.name}`;
                return await this.writeFileAsync(directory, newFile);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                return false;
            }
        })));
        return results.every(r => r === true);
    }

    /**
     * Writes a file to the specified path. If a requestId is provided, the file's final path
     * will be stored in the `_newFileOrFolderNameMap` for later retrieval. The method ensures that
     * if a file with the same name already exists, a unique name will be generated to avoid overwriting.
     * @param path 
     * @param file 
     * @param requestId 
     * @returns 
     */
    public async writeFileAsync(path:string, file:FileInfo, requestId: string=Constants.EMPTY_STRING):Promise<boolean>{
        const cntnt = (file.getStringBuffer === Constants.EMPTY_STRING)
            ? file.getContentBuffer 
            : file.getStringBuffer;

        const destPath = CommonFunctions.removeDoubleSlashes(`${this.pathCorrection(path)}/${file.getFileName}`);

        const writeRes = await this.writeRawHandlerAsync(destPath, cntnt);
        if(writeRes.ok){
            // Best-effort: indexer may not be ready on very early writes
            // (e.g. a screenshot save fired before BrowserFS post-init has
            // resolved FileIndexerService.instance).
            if(requestId !== Constants.EMPTY_STRING){
                console.log(`writeFileAsync: storing final path for requestId ${requestId}: ${writeRes.finalPath}`);
                console.log(`writeFileAsync: storing final basename for requestId ${requestId}: ${basename(writeRes.finalPath)}`);
                this._newFileOrFolderNameMap.set(requestId, basename(writeRes.finalPath));
            }
            await this.fileIndexer?.addNotify(writeRes.finalPath, true);
            // Incremental storage update — avoid full drive rescan. Only applied
            // once a baseline exists (see getUsedStorageAsync); otherwise the
            // next lazy read recomputes the total from scratch.
            const meta = await this.getStatAsync(writeRes.finalPath);
            if(meta.exists && this._isCalculated) this._usedStorageSizeInBytes += meta.size;
        }

        return writeRes.ok;
    }

    /**
     * Overwrites the contents of an existing file at `path`. Unlike
     * `writeFileAsync`, this does not generate a unique name when the file
     * already exists — the existing file is replaced in place. The path
     * is treated as the full destination (directory + filename).
     *
     * Returns false if the destination doesn't exist or points to a directory.
     */
    public async updateFileAsync(file:FileInfo):Promise<boolean>{
        const cntnt = (file.getStringBuffer === Constants.EMPTY_STRING)
            ? file.getContentBuffer 
            : file.getStringBuffer;

        //check if the file is a shotrcut file, if so, 
        // we need to use the content path as the destination path to update the content.
        const destPath = (file.getCurrentPath.endsWith(Constants.URL))
            ? file.getContentPath
            : file.getCurrentPath;

        const beforeMeta = await this.getStatAsync(destPath);
        if(!beforeMeta.exists || beforeMeta.isDirectory){
            console.error(`updateFileAsync: target does not exist or is a directory: ${destPath}`);
            return false;
        }
        const oldSize = beforeMeta.size;

        const writeResult = await this.writeRawAsync(destPath, cntnt, 'w');
        if(writeResult !== 0){
            return false;
        }

        // Incremental storage delta — avoid full drive rescan. Only applied once
        // a baseline exists (see getUsedStorageAsync); otherwise the next lazy
        // read recomputes the total from scratch.
        const afterMeta = await this.getStatAsync(destPath);
        if(afterMeta.exists && this._isCalculated){
            this._usedStorageSizeInBytes += (afterMeta.size - oldSize);
        }

        return true;
    }

    public async renameAsync(path:string, newFileName:string, isFile?:boolean, check?:FileOperationCheck): Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles the file-in-use check
        if(check && this.isFileInUse(check.file.getCurrentPath)){
            await this.showFileInUseNotification(check.file, check.callerUId);
            return false;
        }

        const rename = CommonFunctions.removeDoubleSlashes(`${dirname(path)}/${newFileName}`);
        const isDirectory = (isFile === undefined) ? (await this.getStatAsync(path)).isDirectory : !isFile;

        return isDirectory
            ? await this.renameDirectoryAsync(path, rename)
            : await this.renameFileAsync(path, newFileName);
    }

    private async renameFileAsync(path:string, newFileName:string): Promise<boolean> {
        const fileExt = extname(path);
        if(fileExt === Constants.URL){
            // special case
            return await this.renameURLFiles(path, newFileName);
        }else{
            const newPath = CommonFunctions.removeDoubleSlashes(`${dirname(path)}/${newFileName}${extname(path)}`);
            return await this.moveFileAsync(path, newPath, false);
        }
    }

    private async renameURLFiles(srcPath:string, fileName:string): Promise<boolean> {

        const destPath = dirname(srcPath);
        const shortCutData = await this.getShortCutFromURLAsync(srcPath) as ShortCut;
        if(!shortCutData){
            console.warn('renameURLFiles: No shortcut data found for', srcPath);
            return false;
        }
      const shortCutContent = `[InternetShortcut]
FileName=${fileName}
IconPath=${shortCutData.iconPath}
FileType=${shortCutData.fileType}
ContentPath=${shortCutData.contentPath}
OpensWith=${shortCutData.opensWith}
`;
        const shortCut:FileInfo = new FileInfo();
        shortCut.setStringBuffer = shortCutContent;
        shortCut.setFileName= `${fileName}${Constants.URL}`;

        const writeResult = await this.writeFileAsync(destPath, shortCut);
        if(!writeResult){
            console.error('renameURLFiles: Failed to write shortcut to', destPath);
            return false;
        }

        return await this.deleteFileAsync(srcPath);
    }

    public async deleteAsync(path:string, isFile:boolean, isAlreadyInRecycleBin:boolean = false, check?:FileOperationCheck):Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles confirm-delete and file-in-use checks
        // is file or folder not currently in the bin, move it to the bin if option is allow, or delete it right away

        if(check){
            if(!check.skipConfirmDialog && this.getConfirmDeleteState()){
                const confirmed = await this.showDeleteConfirmation(check.file, check.callerUId);
                if(!confirmed) return false;
            }

            if(this.isFileInUse(check.file.getCurrentPath)){
                await this.showFileInUseNotification(check.file, check.callerUId);
                return false;
            }
        }

        if(isAlreadyInRecycleBin){
            return await this.deleteFolderHandlerAsync(path, isAlreadyInRecycleBin);
        }

        if(!path.includes(Constants.RECYCLE_BIN_PATH) && this.getMoveToRecycleBinState()){
            const name = this.getNameFromPath(path);

            // Move first — only update map/session on success.
            // DecrementFileName is already called inside moveAsync → deleteFileAsync,
            // so calling it here would cause a double-decrement bug.
            const moveResult = await this.moveAsync(path, Constants.RECYCLE_BIN_PATH, isFile);
            if (moveResult) {
                this._restorePoint.set(`${Constants.RECYCLE_BIN_PATH}/${name}`, path);
                this.addAndUpdateSessionData(this.fileServiceRestoreKey, this._restorePoint);
                this.persistIterateMapToSession();
            }
            return moveResult;
        }else{
            this.removeAndUpdateSessionData(this.fileServiceRestoreKey, path, this._restorePoint);
            // const isDirectory = (isFile === undefined) ? await this.isDirectory(path) : !isFile;
            const isDirectory = !isFile;
            const result = isDirectory
                ? await this.deleteFolderHandlerAsync(path, isAlreadyInRecycleBin)
                : await this.deleteFileAsync(path);

            await this.recalculateUsedStorage();
            return result;
        }
    }

    private async deleteFolderAsync(path:string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.rmdir(path, (err)=>{
                if(err){
                    console.error('deleteFolderAsync: Folder delete failed:', err);
                    return resolve(false);
                }

                this.DecrementFileName(path);
                this.removeAndUpdateSessionData(this.fileServiceIterateKey, path, this._fileExistsMap);
                // console.log(`deleteFolderAsync: Folder deleted successfully: ${path}`);
                return resolve(true);
            });
        });
    }

    private async deleteFileAsync(srcPath: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.unlink(srcPath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('[unlink] Error deleting file:', unlinkErr);
                    return resolve(false);
                }

                this.DecrementFileName(srcPath);
                this.removeAndUpdateSessionData(this.fileServiceIterateKey, srcPath, this._fileExistsMap);
                //console.log('[unlink] Success, applying short delay...');
                resolve(true);
            });
        });
    }

    private async deleteFolderHandlerAsync(srcPath: string, isAlreadyInRecycleBin?:boolean): Promise<boolean> {
        const loadedDirectoryEntries = await this.readDirectory(srcPath);
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${srcPath}/${directoryEntry}`;
            this.removeAndUpdateSessionData(this.fileServiceRestoreKey, entryPath, this._restorePoint);

            const checkIfDirectory = await this.getStatAsync(entryPath);
            if(checkIfDirectory.isDirectory){
                // Recursively call the rm_dir_handler for the subdirectory
                const success = await this.deleteFolderHandlerAsync(entryPath);
                if(!success){
                    console.error(`Failed to delete directory: ${entryPath}`);
                    return false;
                }
            } else {
                const result = await this.deleteFileAsync(entryPath);
                if(result){
                    // console.log(`File: ${directoryEntry} in ${entryPath} deleted successfully`);
                }else{
                    console.error(`File: ${directoryEntry} in ${entryPath} failed deletion`);
                    return false;
                }
            }
        }
    

        if(srcPath === Constants.RECYCLE_BIN_PATH && isAlreadyInRecycleBin)
            return true;
        // Delete the current directory after all its contents have been deleted
        // console.log(`folder to delete: ${sourceArg}`);
        const result = await this.deleteFolderAsync(srcPath);
        if(result){
            // console.log(`Directory: ${sourceArg} deleted successfully`);
            return true;
        }else{
            console.error(`Failed to delete directory: ${srcPath}`);
            return false;
        }
    }

    private async deleteEmptyFolders(folders:string[]):Promise<void>{
        while(folders.length > 0){
            const path = folders.pop();
            if(path){
                await this.deleteFolderAsync(path);                    
            }
        }
    }

    getMoveToRecycleBinState():boolean{
        const confirmationState = this._defaultService.getDefaultSetting(Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE);
        return confirmationState === Constants.TRUE;
    }

    getConfirmDeleteState():boolean{
        const confirmationState = this._defaultService.getDefaultSetting(Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG);
        return confirmationState === Constants.TRUE;
    }

    isFileInUse(filePath:string):boolean{
        const processes = this._runningProcessService.getProcesses();
        return processes.some(process => {
            const trigger = process.getProcessTrigger as FileInfo;
            const triggerPath = trigger?.getCurrentPath;
            if(!triggerPath) return false;
            // Exact match or descendant of filePath (avoid substring false positives like /foo matching /foobar)
            return triggerPath === filePath || triggerPath.startsWith(filePath + Constants.ROOT);
        });
    }

    async showDeleteConfirmation(file:FileInfo, callerUId:string = Constants.EMPTY_STRING):Promise<boolean>{
        let msg = Constants.EMPTY_STRING;

        //if the file is not currently in the recycle bin and the option to move to recycle bin is not enabled, 
        //we will show a different message to the user to confirm permanent deletion right away instead of moving to the recycle bin first.
        //  If the file is already in the recycle bin, we will show a message to confirm permanent deletion as well.
        
        // if(!this.getMoveToRecycleBinState() && !file.getCurrentPath.includes(Constants.RECYCLE_BIN_PATH)){

        // }

        if((file.getCurrentPath.includes(Constants.RECYCLE_BIN_PATH))) { // is file or folder already in them recycle bin
            msg = (file.getIsFile) 
            ? DialogMessage.FILE_SVC_PERMANENTLY_DELETE_FILE
            : DialogMessage.FILE_SVC_PERMANENTLY_DELETE_FOLDER;
        }
        else{
            msg = (file.getIsFile) 
            ? DialogMessage.FILE_SVC_MOVE_FILE_TO_RECYCLE_BIN
            : DialogMessage.FILE_SVC_MOVE_FOLDER_TO_RECYCLE_BIN;
        }

        const title = (file.getIsFile && file.getFileType === Constants.URL)
            ? DialogTitle.FILE_SVC_DELETE_SHORTCUT
            : `${file.getIsFile ? DialogTitle.FILE_SVC_FILE : DialogTitle.FILE_SVC_FOLDER}`;

        return await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.DeleteWarning, file, callerUId);
    }

    async showFileInUseNotification(file:FileInfo, callerUId:string = Constants.EMPTY_STRING):Promise<boolean>{
        const isDir = !file.getIsFile;
        const title = isDir 
            ? DialogTitle.FILE_SVC_FOLDER_IN_USE 
            : DialogTitle.FILE_SVC_FILE_IN_USE;

        const msg = isDir
            ? DialogMessage.FILE_SVC_FOLDER_IN_USE
            : DialogMessage.FILE_SVC_FILE_IN_USE;

        await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.InUseWarning, file, callerUId);
        return false;
    }

    public  async countFolderItems(path:string): Promise<number> {
        return new Promise<number>((resolve) =>{
            this._fileSystem.readdir(path, (readDirErr, files) =>{
                if(readDirErr){
                    console.error('Error reading dir for count:', readDirErr);
                    return resolve(0);
                }
                return resolve(files?.length || 0);
            });
        });
    }

    public  async getFullCountOfFolderItems(path:string): Promise<string> {
        const stats = await this.traverseFolderAsync(path);
        return `${stats.files} Files, ${stats.folders} Folders`;
    }

    private  async getFullCountOfFolderItemsInt(path:string): Promise<{files: number; folders: number;}> {
        const stats = await this.traverseFolderAsync(path);
        return { files: stats.files, folders: stats.folders };
    }

    public  async getFolderSizeAsync(path:string):Promise<number>{
        const stats = await this.traverseFolderAsync(path);
        return stats.size;
    }

    /**
     * Walks a folder tree exactly once and returns the aggregate stats. Combines what
     * used to be three separate traversals (count, count-int, size) and uses a single
     * `stat` per entry plus parallel sibling traversal for major speedup on large trees.
     */
    private async traverseFolderAsync(path:string):Promise<{files:number; folders:number; size:number;}>{
        const counts = { files: 0, folders: 0, size: 0 };

        // NOTE: do NOT route recursion through a bounded `createLimiter`.
        // A parent task holding a slot while awaiting child tasks that also
        // need slots will deadlock once the recursion depth reaches the
        // concurrency limit. Stat calls are cheap; unbounded `Promise.all`
        // is safe here because the underlying BrowserFS queue serializes I/O.
        const visit = async (p: string): Promise<void> => {
            const entries = await this.readDirectory(p);
            const entryStats = await Promise.all(entries.map(async entry => {
                const entryPath = `${p}/${entry}`;
                const st = await this.getStatAsync(entryPath);
                return { entryPath, st };
            }));

            const subDirs: string[] = [];
            for(const { entryPath, st } of entryStats){
                if(!st.exists) continue;
                if(st.isDirectory){
                    counts.folders++;
                    counts.size += st.size;
                    subDirs.push(entryPath);
                }else{
                    counts.files++;
                    counts.size += st.size;
                }
            }

            // Recurse OUTSIDE any limiter slot (parents don't hold capacity).
            await Promise.all(subDirs.map(d => visit(d)));
        };

        const rootStat = await this.getStatAsync(path);
        if(!rootStat.exists){
            return counts;
        }

        if(rootStat.isDirectory){
            // Root folder itself is not counted in `folders`; its size is added.
            counts.size += rootStat.size;
            await visit(path);
        }else{
            counts.files = 1;
            counts.size = rootStat.size;
        }

        return counts;
    }

    /**
     * Returns a simple async semaphore that caps the number of concurrent in-flight
     * tasks. Used across the whole tree-walk so recursive calls share the budget.
     */
    private createLimiter(maxConcurrent: number) {
        let active = 0;
        const queue: Array<() => void> = [];
        const next = () => {
            if(active >= maxConcurrent) return;
            const run = queue.shift();
            if(run){ active++; run(); }
        };
        return <T>(fn: () => Promise<T>): Promise<T> => {
            return new Promise<T>((resolve, reject) => {
                queue.push(() => {
                    fn().then(v => { resolve(v); active--; next(); },
                              e => { reject(e); active--; next(); });
                });
                next();
            });
        };
    }

    /**
     * Compresses a file or folder into a .cab archive and writes it alongside the source.
     * @param srcPath  Full virtual-filesystem path of the file or folder to zip.
     * @param isDirectory  true when srcPath points to a folder.
     * @returns true when the archive was created successfully.
     */
    public async zipEntityAsync(srcPath: string, isDirectory: boolean): Promise<boolean> {
        try {
            const directory = dirname(srcPath);
            const zipFileName = this.changeExtToZip(this.getNameFromPath(srcPath));
            const zipFilePath = `${directory}/${zipFileName}`;

            const zippable: Record<string, Uint8Array> = {};
            const result = isDirectory
                ? await this.collectFolderForZip(srcPath, Constants.EMPTY_STRING, zippable)
                : await this.collectFileForZip(srcPath, Constants.EMPTY_STRING, zippable);

            if (!result) return false;

            const zipped = zipSync(zippable, { level: 6 });
            // Use 'w' (overwrite) instead of the default 'wx' so re-zipping a
            // folder, or zipping when a same-named archive already exists,
            // doesn't silently fail with EEXIST.
            const writeResult = await this.writeRawAsync(zipFilePath, Buffer.from(zipped), 'w');

            if (writeResult === 0) {
                // Keep the search/file index in sync — writeRawAsync bypasses
                // the addNotify path that writeFileAsync uses.
                await this.fileIndexer?.addNotify(zipFilePath, true);
                await this.recalculateUsedStorage();
                return true;
            }
            return false;
        } catch (err) {
            console.error('zipEntityAsync error:', err);
            return false;
        }
    }

    private changeExtToZip(filename: string): string {
        const lastDotIndex = filename.lastIndexOf(Constants.DOT);
        return lastDotIndex === -1
            ? `${filename}.zip`
            : `${filename.slice(0, lastDotIndex)}.zip`;
    }

    /**
     * Reads a single file and adds it to the zippable record.
     * Media files stored as data-URLs are decoded from base64 back to binary.
     * @param srcPath  Full virtual path of the file.
     * @param prefix   Relative directory prefix inside the archive (empty for root).
     * @param out      Accumulator record that fflate's zipSync will consume.
     */
    private async collectFileForZip(srcPath: string, prefix: string, out: Record<string, Uint8Array>): Promise<boolean> {
        const contents = await this.readRawAsync(srcPath);
        if (!contents) return false;

        const fileName = this.getNameFromPath(srcPath);
        const key = prefix ? `${prefix}/${fileName}` : fileName;
        const extension = extname(srcPath);

        // Media files may be stored as base64 data-URLs; decode them back to binary
        if (Constants.AUDIO_FILE_EXTENSIONS.includes(extension) ||
            Constants.IMAGE_FILE_EXTENSIONS.includes(extension) ||
            Constants.VIDEO_FILE_EXTENSIONS.includes(extension)) {

            const utf8Data = new TextDecoder('utf-8').decode(contents);
            if (this.isDataUrl(utf8Data)) {
                const raw = atob(utf8Data.split(Constants.COMMA)[1]);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                out[key] = bytes;
            } else {
                out[key] = new Uint8Array(contents);
            }
        } else {
            out[key] = new Uint8Array(contents);
        }

        return true;
    }

    /**
     * Recursively collects every file inside a folder tree into a flat
     * `Record<string, Uint8Array>` keyed by relative path, ready for fflate's `zipSync`.
     */
    private async collectFolderForZip(srcPath: string, prefix: string, out: Record<string, Uint8Array>): Promise<boolean> {
        const entries = await this.readDirectory(srcPath);
        const folderName = this.getNameFromPath(srcPath);
        const currentPrefix = prefix ? `${prefix}/${folderName}` : folderName;

        for (const entry of entries) {
            const entryPath = `${srcPath}/${entry}`;
            const isDir = await this.getStatAsync(entryPath);

            if (isDir.isDirectory) {
                const success = await this.collectFolderForZip(entryPath, currentPrefix, out);
                if (!success) {
                    console.error(`Failed to collect directory for zip: ${entryPath}`);
                    return false;
                }
            } else {
                const success = await this.collectFileForZip(entryPath, currentPrefix, out);
                if (!success) {
                    console.error(`Failed to collect file for zip: ${entryPath}`);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Extracts a .cab / .zip archive into the same directory, creating a folder
     * named after the archive (minus extension).
     * @param srcPath  Full virtual-filesystem path of the archive.
     * @returns true when extraction completed successfully.
     */
    public async unzipEntityAsync(srcPath: string, destPath: string = Constants.EMPTY_STRING): Promise<boolean> {
        try {
            const zipBuffer = await this.readRawAsync(srcPath);
            if (!zipBuffer) {
                console.error('unzipEntityAsync: could not read archive:', srcPath);
                return false;
            }

            const decompressed = unzipSync(new Uint8Array(zipBuffer));
            const parentDir = dirname(destPath || srcPath);
            const folderName = basename(srcPath, extname(srcPath));

            // Create root extraction folder
            const createResult = await this.createFolderAsync(parentDir, folderName);
            if (!createResult.ok) {
                console.error('unzipEntityAsync: could not create extraction folder');
                return false;
            }

            const extractionRoot = createResult.finalPath;

            // Dedupe parent directories so each unique path is created only once
            // (avoids N redundant exists/mkdir round-trips).
            const dirsToCreate = new Set<string>();
            for (const relativePath of Object.keys(decompressed)) {
                if (relativePath.endsWith(Constants.ROOT)) {
                    dirsToCreate.add(`${extractionRoot}/${relativePath.slice(0, -1)}`);
                } else {
                    const entryDir = dirname(`${extractionRoot}/${relativePath}`);
                    if(entryDir && entryDir !== extractionRoot) dirsToCreate.add(entryDir);
                }
            }
            // Sort by depth so parents are created before children.
            const sortedDirs = Array.from(dirsToCreate).sort((a, b) => a.length - b.length);
            for (const dir of sortedDirs) {
                const ok = await this.createNestedFolders(dir);
                if(!ok){
                    console.error('unzipEntityAsync: failed to create directory', dir);
                    return false;
                }
            }

            // Write files in parallel.
            const limiter = this.createLimiter(this.CONCURRENCY_LIMIT);
            const fileEntries = Object.entries(decompressed).filter(([rel]) => !rel.endsWith(Constants.ROOT));
            const writeResults = await Promise.all(fileEntries.map(([relativePath, data]) => limiter(async () => {
                const filePath = `${extractionRoot}/${relativePath}`;
                const writeResult = await this.writeRawAsync(filePath, Buffer.from(data));
                if (writeResult !== 0) {
                    console.error(`unzipEntityAsync: failed to write: ${filePath}`);
                    return false;
                }
                return true;
            })));

            if(writeResults.some(r => !r)) return false;

            await this.recalculateUsedStorage();
            return true;
        } catch (err) {
            console.error('unzipEntityAsync error:', err);
            return false;
        }
    }

    /**
     * Mounts a zip/cab archive as a read-only virtual folder using BrowserFS ZipFS.
     * The archive becomes browsable at its own path (e.g. navigating into
     * `/Users/Documents/Flash-Games.zip` lists the archive contents as a directory).
     * @param srcPath  Full virtual-filesystem path of the archive.
     * @returns The mount point path, or empty string on failure.
     */
    public async mountZipAsync(srcPath: string): Promise<string> {
        try {
            const zipBuffer = await this.readRawAsync(srcPath);
            if (!zipBuffer) {
                console.error('mountZipAsync: could not read archive:', srcPath);
                return Constants.EMPTY_STRING;
            }

            const archiveName = basename(srcPath, extname(srcPath));
            // Mount at the archive's own path so it behaves like a folder
            // without creating a separate directory that looks like an extraction.
            const mountPoint = srcPath;

            // Prevent double-mount
            if (this._mountedZips.has(mountPoint)) {
                console.warn('mountZipAsync: already mounted at', mountPoint);
                return mountPoint;
            }

            const rootFS = this._fileSystem.getRootFS() as any;
            if (!rootFS || typeof rootFS.mount !== 'function') {
                console.error('mountZipAsync: root FS is not a MountableFileSystem');
                return Constants.EMPTY_STRING;
            }

            return new Promise<string>((resolve) => {
                BrowserFS.FileSystem.ZipFS.Create({ zipData: Buffer.from(zipBuffer), name: archiveName }, (err: any, zipFs: any) => {
                    if (err || !zipFs) {
                        console.error('mountZipAsync: ZipFS.Create failed:', err);
                        resolve(Constants.EMPTY_STRING);
                        return;
                    }

                    try {
                        rootFS.mount(mountPoint, zipFs);
                        this._mountedZips.set(mountPoint, srcPath);
                        resolve(mountPoint);
                    } catch (mountErr) {
                        console.error('mountZipAsync: mount failed:', mountErr);
                        resolve(Constants.EMPTY_STRING);
                    }
                });
            });
        } catch (err) {
            console.error('mountZipAsync error:', err);
            return Constants.EMPTY_STRING;
        }
    }

    /**
     * Unmounts a previously mounted zip archive.
     * @param mountPoint  The mount point returned by mountZipAsync.
     * @returns true if unmounted successfully.
     */
    public unmountZip(mountPoint: string): boolean {
        try {
            if (!this._mountedZips.has(mountPoint)) {
                console.warn('unmountZip: not mounted:', mountPoint);
                return false;
            }

            const rootFS = this._fileSystem.getRootFS() as any;
            if (!rootFS || typeof rootFS.umount !== 'function') {
                console.error('unmountZip: root FS is not a MountableFileSystem');
                return false;
            }

            rootFS.umount(mountPoint);
            this._mountedZips.delete(mountPoint);
            return true;
        } catch (err) {
            console.error('unmountZip error:', err);
            return false;
        }
    }

    /**
     * Returns true when the given mount point has a zip archive mounted.
     */
    public isZipMounted(mountPoint: string): boolean {
        return this._mountedZips.has(mountPoint);
    }

    /**
     * Returns the mount point if the given path falls inside (or equals)
     * any currently mounted zip archive. Otherwise returns empty string.
     */
    public findMountPointForPath(path: string): string {
        // Choose the longest matching mount point so nested mounts resolve to the deepest one.
        let best = Constants.EMPTY_STRING;
        for (const mountPoint of this._mountedZips.keys()) {
            if (path === mountPoint || path.startsWith(mountPoint + Constants.ROOT)) {
                if(mountPoint.length > best.length) best = mountPoint;
            }
        }
        return best;
    }

    /**
     * Recursively creates folders for a given path if they don't already exist.
     * e.g. "/a/b/c/d" will create /a, /a/b, /a/b/c, /a/b/c/d as needed.
     */
    private async createNestedFolders(folderPath: string): Promise<boolean> {
        const parts = folderPath.split(Constants.ROOT).filter(p => p.length > 0);
        let current = Constants.EMPTY_STRING;

        for (const part of parts) {
            current = `${current}${Constants.ROOT}${part}`;
            const exists = await this.exists(current);
            if (!exists) {
                const result = await this.createFolderRawAsync(current);
                if (result === 2) { // error (not "already exists")
                    console.error(`createNestedFolders: failed to create ${current}`);
                    return false;
                }
            }
        }
        return true;
    }


    /**To Be Deleted */
    public resetDirectoryFiles():void{
        //
    }

    public getFolderOrigin(path:string):string{
        if(this._restorePoint.has(path)){
            return this._restorePoint.get(path) ?? Constants.EMPTY_STRING;
        }
        return Constants.EMPTY_STRING;
    }

    /**
     * If a file/folder already exists, generates a unique name by appending a counter.
     * e.g. simple.txt → simple (1).txt → simple (2).txt
     *
     * The counter is tracked per original path in `_fileExistsMap`.
     * @param path - The original file or folder path.
     * @returns The new unique path with an incremented counter suffix.
     */
    private IncrementFileName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = Number(this._fileExistsMap.get(path) ?? 0);
        if (isNaN(count) || count < 0) count = 0;
        count += 1;
        this._fileExistsMap.set(path, String(count));

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }

    /**
     * Decrements the duplicate counter for a file/folder path.
     * If the path is a generated duplicate (e.g. "name (2).txt"), the counter
     * on the original base path ("name.txt") is decremented instead, and the
     * generated entry is cleaned up.
     * @param path - The file or folder path being removed.
     */
    private DecrementFileName(path:string):void{
        // Resolve the base path only if this is a generated duplicate the map knows about.
        // Avoids false positives on legitimate user-named files like "Report (2).txt".
        const originalPath = this.getOriginalPathFromGenerated(path);
        const targetPath = (originalPath && this._fileExistsMap.has(originalPath))
            ? originalPath
            : path;

        let count = Number(this._fileExistsMap.get(targetPath) ?? 0);
        if (isNaN(count)) count = 0;

        if(count > 0){
            count -= 1;
            this._fileExistsMap.set(targetPath, String(count));
        }else{
            this._fileExistsMap.delete(targetPath);
        }

        // Also clean up the generated path's own entry if it differs from the target
        if(targetPath !== path && this._fileExistsMap.has(path)){
            this._fileExistsMap.delete(path);
        }
    }

    /**
     * Extracts the original (non-generated) path from a duplicate filename.
     * e.g. "/dir/name (2).txt" → "/dir/name.txt",  "/dir/Folder (1)" → "/dir/Folder"
     * @returns The original path, or null if the path does not match the generated pattern.
     */
    private getOriginalPathFromGenerated(path: string): string | null {
        const extension = extname(path);
        const filename = basename(path, extension);
        const match = filename.match(/^(.+)\s\(\d+\)$/);
        if (!match) return null;
        return `${dirname(path)}/${match[1]}${extension}`;
    }

    private addAppAssociaton(appname:string, img:string, isFile:boolean):void{
        if(!this._fileAndAppIconAssociation.get(appname)){
            if(isFile){
                if(appname === 'photoviewer' || appname === 'videoplayer' || appname === 'audioplayer' || appname === 'ruffle'){
                    this._fileAndAppIconAssociation.set(appname,`${Constants.IMAGE_BASE_PATH}${appname}.png`);
                }else{
                    this._fileAndAppIconAssociation.set(appname, img);
                }
            }else
                this._fileAndAppIconAssociation.set(Constants.FILE_EXPLORER, `${Constants.IMAGE_BASE_PATH}file_explorer.png`);  
        }
    }

    /**
     * Retrieves the icon path associated with a given application name.
     * by default, it first checks the `_fileAndAppIconAssociation` map. If not found, it falls back to the `_appDirectory` service to get the app icon.
     * @param appname The name of the application.
     * @returns The icon path, or an empty string if not found.
     */
    public getAppAssociaton(appname:string):string{
        //return this._fileAndAppIconAssociation.get(appname) || Constants.EMPTY_STRING;
        return  this._fileAndAppIconAssociation.get(appname) || this._appDirectory.getAppIcon(appname); 
    }

    /**
     * Retrieves and removes the folder name associated with a given request ID.
     * @param requestId The request ID.
     * @returns The folder name, or an empty string if not found.
     */
    public getFileOrFolderNameByRequestId(requestId: string): string {
        if(this._newFileOrFolderNameMap.has(requestId)) {
            const folderName = this._newFileOrFolderNameMap.get(requestId) || Constants.EMPTY_STRING;
            this._newFileOrFolderNameMap.delete(requestId);
            return folderName;
        }
        
        return Constants.EMPTY_STRING;
    }

    /**
     * sanitizes a path by removing any trailing slashes, ensuring consistent formatting.
     * @param path The path to sanitize.
     * @returns The sanitized path.
     */
    private pathCorrection(path:string):string{
        if(path.slice(-1) === Constants.ROOT)
            return path.slice(0, -1);
        else
            return path;
    }

    private bufferToUrl(buffer:Buffer | Uint8Array):string{
       return URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
    }

    getUsedStorage():number{
        return this._usedStorageSizeInBytes;
    }

    /**
     * Lazily returns total drive usage in bytes. The first call performs the
     * one-time full-drive walk (deferred off the boot path); subsequent calls
     * return the cached value kept current incrementally by
     * write/copy/update/delete operations. Used by the Settings storage pane
     * and the drive Properties dialog.
     */
    async getUsedStorageAsync():Promise<number>{
        await this.calculateUsedStorage(); // self-guarded: walks the drive once
        return this._usedStorageSizeInBytes;
    }

    private async calculateUsedStorage():Promise<void>{
        if(this._isCalculated) return;

        this._usedStorageSizeInBytes = await this.getFolderSizeAsync(Constants.ROOT);
        this._isCalculated = true;
    }

    private async recalculateUsedStorage():Promise<void>{
        // Stay lazy until a baseline has actually been requested. Pre-baseline we
        // skip the expensive full-drive rewalk entirely; the next
        // getUsedStorageAsync() computes a fresh, correct value. Post-baseline
        // behavior is unchanged (full recompute after delete/zip/unzip).
        if(!this._isCalculated) return;
        this._usedStorageSizeInBytes = await this.getFolderSizeAsync(Constants.ROOT);
    }

    private isUtf8Encoded(data: Buffer | Uint8Array): boolean {
        try {
          FileService._utf8Decoder.decode(data);
          return true;
        } catch {
          return false;
        }
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    getEventOriginator():string{
        return this._eventOriginator;
    }

    removeEventOriginator():void{
        this._eventOriginator = Constants.EMPTY_STRING;
    }

    addDragAndDropFile(file:FileInfo):void{
        if(!this._fileDragAndDrop.some(x => x.getFileName === file.getFileName))
            this._fileDragAndDrop.push(file);
    }

    getDragAndDropFile():FileInfo[]{
        const result:FileInfo[] = [];
        result.push(...this._fileDragAndDrop);
        this.removeDragAndDropFile()

        return result;
    }

    removeDragAndDropFile():void{
        this._fileDragAndDrop = [];
    }

    private terminateTransfer(pId: number): void {
        const controller = this._abortControllers.get(pId);
        controller?.abort();
    }

    private pIdToTerminate(pId:number):void{
        this._dialogPIdToCancel = pId;
    }

    private genFileTransferUpdate(srcPath:string, destPath:string, fileCount:number, copiedFiles:number, timeRemaining:number, itemsRemaining:number, itemsRemainingSize:number, fileName:string):FileTransferUpdate{
        return{
            srcPath,
            destPath,
            totalNumberOfFiles: fileCount,
            numberOfFilesCopied: copiedFiles,
            timeRemaining,
            itemsRemaining,
            itemsRemainingSize,
            fileName
        };
    }

    private initDeleteProcess(firstMsg:string, title:string):number{
        this._userNotificationService.showFileTransferNotification(firstMsg, title, UserNotificationType.FileDeleteProgress);
        return this._userNotificationService.getDialogPId();
    }

    private initFileTransfer(firstMsg:string, title:string):number{
        this._userNotificationService.showFileTransferNotification(firstMsg, title);
        return this._userNotificationService.getDialogPId();
    }

    private sendUpdate(dialogPId:number):void{
        const firstUpdate:InformationUpdate = {pId:dialogPId, appName:this.FILE_TRANSFER_DIALOG_APP_NAME, info:[`initInformation:0`]};
        this._systemNotificationService.updateInformationNotify.next(firstUpdate);
    }

    private sendFileTransferUpdate(dialogPId:number, update:FileTransferUpdate):void{
        const newUpdate:InformationUpdate = {pId:dialogPId, appName:this.FILE_TRANSFER_DIALOG_APP_NAME, 
            info:[`srcPath:${update.srcPath}`,
                  `destPath:${update.destPath}`,
                  `totalNumberOfFiles:${update.totalNumberOfFiles}`, 
                  `numberOfFilesCopied:${update.numberOfFilesCopied}`,
                  `timeRemaining:${update.timeRemaining}`,
                  `itemsRemaining:${update.itemsRemaining}`,
                  `itemsRemainingSize:${update.itemsRemainingSize}`,
                  `fileName:${update.fileName}`
            ]}

        this._systemNotificationService.updateInformationNotify.next(newUpdate);
    }

    removeExtensionFromName(name:string):string{
        return basename(name, extname(name));
    }

    private addAndUpdateSessionData(key:string, map:Map<string, string>):void{
        this._sessionManagementService.addMapBasedSession(key, map);
    }

    private removeAndUpdateSessionData(key:string, path:string, map:Map<string, string>):void{
        if(map.has(path)){
            map.delete(path);
        }
        this._sessionManagementService.addMapBasedSession(key, map);
    }

    /**
     * Persists the current state of `_fileExistsMap` to session storage
     * without modifying any entries.
     */
    private persistIterateMapToSession():void{
        this._sessionManagementService.addMapBasedSession(this.fileServiceIterateKey, this._fileExistsMap);
    }

    private retrievePastSessionData(key:string):void{
        const sessionData = this._sessionManagementService.getMapBasedSession(key) as Map<string, string>;
        console.log(`${key} sessionData:`, sessionData);

        if(!sessionData || !(sessionData instanceof Map)){
            return;
        }

        if(key === this.fileServiceRestoreKey){
            this._restorePoint = sessionData;
        }else{
            // Snapshot keys first so we don't mutate the Map while iterating it.
            const entries = Array.from(sessionData.entries());
            for(const [k, v] of entries){
                const num = Number(v);
                if(isNaN(num) || num < 0){
                    console.warn(`retrievePastSessionData: dropping invalid entry [${k}]=${v}`);
                    sessionData.delete(k);
                }
            }
            this._fileExistsMap = sessionData;
        }
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}