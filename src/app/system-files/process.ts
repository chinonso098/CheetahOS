import { Constants } from "./constants";
import { FileInfo } from "./fs/file.info";


export class Process{

    private _processId:number;
    private _processName:string;
    private _icon:string;
    private _hasWindow:boolean;
    private _type:string;
    private _status:string;
    private _powerUsage:string;
    private _cpuUsage:number;
    private _memoryUsage:number;
    private _diskUsage:number;
    private _gpuUsage:number;
    private _networkUsage:number;
    private _processTrigger:FileInfo | undefined;

    constructor(processId:number, processName:string, icon:string, hasWindow:boolean, type:string, processTrigger?:FileInfo){
        this._processId = processId;
        this._processName = processName;
        this._icon = icon;
        this._hasWindow = hasWindow;
        this._type = type;
        this._processTrigger = processTrigger;
        this._memoryUsage = 0;
        this._cpuUsage = 0;
        this._gpuUsage = 0;
        this._diskUsage = 0;
        this._networkUsage = 0;
        this._status = Constants.EMPTY_STRING;
        this._powerUsage = Constants.EMPTY_STRING;
    }

    public get getProcessId():number{
        return this._processId;
    }

    public get getProcessName():string{
        return this._processName;
    }

    public get getIcon():string{
        return this._icon;
    }

    public get getCpuUsage():number{
        return this._cpuUsage;
    }

    public get getGpuUsage():number{
        return this._gpuUsage;
    }

    public get getMemoryUsage():number{
        return this._memoryUsage;
    }

    public get getHasWindow():boolean{
        return this._hasWindow;
    }

    public get getType():string{
        return this._type;
    }

    public get getProcessTrigger():FileInfo | undefined{
        return this._processTrigger;
    }

    public get getDiskUsage():number{
        return this._diskUsage;
    }

    public get getNetworkUsage():number{
        return this._networkUsage;
    }

    public get getProcessStatus():string{
        return this._status;
    }

    public get getPowerUsage():string{
        return this._powerUsage;
    }

    public set setCpuUsage(cpuUage:number){
        this._cpuUsage = cpuUage;
    }

    public set setGpuUsage(gpuUage:number){
        this._gpuUsage = gpuUage;
    }
    
    public set setMemoryUsage(memoryUsage:number){
        this._memoryUsage = memoryUsage;
    }

    public set setProcessTrigger(trigger:FileInfo){
        this._processTrigger = trigger;
    }

    public set setDiskUsage(diskUsage:number){
        this._diskUsage = diskUsage;
    }
    
    public set setNetworkUsage(networkUsage:number){
        this._networkUsage = networkUsage;
    }

    public set setProcessStatus(procStatus:string){
        this._status = procStatus;
    }
    
    public set setPowerUsage(powerUsage:string){
        this._powerUsage = powerUsage;
    }
}