import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { ProcessType } from "src/app/system-files/system.types";
import { BaseService } from "./base.service.interface";


@Injectable({
    providedIn: 'root'
})

export class RunningProcessService implements BaseService{
    private _runningProcesses:Process[];
    private _runningServices:Service[];
    private _eventOriginator = '';

    /**
     * This  notify the app component  to removes process that have window componenets
     * Calling this on a process without one, will throw an error
     */
    closeProcessNotify: Subject<Process> = new Subject<Process>();
    newProcessNotify: Subject<string> = new Subject<string>(); 
    changeProcessContentNotify:Subject<void> = new Subject<void>();
    processListChangeNotify: Subject<void> = new Subject<void>();
    
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
    description = 'manages add/remove of all processes';


    constructor(){
        this._runningProcesses = [];
        this._runningServices = [];

        this.addProcess(this.getProcessDetail());
        this.addService(this.getServiceDetail());
    }

    addProcess(proccessToAdd:Process):void{
        this._runningProcesses.push(proccessToAdd)
    }

    addService(serviceToAdd:Service):void{
        this._runningServices.push(serviceToAdd)
    }


    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    removeProcess(proccessToRemove:Process):void{
        const deleteCount = 1;
        const procIndex = this._runningProcesses.findIndex(process => process.getProcessId === proccessToRemove.getProcessId);

        if(procIndex != -1){
            this._runningProcesses.splice(procIndex, deleteCount)
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

    getProcessesCount():number{
        return this._runningProcesses.length;
    }

    getProcessCount(processName:string):number{
        const processList = this._runningProcesses.filter(process =>  process.getProcessName === processName);
        return processList.length;
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}