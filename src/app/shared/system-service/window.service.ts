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
    private _processPreviewImages:Map<string, TaskBarPreviewImage[]>;
    private _processWindowList:Map<string, string[]>;
    private _processWindowOffset:Map<string, number>;
    private _processOrderList:number[];
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
        WindowService.instance = this; //I added this to access the service from a class, not component

        this._processPreviewImages = new Map<string, TaskBarPreviewImage[]>();
        this._processWindowList = new Map<string, string[]>();
        this._processWindowOffset = new Map<string, number>();
        this._processOrderList = [];

        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addProcessPreviewImage(appName:string, data:TaskBarPreviewImage):void{
        if(!this._processPreviewImages.has(appName)){
            const tmpArr:TaskBarPreviewImage[] = [data];
            this._processPreviewImages.set(appName, tmpArr);
        }
        else{
            const currImages = this._processPreviewImages.get(appName) || [];
            currImages.push(data);
            this._processPreviewImages.set(appName, currImages);
        }
    }

    addProcessToWindowList(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];

        if(!this._processWindowList.has(appName)){
            this._processWindowList.set(appName, [uid]);
        }
        else{
            const currUids = this._processWindowList.get(appName) || [];
            currUids.push(uid);
            this._processWindowList.set(appName, currUids);
        }
    }

    addPidToProcessOrderList(uid:string):void{
        const appPid = uid.split(Constants.DASH)[1];
        this._processOrderList.push(Number(appPid))
    }

    addProcessWindowOffset(uid:string, offset:number):void{
        const appName = uid.split(Constants.DASH)[0];
        this._processWindowOffset.set(appName, offset);
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    removeProcessPreviewImages(appName:string):void{
        if(this._processPreviewImages.has(appName))
            this._processPreviewImages.delete(appName);
    }

    removeProcessFromWindowList(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processPreviewImages.has(appName)){
            const currUids = this._processWindowList.get(appName) || [];

            const deleteCount = 1;
            const uidIndex = currUids.indexOf(uid)
            if(uidIndex !== -1) {
                currUids.splice(uidIndex, deleteCount);
                this._processWindowList.set(appName, currUids);
            }

            if(currUids.length === 0)
                this._processWindowList.delete(appName);
        }
    }

    removeProcessWindowOffset(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];
        if(this._processWindowOffset.has(appName))
            this._processWindowOffset.delete(appName);
    }

    isProcessInWindowList(uid:string):boolean{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processPreviewImages.has(appName))
            return true;

        return false;
    }

    removeProcessPreviewImage(appName:string, pid:number):void{
        const deleteCount = 1;
        if(this._processPreviewImages.has(appName)){
            const currImages = this._processPreviewImages.get(appName) || [];
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
        if(this._processPreviewImages.has(appName))
           return this._processPreviewImages.get(appName) || [];

        return [];
    }

    getProcessCountFromWindowList(uid:string):number{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processPreviewImages.has(appName)){
            const currUids = this._processWindowList.get(appName) || [];

            return currUids.length;
        }

        return 0;
    }

    getProcessWindowOffset(uid:string):number{
        const appName = uid.split(Constants.DASH)[0];
        if(this._processWindowOffset.has(appName))
            return this._processWindowOffset.get(appName) || 0;

        return 0;
    }

    getNextPidInProcessOrderList():number{
        return this._processOrderList[this._processOrderList.length - 1] || 0;
    }

    removePidFromProcessOrderList():void{
        this._processOrderList.pop();
    }

    cleanUp(uid:string):void{
        //this.removePidFromProcessOrderList();
        this.removeProcessFromWindowList(uid);
        this.removeProcessWindowOffset(uid);
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