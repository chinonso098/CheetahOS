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

  chatMsgEvt = Constants.CHAT_MSG_EVT;
  userConnectEvt = Constants.USER_CONNECT_EVT;
  newUserInfoEvt = Constants.NEW_USER_INFO_EVT;
  removeUserInfoEvt = Constants.REMOVE_USER_INFO_EVT;
  userDisconnectEvt = Constants.USER_DISCONNECT_EVT;
  userIsTypingEvt=  Constants.USER_IS_TYPING_EVT;
  updateOnlineUserCountEvt = Constants.UPDATE_ONLINE_USER_COUNT_EVT;
  
  constructor() {
    this.socket = io('http://localhost:3000');
    SocketService.instance = this;

    this._processIdService = ProcessIDService.instance;
    this._runningProcessService = RunningProcessService.instance;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());
  }

  sendMessage(evt:string, data: any) {
    this.socket.emit(evt, data);
  }

  onNewMessage(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.chatMsgEvt, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.chatMsgEvt);
      };
    });
  }

  onNewUserConnect(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.userConnectEvt, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.userConnectEvt);
      };
    });
  }

  onNewUserInfo(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.newUserInfoEvt, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.newUserInfoEvt);
      };
    });
  }

  onUserDisconnect(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.userDisconnectEvt, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.userDisconnectEvt);
      };
    });
  }

  onUpdateOnlineUserCount(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(this.updateOnlineUserCountEvt, (data) => {
        observer.next(data);
      });

      // Handle cleanup
      return () => {
        this.socket.off(this.updateOnlineUserCountEvt);
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