import {Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { AppSessionData } from "src/app/system-files/state/state.interface";

@Injectable({
    providedIn: 'root'
})

export class SessionManagmentService implements BaseService{

    private _sessionName = "main-session";
    private _sessionDataDict: Map<string, unknown>; 

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
  
    name = 'session_mgmt_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = Constants.ZERO;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles load/save of user session';
        
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        if(sessionStorage.getItem(this._sessionName)){
            const sessData = sessionStorage.getItem(this._sessionName) as string;
            this._sessionDataDict = new Map(JSON.parse(sessData));
        }
        else{
            this._sessionDataDict = new  Map<string, unknown>();
        }

        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addSession(key:string, dataToAdd:unknown): void{
        this._sessionDataDict.set(key, dataToAdd)
        this.saveSession(this._sessionDataDict);
    }

    addAppSession(key:string, dataToAdd:AppSessionData): void{
        const data =  JSON.stringify(dataToAdd);
        sessionStorage.setItem(key, data);
    }

    getSession(key:string):unknown{
        const stateData = this._sessionDataDict.get(key);
        return stateData;
    }

    getAppSession(key:string):AppSessionData | null{
        const appDataStr = sessionStorage.getItem(key);
        if(appDataStr){
            const appData = JSON.parse(appDataStr) as AppSessionData;
            return appData;
        }
        return null;
    }



    removeSession(key:string): void{
        this._sessionDataDict.delete(key)
        this.saveSession(this._sessionDataDict);
    }

    removeAppSession(key:string): void{
        sessionStorage.removeItem(key);
    }

    clearSession(): void{
        this._sessionDataDict = new Map<string, unknown>;
        sessionStorage.clear()
    }

    private saveSession(sessionData:Map<string, unknown>){
        const data =  JSON.stringify(Array.from(sessionData.entries()));
        sessionStorage.setItem(this._sessionName, data);
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}