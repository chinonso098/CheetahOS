import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";


@Injectable({
    providedIn: 'root'
})

export class SystemNotificationService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _systemMessage = Constants.EMPTY_STRING;
    private _appIconNotificationStore:Map<number, string[]>; 
    private _isScreenLocked = true;
    private _pwrDialogPID = 0;

    showLockScreenNotify: Subject<void> = new Subject<void>();
    showDesktopNotify: Subject<void> = new Subject<void>();
    resetLockScreenTimeOutNotify: Subject<void> = new Subject<void>();
    restartSystemNotify: Subject<number> = new Subject<number>();
    shutDownSystemNotify: Subject<void> = new Subject<void>();


    hideTaskBarNotify: Subject<void> = new Subject<void>();
    showTaskBarNotify: Subject<void> = new Subject<void>();
    showTaskBarToolTipNotify: Subject<unknown[]> = new Subject<unknown[]>();
    hideTaskBarToolTipNotify: Subject<void> = new Subject<void>();
    taskBarIconInfoChangeNotify: Subject<Map<number, string[]>> = new Subject<Map<number, string[]>>();
    taskBarPreviewHighlightNotify: Subject<string> = new Subject<string>();
    taskBarPreviewUnHighlightNotify: Subject<string> = new Subject<string>();

    name = 'sys_notification_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._appIconNotificationStore = new Map<number, string[]>();

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    setSystemMessage(msg:string):void{
        this._systemMessage = msg;
    }

    setIsScreenLocked(isLocked:boolean):void{
        this._isScreenLocked = isLocked;
    }

    setPwrDialogPid(pid:number):void{
        this._pwrDialogPID = pid;
    }

    setAppIconNotication(msgKey:number, msgValue:string[]):void{
        this._appIconNotificationStore.set(msgKey, msgValue);
    }

    getAppIconNotication(msgKey:number):string[]{
        if(this._appIconNotificationStore.has(msgKey)){
            return this._appIconNotificationStore.get(msgKey) || [];
        }

        return [];
    }

    getSystemMessage():string{
        /**
         * system message is cleared after it is retrieved
         */
        const tmpMsg = this._systemMessage;
        this._systemMessage = Constants.EMPTY_STRING;
        return tmpMsg;
    }

    getIsScreenLocked():boolean{
        return this._isScreenLocked;
    }

    getPwrDialogPid():number{
        const tmp = this._pwrDialogPID;
        this._pwrDialogPID = 0;
        return tmp;
    }

    removeAppIconNotication(msgKey:number):void{
        if(this._appIconNotificationStore.has(msgKey)){
            this._appIconNotificationStore.delete(msgKey);
        }
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}