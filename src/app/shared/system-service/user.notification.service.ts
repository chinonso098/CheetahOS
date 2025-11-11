import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { ComponentReferenceService } from "./component.reference.service";
import { UserNotificationType } from "src/app/system-files/common.enums";
import { DialogComponent } from "../system-component/dialog/dialog.component";


@Injectable({
    providedIn: 'root'
})

export class UserNotificationService implements BaseService{

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _componentReferenceService!:ComponentReferenceService;
    private dialogPid = 0;

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

    private showDialogMsgBox(dialogMsgType:string, msg:string, title:string=Constants.EMPTY_STRING):void{
        const componentRef = this._componentReferenceService.createComponent(DialogComponent);

        if(dialogMsgType === UserNotificationType.Error ||
            dialogMsgType === UserNotificationType.Info ||
            //dialogMsgType === UserNotificationType.Warning ||
            dialogMsgType === UserNotificationType.PowerOnOff ||
            dialogMsgType === UserNotificationType.FileTransfer
        ){
          componentRef.setInput('inputMsg', msg);
          componentRef.setInput('inputTitle', title);
          componentRef.setInput('notificationType', dialogMsgType);
          this.dialogPid = componentRef.instance.processId;
        }
    }

    closeDialogMsgBox(pId:number):void{
        this._componentReferenceService.removeComponent(pId);
    }

    showErrorNotification(msg:string, title:string){
       this.showDialogMsgBox(UserNotificationType.Error, msg, title);
    }

    showInfoNotification(msg:string){
        this.showDialogMsgBox(UserNotificationType.Info, msg);
    }

    // showWarningNotification(msg:string, title:string){
    //     this.showDialogMsgBox(UserNotificationType.Warning, msg, title);
    // }

    async showWarningNotification(message: string, title: string): Promise<boolean> {
        return new Promise((resolve) => {
            const componentRef = this._componentReferenceService.createComponent(DialogComponent);
            componentRef.setInput('inputMsg', message);
            componentRef.setInput('inputTitle', title);
            componentRef.setInput('notificationType', UserNotificationType.Warning );
            this.dialogPid = componentRef.instance.processId;
      
            // hook up close events
            componentRef.instance.confirm.subscribe(() => {
              resolve(true);
            });
      
            componentRef.instance.cancel.subscribe(() => {
              resolve(false);
            });
        });
    }

    showPowerOnOffNotification(msg:string){
        this.showDialogMsgBox(UserNotificationType.PowerOnOff, msg);
    }

    showFileTransferNotification(msg:string, title: string){
        this.showDialogMsgBox(UserNotificationType.FileTransfer, msg, title);
    }

    /**
     * All dialog box's PId can be gotten instantly, except WarningNotifiation, as result of it async nature.
     * it can only be retrieved after a selection is made.
     * @returns a proccess id for dialog box
     */
    getDialogPId():number{
        return this.dialogPid;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}