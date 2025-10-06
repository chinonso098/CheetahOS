import { Constants } from "./constants";

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
        this._systemProcessList = ["audioplayer","chatter","cheetah","clippy","fileexplorer",
            "taskmanager","terminal","videoplayer","photoviewer","runsystem","texteditor", "controlpanel"];
        return this._systemProcessList;
    }

    private fetchUserApp(): string[]{
        this._userProcessList = ["hello","greeting", "jsdos", "ruffle", "codeeditor", "markdownviewer", "starfield", "boids", "particleflow", "pdfviewer"];
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

    public getAppIcon(appName:string): string{
        const defaultIcon = 'generic_program.png';
        const map = this.appIconMap(appName);

        if(map){
            const [appName, appIcon] = map;
            return `${Constants.IMAGE_BASE_PATH}${appIcon}`;
        }

        return `${Constants.IMAGE_BASE_PATH}${defaultIcon}`;
    }

    private appIconMap(appName: string): [string, string] | undefined {
        const appIconMap: [string, string][] = [
            ['audioplayer', 'audioplayer.png'],
            ['chatter', 'chatter.png'],
            ['cheetah', 'cheetah.png'],
            ['controlpanel', 'settings.png'],
            ['fileexplorer', 'file_explorer.png'],
            ['taskmanager', 'taskmanager.png'],
            ['terminal', 'terminal.png'],
            ['videoplayer', 'videoplayer.png'],

            ['photoviewer', 'photoviewer.png'],
            ['runsystem', 'run.png'],
            ['texteditor', 'quill.png'],
            ['jsdos', 'js-dos_emulator.png'],
            ['ruffle', 'ruffle.png'],

            ['codeeditor', 'vs_code.png'],
            ['markdownviewer', 'markdown.png'],
            ['starfield', 'star_field.png'],
            ['boids', 'bird_oid.png'],
            ['particleflow', 'particles.png'],
            ['pdfviewer', 'pdf_js.png']
        ];

        return appIconMap.find(([name]) => name === appName);
    }

} 