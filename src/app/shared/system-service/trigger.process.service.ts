import { Injectable, Type, ViewContainerRef } from "@angular/core";
import { Subject } from "rxjs";
import { RunningProcessService } from "./running.process.service";
import { AppDirectory } from "src/app/system-files/app.directory";
import { FileInfo } from "src/app/system-files/file.info";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { WindowService } from "./window.service";
import { BaseService } from "./base.service.interface";
import { ComponentReferenceService } from "./component.reference.service";
import { PropertiesComponent } from "../system-component/properties/properties.component";
import { MenuService } from "./menu.services";

@Injectable({
    providedIn: 'root'
})

export class ControlProcessService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _windowService:WindowService;
    private _componentReferenceService:ComponentReferenceService;
    private _menuService:MenuService;

    private _appDirectory:AppDirectory;
    private _TriggerList:FileInfo[];
    private _viewContainerRef!: ViewContainerRef;
    private _onlyOneInstanceAllowed:string[] = ["audioplayer", "chatter", "cheetah", "jsdos", "photoviewer", 
        "ruffle", "runsystem", "taskmanager", "videoplayer"];
    static instance: ControlProcessService;

    startProcessNotify: Subject<string> = new Subject<string>();
    appNotFoundNotify: Subject<string> = new Subject<string>();
    appIsRunningNotify: Subject<string> = new Subject<string>();

    name = 'trgr_proc_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'inits components ';
        

    constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, windowService:WindowService, 
        componentReferenceService:ComponentReferenceService, menuService:MenuService){
     
        this._runningProcessService = runningProcessService;
        this._processIdService = processIdService;
        this._windowService = windowService;
        this._componentReferenceService = componentReferenceService;
        this._menuService = menuService;

        this._appDirectory = new AppDirectory();
        this._TriggerList = [];
        ControlProcessService.instance = this; //I added this to access the service from a class, not component

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this._menuService.showPropertiesView.subscribe((p) => this.showPropertiesWindow(p));
    }


    startApplication(file:FileInfo):void{
        let msg = '';
        if(this._appDirectory.appExist(file.getOpensWith)){

            if(!this._runningProcessService.isProcessRunning(file.getOpensWith) || 
                (this._runningProcessService.isProcessRunning(file.getOpensWith) && !this._onlyOneInstanceAllowed.includes(file.getOpensWith))){
                this.startProcessNotify.next(file.getOpensWith);
                this._TriggerList.push(file);
                return;
            }else{
                if(this._onlyOneInstanceAllowed.includes(file.getOpensWith)){
                   const runningProcess = this._runningProcessService.getProcessByName(file.getOpensWith);
                    // msg = `Only one instance of ${file.getOpensWith} is allowed to run.`;
                    // this.appIsRunningNotify.next(msg);
                    if(runningProcess){
                        if(runningProcess.getProcessName ==="runsystem" || runningProcess.getProcessName ==="cheetah"){
                            this._windowService.focusOnCurrentProcess_WWC_Notify.next(runningProcess.getProcessId);
                        }else if(runningProcess.getProcessName ==="taskmanager" || runningProcess.getProcessName ==="chatter"){
                            this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);
                        }else{
                            const uid = `${runningProcess.getProcessName}-${runningProcess.getProcessId}`;
  
                            this._TriggerList.push(file);
                            this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);
                            
                            this._runningProcessService.addEventOriginator(uid);
                            this._runningProcessService.changeProcessContentNotify.next();
                        }
                    }
                    return;
                }             
            }
        }

        msg = `Osdrive:/App Directory/${file.getOpensWith}`;
        this.appNotFoundNotify.next(msg);
        return;
    }

    /**
     * Getting the last process from the Trigger, will remove it the TriggerList.
     */
    getLastProcessTrigger():FileInfo{
        if(this._TriggerList.length > 0){
           return this._TriggerList.pop() || new FileInfo;
        }

        return new FileInfo;
    }

    setViewContainerRef(ref: ViewContainerRef) {
        this._viewContainerRef = ref;
    }

    // Optional: method that uses the container
    private createComponent(component: Type<any>) {
        this._viewContainerRef.clear();
        this._viewContainerRef.createComponent(component);
    }

    //   private showDialogMsgBox(dialogMsgType:string, msg:string):void{
    //     const componentRef = this.itemViewContainer.createComponent(DialogComponent);
    //     const notificationId = componentRef.instance.notificationId;
    //     this._componentReferenceService.addComponentReference(notificationId, componentRef);
    
    //     if(dialogMsgType === UserNotificationType.Error){
    //       componentRef.setInput('inputMsg', msg);
    //       componentRef.setInput('notificationType', dialogMsgType);
    //     }else if(dialogMsgType === UserNotificationType.Info){
    //       componentRef.setInput('inputMsg', msg);
    //       componentRef.setInput('notificationType', dialogMsgType);
    //     }else if(dialogMsgType === UserNotificationType.PowerOnOff){
    //       componentRef.setInput('inputMsg', msg);
    //       componentRef.setInput('notificationType', dialogMsgType);
    //     }else{
    //       componentRef.setInput('inputMsg', msg);
    //       componentRef.setInput('notificationType', dialogMsgType);
    //     }
    //   }
    
    private showPropertiesWindow(fileInput:FileInfo):void{

        // checkif property view is already visible
        console.log('propertyView:', fileInput);
        const fileName =`${Constants.WIN_EXPLR +  fileInput.getFileName}`;
        console.log('propertyView fileName:', fileName);

        const process = this._runningProcessService.getProcessByName(fileName);
        if(!process){
            const componentRef = this._viewContainerRef.createComponent(PropertiesComponent);
            const propertyId = componentRef.instance.processId;
            this._componentReferenceService.addComponentReference(propertyId, componentRef);
            componentRef.setInput('fileInput',fileInput);
        }
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}