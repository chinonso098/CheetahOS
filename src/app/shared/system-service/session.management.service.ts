import {Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";
import { AppState } from "src/app/system-files/state/state.interface";

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
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles load/save of user session';
        
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        if(localStorage.getItem(this._sessionName)){
            const sessData = localStorage.getItem(this._sessionName) as string;
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

    addAppSession(key:string, dataToAdd:AppState): void{
        const data =  JSON.stringify(dataToAdd);
        localStorage.setItem(key, data);
    }

    getSession(key:string):unknown{
        const stateData = this._sessionDataDict.get(key);
        return stateData;
    }

    getAppSession(key:string):AppState | null{
        const appDataStr = localStorage.getItem(key);
        if(appDataStr){
            const appData = JSON.parse(appDataStr) as AppState;
            return appData;
        }
        return null;
    }

    removeSession(key:string): void{
        this._sessionDataDict.delete(key)
        this.saveSession(this._sessionDataDict);
    }

    removeAppSession(key:string): void{
        localStorage.removeItem(key);
    }

    clearSession(): void{
        this._sessionDataDict = new Map<string, unknown>;
        localStorage.clear()
    }

    clearAppSession(): void{
        const userOpenedAppsKey = Constants.USER_OPENED_APPS;
        const appsInstanceUIDKey = Constants.USER_OPENED_APPS_INSTANCE;
        this.removeSession(userOpenedAppsKey);
        this.removeSession(appsInstanceUIDKey);

        const processWithWindows = this._runningProcessService.getProcesses().filter(x => x.getHasWindow === true);
        for(const proccess of processWithWindows){
            const uid = `${proccess.getProcessName}-${proccess.getProcessId}`;
            this.removeAppSession(uid);
        }
    }

    private saveSession(sessionData:Map<string, unknown>){
        const data =  JSON.stringify(Array.from(sessionData.entries()));
        localStorage.setItem(this._sessionName, data);
    }

    addFileServiceSession(key: string, map: Map<string, string>): void {
        const serialized = JSON.stringify(Array.from(map.entries()));
        localStorage.setItem(key, serialized);
    }

    getFileServiceSession(key: string): Map<string, string> | null {
        const item = localStorage.getItem(key);
        if (!item) return null;

        try {
            const parsed: [string, string][] = JSON.parse(item);
            return new Map(parsed);
        } catch {
            return null;
        }
    }

    deleteFileServiceSession(): void {
        const fileServiceDeleteKey = Constants.FILE_SVC_RESTORE_KEY;
        localStorage.removeItem(fileServiceDeleteKey);
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}