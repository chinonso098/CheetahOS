// src/app/services/socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { BaseService } from './base.service.interface';

@Injectable({
  providedIn: 'root',
})
export class SocketService implements BaseService {
  private socket: Socket;
  static instance: SocketService;
  private _runningProcessService:RunningProcessService;
  private _processIdService:ProcessIDService;


  name = 'socket_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status  = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = '';
  evtString ='message';
  
  constructor() {
    this.socket = io('http://localhost:3000');
    SocketService.instance = this;

    this._processIdService = ProcessIDService.instance;
    this._runningProcessService = RunningProcessService.instance;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  sendMessage(data: any) {
    this.socket.emit(this.evtString, data);
  }

  onNewMessage(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.evtString, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.evtString);
      };
    });
  }

  private getProcessDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private getServiceDetail():Service{
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
  }
}