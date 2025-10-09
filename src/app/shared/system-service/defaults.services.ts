import { Injectable } from "@angular/core";

import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";

import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { BaseService } from "./base.service.interface";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { SessionManagmentService } from "./session.management.service";
import { Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class DefaultService implements BaseService{

    private _processIdService:ProcessIDService;
    private _runningProcessService:RunningProcessService;
    private _sessionManagmentService:SessionManagmentService;

    private _defaultSettingsMap!:Map<string, string>; 
    private readonly _defaultSettingServiceKey = Constants.CHEETAH_DEFAULT_SETTINGS_KEY;

    defaultSettingsChangeNotify: Subject<string> = new Subject<string>();

    name = 'defaults_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles tracking of usr choice';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService, sessionManagmentService:SessionManagmentService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;
        this._sessionManagmentService = sessionManagmentService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this.retrievePastSessionData(this._defaultSettingServiceKey);
    }

    private initializeDefaultSettings(): void {

        this._defaultSettingsMap = new Map<string, string>([
            [Constants.DEFAULT_LOCK_SCREEN_TIMEOUT, "1000"],
            [Constants.DEFAULT_LOCK_SCREEN_BACKGROUND, ''],
            [Constants.DEFAULT_DESKTOP_BACKGROUND, '']
          ]);

        this._sessionManagmentService.addMapBasedSession(this._defaultSettingServiceKey, this._defaultSettingsMap);
    }

    getDefaultSetting(key:string):string{

        if(this._defaultSettingsMap.has(key))
            return this._defaultSettingsMap.get(key) ?? Constants.EMPTY_STRING

        return Constants.EMPTY_STRING;
    }

    setDefultData(key:string, val:string):void{
        this._defaultSettingsMap.set(key, val);
        this._sessionManagmentService.addMapBasedSession(this._defaultSettingServiceKey, this._defaultSettingsMap);
        this.defaultSettingsChangeNotify.next(key);
    }

    private retrievePastSessionData(key:string):void{
        const sessionData = this._sessionManagmentService.getMapBasedSession(key) as Map<string, string>;
        console.log(`${key} sessionData:`, sessionData);
        if(sessionData){
            if(key === this._defaultSettingServiceKey)
                this._defaultSettingsMap = sessionData;

            return;
        }

        this.initializeDefaultSettings();
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
