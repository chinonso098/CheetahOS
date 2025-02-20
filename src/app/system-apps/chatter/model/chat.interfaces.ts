export interface IUser {
    firstName: string;
    lastName: string;
}

export interface IUserData{
    userId:string;
    userName: string;
    userNameAcronym:string;
    color:string;
    isTyping:boolean;
}

export interface IUserList{
    timeStamp:number;
    onlineUsers: IUserData[];
}