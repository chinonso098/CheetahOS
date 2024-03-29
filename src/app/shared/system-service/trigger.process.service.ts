import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { RunningProcessService } from "./running.process.service";
import { AppDirectory } from "src/app/system-files/app.directory";
import { FileInfo } from "src/app/system-files/fileinfo";

@Injectable({
    providedIn: 'root'
})

export class TriggerProcessService{

    private _runningProcessService:RunningProcessService;
    private _appDirectory:AppDirectory;
    private _TriggerList:FileInfo[];

    startProcessNotify: Subject<string> = new Subject<string>();
    appNotFoundNotify: Subject<string> = new Subject<string>();
    appIsRunningNotify: Subject<string> = new Subject<string>();

    constructor(runningProcessService:RunningProcessService){
        this._runningProcessService = runningProcessService;
        this._appDirectory = new AppDirectory();
        this._TriggerList = [];
    }

    startApplication(file:FileInfo):void{

        if(this._appDirectory.appExist(file.getOpensWith)){

            if(!this._runningProcessService.isProcessRunning(file.getOpensWith)){
                this.startProcessNotify.next(file.getOpensWith);
                this._TriggerList.push(file);
                return
            }
            this.appNotFoundNotify.next(file.getOpensWith);
            return;
        }
        this.appNotFoundNotify.next(file.getOpensWith);
        return;
    }

    /**
     * Getting the last process from the Trigger, will remove it the TriggerList.
     */
    getLastProcessTrigger():FileInfo{

        if(this._TriggerList.length > 0){
           return this._TriggerList.pop() || new FileInfo;
        }

        return new FileInfo;
    }

}