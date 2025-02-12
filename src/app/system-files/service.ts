export class Service{

    private _processId:number;
    private _serviceName:string;
    private _serviceDescription:string;
    private _icon:string;
    private _hasWindow:boolean;
    private _type:string;
    private _status:string;


    constructor(processId:number, serviceName:string, icon:string, type:string, serviceDescription:string, status:string){
        this._processId = processId;
        this._serviceName = serviceName;
        this._icon = icon;
        this._hasWindow = false;
        this._serviceDescription = serviceDescription
        this._type = type;
        this._status = status;
    }

    public get getProcessId(){
        return this._processId;
    }

    public get getProcessName(){
        return this._serviceName;
    }

    public get getIcon(){
        return this._icon;
    }

    public get getHasWindow(){
        return this._hasWindow;
    }

    public get getType(){
        return this._type;
    }

    public get getProcessStatus(){
        return this._status;
    }

    public get getServiceDescription(){
        return this._serviceDescription;
    }

    public get getServiceStatus(){
        return this._status;
    }

    public set setServiceDescription(svcDescription:string){
        this._serviceDescription = svcDescription;
    }

    public set setProcessStatus(procStatus:string){
        this._status = procStatus;
    }
    
    public set setServiceStatus(svcStatus:string){
        this._status = svcStatus;
    }
}