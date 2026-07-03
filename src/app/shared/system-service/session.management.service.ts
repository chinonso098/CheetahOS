import {Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";
import { BaseService } from "../../system-files/base/base.service.interface";
import { AppState } from "src/app/system-files/state/state.interface";

@Injectable({
    providedIn: 'root'
})

export class SessionManagementService implements BaseService{

    private _sessionName = "main-session";
    private _sessionDataDict: Map<string, unknown>; 

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
  
    name = 'session_mgmt_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles load/save of user session';
        
    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        // Attempt to restore the consolidated session map from localStorage.
        // This service is providedIn: 'root' and is built during app startup, so a
        // corrupted/partial 'main-session' entry (truncated write, manual edit,
        // quota eviction) must NOT throw here or it could break the entire boot.
        // Fall back to an empty map if parsing fails for any reason.
        this._sessionDataDict = this.loadSession();

        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addSession(key:string, dataToAdd:unknown): void{
        this._sessionDataDict.set(key, dataToAdd);
        this.saveSession(this._sessionDataDict);
    }

    addAppSession(key:string, dataToAdd:AppState): void{
        const data =  JSON.stringify(dataToAdd);
        // Guard the write so quota/storage errors are logged rather than thrown
        // back to the caller.
        try{
            localStorage.setItem(key, data);
        }
        catch(error){
            console.error(`${this.name}: failed to save app session '${key}'.`, error);
        }
    }

    getSession(key:string):unknown{
        const stateData = this._sessionDataDict.get(key);
        return stateData;
    }

    getAppSession(key:string):AppState | null{
        const appDataStr = localStorage.getItem(key);
        if(appDataStr){
            // Guard against malformed JSON so a single corrupt app entry cannot
            // throw and disrupt callers; treat unparsable data as "no session".
            try{
                return JSON.parse(appDataStr) as AppState;
            }
            catch{
                return null;
            }
        }
        return null;
    }

    removeSession(key:string): void{
        this._sessionDataDict.delete(key);
        this.saveSession(this._sessionDataDict);
    }

    removeAppSession(key:string): void{
        localStorage.removeItem(key);
    }

    clearSession(): void{
        // Reset the in-memory map and wipe all persisted storage.
        // Note: localStorage.clear() removes every key for this origin, not just
        // the keys owned by this service.
        this._sessionDataDict = new Map<string, unknown>();
        localStorage.clear();
    }

    clearAppSession(): void{
        const userOpenedAppsKey = Constants.USER_OPENED_APPS;
        const appsInstanceUIDKey = Constants.USER_OPENED_APPS_INSTANCE;
        this.removeSession(userOpenedAppsKey);
        this.removeSession(appsInstanceUIDKey);

        const processWithWindows = this._runningProcessService.getProcesses().filter(x => x.getHasWindow === true);
        for(const process of processWithWindows){
            const uId = `${process.getProcessName}-${process.getProcessId}`;
            this.removeAppSession(uId);
        }
    }

    // Loads and deserializes the consolidated session map from localStorage.
    // Returns an empty map if nothing is stored or if the stored data is invalid.
    private loadSession():Map<string, unknown>{
        const sessData = localStorage.getItem(this._sessionName);
        if(sessData){
            try{
                return new Map(JSON.parse(sessData));
            }
            catch{
                // Corrupted/invalid payload: start clean rather than crash startup.
                console.error(`${this.name}: failed to parse stored session, resetting.`);
            }
        }
        return new Map<string, unknown>();
    }

    private saveSession(sessionData:Map<string, unknown>){
        const data =  JSON.stringify(Array.from(sessionData.entries()));
        // Persisting can throw (e.g. QuotaExceededError in private mode or when
        // storage is full). Swallow-and-log so a failed save never crashes the
        // caller; the in-memory map remains the source of truth for this session.
        try{
            localStorage.setItem(this._sessionName, data);
        }
        catch(error){
            console.error(`${this.name}: failed to save session.`, error);
        }
    }

    addMapBasedSession(key: string, map: Map<string, string>): void {
        const serialized = JSON.stringify(Array.from(map.entries()));
        // Guard the write so quota/storage errors are logged rather than thrown
        // back to the caller.
        try{
            localStorage.setItem(key, serialized);
        }
        catch(error){
            console.error(`${this.name}: failed to save map-based session '${key}'.`, error);
        }
    }

    getMapBasedSession(key: string): Map<string, string> | null {
        const item = localStorage.getItem(key);
        if (!item) return null;

        try {
            const parsed: [string, string][] = JSON.parse(item);
            return new Map(parsed);
        } catch {
            return null;
        }
    }

    deleteMapBasedSession(key:string): void {
        localStorage.removeItem(key);
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}