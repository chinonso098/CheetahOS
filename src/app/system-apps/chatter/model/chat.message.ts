export class ChatMessage {
    private _msg: string;
    private _userId:string;
    private _userName:string;
    private _userNameAcronym:string;
    private _msgDate:string;
    private _iconColor:string;

    constructor(msg?:string, userId?:string, userName?:string, userNameAcronym?:string, iconColor?:string, msgDate?:string ){
        this._msg = (msg === undefined)?'':msg

        this._userId = (userId === undefined)?'': userId;

        this._userName = (userName === undefined)?'': userName;

        this._userNameAcronym = (userNameAcronym === undefined)?'': userNameAcronym;

        this._iconColor = (iconColor === undefined)?'':iconColor;
        
        const dateTime = new Date();  
        this._msgDate = (msgDate === undefined)?'': dateTime.toLocaleString('en-US', {
            weekday: 'long', // Full day name (e.g., "Tuesday")
            hour: 'numeric', // Hour (e.g., "9")
            minute: '2-digit', // Two-digit minutes (e.g., "50")
            hour12: true // Use 12-hour format with AM/PM
        });
    }


    set setMessage(msg:string){
         this._msg = msg;
    }

    set setUserId(userId:string){
        this._userId= userId;
    }

    set setUserName(userName:string){
        this._userName= userName;
    }

    set setUserNameAcronym(unAcronym:string){
        this._userNameAcronym= unAcronym;
    }

    set setMsgDate(msgDate:string){
        this._msgDate= msgDate;
    }

    set setIconColor(iconColor:string){
        this._iconColor= iconColor;
    }

    get getMessage(){
        return this._msg;
    }

    get getUserId(){
        return this._userId;
    }

    get getUserName(){
        return this._userName;
    }

    get getUserNameAcronym(){
        return this._userNameAcronym;
    }

    get getMsgDate(){
        return this._msgDate;
    }

    get getIconColor(){
        return this._iconColor;
    }
  }