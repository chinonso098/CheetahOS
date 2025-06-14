import { Injectable } from "@angular/core";
import { FileInfo } from "src/app/system-files/file.info";
import { ShortCut } from "src/app/system-files/shortcut";
import {extname, basename, resolve, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FSModule } from "src/osdrive/Cheetah/System/BrowserFS/node/core/FS";
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileMetaData } from "src/app/system-files/file.metadata";

import { Subject } from "rxjs";
import * as BrowserFS from 'src/osdrive/Cheetah/System/BrowserFS/browserfs'
import { Buffer } from 'buffer';
import osDriveFileSystemIndex from '../../../osdrive.json';
import ini  from 'ini';
import { FileContent } from "src/app/system-files/file.content";
import { BaseService } from "./base.service.interface";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

@Injectable({
    providedIn: 'root'
})

export class FileService implements BaseService{ 
    private _fileInfo!:FileInfo;
  
    private _fileSystem!:FSModule;
    private _directoryFileEntires:FileEntry[]=[];
    private _fileExistsMap!:Map<string,number>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _eventOriginator = Constants.EMPTY_STRING;

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;

    dirFilesUpdateNotify: Subject<void> = new Subject<void>();
    fetchDirectoryDataNotify: Subject<string> = new Subject<string>();
    goToDirectoryNotify: Subject<string[]> = new Subject<string[]>();

    SECONDS_DELAY = 200;

    name = 'file_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = Constants.ZERO;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem ';

    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){ 

        this.initBrowserFS();
        this._fileExistsMap =  new Map<string, number>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }


    private initBrowserFS(): void {
        // Using setTimeout ensures it runs after the constructor has returned
        setTimeout(() => {
            this.initBrowserFsAsync();
        }, Constants.ZERO);
    }

    private async initBrowserFsAsync():Promise<void>{
        
        if(!this._fileSystem){
            const currentURL = window.location.href;
            console.log('currentURL:',currentURL);
            
            return new Promise<void>((resolve, reject) => {
                BrowserFS.configure({
                    fs: "MountableFileSystem",
                    options:{
                        '/':{
                            fs: 'OverlayFS',
                            options:{
                                readable:{fs: 'XmlHttpRequest', options:{index: osDriveFileSystemIndex, baseUrl:`${currentURL}osdrive`}},
                                writable:{fs:"IndexedDB", options: {storeName: "browser-fs-cache"}}
                            },
                        },  
                    }},
                (err) =>{
                    if(err){  
                        console.log('initBrowserFs Error:', err)
                        reject(); 
                    }
                });
                this._fileSystem = BrowserFS.BFSRequire('fs');
                resolve();
            });
        }
    }

    private changeFolderIcon(fileName:string, iconPath:string, path:string):string{
		const iconMaybe = `/Cheetah/System/Imageres/${fileName.toLocaleLowerCase()}_folder.png`;

        if(path !== `/Users/${fileName}`)
            return iconPath;

		return this._fileSystem.existsSync(iconMaybe) ? `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png` : iconPath;
    }

    public async checkIfDirectory(path: string):Promise<boolean> {
        return new Promise<boolean>((resolve, reject) =>{
            this._fileSystem.stat(path,(err, stats) =>{
                if(err){
                    console.log('checkIfDirectory error:',err)
                    reject(err)
                }
               
                const isDirectory = (stats)? stats.isDirectory(): false;
                resolve(isDirectory);
            });
        });
    }

    public async checkIfExistsAsync(dirPath:string):Promise<boolean>{
        return new Promise<boolean>((resolve) =>{
            this._fileSystem.exists(`${dirPath}`,(exits) =>{
                 if(exits){
                     console.log('checkIfExistsAsync :Already exists',exits);
                     resolve(true)
                 }else{
                    console.log('checkIfExistsAsync :Does not exists',exits);
                    resolve(false);
                 }
            });
        })
    }

    public async copyFileAsync(sourcePath:string, destinationPath:string):Promise<boolean>{
        const fileName = this.getFileName(sourcePath);
        const destPath = this.pathCorrection(destinationPath);
        console.log(`Destination: ${destPath}/${fileName}`);
        return new Promise<boolean>((resolve, reject) =>{
             this._fileSystem.readFile(sourcePath,(err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.log('copyFileAsync error:',err)
                    reject(false)
                }else{
                    this._fileSystem.writeFile(`${destPath}/${fileName}`, contents, {flag: 'wx'}, (err) =>{  
                        if(err?.code === 'EEXIST' ){
                            console.log('copyFileAsync Error: file already exists',err);
                            // if file exists, increment it simple.txt, simple(1).txt ...
                            const itrName = this.iterateFileName(`${destPath}/${fileName}`);
                            this._fileSystem.writeFile(itrName,contents,(err) =>{  
                                if(err){
                                    console.log('copyFileAsync Iterate Error:',err);
                                    reject(false);
                                }
                                resolve(true);
                            });
                        }else{
                            //console.log('copyFileAsync Error:',err);
                            this._fileExistsMap.set(`${destPath}/${fileName}`, Constants.ZERO);
                            resolve(true);
                        }
                    });
                }
            });
        });
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

    public async createFolderAsync(directory:string, fileName:string):Promise<boolean>{
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
                    this._fileExistsMap.set(`${directory}/${fileName}`,Constants.ZERO);
                    resolve(true);
                }
            });
        });
    }

    public async deleteFolderAsync(directory:string):Promise<boolean>{
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

    public async deleteFileAsync(path:string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) =>{
           this._fileSystem.unlink(path,(err) =>{
                if(err){
                    console.log('deleteFileAsync error:',err)
                    reject(false)
                }
                resolve(true);
            });
        })
    }

    public async getExtraFileMetaDataAsync(path: string): Promise<FileMetaData> {
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

    public async getFileAsync(path:string): Promise<string> {
        if (!path) {
            console.error('getFileAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

       return new Promise((resolve, reject) =>{
            this._fileSystem.readFile(path,(err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.log('getFileAsync error:',err)
                    reject(err)
                }else{
                    resolve(contents.toString());
                }
            });
        });
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
    public async getFileBlobAsync(path:string): Promise<string> {
        if (!path) {
            console.error('getFileBlobAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        return new Promise((resolve, reject) =>{
            this._fileSystem.readFile(path,(err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.log('getFileBlobAsync error:',err)
                    reject(err);
                }

                contents = contents || new Uint8Array();
                const fileUrl =  this.bufferToUrl(contents);
                resolve(fileUrl);
            });
        });
    }

    public async getEntriesFromDirectoryAsync(path:string):Promise<string[]>{
        if (!path) {
            console.error('getEntriesFromDirectoryAsync error: Path must not be empty');
            return Promise.reject(new Error('Path must not be empty'));
        }

        await this.initBrowserFsAsync();

        return new Promise<string[]>((resolve, reject) => {
            const fs = this._fileSystem;
            setTimeout(() => {
                fs.readdir(path, function(err, files) {
                  if(err){
                      console.log("Oops! a boo boo happened, filesystem wasn't ready:", err);
                      reject([]);
                  }else{
                    resolve(files || []);
                  }
                });
            }, this.SECONDS_DELAY);
        });
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

    public async getFileInfoAsync(path:string):Promise<FileInfo>{
        const extension = extname(path);
        this._fileInfo = new FileInfo();
        const fileMetaData = await this.getExtraFileMetaDataAsync(path) as FileMetaData;
     
        if(!extension){
            const fc = await this.setFolderValuesAsync(path) as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, false, Constants.EMPTY_STRING, Constants.EMPTY_STRING, false, undefined, fc);
            this._fileInfo.setIconPath = this.changeFolderIcon(fc.geFileName,fc.getIconPath, path);
        }
        else if(extension === Constants.URL){
            const sc = await this.getShortCutFromURLAsync(path) as ShortCut;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, Constants.EMPTY_STRING, Constants.EMPTY_STRING, true, sc);
            this._fileInfo.setIsShortCut = true;
        }
        else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileConetentFromB64DataUrlAsync(path, 'image') as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true,'photoviewer', 'image_file.png', false,undefined, fc);
        }
        else if(Constants.VIDEO_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileConetentFromB64DataUrlAsync(path, 'video') as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'videoplayer', 'video_file.png', false,undefined, fc);
        }
        else if(Constants.AUDIO_FILE_EXTENSIONS.includes(extension)){
            const fc = await this.getFileConetentFromB64DataUrlAsync(path, 'audio') as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'audioplayer', 'music_file.png', false, undefined, fc);

        }else if(Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension) || extension === '.wasm'){
            const img_file = (extension === '.wasm')? 'wasm_file.png' : 'code_file.png';
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'codeeditor', img_file);
        }
        else if(extension === '.txt' || extension === '.properties'){
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'texteditor', 'file.png');
        }
        else if(extension === '.md'){
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'markdownviewer', 'markdown_file.png');
        }
        else if(extension === '.jsdos'){
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'jsdos', 'js-dos_file.png');
        }
        else if(extension === '.swf'){
            this._fileInfo = this.populateFileInfo(path, fileMetaData, true, 'ruffle', 'swf_file.png');
        }else{
            this._fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}/unknown.png`;
            this._fileInfo.setCurrentPath = path;
            this._fileInfo.setFileName = basename(path, extname(path));
            this._fileInfo.setDateModified = fileMetaData.getModifiedDate;
            this._fileInfo.setSize = fileMetaData.getSize;
            this._fileInfo.setMode = fileMetaData.getMode;
            this._fileInfo.setFileExtension = extension;
        }
        this.addAppAssociaton(this._fileInfo.getOpensWith, this._fileInfo.getIconPath);
        return this._fileInfo;
    }

    populateFileInfo(path:string, fileMetaData:FileMetaData, isFile =true, opensWith:string, imageName?:string, useImage=false, shortCut?:ShortCut, fileCntnt?:FileContent):FileInfo{
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
            fileInfo.setIconPath = (useImage)? fileCntnt?.getIconPath || img : img;
            fileInfo.setContentPath = fileCntnt?.getContentPath || Constants.EMPTY_STRING;
            fileInfo.setFileType = fileCntnt?.getFileType || extname(path);
            fileInfo.setFileName = fileCntnt?.geFileName || basename(path, extname(path));
            fileInfo.setOpensWith = fileCntnt?.getOpensWith || opensWith;
        }
        fileInfo.setIsFile = isFile;
        fileInfo.setDateModified = fileMetaData.getModifiedDate;
        fileInfo.setSize = fileMetaData.getSize;
        fileInfo.setMode = fileMetaData.getMode;
        fileInfo.setFileExtension = extname(path);

        return fileInfo;
    }

    public async getFileConetentFromB64DataUrlAsync(path:string, contentType:string):Promise<FileContent> {

        return new Promise((resolve, reject) =>{
            this._fileSystem.readFile(path, (err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.log('getFileConetentFromB64DataUrlAsync error:',err)
                    reject(err)
                }

                const encoding:BufferEncoding = 'utf8';
                const stringData = contents.toString(encoding);
                
                if(this.isUtf8Encoded(stringData)){
                    if(stringData.substring(0, 10) == 'data:image' || stringData.substring(0, 10) == 'data:video' || stringData.substring(0, 10) == 'data:audio'){

                        // Extract Base64-encoded string from Data URL
                        const base64Data = contents.toString().split(',')[1];
                        const encoding:BufferEncoding = 'base64';
                        const cntntData = Buffer.from(base64Data, encoding);
                        const fileUrl =  this.bufferToUrl(cntntData);

                        if(stringData.substring(0, 10) == 'data:image')
                            resolve(new FileContent(fileUrl, basename(path, extname(path)),Constants.EMPTY_STRING,fileUrl,Constants.EMPTY_STRING));
                        else
                            resolve(new FileContent(Constants.EMPTY_STRING, basename(path, extname(path)),Constants.EMPTY_STRING,fileUrl,Constants.EMPTY_STRING));
                    }else{
                        const fileUrl = this.bufferToUrl2(contents)
                        if(contentType === 'image')
                            resolve(new FileContent(fileUrl, basename(path, extname(path)),Constants.EMPTY_STRING,fileUrl,Constants.EMPTY_STRING));
                        else
                            resolve(new FileContent(Constants.EMPTY_STRING, basename(path, extname(path)),Constants.EMPTY_STRING,fileUrl,Constants.EMPTY_STRING));
                    }
                }else{
                    resolve(new FileContent(Constants.EMPTY_STRING, basename(path, extname(path)),Constants.EMPTY_STRING,this.bufferToUrl2(contents),Constants.EMPTY_STRING));
                }
            });
        });
    }
    
    public async getShortCutFromURLAsync(path:string):Promise<ShortCut>{

        return new Promise<ShortCut>((resolve, reject) =>{
            this._fileSystem.readFile(path, function(err, contents = Buffer.from(Constants.EMPTY_STRING)){
                if(err){
                    console.log('getShortCutAsync error:',err)
                    reject(new ShortCut(Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING));
                }
                const stage = contents? contents.toString(): Buffer.from(Constants.EMPTY_STRING).toString();
                const shortCut = ini.parse(stage) as unknown || {InternetShortcut:{ FileName:'hi', IconPath:Constants.EMPTY_STRING, FileType:Constants.EMPTY_STRING,ContentPath:Constants.EMPTY_STRING, OpensWith:Constants.EMPTY_STRING}};
                if (typeof shortCut === 'object') {
                    const iSCut = (shortCut as {InternetShortcut:unknown})?.['InternetShortcut'];
                    const  fileName=  (iSCut as {FileName:unknown})?.['FileName'] as string;
                    const iconPath = (iSCut as {IconPath:unknown})?.['IconPath'] as string;
                    const fileType = (iSCut as {FileType:unknown})?.['FileType'] as string;
                    const contentPath = (iSCut as {ContentPath:unknown})?.['ContentPath'] as string;
                    const opensWith = (iSCut as {OpensWith:unknown})?.['OpensWith'] as string;
                    resolve(new ShortCut(iconPath,fileName,fileType,contentPath,opensWith));
                }
            });
        });
    }

    public async movehandler(destinationArg:string, folderQueue:string[]):Promise<boolean>{

        if(folderQueue.length === Constants.ZERO)
            return true;

        const sourcePath = folderQueue.shift() || Constants.EMPTY_STRING;
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

        return new Promise<boolean>((resolve, reject) =>{
            files.forEach((file)=>{
                const fileReader = new FileReader()
                fileReader.readAsDataURL(file);

                fileReader.onload = (evt) =>{
                    
                    this._fileSystem.writeFile(`${directory}/${file.name}`,evt.target?.result, {flag: 'wx'}, (err) =>{  

                        console.log(`fileName:${directory}/${file.name}`);
                        if(err?.code === 'EEXIST' ){
                            console.log('writeFileAsync Error: file already exists',err);
    
                            const itrName = this.iterateFileName(`${directory}/${file.name}`);
                            this._fileSystem.writeFile(itrName,evt.target?.result,(err) =>{  
                                if(err){
                                    console.log('writeFileAsync Iterate Error:',err);
                                    reject(err);
                                }
                                resolve(true);
                            });
                        }else{
                            this._fileExistsMap.set(`${directory}/${file.name}`, Constants.ZERO);
                            resolve(true);
                        }
                    });
                }
            })
        });
    }

    public async writeFileAsync(directory:string, file:FileInfo):Promise<boolean>{
        return new Promise<boolean>((resolve, reject) =>{
            const cntnt = (file.getContentPath === Constants.EMPTY_STRING)? file.getContentBuffer : file.getContentPath;
            const destPath = this.pathCorrection(directory);
            this._fileSystem.writeFile(`${destPath}/${file.getFileName}`, cntnt, {flag: 'wx'}, (err) =>{  
                console.log(`FileName:${destPath}/${file.getFileName}`);

                if(err?.code === 'EEXIST'){
                    console.log('writeFileAsync Error: file already exists',err);

                    const itrName = this.iterateFileName(`${destPath}/${file.getFileName}`);
                    this._fileSystem.writeFile(itrName, cntnt,(err) =>{  
                        if(err){
                            console.log('writeFileAsync Iterate Error:',err);
                            reject(false);
                        }
                        resolve(true);
                    });
                }else{
                    this._fileExistsMap.set(`${destPath}/${file.getFileName}`,Constants.ZERO);
                    resolve(true);
                }
            });
        });
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
 
        return new Promise<boolean>((resolve, reject) =>{
            let rename = Constants.EMPTY_STRING; let type = Constants.EMPTY_STRING
            if(isFile){  rename = `${dirname(path)}/${newFileName}${extname(path)}`; type = 'file';
            }else{ rename = `${dirname(path)}/${newFileName}`;  type = 'folder'; }

            this._fileSystem.exists(`${rename}`, (err) =>{
                 if(err){
                    console.log(`renameAsync Error: ${type} already exists`,err);
                    reject(false);
                 }else{
                    this._fileSystem.rename(`${path}`,rename,(err) =>{  
                        if(err){
                            console.log(`renameAsync Error: ${type} rename`,err);
                            reject(false);
                        }
                        resolve(true);
                    });
                 }
              });
        });
    }

    public resetDirectoryFiles(){
        this._directoryFileEntires=[]
    }

    //virtual filesystem, use copy and then delete
    public async moveFileAsync(currentPath:string, newPath:string): Promise<boolean> {
 
        return new Promise<boolean>((resolve, reject) =>{
            const fileName = this.getFileName(currentPath);
            const newlocation = `${newPath}/${fileName}`;

            this._fileSystem.readFile(currentPath, (err, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(err){
                    console.log('getFile in moveAsync error:',err)
                    reject(false)
                }else{
                    this._fileSystem.writeFile(`${newlocation}`, contents,(err)=>{  
                        if(err){
                            console.log('writeFile in moveAsync error:',err);
                            reject(false);
                        }else{
                            this._fileSystem.unlink(currentPath,(err) =>{
                                if(err){
                                    console.log('unlink file error:',err)
                                    reject(err)
                                }
                                console.log('successfully unlinked')
                                resolve(true);
                            });
                            console.log('successfully renamed')
                            resolve(true);
                        }
                    });
                    console.log('successfully fetched')
                    resolve(true);
                }
            });
        });
    }

    public iterateFileName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = this._fileExistsMap.get(path) || Constants.ZERO;
        count = count + Constants.ONE;
        this._fileExistsMap.set(path, count);

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }

    public async setFolderValuesAsync(path: string):Promise<FileContent>{
        return new Promise<FileContent>((resolve, reject) =>{

            this._fileSystem.exists(`${path}`,(exits) =>{
                if(exits){
                    this._fileSystem.stat(path,(err, stats) =>{
                        if(err){
                            console.log('setFolderValuesAsync error:',err)
                            reject(new FileContent(Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING));
                        }
        
                        const isDirectory = (stats)? stats.isDirectory(): false;
                        const iconFile = `${Constants.IMAGE_BASE_PATH}${isDirectory ? 'folder.png' : 'unknown.png'}`
                        const fileType = 'folder';
                        const opensWith ='fileexplorer'
                        resolve(new FileContent(iconFile, basename(path, extname(path)),fileType,basename(path, extname(path)) ,opensWith ));
                    });
                }else{
                   console.log('setFolderValuesAsync :Does not exists',exits);
                   resolve(new FileContent(Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING,Constants.EMPTY_STRING ));
                }
           });
            
        });
    }

    private addAppAssociaton(appname:string, img:string):void{
        if(!this._fileAndAppIconAssociation.get(appname)){
            if(appname === 'photoviewer' || appname === 'videoplayer' || appname === 'audioplayer' || appname === 'ruffle'){
                this._fileAndAppIconAssociation.set(appname,`${Constants.IMAGE_BASE_PATH}${appname}.png`);
            }else{
                this._fileAndAppIconAssociation.set(appname,img);
            }
        }
    }

    getAppAssociaton(appname:string):string{
        return this._fileAndAppIconAssociation.get(appname) || Constants.EMPTY_STRING;
    }

    pathCorrection(path:string):string{
        if(path.slice(Constants.MINUS_ONE) === Constants.ROOT)
            return path.slice(Constants.ZERO, Constants.MINUS_ONE);
        else
            return path;
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

    getEventOriginator():string{
        return this._eventOriginator;
    }

    removeEventOriginator():void{
        this._eventOriginator = Constants.EMPTY_STRING;
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
