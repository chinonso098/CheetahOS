import {Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";

@Injectable({
    providedIn: 'root'
})

export class SessionManagmentService{

    private _sessionName = "main-session";
    public readonly _pickUpKey = "temp-session-retrieval-key";
    private _sessionDataDict: Map<string, unknown>; 
    static instance: SessionManagmentService;
    private _sessionRetrievalCounter = 0;

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
  
    name = 'session_mgmt_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles load/save of user session ';
        

    constructor(){
        if(sessionStorage.getItem(this._sessionName)){
            const sessData = sessionStorage.getItem(this._sessionName) as string;
            this._sessionDataDict = new Map(JSON.parse(sessData));
            SessionManagmentService.instance = this;
        }
        else{
            this._sessionDataDict = new  Map<string, unknown>();
            SessionManagmentService.instance = this;
        }

        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addSession(key:string, dataToAdd:unknown): void{

        if(key === this._pickUpKey){
            this.addTempSession(dataToAdd);
        }else{
            this._sessionDataDict.set(key,dataToAdd)
            this.saveSession(this._sessionDataDict);
        }
    }

    getSession(key:string):unknown{
        const stateData = this._sessionDataDict.get(key);
        return stateData;
    }

    getTempSession(key:string):string{
        let result= '';
        if(this._sessionRetrievalCounter <= 1){
            // console.log(`counter:${this._sessionRetrievalCounter} -----  retrievedSess:${this._sessionRetrievalCounter}`);

            result = sessionStorage.getItem(key) || '';
            if(this._sessionRetrievalCounter === 1){
                sessionStorage.removeItem(key);
                this._sessionRetrievalCounter = 0;
                return  result;
            }
            this._sessionRetrievalCounter++;
            return  result;
        }
        return result;
    }
       

    getKeys():string[]{
        const keys:string[] = [];

        for(const key of this._sessionDataDict.keys()){
            keys.push(key)
        }
        return keys;
    }

    hasTempSession(key:string):boolean{
        return (sessionStorage.getItem(key) !==null) ? true : false;
    }

    removeSession(key:string): void{
        this._sessionDataDict.delete(key)
        this.saveSession(this._sessionDataDict);
    }

    resetSession(): void{
        this._sessionDataDict = new Map<string, unknown>;
        sessionStorage.clear()
    }

    private saveSession(sessionData:Map<string, unknown>){
        const data =  JSON.stringify(Array.from(sessionData.entries()));
        sessionStorage.setItem(this._sessionName, data);
    }

    private addTempSession(sessionData:unknown){
        sessionStorage.setItem(this._pickUpKey, sessionData as string);
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description)
    }
}