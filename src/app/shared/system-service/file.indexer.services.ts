import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { BaseService } from "./base.service.interface";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { AppDirectory } from "src/app/system-files/app.directory";

import { FileService } from "./file.service";
import { RunningProcessService } from "./running.process.service";
import { ProcessIDService } from "./process.id.service";
import { fileIndexChangeOperationType, FileIndexIDs } from "src/app/system-files/common.enums";

import {extname, basename} from 'path';
import { FileSearchIndex } from "src/app/system-files/common.interfaces";
import { Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})

export class FileIndexerService implements BaseService{
    static instance:FileIndexerService;

    private _Index:FileSearchIndex[] = [];
    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _fileService:FileService;

    private _appDirectory:AppDirectory;
    fileIndexChangeOperation: Subject<string> = new Subject<string>();

    private readonly ENTRY_TO_EXCLUDE = 'Recycle Bin';
    private readonly PATH_TO_EXCLUDE = '/Users/Desktop/Recycle Bin';
    
    name = 'file_indexing_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles file indexing';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService) {
        this._appDirectory = new AppDirectory();
        FileIndexerService.instance = this;
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._fileService = fileService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    public async indexDirectoryAsync(path = Constants.USER_BASE_PATH):Promise<void>{
        const queue:string[] = [];
        
        queue.push(path);
        this.indexApps();
        await this.indexDirectoryHelperAsync(queue);
        //console.log('_SearchIndex Result:', this._Index)
        return;
    }

    private  async indexDirectoryHelperAsync(queue:string[]): Promise<void> {
        if(queue.length === 0) return;

        const filePath = queue.shift() || Constants.EMPTY_STRING;

        const directoryEntries = await this._fileService.readDirectory(filePath);      
        for(const entry of directoryEntries){
            const entryPath = `${filePath}/${entry}`;
            await this.helperCoreAsync(queue, entryPath, entry);
        }

        if(directoryEntries.length === 0 && this.PATH_TO_EXCLUDE !== filePath){
            const opensWith = Constants.FILE_EXPLORER;
            const isFile = false;
            const entry = basename(filePath);

            const now = new Date();
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            this._Index.push(this.getFileSearchIndex(FileIndexIDs.FOLDERS, entry, filePath, Constants.EMPTY_STRING, this.handleNonAppIcons(entry, isFile), opensWith, date));
        }

        return this.indexDirectoryHelperAsync(queue);
    }

    private async helperCoreAsync(queue:string[], path:string, entry:string):Promise<void>{
        const entryPath =  path;  //`${filePath}/${entry}`;
        const isDirectory = await this._fileService.isDirectory(entryPath);
        const fileInfo = await this._fileService.getFileInfo(entryPath);
        if(isDirectory){
            const isFile = false;

            if(this.PATH_TO_EXCLUDE !== entryPath && this.ENTRY_TO_EXCLUDE !== entry){
                this._Index.push(this.getFileSearchIndex(FileIndexIDs.FOLDERS, entry, fileInfo.getCurrentPath, fileInfo.getContentPath, this.handleNonAppIcons(entry, isFile), fileInfo.getOpensWith, fileInfo.getDateModified));
                queue.push(entryPath);
            }
        }else{
            const isFile = true;
            const hasExt = false;
            //exclude shortcut files(urls)
            const ext = extname(entry);
            if(ext !== Constants.URL){
                if(ext !== Constants.EMPTY_STRING)
                    this._Index.push(this.getFileSearchIndex(this.determinFileType(entryPath), entry, fileInfo.getCurrentPath, fileInfo.getContentPath, this.handleNonAppIcons(entry), fileInfo.getOpensWith, fileInfo.getDateModified));
                else
                    this._Index.push(this.getFileSearchIndex(this.determinFileType(entryPath), entry, fileInfo.getCurrentPath, fileInfo.getContentPath, this.handleNonAppIcons(entry, isFile, hasExt), fileInfo.getOpensWith, fileInfo.getDateModified ));
            }
        }
    }

    private indexApps(): void {
        const entryPath = 'None';
        const installApps = this._appDirectory.getAppList(); 
        const date = new Date('1970-01-01');
        for(const app of installApps){
            this._Index.push(this.getFileSearchIndex(FileIndexIDs.APPS, app, entryPath, Constants.EMPTY_STRING, this._appDirectory.getAppIcon(app), app, date));
        }
    }

    private getFileSearchIndex(type:string, name:string, srcPath:string, contentPath:string, iconPath:string, opensWith:string, dateModified:Date):FileSearchIndex{
        return{ type:type, name:name, srcPath:srcPath, contentPath:contentPath, iconPath:iconPath, opensWith:opensWith,  dateModified: dateModified}
    }

    private handleNonAppIcons(fileName:string, isFile = true, hasExt = true):string{
        const folderIcon = 'folder_2.png';
        const unknownIcon = 'unknown.png'
        if(!isFile){
            return `${Constants.IMAGE_BASE_PATH}${folderIcon}`;
        }else{
            if(hasExt){
                const opensWith = this._fileService.getOpensWith(extname(fileName));
                return `${Constants.IMAGE_BASE_PATH}${opensWith.appIcon}`;
            }else{
                return `${Constants.IMAGE_BASE_PATH}${unknownIcon}`;
            }
        }
    }

    private determinFileType(path:string):string{
        const extension = extname(path);

        if(Constants.AUDIO_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.MUSIC;

        if(Constants.VIDEO_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.VIDEOS;

        if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension))
            return FileIndexIDs.PHOTOS;

        return FileIndexIDs.DOCUMENTS;
    }

    //### a better solution is to pass the added file info and update the index store, rather then re-indexing
    public async addNotify(path:string, isFile:boolean): Promise<void>{
        const fileName = basename(path);
        const isPresent = this._Index.some(x => (x.srcPath === path && x.name === fileName));

        if(isPresent)
            console.info('Duplication avoided, file is already present in the index');

        if(!isPresent){
            if(isFile){
                await this.helperCoreAsync([], path, fileName);
            }else{
                await this.indexDirectoryAsync(path);
            }

            //await this.indexDirectoryAsync();
            this.fileIndexChangeOperation.next(fileIndexChangeOperationType.ADD);
        }
    }

    public deleteNotify(path:string, isFile:boolean):void{
        this.fileIndexChangeOperation.next(fileIndexChangeOperationType.DELETE);
    }

    public updateNotify(path:string, oldFileName:string, isFile:boolean):void{
        this.fileIndexChangeOperation.next(fileIndexChangeOperationType.UPDATE);
    }

    public getFileIndex():FileSearchIndex[]{
        return this._Index
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }

}