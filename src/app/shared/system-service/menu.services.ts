import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";

import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";
import { BaseService } from "../../system-files/base/base.service.interface";
import { FileTreeNode } from "src/app/system-files/commons/common.interfaces";
import { FileInfo } from "src/app/system-files/fs/file.info";


@Injectable({
    providedIn: 'root'
})

export class MenuService implements BaseService{

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;

    pinToTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    unPinFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();

    openApplicationFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    closeApplicationFromTaskBar: Subject<Process[]> = new Subject<Process[]>();
    showTaskBarAppIconMenu: Subject<unknown[]> = new Subject<unknown[]>();
    showTaskBarConextMenu: Subject<MouseEvent> = new Subject<MouseEvent>();

    hideStartMenu: Subject<void> = new Subject<void>();
    showStartMenu: Subject<void> = new Subject<void>();    
    // Emits the uId of the surface that must close its context menu. A surface
    // closes only when the emitted id matches its own — targeted dismissal, so
    // sibling instances sharing a `name` (e.g. two File Explorers) no longer
    // collide the way the old `hideContextMenus` self-filter broadcast did.
    closeContextMenu: Subject<string> = new Subject<string>();
    addToQuickAccess: Subject<FileTreeNode[]> = new Subject<FileTreeNode[]>();
    showPropertiesView: Subject<FileInfo> = new Subject<FileInfo>();

    hideShowTaskBar: Subject<void> = new Subject<void>();
    UnMergeTaskBarIcon: Subject<void> = new Subject<void>();
    mergeTaskBarIcon: Subject<void> = new Subject<void>();
    tiggerTaskManager: Subject<void> = new Subject<void>();
    showTheDesktop: Subject<void> = new Subject<void>();
    showOpenWindows: Subject<void> = new Subject<void>();
    updateTaskBarContextMenu:Subject<void> = new Subject<void>();

    hideSearchBox: Subject<string> = new Subject<string>();
    showSearchBox: Subject<void> = new Subject<void>();

    hideOverFlowMenu: Subject<string> = new Subject<string>();
    showOverFlowMenu: Subject<void> = new Subject<void>();

    /**
     * Whether the start menu is currently open. Read by the desktop's keyboard
     * handler so it stands down (ignores arrow/Home/End/etc.) while the start menu
     * owns navigation — this prevents the desktop icon grid and the start menu from
     * both reacting to the same keystroke.
     */
    isStartMenuOpen = false;
    isContextMenuOpen = false;


    private storeData:string[] = []
    private _isPasteActive = false;
    private _path = Constants.EMPTY_STRING;
    private _actions = Constants.EMPTY_STRING;
    private _stageData = Constants.EMPTY_STRING;

    // Single source of truth for which surface's context menu is open,
    // identified by its uId (`${name}-${processId}`; the desktop uses the bare
    // Constants.DESKTOP id for every menu it renders).
    private _openContextMenuOwner = Constants.EMPTY_STRING;

    name = 'menu_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Background;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = ' ';

    constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
        this._processIdService = processIDService;
        this._runningProcessService = runningProcessService;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());
    }
    
    getPasteState():boolean{
        return this._isPasteActive;
    }

    // A surface is opening its context menu: close the previously-open menu
    // (if a different owner) and record the new owner.
    openContextMenu(ownerUId:string):void{
        this.dismissOpenContextMenu(ownerUId);
        this._openContextMenuOwner = ownerUId;
        this.isContextMenuOpen = true;
    }

    // Close whatever context menu is open. Callers pass their own uId so they
    // aren't told to re-close the menu they're already closing.
    closeAllContextMenus(callerUId:string = Constants.EMPTY_STRING):void{
        this.dismissOpenContextMenu(callerUId);
        this._openContextMenuOwner = Constants.EMPTY_STRING;
        this.isContextMenuOpen = false;
    }

    // Notify the current owner to close, unless it is `exceptUId`.
    private dismissOpenContextMenu(exceptUId:string):void{
        if(this._openContextMenuOwner !== Constants.EMPTY_STRING &&
           this._openContextMenuOwner !== exceptUId){
            this.closeContextMenu.next(this._openContextMenuOwner);
        }
    }

    getPath():string{
        return this._path;
    }

    setActions(action:string):void{
        this._actions = action;
    }

    getActions():string{
        return this._actions;
    }

    setStageData(stageData:string):void{
        this._stageData = stageData;
    }

    getStageData():string{
        return this._stageData;
    }

    getIsContextMenuOpen():boolean{
        return this.isContextMenuOpen;
    }

    setStoreData(stageData:string[]):void{
        this.storeData = stageData;
        this._path = stageData[0];
        this._actions = stageData[1];
        this._isPasteActive = true;
    }

    resetStoreData():void{
        this.storeData = [];
        this._path = Constants.EMPTY_STRING
        this._actions = Constants.EMPTY_STRING;
        this._isPasteActive = false;
    }

    getStoreData():string[]{
        return this.storeData;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}