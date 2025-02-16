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

    private connectedUserCounter = 0;
    private _chatData:ChatMessage[] = [];
    private _onlineUsers:IUserData[] = [];

    private _newMessagRecievedSub!: Subscription;
    private _userConnectSub!: Subscription;
    private _userDisconnectSub!: Subscription;
    private _newUserInformationSub!: Subscription;
    
    newMessageNotify: Subject<void> = new Subject<void>();
    userCountChangeNotify: Subject<void> = new Subject<void>();
    newUserInformationNotify: Subject<void> = new Subject<void>();

    chatMsgEvt = Constants.CHAT_MSG_EVT;
    userConnectEvt = Constants.USER_CONNECT_EVT;
    newUserInfoEvt = Constants.NEW_USER_INFO_EVT;
    updateUserInfoEvt = Constants.UPDATE_USER_INFO_EVT;
    removeUserInfoEvt = Constants.REMOVE_USER_INFO_EVT;
    userDisconnectEvt = Constants.USER_DISCONNECT_EVT;
    userIsTypingEvt=  Constants.USER_IS_TYPING_EVT;
  
  
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

        this._newMessagRecievedSub = this._socketService.onNewMessage().subscribe((p)=>{this.raiseNewMessageReceived(p)});
        
        this._userConnectSub = this._socketService.onNewUserConnect().subscribe((i)=>{this.updateUserCount(i)});
        this._userDisconnectSub = this._socketService.onUserDisconnect().subscribe((j)=>{this.updateUserCount(j)});
        
        this._newUserInformationSub = this._socketService.onNewUserInfo().subscribe((t)=>{this.raiseNewUserInformationRecieved(t)})
    }

    sendChatMessage(data: ChatMessage) {
       this._socketService.sendMessage(this.chatMsgEvt, data);
    }

    sendUserInfoMessage(data: IUserData) {
        this._socketService.sendMessage(this.newUserInfoEvt, data);
    }

    sendRemoveInfoMessage(data: IUserData) {
        this._socketService.sendMessage(this.removeUserInfoEvt, data);
    }

    sendUpdateInfoMessage(data: IUserData) {
        this._socketService.sendMessage(this.updateUserInfoEvt, data);
    }

    userIsTypingMessage(data: IUserData) {
        this._socketService.sendMessage(this.userIsTypingEvt, data);
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
        return this.connectedUserCounter;
    }

    private updateUserCount(update:string){
        console.log('updateUserCount:', update)
        if(update === '+'){
            this.connectedUserCounter++;
        }else{
            this.connectedUserCounter--;
        }

        console.log('this.userCount:', this.connectedUserCounter)
        this.userCountChangeNotify.next();
    }

    private raiseNewMessageReceived(chatMsg:any):void{
        if(chatMsg){
            const msg = chatMsg._msg as string;
            const userId = chatMsg._userId as string;
            const userName = chatMsg._userName as string;
            const userNameAcronym = chatMsg._userNameAcronym as string;
            const iconColor = chatMsg._iconColor as string;
            const msgDate = chatMsg._msgDate as string;

            const newChatData  = new ChatMessage(msg, userId, userName, userNameAcronym, iconColor, msgDate);
            this._chatData.push(newChatData);
            this.newMessageNotify.next();
        }
    }

    private raiseNewUserInformationRecieved(userInfo:any):void{
        if(userInfo){
            console.log('new user info:',userInfo);
            //this.newUserInformationNotify.next();
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
