import { ComponentRef, Injectable, Type, ViewContainerRef, ViewRef } from "@angular/core";
import { BaseService } from "./base.service.interface";
import { Constants } from "src/app/system-files/constants";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { Service } from "src/app/system-files/service";
import { BaseComponent } from "src/app/system-base/base/base.component.interface";

@Injectable({
    providedIn: 'root'
})

export class ComponentReferenceService implements BaseService{
    private _componentsReferences:Map<number, ComponentRef<BaseComponent>>; 
    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;

    private _componentRefView!:ViewRef;
    private _viewContainerRef!: ViewContainerRef;

    name = 'cmpnt_ref_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'mananges add/remmove of cmpnt reference';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        this._componentsReferences = new Map<number, ComponentRef<BaseComponent>>();
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    private addComponentReference(processId:number, componentToAdd:ComponentRef<BaseComponent>):void{
        this._componentsReferences.set(processId,componentToAdd)
    }

    private getComponentReference(processId:number):ComponentRef<BaseComponent> | undefined{
        const componentRef = this._componentsReferences.get(processId);
        return componentRef;
    }

    private removeComponentReference(processId:number):void{
        this._componentsReferences.delete(processId)
    }

    setViewContainerRef(ref: ViewContainerRef):void {
        this._viewContainerRef = ref;
    }

    clearViewContainerRef():void {
        this._viewContainerRef.clear();
    }

    createComponent(componentToLoad: Type<BaseComponent>):ComponentRef<BaseComponent>{
        const componentRef = this._viewContainerRef.createComponent<BaseComponent>(componentToLoad);
        const pid = componentRef.instance.processId;
        this.addComponentReference(pid, componentRef);
        return componentRef;
    }

    removeComponent(pid:number):void{
        const componentToDelete = this.getComponentReference(pid);
        if(componentToDelete){
            this._componentRefView = componentToDelete.hostView;
            const iVCntr  = this._viewContainerRef.indexOf(this._componentRefView);
            this._viewContainerRef.remove(iVCntr);
            this.removeComponentReference(pid);
        }
    }
    
    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }

}