import { Injectable } from "@angular/core";
import { FileInfo } from "src/app/system-files/fileinfo";
import { ShortCut } from "src/app/system-files/shortcut";
import { extname, basename, resolve, dirname, join } from 'path';
import { Constants } from "src/app/system-files/constants";
import { FSModule } from "browserfs/dist/node/core/FS";
import { FileEntry } from 'src/app/system-files/fileentry';
import { FileMetaData } from "src/app/system-files/file.metadata";

import { Subject } from "rxjs";
import * as BrowserFS from 'browserfs';
import { Buffer } from 'buffer';
import osDriveFileSystemIndex from '../../../osdrive.json';
import ini  from 'ini';

import OSFileSystemIndex from '../../../../index.json';
import {configure, fs, Overlay, Fetch, FileContents} from '@zenfs/core';
import {IndexedDB} from '@zenfs/dom';
import { IndexData } from "@zenfs/core/backends/index/index.js";

@Injectable({
    providedIn: 'root'
})

export class FileService{

    static instace:FileService;
    private _fileInfo!:FileInfo;
    private _consts:Constants = new Constants();
    private _isFileSystemInit = false;
    private _fileSystem!:FSModule;
    private _directoryFileEntires:FileEntry[]=[];
    private _fileExistsMap!:Map<string,number>; 
    private _eventOriginator = '';

    dirFilesReadyNotify: Subject<void> = new Subject<void>();
    dirFilesUpdateNotify: Subject<void> = new Subject<void>();

    SECONDS_DELAY = 200;

    constructor(){ 
        this._fileExistsMap =  new Map<string, number>();
        FileService.instace = this;
    }



    private async initZenFSAsync(): Promise<void> {
		if (this._isFileSystemInit) {
			return;
		}
		await configure<typeof Overlay>({
			mounts: {
				'/': {
					backend: Overlay,
					readable: { backend: Fetch, index: OSFileSystemIndex as IndexData, baseUrl: 'osdrive' },
					writable: { backend: IndexedDB, storeName: 'fs-cache' },
				},
			},
		});
		this._isFileSystemInit = true;
	}

    private changeFolderIcon(fileName: string, iconPath: string): string {
        const baseUrl = '/osdrive';
		const iconMaybe = `/icons/${fileName.toLocaleLowerCase()}_folder.ico`;
		return fs.existsSync(iconMaybe) ? `${baseUrl}${iconMaybe}` : iconPath;
	}

    public async checkIfDirectory(path: string): Promise<boolean> {
		const stats = await fs.promises.stat(path);
		return stats?.isDirectory();
	}

    public async checkIfExistsAsync(dirPath: string): Promise<boolean> {
		return fs.promises.exists(dirPath);
	}

    public async copyFileAsync(sourcePath: string, destinationPath: string): Promise<boolean> {
		const fileName = this.fileName(sourcePath);
		console.log(`Destination: ${destinationPath}/${fileName}`);
		await fs.promises.copyFile(sourcePath, `${destinationPath}/${fileName}`);
		return true;
	}

    public async copyHandler(arg0:string, sourcePathArg:string, destinationArg:string):Promise<boolean>{

        const checkIfDirResult = await this.checkIfDirectory(`${sourcePathArg}`);
        if(checkIfDirResult){
            const folderName = this.getFileName(sourcePathArg);
            const  createFolderResult = await this.createFolderAsync(destinationArg, folderName);
            if(createFolderResult){
                const loadedDirectoryEntries = await this.getEntriesFromDirectoryAsync(sourcePathArg);
                for(const directoryEntry of loadedDirectoryEntries){
                    const checkIfDirResult = await this.checkIfDirectory(`${sourcePathArg}/${directoryEntry}`);
                    if(checkIfDirResult){
                        const result = await this.copyHandler(arg0,`${sourcePathArg}/${directoryEntry}`,`${destinationArg}/${folderName}`);
                        if(!result){
                            console.log(`Failed to copy directory: ${sourcePathArg}/${directoryEntry}`);
                            return false;
                        }
                    }else{
                        const result = await this.copyFileAsync(`${sourcePathArg}/${directoryEntry}`, `${destinationArg}/${folderName}`);
                        if(result){
                            console.log(`file:${sourcePathArg}/${directoryEntry} successfully copied to destination:${destinationArg}/${folderName}`);
                        }else{
                            console.log(`file:${sourcePathArg}/${directoryEntry} failed to copy to destination:${destinationArg}/${folderName}`)
                            return false
                        }
                    }
                }
            }
        }else{
            const result = await this.copyFileAsync(`${sourcePathArg}`, `${destinationArg}`);
            if(result){
                console.log(`file:${sourcePathArg} successfully copied to destination:${destinationArg}`);
            }else{
                console.log(`file:${sourcePathArg} failed to copy to destination:${destinationArg}`)
                return false
            }
        }

        return true
    }


    public async createFolderAsync_OLD(directory:string, fileName:string):Promise<boolean>{
        return new Promise<boolean>((resolve, reject) =>{
            this._fileSystem.mkdir(`${directory}/${fileName}`,0o777,(err) =>{  
                if(err?.code === 'EEXIST' ){
                    console.log('createFolderAsync Error:folder  already exists',err);
                    const itrName = this.iterateFileName(`${directory}/${fileName}`);
                    this._fileSystem.mkdir(itrName,0o777,(err) =>{  
                        if(err){
                            console.log('createFolderAsync  Error:',err);
                            reject(false);
                        }
                        resolve(true);
                    });
                }else{
                    console.log(`err:${err}`);
                    this._fileExistsMap.set(`${directory}/${fileName}`,0);
                    resolve(true);
                }
            });
        });
    }

    public async createFolderAsync(directory: string, fileName: string): Promise<boolean> {
		await fs.promises.mkdir(join(directory, fileName));
		return true;
	}

    public async deleteFolderAsync_OLD(directory:string):Promise<boolean>{
       return new Promise<boolean>((resolve, reject) =>{
           this._fileSystem.exists(`${directory}/`, (err) =>{
                if(err){
                    this._fileSystem.rmdir(`${directory}/`,(err) =>{  
                        if(err){
                            console.log('deleteFolderAsync Error: folder delete failed',err);
                            reject(false);
                        }
                        resolve(true);
                    });
                }else{
                    console.log('deleteFolderAsync Error: folder doesn\'t exists',err);
                }
            });
        })
    }

    public async deleteFolderAsync(directory: string): Promise<boolean> {
		await fs.promises.rmdir(directory);
		return true;
	}

    public async deleteFileAsync(path: string): Promise<boolean> {
		await fs.promises.unlink(path);
		return true;
	}

    public async getExtraFileMetaDataAsync_OLD(path: string): Promise<FileMetaData> {
        return new Promise((resolve, reject) =>{

            this._fileSystem.exists(`${path}`,(exits) =>{
                if(exits){
                    this._fileSystem.stat(path,(err, stats) =>{
                        if(err){
                            console.log('getExtraFileMetaDataAsync error:',err)
                            reject(err)
                        }
                        resolve(new FileMetaData(stats?.ctime, stats?.mtime, stats?.size, stats?.mode));
                    });
                }else{
                   console.log('getExtraFileMetaDataAsync :Does not exists',exits);
                   resolve(new FileMetaData());
                }
           });
        });
    }

    public async getExtraFileMetaDataAsync(path: string) {
		const stats = await fs.promises.stat(path);
		return new FileMetaData(stats?.ctime, stats?.mtime, stats?.size, stats?.mode);
	}


    public async getFileAsync(path: string): Promise<string> {
		if (!path) {
			console.error('getFileAsync error: Path must not be empty');
			throw new Error('Path must not be empty');
		}

		return await fs.promises.readFile(path, 'utf8');
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

    public async getFileBlobAsync(path: string): Promise<string> {
		if (!path) {
			console.error('getFileBlobAsync error: Path must not be empty');
			throw new Error('Path must not be empty');
		}

		const contents = await fs.promises.readFile(path);
		return URL.createObjectURL(new Blob([contents]));
	}

    public async getEntriesFromDirectoryAsync(path: string): Promise<string[]> {
		if (!path) {
			console.error('getEntriesFromDirectoryAsync error: Path must not be empty');
			return Promise.reject(new Error('Path must not be empty'));
		}

		/** This is where ZenFS is initialized */
		await this.initZenFSAsync();
		return await fs.promises.readdir(path);

	}

    public  getFileEntriesFromDirectory(fileList:string[], directory:string):FileEntry[]{

        for(let i = 0; i < fileList.length; i++){
            const  file = fileList[i];
            const fileEntry = new FileEntry();
            fileEntry.setName = basename(file, extname(file));
            fileEntry.setPath = resolve(directory, file);
            this._directoryFileEntires.push(fileEntry);
        }
        return this._directoryFileEntires;
    }

    private getFileName(path:string):string{
        return `${basename(path, extname(path))}${ extname(path)}`;
    }

	private fileName(path: string): string {
		return `${basename(path, extname(path))}${extname(path)}`;
	}

    public async getFileInfoAsync(path:string):Promise<FileInfo>{
        const extension = extname(path);
        this._fileInfo = new FileInfo();

        if(!extension){
            const sc = await this.setFolderValuesAsync(path) as ShortCut;
            const fileMetaData = await this.getExtraFileMetaDataAsync(path) as FileMetaData;

            this._fileInfo.setIconPath = this.changeFolderIcon(sc.geFileName,sc.getIconPath);
            this._fileInfo.setCurrentPath = path;
            this._fileInfo.setFileType = sc.getFileType;
            this._fileInfo.setFileName = sc.geFileName;
            this._fileInfo.setOpensWith = sc.getOpensWith;
            this._fileInfo.setIsFile = false;
            this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
            this._fileInfo.setSize = fileMetaData.getSize;
            this._fileInfo.setMode = fileMetaData.getMode;
        }
        else{

            const fileMetaData = await this.getExtraFileMetaDataAsync(path) as FileMetaData;

            if(extension == '.url'){
                const sc = await this.getShortCutFromURLAsync(path) as ShortCut;
                this._fileInfo.setIconPath = sc.getIconPath;
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setContentPath = sc.getContentPath;
                this._fileInfo.setFileType = sc.getFileType;
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setOpensWith = sc.getOpensWith;
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }
             else if(this._consts.IMAGE_FILE_EXTENSIONS.includes(extension)){    
                const sc = await this.getShortCutFromB64DataUrlAsync(path,'image');
                this._fileInfo.setIconPath = sc.getIconPath;
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setContentPath = sc.getContentPath;
                this._fileInfo.setFileType = extension;
                this._fileInfo.setFileName = sc.geFileName;
                this._fileInfo.setOpensWith = 'photoviewer';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }
            else if(this._consts.VIDEO_FILE_EXTENSIONS.includes(extension)){    
                const sc = await this.getShortCutFromB64DataUrlAsync(path, 'video');
                this._fileInfo.setIconPath = '/osdrive/icons/video_file.ico';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setContentPath = sc.getContentPath;
                this._fileInfo.setFileType = extension;
                this._fileInfo.setFileName = sc.geFileName;
                this._fileInfo.setOpensWith = 'videoplayer';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }else if(this._consts.AUDIO_FILE_EXTENSIONS.includes(extension)){    
                const sc = await this.getShortCutFromB64DataUrlAsync(path, 'audio');
                this._fileInfo.setIconPath = '/osdrive/icons/music_file.ico';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setContentPath = sc.getContentPath;
                this._fileInfo.setFileType = extension;
                this._fileInfo.setFileName = sc.geFileName;
                this._fileInfo.setOpensWith = 'audioplayer';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }else if(extension == '.txt' || extension == '.properties'){
                this._fileInfo.setIconPath = '/osdrive/icons/file.ico';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setFileType = extname(path);
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setOpensWith = 'texteditor';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }else if(extension == '.md'){
                this._fileInfo.setIconPath = '/osdrive/icons/markdown-file_50.png';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setFileType = extname(path);
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setOpensWith = 'markdownviewer';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }else if(extension == '.jsdos'){
                this._fileInfo.setIconPath = '/osdrive/icons/emulator-2.png';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setFileType = extname(path);
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setOpensWith = 'jsdos';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }
            else if(extension == '.swf'){
                this._fileInfo.setIconPath = '/osdrive/icons/flash_67.png';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setFileType = extname(path);
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setOpensWith = 'ruffle';
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }
             else{
                this._fileInfo.setIconPath='/osdrive/icons/unknown.ico';
                this._fileInfo.setCurrentPath = path;
                this._fileInfo.setFileName = basename(path, extname(path));
                this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
                this._fileInfo.setSize = fileMetaData.getSize;
                this._fileInfo.setMode = fileMetaData.getMode;
            }
        }
        return this._fileInfo;
    }

    public async getShortCutFromB64DataUrlAsync(path: string, contentType: string): Promise<ShortCut> {

        const contents = await fs.promises.readFile(path);

        const stringData = contents.toString('utf-8');
        if (this.isUtf8Encoded(stringData)) {
            if (stringData.substring(0, 10) == 'data:image' || stringData.substring(0, 10) == 'data:video' || stringData.substring(0, 10) == 'data:audio') {
                // Extract Base64-encoded string from Data URL
                const base64Data = contents.toString().split(',')[1];
                const encoding: BufferEncoding = 'base64';
                const cntntData = Buffer.from(base64Data, encoding);
                const fileUrl = this.bufferToUrl(cntntData);

                if (stringData.substring(0, 10) == 'data:image') 
                    return new ShortCut(fileUrl, basename(path, extname(path)), '', fileUrl, '');
                else 
                    return new ShortCut('', basename(path, extname(path)), '', fileUrl, '');
            } else {
                const fileUrl = this.bufferToUrl2(contents);
                if (contentType === 'image') 
                    return new ShortCut(fileUrl, basename(path, extname(path)), '', fileUrl, '');
                else 
                    return new ShortCut('', basename(path, extname(path)), '', fileUrl, '');
            }
        }  
        
        return new ShortCut('', basename(path, extname(path)), '', this.bufferToUrl2(contents), '');
	}

    public async getShortCutFromURLAsync(path:string):Promise<ShortCut>{

        const contents = await fs.promises.readFile(path);

        const stage = contents? contents.toString(): Buffer.from('').toString();
        const shortCut = ini.parse(stage) as unknown || {InternetShortcut:{ FileName:'', IconPath:'', FileType:'',ContentPath:'', OpensWith:''}};
        if (typeof shortCut === 'object') {
            const iSCut = (shortCut as {InternetShortcut:unknown})?.['InternetShortcut'];
            const  fileName=  (iSCut as {FileName:unknown})?.['FileName'] as string;
            const iconPath = (iSCut as {IconPath:unknown})?.['IconPath'] as string;
            const fileType = (iSCut as {FileType:unknown})?.['FileType'] as string;
            const contentPath = (iSCut as {ContentPath:unknown})?.['ContentPath'] as string;
            const opensWith = (iSCut as {OpensWith:unknown})?.['OpensWith'] as string;
            return new ShortCut(iconPath,fileName,fileType,contentPath,opensWith);
        }

        return new ShortCut('','','','','');
    }

    public async movehandler(destinationArg:string, folderQueue:string[]):Promise<boolean>{

        if(folderQueue.length === 0)
            return true;

        const sourcePath = folderQueue.shift() || '';
        const folderName = this.getFileName(sourcePath);

        const checkIfDirResult = await this.checkIfDirectory(`${sourcePath}`);
        if(checkIfDirResult){
            const loadedDirectoryEntries = await this.getEntriesFromDirectoryAsync(sourcePath);
            const  moveFolderResult = await this.createFolderAsync(destinationArg,folderName);
            if(moveFolderResult){
                for(const directoryEntry of loadedDirectoryEntries){
                    const checkIfDirResult = await this.checkIfDirectory(`${sourcePath}/${directoryEntry}`);
                    if(checkIfDirResult){
                        folderQueue.push(`${sourcePath}/${directoryEntry}`);
                    }else{
                        const result = await this.moveFileAsync(`${sourcePath}/${directoryEntry}`, `${destinationArg}/${folderName}`);
                        if(result){
                            console.log(`file:${sourcePath}/${directoryEntry} successfully moved to destination:${destinationArg}/${folderName}`);
                        }else{
                            console.log(`file:${sourcePath}/${directoryEntry} failed to move to destination:${destinationArg}/${folderName}`)
                        }
                    }
                }
            }else{
                console.log(`folder:${destinationArg}/${folderName}  creation failed`);
                return false;
            }
        }else{
            const result = await this.moveFileAsync(`${sourcePath}`,`${destinationArg}`);
            if(result){
                console.log(`file:${sourcePath} successfully moved to destination:${destinationArg}`);
            }else{
                console.log(`file:${sourcePath} failed to move to destination:${destinationArg}`)
            }
        }

        return this.movehandler(`${destinationArg}/${folderName}`, folderQueue);
    }

    public async writeFilesAsync(directory:string, files:File[]):Promise<boolean>{
        files.forEach((file)=>{
            const fileReader = new FileReader()
            fileReader.readAsDataURL(file);

            fileReader.onload = async (evt) =>{
                const exists = await fs.promises.exists(`${directory}/${file.name}`);
                if(exists){
                    console.log('writeFileAsync Error: file already exists');
                    const itrName = this.iterateFileName(`${directory}/${file.name}`);
                    await fs.promises.writeFile(itrName,evt.target?.result as FileContents, {flag: 'wx'})
                }else{
                    await fs.promises.writeFile(`${directory}/${file.name}`,evt.target?.result as FileContents, {flag: 'wx'})
                    this._fileExistsMap.set(`${directory}/${file.name}`,0);
                }
            }
        })

        // write is not done when true is returned
        return true
    }

    public async writeFileAsync(directory:string, file:FileInfo):Promise<boolean>{

        const exists = await fs.promises.exists(`${directory}/${file.getFileName}`);
        if(exists){
            console.log('writeFileAsync Error: file already exists');
            const itrName = this.iterateFileName(`${directory}/${file.getFileName}`);
            await fs.promises.writeFile(itrName, file.getContentPath, {flag: 'wx'})
        }else{
            await fs.promises.writeFile(`${directory}/${file.getFileName}`, file.getContentPath, {flag: 'wx'})
            this._fileExistsMap.set(`${directory}/${file.getFileName}`,0);
        }

        return true;
    }


    public async removeHandler(arg0: string, sourceArg: string): Promise<boolean> {
        const loadedDirectoryEntries = await this.getEntriesFromDirectoryAsync(sourceArg);
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${sourceArg}/${directoryEntry}`;
            const checkIfDirectory = await this.checkIfDirectory(entryPath);
    
            if (checkIfDirectory) {
                // Recursively call the rm_dir_handler for the subdirectory
                const success = await this.removeHandler(arg0, entryPath);
                if (!success) {
                    console.log(`Failed to delete directory: ${entryPath}`);
                    return false;
                }
            } else {
                const result = await this.deleteFileAsync(entryPath);
                if (result) {
                    console.log(`File: ${directoryEntry} in ${entryPath} deleted successfully`);
                } else {
                    console.log(`File: ${directoryEntry} in ${entryPath} failed deletion`);
                    return false;
                }
            }
        }
    
        // Delete the current directory after all its contents have been  deleted
        console.log(`folder to delete: ${sourceArg}`);
        const result = await this.deleteFolderAsync(`${sourceArg}`);
    
        if (result) {
            console.log(`Directory: ${sourceArg} deleted successfully`);
            return true;
        } else {
            console.log(`Failed to delete directory: ${sourceArg}`);
            return false;
        }
    }

    public async renameAsync(path:string, newFileName:string, isFile:boolean): Promise<boolean> {

        let rename = ''; let type = ''
        if(isFile){  rename = `${dirname(path)}/${newFileName}${extname(path)}`; type = 'file';
        }else{ rename = `${dirname(path)}/${newFileName}`;  type = 'folder'; }

        const exists = await fs.promises.exists(rename);
        if(exists){
            console.log(`renameAsync Error: ${type} already exists`);
            return false
        }

        await fs.promises.rename(path, rename);
        return true;
    }

    public resetDirectoryFiles(){
        this._directoryFileEntires=[]
    }

    //virtual filesystem, use copy and then delete
    public async moveFileAsync(currentPath:string, newPath:string): Promise<boolean> {

        const fileName = this.fileName(currentPath);
        const newlocationPath = `${newPath}/${fileName}`;

        await fs.promises.copyFile(currentPath, newlocationPath);
        await fs.promises.unlink(currentPath);

        return true;
    }

    public iterateFileName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = this._fileExistsMap.get(path) || 0;
        count = count + 1;
        this._fileExistsMap.set(path, count);

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }


    public async setFolderValuesAsync(path: string):Promise<ShortCut>{
        const exists = await fs.promises.exists(path);

        if(exists){
            const stats = await fs.promises.stat(path);
            const isDirectory = stats?.isDirectory();
            const iconFile = `/osdrive/icons/${isDirectory ? 'folder.ico' : 'unknown.ico'}`
            const fileType = 'folder';
            const opensWith ='fileexplorer'
            return new ShortCut(iconFile, basename(path, extname(path)),fileType,basename(path, extname(path)) ,opensWith );
        }
	
        return new ShortCut('','','','','' )
    }

    private bufferToUrl(buffer:Buffer):string{
       return URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
    }

    private bufferToUrl2(arr:Uint8Array):string{
        return URL.createObjectURL(new Blob([arr]));
     }

    private uint8ToBase64(arr:Uint8Array):string{
        const base64String = btoa(String.fromCharCode(...new Uint8Array(arr)));
        return base64String;
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

    getEventOrginator():string{
        return this._eventOriginator;
    }

    removeEventOriginator():void{
        this._eventOriginator = '';
    }
}
