import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { TaskBarPreviewImage } from "src/app/system-apps/taskbarpreview/taskbar.preview";
import { Constants } from "src/app/system-files/constants";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { BaseService } from "./base.service.interface";
import { WindowState, WindowBoundsState,  WindowResizeInfo} from "../system-component/window/windows.types";
import { TaskBarPreviewPositionInfo } from "src/app/system-apps/taskbarentries/taskbar.entries.type";

@Injectable({
    providedIn: 'root'
})

export class WindowService implements BaseService{

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    
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
    showProcessPreviewWindowNotify: Subject<TaskBarPreviewPositionInfo> = new Subject<TaskBarPreviewPositionInfo>();
    showOrSetProcessWindowToFocusOnClickNotify: Subject<number> = new Subject<number>();
 
    resizeProcessWindowNotify: Subject<WindowResizeInfo> = new Subject<WindowResizeInfo>();
    removeFocusOnOtherProcessesWindowNotify: Subject<number> = new Subject<number>();
    restoreOrMinimizeProcessWindowNotify: Subject<number> = new Subject<number>();
    restoreProcessWindowOnMouseLeaveNotify: Subject<number> = new Subject<number>();
    restoreProcessesWindowNotify: Subject<void> = new Subject<void>();

    windowDragIsActive: Subject<void> = new Subject<void>();
    windowDragIsInActive: Subject<void> = new Subject<void>();
    closeWindowProcessNotify:Subject<number> = new Subject<number>();

    // ────────────────────────────────────────────────────────────────────
    // Per-pid keyed dispatcher.
    //
    // Background: the `*Notify` Subjects above are broadcast channels --
    // every window subscriber receives every notification and then
    // discards it with a `pid !== this.processId` guard. With N open
    // windows that's O(N) deliveries per pid-targeted event, even though
    // only one window cares.
    //
    // The keyed Subjects below provide O(1) delivery: a publisher still
    // calls e.g. `focusOnCurrentProcessWindowNotify.next(pid)` (so apps
    // and services that already publish on the legacy Subjects don't need
    // to change), and a one-shot bridge in this service's constructor
    // routes each emission to the per-pid Subject. Subscribers that care
    // only about a single window call `onXxxFor(pid)` instead of
    // subscribing to the broadcast Subject + guarding.
    //
    // Lifetime: `releaseChannelsForPid(pid)` must be called when a window
    // is torn down so the Map entries don't leak.
    // ────────────────────────────────────────────────────────────────────
    private readonly _focusOnCurrentByPid = new Map<number, Subject<void>>();
    private readonly _focusOnNextByPid    = new Map<number, Subject<void>>();
    private readonly _restoreOrMinByPid   = new Map<number, Subject<void>>();
    private readonly _closeByPid          = new Map<number, Subject<void>>();
    private readonly _showOrSetFocusByPid = new Map<number, Subject<void>>();
    private readonly _resizeByPid         = new Map<number, Subject<WindowResizeInfo>>();
    
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

        // Bridge legacy broadcast Subjects -> per-pid keyed Subjects so that
        // existing publishers keep working unchanged. Each bridge is a single
        // Map.get + .next() per emission (O(1) regardless of window count).
        this.focusOnCurrentProcessWindowNotify.subscribe(pid => this._getOrCreateChannel(this._focusOnCurrentByPid, pid).next());
        this.focusOnNextProcessWindowNotify   .subscribe(pid => this._getOrCreateChannel(this._focusOnNextByPid,    pid).next());
        this.restoreOrMinimizeProcessWindowNotify.subscribe(pid => this._getOrCreateChannel(this._restoreOrMinByPid, pid).next());
        this.closeWindowProcessNotify         .subscribe(pid => this._getOrCreateChannel(this._closeByPid,          pid).next());
        this.showOrSetProcessWindowToFocusOnClickNotify.subscribe(pid => this._getOrCreateChannel(this._showOrSetFocusByPid, pid).next());
        this.resizeProcessWindowNotify        .subscribe(info => this._getOrCreateChannel(this._resizeByPid, info.pId).next(info));
    }

    // ────────────────────────────────────────────────────────────────────
    // Per-pid channel helpers
    // ────────────────────────────────────────────────────────────────────

    /**
     * Internal: fetch (or lazily create) the keyed Subject for `pid`.
     * Lazy creation is intentional -- a subscriber may call `onXxxFor`
     * before any publisher has fired, and we still need a Subject to hand
     * back so it can receive future emissions.
     */
    private _getOrCreateChannel<T>(map: Map<number, Subject<T>>, pid: number): Subject<T> {
        let s = map.get(pid);
        if (!s) {
            s = new Subject<T>();
            map.set(pid, s);
        }
        return s;
    }

    /** Emits only when `focusOnCurrentProcessWindowNotify` fires with `pid`. */
    onFocusOnCurrentFor(pid: number): Observable<void> {
        return this._getOrCreateChannel(this._focusOnCurrentByPid, pid).asObservable();
    }

    /** Emits only when `focusOnNextProcessWindowNotify` fires with `pid`. */
    onFocusOnNextFor(pid: number): Observable<void> {
        return this._getOrCreateChannel(this._focusOnNextByPid, pid).asObservable();
    }

    /** Emits only when `restoreOrMinimizeProcessWindowNotify` fires with `pid`. */
    onRestoreOrMinimizeFor(pid: number): Observable<void> {
        return this._getOrCreateChannel(this._restoreOrMinByPid, pid).asObservable();
    }

    /** Emits only when `closeWindowProcessNotify` fires with `pid`. */
    onCloseWindowFor(pid: number): Observable<void> {
        return this._getOrCreateChannel(this._closeByPid, pid).asObservable();
    }

    /** Emits only when `showOrSetProcessWindowToFocusOnClickNotify` fires with `pid`. */
    onShowOrSetFocusFor(pid: number): Observable<void> {
        return this._getOrCreateChannel(this._showOrSetFocusByPid, pid).asObservable();
    }

    /** Emits only when `resizeProcessWindowNotify` fires with `info.pId === pid`. */
    onResizeFor(pid: number): Observable<WindowResizeInfo> {
        return this._getOrCreateChannel(this._resizeByPid, pid).asObservable();
    }

    /**
     * Complete and drop all per-pid keyed Subjects associated with `pid`.
     * Call this once when a window is destroyed so the Map entries don't
     * accumulate over the lifetime of the app.
     */
    releaseChannelsForPid(pid: number): void {
        const maps: Map<number, Subject<unknown>>[] = [
            this._focusOnCurrentByPid as unknown as Map<number, Subject<unknown>>,
            this._focusOnNextByPid    as unknown as Map<number, Subject<unknown>>,
            this._restoreOrMinByPid   as unknown as Map<number, Subject<unknown>>,
            this._closeByPid          as unknown as Map<number, Subject<unknown>>,
            this._showOrSetFocusByPid as unknown as Map<number, Subject<unknown>>,
            this._resizeByPid         as unknown as Map<number, Subject<unknown>>,
        ];
        for (const map of maps) {
            map.get(pid)?.complete();
            map.delete(pid);
        }
    }

    addProcessPreviewImage(appName:string, data:TaskBarPreviewImage):void{
        if(!this._processPreviewImages.has(appName))
            this._processPreviewImages.set(appName, [data]);
        
        else{
            const currImages = this._processPreviewImages.get(appName) ?? [];
            const currImg = currImages.find(x => x.pId === data.pId)
            if(currImg){
                currImg.imageData = Constants.EMPTY_STRING;
                currImg.imageData = data.imageData
            }
            else
                currImages.push(data);
            
            this._processPreviewImages.set(appName, currImages);
        }
    }

    addProcessWindowToWindows(uId:string):void{
        const appName = uId.split(Constants.DASH)[0];

        if(!this._processWindows.has(appName)){
            this._processWindows.set(appName, [uId]);
        }
        else{
            const currUids = this._processWindows.get(appName) ?? [];
            currUids.push(uId);
            this._processWindows.set(appName, currUids);
        }
    }

    addWindowState(winState:WindowState):void{
        const idx = this._processWindowStates.findIndex(x => x.pId === winState.pId);

        if(idx === -1){
            this._processWindowStates.push(winState);
        } else{
            this._processWindowStates[idx] = winState;
        }
    }

    addProcessWindowBounds(uId:string, bounds:WindowBoundsState):void{
        const appName = uId.split(Constants.DASH)[0];
        this._processWindowBounds.set(appName, bounds);
    }

    addEventOriginator(eventOrig:string):void{
        this._eventOriginator = eventOrig;
    }

    addProcessWindowIDWithHighestZIndex(pId:number):void{
        this._processWindowWithTheHighestZIndex = pId;
    }

    addProcessIDToHiddenOrVisibleWindows(pId:number):void{
        this._hiddenOrVisibleWindows.push(pId);
    }

    // removeProcessPreviewImages(appName:string):void{
    //     if(this._processPreviewImages.has(appName))
    //         this._processPreviewImages.delete(appName);
    // }

    removeProcessWindowFromWindows(uId: string): void {
        const appName = uId.split(Constants.DASH)[0];
    
        if (!this._processWindows.has(appName)) return;
    
        const currUIds = this._processWindows.get(appName) ?? [];
        const filteredUIds = currUIds.filter(id => id !== uId);
    
        if (filteredUIds.length > 0) {
            this._processWindows.set(appName, filteredUIds);
        } else {
            this._processWindows.delete(appName);
        }
    }
    
    removeProcessWindowBounds(uId:string):void{
        const appName = uId.split(Constants.DASH)[0];
        if(this._processWindowBounds.has(appName))
            this._processWindowBounds.delete(appName);
    }

    isProcessWindowInWindows(uId:string):boolean{
        const appName = uId.split(Constants.DASH)[0];

        if(this._processWindows.has(appName))
            return true;

        return false;
    }

    removeProcessPreviewImage(appName: string, pId: number): void {
        if (!this._processPreviewImages.has(appName)) return;
    
        const currImages = this._processPreviewImages.get(appName) ?? [];
        const updatedImages = currImages.filter(d => d.pId !== pId);

        if (updatedImages.length === 0) {
            this._processPreviewImages.delete(appName);
        } else {
            this._processPreviewImages.set(appName, updatedImages);
        }
    }

    removeEventOriginator():void{
        this._eventOriginator = Constants.EMPTY_STRING;
    }

    removeWindowState(pId:number):void{
        this._processWindowStates = this._processWindowStates.filter(p => p.pId !== pId);
    }

    removeProcessIDToHiddenOrVisibleWindows(pId:number):void{
        if(!this._hiddenOrVisibleWindows.includes(pId)) return;

        this._hiddenOrVisibleWindows = this._hiddenOrVisibleWindows.filter(id => id !== pId);
    }

    getProcessPreviewImages(appName:string):TaskBarPreviewImage[]{
        if(this._processPreviewImages.has(appName))
           return this._processPreviewImages.get(appName) || [];

        return [];
    }

    getProcessCountFromWindowList(uId:string):number{
        const appName = uId.split(Constants.DASH)[0];

        if(this._processWindows.has(appName)){
            const currUids = this._processWindows.get(appName) || [];

            return currUids.length;
        }

        return 0;
    }

    getProcessWindowBounds(uId:string):WindowBoundsState | undefined{
        const appName = uId.split(Constants.DASH)[0];
        if(this._processWindowBounds.has(appName))
            return this._processWindowBounds.get(appName);

        return undefined;
    }

    getNextPidInWindowStateList():number{
        /**
         * get the next window state, where isvisible == true
         */
        let winState:WindowState = {
            widthPx: 0, heightPx: 0,  leftPx: 0,  topPx: 0, zIndex: 0,isVisible: false,  pId: 0, appName: ""
        }

        if(this._processWindowStates.length === 0)
            return winState.pId;

        for(let i = this._processWindowStates.length - 1; i >= 0;  i--){
            if(this._processWindowStates[i].isVisible){
                winState = this._processWindowStates[i];
                break;
            }
        }

        return winState.pId;
    }

    getWindowState(pId:number):WindowState | null{
        return this._processWindowStates.find(x => x.pId === pId) || null;
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

    cleanupWindowDataForApp(uId:string):void{
        const appName = uId.split(Constants.DASH)[0]; 
        this.removeProcessWindowFromWindows(uId);

        // only remove window bound information when there is no more windows for the given app
        const currUids = this._processWindows.get(appName) ?? [];
        if(currUids.length === 0)
            this.removeProcessWindowBounds(uId);
    }

    reset():void{
        this._processPreviewImages.clear();
        this._processWindows.clear();
        this._processWindowBounds.clear();
        this._processWindowStates = [];
        this._hiddenOrVisibleWindows = [];

        // Complete and drop all per-pid keyed Subjects so subscribers tied
        // to a previous "session" don't quietly leak Subject objects across
        // a soft reset.
        for (const map of [this._focusOnCurrentByPid, this._focusOnNextByPid, this._restoreOrMinByPid,
                           this._closeByPid, this._showOrSetFocusByPid, this._resizeByPid]) {
            for (const subject of map.values()) subject.complete();
            map.clear();
        }
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}