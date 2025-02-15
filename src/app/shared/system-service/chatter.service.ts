import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { BaseService } from './base.service.interface';
import { Constants } from 'src/app/system-files/constants';
import { ProcessType } from 'src/app/system-files/system.types';
import { ProcessIDService } from './process.id.service';
import { RunningProcessService } from './running.process.service';
import { Process } from 'src/app/system-files/process';
import { Service } from 'src/app/system-files/service';
import { ChatMessage } from 'src/app/system-apps/chatter/model/chat.message';
import { SessionManagmentService } from './session.management.service';
import { IUserData } from 'src/app/system-apps/chatter/model/chat.interfaces';
import { SocketService } from './socket.service';

@Injectable({
  providedIn: 'root',
})
export class ChatterService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _sessionManagmentService:SessionManagmentService
    private _socketService:SocketService
    private userCount = 0;

    private _chatData:ChatMessage[] = [];
    private _newMessagRecievedSub!: Subscription;
    private _userConnectSub!: Subscription;
    private _userDisconnectSub!: Subscription;
    
    newMessageNotify: Subject<void> = new Subject<void>();
    userCountChangeNotify: Subject<void> = new Subject<void>();
    //userDisconnectNotify: Subject<void> = new Subject<void>();
  
  
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
        this._sessionManagmentService = SessionManagmentService.instance;
        this._socketService = SocketService.instance;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this._newMessagRecievedSub = this._socketService.onNewMessage().subscribe((p)=>{this.raiseNewMessageReceivedAlert(p)});
        this._userConnectSub = this._socketService.onNewUser().subscribe((i)=>{this.updateUserCount(i)});
        this._userDisconnectSub = this._socketService.onUserLeft().subscribe((j)=>{this.updateUserCount(j)});
    }

    sendMessage(data: ChatMessage) {
       this._socketService.sendMessage(data);
    }

    saveUserData(value: IUserData) {
        this._sessionManagmentService.addSession(this.name, value);
    }

    getUserData() {
        return this._sessionManagmentService.getSession(this.name);
    }

    getChatData():ChatMessage[]{
        return this._chatData;
    }

    getUserCount():number{
        return this.userCount;
    }

    private updateUserCount(update:string){
        console.log('updateUserCount:', update)
        if(update === '+'){
            this.userCount++
        }else{
            this.userCount--;
        }

        console.log('this.userCount:', this.userCount)
        this.userCountChangeNotify.next();
    }

    private raiseNewMessageReceivedAlert(newMessage:any):void{
        if(newMessage){
            const msg = newMessage._msg as string;
            const userName = newMessage._userName as string;
            const userNameAcronym = newMessage._userNameAcronym as string;
            const iconColor = newMessage._iconColor as string;
            const msgDate = newMessage._msgDate as string;

            const newChatData  = new ChatMessage(msg,userName,userNameAcronym,iconColor,msgDate);
            this._chatData.push(newChatData);
            this.newMessageNotify.next();
        }

    }

    terminateSubscription():void{
        const timeout = 600000
        setTimeout(() => {
            this._newMessagRecievedSub?.unsubscribe();
            this._userDisconnectSub?.unsubscribe();
            this._userConnectSub?.unsubscribe();
        }, timeout);
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }
  
    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
