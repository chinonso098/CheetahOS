import { ComponentRef, Injectable } from "@angular/core";
import { BaseService } from "./base.service.interface";
import { Constants } from "src/app/system-files/constants";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { Service } from "src/app/system-files/service";

@Injectable({
    providedIn: 'root'
})

export class ComponentReferenceService implements BaseService{
    private _componentsReferences:Map<number, ComponentRef<unknown>>; 
    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;

    name = 'cmpnt_ref_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'mananges add/remmove of cmpnt reference';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        this._componentsReferences = new Map<number, ComponentRef<unknown>>();
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addComponentReference(processId:number, componentToAdd:ComponentRef<unknown>):void{
        this._componentsReferences.set(processId,componentToAdd)
    }

    getComponentReference(processId:number):ComponentRef<unknown>{
        const componentRef = this._componentsReferences.get(processId);
   
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return componentRef!;
    }

    removeComponentReference(processId:number): void{
        this._componentsReferences.delete(processId)
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }

}