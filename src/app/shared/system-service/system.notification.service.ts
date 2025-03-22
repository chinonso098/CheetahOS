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

    showLockScreenNotify: Subject<void> = new Subject<void>();
    showDesktopNotify: Subject<void> = new Subject<void>();
    resetLockScreenTimeOutNotify: Subject<void> = new Subject<void>();
    restartSystemNotify: Subject<void> = new Subject<void>();

    name = 'sys_notification_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';
    
    constructor(){
        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    setSystemMessage(msg:string):void{
        this._systemMessage = msg;
    }

    getSystemMessage():string{
        /**
         * system message is cleared after it is retrieved
         */
        const tmpMsg = this._systemMessage;
        this._systemMessage = Constants.EMPTY_STRING;
        return tmpMsg;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}