import { Injectable } from "@angular/core";
import { basename, extname, join, resolve } from '@zenfs/core/vfs/path.js';
import { FileInfo2 } from "src/app/system-files/file.info2";
import { ShortCut } from 'src/app/system-files/shortcut';


import { Buffer } from 'buffer';
import ini from 'ini';
import { Subject } from 'rxjs';

import type { Dirent, ErrnoError, IndexData, Stats } from '@zenfs/core';
import { configure, CopyOnWrite, Fetch, default as fs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
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
import { FileContent2 } from "src/app/system-files/file.content";
import { FileMetaData } from "src/app/system-files/file.metadata";
import { err, levels } from "@zenfs/core/internal/log.js";
import { debug } from "console";
/// <reference types="node" />

@Injectable({
    providedIn: 'root'
})

export class FileService2 implements BaseService{
	private _fileInfo!:FileInfo2;
	
	private _directoryFileEntires:FileEntry[]=[];
    private _fileExistsMap!:Map<string, string>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _eventOriginator = Constants.EMPTY_STRING;

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _userNotificationService:UserNotificationService
    private _sessionManagmentService:SessionManagmentService;

	readonly fileServiceRestoreKey = Constants.FILE_SVC_RESTORE_KEY;
    readonly fileServiceIterateKey = Constants.FILE_SVC_FILE_ITERATE_KEY;

	name = 'file_svc2';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = Constants.NUM_ZERO;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem ';


	constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagmentService:SessionManagmentService ){ 
        this._fileExistsMap =  new Map<string, string>();
        this._restorePoint =  new Map<string, string>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
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

	private async initializeZenFS():Promise<void>{
		const fsPrefix = 'osdrive';
		const currentURL = window.location.href;

		console.log('currentURL:',currentURL);
		await configure({
			mounts: {
				'/': {
					backend: CopyOnWrite,
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
		
			},
			// log:{
			// 	enabled:true,
			// 	level:'debug',
			// 	output:console.log
			// }
		});
	}

	private throwWithPath(error: ErrnoError): never {
		// We want the path in the message, since Angular won't throw the actual error.
		error.message = error.toString();
		throw error;
	}

	async isDirectory(path: string):Promise<boolean>{
		await this.initializeZenFS();

		try{
			const stats = await fs.promises.stat(path)
			return stats.isDirectory();
		}catch{
			console.error('isDirectory:', err);
			return false;
		}
	}

	async exists(dirPath: string): Promise<boolean> {
		await this.initializeZenFS();
		return fs.promises.exists(dirPath).catch(this.throwWithPath);
	}

	async copy(source: string, destination: string): Promise<void> {
		await this.initializeZenFS();
		const stats = await fs.promises.stat(destination);
		if (stats.isDirectory()) destination = join(destination, basename(source));
		await fs.promises.cp(source, destination).catch(this.throwWithPath);
	}

	async readdir(path: string): Promise<string[]> {
		await this.initializeZenFS();
		return await fs.promises.readdir(path).catch(this.throwWithPath);
	}

	async *loadDirectoryFiles(path: string): AsyncIterableIterator<FileInfo2> {
		await this.initializeZenFS();

		if (path === '/fileexplorer.url')
			 debugger;

		// for (const entry of await fs.promises
		// 	.readdir(path, { withFileTypes: true })
		// 	.catch(this.throwWithPath)) {
		// 	yield await this.getFileInfo(join(path, entry.path), entry);
		// }

		try{
			const readResult = await this.readdir(path)
			console.log('readResult:', readResult);
		}catch(err){
			console.error('loadDirectoryFiles:',err);
		}

	}
	
	public async getFileInfo(path:string, entry: Dirent):Promise<FileInfo2>{
        const extension = extname(path);
        this._fileInfo = new FileInfo2();
        //const fileMetaData = await this.getExtraFileMetaDataAsync(path) as FileMetaData;
     
        if(!extension){
            const fc = await this.setOtherFolderProps(path) as FileContent2;
            this._fileInfo = this.populateFileInfo(path,false, Constants.EMPTY_STRING, Constants.EMPTY_STRING, false, undefined, fc);
            this._fileInfo.setIconPath = await this.changeFolderIcon(fc.fileName, fc.iconPath, path);
        }
        else if(extension === Constants.URL){
            const sc = await this.getShortCutFromURL(path) as ShortCut;
            this._fileInfo = this.populateFileInfo(path, true, Constants.EMPTY_STRING, Constants.EMPTY_STRING, true, sc);
            this._fileInfo.setIsShortCut = true;
        }
        else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileContentFromB64DataUrl(path, 'image') as FileContent2;
            this._fileInfo = this.populateFileInfo(path, true,'photoviewer', 'image_file.png', false,undefined, fc);
        }
        else if(Constants.VIDEO_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileContentFromB64DataUrl(path, 'video') as FileContent2;
            this._fileInfo = this.populateFileInfo(path,  true, 'videoplayer', 'video_file.png', false,undefined, fc);
        }
        else if(Constants.AUDIO_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileContentFromB64DataUrl(path, 'audio') as FileContent2;
            this._fileInfo = this.populateFileInfo(path,  true, 'audioplayer', 'music_file.png', false, undefined, fc);

        }else if(Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension) || extension === '.wasm'){
            const img_file = (extension === '.wasm')? 'wasm_file.png' : 'code_file.png';
            this._fileInfo = this.populateFileInfo(path, true, 'codeeditor', img_file);
        }
        else if(extension === '.txt' || extension === '.properties' || extension === '.log'){
            this._fileInfo = this.populateFileInfo(path, true, 'texteditor', 'file.png');
        }
        else if(extension === '.md'){
            this._fileInfo = this.populateFileInfo(path, true, 'markdownviewer', 'markdown_file.png');
        }
        else if(extension === '.jsdos'){
            this._fileInfo = this.populateFileInfo(path, true, 'jsdos', 'js-dos_file.png');
        }
        else if(extension === '.swf'){
            this._fileInfo = this.populateFileInfo(path, true, 'ruffle', 'swf_file.png');
        }else if(extension === '.pdf'){
            this._fileInfo = this.populateFileInfo(path, true, 'pdfviewer', 'pdf.png');
        }
        else{
            this._fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}unknown.png`;
            this._fileInfo.setCurrentPath = path;
            this._fileInfo.setFileName = basename(path, extname(path));
            // this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
            // this._fileInfo.setSizeInBytes = fileMetaData.getSize;
            // this._fileInfo.setMode = fileMetaData.getMode;
            this._fileInfo.setFileExtension = extension;
        }
        this.addAppAssociaton(this._fileInfo.getOpensWith, this._fileInfo.getIconPath);
        return this._fileInfo;
    }


	populateFileInfo(path:string, isFile =true, opensWith:string, imageName?:string, useImage=false, shortCut?:ShortCut, fileCntnt?:FileContent2):FileInfo2{
        const fileInfo2 = new FileInfo2();
        const img = `${Constants.IMAGE_BASE_PATH}${imageName}`;

        // fileInfo.setCurrentPath = path;
        // if(shortCut !== undefined){
        //     fileInfo.setIconPath = (useImage)? shortCut?.getIconPath || img : img;
        //     fileInfo.setContentPath = shortCut?.getContentPath || Constants.EMPTY_STRING;
        //     fileInfo.setFileType = shortCut?.getFileType || extname(path);
        //     fileInfo.setFileName = shortCut?.geFileName || basename(path, extname(path));
        //     fileInfo.setOpensWith = shortCut?.getOpensWith || opensWith;
        // }else{
        //     fileInfo.setIconPath = (useImage)? fileCntnt?.iconPath || img : img;
        //     fileInfo.setContentPath = fileCntnt?.contentPath || Constants.EMPTY_STRING;
        //     fileInfo.setFileType = fileCntnt?.fileType || extname(path);
        //     fileInfo.setFileName = fileCntnt?.fileName || basename(path, extname(path));
        //     fileInfo.setOpensWith = fileCntnt?.opensWith || opensWith;
        // }
        // fileInfo.setIsFile = isFile;
        // fileInfo.setDateModified = fileMetaData.getModifiedDate;
        // fileInfo.setSizeInBytes = fileMetaData.getSize;
        // fileInfo.setMode = fileMetaData.getMode;
        // fileInfo.setFileExtension = extname(path);

        return fileInfo2;
    }

	public async getFileContentFromB64DataUrl(path: string, contentType: string): Promise<FileContent2> {
		await this.initializeZenFS();

		try {
			const contents = await fs.promises.readFile(path);
			const utf8Data = contents.toString('utf8');

			if (!this.isUtf8Encoded(utf8Data)) {
				return this.createFileContentFromBuffer(contents, contentType, path);
			}

			const dataPrefix = utf8Data.substring(Constants.NUM_ZERO, Constants.NUM_TEN);
			const isDataUrl = (dataPrefix === 'data:image') || (dataPrefix === 'data:video') || (dataPrefix === 'data:audio');

			if (isDataUrl) {
				const base64Data = utf8Data.split(',')[1];
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

	private createFileContentFromBuffer(buffer: Buffer, contentType: string, path: string): FileContent2 {
		const fileUrl = this.bufferToUrl2(buffer);
		return this.createFileContent(fileUrl, path, contentType === 'image');
	}

	private createFileContent(fileUrl: string,  path: string, isImage: boolean): FileContent2 {
		const fileName = basename(path, extname(path));
		return isImage
			? this.populateFileContent(fileUrl, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING)
			: this.populateFileContent(Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING);
	}

	private populateFileContent(iconPath = Constants.EMPTY_STRING, fileName = Constants.EMPTY_STRING, fileType = Constants.EMPTY_STRING, contentPath = Constants.EMPTY_STRING, opensWith = Constants.EMPTY_STRING ):FileContent2{
		return{
			iconPath: iconPath, fileName: fileName, fileType: fileType, contentPath: contentPath, opensWith: opensWith
		}
	}
    
    public async getShortCutFromURL(path:string):Promise<ShortCut>{
		await this.initializeZenFS();
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
				new ShortCut(iconPath,fileName,fileType,contentPath,opensWith);
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
            return (count === Constants.NUM_ZERO) 
                ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
                :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
        }

        if(path !== `/Users/${fileName}`)
            return iconPath;

        const result = await fs.promises.exists(iconMaybe);
        if(result){ 
            return `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
        }
		return iconPath;
    }

	private async setOtherFolderProps(path:string):Promise<FileContent2>{
        const fileName = basename(path, extname(path));
        let iconFile = Constants.EMPTY_STRING;
        const fileType = Constants.FOLDER;
        const opensWith = Constants.FILE_EXPLORER;

		try{
			const isDirectory = await this.isDirectory(path);
			if(!isDirectory){
				iconFile= `${Constants.IMAGE_BASE_PATH}unknown.png`;
				return this.populateFileContent(iconFile, fileName, Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING);
			}

			const count = await this.countFolderItems(path);
			if(count === Constants.NUM_ZERO){
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

	private async countFolderItems(path:string):Promise<number>{
		try{
			const dirFiles = await fs.promises.readdir(path);
			return (dirFiles?.length || Constants.NUM_ZERO);
		}catch(err:any){
			console.error('countFolderItems:', err);
			return Constants.NUM_ZERO;
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

	private createEmptyShortCut(): ShortCut {
        const empty = Constants.EMPTY_STRING;
        return new ShortCut(empty, empty, empty, empty, empty);
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

