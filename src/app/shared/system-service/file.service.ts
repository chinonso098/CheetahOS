import { Injectable } from "@angular/core";
import { basename, extname } from '@zenfs/core/path';
import { FileInfo } from "src/app/system-files/file.info";
import { ShortCut } from 'src/app/system-files/shortcut';

import { Buffer } from 'buffer';
import ini from 'ini';
import { delay, Subject } from 'rxjs';

import * as log from 'kerium/log';
import { IndexData } from '@zenfs/core';
import { Exception } from "kerium";
import { configure, CopyOnWrite, Fetch, default as fs } from '@zenfs/core';

import { IndexedDB } from '@zenfs/dom';
import { Journal } from '@zenfs/core';
import OSFileSystemIndex from '../../../../index.json';
import { dirname } from 'path';

import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { BaseService } from "./base.service.interface";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { SessionManagmentService } from "./session.management.service";
import { UserNotificationService } from "./user.notification.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { FileContent } from "src/app/system-files/file.content";
import { OpensWith } from "src/app/system-files/opens.with";
import { FileMetaData } from "src/app/system-files/file.metadata";
import { CommonFunctions } from "src/app/system-files/common.functions";
/// <reference types="node" />

const fsPrefix = 'osdrive';
const currentURL = window.location.href;
const journal = new Journal();
const journalData = localStorage.getItem('fs:journal');

console.log('currentURL:', currentURL)

log.configure({
	enabled: true,
	level: 'debug',
	format: log.fancy({ style: 'css', colorize: 'level' }),
	output: console.log,
});


if (journalData !== null){
    journal.fromString(journalData);
}
journal.on('update', () => localStorage.setItem('fs:journal', journal.toString()));

export const configuredFS = configure({
    mounts: {
        '/': {
            backend: CopyOnWrite,
            journal,  
            readable: {
                backend: Fetch,
                index: OSFileSystemIndex as IndexData,
                baseUrl: `${currentURL}${fsPrefix}`,
            },
            writable: {
                backend: IndexedDB,
                storeName: 'fs-cache',
            },
        },
    }
});

//IIFE
// (async () => {
//     const delay = 2500; //2.5sec
//   // Asynchronous code using await
//   await CommonFunctions.sleep(delay);
//   this.
// })();


@Injectable({
    providedIn: 'root'
})

export class FileService implements BaseService{
	private _fileInfo!:FileInfo;

    private _fileExistsMap!:Map<string, string>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _eventOriginator = Constants.EMPTY_STRING;

    private _fileDragAndDrop!:FileInfo[];

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _userNotificationService:UserNotificationService
    private _sessionManagmentService:SessionManagmentService;

    private _isCalculated = false;
    private _usedStorageSizeInBytes = 0;


	dirFilesUpdateNotify: Subject<void> = new Subject<void>();
    fetchDirectoryDataNotify: Subject<string> = new Subject<string>();
    goToDirectoryNotify: Subject<string[]> = new Subject<string[]>();

	readonly fileServiceRestoreKey = Constants.FILE_SVC_RESTORE_KEY;
    readonly fileServiceIterateKey = Constants.FILE_SVC_FILE_ITERATE_KEY;

	name = 'file_svc2';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem ';


	constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagmentService:SessionManagmentService ){ 
		
        this._fileExistsMap =  new Map<string, string>();
        this._restorePoint =  new Map<string, string>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
        this._fileDragAndDrop = [];

        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._userNotificationService = userNotificationService;
        this._sessionManagmentService = sessionManagmentService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.retrievePastSessionData(this.fileServiceRestoreKey);
        this.retrievePastSessionData(this.fileServiceIterateKey);
    }

    private async postZenFsInit(): Promise<void> {
        await this.calculateUsedStorage();
    }  

	async isDirectory(path: string):Promise<boolean>{
		 await configuredFS;

		try{
			const stats = await fs.promises.stat(path)
			return stats.isDirectory();
		}catch(err){
			console.error('isDirectory:', err);
			return false;
		}
	}

	async exists(dirPath: string): Promise<boolean> {
		await configuredFS;
		try{
			return fs.promises.exists(dirPath);
		}catch (err){
			console.error('exists:', err);
			return false;
		}
	}

	public async copyAsync(srcPath:string, destPath:string, isFile?:boolean):Promise<boolean>{
        const isDirectory = (isFile === undefined) ? await this.isDirectory(srcPath) : !isFile;

        return isDirectory
            ? await this.copyFolderHandlerAsync(Constants.EMPTY_STRING, srcPath, destPath)
            : await this.copyFileAsync(srcPath, destPath);
    }

    private async copyFileAsync(srcPath:string, destPath:string):Promise<boolean>{
		await configuredFS;
		
        const name = this.getNameFromPath(srcPath);
        const destinationPath = `${this.pathCorrection(destPath)}/${name}`;
        // console.log(`Destination: ${destinationPath}`);

        const readResult = await fs.promises.readFile(srcPath);
        if(!readResult){
            return false;
        }

        return await this.writeRawHandlerAsync(destinationPath, readResult);
    }

    private async copyFolderHandlerAsync(arg0:string, srcPath:string, destPath:string):Promise<boolean>{

        const folderName = this.getNameFromPath(srcPath);
        const  createFolderResult = await this.createFolderAsync(destPath, folderName);
        if(createFolderResult){
            const loadedDirectoryEntries = await this.readDirectory(srcPath);
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.isDirectory(`${srcPath}/${directoryEntry}`);
                if(checkIfDirResult){
                    const result = await this.copyFolderHandlerAsync(arg0,`${srcPath}/${directoryEntry}`,`${destPath}/${folderName}`);
                    if(!result){
                        console.error(`Failed to copy directory: ${srcPath}/${directoryEntry}`);
                        return false;
                    }
                }else{
                    const result = await this.copyFileAsync(`${srcPath}/${directoryEntry}`, `${destPath}/${folderName}`);
                    if(result){
                        //console.log(`file:${srcPath}/${directoryEntry} successfully copied to destination:${destPath}/${folderName}`);
                    }else{
                        console.error(`file:${srcPath}/${directoryEntry} failed to copy to destination:${destPath}/${folderName}`)
                        return false
                    }
                }
            }
        }

        return true
    }

	async readDirectory(path: string): Promise<string[]> {
		await configuredFS;

		try{
			return await fs.promises.readdir(path)
		}catch (err){
			console.error('readdir:', err);
			return [];
		}

	}

	async loadDirectoryFiles(path: string): Promise<FileInfo[]>{
        await configuredFS;
        console.log('loadDirectoryFiles:', path);
        if(!this._isCalculated)
            await this.postZenFsInit();
        
		try{
            const files:FileInfo[] = [];
            const directoryEntries = await this.readDirectory(path);

            for(const entry of directoryEntries){
                const file =  await this.getFileInfo(`${path}/${entry}`);
                files.push(file);
            }

            return files;
		}catch(err){
			console.error('loadDirectoryFiles:',err);
			return [];
		}
	}
	
	private async getFileInfo(path:string):Promise<FileInfo>{
 
        let opensWith = Constants.EMPTY_STRING;
        this._fileInfo = new FileInfo();

        const useImage = true;
		const isFile = true;
        const extension = extname(path);
        const fileMetaData = await this.getFileMetaData(path);
        
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
            	fileContent = await this.getFileContentFromB64DataUrl(path, 'image') as FileContent;

            this._fileInfo = this.populateFileInfo(path, fileMetaData, isFile, opensWith.appName, opensWith.appIcon, !useImage, undefined, fileContent);

        }else if(Constants.KNOWN_FILE_EXTENSIONS.includes(extension)){
			const opensWith = this.getOpensWith(extension);
 			this._fileInfo = this.populateFileInfo(path, fileMetaData, isFile, opensWith.appName, opensWith.appIcon);
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

	private getOpensWith(extension: string): OpensWith{
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
			'.pdf': { fileType: cleanedExt, appName: 'pdfviewer', appIcon: 'pdf_file.png' }
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
            fileInfo.setIconPath = (useImage)? shortCut?.getIconPath || img : img;
            fileInfo.setContentPath = shortCut?.getContentPath || Constants.EMPTY_STRING;
            fileInfo.setFileType = shortCut?.getFileType || extname(path);
            fileInfo.setFileName = shortCut?.geFileName || basename(path, extname(path));
            fileInfo.setOpensWith = shortCut?.getOpensWith || opensWith;
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

	public async getFileAsTextAsync(path:string): Promise<string> {
		await configuredFS;

        if (!path) {
            console.error('getFileAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        const readResult = await fs.promises.readFile(path);
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
		await configuredFS;

        if (!path) {
            console.error('getFileBlobAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        const readResult = await fs.promises.readFile(path);
        if(readResult)
            return  this.bufferToUrl(readResult);
        else
            return Constants.EMPTY_STRING;
    }


	public async getFileContentFromB64DataUrl(path: string, contentType: string): Promise<FileContent> {
		await configuredFS;

		try {
			const contents = await fs.promises.readFile(path);
			const utf8Data = contents.toString('utf8');

			if (!this.isUtf8Encoded(utf8Data)) {
				return this.createFileContentFromBuffer(contents, contentType, path);
			}

			const dataPrefix = utf8Data.substring(0, 10);
			const isDataUrl = (dataPrefix === 'data:image') || (dataPrefix === 'data:video') || (dataPrefix === 'data:audio');

			if (isDataUrl) {
				const base64Data = utf8Data.split(Constants.COMMA)[1];
				const binaryData = Buffer.from(base64Data, 'base64');
				const fileUrl = this.bufferToUrl(binaryData);

				return this.createFileContent(fileUrl, path, dataPrefix === 'data:image');
			} else {
				return this.createFileContentFromBuffer(contents, contentType, path);
			}
		} catch (err) {
			console.error('getFileContentFromB64DataUrl:', err);
			return this.populateFileContent();
		}
	}

    public async getFileMetaData(path: string): Promise<FileMetaData> {
        await configuredFS;

        try{
            const stats = await fs.promises.stat(path);
            return new FileMetaData(stats?.atime, stats?.birthtime, stats?.mtime, stats?.size, stats?.blksize, stats?.mode, stats?.isDirectory());
        }catch(err){
            console.error('getFileMetaData:', err);
            return new FileMetaData();
        }
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
    
    public async getShortCutFromURL(path:string):Promise<ShortCut>{
		await configuredFS;
        
		try{
			const contents = await fs.promises.readFile(path);
			const stage = contents? contents.toString(): Buffer.from(Constants.EMPTY_STRING).toString();
			const shortCut = ini.parse(stage) as unknown || {InternetShortcut:{ FileName:'hi', IconPath:Constants.EMPTY_STRING, FileType:Constants.EMPTY_STRING,ContentPath:Constants.EMPTY_STRING, OpensWith:Constants.EMPTY_STRING}};
			
			if (typeof shortCut === 'object') {
				const iSCut = (shortCut as {InternetShortcut:unknown})?.['InternetShortcut'];
				const  fileName=  (iSCut as {FileName:unknown})?.['FileName'] as string;
				const iconPath = (iSCut as {IconPath:unknown})?.['IconPath'] as string;
				const fileType = (iSCut as {FileType:unknown})?.['FileType'] as string;
				const contentPath = (iSCut as {ContentPath:unknown})?.['ContentPath'] as string;
				const opensWith = (iSCut as {OpensWith:unknown})?.['OpensWith'] as string;
				return new ShortCut(iconPath,fileName,fileType,contentPath,opensWith);
			}
		
			return this.createEmptyShortCut();
		}catch(error){
			console.error('getShortCutFromURLAsync:', error);
			return this.createEmptyShortCut();
		}
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

        //const result = await fs.promises.exists(iconMaybe);
		 const result = await fs.promises.exists(iconMaybe);
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

	public async createFolderAsync(directory: string, folderName: string): Promise<boolean> {
		await configuredFS;
        const folderPath = `${directory}/${folderName}`;

		try{
			await fs.promises.mkdir(folderPath, 0o777);//.catch(e => {throw e.code});

			// Folder created successfully
			this._fileExistsMap.set(folderPath, String(0));
			return true;
		}catch (err:unknown){
			let error = err as Exception;
			if(error.code === 'EEXIST'){

				console.warn('createFolderAsync:', error.code);
				console.warn(`Folder already exists: ${folderPath}`);

				try{
					const uniqueFolderPath = this.IncrementFileName(folderPath);

					// Folder created successfully
					await fs.promises.mkdir(uniqueFolderPath, 0o777);//.catch(e => {throw e.code});
					this._fileExistsMap.set(uniqueFolderPath, String(0));

					return true;
				}catch(err){
					error = err as Exception;
					console.error('Error creating folder:', error);	
					return false;
				}
			}else{
				console.error('Error creating folder:', error);
				return false;
			}
		}
    }


	//O for success, 1 for file already present, 2 other error
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    private async writeRawAsync(destPath: string, content:any, flag:string = 'wx'): Promise<number>{
		await configuredFS;
		try{
			await fs.promises.writeFile(destPath, content, {flag: flag});
			return 0
		}catch(err:unknown){
			let error = err as Exception;

			if(error.code === 'EEXIST'){
				console.warn('writeRawAsync:', error.code);
				return 1;
			}else{
				console.error(`Error writing file: ${err}`);
				return 2;
			}
		}
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
            //this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap); TODO
            return true;
        }

        if(writeResult === 1){
            console.warn('writeFileAsync: file already exists');
            const newFileName = this.IncrementFileName(destPath);
            const writeResult2 = await this.writeRawAsync(newFileName, cntnt, 'wx');

            if(writeResult2 === 0){
                // console.log('writeFileAsync: file successfully written');
                this._fileExistsMap.set(newFileName, String(0));
                //this.addAndUpdateSessionData(this.fileServiceIterateKey, this._fileExistsMap); TODO
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
        return new Promise<boolean>((resolve, reject) => {
            const results: Promise<boolean>[] = [];

            files.forEach((file) => {
                const filePromise = new Promise<boolean>((fileResolve, fileReject) => {
                    const fileReader = new FileReader();
                    fileReader.readAsDataURL(file);

                    fileReader.onload = async (evt) => {
                        try {
                            const newFile: FileInfo = new FileInfo();
                            newFile.setFileName = file.name;

                            const result = evt.target?.result;
                            if (result instanceof ArrayBuffer) {
                                newFile.setContentBuffer = result;
                            } else {
                                newFile.setContentPath = result || Constants.EMPTY_STRING;
                            }
                            newFile.setCurrentPath = `${this.pathCorrection(directory)}/${file.name}`;

                            const success = await this.writeFileAsync(directory, newFile);
                            fileResolve(success);
                        } catch (err) {
                            fileReject(err);
                        }
                    };

                    fileReader.onerror = () => fileReject(fileReader.error);
                });

                results.push(filePromise);
            });

            // Wait for all files
            Promise.all(results)
                .then((values) => {
                    // Return false if any failed
                    resolve(values.every(v => v));
                })
                .catch((err) => reject(err));
        });
    }


    // public async writeFileWithProgress( file: File, directory: string,  onProgress: (percent: number) => void ): Promise<boolean> {
    // const filePath = `${this.pathCorrection(directory)}/${file.name}`;
    // const chunkSize = 1024 * 1024; // 1MB
    // const totalSize = file.size;
    // let offset = 0;

    // return new Promise((resolve, reject) => {
    //     fs.open(filePath, 'w', (err, fd) => {
    //     if (err) return reject(err);

    //     const writeNextChunk = async () => {
    //         if (offset >= totalSize) {
    //         fs.close(fd, (err) => {
    //             if (err) return reject(err);
    //             resolve(true);
    //         });
    //         return;
    //         }

    //         const chunk = file.slice(offset, offset + chunkSize);
    //         const buffer = new Uint8Array(await chunk.arrayBuffer());

    //         fs.write(fd, buffer, 0, buffer.length, offset, (err, written) => {
    //         if (err) return reject(err);

    //         offset += written;
    //         const percent = Math.round((offset / totalSize) * 100);
    //         onProgress(percent);

    //         writeNextChunk(); // Continue with next chunk
    //         });
    //     };

    //     writeNextChunk();
    //     });
    // });
    // }

    public async writeFileAsync(path:string, file:FileInfo):Promise<boolean>{
        const cntnt = (file.getContentPath === Constants.EMPTY_STRING)? file.getContentBuffer : file.getContentPath;
        const destPath = `${this.pathCorrection(path)}/${file.getFileName}`;

        return await this.writeRawHandlerAsync(destPath, cntnt);
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

	private async renameDirectoryAsync(srcPath:string, destPath:string):Promise<boolean>{
		await configuredFS;

        const folderToProcessingQueue:string[] =  [];
        const folderToDeleteStack:string[] =  [];

        //dir path can be gotten from either src or dest path;
        const  directoryPath = dirname(srcPath);
        const newName = this.getNameFromPath(destPath);

        const directoryExists = await fs.promises.exists(destPath);
        if(directoryExists){
            const msg = `Folder: ${newName}, already exists`;
            this._userNotificationService.showErrorNotification(msg);
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

    private async renameDirectoryAsync_1(srcPath:string, destPath:string):Promise<boolean>{
		await configuredFS;

        const newName = this.getNameFromPath(destPath);

        const directoryExists = await fs.promises.exists(destPath);
        if(directoryExists){
            const msg = `Folder: ${newName}, already exists`;
            this._userNotificationService.showErrorNotification(msg);
            return false;
        }

        await fs.promises.rename(srcPath, destPath);
        
        return true;
    }

	 //virtual filesystem, use copy and then delete
    public async moveAsync(srcPath: string, destPath: string, isFile?: boolean, isRecycleBin?: boolean): Promise<boolean> {
		await configuredFS;

        const isDirectory = (isFile === undefined) ? await this.isDirectory(srcPath) : !isFile;
        if(isDirectory){
            const folderToProcessingQueue:string[] =  [];
            const folderToDeleteStack:string[] =  [];
            let result = false;

            folderToProcessingQueue.push(srcPath);

            //check if destPath Exists
            const exists = await fs.promises.exists(destPath);
            if(exists){
                result = await this.moveHandlerAAsync(destPath, folderToProcessingQueue, folderToDeleteStack, isRecycleBin);
            }else{
                result =  await this.moveHandlerBAsync(destPath, folderToProcessingQueue, folderToDeleteStack, 0);
            }

            if(result){
                //if(isRecycleBin)
                    //this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint); //TODO
   
                await this.deleteEmptyFolders(folderToDeleteStack);
            }
            return result;
        }else{
           // if(isRecycleBin)
                //this.removeAndUpdateSessionData(this.fileServiceRestoreKey, srcPath, this._restorePoint); //TODO

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

	// private async moveFileAsync(srcPath: string, destPath: string, generatePath?: boolean, isRecycleBin?: boolean): Promise<boolean> {
	// 	await configuredFS;

    //     let destinationPath = Constants.EMPTY_STRING;
    //     if (generatePath === undefined || generatePath){
	// 		const fileName =  this.getNameFromPath(srcPath);
    //         destinationPath = `${destPath}/${fileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
    //     } else {
    //         destinationPath = destPath;
    //     }

	// 	try{
	// 		await fs.promises.rename(srcPath, destinationPath);
	// 		return true;
	// 	}catch(err){
	// 		console.error('moveFileAsync:', err);
	// 		return false;
	// 	}
    // }

        //virtual filesystem, use copy and then delete. 
    private async moveFileAsync(srcPath: string, destPath: string, generatePath?: boolean, isRecycleBin?: boolean): Promise<boolean> {
        await configuredFS;
        let destinationPath = Constants.EMPTY_STRING;
        if (generatePath === undefined || generatePath){
            const fileName =  this.getNameFromPath(srcPath);
            destinationPath = `${destPath}/${fileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
        } else {
            destinationPath = destPath;
        }

        const readResult = await fs.promises.readFile(srcPath);
        if(!readResult) return false;

        //overwrite the file
        const writeResult = await this.writeRawAsync(destinationPath, readResult, 'wx');
        if(writeResult !== 0)
            return false
        
        return await this.deleteFileAsync(srcPath);
    }


	private async renameURLFiles(srcPath:string, fileName:string): Promise<boolean> {

        const destPath = dirname(srcPath);
        const shortCutData = await this.getShortCutFromURL(srcPath);
        if(!shortCutData){
            console.warn('renameURLFiles: No shortcut data found for', srcPath);
            return false;
        }
      const shortCutContent = `[InternetShortcut]
FileName=${fileName} 
IconPath=${shortCutData.getIconPath}
FileType=${shortCutData.getFileType}
ContentPath=${shortCutData.getContentPath}
OpensWith=${shortCutData.getOpensWith}
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
            //this.addAndUpdateSessionData(this.fileServiceRestoreKey, this._restorePoint);

            //this.DecrementFileName(path);
            //this.removeAndUpdateSessionData(this.fileServiceIterateKey, path, this._fileExistsMap);
            //move to rbin
            return await this.moveAsync(path, Constants.RECYCLE_BIN_PATH, isFile);
        }else{
            //this.removeAndUpdateSessionData(this.fileServiceRestoreKey, path, this._restorePoint);
            const isDirectory = (isFile === undefined) ? await this.isDirectory(path) : !isFile;
            return isDirectory
                ? await this.deleteFolderHandlerAsync(Constants.EMPTY_STRING, path, isRecycleBin)
                : await this.deleteFileAsync(path);
        }
    }

    private async deleteFolderAsync(path:string): Promise<boolean> {
		await configuredFS;

		try{
			await fs.promises.rmdir(path);

			//this.DecrementFileName(path);
			//this.removeAndUpdateSessionData(this.fileServiceIterateKey, path, this._fileExistsMap); TODO
			return true;
		}catch(err){
			console.error('deleteFolderAsync:', err);
			return false;
		}
    }

    private async deleteFileAsync(srcPath: string): Promise<boolean> {
		await configuredFS;

		try{
			await fs.promises.unlink(srcPath);

			//this.DecrementFileName(srcPath);
			//this.removeAndUpdateSessionData(this.fileServiceIterateKey, srcPath, this._fileExistsMap); TODO
			return true;
		}catch(err:unknown){	
			console.error('deleteFileAsync:',err);
			return false;
		}
    }

    private async deleteFolderHandlerAsync(arg0: string, srcPath: string, isRecycleBin?:boolean): Promise<boolean> {

        const loadedDirectoryEntries = await this.readDirectory(srcPath);
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${srcPath}/${directoryEntry}`;
            //this.removeAndUpdateSessionData(this.fileServiceRestoreKey, entryPath, this._restorePoint); TODO

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

    public getFolderOrigin(path:string):string{
        if(this._restorePoint.has(path)){
            return this._restorePoint.get(path) || Constants.EMPTY_STRING;
        }
        return Constants.EMPTY_STRING;
    }

    /**
     *if file exists, increment it simple.txt, simple(1).txt ... 
     * @param path 
     * @returns 
     */
    private IncrementFileName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = Number(this._fileExistsMap.get(path) ?? 0);
        count = count + 1;
        this._fileExistsMap.set(path, String(count));

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }

    private DecrementFileName(path:string):void{

        let count  = Number(this._fileExistsMap.get(path) ?? 0);
        if(count > 0){
            count = count - 1;
            this._fileExistsMap.set(path, String(count));
        }else{
            if(this._fileExistsMap.get(path))
                this._fileExistsMap.delete(path);
        }
    }

	public async countFolderItems(path:string):Promise<number>{
		try{
			const dirFiles = await this.readDirectory(path);
			return (dirFiles?.length || 0);
		}catch(err:any){
			console.error('countFolderItems:', err);
			return 0;
		}
	}

	public  async getFullCountOfFolderItems(path:string): Promise<string> {

        const counts = { files: 0, folders: 0 };
        const queue:string[] = [];
        
        queue.push(path);
        await this.traverseAndCountFolderItems(queue, counts);
        return `${counts.files} Files, ${counts.folders} Folders`;
    }

    private  async traverseAndCountFolderItems(queue:string[], counts:{files: number, folders: number}): Promise<void> {

        if(queue.length === 0)
            return;

        const srcPath = queue.shift() || Constants.EMPTY_STRING;
 
        const directoryEntries = await this.readDirectory(srcPath);      
        for(const directoryEntry of directoryEntries){
			const directoryEntryPath = `${srcPath}/${directoryEntry}`;
            const isDirectory = await this.isDirectory(directoryEntryPath);
            if(isDirectory){
                queue.push(directoryEntryPath);
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

        const extraInfo = await fs.promises.stat(srcPath);
        sizes.folders += extraInfo.size;

        const directoryEntries = await this.readDirectory(srcPath);      
        for(const entry of directoryEntries){
            const entryPath = `${srcPath}/${entry}`;
            const isDirectory = await this.isDirectory(entryPath);

            if(isDirectory){
                queue.push(entryPath);
            }else{
                const extraInfo = await fs.promises.stat(entryPath);
                sizes.files += extraInfo.size;
            }
        }

        return this.traverseAndSumFolderSize(queue, sizes);
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


	private addAppAssociaton(appname:string, img:string):void{
        if(!this._fileAndAppIconAssociation.get(appname)){
            if(appname === 'photoviewer' || appname === 'videoplayer' || appname === 'audioplayer' || appname === 'ruffle'){
                this._fileAndAppIconAssociation.set(appname,`${Constants.IMAGE_BASE_PATH}${appname}.png`);
            }else{
                this._fileAndAppIconAssociation.set(appname, img);
            }
        }
    }

	private createEmptyShortCut(): ShortCut {
        const empty = Constants.EMPTY_STRING;
        return new ShortCut(empty, empty, empty, empty, empty);
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


//  async  renameFiles(srcPath: string, rename: string): Promise<void> {
// 	await this.initZenFS();
// 	const sirPath = '/Desktop/titanium.url';
// 	const destPath = `${dirname(sirPath)}/${rename}.url`;
// 	console.log('sirPath:', sirPath);
// 	console.log('destRath:', destPath);

// 	return await fs.promises.rename(sirPath, destPath);
// }

    private bufferToUrl(buffer:Buffer):string{
       return URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
    }

    private bufferToUrl2(arr:Uint8Array):string{
        return URL.createObjectURL(new Blob([arr]));
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

    addDragAndDropFile(file:FileInfo):void{
        this._fileDragAndDrop.push(file);
    }

    getDragAndDropFile():FileInfo[]{
        const result:FileInfo[] = [];
        result.push(...this._fileDragAndDrop);
        this._fileDragAndDrop = [];

        return result;
    }

    getEventOriginator():string{
        return this._eventOriginator;
    }

    removeEventOriginator():void{
        this._eventOriginator = Constants.EMPTY_STRING;
    }

	private retrievePastSessionData(key:string):void{
        const sessionData = this._sessionManagmentService.getFileServiceSession(key) as Map<string, string>;
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

