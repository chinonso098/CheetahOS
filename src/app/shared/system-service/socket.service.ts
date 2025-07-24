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

//For the moment, this service has only one consumer, And should close when the consumer is terminated
@Injectable()
export class SocketService implements BaseService {
  private socket: Socket;
  private _runningProcessService:RunningProcessService;
  private _processIdService:ProcessIDService;

  name = 'socket_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status  = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = Constants.EMPTY_STRING;
  
  constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService) {
    //this.socket = io('http://chinonsosnas.local:3000');
    this.socket = io('http://localhost:3000');

    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  // Method to send message to the server
  sendMessage(evt:string, data: any) {
    this.socket.emit(evt, data);
  }

  // Observable to receive messages from the server
  onMessageEvent(evt:string): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(evt, (data) => {
        observer.next(data);
      });
      // Handle cleanup
      return () => {
        this.socket.off(evt);
      };
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('SocketService: Disconnected from server.');
    }
  }

  private getProcessDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private getServiceDetail():Service{
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
  }
}