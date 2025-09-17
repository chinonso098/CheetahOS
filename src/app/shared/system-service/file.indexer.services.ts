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
import { FileIndexIDs } from "src/app/system-files/common.enums";

import {extname} from 'path';

@Injectable({
    providedIn: 'root'
})

export class FileIndexerService implements BaseService{
    static instance:FileIndexerService;

    private _Index: string[][];
    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _fileService:FileService;

    private _appDirectory:AppDirectory;
    
    name = 'file_indexing_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles file indexing';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, fileService:FileService) {

        this._appDirectory = new AppDirectory();

        this._Index = [[]];
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._fileService = fileService;

        FileIndexerService.instance = this;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }


    public async indexDirectoryAsync(path = Constants.USER_BASE_PATH):Promise<void>{
        const queue:string[] = [];
        
        queue.push(path);
        this.indexApps();
        await this.indexDirectoryHelperAsync(queue);
        console.log('_Index Result:', this._Index)
        return;
    }

    private  async indexDirectoryHelperAsync(queue:string[]): Promise<void> {
        if(queue.length === 0)
            return;

        const filePath = queue.shift() || Constants.EMPTY_STRING;

        const directoryEntries = await this._fileService.readDirectory(filePath);      
        for(const entry of directoryEntries){
            const entryPath = `${filePath}/${entry}`;
            const isDirectory = await this._fileService.isDirectory(entryPath);
            if(isDirectory){
                this._Index.push([entryPath, entry, FileIndexIDs.FOLDERS]);
                queue.push(entryPath);
            }else{
                //exclude shortcut files(urls)
                if(extname(entry) !== Constants.URL)
                    this._Index.push([entryPath, entry, this.determinFileType(entryPath)]);
            }
        }

        return this.indexDirectoryHelperAsync(queue);
    }

    private indexApps(): void {
        const entryPath = 'None';
        const installApps = this._appDirectory.getAppList(); 
        for(const app of installApps){
            this._Index.push([entryPath, app, FileIndexIDs.APPS]);
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

    public fileAddNotify():void{

    }

    public fileDeleteNotify():void{
        
    }

    public fileUpdateNotify():void{
        
    }

    public getFileIndex():string[][]{
        return this._Index
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }

}