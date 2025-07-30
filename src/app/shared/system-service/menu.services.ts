import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";
import { FileTreeNode } from "src/app/system-files/file.tree.node";
import { Process } from "src/app/system-files/process";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";


@Injectable({
    providedIn: 'root'
})

export class MenuService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;

    pinToTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    unPinFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();

    openApplicationFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    closeApplicationFromTaskBar: Subject<Process[]> = new Subject<Process[]>();
    showTaskBarAppIconMenu: Subject<unknown[]> = new Subject<unknown[]>();
    showTaskBarConextMenu: Subject<MouseEvent> = new Subject<MouseEvent>();

    hideStartMenu: Subject<void> = new Subject<void>();
    showStartMenu: Subject<void> = new Subject<void>();
    hideContextMenus: Subject<void> = new Subject<void>();
    addToQuickAccess: Subject<FileTreeNode[]> = new Subject<FileTreeNode[]>();
    showPropertiesView: Subject<FileInfo> = new Subject<FileInfo>();
    
    createDesktopShortcut: Subject<void> = new Subject<void>();

    hideShowTaskBar: Subject<void> = new Subject<void>();
    UnMergeTaskBarIcon: Subject<void> = new Subject<void>();
    mergeTaskBarIcon: Subject<void> = new Subject<void>();
    tiggerTaskManager: Subject<void> = new Subject<void>();
    showTheDesktop: Subject<void> = new Subject<void>();
    showOpenWindows: Subject<void> = new Subject<void>();
    updateTaskBarContextMenu:Subject<void> = new Subject<void>();

    private storeData:string[] = []
    private _isPasteActive = false;
    private _path = Constants.EMPTY_STRING;
    private _actions = Constants.EMPTY_STRING;
    private _stageData = Constants.EMPTY_STRING;

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