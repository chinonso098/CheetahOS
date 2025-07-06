import { Injectable } from "@angular/core";
import { FileInfo } from "src/app/system-files/file.info";
import { ShortCut } from "src/app/system-files/shortcut";
import {extname, basename, resolve, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { FSModule } from "src/osdrive/Cheetah/System/BrowserFS/node/core/FS";
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileMetaData, FolderSizeMeta } from "src/app/system-files/file.metadata";

import { Subject } from "rxjs";
import * as BrowserFS from 'src/osdrive/Cheetah/System/BrowserFS/browserfs'
import { Buffer} from 'buffer';
import osDriveFileSystemIndex from '../../../osdrive.json';
import ini  from 'ini';
import { FileContent } from "src/app/system-files/file.content";
import { ProcessType } from "src/app/system-files/system.types";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { BaseService } from "./base.service.interface";
import { UserNotificationService } from "./user.notification.service";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { SessionManagmentService } from "./session.management.service";

@Injectable({
    providedIn: 'root'
})

export class FileService implements BaseService{ 
    private _fileInfo!:FileInfo;
  
    private _fileSystem!:FSModule;
    private _directoryFileEntires:FileEntry[]=[];
    private _fileExistsMap!:Map<string,number>; 
    private _fileAndAppIconAssociation!:Map<string,string>; 
    private _restorePoint!:Map<string,string>; 
    private _eventOriginator = Constants.EMPTY_STRING;

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _userNotificationService:UserNotificationService
    private _sessionManagmentService:SessionManagmentService;

    dirFilesUpdateNotify: Subject<void> = new Subject<void>();
    fetchDirectoryDataNotify: Subject<string> = new Subject<string>();
    goToDirectoryNotify: Subject<string[]> = new Subject<string[]>();

   readonly fileServiceDeleteKey = Constants.FILE_SVC_DELETE_KEY;

    // SECONDS_DELAY = 200;

    name = 'file_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = Constants.NUM_ZERO;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'Mediates btwn ui & filesystem ';

    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, userNotificationService:UserNotificationService,
                sessionManagmentService:SessionManagmentService
    ){ 
        this.initBrowserFS();
        this._fileExistsMap =  new Map<string, number>();
        this._fileAndAppIconAssociation =  new Map<string, string>();
        this._restorePoint =  new Map<string, string>();
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._userNotificationService = userNotificationService;
        this._sessionManagmentService = sessionManagmentService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
        this.retrievePastSessionData();
    }


    private initBrowserFS(): void {
        // Using setTimeout ensures it runs after the constructor has returned
        setTimeout(() => {
            this.initBrowserFsAsync();
        }, Constants.NUM_ZERO);
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

    private async changeFolderIcon(fileName:string, iconPath:string, path:string):Promise<string>{
		const iconMaybe = `/Cheetah/System/Imageres/${fileName.toLocaleLowerCase()}_folder.png`;

        if(path === Constants.RECYCLE_BIN_PATH){
            const count = await this.getCountOfFolderItemsAsync(Constants.RECYCLE_BIN_PATH);
            return (count === Constants.NUM_ZERO) 
                ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
                :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
        }

        // console.log('iconMaybe:',iconMaybe);

        if(path !== `/Users/${fileName}`)
            return iconPath;

        const result = await this.checkIfExistsAsync(iconMaybe);
        if(result){ 
            return `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
        }
		return iconPath;
    }

    public async checkIfDirectoryAsync(path:string):Promise<boolean> {
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

    public async checkIfExistsAsync(path: string):Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.exists(path, (exists) => {
                // console.log(`checkIfExistsAsync: ${exists ? 'Already exists' : 'Does not exist'}`, exists);
                resolve(exists);
            });
        });
    }

    public async copyAsync(srcPath:string, destPath:string, isFile?:boolean):Promise<boolean>{
        const isDirectory = (isFile === undefined) ? await this.checkIfDirectoryAsync(srcPath) : !isFile;

        return isDirectory
            ? await this.copyFolderHandlerAsync(Constants.EMPTY_STRING, srcPath, destPath)
            : await this.copyFileAsync(srcPath, destPath);
    }

    private async copyFileAsync(sourcePath:string, destinationPath:string):Promise<boolean>{
        const name = this.getNameFromPath(sourcePath);
        const destPath = this.pathCorrection(destinationPath);
        const fileName = `${destPath}/${name}`;
        // console.log(`Destination: ${fileName}`);

        return new Promise<boolean>((resolve) =>{
             this._fileSystem.readFile(sourcePath, (readErr, contents = Buffer.from(Constants.EMPTY_STRING)) =>{
                if(readErr){
                    console.error('copyFileAsync readFile error:',readErr)
                    resolve(false);
                }

                this._fileSystem.writeFile(fileName, contents, {flag: 'wx'}, (writeErr) =>{  
                    if(!writeErr){
                        // console.log('copyFileAsync Success:');
                        this._fileExistsMap.set(fileName, Constants.NUM_ZERO);
                        return resolve(true);
                    }

                    if(writeErr?.code === 'EEXIST'){
                        console.warn('copyFileAsync Error: file already exists',writeErr);

                        const newFileName = this.iterateName(fileName);
                        this._fileSystem.writeFile(newFileName, contents, (retryErr) =>{  
                            if(retryErr){
                                console.error('copyFileAsync Iterate Error:', retryErr);
                                resolve(false);
                            }

                            this._fileExistsMap.set(newFileName, Constants.NUM_ZERO);
                            resolve(true);
                        });
                    }else{
                        console.error('copyFileAsync Error:', writeErr);
                        resolve(false);
                    }
                });
            });
        });
    }

    private async copyFolderHandlerAsync(arg0:string, srcPath:string, destPath:string):Promise<boolean>{

        const folderName = this.getNameFromPath(srcPath);
        const  createFolderResult = await this.createFolderAsync(destPath, folderName);
        if(createFolderResult){
            const loadedDirectoryEntries = await this.getDirectoryEntriesAsync(srcPath);
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.checkIfDirectoryAsync(`${srcPath}/${directoryEntry}`);
                if(checkIfDirResult){
                    const result = await this.copyFolderHandlerAsync(arg0,`${srcPath}/${directoryEntry}`,`${destPath}/${folderName}`);
                    if(!result){
                        console.error(`Failed to copy directory: ${srcPath}/${directoryEntry}`);
                        return false;
                    }
                }else{
                    const result = await this.copyFileAsync(`${srcPath}/${directoryEntry}`, `${destPath}/${folderName}`);
                    if(result){
                        console.log(`file:${srcPath}/${directoryEntry} successfully copied to destination:${destPath}/${folderName}`);
                    }else{
                        console.error(`file:${srcPath}/${directoryEntry} failed to copy to destination:${destPath}/${folderName}`)
                        return false
                    }
                }
            }
        }

        return true
    }

    public async createFolderAsync(directory: string, folderName: string): Promise<boolean> {
        const folderPath = `${directory}/${folderName}`;
        return new Promise<boolean>((resolve) => {
            this._fileSystem.mkdir(folderPath, 0o777, (err)=>{
                if(!err){
                    // Folder created successfully
                    this._fileExistsMap.set(folderPath, Constants.NUM_ZERO);
                    // console.log(`Folder created: ${folderPath}`);
                    return resolve(true);
                }

                if(err.code === 'EEXIST'){
                    console.warn(`Folder already exists: ${folderPath}`);
                    const uniqueFolderPath = this.iterateName(folderPath);

                    this._fileSystem.mkdir(uniqueFolderPath, 0o777, (retryErr)=>{
                        if(retryErr){
                            console.error(`Failed to create folder after name iteration: ${retryErr}`);
                            return resolve(false);
                        }

                        // console.log(`Folder created with new name: ${uniqueFolderPath}`);
                        this._fileExistsMap.set(uniqueFolderPath, Constants.NUM_ZERO);
                        resolve(true);
                    });
                }else{
                    console.error(`Error creating folder: ${err}`);
                    resolve(false);
                }
            });
        });
    }

    public async getExtraFileMetaDataAsync(path: string): Promise<FileMetaData> {
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
                    resolve(new FileMetaData(stats?.ctime, stats?.mtime, stats?.size, stats?.mode));
                });
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
                    console.error('getFileAsync error:',err)
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
                    console.error('getFileBlobAsync error:',err)
                    reject(err);
                }

                contents = contents || new Uint8Array();
                const fileUrl =  this.bufferToUrl(contents);
                resolve(fileUrl);
            });
        });
    }

    public async getDirectoryEntriesAsync(path:string):Promise<string[]>{
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

    public async getFileInfoAsync(path:string):Promise<FileInfo>{
        const extension = extname(path);
        this._fileInfo = new FileInfo();
        const fileMetaData = await this.getExtraFileMetaDataAsync(path) as FileMetaData;
     
        if(!extension){
            const fc = await this.setFolderPropertiesAsync(path) as FileContent;
            this._fileInfo = this.populateFileInfo(path, fileMetaData, false, Constants.EMPTY_STRING, Constants.EMPTY_STRING, false, undefined, fc);
            this._fileInfo.setIconPath = await this.changeFolderIcon(fc.geFileName, fc.getIconPath, path);
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
            this._fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}unknown.png`;
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
                    console.error('getFileConetentFromB64DataUrlAsync error:',err)
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
                    console.error('getShortCutAsync error:',err)
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

    private async renameDirectoryAsync(srcPath:string, destPath:string):Promise<boolean>{
        const folderToProcessingQueue:string[] =  [];
        const folderToDeleteStack:string[] =  [];

        //dir path can be gotten from either src or dest path;
        const  directoryPath = dirname(srcPath);
        const newName = this.getNameFromPath(destPath);

        const directoryExists = await this.checkIfExistsAsync(destPath);
        if(directoryExists){
            const msg = `Folder: ${newName}, already exists`;
            this._userNotificationService.showErrorNotification(msg);
            return false;
        }

        const result = await this.createFolderAsync(directoryPath, newName);
        if(!result){ return result }

        folderToProcessingQueue.push(srcPath);
        const isRenameSuccessful =  await this.moveHandlerBAsync(destPath, folderToProcessingQueue, folderToDeleteStack, Constants.NUM_ZERO);
        if(isRenameSuccessful){
          await this.deleteEmptyFolders(folderToDeleteStack);
        }

        return isRenameSuccessful;
    }

    //virtual filesystem, use copy and then delete
    public async moveAsync(srcPath: string, destPath: string, isFile?: boolean): Promise<boolean> {
        const isDirectory = (isFile === undefined) ? await this.checkIfDirectoryAsync(srcPath) : !isFile;
        
        if(isDirectory){
            const folderToProcessingQueue:string[] =  [];
            const folderToDeleteStack:string[] =  [];
            let result = false;

            folderToProcessingQueue.push(srcPath);

            //check if destPath Exists
            const exists = await this.checkIfExistsAsync(destPath);
            if(exists){
                result = await this.moveHandlerAAsync(destPath, folderToProcessingQueue, folderToDeleteStack);
            }else{
                result =  await this.moveHandlerBAsync(destPath, folderToProcessingQueue, folderToDeleteStack, Constants.NUM_ZERO);
            }

            if(result){
                await this.deleteEmptyFolders(folderToDeleteStack);
            }
            return result;
        }else{
            return await this.moveFileAsync(srcPath, destPath);
        }
    }

    /**
     * This move method assumes that the destination folder already exists, and that source folder and it's contents
     * are being moved into a new folder (destination folder)
     * @param destPath 
     * @param folderToProcessingQueue 
     * @returns 
     */
    private async moveHandlerAAsync(destPath:string, folderToProcessingQueue:string[], folderToDeleteStack:string[],):Promise<boolean>{

        if(folderToProcessingQueue.length === Constants.NUM_ZERO)
            return true;

        const srcPath = folderToProcessingQueue.shift() || Constants.EMPTY_STRING;
        const folderName = this.getNameFromPath(srcPath);
        folderToDeleteStack.push(srcPath);

        const loadedDirectoryEntries = await this.getDirectoryEntriesAsync(srcPath);
        const  moveFolderResult = await this.createFolderAsync(destPath,folderName);
        if(moveFolderResult){
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.checkIfDirectoryAsync(`${srcPath}/${directoryEntry}`);
                if(checkIfDirResult){
                    folderToProcessingQueue.push(`${srcPath}/${directoryEntry}`);
                }else{
                    const result = await this.moveFileAsync(`${srcPath}/${directoryEntry}`, `${destPath}/${folderName}`);
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

        return this.moveHandlerAAsync(`${destPath}/${folderName}`, folderToProcessingQueue, folderToDeleteStack);
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
        if(folderToProcessingQueue.length === Constants.NUM_ZERO)
            return true;

        const srcPath = folderToProcessingQueue.shift() || Constants.EMPTY_STRING;
        folderToDeleteStack.push(srcPath);
        let folderName = this.getNameFromPath(srcPath);
        if(skipCounter === Constants.NUM_ZERO){ folderName = Constants.EMPTY_STRING; }

        let  moveFolderResult = false;
        const loadedDirectoryEntries = await this.getDirectoryEntriesAsync(srcPath);

        //skip creating the 
        if(skipCounter > Constants.NUM_ZERO){
            moveFolderResult = await this.createFolderAsync(destPath,folderName);  
        }
        skipCounter = skipCounter + Constants.NUM_ONE;
    
        if(moveFolderResult || (skipCounter >= Constants.NUM_ZERO)){
            for(const directoryEntry of loadedDirectoryEntries){
                const checkIfDirResult = await this.checkIfDirectoryAsync(`${srcPath}/${directoryEntry}`);
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

    private async deleteEmptyFolders(folders:string[]):Promise<void>{
        for(let i = 0; i <= folders.length; i++){
            const path = folders.pop();
            if(path){
                await this.deleteFolderAsync(path);                    
            }
        }
    }

    //virtual filesystem, use copy and then delete
    private async moveFileAsync(srcPath:string, destPath:string, generatePath?:boolean): Promise<boolean>{
        return new Promise<boolean>((resolve) => {
            let destinationPath = Constants.EMPTY_STRING;
            if(generatePath === undefined || generatePath){
                const fileName = this.getNameFromPath(srcPath);
                destinationPath = `${destPath}/${fileName}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
            }else{
                destinationPath = destPath;
            }

            this._fileSystem.rename(srcPath, destinationPath, (renameErr) =>{
                if(renameErr){
                    console.error('Error reading file during move:', renameErr);
                    return resolve(false);
                }

                resolve(true);
            });
        });
    }

    public async writeFilesAsync(directory:string, files:File[]):Promise<boolean>{
        return new Promise<boolean>(() =>{
            files.forEach((file)=>{
                const fileReader = new FileReader()
                fileReader.readAsDataURL(file);
                fileReader.onload = async(evt) =>{
                    const newFile:FileInfo = new FileInfo();
                    newFile.setFileName = file.name;

                    const result = evt.target?.result;
                    if(result instanceof ArrayBuffer) {
                        newFile.setContentBuffer = result;
                    } else{
                        newFile.setContentPath = result || Constants.EMPTY_STRING;
                    }
                    newFile.setCurrentPath = `${this.pathCorrection(directory)}/${file.name}`;
                    return await this.writeFileAsync(directory, newFile);
                }
            })
        });
    }

    public async writeFileAsync(directory:string, file:FileInfo):Promise<boolean>{
        return new Promise<boolean>((resolve) =>{
            const cntnt = (file.getContentPath === Constants.EMPTY_STRING)? file.getContentBuffer : file.getContentPath;
            const destPath = this.pathCorrection(directory);
            const fileName = `${destPath}/${file.getFileName}`;

            this._fileSystem.writeFile(fileName, cntnt, {flag: 'wx'}, (writeErr) =>{  
                if(!writeErr){
                    console.log('writeFileAsync: file successfully written');
                    this._fileExistsMap.set(fileName, Constants.NUM_ZERO);
                    return resolve(true);
                }

                if(writeErr?.code === 'EEXIST'){
                    console.warn('writeFileAsync: file already exists',writeErr);

                    const newFileName = this.iterateName(fileName);
                    this._fileSystem.writeFile(newFileName, cntnt,(err) =>{  
                        if(err){
                            console.error('writeFileAsync Iterate Error:',err);
                            return resolve(false);
                        }

                        this._fileExistsMap.set(newFileName, Constants.NUM_ZERO);
                        resolve(true);
                    });
                }else{
                    console.error('writeFileAsync Error:', writeErr);
                    return resolve(false);
                }
            });
        });
    }

    public async renameAsync(path:string, newFileName:string, isFile?:boolean): Promise<boolean> {
        const rename = `${dirname(path)}/${newFileName}`;
        const isDirectory = (isFile === undefined) ? await this.checkIfDirectoryAsync(path) : !isFile;

        return isDirectory
            ? await this.renameDirectoryAsync(path, rename)
            : await this.renameFileAsync(path, newFileName);
    }

    private async renameFileAsync(path:string, newFileName:string): Promise<boolean> {
        const fileExt = extname(path);
        if(fileExt === Constants.URL){
            // special case
            return await  this.renameURLFiles(path, newFileName);
        }else{
            const newPath = `${dirname(path)}/${newFileName}${extname(path)}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
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
            this.addAndUpdateSessionData(`${Constants.RECYCLE_BIN_PATH}/${name}`, path);
            //move to rbin
            return await this.moveAsync(path, Constants.RECYCLE_BIN_PATH, isFile);
        }else{
            this.removeAndUpdateSessionData(path);
            const isDirectory = (isFile === undefined) ? await this.checkIfDirectoryAsync(path) : !isFile;
            return isDirectory
                ? await this.deleteFolderHandlerAsync(Constants.EMPTY_STRING, path, isRecycleBin)
                : await this.deleteFileAsync(path);
        }
    }

    private async deleteFolderAsync(path:string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.exists(path, (exists: boolean)=> {
                if (!exists) {
                    console.warn(`deleteFolderAsync: Entry doesn't exist: ${path}`);
                    return resolve(false);
                }

                this._fileSystem.rmdir(path, (err)=>{
                    if(err){
                        console.error('deleteFolderAsync: Folder delete failed:', err);
                        return resolve(false);
                    }

                    // console.log(`deleteFolderAsync: Folder deleted successfully: ${path}`);
                    resolve(true);
                });

            });
        });
    }

    private async deleteFileAsync(path: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._fileSystem.exists(path, (exists: boolean)=> {
                if(!exists){
                    console.warn(`deleteFileAsync: Entry doesn't exist: ${path}`);
                    return resolve(false);
                }
                
                this._fileSystem.unlink(path, (err)=>{
                    if(err){
                        console.error('deleteFileAsync: File delete failed:', err);
                        return resolve(false);
                    }

                    // console.log(`deleteFileAsync: File deleted successfully: ${path}`);
                    resolve(true);
                });
            });
        });
    }

    private async deleteFolderHandlerAsync(arg0: string, srcPath: string, isRecycleBin?:boolean): Promise<boolean> {
        const loadedDirectoryEntries = await this.getDirectoryEntriesAsync(srcPath);
    
        for (const directoryEntry of loadedDirectoryEntries) {
            const entryPath = `${srcPath}/${directoryEntry}`;
            this.removeAndUpdateSessionData(entryPath);

            const checkIfDirectory = await this.checkIfDirectoryAsync(entryPath);
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
    
    public  async getCountOfFolderItemsAsync(path:string): Promise<number> {
        return new Promise<number>((resolve) =>{
            this._fileSystem.readdir(path, (readDirErr, files) =>{
                if(readDirErr){
                    console.error('Error reading dir for count:', readDirErr);
                    resolve(Constants.NUM_ZERO);
                }
                resolve(files?.length || Constants.NUM_ZERO);
            });
        });
    }

    public  async getDetailedCountOfFolderItemsAsync(path:string): Promise<string> {
        const counts = { files: Constants.NUM_ZERO, folders: Constants.NUM_ZERO };
        const queue:string[] = [];
        
        queue.push(path);
        await this.getDetailedCountOfFolderItemsHelperAsync(queue, counts);
        return `${counts.files} Files, ${counts.folders} Folders`;
    }

    private  async getDetailedCountOfFolderItemsHelperAsync(queue:string[], counts:{files: number, folders: number}): Promise<void> {
        if(queue.length === Constants.NUM_ZERO)
            return;

        const srcPath = queue.shift() || Constants.EMPTY_STRING;
 
        const directoryEntries = await this.getDirectoryEntriesAsync(srcPath);      
        for(const directoryEntry of directoryEntries){
            const isDirectory = await this.checkIfDirectoryAsync(`${srcPath}/${directoryEntry}`);
            if(isDirectory){
                queue.push(`${srcPath}/${directoryEntry}`);
                counts.folders++;
            }else{
                counts.files++;
            }
        }

        return this.getDetailedCountOfFolderItemsHelperAsync(queue, counts);
    }

    public  async getFolderSizeAsync(path:string):Promise<number>{
        const sizes = {files: Constants.NUM_ZERO, folders: Constants.NUM_ZERO};
        const queue:string[] = [];
        
        queue.push(path);
        await this.getFolderSizeHelperAsync(queue, sizes);
        return sizes.files + sizes.folders;
    }

    private  async getFolderSizeHelperAsync(queue:string[], sizes:{files: number, folders: number}): Promise<void> {
        if(queue.length === Constants.NUM_ZERO)
            return;

        const srcPath = queue.shift() || Constants.EMPTY_STRING;

        const extraInfo = await this.getExtraFileMetaDataAsync(srcPath);
        sizes.folders += extraInfo.getSize;

        const directoryEntries = await this.getDirectoryEntriesAsync(srcPath);      
        for(const entry of directoryEntries){
            const entryPath = `${srcPath}/${entry}`;
            const isDirectory = await this.checkIfDirectoryAsync(entryPath);

            if(isDirectory){
                queue.push(entryPath);
            }else{
                const extraInfo = await this.getExtraFileMetaDataAsync(entryPath);
                sizes.files += extraInfo.getSize;
            }
        }

        return this.getFolderSizeHelperAsync(queue, sizes);
    }


    //AI Optimized code, merging two different calls into, with added safty of preventing endless recursion
    // I'll refactor using this later
    private async _getFolderSizeAsync(path: string): Promise<FolderSizeMeta> {
        const visited = new Set<string>();
        const result: FolderSizeMeta = {
            totalSize: 0,
            fileCount: 0,
            folderCount: 0,
            errors: []
        };

        await this._collectFolderSize(path, result, visited);
        return result;
    }

    private async _collectFolderSize(path: string, result: FolderSizeMeta, visited: Set<string>): Promise<void> {
        if (visited.has(path)) return;
        visited.add(path);

        let entries: string[];

        try {
            const stats = await this._statAsync(path);
            if (!stats.isDirectory()) {
                result.totalSize += stats.size;
                result.fileCount += 1;
                return;
            }

            result.totalSize += stats.size;
            result.folderCount += 1;

            entries = await this.getDirectoryEntriesAsync(path);
        } catch (err) {
            result.errors.push(`Failed to stat/read ${path}: ${err}`);
            return;
        }

        const tasks = entries.map(async (entry) => {
            const fullPath = `${path}/${entry}`;
            try {
                const stat = await this._statAsync(fullPath);
                if (stat.isDirectory()) {
                    await this._collectFolderSize(fullPath, result, visited);
                } else {
                    result.totalSize += stat.size;
                    result.fileCount += 1;
                }
            } catch (err) {
                result.errors.push(`Failed to stat ${fullPath}: ${err}`);
            }
        });

        await Promise.all(tasks);
    }

    private _statAsync(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this._fileSystem.stat(path, (err, stats) => {
                if (err) reject(err);
                else resolve(stats);
            });
        });
    }


    public resetDirectoryFiles(){
        this._directoryFileEntires=[]
    }

    /**
     *if file exists, increment it simple.txt, simple(1).txt ... 
     * @param path 
     * @returns 
     */
    public iterateName(path:string):string{
        const extension = extname(path);
        const filename = basename(path, extension);

        let count = this._fileExistsMap.get(path) || Constants.NUM_ZERO;
        count = count + Constants.NUM_ONE;
        this._fileExistsMap.set(path, count);

        return `${dirname(path)}/${filename} (${count})${extension}`;
    }

    getFolderOrigin(path:string):string{
        if(this._restorePoint.has(path)){
            return this._restorePoint.get(path) || Constants.EMPTY_STRING
        }
        return Constants.EMPTY_STRING;
    }

    public async setFolderPropertiesAsync(path:string):Promise<FileContent>{
        const fileName = basename(path, extname(path));
        let iconFile = Constants.EMPTY_STRING;
        const fileType = Constants.FOLDER;
        const opensWith = Constants.FILE_EXPLORER;

        const exist = await this.checkIfExistsAsync(path);
        if(!exist){
            return this.createEmptyFileContent();
        }

        const isDirectory = await this.checkIfDirectoryAsync(path);
        if(!isDirectory){
            iconFile= `${Constants.IMAGE_BASE_PATH}unknown.png`;
            return new FileContent(iconFile, fileName, fileType, fileName, opensWith);
        }

        const count = await this.getCountOfFolderItemsAsync(path);
        if(count === Constants.NUM_ZERO){
            iconFile = `${Constants.IMAGE_BASE_PATH}empty_folder.png`;
            return new FileContent(iconFile, fileName, fileType, fileName, opensWith);
        }

        iconFile = `${Constants.IMAGE_BASE_PATH}folder_w_c.png`;
        return new FileContent(iconFile, fileName, fileType, fileName, opensWith);
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

    private createEmptyFileContent(): FileContent {
        const empty = Constants.EMPTY_STRING;
        return new FileContent(empty, empty, empty, empty, empty);
    }

    getAppAssociaton(appname:string):string{
        return this._fileAndAppIconAssociation.get(appname) || Constants.EMPTY_STRING;
    }

    pathCorrection(path:string):string{
        if(path.slice(Constants.MINUS_ONE) === Constants.ROOT)
            return path.slice(Constants.NUM_ZERO, Constants.MINUS_ONE);
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

    private addAndUpdateSessionData(currPath:string, srcPath:string):void{
        this._restorePoint.set(currPath, srcPath);
        this._sessionManagmentService.addFileServiceSession(this.fileServiceDeleteKey, this._restorePoint);
    }

    private removeAndUpdateSessionData(path:string):void{
        if(this._restorePoint.has(path)){
            this._restorePoint.delete(path);
            this._sessionManagmentService.addFileServiceSession(this.fileServiceDeleteKey, this._restorePoint);
        }
    }
    private retrievePastSessionData():void{
        const sessionData = this._sessionManagmentService.getFileServiceSession(this.fileServiceDeleteKey) as Map<string, string>;
        if(sessionData){
            this._restorePoint = sessionData
        }
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
