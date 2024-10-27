export class AppDirectory {

    private _systemProcessList: string[];
    private _userProcessList: string[];
    private _processList: string[] = [];

    constructor(){
        this._systemProcessList = this.fetchSystemApp();
        this._userProcessList = this.fetchUserApp();
        this.createAppsList();
    }

    appExist(appName:string):boolean{
        const strString = appName.trim();
        return (this._systemProcessList.includes(strString) || this._userProcessList.includes(strString))
    }

    private fetchSystemApp(): string[]{
        this._systemProcessList = ["audioplayer","cheetah","fileexplorer","taskmanager","terminal","videoplayer","photoviewer","texteditor"];
        return this._systemProcessList;
    }

    private fetchUserApp(): string[]{
        this._userProcessList = ["hello","greeting", "jsdos","ruffle","codeeditor","markdownviewer"];
        return this._userProcessList;
    }

    private createAppsList(): void{
        this._processList =[...this._systemProcessList, ...this._userProcessList];
    }

    public getAppPosition(appName:string):number{
        const appPosition = this._processList.indexOf(appName)
        return appPosition
    }

    public getAppList():string[]{
        return this._processList;
    }
} 