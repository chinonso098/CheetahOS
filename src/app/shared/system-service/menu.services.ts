import { Injectable, signal } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";
import { FileTreeNode } from "src/app/system-files/common.interfaces";
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

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;

    pinToTaskBar = signal<FileInfo | null>(null, { equal: () => false });
    unPinFromTaskBar = signal<FileInfo | null>(null, { equal: () => false });

    openApplicationFromTaskBar = signal<FileInfo | null>(null, { equal: () => false });
    closeApplicationFromTaskBar = signal<Process[] | null>(null, { equal: () => false });
    showTaskBarAppIconMenu = signal<unknown[] | null>(null, { equal: () => false });
    showTaskBarConextMenu = signal<MouseEvent | null>(null, { equal: () => false });

    hideStartMenu = signal(0);
    showStartMenu = signal(0);
    hideContextMenus = signal<string | null>(null, { equal: () => false });
    addToQuickAccess = signal<FileTreeNode[] | null>(null, { equal: () => false });
    showPropertiesView = signal<FileInfo | null>(null, { equal: () => false });

    hideShowTaskBar = signal(0);
    UnMergeTaskBarIcon = signal(0);
    mergeTaskBarIcon = signal(0);
    tiggerTaskManager = signal(0);
    showTheDesktop = signal(0);
    showOpenWindows = signal(0);
    updateTaskBarContextMenu = signal(0);

    hideSearchBox = signal<string | null>(null, { equal: () => false });
    showSearchBox = signal(0);

    hideOverFlowMenu = signal<string | null>(null, { equal: () => false });
    showOverFlowMenu = signal(0);

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