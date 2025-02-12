import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { TaskBarPreviewImage } from "src/app/system-apps/taskbarpreview/taskbar.preview";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { ProcessType } from "src/app/system-files/system.types";


@Injectable({
    providedIn: 'root'
})

export class RunningProcessService{

    static instance: RunningProcessService;
    private _runningProcesses:Process[];
    private _runningServices:Service[];
    private _runningProcessesImages:Map<string, TaskBarPreviewImage[]>;
    private _eventOriginator = '';

    closeProcessNotify: Subject<Process> = new Subject<Process>();
    changeProcessContentNotify:Subject<void> = new Subject<void>();
    focusOnNextProcessNotify: Subject<void> = new Subject<void>();
    focusOnCurrentProcessNotify: Subject<number> = new Subject<number>();
    //WWC - without window component
    focusOnCurrentProcess_WWC_Notify: Subject<number> = new Subject<number>();
    removeFocusOnOtherProcessesNotify: Subject<number> = new Subject<number>();
    hideProcessPreviewWindowNotify: Subject<void> = new Subject<void>();
    hideOtherProcessNotify: Subject<number> = new Subject<number>();
    keepProcessPreviewWindowNotify: Subject<void> = new Subject<void>();
    maximizeProcessWindowNotify: Subject<void> = new Subject<void>();
    minimizeProcessWindowNotify: Subject<number[]> = new Subject<number[]>();
    showProcessPreviewWindowNotify: Subject<unknown[]> = new Subject<unknown[]>();
    showOnlyCurrentProcessWindowNotify: Subject<number> = new Subject<number>();
    processListChangeNotify: Subject<void> = new Subject<void>();
    restoreOrMinimizeProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessesWindowNotify: Subject<void> = new Subject<void>();


    name = 'rning_proc_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    /**
     * A little homage to Windows.
     * On Windows, the "System" process always has the same PID, 
     * which is 4; meaning that whenever the System process is running, it will always be associated with Process ID 4
     */
    processId = Constants.RESERVED_ID_RUNNING_PROCESS_SERVICE;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'keeps track of all procs';


    constructor(){
        this._runningProcesses = [];
        this._runningServices = [];
        this._runningProcessesImages = new Map<string, TaskBarPreviewImage[]>();
        RunningProcessService.instance = this; //I added this to access the service from a class, not component

        this.addProcess(this.getProcessDetail());
        this.addService(this.getServiceDetail());
    }

    addProcess(proccessToAdd:Process):void{
        this._runningProcesses.push(proccessToAdd)
    }

    addService(serviceToAdd:Service):void{
        this._runningServices.push(serviceToAdd)
    }

    addProcessImage(appName:string, data:TaskBarPreviewImage):void{
        if(!this._runningProcessesImages.has(appName)){
            const tmpArr:TaskBarPreviewImage[] = [data];
            this._runningProcessesImages.set(appName, tmpArr);
        }
        else{
            const currImages = this._runningProcessesImages.get(appName) || [];
            currImages.push(data);
            this._runningProcessesImages.set(appName, currImages);
        }
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    removeProcess(proccessToRemove:Process):void{
        const deleteCount = 1;
        const procIndex = this._runningProcesses.findIndex((process) => {
            return process.getProcessId === proccessToRemove.getProcessId;
          });

        if(procIndex != -1){
            this._runningProcesses.splice(procIndex, deleteCount)
        }
    }

    removeProcessImages(appName:string):void{
        if(this._runningProcessesImages.has(appName))
            this._runningProcessesImages.delete(appName);
    }

    removeProcessImage(appName:string, pid:number):void{
        const deleteCount = 1;
        if(this._runningProcessesImages.has(appName)){
            const currImages = this._runningProcessesImages.get(appName) || [];
            const dataIndex = currImages.findIndex((d) => {
                return d.pid  === pid;
              });
    
            if(dataIndex != -1){
                currImages.splice(dataIndex || 0, deleteCount)
            }
        }    
    }

    removeEventOriginator():void{
        this._eventOriginator = '';
    }

    getProcess(processId:number):Process{
        const process = this._runningProcesses.find((process) => {
            return process.getProcessId === processId;
        });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return process!;
    }

    /**
     * 
     * @param appName 
     * @returns Process
     * 
     * This method will return the first of a given process with matching name, or null
     * if proccess does not exsist
     */
    getProcessByName(appName:string):Process | null{
        const process = this._runningProcesses.find((process) => {
            return process.getProcessName === appName;
        });

     
        return process || null;
    }

    getProcessImages(appName:string):TaskBarPreviewImage[]{
        if(this._runningProcessesImages.has(appName))
           return this._runningProcessesImages.get(appName) || [];

        return [];
    }

    getEventOrginator():string{
        return this._eventOriginator;
    }

    isProcessRunning(appName:string):boolean{
        const process = this._runningProcesses.find((process) => {
            return process.getProcessName === appName;
        });

        if(process)
            return true;
        
        return false;
    }

    getProcesses():Process[]{
        return this._runningProcesses;
    }

    getServices():Service[]{
        return this._runningServices;
    }

    processCount():number{
        return this._runningProcesses.length;
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}