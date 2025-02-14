export class ChatMessage {
    private _msg: string;
    private _userName:string;

    private _msgDate:string;

    constructor(msg:string, userName:string ){
        this._msg = msg;
        this._userName = userName;

        const dateTime = new Date();  
        this._msgDate = `${dateTime.getMonth() + 1}/${dateTime.getDate()}/${dateTime.getFullYear()}`;
    }

    get getMessage(){
        return this._msg;
    }
    set setMessage(msg:string){
         this._msg = msg;
    }

    get getUserName(){
        return this._userName;
    }
    set setUserName(userName:string){
        this._userName= userName
    }
    
    get getMsgDate(){
        return this._msgDate;
    }
  }