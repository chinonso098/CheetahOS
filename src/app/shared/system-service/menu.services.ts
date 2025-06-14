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
    storeData: Subject<string[]> = new Subject<string[]>();
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

    private _isPasteActive = false;
    private _path = 'NOPATH';
    private _actions = Constants.EMPTY_STRING;
    private _stageData = Constants.EMPTY_STRING;

    name = 'menu_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = Constants.ZERO;
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
    
    setPasteState(isActive:boolean):void{
        this._isPasteActive = isActive;
    }

    getPasteState():boolean{
        return this._isPasteActive;
    }

    setPath(path:string):void{
        this._path = path;
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


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}