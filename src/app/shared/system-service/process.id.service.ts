import { Injectable } from "@angular/core";
import { RunningProcessService } from "./running.process.service";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { BaseService } from "./base.service.interface";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

@Injectable({
    providedIn: 'root'
})

export class ProcessIDService implements BaseService{

    private _activeProcessIds: number[];
    private _runningProcessService:RunningProcessService;
    
    name = 'pid_gen_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 1;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'mananges add/remmove of pids ';

    constructor(runningProcessService:RunningProcessService){
        this._activeProcessIds = [];
        this._runningProcessService = runningProcessService;

        this.processId = this.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
     }

    public getNewProcessId(): number{
        let pid = 1;
        pid = this.generateProcessId();

        while(this._activeProcessIds.includes(pid))
                pid = this.generateProcessId();

        this._activeProcessIds.push(pid);
        return pid;
    }

    private generateProcessId(): number{
        const min = Math.ceil(1000);
        const max = Math.floor(9999);
        return Math.floor(Math.random() * (max - min + 1)) + min; 
    }

    public removeProcessId(pid:number):void{
       const deleteCount = 1;
       const pidIndex = this._activeProcessIds.indexOf(pid)
       if (pidIndex !== -1) {
            this._activeProcessIds.splice(pidIndex, deleteCount);
        }
    }

    public processCount():number{
        return this._activeProcessIds.length;
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}