import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { TaskBarPreviewImage } from "src/app/system-apps/taskbarpreview/taskbar.preview";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { BaseService } from "./base.service.interface";
import { WindowState, WindowBoundsState } from "../system-component/window/windows.types";

@Injectable({
    providedIn: 'root'
})

export class WindowService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    
    private _processPreviewImages:Map<string, TaskBarPreviewImage[]>;
    private _processWindows:Map<string, string[]>;
    private _processWindowBounds:Map<string, WindowBoundsState>;
    private _processWindowStates:WindowState[];
    private _hiddenOrVisibleWindows:number[];
    private _eventOriginator = Constants.EMPTY_STRING;
    private _processWindowWithTheHighestZIndex = 0;

    focusOnCurrentProcessWindowNotify: Subject<number> = new Subject<number>();
    focusOnNextProcessWindowNotify: Subject<number> = new Subject<number>();

    currentProcessInFocusNotify: Subject<number> = new Subject<number>();
    noProcessInFocusNotify: Subject<void> = new Subject<void>();
  
    hideProcessPreviewWindowNotify: Subject<void> = new Subject<void>();
    hideOtherProcessesWindowNotify: Subject<number> = new Subject<number>();
    keepProcessPreviewWindowNotify: Subject<void> = new Subject<void>();

    maximizeProcessWindowNotify: Subject<void> = new Subject<void>();
    minimizeProcessWindowNotify: Subject<number[]> = new Subject<number[]>();

    setProcessWindowToFocusOnMouseHoverNotify: Subject<number> = new Subject<number>();
    showProcessPreviewWindowNotify: Subject<unknown[]> = new Subject<unknown[]>();
    showOrSetProcessWindowToFocusOnClickNotify: Subject<number> = new Subject<number>();
 
    resizeProcessWindowNotify: Subject<number[]> = new Subject<number[]>();
    removeFocusOnOtherProcessesWindowNotify: Subject<number> = new Subject<number>();
    restoreOrMinimizeProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessWindowOnMouseLeaveNotify: Subject<number> = new Subject<number>();
    restoreProcessesWindowNotify: Subject<void> = new Subject<void>();

    windowDragIsActive: Subject<void> = new Subject<void>();
    windowDragIsInActive: Subject<void> = new Subject<void>();

    closeWindowProcessNotify:Subject<number> = new Subject<number>();

    
    name = 'window_mgmt_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'keeps track of all procs windows';

    constructor(processIDService:ProcessIDService, punningProcessService:RunningProcessService){
        this._processPreviewImages = new Map<string, TaskBarPreviewImage[]>();
        this._processWindows = new Map<string, string[]>();
        this._processWindowBounds = new Map<string, WindowBoundsState>();
        this._processWindowStates = [];
        this._hiddenOrVisibleWindows = [];

        this._processIdService = processIDService;
        this._runningProcessService = punningProcessService;
  
        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }

    addProcessPreviewImage(appName:string, data:TaskBarPreviewImage):void{
        if(!this._processPreviewImages.has(appName)){
            const tmpArr:TaskBarPreviewImage[] = [data];
            this._processPreviewImages.set(appName, tmpArr);
        }
        else{
            const currImages = this._processPreviewImages.get(appName) || [];
            currImages.push(data);
            this._processPreviewImages.set(appName, currImages);
        }
    }

    addProcessWindowToWindows(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];

        if(!this._processWindows.has(appName)){
            this._processWindows.set(appName, [uid]);
        }
        else{
            const currUids = this._processWindows.get(appName) || [];
            currUids.push(uid);
            this._processWindows.set(appName, currUids);
        }
    }

    addWindowState(winState:WindowState):void{
        const idx = this._processWindowStates.findIndex(x => x.pid === winState.pid);

        if(idx === -1){
            this._processWindowStates.push(winState);
        } else{
            this._processWindowStates[idx] = winState;
        }
    }

    addProcessWindowBounds(uid:string, bounds:WindowBoundsState):void{
        const appName = uid.split(Constants.DASH)[0];
        this._processWindowBounds.set(appName, bounds);
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    addProcessWindowIDWithHighestZIndex(pid:number):void{
        this._processWindowWithTheHighestZIndex = pid;
    }

    addProcessIDToHiddenOrVisibleWindows(pid:number):void{
        this._hiddenOrVisibleWindows.push(pid);
    }

    removeProcessPreviewImages(appName:string):void{
        if(this._processPreviewImages.has(appName))
            this._processPreviewImages.delete(appName);
    }

    removeProcessWindowFromWindows(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processWindows.has(appName)){
            const currUids = this._processWindows.get(appName) || [];

            const deleteCount = 1;
            const uidIndex = currUids.indexOf(uid)
            if(uidIndex !== 1) {
                currUids.splice(uidIndex, deleteCount);
                this._processWindows.set(appName, currUids);
            }

            if(currUids.length === 1)
                this._processWindows.delete(appName);
        }
    }

    removeProcessWindowBounds(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];
        if(this._processWindowBounds.has(appName))
            this._processWindowBounds.delete(appName);
    }

    isProcessWindowInWindows(uid:string):boolean{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processWindows.has(appName))
            return true;

        return false;
    }

    removeProcessPreviewImage(appName:string, pid:number):void{
        const deleteCount = 1;
        if(this._processPreviewImages.has(appName)){
            const currImages = this._processPreviewImages.get(appName) || [];
            const dataIndex = currImages.findIndex(d => d.pid  === pid);
    
            if(dataIndex != -1){
                currImages.splice(dataIndex || 0, deleteCount)
            }
        }
    }

    removeEventOriginator():void{
        this._eventOriginator = Constants.EMPTY_STRING;
    }

    removeWindowState(pid:number):void{
        const deleteCount = 1;
        const winStateIdx = this._processWindowStates.findIndex(p => p.pid === pid);

        if(winStateIdx !== -1){
            this._processWindowStates.splice(winStateIdx, deleteCount)
        }
    }

    getProcessPreviewImages(appName:string):TaskBarPreviewImage[]{
        if(this._processPreviewImages.has(appName))
           return this._processPreviewImages.get(appName) || [];

        return [];
    }

    getProcessCountFromWindowList(uid:string):number{
        const appName = uid.split(Constants.DASH)[0];

        if(this._processPreviewImages.has(appName)){
            const currUids = this._processWindows.get(appName) || [];

            return currUids.length;
        }

        return 0;
    }

    getProcessWindowBounds(uid:string):WindowBoundsState | undefined{
        const appName = uid.split(Constants.DASH)[0];
        if(this._processWindowBounds.has(appName))
            return this._processWindowBounds.get(appName);

        return undefined;
    }

    getNextPidInWindowStateList():number{
        /**
         * get the next window state, where isvisible == true
         */
        let winState:WindowState = {
            width: 0, height: 0,  x_axis: 0,  y_axis: 0, z_index: 0,is_visible: false,  pid: 0, app_name: ""
        }

        if(this._processWindowStates.length === 0)
            return winState.pid;

        for(let i = this._processWindowStates.length - 1; i >= 0;  i--){
            if(this._processWindowStates[i].is_visible){
                winState = this._processWindowStates[i];
                break;
            }
        }

        return winState.pid;
    }

    getWindowState(pid:number):WindowState | null{
        return this._processWindowStates.find(x => x.pid === pid) || null;
    }

    getWindowStates():WindowState[]{
        return this._processWindowStates;
    }

    getProcessWindowIDWithHighestZIndex():number{
        return this._processWindowWithTheHighestZIndex;
    }

    getEventOrginator():string{
        return this._eventOriginator;
    }

    getProcessIDOfHiddenOrVisibleWindows():number[]{
       return this._hiddenOrVisibleWindows;
    }

    resetHiddenOrVisibleWindowsList():void{
        this._hiddenOrVisibleWindows = [];
     }

    cleanUp(uid:string):void{
        const appName = uid.split(Constants.DASH)[0];
        this.removeProcessWindowFromWindows(uid);

        // only remove window bound information when there is no more windows for the given app
        const currUids = this._processWindows.get(appName) || [];
        if(currUids.length === 0){
            this.removeProcessWindowBounds(uid);
        }
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}