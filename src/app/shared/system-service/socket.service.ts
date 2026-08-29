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
import { BaseService } from '../../system-files/base/base.service.interface';
import { DefaultService } from './defaults.services';

//For the moment, this service has only one consumer, And should close when the consumer is terminated
@Injectable()
export class SocketService implements BaseService {
  private readonly socket: Socket;
  private _runningProcessService!: RunningProcessService;
  private _processIdService!: ProcessIDService;

  readonly productionSocketUrl = 'https://chattersvc.com';
  readonly developmentSocketUrl = 'http://localhost:3000';

  name = 'socket_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = Constants.EMPTY_STRING;

  constructor(processIDService: ProcessIDService, runningProcessService: RunningProcessService, private defaultService: DefaultService) {

    // Select the socket endpoint by comparing the stored environment flag
    // EXPLICITLY against PROD. The setting is a non-empty string in every case
    // ('PROD' or 'NON-PROD'), so a plain truthiness check treated 'NON-PROD' as
    // production and made the dev branch unreachable -- pointing local clients at
    // the production server instead of the localhost node server that holds the
    // chat history. Equality against PROD restores correct routing.
    const isProd = this.defaultService.getDefaultSetting(Constants.ENVIRONMENT) === Constants.PROD;
    const socketUrl = isProd ? this.productionSocketUrl : this.developmentSocketUrl;
    //console.log(`SocketService: connecting to ${socketUrl} (isProd=${isProd})`);

    this.socket = io(socketUrl, {
      // Polling FIRST (Socket.IO default order): establishes the connection over
      // plain HTTP immediately, then transparently upgrades to websocket when
      // possible. Leading with websocket breaks clients whose cross-site WS is
      // blocked (extensions/tracking protection/proxies) because each reconnect
      // retries websocket instead of falling back.
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });

    this._processIdService = processIDService;
    this._runningProcessService = runningProcessService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getProcessDetail());
    this._runningProcessService.addService(this.getServiceDetail());

    // Non-breaking: helpful diagnostics
    this.socket.on('connect', () => console.log('SocketService: connected', this.socket.id));
    this.socket.on('connect_error', (err) => console.warn('SocketService: connect_error', err?.message ?? err));
    this.socket.on('disconnect', (reason) => console.log('SocketService: disconnected', reason));
  }

  // Method to send message to the server
  sendMessage(evt: string, data: any) {
    if (!evt || typeof evt !== 'string') return;
    this.socket.emit(evt, data);
  }

  // Observable to receive messages from the server
  onMessageEvent(evt: string): Observable<any> {
    return new Observable((observer) => {
      if (!evt || typeof evt !== 'string') {
        observer.complete();
        return undefined;
      }

      const handler = (data: any) => observer.next(data);
      this.socket.on(evt, handler);

      // Cleanup only THIS handler (prevents nuking other listeners)
      return () => {
        this.socket.off(evt, handler);
      };
    });
  }

  disconnect() {
    if (this.socket) {
      const id = this.socket.id;
      this.socket.disconnect();
      console.log('SocketService: Disconnected from server.', id);
    }
  }

  private getProcessDetail(): Process {
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

  private getServiceDetail(): Service {
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
  }
}