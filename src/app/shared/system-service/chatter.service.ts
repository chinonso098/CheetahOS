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
    private _socketService!:SocketService;

    private _connectedUserCounter = 0;
    private _listTS = -1;
    private _comeOnlineTS = -1;
    private _chatData:ChatMessage[] = [];
    private _onlineUsers:IUserData[] = [];

    private _newMessagRecievedSub!: Subscription;
    private _userConnectSub!:Subscription;
    private _userDisconnectSub!:Subscription;
    private _newUserInformationSub!:Subscription;
    private _updateOnlineUserListSub!:Subscription;
    private _updateUserNameSub!:Subscription;
    private _updateUserCountSub!:Subscription;
    private _userOfflineRemoveUserInfoSub!:Subscription;
    
    newMessageNotify: Subject<void> = new Subject<void>();
    userCountChangeNotify: Subject<number> = new Subject<number>();
    newUserInformationNotify: Subject<void> = new Subject<void>();
    updateOnlineUserListNotify: Subject<void> = new Subject<void>();
    updateOnlineUserCountNotify: Subject<void> = new Subject<void>();
    updateUserNameNotify: Subject<void> = new Subject<void>();
    updateUserCountNotify: Subject<void> = new Subject<void>();
  

    readonly CHAT_MSG_EVT ='chatMessage';
    readonly USER_CONNECT_EVT ='userConnected';
    readonly NEW_USER_INFO_EVT ='newUserInfo';
    readonly UPDATE_USER_NAME_EVT ='updateUserName';
    readonly REMOVE_USER_INFO_EVT ='removeUserInfo';
    readonly USER_DISCONNECT_EVT ='userDisconnected';
    readonly USER_IS_TYPING_EVT = 'userIsTyping';
    readonly UPDATE_ONLINE_USER_COUNT_EVT = 'updateOnlineUserCount'; 
    readonly UPDATE_ONLINE_USER_LIST_EVT = 'updateOnlineUserList'; 
  
  
    name = 'chatter_msg_svc';
    icon = `${Constants.IMAGE_BASE_PATH}chatter.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';
    
    receivedCounter = 0;
    possibleIDs = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];
    chatterServiceID =  `ChatterServiceID_${this.possibleIDs[Math.floor(Math.random() * this.possibleIDs.length)]}`;

    constructor() {
        this._processIdService = ProcessIDService.instance;
        this._runningProcessService = RunningProcessService.instance;
        this._sessionManagmentService = SessionManagmentService.instance;

        // this._socketService = SocketService.instance;
        // console.log('Chatter constructor 1st:', this._socketService);

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

    }

    sendChatMessage(data:ChatMessage) {
       this._socketService.sendMessage(this.CHAT_MSG_EVT, data);
    }

    sendUserOnlineAddInfoMessage(data:IUserData) {
        this._socketService.sendMessage(this.NEW_USER_INFO_EVT, data);
    }

    sendUserOfflineRemoveInfoMessage(data:IUserData) {
        this._socketService.sendMessage(this.REMOVE_USER_INFO_EVT, data);

        setTimeout(() => {
            console.log('Terminate old subscriptions');
            this.terminateSubscriptions();
        }, 35);
    }

    sendUpdateUserNameMessage(data:IUserData) {
        this._socketService.sendMessage(this.UPDATE_USER_NAME_EVT, data);
    }

    sendMyOnlineUsersListMessage(data:IUserList) {
        if(this._listTS === -1){
            this._listTS = data.timeStamp;
        }
        this._socketService.sendMessage(this.UPDATE_ONLINE_USER_LIST_EVT, data);
    }

    sendUpdateOnlineUserCountMessage() {
        const data = {'timeStamp':this._comeOnlineTS, 'userCount':this._connectedUserCounter}
        this._socketService.sendMessage(this.UPDATE_ONLINE_USER_COUNT_EVT, data);
    }

    userIsTypingMessage(data: IUserData) {
        this._socketService.sendMessage(this.USER_IS_TYPING_EVT, data);
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
        return this._connectedUserCounter;
    }

    setComeOnlineTS(timeStamp:number):void{
        this._comeOnlineTS = timeStamp;
    }

    private updateUserCount(update:string){
        console.log('updateUserCount:', update)
        if(update === '+'){
            this._connectedUserCounter++;            
        }else if(update === '-'){
            this._connectedUserCounter--;
        }

        console.log('userCount:', this._connectedUserCounter)
        this.userCountChangeNotify.next(0);
    }

    private updateUserCountAfterComparing(userCount:any){
        if(userCount){
            const tStamp =  userCount.timeStamp as number;
            const uCount =  userCount.userCount as number;
            console.log('tStamp:', tStamp);
            console.log('uCount:', uCount);

            if(tStamp < this._comeOnlineTS &&  uCount > this._connectedUserCounter){
                this._connectedUserCounter = uCount;
                this.userCountChangeNotify.next(1);
            }
        }
    }

    private raiseNewMessageReceived(chatMsg:any):void{
        if(chatMsg){
            const msg = chatMsg._msg as string;
            const userId = chatMsg._userId as string;
            const userName = chatMsg._userName as string;
            const userNameAcronym = chatMsg._userNameAcronym as string;
            const iconColor = chatMsg._iconColor as string;
            const msgDate = chatMsg._msgDate as string;
            const isSysMsg = chatMsg._isSysMsg as boolean;

            const newChatData  = new ChatMessage(msg, userId, userName, userNameAcronym, iconColor, msgDate);
            newChatData.setIsSysMgs = isSysMsg;
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
            const tmpList =  this.removeDuplicates(this._onlineUsers);
            this._onlineUsers = [];
            this._onlineUsers = tmpList;
            this.newUserInformationNotify.next();
        }
    }

    private raiseUpdateOnlineUserListRecieved(onlinerUserList: any):void{
        if(onlinerUserList){
            console.log('raiseUpdateOnlineUserListRecieved');
            console.log('onlinerUserList:',onlinerUserList);
            this.receivedCounter++;

            const userList: IUserList = {
                timeStamp: onlinerUserList.timeStamp,
                onlineUsers: onlinerUserList.onlineUsers.map((user: IUserData) => ({
                  userId: user.userId,
                  userName: user.userName,
                  userNameAcronym: user.userNameAcronym,
                  color: user.color
                }))
              };

            if(userList.timeStamp > this._listTS){                
                // combined both lists
                const  mergeList = [...this._onlineUsers, ...userList.onlineUsers];

                this._onlineUsers = this.removeDuplicates(mergeList);
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
           const currUserInfoIdx = this._onlineUsers.findIndex(x => x.userId === newUserInfo.userId);

           if(currUserInfo){
                currUserInfo.userName = newUserInfo.userName;
                currUserInfo.userNameAcronym = newUserInfo.userNameAcronym;
                this._onlineUsers[currUserInfoIdx] = currUserInfo;
            }
            
            this.updateUserNameNotify.next();
        }
    }

    private raiseRemoveUserFromOnlineListRecieved(userInfo:any):void{
        console.log('offlinUser :',userInfo);
        if(userInfo){

            const offlineUser:IUserData = {
                'userId': userInfo.userId as string,
                'userName': userInfo.userName as string,
                'userNameAcronym': userInfo.userNameAcronym as string,
                'color':userInfo.color as string,
            }

            console.log('raiseRemoveUserFromOnlineListRecieved');
            console.log('offlineUser :',offlineUser);

           const deleteCount = 1;
           const userInfoIdx = this._onlineUsers.findIndex(x => x.userId === offlineUser.userId);
           if (userInfoIdx !== -1) {
                this._onlineUsers.splice(userInfoIdx, deleteCount);
            }
            
            this.updateOnlineUserListNotify.next();
        }
    }

    private terminateSubscriptions():void{
        this._newMessagRecievedSub?.unsubscribe();
        this._userDisconnectSub?.unsubscribe();
        this._userConnectSub?.unsubscribe();
        this._newUserInformationSub?.unsubscribe();
        this._updateOnlineUserListSub?.unsubscribe();
        this._updateUserNameSub?.unsubscribe();
        this._updateUserCountSub?.unsubscribe();
        this._userOfflineRemoveUserInfoSub?.unsubscribe();
    }

    private removeDuplicates(arr:IUserData[]):IUserData[]{
        const result = arr.filter((value, index, self) =>
            index === self.findIndex((t) => (
                t.userId === value.userId 
            ))
        );
        return result;
    }

    
    setSocketInstance(socketService:SocketService):void{
        this._socketService = socketService;
    }

    setSubscriptions():void{
        console.log('Set new subscriptions');
        this._newMessagRecievedSub = this._socketService.onMessageEvent(this.CHAT_MSG_EVT).subscribe((p)=>{this.raiseNewMessageReceived(p)});
        this._userConnectSub = this._socketService.onMessageEvent(this.USER_CONNECT_EVT).subscribe((i)=>{this.updateUserCount(i)});
        this._userDisconnectSub = this._socketService.onMessageEvent(this.USER_DISCONNECT_EVT).subscribe((j)=>{this.updateUserCount(j)});
        this._newUserInformationSub = this._socketService.onMessageEvent(this.NEW_USER_INFO_EVT).subscribe((t)=>{this.raiseNewUserInformationRecieved(t)});
        this._updateOnlineUserListSub = this._socketService.onMessageEvent(this.UPDATE_ONLINE_USER_LIST_EVT).subscribe((t)=>{this.raiseUpdateOnlineUserListRecieved(t)});
        this._updateUserNameSub = this._socketService.onMessageEvent(this.UPDATE_USER_NAME_EVT).subscribe((t)=>{this.raiseUpdateUserNameRecieved(t)});
        this._updateUserCountSub = this._socketService.onMessageEvent(this.UPDATE_ONLINE_USER_COUNT_EVT).subscribe((j)=>{this.updateUserCountAfterComparing(j)});
        this._userOfflineRemoveUserInfoSub = this._socketService.onMessageEvent(this.REMOVE_USER_INFO_EVT).subscribe((t)=>{this.raiseRemoveUserFromOnlineListRecieved(t)});
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }
  
    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}
