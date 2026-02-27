import { Injectable } from "@angular/core";
import { FileInfo } from "src/app/system-files/file.info";
import { InformationUpdate, ShortCut } from "src/app/system-files/common.interfaces";
import {extname, basename, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FSModule } from "src/osdrive/Cheetah/System/BrowserFS/node/core/FS";
import { FileMetaData } from "src/app/system-files/file.metadata";

import { Subject } from "rxjs";
import * as BrowserFS from 'src/osdrive/Cheetah/System/BrowserFS/browserfs'
import { Buffer} from 'buffer';
import osDriveFileSystemIndex from '../../../osdrive.json';
import ini  from 'ini';
import { FileContent } from "src/app/system-files/common.interfaces";
import { ProcessType } from "src/app/system-files/system.types";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { BaseService } from "./base.service.interface";
import { DefaultService } from "./defaults.services";
import { ProcessIDService } from "./process.id.service";
import { FileIndexerService } from "./file.indexer.services";
import { RunningProcessService } from "./running.process.service";
import { UserNotificationService } from "./user.notification.service";
import { SessionManagmentService } from "./session.management.service";
import { SystemNotificationService } from "./system.notification.service";

import { OpensWith } from "src/app/system-files/common.interfaces";
import { zipSync, unzipSync } from "fflate";
import { CommonFunctions } from "src/app/system-files/common.functions";
import { FileTransferUpdate, FileTransferCopyOptions, FileTransferCount, FileTransferMoveOptions, FileOperationCheck } from "src/app/system-files/file.system.types";
import { UserNotificationType } from "src/app/system-files/common.enums";


@Injectable({
    providedIn: 'root'
})
export class FileService implements BaseService{ 
    private abortController?: AbortController;
  
    private _fileSystem!:FSModule;
    private _fileExistsMap!:Map<string, string>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _fileDragAndDrop!:FileInfo[];
    private _eventOriginator = Constants.EMPTY_STRING;
    private _mountedZips:Map<string, string> = new Map<string, string>(); // mountPoint -> srcPath

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _userNotificationService!:UserNotificationService
    private _systemNotificationService:SystemNotificationService;
    private _sessionManagmentService!:SessionManagmentService;
    private _fileIndexerService!:FileIndexerService;
    private _defaultService:DefaultService;

    private _isCalculated = false;
    private _isDuplicate = false;
    private _generatedName = Constants.EMPTY_STRING;
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
    private readonly CONCURRENCY_LIMIT = 4;
    // Maximum number of retries when generating unique file/folder names
    private readonly MAX_DUPLICATE_RETRIES = 10;

    name = 'file_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagmentService:SessionManagmentService, systemNotificationService:SystemNotificationService, defaultService:DefaultService){ 
        this.initBrowserFS();
        this._fileExistsMap =  new Map<string, string>();
        this._restorePoint =  new Map<string, string>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
        this._fileDragAndDrop = [];

        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._userNotificationService = userNotificationService;
        this._sessionManagmentService = sessionManagmentService;
        this._systemNotificationService = systemNotificationService;
        this._defaultService = defaultService;

        this.cancelFileTransferNotify.subscribe((p) =>{
            this.terminateTransfer();
            this.pIdToTerminate(p);
        });

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.retrievePastSessionData(this.fileServiceRestoreKey);
        this.retrievePastSessionData(this.fileServiceIterateKey);
    }

    private initBrowserFS(): void {
        setTimeout(() => {
            this.initBrowserFsAsync().then((success) => {
                if (success) {
                    this.postInitBrowserFs();
                } else {
                    console.warn("BrowserFS failed to initialize.");
                }
            });
        }, 0);
    }

    private async initBrowserFsAsync():Promise<boolean>{
        if(this._fileSystem)
            return true;
 
        const currentURL = window.location.href;
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
                        resolve(false); 
                    }
                    try {
                        this._fileSystem = BrowserFS.BFSRequire('fs');
                        // console.log('initBrowserFsAsync: File system initialized successfully.');
                        resolve(true);
                    } catch (initErr) {
                        console.error('initBrowserFsAsync: BFSRequire failed', initErr);
                        resolve(false);
                    }
                }
            );
        });
    }

    private async postInitBrowserFs(): Promise<void> {
        const delay = 100; //100ms
        await this.calculateUsedStorage();
        this._fileIndexerService = FileIndexerService.instance;

        await CommonFunctions.sleep(delay);
        await this._fileIndexerService.indexDirectoryAsync();
    }   

    public async isDirectory(path:string):Promise<boolean> {
        return new Promise<boolean>((resolve) =>{
            this._fileSystem.stat(path,(err, stats) =>{
                if(err){
                    console.error('checkIfDirectory error:',err)
                    console.error('checkIfDirectoryAsync: Failed to get stats →', err);
                    resolve(false);
                }
               
                const isDirectory = (stats)? stats.isDirectory(): false;
                resolve(isDirectory);
            });
        });
    }

    public async exists(path: string):Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.exists(path, (exists) => {
                // console.log(`checkIfExistsAsync: ${exists ? 'Already exists' : 'Does not exist'}`, exists);
                resolve(exists);
            });
        });
    }

    public async copyAsync(srcPath:string, destPath:string, isFile?:boolean):Promise<boolean>{
        const isDirectory = (isFile === undefined) ? await this.isDirectory(srcPath) : !isFile;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const filesTrasnferedCount:FileTransferCount = { fileCount: 0};
        const firstMsg = 'Estimating';
        const title = 'Copying';
        const dialogPId = this.initFileTransfer(firstMsg, title);
        this.sendUpdate(dialogPId);

        const count = await this.getFullCountOfFolderItemsInt(srcPath);
        const dirSize = await this.getFolderSizeAsync(srcPath);
        const fileToCopyCount = count.files;

        const result = isDirectory
            ? await this.copyFolderHandlerAsync({arg0:Constants.EMPTY_STRING, srcPath, destPath, filesToTransferCount: fileToCopyCount, dialogPId, fileTransferCount:filesTrasnferedCount, currentSize:dirSize, signal})
            : await this.copyFileAsync(srcPath, destPath);

        await this.recalculateUsedStorage();
        return result;
    }

    private async copyFileAsync(srcPath:string, destPath:string):Promise<boolean>{
        const name = this.getNameFromPath(srcPath);
        const destinationPath = `${this.pathCorrection(destPath)}/${name}`;
        // console.log(`Destination: ${destinationPath}`);

        const readResult = await this.readRawAsync(srcPath);
        if(!readResult){
            return false;
        }

        const result =  await this.writeRawHandlerAsync(destinationPath, readResult);
        if(result){
            const isFile = true;
            const fPath = (this._isDuplicate) ? `${this.pathCorrection(srcPath)}/${this._generatedName}` : destPath;
            await  this._fileIndexerService.addNotify(fPath, isFile);

            this._isDuplicate = false;
            this._generatedName = Constants.EMPTY_STRING;
        }

        return result;
    }

    /**
     * Run several file copies in parallel
     * @param options 
     * @returns 
     */
    private async copyFolderHandlerAsync(options: FileTransferCopyOptions): Promise<boolean> {
        const { arg0, srcPath, destPath, filesToTransferCount: fileCount, dialogPId, fileTransferCount: copiedFiles, signal } = options;
    
        const folderName = this.getNameFromPath(srcPath);
        const createFolderResult = await this.createFolderAsync(destPath, folderName);
        if(!createFolderResult) return false;
    
        const loadedDirectoryEntries = await this.readDirectory(srcPath);
        let activeTasks: Promise<boolean>[] = [];
    
        for(const directoryEntry of loadedDirectoryEntries){
            const entryPath = `${srcPath}/${directoryEntry}`;
            if (dialogPId === this._dialogPIdToCancel && signal.aborted) {
                console.warn("Transfer aborted.");
                this._dialogPIdToCancel = 0;
                return false;
            }
    
            const isDir = await this.isDirectory(entryPath);
            const task = (async()=>{
                if(isDir){
                    const result = await this.copyFolderHandlerAsync({ ...options,
                        srcPath: entryPath,
                        destPath: `${destPath}/${folderName}`,
                    });
                    if(!result){
                        console.error(`Failed to copy directory: ${entryPath}`);
                        return false;
                    }
                }else{
                    const start = performance.now();
                    const result = await this.copyFileAsync(entryPath, `${destPath}/${folderName}`);
                    const fileMetaData = await this.geFileMetaData(entryPath);
                    const end = performance.now();
                    const duration = end - start;

                    if(result){
                        copiedFiles.fileCount++;
                        const itemsRemaining = fileCount - copiedFiles.fileCount;
                        const timeRemaining = duration * itemsRemaining;
                        options.currentSize = Math.max(0, (options.currentSize ?? 0) - fileMetaData.getSize);
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
                    } else {
                        console.error(`file:${entryPath} failed to copy to destination:${destPath}/${folderName}`);
                        return false;
                    }
                }
                return true;
            })();
    
            activeTasks.push(task);
    
            //Throttle to maintain concurrency limit
            if(activeTasks.length >= this.CONCURRENCY_LIMIT){
                const results = await Promise.allSettled(activeTasks);
                const failed = results.some(r => r.status === "fulfilled" && r.value === false);
                if (failed) return false;
                activeTasks = [];
            }
        }
    
        // Wait for any remaining tasks
        if (activeTasks.length > 0) {
            const results = await Promise.allSettled(activeTasks);
            const failed = results.some(r => r.status === "fulfilled" && r.value === false);
            if (failed) return false;
        }
    
        return true;
    }

    public async createFolderAsync(directory: string, folderName: string): Promise<boolean> {
        const folderPath = `${directory}/${folderName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        const result =  await this.createFolderHandlerAsync(folderPath);

        if(result){
            const isFile = false;
            const dPath = (this._isDuplicate) ? this._generatedName : folderPath;

            await  this._fileIndexerService.addNotify(dPath, isFile);

            this._isDuplicate = false;
            this._generatedName = Constants.EMPTY_STRING;
        }

        return result;
    }

    /**
     * Creates a folder and handles duplicate folder names gracefully.
     * @param folderPath - The target folder path.
     * @returns true if folder creation succeeded, false otherwise.
     */
    private async createFolderHandlerAsync(folderPath: string): Promise<boolean> {
        const createResult = await this.createFolderRawAsync(folderPath);

        if (createResult === 0) {
            // Folder created successfully
            this._fileExistsMap.set(folderPath, String(0));
            this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
            return true;
        }

        if (createResult === 1) {
            this._isDuplicate = true;

            for (let attempt = 0; attempt < this.MAX_DUPLICATE_RETRIES; attempt++) {
                const uniqueFolderPath = this.IncrementFileName(folderPath).replace(Constants.DOUBLE_SLASH, Constants.ROOT);
                const retryResult = await this.createFolderRawAsync(uniqueFolderPath);

                if (retryResult === 0) {
                    this._generatedName = uniqueFolderPath;
                    // Folder created successfully after name iteration
                    this._fileExistsMap.set(uniqueFolderPath, String(0));
                    this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                    return true;
                }

                if (retryResult !== 1) {
                    // Non-duplicate error, abort
                    console.error(`createFolderAsync: unexpected error on retry ${attempt + 1}`);
                    return false;
                }
                // retryResult === 1 means this name also exists, try next
            }

            console.error(`createFolderAsync: exceeded ${this.MAX_DUPLICATE_RETRIES} retries`);
            return false;
        }

        // Other errors
        return false;
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

    private async updateAccessTimeAsync(path: string, mtime: Date): Promise<void> {
        return new Promise<void>((resolve) => {
            const now = new Date();
            this._fileSystem.utimes(path, now, mtime, (err) => {
                if (err) {
                    console.error('updateAccessTimeAsync error:', err);
                }
                resolve();
            });
        });
    }

    public async geFileMetaData(path: string): Promise<FileMetaData> {
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
        
        return new Promise<string[]>((resolve) => {
             this._fileSystem.readdir(path, function(err, files) {
                if(err){
                    console.error("Dang! The filesystem is acting up:", err);
                    resolve([]);
                }

                resolve(files || []);
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
            const files:FileInfo[] = [];
            const directoryEntries = await this.readDirectory(path);

            for(const entry of directoryEntries){
                const entryPath = `${path}/${entry}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
                const file =  await this.getFileInfo(entryPath);
                files.push(file);
            }

            return files;
		}catch(err){
			console.error('loadDirectoryFiles:',err);
			return [];
		}
	}

	public async getFileInfo(path:string):Promise<FileInfo>{
 
        const defaultOpensWith = Constants.EMPTY_STRING;
        let fileInfo = new FileInfo();

        const useImage = true;
		const isFile = true;
        const extension = extname(path);
        const fileMetaData = await this.geFileMetaData(path);
        //await this.updateAccessTimeAsync(path, fileMetaData.getModifiedDate); //##.
        fileMetaData.setAccessDate = new Date();
        
        if(!extension){
            const fc = await this.setOtherFolderProps(path, fileMetaData.getIsDirectory) as FileContent;
            fileInfo = this.populateFileInfo(path, fileMetaData, !isFile, defaultOpensWith, Constants.EMPTY_STRING, !useImage, undefined, fc);
            fileInfo.setIconPath = await this.changeFolderIcon(fc.fileName, fc.iconPath, path);
        }
        else if(extension === Constants.URL){
            const sc = await this.getShortCutFromURL(path);
            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, defaultOpensWith, Constants.EMPTY_STRING, useImage, sc);
            fileInfo.setIsShortCut = true;
        }
        else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)
			|| Constants.VIDEO_FILE_EXTENSIONS.includes(extension)
			|| Constants.AUDIO_FILE_EXTENSIONS.includes(extension)
			|| Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension)){

			let fileContent:FileContent| undefined = undefined;
			const resolved = this.getOpensWith(extension);

			if(resolved.fileType === 'image' ||resolved.fileType === 'video' || resolved.fileType === 'audio' )
                fileContent = await this.getFileContentFromB64DataUrl(path, resolved.fileType) as FileContent;

            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, resolved.appName, resolved.appIcon, !useImage, undefined, fileContent);

        }else if(Constants.KNOWN_FILE_EXTENSIONS.includes(extension)){
            const resolved = this.getOpensWith(extension);

            let fileContent:FileContent| undefined = undefined;
			if(resolved.fileType === 'swf' ||resolved.fileType === 'pdf')
                fileContent = await this.getFileContentFromB64DataUrl(path, resolved.fileType) as FileContent;

            fileInfo = this.populateFileInfo(path, fileMetaData, isFile, resolved.appName, resolved.appIcon, !useImage, undefined, fileContent);
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
        this.addAppAssociaton(fileInfo.getOpensWith, fileInfo.getIconPath);

        return fileInfo;
    }

	public getOpensWith(extension: string): OpensWith{
		const empty = Constants.EMPTY_STRING;
		const isAudioFile = Constants.AUDIO_FILE_EXTENSIONS.includes(extension);
		if(isAudioFile)
			return {fileType:'audio', appName:'audioplayer', appIcon: 'music_file.png'};

		const isVideoFile = Constants.VIDEO_FILE_EXTENSIONS.includes(extension);
		if(isVideoFile)
			return {fileType:'video', appName:'videoplayer', appIcon: 'video_file.png'};

		const isImageFile = Constants.IMAGE_FILE_EXTENSIONS.includes(extension);
		if(isImageFile)
			return {fileType:'image', appName:'photoviewer', appIcon: 'image_file.png'};

		const isSourceFile = Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension);
		if(isSourceFile)
			return {fileType:'source', appName:'codeeditor', appIcon: 'code_file.png'};


		const cleanedExt = extension.replace(Constants.DOT, empty);
		const knownFileHandlers: Record<string, OpensWith> = {
			'.wasm': { fileType: cleanedExt, appName: 'codeeditor', appIcon: 'wasm_file.png' },
			'.txt': { fileType: cleanedExt, appName: 'texteditor', appIcon: 'file.png' },
			'.properties': { fileType: cleanedExt, appName: 'texteditor', appIcon: 'file.png' },
			'.log': { fileType: cleanedExt, appName: 'texteditor', appIcon: 'file.png' },
			'.md': { fileType: cleanedExt, appName: 'markdownviewer', appIcon: 'markdown_file.png' },
			'.jsdos': { fileType: cleanedExt, appName: 'jsdos', appIcon: 'js-dos_file.png' },
			'.swf': { fileType: cleanedExt, appName: 'ruffle', appIcon: 'swf_file.png' },
			'.pdf': { fileType: cleanedExt, appName: 'pdfviewer', appIcon: 'pdf_file.png' },
            '.zip': { fileType: cleanedExt, appName: 'fileexplorer', appIcon: 'zip_file.png' },
		};

		if (knownFileHandlers[extension]) {
			return knownFileHandlers[extension];
		}

		return {fileType:empty, appName:empty, appIcon: empty};
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

    public async getFileContentFromB64DataUrl(path:string, contentType:string):Promise<FileContent> {

        return new Promise<FileContent>((resolve)  =>{
            this._fileSystem.readFile(path, (err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.error('getFileContentFromB64DataUrl error:', err);
                    return resolve(this.populateFileContent());
                }

                if (!this.isUtf8Encoded(contents)) {
                    return  resolve(this.createFileContentFromBuffer(contents, contentType, path));
                }

                const encoding:BufferEncoding = 'utf8';
                const utf8Data = contents.toString(encoding);

                const dataPrefix = utf8Data.substring(0, 10);
                //const dataPrefix = utf8Data.replace(/^data:.*;base64,/, Constants.EMPTY_STRING);
                if (this.isDataUrl(utf8Data)) {
                    const base64Data = utf8Data.split(Constants.COMMA)[1];
                    const binaryData = Buffer.from(base64Data, 'base64');
                    const fileUrl = this.bufferToUrl(binaryData);

                    return resolve(this.createFileContent(fileUrl, path, dataPrefix === 'data:image'));
                } else {
                    return resolve(this.createFileContentFromBuffer(contents, contentType, path));
                }
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

    public async getShortCutFromURL(path: string): Promise<ShortCut> {
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
        const folderToProcessingQueue:string[] =  [];
        const folderToDeleteStack:string[] =  [];

        //dir path can be gotten from either src or dest path;
        const  directoryPath = dirname(srcPath);
        const newName = this.getNameFromPath(destPath);

        const directoryExists = await this.exists(destPath);
        if(directoryExists){
            const msg = `Folder: ${newName}, already exists`;
            const title = 'Folder Matching Name Present';
            this._userNotificationService.showErrorNotification(msg, title);
            return false;
        }

        const result = await this.createFolderAsync(directoryPath, newName);
        if(!result) return result;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        const firstMsg = 'Estimating';
        const title = 'Moving';

        const dialogPId = this.initFileTransfer(firstMsg, title);
        this.sendUpdate(dialogPId);

        const dirItemsCount = await this.getFullCountOfFolderItemsInt(srcPath);
        const dirFilesCount = dirItemsCount.files;
        const folderSize = await this.getFolderSizeAsync(srcPath);
        const filesMovedCount:FileTransferCount = { fileCount: 0};

        folderToProcessingQueue.push(srcPath);
        const isRenameSuccessful = await this.moveHandlerAsync({ 
            destPath, 
            folderToProcessingQueue, 
            folderToDeleteStack,
            filesToMoveCount:dirFilesCount,
            dialogPId,
            filesMovedCount,
            currentSize:folderSize,
            signal,
            moveFolderItself: false  // same as moveHandlerBAsync
        });   
        
        if(isRenameSuccessful){
          await this.deleteEmptyFolders(folderToDeleteStack);
        }

        return isRenameSuccessful;
    }

    //virtual filesystem, use copy and then delete
    public async moveAsync(srcPath: string, destPath: string, isFile?: boolean, isRecycleBin?: boolean, check?:FileOperationCheck): Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles the file-in-use check
        if(check && this.isFileInUse(check.file.getCurrentPath)){
            await this.showFileInUseNotification(check.file, check.callerUId);
            return false;
        }

        const isDirectory = (isFile === undefined) ? await this.isDirectory(srcPath) : !isFile;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let firstMsg = 'Estimating';
        let dialogPId = 0;
        let dirFilesCount = 0;
        let folderSize = 0;
        const filesMovedCount:FileTransferCount = { fileCount: 0};
        
        if(isDirectory){
            const folderToProcessingQueue:string[] =  [];
            const folderToDeleteStack:string[] =  [];
            let result = false;

            folderToProcessingQueue.push(srcPath);

            const dirItemsCount = await this.getFullCountOfFolderItemsInt(srcPath);
            dirFilesCount = dirItemsCount.files;
            folderSize = await this.getFolderSizeAsync(srcPath);

            if(destPath === Constants.RECYCLE_BIN_PATH){
                const size = CommonFunctions.getReadableFileSizeValue(folderSize);         
                const sizeUnit  = CommonFunctions.getFileSizeUnit(folderSize);
        
                const title = `Preparing to recycle:from:${basename(srcPath)}`;
                firstMsg = `Discovered ${dirFilesCount} items  (${size} ${sizeUnit})...`;
                dialogPId = this.initDeleteProcess(firstMsg, title);
                this.sendUpdate(dialogPId);
            }else{
                const title = 'Moving';
                dialogPId = this.initFileTransfer(firstMsg, title);
                this.sendUpdate(dialogPId);
            }

            //check if destPath Exists
            const exists = await this.exists(destPath);
            if(exists){
                result = await this.moveHandlerAsync({ 
                    destPath, 
                    folderToProcessingQueue, 
                    folderToDeleteStack,
                    filesToMoveCount:dirFilesCount,
                    dialogPId,
                    filesMovedCount,
                    currentSize:folderSize,
                    signal,
                    isRecycleBin,      // or false
                    moveFolderItself: true   // same as moveHandlerAAsync
                });
            }else{
                result = await this.moveHandlerAsync({ 
                    destPath, 
                    folderToProcessingQueue, 
                    folderToDeleteStack,
                    filesToMoveCount:dirFilesCount,
                    dialogPId,
                    filesMovedCount,
                    currentSize:folderSize,
                    signal,
                    moveFolderItself: false  // same as moveHandlerBAsync
                });   
            }

            if(result){
                if(isRecycleBin)
                    this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint);
   
                await this.deleteEmptyFolders(folderToDeleteStack);
            }
            return result;
        }else{
            if(isRecycleBin)
                this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint);

            return await this.moveFileAsync(srcPath, destPath, undefined, isRecycleBin);
        }
    }

    private async moveHandlerAsync(options: FileTransferMoveOptions): Promise<boolean> {
        const {destPath, folderToProcessingQueue, folderToDeleteStack, filesToMoveCount, dialogPId,
            filesMovedCount, signal, isRecycleBin = false, moveFolderItself = true } = options;
    
        let { skipCounter = 0, } = options;
    
        if (folderToProcessingQueue.length === 0)
            return true;
    
        //Abort check before any I/O
        if((dialogPId === this._dialogPIdToCancel) && signal.aborted){
            this._dialogPIdToCancel = 0;
            console.warn("Move operation aborted.");
            return false;
        }
    
        const srcPath = folderToProcessingQueue.shift() || Constants.EMPTY_STRING;
        folderToDeleteStack.push(srcPath);
    
        let folderName = this.getNameFromPath(srcPath);
        let shouldCreateFolder = true;
    
        // In "contents only" mode, skip creating the top-level folder
        if(!moveFolderItself && skipCounter === 0){
            folderName = Constants.EMPTY_STRING;
            shouldCreateFolder = false;
        }
    
        const loadedDirectoryEntries = await this.readDirectory(srcPath);
        let moveFolderResult = true;
    
        if(shouldCreateFolder){
            moveFolderResult = await this.createFolderAsync(destPath, folderName);
            if(!moveFolderResult){
                console.error(`folder:${destPath}/${folderName} creation failed`);
                return false;
            }
        }
    
        skipCounter++;
        let activeTasks: Promise<boolean>[] = [];
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const fullSrcPath = `${srcPath}/${directoryEntry}`;
    
            // Abort check before scheduling the task
            if((dialogPId === this._dialogPIdToCancel) && signal.aborted){
                this._dialogPIdToCancel = 0;
                console.warn("Move operation aborted.");
                return false;
            }
    
            const isDir = await this.isDirectory(fullSrcPath);
            const task = (async ()=>{
                if(isDir){
                    folderToProcessingQueue.push(fullSrcPath);
                    return true;
                }else{
                    const fullDestPath = `${destPath}/${folderName}`;
                    const start = performance.now();
                    const fileMetaData = await this.geFileMetaData(fullSrcPath);
                    const result = await this.moveFileAsync(fullSrcPath, fullDestPath, undefined, isRecycleBin);
                    const end = performance.now();
                    const duration = end - start;
    
                    if(result){
                        filesMovedCount.fileCount++;
                        const itemsRemaining = filesToMoveCount - filesMovedCount.fileCount;
                        const estimatedRemainingTime = duration * itemsRemaining;
                        options.currentSize = Math.max(0, (options.currentSize ?? 0) - fileMetaData.getSize);
                        const itemsRemainingSize = options.currentSize;
    
                        // Generate transfer update
                        const transferUpdate = this.genFileTransferUpdate(
                            srcPath,
                            fullDestPath,
                            filesToMoveCount,
                            filesMovedCount.fileCount,
                            estimatedRemainingTime,
                            itemsRemaining,
                            itemsRemainingSize,
                            directoryEntry
                        );
                        this.sendFileTransferUpdate(dialogPId, transferUpdate);
                        return true;
                    }else{
                        console.error(`file:${fullSrcPath} failed to move to destination:${fullDestPath}`);
                        return false;
                    }
                }
            })();
    
            activeTasks.push(task);
    
            //Throttle to maintain concurrency limit
            if (activeTasks.length >= this.CONCURRENCY_LIMIT) {
                const results = await Promise.allSettled(activeTasks);
                const failed = results.some(r => r.status === "fulfilled" && r.value === false);
                if(failed)return false;
                activeTasks = [];
            }
        }
    
        // Wait for remaining tasks
        if (activeTasks.length > 0) {
            const results = await Promise.allSettled(activeTasks);
            const failed = results.some(r => r.status === "fulfilled" && r.value === false);
            if (failed) return false;
        }
    
        // Recursive call for next folder in queue
        return this.moveHandlerAsync({ ...options,
            destPath: `${destPath}/${folderName}`,
            folderToProcessingQueue,
            folderToDeleteStack,
            skipCounter,
        });
    }

    //virtual filesystem, use copy and then delete. There is a BrowserFS bug causing an error to be thrown
    private async moveFileAsync(srcPath: string, destPath: string, generatePath?: boolean, isRecycleBin?: boolean): Promise<boolean> {
        let destinationPath = Constants.EMPTY_STRING;
        if (generatePath === undefined || generatePath){
            const fileName = this.getNameFromPath(srcPath);
            destinationPath = `${destPath}/${fileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        } else {
            destinationPath = destPath;
        }

        const readResult = await this.readRawAsync(srcPath);
        if(!readResult) return false;

        const checkResult = await this.exists(destinationPath);
        if(checkResult)
            return false

        //overwrite the file
        const writeResult = await this.writeRawAsync(destinationPath, readResult, 'wx');
        if(writeResult !== 0)
            return false
        
        return await this.deleteFileAsync(srcPath);
    }

    //O for success, 1 for file already present, 2 other error
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    private async writeRawAsync(destPath: string, content:any, flag:string = 'wx'): Promise<number>{
        return new Promise((resolve) => {
            this._fileSystem.writeFile(destPath, content, { flag: flag }, (writeErr) => {
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
     * handles instances where a file being written alredy exist in a given location
     * @param destPath 
     * @param cntnt 
     * @returns 
     */
    private async writeRawHandlerAsync(destPath:string, cntnt:any):Promise<boolean>{
        const writeResult = await this.writeRawAsync(destPath, cntnt, 'wx');
        if(writeResult === 0){
            this._fileExistsMap.set(destPath, String(0));
            this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
            return true;
        }

        if(writeResult === 1){
            console.warn('writeRawHandlerAsync: file already exists, generating unique name');
            this._isDuplicate = true;

            for (let attempt = 0; attempt < this.MAX_DUPLICATE_RETRIES; attempt++) {
                const newFileName = this.IncrementFileName(destPath);
                const writeRetry = await this.writeRawAsync(newFileName, cntnt, 'wx');

                if(writeRetry === 0){
                    this._fileExistsMap.set(newFileName, String(0));
                    this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                    this._generatedName = newFileName;
                    return true;
                }

                if (writeRetry !== 1) {
                    // Non-duplicate error, abort
                    console.error(`writeRawHandlerAsync: unexpected error on retry ${attempt + 1}`);
                    return false;
                }
                // writeRetry === 1 means this name also exists, try next
            }

            console.error(`writeRawHandlerAsync: exceeded ${this.MAX_DUPLICATE_RETRIES} retries`);
            return false;
        }

        return false;
    }

    public async writeFilesAsync(directory: string, files: File[]): Promise<boolean> {
        const readFileAsDataURL = (file: File): Promise<string | ArrayBuffer | null> => {
            return new Promise((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.readAsDataURL(file);
                fileReader.onload = () => resolve(fileReader.result);
                fileReader.onerror = () => reject(fileReader.error);
            });
        };

        for (const file of files) {
            try {
                const result = await readFileAsDataURL(file);
                const newFile: FileInfo = new FileInfo();
                newFile.setFileName = file.name;

                if (result instanceof ArrayBuffer) {
                    newFile.setContentBuffer = result;
                } else {
                    newFile.setContentPath = result || Constants.EMPTY_STRING;
                }

                newFile.setCurrentPath = `${this.pathCorrection(directory)}/${file.name}`;
                const success = await this.writeFileAsync(directory, newFile);

                if (!success) {
                    return false; // Return false if any file write fails
                }

            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                return false;
            }
        }

        return true; // Return true if all files were written successfully
    }

    public async writeFileAsync(path:string, file:FileInfo):Promise<boolean>{
        const cntnt = (file.getContentPath === Constants.EMPTY_STRING)? file.getContentBuffer : file.getContentPath;
        const destPath = `${this.pathCorrection(path)}/${file.getFileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);

        const result =  await this.writeRawHandlerAsync(destPath, cntnt);
        if(result){
            const isFile = true;
            const fPath = (this._isDuplicate) 
            ? `${this.pathCorrection(path)}/${this._generatedName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT) 
            : destPath;
            await  this._fileIndexerService.addNotify(fPath, isFile);

            this._isDuplicate = false;
            this._generatedName = Constants.EMPTY_STRING;

            await this.recalculateUsedStorage();
        }

        return result;
    }

    public async renameAsync(path:string, newFileName:string, isFile?:boolean, check?:FileOperationCheck): Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles the file-in-use check
        if(check && this.isFileInUse(check.file.getCurrentPath)){
            await this.showFileInUseNotification(check.file, check.callerUId);
            return false;
        }

        const rename = `${dirname(path)}/${newFileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        const isDirectory = (isFile === undefined) ? await this.isDirectory(path) : !isFile;

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
            const newPath = `${dirname(path)}/${newFileName}${extname(path)}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
            return await this.moveFileAsync(path, newPath, false);
        }
    }

    private async renameURLFiles(srcPath:string, fileName:string): Promise<boolean> {

        const destPath = dirname(srcPath);
        const shortCutData = await this.getShortCutFromURL(srcPath) as ShortCut;
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
        shortCut.setContentPath = shortCutContent;
        shortCut.setFileName= `${fileName}${Constants.URL}`;

        const writeResult = await this.writeFileAsync(destPath, shortCut);
        if(!writeResult){
            console.error('renameURLFiles: Failed to write shortcut to', destPath);
            return false;
        }

        return await this.deleteFileAsync(srcPath);
    }

    public async deleteAsync(path:string, isFile?:boolean, isRecycleBin?:boolean, check?:FileOperationCheck):Promise<boolean> {
        // When a FileOperationCheck is provided, the service handles confirm-delete and file-in-use checks
        if(check){
            if(!check.skipConfirmDialog && this.getConfirmDeleteState()){
                const confirmed = await this.showDeleteConfirmation(check.file);
                if(!confirmed) return false;
            }

            if(this.isFileInUse(check.file.getCurrentPath)){
                await this.showFileInUseNotification(check.file, check.callerUId);
                return false;
            }
        }

        // is file or folder not currently in the bin, move it to the bin if option is allow, or delete it right away
        if(isRecycleBin){
            return await this.deleteFolderHandlerAsync(path, isRecycleBin);
        }

        const sendToRecycleBin = this.getMoveToRecycleBinState();
        if(!path.includes(Constants.RECYCLE_BIN_PATH) && sendToRecycleBin){
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
            const isDirectory = (isFile === undefined) ? await this.isDirectory(path) : !isFile;
            const result = isDirectory
                ? await this.deleteFolderHandlerAsync(path, isRecycleBin)
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

    private async deleteFolderHandlerAsync(srcPath: string, isRecycleBin?:boolean): Promise<boolean> {
        const loadedDirectoryEntries = await this.readDirectory(srcPath);
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${srcPath}/${directoryEntry}`;
            this.removeAndUpdateSessionData(this.fileServiceRestoreKey, entryPath, this._restorePoint);

            const checkIfDirectory = await this.isDirectory(entryPath);
            if(checkIfDirectory){
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
    

        if(srcPath === Constants.RECYCLE_BIN_PATH && isRecycleBin)
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
            return trigger?.getCurrentPath === filePath  || trigger?.getCurrentPath.includes(filePath);
        });
    }

    async showDeleteConfirmation(file:FileInfo):Promise<boolean>{
        let msg = Constants.EMPTY_STRING;

        if((file.getCurrentPath.includes(Constants.RECYCLE_BIN_PATH))) { // is file or folder in recycle bin
            msg = (file.getIsFile) 
            ? 'Are you sure that you want to permanently delete this file?' 
            : ' Are you sure that you want to permanently delete this folder ?' 
        }
        else{
            msg = (file.getIsFile) 
            ? 'Are you sure that you want to move this file to the Recycle Bin?' 
            : ' Are you sure that you want to move this folder to the Recycle Bin?' 
        }

        const title = (file.getIsFile && file.getFileType === Constants.URL)
            ? 'Delete Shortcut'
            : `Delete ${file.getIsFile ? 'File' : 'Folder'}`;

        return await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.DeleteWarning, file);
    }

    async showFileInUseNotification(file:FileInfo, callerUId:string = Constants.EMPTY_STRING):Promise<boolean>{
        const isDir = !file.getIsFile;
        const title = isDir ? 'Folder In Use' : 'File In Use';
        const msg = isDir
            ? `The action can't be completed because the folder or a file in it is open in another program`
            : `The action can't be completed because the file is open in another program`;

        await this._userNotificationService.showWarningNotification(msg, title, UserNotificationType.InUseWarning, file, callerUId);
        return false;
    }

    public  async countFolderItems(path:string): Promise<number> {
        return new Promise<number>((resolve) =>{
            this._fileSystem.readdir(path, (readDirErr, files) =>{
                if(readDirErr){
                    console.error('Error reading dir for count:', readDirErr);
                    resolve(0);
                }
                resolve(files?.length || 0);
            });
        });
    }

    public  async getFullCountOfFolderItems(path:string): Promise<string> {
        const counts = { files: 0, folders: 0 };
        const queue:string[] = [];
        
        queue.push(path);
        await this.traverseAndCountFolderItems(queue, counts);
        return `${counts.files} Files, ${counts.folders} Folders`;
    }

    private  async getFullCountOfFolderItemsInt(path:string): Promise<{files: number; folders: number;}> {
        const counts = { files: 0, folders: 0 };
        const queue:string[] = [];
        
        queue.push(path);
        await this.traverseAndCountFolderItems(queue, counts);
        return counts;
    }

    private  async traverseAndCountFolderItems(queue:string[], counts:{files: number, folders: number}): Promise<void> {
        if(queue.length === 0)
            return;

        const srcPath = queue.shift() || Constants.EMPTY_STRING;
 
        const directoryEntries = await this.readDirectory(srcPath);      
        for(const directoryEntry of directoryEntries){
            const isDirectory = await this.isDirectory(`${srcPath}/${directoryEntry}`);
            if(isDirectory){
                queue.push(`${srcPath}/${directoryEntry}`);
                counts.folders++;
            }else{
                counts.files++;
            }
        }

        return this.traverseAndCountFolderItems(queue, counts);
    }

    public  async getFolderSizeAsync(path:string):Promise<number>{
        const sizes = {files: 0, folders: 0};
        const queue:string[] = [];
        
        queue.push(path);
        await this.traverseAndSumFolderSize(queue, sizes);
        return sizes.files + sizes.folders;
    }

    private  async traverseAndSumFolderSize(queue:string[], sizes:{files: number, folders: number}): Promise<void> {
        if(queue.length === 0)
            return;

        const srcPath = queue.shift() || Constants.EMPTY_STRING;

        const extraInfo = await this.geFileMetaData(srcPath);
        sizes.folders += extraInfo.getSize;

        const directoryEntries = await this.readDirectory(srcPath);      
        for(const entry of directoryEntries){
            const entryPath = `${srcPath}/${entry}`;
            const isDirectory = await this.isDirectory(entryPath);

            if(isDirectory){
                queue.push(entryPath);
            }else{
                const extraInfo = await this.geFileMetaData(entryPath);
                sizes.files += extraInfo.getSize;
            }
        }

        return this.traverseAndSumFolderSize(queue, sizes);
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
            const writeResult = await this.writeRawAsync(zipFilePath, Buffer.from(zipped));

            if (writeResult === 0) {
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
            const isDir = await this.isDirectory(entryPath);

            if (isDir) {
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
    public async unzipEntityAsync(srcPath: string): Promise<boolean> {
        try {
            const zipBuffer = await this.readRawAsync(srcPath);
            if (!zipBuffer) {
                console.error('unzipEntityAsync: could not read archive:', srcPath);
                return false;
            }

            const decompressed = unzipSync(new Uint8Array(zipBuffer));
            const parentDir = dirname(srcPath);
            const folderName = basename(srcPath, extname(srcPath));

            // Create root extraction folder
            const createResult = await this.createFolderAsync(parentDir, folderName);
            if (!createResult) {
                console.error('unzipEntityAsync: could not create extraction folder');
                return false;
            }

            const extractionRoot = `${parentDir}/${folderName}`;

            for (const [relativePath, data] of Object.entries(decompressed)) {
                // Skip directory-only entries (fflate marks them with a trailing /)
                if (relativePath.endsWith(Constants.ROOT)) {
                    const dirPath = `${extractionRoot}/${relativePath.slice(0, -1)}`;
                    await this.createNestedFolders(dirPath);
                    continue;
                }

                // Ensure parent directories exist
                const entryDir = dirname(`${extractionRoot}/${relativePath}`);
                await this.createNestedFolders(entryDir);

                // Write the file
                const destPath = `${extractionRoot}/${relativePath}`;
                const writeResult = await this.writeRawAsync(destPath, Buffer.from(data));
                if (writeResult !== 0) {
                    console.error(`unzipEntityAsync: failed to write: ${destPath}`);
                    return false;
                }
            }

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
        for (const mountPoint of this._mountedZips.keys()) {
            if (path === mountPoint || path.startsWith(mountPoint + '/')) {
                return mountPoint;
            }
        }
        return Constants.EMPTY_STRING;
    }

    /**
     * Recursively creates folders for a given path if they don't already exist.
     * e.g. "/a/b/c/d" will create /a, /a/b, /a/b/c, /a/b/c/d as needed.
     */
    private async createNestedFolders(folderPath: string): Promise<boolean> {
        const parts = folderPath.split(Constants.ROOT).filter(p => p.length > 0);
        let current = Constants.EMPTY_STRING;

        for (const part of parts) {
            current = `${current}/${part}`;
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
    public IncrementFileName(path:string):string{
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
    public DecrementFileName(path:string):void{
        // Resolve the base path if this is a generated duplicate name
        const originalPath = this.getOriginalPathFromGenerated(path);
        const targetPath = originalPath ?? path;

        let count = Number(this._fileExistsMap.get(targetPath) ?? 0);
        if (isNaN(count)) count = 0;

        if(count > 0){
            count -= 1;
            this._fileExistsMap.set(targetPath, String(count));
        }else{
            // Counter is already 0 — remove the entry entirely
            this._fileExistsMap.delete(targetPath);
        }

        // Also clean up the generated path's own entry if it differs from the target
        if(originalPath && this._fileExistsMap.has(path)){
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

    private addAppAssociaton(appname:string, img:string):void{
        if(!this._fileAndAppIconAssociation.get(appname)){
            if(appname === 'photoviewer' || appname === 'videoplayer' || appname === 'audioplayer' || appname === 'ruffle'){
                this._fileAndAppIconAssociation.set(appname,`${Constants.IMAGE_BASE_PATH}${appname}.png`);
            }else{
                this._fileAndAppIconAssociation.set(appname, img);
            }
        }
    }

    public getAppAssociaton(appname:string):string{
        return this._fileAndAppIconAssociation.get(appname) || Constants.EMPTY_STRING;
    }

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

    private async calculateUsedStorage():Promise<void>{
        if(this._isCalculated) return;

        this._usedStorageSizeInBytes = await this.getFolderSizeAsync(Constants.ROOT);
        this._isCalculated = true;
    }

    private async recalculateUsedStorage():Promise<void>{
        this._usedStorageSizeInBytes = await this.getFolderSizeAsync(Constants.ROOT);
    }

    private isUtf8Encoded(data: Buffer | Uint8Array): boolean {
        try {
          const decoder = new TextDecoder('utf-8', { fatal: true });
          decoder.decode(data);
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

    private terminateTransfer(): void {
        this.abortController?.abort();
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
        this._sessionManagmentService.addMapBasedSession(key, map);
    }

    private removeAndUpdateSessionData(key:string, path:string, map:Map<string, string>):void{
        if(map.has(path)){
            map.delete(path);
        }
        this._sessionManagmentService.addMapBasedSession(key, map);
    }

    /**
     * Persists the current state of `_fileExistsMap` to session storage
     * without modifying any entries.
     */
    private persistIterateMapToSession():void{
        this._sessionManagmentService.addMapBasedSession(this.fileServiceIterateKey, this._fileExistsMap);
    }

    private retrievePastSessionData(key:string):void{
        const sessionData = this._sessionManagmentService.getMapBasedSession(key) as Map<string, string>;
        console.log(`${key} sessionData:`, sessionData);

        if(!sessionData || !(sessionData instanceof Map)){
            return;
        }

        if(key === this.fileServiceRestoreKey){
            this._restorePoint = sessionData;
        }else{
            // Sanitize: drop entries with non-numeric or negative values
            for(const [k, v] of sessionData){
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