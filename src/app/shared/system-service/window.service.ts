import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { TaskBarPreviewImage } from "src/app/system-apps/taskbarpreview/taskbar.preview";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { BaseService } from "./base.service.interface";

@Injectable({
    providedIn: 'root'
})

export class WindowService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;

    static instance: WindowService;
    private _runningProcessesPreviewImages:Map<string, TaskBarPreviewImage[]>;
    private _eventOriginator = '';

    //WWC - without window component
    focusOnCurrentProcess_WWC_Notify: Subject<number> = new Subject<number>();
    focusOnCurrentProcessWindowNotify: Subject<number> = new Subject<number>();
    focusOnNextProcessWindowNotify: Subject<void> = new Subject<void>();
  
    hideProcessPreviewWindowNotify: Subject<void> = new Subject<void>();
    hideOtherProcessesWindowNotify: Subject<number> = new Subject<number>();
    keepProcessPreviewWindowNotify: Subject<void> = new Subject<void>();

    maximizeProcessWindowNotify: Subject<void> = new Subject<void>();
    minimizeProcessWindowNotify: Subject<number[]> = new Subject<number[]>();

    showOnlyCurrentProcessWindowNotify: Subject<number> = new Subject<number>();
    showProcessPreviewWindowNotify: Subject<unknown[]> = new Subject<unknown[]>();
 
    resizeProcessWindowNotify: Subject<number[]> = new Subject<number[]>();
    removeFocusOnOtherProcessesWindowNotify: Subject<number> = new Subject<number>();
    restoreOrMinimizeProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessesWindowNotify: Subject<void> = new Subject<void>();
    


    name = 'window_mgmt_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'keeps track of all procs windows';


    constructor(){
        this._runningProcessesPreviewImages = new Map<string, TaskBarPreviewImage[]>();
        WindowService.instance = this; //I added this to access the service from a class, not component

        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addProcessPreviewImage(appName:string, data:TaskBarPreviewImage):void{
        if(!this._runningProcessesPreviewImages.has(appName)){
            const tmpArr:TaskBarPreviewImage[] = [data];
            this._runningProcessesPreviewImages.set(appName, tmpArr);
        }
        else{
            const currImages = this._runningProcessesPreviewImages.get(appName) || [];
            currImages.push(data);
            this._runningProcessesPreviewImages.set(appName, currImages);
        }
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    removeProcessPreviewImages(appName:string):void{
        if(this._runningProcessesPreviewImages.has(appName))
            this._runningProcessesPreviewImages.delete(appName);
    }

    removeProcessPreviewImage(appName:string, pid:number):void{
        const deleteCount = 1;
        if(this._runningProcessesPreviewImages.has(appName)){
            const currImages = this._runningProcessesPreviewImages.get(appName) || [];
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

    getProcessPreviewImages(appName:string):TaskBarPreviewImage[]{
        if(this._runningProcessesPreviewImages.has(appName))
           return this._runningProcessesPreviewImages.get(appName) || [];

        return [];
    }

    getEventOrginator():string{
        return this._eventOriginator;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}