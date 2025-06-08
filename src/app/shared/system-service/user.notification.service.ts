import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { ComponentReferenceService } from "./component.reference.service";
import { UserNotificationType } from "src/app/system-files/notification.type";
import { DialogComponent } from "../system-component/dialog/dialog.component";


@Injectable({
    providedIn: 'root'
})

export class UserNotificationService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _componentReferenceService:ComponentReferenceService;

    name = 'usr_notification_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';
    
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, componentReferenceService:ComponentReferenceService){
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._componentReferenceService = componentReferenceService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }


    private showDialogMsgBox(dialogMsgType:string, msg:string):void{
        const componentRef = this._componentReferenceService.createComponent(DialogComponent);

        if(dialogMsgType === UserNotificationType.Error){
          componentRef.setInput('inputMsg', msg);
          componentRef.setInput('notificationType', dialogMsgType);
        }else if(dialogMsgType === UserNotificationType.Info){
          componentRef.setInput('inputMsg', msg);
          componentRef.setInput('notificationType', dialogMsgType);
        }else if(dialogMsgType === UserNotificationType.PowerOnOff){
          componentRef.setInput('inputMsg', msg);
          componentRef.setInput('notificationType', dialogMsgType);
        }else{
          componentRef.setInput('inputMsg', msg);
          componentRef.setInput('notificationType', dialogMsgType);
        }
    }

    closeDialogMsgBox(pid:number):void{
        this._componentReferenceService.removeComponent(pid);
    }

    showErrorNotification(msg:string){
       this.showDialogMsgBox(UserNotificationType.Error, msg);
    }

    showInfoNotification(msg:string){
        this.showDialogMsgBox(UserNotificationType.Info, msg);
    }

    showWarningNotification(msg:string){
        this.showDialogMsgBox(UserNotificationType.Warning, msg);
    }

    showPowerOnOffNotification(msg:string){
        this.showDialogMsgBox(UserNotificationType.PowerOnOff, msg);
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}