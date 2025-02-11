import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { RunningProcessService } from "./running.process.service";
import { AppDirectory } from "src/app/system-files/app.directory";
import { FileInfo } from "src/app/system-files/file.info";

@Injectable({
    providedIn: 'root'
})

export class TriggerProcessService{

    private _runningProcessService:RunningProcessService;
    private _appDirectory:AppDirectory;
    private _TriggerList:FileInfo[];
    private _onlyOneInstanceAllowed:string[] = ["audioplayer", "cheetah", "jsdos", "photoviewer", 
        "ruffle", "runsystem", "taskmanager", "videoplayer"];
    static instance: TriggerProcessService;

    startProcessNotify: Subject<string> = new Subject<string>();
    appNotFoundNotify: Subject<string> = new Subject<string>();
    appIsRunningNotify: Subject<string> = new Subject<string>();

    constructor(runningProcessService:RunningProcessService){
        this._runningProcessService = runningProcessService;
        this._appDirectory = new AppDirectory();
        this._TriggerList = [];
        TriggerProcessService.instance = this; //I added this to access the service from a class, not component
    }


    startApplication(file:FileInfo):void{
        let msg = '';
        if(this._appDirectory.appExist(file.getOpensWith)){

            if(!this._runningProcessService.isProcessRunning(file.getOpensWith) || 
                (this._runningProcessService.isProcessRunning(file.getOpensWith) && !this._onlyOneInstanceAllowed.includes(file.getOpensWith))){
                this.startProcessNotify.next(file.getOpensWith);
                this._TriggerList.push(file);
                return;
            }else{
                if(this._onlyOneInstanceAllowed.includes(file.getOpensWith)){
                   const runningProcess = this._runningProcessService.getProcessByName(file.getOpensWith);
                    // msg = `Only one instance of ${file.getOpensWith} is allowed to run.`;
                    // this.appIsRunningNotify.next(msg);
                    if(runningProcess){
                        if(runningProcess.getProcessName ==="runsystem" || runningProcess.getProcessName ==="cheetah"){
                            this._runningProcessService.focusOnCurrentProcess_WWC_Notify.next(runningProcess.getProcessId);
                        }else if(runningProcess.getProcessName ==="taskmanager"){
                            this._runningProcessService.focusOnCurrentProcessNotify.next(runningProcess.getProcessId);
                        }else{
                            const uid = `${runningProcess.getProcessName}-${runningProcess.getProcessId}`;
                            this._runningProcessService.addEventOriginator(uid);

                            this._TriggerList.push(file);
                            this._runningProcessService.focusOnCurrentProcessNotify.next(runningProcess.getProcessId);
                            this._runningProcessService.changeProcessContentNotify.next();
                        }
                    }
                    return;
                }             
            }
        }

        msg = `Osdrive:/App Directory/${file.getOpensWith}`;
        this.appNotFoundNotify.next(msg);
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