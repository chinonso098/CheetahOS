import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { DragEventInfo, InformationUpdate } from "src/app/system-files/common.interfaces";
import { TooltipPositionInfo } from "src/app/system-apps/taskbarentries/taskbar.entries.type";

@Injectable({
    providedIn: 'root'
})

export class SystemNotificationService implements BaseService{

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _systemPendingAction = Constants.EMPTY_STRING;
    private _appIconNotificationStore:Map<number, string[]>; 
    private _dragEventInfo:DragEventInfo | undefined = undefined;
    private _isScreenLocked = true;
    private _pwrDialogPID = 0;

    lockScreenNotify: Subject<void> = new Subject<void>();
    logOffNotify: Subject<void> = new Subject<void>();
    showLockScreenNotify: Subject<void> = new Subject<void>();
    showDesktopNotify: Subject<void> = new Subject<void>();
    resetLockScreenTimeOutNotify: Subject<void> = new Subject<void>();
    restartSystemNotify: Subject<number> = new Subject<number>();
    shutDownSystemNotify: Subject<void> = new Subject<void>();

    hideTaskBarNotify: Subject<void> = new Subject<void>();
    showTaskBarNotify: Subject<void> = new Subject<void>();
    showTaskBarToolTipNotify: Subject<TooltipPositionInfo> = new Subject<TooltipPositionInfo>();
    hideTaskBarToolTipNotify: Subject<void> = new Subject<void>();
    taskBarIconInfoChangeNotify: Subject<Map<number, string[]>> = new Subject<Map<number, string[]>>();
    taskBarPreviewHighlightNotify: Subject<string> = new Subject<string>();
    taskBarPreviewUnHighlightNotify: Subject<string> = new Subject<string>();

    updateInformationNotify: Subject<InformationUpdate> = new Subject<InformationUpdate>();
    autoCloseDialogNotify:Subject<number> =  new Subject<number>(); 

    name = 'sys_notification_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = Constants.BLANK_SPACE;
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._appIconNotificationStore = new Map<number, string[]>();

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    setSystemPendingAction(msg:string):void{
        this._systemPendingAction = msg;
    }

    setIsScreenLocked(isLocked:boolean):void{
        this._isScreenLocked = isLocked;
    }

    setPwrDialogPid(pId:number):void{
        this._pwrDialogPID = pId;
    }

    setAppIconNotication(msgKey:number, msgValue:string[]):void{
        this._appIconNotificationStore.set(msgKey, msgValue);
    }

    setDropEventInfo(dragInfo:DragEventInfo){
        this._dragEventInfo = dragInfo;
    }

    getAppIconNotication(msgKey:number):string[]{
        if(this._appIconNotificationStore.has(msgKey)){
            return this._appIconNotificationStore.get(msgKey) || [];
        }

        return [];
    }

    getSystemPendingAction():string{
        /**
         * system pending action is cleared after it is retrieved
         */
        return this._systemPendingAction;
    }

    getIsScreenLocked():boolean{
        return this._isScreenLocked;
    }

    getPwrDialogPid():number{
        const tmp = this._pwrDialogPID;
        this._pwrDialogPID = 0;
        return tmp;
    }

    getDragEventInfo():DragEventInfo | undefined{
        return this._dragEventInfo;
    }

    removeAppIconNotication(msgKey:number):void{
        if(this._appIconNotificationStore.has(msgKey)){
            this._appIconNotificationStore.delete(msgKey);
        }
    }

    removeDragEventInfo():void{
        this._dragEventInfo = undefined;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}