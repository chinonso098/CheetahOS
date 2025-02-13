import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BaseService } from './base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';

@Injectable({
  providedIn: 'root',
})
export class ChatterService implements BaseService{
    private chatData = new BehaviorSubject<any[]>([]);
    chatData$ = this.chatData.asObservable();

    private loadedMessages = new BehaviorSubject<any[]>([]);
    loadedMessages$ = this.loadedMessages.asObservable();

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
  
  
    name = 'chatter_msg_svc';
    icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';

    constructor() {
        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    setChatData(data: any[]) {
        this.chatData.next(data);
    }

    setLoadedMessages(messages: any[]) {
        this.loadedMessages.next(messages);
    }

    public saveData(key: string, value: string) {
        localStorage.setItem(key, value);
    }
    
    public getData(key: string) {
    return localStorage.getItem(key)
    }
    public removeData(key: string) {
        localStorage.removeItem(key);
    }

    public clearData() {
        localStorage.clear();
    }
    private getProcessDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }
  
    private getServiceDetail():Service{
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
