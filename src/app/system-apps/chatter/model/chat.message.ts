export class ChatMessage {
    private _msg: string;
    private _userName:string;

    private _msgDate:string;

    constructor(msg:string, userName:string ){
        this._msg = msg;
        this._userName = userName;

        const dateTime = new Date();  
        this._msgDate = dateTime.toLocaleString('en-US', {
            weekday: 'long', // Full day name (e.g., "Tuesday")
            hour: 'numeric', // Hour (e.g., "9")
            minute: '2-digit', // Two-digit minutes (e.g., "50")
            hour12: true // Use 12-hour format with AM/PM
        });
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