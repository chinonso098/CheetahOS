import { Injectable } from '@angular/core';
import { ActivityHistory } from 'src/app/system-files/activity.history';
import { BaseService } from './base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityHistoryService implements BaseService {

    private _processIdService:ProcessIDService;
    private _runningProcessService:RunningProcessService;
    private _activityHistory!: ActivityHistory[];

    private readonly STORAGE_KEY = 'activity_history';

    name = 'activity_tracking_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'handles tracking of file activity';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService) {
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;

        //this.loadFromStorage();

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    public addActivityHistory(type:string, name:string, path:string): void {
        const entry = {
            type : type, name : name, path : path, count: 1, lastOpened: Date.now()
        }

        this._activityHistory.push(entry);
        this.save();
    }

    updateActivityHistory(entry: ActivityHistory, isNameChanged = false, oldName?: string): void {
        let existing: ActivityHistory | undefined;

        if(isNameChanged && oldName) {
            // Look for entry by old name, path, and type
            existing = this._activityHistory.find( h => h.name === oldName 
                                        && h.path === entry.path 
                                        && h.type === entry.type);
            if(existing){
                // Update the name and reset count/lastOpened
                existing.name = entry.name;
                existing.count += 1;
                existing.lastOpened = Date.now();
            }
        } else {
            // Normal lookup by current name
            existing = this._activityHistory.find( h => (h.name === entry.name 
                                                && h.path === entry.path 
                                                && h.type === entry.type));
            if(existing){
                existing.count += 1;
                existing.lastOpened = Date.now();
            }
        }

        // If no existing entry found, add a new one
        // if (!existing) { this.addActivityHistory({...entry, count: 1, lastOpened: Date.now() }); }
        this.save();
    }

    getActivityHistory(name: string, path:string, type:string): ActivityHistory | undefined {
        const activityHistory = this._activityHistory.find( h => ( h.name === name &&
                                                            h.path === path &&
                                                            h.type === type
                                                        ));

         return activityHistory;
    } 

    removeActivityHistory(entry: ActivityHistory): void {
        const deleteCount = 1;
        const activityHistoryIdx = this._activityHistory.findIndex( h =>( h.name === entry.name &&
                                                                    h.path === entry.path &&
                                                                    h.type === entry.type
                                                                    ));
        if(activityHistoryIdx != -1){
            this._activityHistory.splice(activityHistoryIdx, deleteCount);
            this.save();
        }
    }


    private save(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._activityHistory));
    }

    private loadFromStorage(): void {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
        this._activityHistory = JSON.parse(data).map((h: any) => ({
            ...h,
            lastOpened: new Date(h.lastOpened) // restore Date objects
        }));
        }
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
