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
import { ProcessIDService } from "./process.id.service";
import { FileIndexerService } from "./file.indexer.services";
import { RunningProcessService } from "./running.process.service";
import { UserNotificationService } from "./user.notification.service";
import { SessionManagmentService } from "./session.management.service";
import { SystemNotificationService } from "./system.notification.service";

import { OpensWith } from "src/app/system-files/common.interfaces";
import JSZip from "jszip";
import { CommonFunctions } from "src/app/system-files/common.functions";
import { FileSystemUpdateInfo, CopyFolderOptions, FilesCopiedCount } from "src/app/system-files/file.system.types";

@Injectable({
    providedIn: 'root'
})
export class FileService implements BaseService{ 
    private abortController?: AbortController;
    private _fileInfo!:FileInfo;
  
    private _fileSystem!:FSModule;
    private _fileExistsMap!:Map<string, string>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _fileDragAndDrop!:FileInfo[];
    private _eventOriginator = Constants.EMPTY_STRING;

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _userNotificationService!:UserNotificationService
    private _systemNotificationService:SystemNotificationService;
    private _sessionManagmentService!:SessionManagmentService;
    private _fileIndexerService!:FileIndexerService;

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

    name = 'file_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem';


    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagmentService:SessionManagmentService, systemNotificationService:SystemNotificationService){ 
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
        const delay = 0;
        setTimeout(() => {
            this.initBrowserFsAsync().then((success) => {
                if (success) {
                    this.postInitBrowserFs();
                } else {
                    console.warn("BrowserFS failed to initialize.");
                }
            });
        }, delay);
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

        const filesCopiedCount:FilesCopiedCount = { fileCount: 0};
        const firstMsg = 'Estimating';
        const title = 'Copying';
        const dialogPId = this.initFileTransfer(firstMsg, title);
        this.sendFirstUpdate(dialogPId);

        const count = await this.getFullCountOfFolderItemsInt(srcPath);
        console.log('count of files:', count);
        const fileCount = count.files;

        //await CommonFunctions.sleep(this.generateBusyNumber(1000, 5000)); // sleep 1 - 5 seconds
        const result = isDirectory
            ? await this.copyFolderHandlerAsync({arg0:Constants.EMPTY_STRING, srcPath, destPath, fileCount, dialogPId, copiedFiles:filesCopiedCount, signal})
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

    // Updated function signature and usage
    private async copyFolderHandlerAsync(options: CopyFolderOptions): Promise<boolean> {
        const { arg0, srcPath, destPath, fileCount, dialogPId, copiedFiles, signal } = options;

        const folderName = this.getNameFromPath(srcPath);
        const createFolderResult = await this.createFolderAsync(destPath, folderName);

        if (createFolderResult) {
            const loadedDirectoryEntries = await this.readDirectory(srcPath);
            for(const directoryEntry of loadedDirectoryEntries){
                const entryPath = `${srcPath}/${directoryEntry}`;
                if(dialogPId === this._dialogPIdToCancel && signal.aborted){
                    console.warn("Transfer aborted.");
                    return false;
                }

                const isDir = await this.isDirectory(entryPath);
                if(isDir){
                    // console.log('DID A DIR CHECK');
                    // console.log('CHECKED FOR:', entryPath);
                    // console.log('----------Copied Files--------:', copiedFiles.fileCount);
                    const result = await this.copyFolderHandlerAsync({
                        ...options,
                        srcPath: entryPath,
                        destPath: `${destPath}/${folderName}`,
                        copiedFiles: copiedFiles
                    });
                    if(!result){
                        console.error(`Failed to copy directory: ${entryPath}`);
                        return false;
                    }
                } else {
                    const result = await this.copyFileAsync(entryPath, `${destPath}/${folderName}`);
                    if(result){
                        console.info(`file:${entryPath} successfully copied to destination:${destPath}/${folderName}`);

                        copiedFiles.fileCount++;
                        const infoUpdate = this.getFileSystemUpdateInfo(srcPath, destPath, fileCount, copiedFiles.fileCount, directoryEntry);
                        this.sendFileTransferInformationUpdate(dialogPId, infoUpdate);
                    } else {
                        console.error(`file:${entryPath} failed to copy to destination:${destPath}/${folderName}`);
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private terminateTransfer(): void {
        this.abortController?.abort();
    }

    private pIdToTerminate(pId:number):void{
        this._dialogPIdToCancel = pId;
    }


    getFileSystemUpdateInfo(srcPath:string, destPath:string, fileCount:number, copiedFiles:number, fileName:string):FileSystemUpdateInfo{
        return{
            srcPath,
            destPath,
            totalNumberOfFiles: fileCount,
            numberOfFilesCopied: copiedFiles,
            fileName
        };
    }

    public async createFolderAsync(directory: string, folderName: string): Promise<boolean> {
        const folderPath = `${directory}/${folderName}`;
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
            const uniqueFolderPath = this.IncrementFileName(folderPath);
            const retryResult = await this.createFolderRawAsync(uniqueFolderPath);

            if (retryResult === 0) {
                this._generatedName = uniqueFolderPath;
                // Folder created successfully after name iteration
                this._fileExistsMap.set(uniqueFolderPath, String(0));
                this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                return true;
            } else {
                console.error(`createFolderAsync Iterate Error`);
                return false;
            }
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


    public async geFileMetaData(path: string): Promise<FileMetaData> {
        return new Promise((resolve) =>{
            this._fileSystem.exists(path, (exits)=>{
                if(!exits){
                    console.error('getExtraFileMetaDataAsync: does not exists',exits);
                   resolve(new FileMetaData());
                }

                this._fileSystem.stat(path, (err, stats) =>{
                    if(err){
                        console.error('getExtraFileMetaDataAsync error:',err)
                        resolve(new FileMetaData());
                    }
                    resolve(new FileMetaData(stats?.atime, stats?.birthtime, stats?.mtime, stats?.size, stats?.blksize, stats?.mode, stats?.isDirectory()));
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
                    console.log('Succes reading file');
                    return resolve(contents);
                }

                console.error('Error reading file:', readErr);
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
 
        const opensWith = Constants.EMPTY_STRING;
        this._fileInfo = new FileInfo();

        const useImage = true;
		const isFile = true;
        const extension = extname(path);
        const fileMetaData = await this.geFileMetaData(path);
        
        if(!extension){
            const fc = await this.setOtherFolderProps(path, fileMetaData.getIsDirectory) as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, !isFile, opensWith, Constants.EMPTY_STRING, !useImage, undefined, fc);
            this._fileInfo.setIconPath = await this.changeFolderIcon(fc.fileName, fc.iconPath, path);
        }
        else if(extension === Constants.URL){
            const sc = await this.getShortCutFromURL(path);
            this._fileInfo = this.populateFileInfo(path, fileMetaData, isFile, opensWith, Constants.EMPTY_STRING, useImage, sc);
            this._fileInfo.setIsShortCut = true;
        }
        else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)
			|| Constants.VIDEO_FILE_EXTENSIONS.includes(extension)
			|| Constants.AUDIO_FILE_EXTENSIONS.includes(extension)
			|| Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension)){

			let fileContent:FileContent| undefined = undefined;
			const opensWith = this.getOpensWith(extension);

			if(opensWith.fileType === 'image' ||opensWith.fileType === 'video' || opensWith.fileType === 'audio' )
                fileContent = await this.getFileContentFromB64DataUrl(path, opensWith.fileType) as FileContent;

            this._fileInfo = this.populateFileInfo(path, fileMetaData, isFile, opensWith.appName, opensWith.appIcon, !useImage, undefined, fileContent);

        }else if(Constants.KNOWN_FILE_EXTENSIONS.includes(extension)){
            const opensWith = this.getOpensWith(extension);

            let fileContent:FileContent| undefined = undefined;
			if(opensWith.fileType === 'swf' ||opensWith.fileType === 'pdf')
                fileContent = await this.getFileContentFromB64DataUrl(path, opensWith.fileType) as FileContent;

            this._fileInfo = this.populateFileInfo(path, fileMetaData, isFile, opensWith.appName, opensWith.appIcon, !useImage, undefined, fileContent);
		} else{
            this._fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}unknown.png`;
            this._fileInfo.setCurrentPath = path;
            this._fileInfo.setDateAccessed = fileMetaData.getAccessDate;
            this._fileInfo.setDateCreated = fileMetaData.getCreatedDate;
            this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
            this._fileInfo.setSizeInBytes = fileMetaData.getSize;
            this._fileInfo.setBlkSizeInBytes = fileMetaData.getBlkSize;
            this._fileInfo.setFileName = basename(path, extname(path));
            this._fileInfo.setFileExtension = extension;
        }
        this.addAppAssociaton(this._fileInfo.getOpensWith, this._fileInfo.getIconPath);

        return this._fileInfo;
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
            '.zip': { fileType: cleanedExt, appName: 'fileexlporer', appIcon: 'zip_file.png' },
		};

		if (Constants.KNOWN_FILE_EXTENSIONS.includes(extension) && knownFileHandlers[extension]) {
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
                    console.error('getFileConetentFromB64DataUrlAsync error:',err)
                return this.populateFileContent();
                }

                const encoding:BufferEncoding = 'utf8';
                const utf8Data = contents.toString(encoding);
                
                if (!this.isUtf8Encoded(utf8Data)) {
                    return  resolve(this.createFileContentFromBuffer(contents, contentType, path));
                }

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
        const isDataUrl = (dataPrefix === 'data:')

        return isDataUrl;
    }

	private createFileContentFromBuffer(buffer: Buffer, contentType: string, path: string): FileContent {
		const fileUrl = this.bufferToUrl2(buffer);
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
        if(!result){ return result }

        folderToProcessingQueue.push(srcPath);
        const isRenameSuccessful =  await this.moveHandlerBAsync(destPath, folderToProcessingQueue, folderToDeleteStack, 0);
        if(isRenameSuccessful){
          await this.deleteEmptyFolders(folderToDeleteStack);
        }

        return isRenameSuccessful;
    }

    //virtual filesystem, use copy and then delete
    public async moveAsync(srcPath: string, destPath: string, isFile?: boolean, isRecycleBin?: boolean): Promise<boolean> {
        const isDirectory = (isFile === undefined) ? await this.isDirectory(srcPath) : !isFile;
        
        if(isDirectory){
            const folderToProcessingQueue:string[] =  [];
            const folderToDeleteStack:string[] =  [];
            let result = false;

            folderToProcessingQueue.push(srcPath);

            const count = await this.getFullCountOfFolderItemsInt(srcPath);
            const fileCount = count.files;
    
            const firstMsg = 'Estimating';
            const title = 'Moving';
            const dialogPId = this.initFileTransfer(firstMsg, title);
            this.sendFirstUpdate(dialogPId);

            //check if destPath Exists
            const exists = await this.exists(destPath);
            if(exists){
                result = await this.moveHandlerAAsync(destPath, folderToProcessingQueue, folderToDeleteStack, isRecycleBin);
            }else{
                result =  await this.moveHandlerBAsync(destPath, folderToProcessingQueue, folderToDeleteStack, 0);
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

    /**
     * This move method assumes that the destination folder already exists, and that source folder and it's contents
     * are being moved into a new folder (destination folder)
     * @param destPath 
     * @param folderToProcessingQueue 
     * @returns 
     */
    private async moveHandlerAAsync(destPath:string, folderToProcessingQueue:string[], folderToDeleteStack:string[], isRecycleBin?: boolean):Promise<boolean>{

        if(folderToProcessingQueue.length === 0)
            return true;

        const srcPath = folderToProcessingQueue.shift() || Constants.EMPTY_STRING;
        const folderName = this.getNameFromPath(srcPath);
        folderToDeleteStack.push(srcPath);

        const loadedDirectoryEntries = await this.readDirectory(srcPath);
        const  moveFolderResult = await this.createFolderAsync(destPath,folderName);
        if(moveFolderResult){
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.isDirectory(`${srcPath}/${directoryEntry}`);
                if(checkIfDirResult){
                    folderToProcessingQueue.push(`${srcPath}/${directoryEntry}`);
                }else{
                    const result = await this.moveFileAsync(`${srcPath}/${directoryEntry}`, `${destPath}/${folderName}`, undefined, isRecycleBin);
                    if(result){
                        //console.log(`file:${srcPath}/${directoryEntry} successfully moved to destination:${destPath}/${folderName}`);
                    }else{
                        console.error(`file:${srcPath}/${directoryEntry} failed to move to destination:${destPath}/${folderName}`)
                    }
                }
            }
        }else{
            console.error(`folder:${destPath}/${folderName}  creation failed`);
            return false;
        }

        return this.moveHandlerAAsync(`${destPath}/${folderName}`, folderToProcessingQueue, folderToDeleteStack, isRecycleBin);
    }

    /**
     * This move method assumes that the destination folder doesn't exist, and that only the contents of the source folder and not the source
     * folder itself, is being moved
     * @param destPath 
     * @param folderToProcessingQueue 
     * @param folderToDeleteStack 
     * @param skipCounter 
     * @returns 
     */
    private async moveHandlerBAsync(destPath:string, folderToProcessingQueue:string[], folderToDeleteStack:string[], skipCounter:number):Promise<boolean>{
        if(folderToProcessingQueue.length === 0)
            return true;

        const srcPath = folderToProcessingQueue.shift() || Constants.EMPTY_STRING;
        folderToDeleteStack.push(srcPath);
        let folderName = this.getNameFromPath(srcPath);
        if(skipCounter === 0){ folderName = Constants.EMPTY_STRING; }

        let  moveFolderResult = false;
        const loadedDirectoryEntries = await this.readDirectory(srcPath);

        //skip creating the 
        if(skipCounter > 0){
            moveFolderResult = await this.createFolderAsync(destPath,folderName);  
        }
        skipCounter = skipCounter + 1;
    
        if(moveFolderResult || (skipCounter >= 0)){
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.isDirectory(`${srcPath}/${directoryEntry}`);
                if(checkIfDirResult){
                    folderToProcessingQueue.push(`${srcPath}/${directoryEntry}`);
                }else{
                    const result = await this.moveFileAsync(`${srcPath}/${directoryEntry}`, `${destPath}/${folderName}`);
                    if(result){
                        // console.log(`file:${srcPath}/${directoryEntry} successfully moved to destination:${destPath}/${folderName}`);
                    }else{
                        console.error(`file:${srcPath}/${directoryEntry} failed to move to destination:${destPath}/${folderName}`)
                    }
                }
            }
        }else{
            console.error(`folder:${destPath}/${folderName} creation failed`);
            return false;
        }

        return this.moveHandlerBAsync(`${destPath}/${folderName}`, folderToProcessingQueue, folderToDeleteStack, skipCounter);
    }

    //virtual filesystem, use copy and then delete. There is a BrowserFS bug causing an error to be thrown
    private async moveFileAsync(srcPath: string, destPath: string, generatePath?: boolean, isRecycleBin?: boolean): Promise<boolean> {
        let destinationPath = Constants.EMPTY_STRING;
        if (generatePath === undefined || generatePath){
            const fileName = (isRecycleBin)
                ?  this.appendToFileName(this.getNameFromPath(srcPath), "_rst") 
                : this.getNameFromPath(srcPath);

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
            // console.log('writeFileAsync: file successfully written');
            this._fileExistsMap.set(destPath, String(0));
            this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);

            await this.recalculateUsedStorage();
            return true;
        }

        if(writeResult === 1){
            console.warn('writeFileAsync: file already exists');
            this._isDuplicate = true;
            const newFileName = this.IncrementFileName(destPath);
            const writeRetry = await this.writeRawAsync(newFileName, cntnt, 'wx');

            if(writeRetry === 0){
                // console.log('writeFileAsync: file successfully written');
                this._fileExistsMap.set(newFileName, String(0));
                this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap);
                this._generatedName = newFileName;
                await this.recalculateUsedStorage();
                return true;
            }else{
                console.error('writeFileAsync Iterate Error:',);
                return false;
            }
        }
        else
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
        const destPath = `${this.pathCorrection(path)}/${file.getFileName}`;

        const result =  await this.writeRawHandlerAsync(destPath, cntnt);
        if(result){
            const isFile = true;
            const fPath = (this._isDuplicate) ? `${this.pathCorrection(path)}/${this._generatedName}` : destPath;
            await  this._fileIndexerService.addNotify(fPath, isFile);

            this._isDuplicate = false;
            this._generatedName = Constants.EMPTY_STRING;
        }

        return result;
    }

    public async renameAsync(path:string, newFileName:string, isFile?:boolean): Promise<boolean> {
        const rename = `${dirname(path)}/${newFileName}`;
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

    public async deleteAsync(path:string, isFile?:boolean, isRecycleBin?:boolean):Promise<boolean> {
        // is file or folder is not currently in the bin, move it to the bing
        if(isRecycleBin){
            return await this.deleteFolderHandlerAsync(Constants.EMPTY_STRING, path, isRecycleBin);
        }

        if(!path.includes(Constants.RECYCLE_BIN_PATH)){
            const name = this.getNameFromPath(path);
            this._restorePoint.set(`${Constants.RECYCLE_BIN_PATH}/${name}`, path);
            this.addAndUpdateSessionData(this.fileServiceRestoreKey, this._restorePoint);

            this.DecrementFileName(path);
            this.removeAndUpdateSessionData(this.fileServiceIterateKey, path, this._fileExistsMap);
            //move to rbin
            return await this.moveAsync(path, Constants.RECYCLE_BIN_PATH, isFile);
        }else{
            this.removeAndUpdateSessionData(this.fileServiceRestoreKey, path, this._restorePoint);
            const isDirectory = (isFile === undefined) ? await this.isDirectory(path) : !isFile;
            const result = isDirectory
                ? await this.deleteFolderHandlerAsync(Constants.EMPTY_STRING, path, isRecycleBin)
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

    private async deleteFolderHandlerAsync(arg0: string, srcPath: string, isRecycleBin?:boolean): Promise<boolean> {
        const loadedDirectoryEntries = await this.readDirectory(srcPath);
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${srcPath}/${directoryEntry}`;
            this.removeAndUpdateSessionData(this.fileServiceRestoreKey, entryPath, this._restorePoint);

            const checkIfDirectory = await this.isDirectory(entryPath);
            if(checkIfDirectory){
                // Recursively call the rm_dir_handler for the subdirectory
                const success = await this.deleteFolderHandlerAsync(arg0, entryPath);
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
        for(let i = 0; i <= folders.length; i++){
            const path = folders.pop();
            if(path){
                await this.deleteFolderAsync(path);                    
            }
        }
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

    private async zipEntity(srcPath: string, isDirectory: boolean): Promise<boolean> {
        const directory = dirname(srcPath);
        const zipFileName = this.changeExtToZip(this.getNameFromPath(srcPath));
        const zipFilePath = `${directory}/${zipFileName}`;

        const zip = new JSZip();
        const result = isDirectory
            ? await this.zipEntityHandlerAsync(srcPath, zip)
            : await this.zipFile(srcPath, zip);

        if (!result) return false;

        const data = await zip.generateAsync({ type: "blob" });
        const writeResult = await this.writeRawAsync(zipFilePath, data);

        return writeResult === 0;
    }

    private changeExtToZip(filename: string): string {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1
            ? `${filename}.cab`
            : `${filename.slice(0, lastDotIndex)}.cab`;
    }

    private async zipFile(srcPath: string, zip: JSZip): Promise<boolean> {
        const extension = extname(srcPath);
        const contents = await this.readRawAsync(srcPath); // Returns Uint8Array or null/undefined

        if (!contents) return false;

        const fileName = this.getNameFromPath(srcPath);

        if (Constants.AUDIO_FILE_EXTENSIONS.includes(extension) ||
            Constants.IMAGE_FILE_EXTENSIONS.includes(extension) ||
            Constants.VIDEO_FILE_EXTENSIONS.includes(extension)) {
            const utf8Data = new TextDecoder("utf-8").decode(contents);

            const isBase64 = this.isDataUrl(utf8Data);
            const data = isBase64
                ? utf8Data.split(Constants.COMMA)[1]
                : contents;

            zip.file(fileName, data, isBase64 ? { base64: true } : { binary: true });
        } else {
            zip.file(fileName, contents, { binary: true });
        }

        return true;
    }

    private async zipEntityHandlerAsync(srcPath: string, zip: JSZip): Promise<boolean> {
        const entries = await this.readDirectory(srcPath);

        for (const entry of entries) {
            const entryPath = `${srcPath}/${entry}`;
            const isDir = await this.isDirectory(entryPath);
            const entryName = this.getNameFromPath(entryPath);

            if (isDir) {
                const subfolder = zip.folder(entryName);
                if (!subfolder) {
                    console.error(`Failed to create subfolder in zip: ${entryPath}`);
                    return false;
                }

                const success = await this.zipEntityHandlerAsync(entryPath, subfolder);
                if (!success) {
                    console.error(`Failed to zip directory: ${entryPath}`);
                    return false;
                }
            } else {
                const success = await this.zipFile(entryPath, zip);
                if (!success) {
                    console.error(`Failed to zip file: ${entryPath}`);
                    return false;
                }
            }
        }

        return true;
    }

    // private async zipFolder(srcPath:string, zip:JSZip): Promise<boolean>{

    // }

    private async unZipEntity(srcPath: string): Promise<void>{
        const zipFile = await this.readRawAsync(srcPath);
        
        if(zipFile){
            const zip = await JSZip.loadAsync(zipFile); // zipFile is a Blob or ArrayBuffer

            const file = zip.file('hello.txt');
            // const content = await file.async('text');
            // console.log(content);
        }
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
     *if file exists, increment it simple.txt, simple(1).txt ... 
     * @param path 
     * @returns 
     */
    public IncrementFileName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = Number(this._fileExistsMap.get(path) ?? 0);
        count = count + 1;
        this._fileExistsMap.set(path, String(count));

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }

    public DecrementFileName(path:string):void{

        let count  = Number(this._fileExistsMap.get(path) ?? 0);
        if(count > 0){
            count = count - 1;
            this._fileExistsMap.set(path, String(count));
        }else{
            if(this._fileExistsMap.get(path))
                this._fileExistsMap.delete(path);
        }
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

    private appendToFileName(filename: string, appStr:string): string {
        const lastDotIndex = filename.lastIndexOf(Constants.DOT);

        // If no dot is found (no extension),
        // append "_rs" to the end
        if (lastDotIndex === -1) 
            return filename + appStr;
    
        const name = filename.substring(0, lastDotIndex);
        const extension = filename.substring(lastDotIndex); // Includes the dot

        return name + appStr + extension;
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

    private bufferToUrl(buffer:Buffer):string{
       return URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
    }

    private bufferToUrl2(arr:Uint8Array):string{
        return URL.createObjectURL(new Blob([arr]));
    }

    // private uint8ToBase64(arr:Uint8Array):string{
    //     const base64String = btoa(String.fromCharCode(...new Uint8Array(arr)));
    //     return base64String;
    // }

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

    private isUtf8Encoded(data: string): boolean {
        try {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(data);
          const decoder = new TextDecoder('utf-8', { fatal: true });
          decoder.decode(bytes);
          return true;
        } catch (error) {
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

    private initFileTransfer(firstMsg:string, title:string):number{
        this._userNotificationService.showFileTransferNotification(firstMsg, title);
        return this._userNotificationService.getDialogPId();
    }

    private sendFirstUpdate(dialogPId:number,):void{
        //console.log('copyAsync dialogPid:',dialogPId);
        const firstUpdate:InformationUpdate = {pId:dialogPId, appName:this.FILE_TRANSFER_DIALOG_APP_NAME, info:[`firstData:0`]}
        this._systemNotificationService.updateInformationNotify.next(firstUpdate);
    }

    private sendFileTransferInformationUpdate(dialogPId:number, update:FileSystemUpdateInfo):void{
        const firstUpdate:InformationUpdate = {pId:dialogPId, appName:this.FILE_TRANSFER_DIALOG_APP_NAME, 
            info:[`srcPath:${update.srcPath}`,
                  `destPath:${update.destPath}`,
                  `totalNumberOfFiles:${update.totalNumberOfFiles}`, 
                  `numberOfFilesCopied:${update.numberOfFilesCopied}`,
                  `fileName:${update.fileName}`
            ]}
        this._systemNotificationService.updateInformationNotify.next(firstUpdate);
    }

    // checkIfFileDropEventTriggered():boolean{
    //     return this._isFileDropEventTriggered;
    // }

    // setFileDropEventTriggeredFlag(flag:boolean):void{
    //     this._isFileDropEventTriggered = flag;
    // }

    removeExtensionFromName(name:string):string{
        return basename(name, extname(name));
    }


    private addAndUpdateSessionData(key:string, map:Map<string, string>):void{
        this._sessionManagmentService.addMapBasedSession(key, map);
    }

    private removeAndUpdateSessionData(key:string, path:string, map:Map<string, string>):void{
        if(key === this.fileServiceRestoreKey && map.has(path)){
            map.delete(path);
            this._sessionManagmentService.addMapBasedSession(key, map);
        }else{
            this._sessionManagmentService.addMapBasedSession(key, map);
        }
    }

    private retrievePastSessionData(key:string):void{
        const sessionData = this._sessionManagmentService.getMapBasedSession(key) as Map<string, string>;
        console.log(`${key} sessionData:`, sessionData);
        if(sessionData){
            if(key === this.fileServiceRestoreKey)
                this._restorePoint = sessionData;
            else
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