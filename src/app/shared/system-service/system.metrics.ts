// import { Injectable } from "@angular/core";
// import { Subject } from "rxjs";
// import { Constants } from "src/app/system-files/constants";
// import { ProcessType } from "src/app/system-files/system.types";
// import { ProcessIDService } from "./process.id.service";
// import { RunningProcessService } from "./running.process.service";
// import { Process } from "src/app/system-files/process";
// import { Service } from "src/app/system-files/service";
// import { BaseService } from "./base.service.interface";


// @Injectable({
//     providedIn: 'root'
// })

// export class SystemMetric implements BaseService{

//     private _systemMetrictsMap:Map<string, any>; 
//     private _runningProcessService:RunningProcessService;
//     private _processIdService:ProcessIDService;

//     errorNotify: Subject<string> = new Subject<string>();
//     InfoNotify: Subject<string> = new Subject<string>();
//     warningNotify: Subject<string> = new Subject<string>();
//     closeDialogBoxNotify: Subject<number> = new Subject<number>();

//     name = 'sys_metric_svc';
//     icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
//     processId = 0;
//     type = ProcessType.Background;
//     status  = Constants.SERVICES_STATE_RUNNING;
//     hasWindow = false;
//     description = ' ';
    
//     constructor(){
//         this._systemMetrictsMap = new Map<string, unknown>();
//         this._processIdService = ProcessIDService.instance;
//         this._runningProcessService = RunningProcessService.instance;

//         this.processId = this._processIdService.getNewProcessId();
//         this._runningProcessService.addProcess(this.getProcessDetail());
//         this._runningProcessService.addService(this.getServiceDetail());
//     }


//     // addSystemMetr(componentToAdd:Map<string, any>):void{
//     //     this._systemMetrictsMap.set(processId,componentToAdd)
//     // }
    
//     // getComponentReference(processId:number):Map<string, any>(){
//     //     const componentRef = this._systemMetrictsMap.get(processId);
    
//     //     // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//     //     return componentRef!;
//     // }


//     private getProcessDetail():Process{
//         return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
//     }

//     private getServiceDetail():Service{
//         return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
//     }
// }



//SYSTEM UPTIME, APP USED DURING SESSION, AND FOR HOW LONG, APPS INSTALLED, PROCESSES CURRENTLY RUNNING