import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { FileInfo } from "src/app/system-files/file.info";
import { FileTreeNode } from "src/app/system-files/file.tree.node";
import { Process } from "src/app/system-files/process";


@Injectable({
    providedIn: 'root'
})

export class MenuService{

    private _isPasteActive = false;
    private _path = 'NOPATH';
    private _actions = '';
    private _stageData = '';

    pinToTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    unPinFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    // openApplication: Subject<FileInfo> = new Subject<FileInfo>();
    // closeApplication: Subject<FileInfo[]> = new Subject<FileInfo[]>();
    openApplicationFromTaskBar: Subject<FileInfo> = new Subject<FileInfo>();
    closeApplicationFromTaskBar: Subject<Process[]> = new Subject<Process[]>();
    showTaskBarMenu: Subject<unknown[]> = new Subject<unknown[]>();
    hideTaskBarMenu: Subject<void> = new Subject<void>();
    keepTaskBarMenu: Subject<void> = new Subject<void>();
    hideStartMenu: Subject<void> = new Subject<void>();
    showStartMenu: Subject<void> = new Subject<void>();
    hideContextMenus: Subject<void> = new Subject<void>();
    storeData: Subject<string[]> = new Subject<string[]>();
    addToQuickAccess: Subject<FileTreeNode[]> = new Subject<FileTreeNode[]>();
    showPropertiesView: Subject<FileInfo> = new Subject<FileInfo>();
    closePropertiesView: Subject<number> = new Subject<number>();
    createDesktopShortcut: Subject<void> = new Subject<void>();


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
}