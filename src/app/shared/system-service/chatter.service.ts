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
import { IUserData, IUserList } from 'src/app/system-apps/chatter/model/chat.interfaces';
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
    private listTS = -1;
    private _chatData:ChatMessage[] = [];
    private _onlineUsers:IUserData[] = [];

    private _newMessagRecievedSub!: Subscription;
    private _userConnectSub!: Subscription;
    private _userDisconnectSub!: Subscription;
    private _newUserInformationSub!: Subscription;
    private _updateOnlineUserListSub!: Subscription;
    private _updateUserNameSub!: Subscription;
    
    newMessageNotify: Subject<void> = new Subject<void>();
    userCountChangeNotify: Subject<void> = new Subject<void>();
    newUserInformationNotify: Subject<void> = new Subject<void>();
    updateOnlineUserListNotify: Subject<void> = new Subject<void>();
    updateUserNameNotify: Subject<void> = new Subject<void>();

    chatMsgEvt = Constants.CHAT_MSG_EVT;
    userConnectEvt = Constants.USER_CONNECT_EVT;
    newUserInfoEvt = Constants.NEW_USER_INFO_EVT;
    updateUserNameEvt = Constants.UPDATE_USER_NAME_EVT;
    removeUserInfoEvt = Constants.REMOVE_USER_INFO_EVT;
    userDisconnectEvt = Constants.USER_DISCONNECT_EVT;
    userIsTypingEvt=  Constants.USER_IS_TYPING_EVT;
    updateOnlineUserCountEvt = Constants.UPDATE_ONLINE_USER_COUNT_EVT;
    updateOnlineUserListEvt = Constants.UPDATE_ONLINE_USER_LIST_EVT;
  
  
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

        this._newMessagRecievedSub = this._socketService.onGenericEvent(this.chatMsgEvt).subscribe((p)=>{this.raiseNewMessageReceived(p)});
        
        this._userConnectSub = this._socketService.onGenericEvent(this.userConnectEvt).subscribe((i)=>{this.updateUserCount(i)});
        this._userDisconnectSub = this._socketService.onGenericEvent(this.userDisconnectEvt).subscribe((j)=>{this.updateUserCount(j)});
        
        this._newUserInformationSub = this._socketService.onGenericEvent(this.newUserInfoEvt).subscribe((t)=>{this.raiseNewUserInformationRecieved(t)});

        this._updateOnlineUserListSub = this._socketService.onGenericEvent(this.updateOnlineUserListEvt).subscribe((t)=>{this.raiseUpdateOnlineUserListRecieved(t)});
        this._updateUserNameSub = this._socketService.onGenericEvent(this.updateUserNameEvt).subscribe((t)=>{this.raiseUpdateUserNameRecieved(t)});
    }

    sendChatMessage(data:ChatMessage) {
       this._socketService.sendMessage(this.chatMsgEvt, data);
    }

    sendUserInfoMessage(data:IUserData) {
        this._socketService.sendMessage(this.newUserInfoEvt, data);
    }

    sendRemoveInfoMessage(data:IUserData) {
        this._socketService.sendMessage(this.removeUserInfoEvt, data);
    }

    sendUpdateUserNameMessage(data:IUserData) {
        this._socketService.sendMessage(this.updateUserNameEvt, data);
    }

    sendMyOnlineUsersListMessage(data:IUserList) {
        if(this.listTS === -1){
            this.listTS = data.timeStamp;
        }
        this._socketService.sendMessage(this.updateOnlineUserListEvt, data);
    }

    sendUpdateOnlineUserCount(data:ChatMessage) {
        this._socketService.sendMessage(this.updateOnlineUserCountEvt, data);
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

    getListOfOnlineUsers():IUserData[]{
        return this._onlineUsers;
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

        console.log('userCount:', this.connectedUserCounter)
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
            const newUser:IUserData = {
                'userId': userInfo.userId as string,
                'userName': userInfo.userName as string,
                'userNameAcronym': userInfo.userNameAcronym as string,
                'color':userInfo.color as string,
            }
            this._onlineUsers.push(newUser);
            this.newUserInformationNotify.next();
        }
    }

    private raiseUpdateOnlineUserListRecieved(onlinerUserList:any):void{
        if(onlinerUserList){
            console.log('raiseUpdateOnlineUserListRecieved');
            console.log('onlinerUserList:',onlinerUserList);

            const userList: IUserList = {
                timeStamp: onlinerUserList.timeStamp,
                onlineUsers: onlinerUserList.onlineUsers.map((user: IUserData) => ({
                  userId: user.userId,
                  userName: user.userName,
                  userNameAcronym: user.userNameAcronym,
                  color: user.color
                }))
              };

            if(userList.timeStamp > this.listTS){
                // Merge lists and remove duplicates using a Map
                const mergedList: IUserData[] = [
                    ...new Map([...this._onlineUsers, ...userList.onlineUsers].map(user => [user.userId, user])).values()
                ];

                this._onlineUsers = [];
                this._onlineUsers = mergedList;
                this.updateOnlineUserListNotify.next();
            }
        }
    }

    private raiseUpdateUserNameRecieved(userInfo:any):void{
        if(userInfo){
            const newUserInfo:IUserData = {
                'userId': userInfo.userId as string,
                'userName': userInfo.userName as string,
                'userNameAcronym': userInfo.userNameAcronym as string,
                'color':userInfo.color as string,
            }

           const currUserInfo = this._onlineUsers.find(x => x.userId === newUserInfo.userId);

           console.log('currUserInfo:',currUserInfo);

           const currUserInfoIdx = this._onlineUsers.findIndex(x => x.userId === newUserInfo.userId);

           console.log('currUserInfoIdx:',currUserInfoIdx);

           if(currUserInfo){
                currUserInfo.userName = newUserInfo.userName;
                currUserInfo.userNameAcronym = newUserInfo.userNameAcronym;

                this._onlineUsers[currUserInfoIdx] = currUserInfo;

                console.log('currUserInfo:',currUserInfo);
            }
            
            this.updateUserNameNotify.next();
        }
    }

    terminateSubscription():void{
        const timeout = 600000;
        setTimeout(() => {
            this._newMessagRecievedSub?.unsubscribe();
            this._userDisconnectSub?.unsubscribe();
            this._userConnectSub?.unsubscribe();
            this._newUserInformationSub?.unsubscribe();
            this._updateOnlineUserListSub?.unsubscribe();
            this._updateUserNameSub?.unsubscribe();

        }, timeout);
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }
  
    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
