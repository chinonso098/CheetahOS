import { ComponentRef, Injectable, Type} from "@angular/core";

import { AppDirectory } from "src/app/system-files/app.directory";
import { FileInfo } from "src/app/system-files/file.info";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";

import { MenuService } from "./menu.services";
import { WindowService } from "./window.service";
import { BaseService } from "./base.service.interface";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { UserNotificationService } from "./user.notification.service";
import { SessionManagementService } from "./session.management.service";

import { ComponentReferenceService } from "./component.reference.service";
import { PropertiesComponent } from "../system-component/properties/properties.component";
import { AudioPlayerComponent } from "src/app/system-apps/audioplayer/audioplayer.component";
import { ChatterComponent } from "src/app/system-apps/chatter/chatter.component";
import { CheetahComponent } from "src/app/system-apps/cheetah/cheetah.component";
import { ClippyComponent } from "src/app/system-apps/clippy/clippy.component";
import { ClipboardComponent } from "src/app/system-apps/clipboard/clipboard.component";
import { FileExplorerComponent } from "src/app/system-apps/fileexplorer/fileexplorer.component";
import { PhotoViewerComponent } from "src/app/system-apps/photoviewer/photoviewer.component";
import { RunSystemComponent } from "src/app/system-apps/runsystem/runsystem.component";
import { TaskmanagerComponent } from "src/app/system-apps/taskmanager/taskmanager.component";
import { TerminalComponent } from "src/app/system-apps/terminal/terminal.component";
import { TextEditorComponent } from "src/app/system-apps/texteditor/texteditor.component";
import { VideoPlayerComponent } from "src/app/system-apps/videoplayer/videoplayer.component";
import { BaseComponent } from "src/app/system-base/base/base.component.interface";
import { BoidsComponent } from "src/app/user-apps/boids/boids.component";
import { CodeEditorComponent } from "src/app/user-apps/codeeditor/codeeditor.component";
import { GreetingComponent } from "src/app/user-apps/greeting/greeting.component";
import { JSdosComponent } from "src/app/user-apps/jsdos/jsdos.component";
import { MarkDownViewerComponent } from "src/app/user-apps/markdownviewer/markdownviewer.component";
import { RuffleComponent } from "src/app/user-apps/ruffle/ruffle.component";
import { TitleComponent } from "src/app/user-apps/title/title.component";
import { WarpingstarfieldComponent } from "src/app/user-apps/warpingstarfield/warpingstarfield.component";
import { ParticaleFlowComponent } from "src/app/user-apps/particaleflow/particaleflow.component";
import { PdfViewerComponent } from "src/app/user-apps/pdf-viewer/pdf-viewer.component";
import { SettingsComponent } from "src/app/system-apps/controlpanel/settings.component";
import { DefaultService } from "./defaults.services";
import { SystemNotificationService } from "./system.notification.service";
import { SystemMetric } from "./system.metrics";


@Injectable({
    providedIn: 'root'
})

export class ProcessHandlerService implements BaseService{

    private _runningProcessService!:RunningProcessService;
    private _processIdService!:ProcessIDService;
    private _windowService!:WindowService;
    private _componentReferenceService!:ComponentReferenceService;
    private _sessionMangamentServices!:SessionManagementService;
    private _menuService!:MenuService;
    private _defaultService!: DefaultService;
    private _userNotificationService!:UserNotificationService;
    private _systemNotificationService!:SystemNotificationService;
    private _systemMetric!:SystemMetric;

    private _appDirectory:AppDirectory;
    private _triggerMap:Map<string, FileInfo[]>;

    private _onlyOneInstanceAllowed:string[] = ["audioplayer", "chatter", "cheetah", "clipboard", "jsdos", "photoviewer", 
        "ruffle", "runsystem", "taskmanager", "videoplayer", "starfield", "boids", "particleflow", "settings"];

    private userOpenedAppsList:string[] = [];
    private openedAppInstanceUId:string[] = [];
    private priorUserOpenedAppsList:string[] = [];
    private priorOpenedAppInstanceUId:string[] = [];
    private userOpenedAppsKey = Constants.USER_OPENED_APPS;
    private appsInstanceUIDKey = Constants.USER_OPENED_APPS_INSTANCE;

    name = 'trgr_proc_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'inits components';

    private readonly TASK_MANAGER = "taskmanager";
    private readonly CHATTER ="chatter";
    private readonly RUN_SYSTEM = "runsystem";
    private readonly CHEETAH = "cheetah";
    private readonly BOIDS = "boids";
    private readonly STAR_FIELD = "starfield";
    private readonly PARTICLE_FLOW = "particleflow";

    /**
     * Single-instance apps that simply re-focus their existing window when the user
     * tries to launch them again. Unlike file-backed apps (audioplayer, photoviewer,
     * etc.), these have no file content to (re)load, so re-launching only brings the
     * already-running window to the front.
     *
     * NOTE: every entry here must also be present in `_onlyOneInstanceAllowed`; this
     * list is the "focus instead of reload" subset of the single-instance apps.
     */
    private readonly _focusOnlyApps:string[] = [
        this.BOIDS, this.CHATTER, this.CHEETAH, this.STAR_FIELD,
        this.RUN_SYSTEM, this.TASK_MANAGER, this.PARTICLE_FLOW
    ];

    /**
     * Maps an application name to the component that should be instantiated for it.
     *
     * Keyed by name (instead of relying on array position) so the lookup no longer
     * depends on this list staying perfectly in sync with `AppDirectory`'s ordering.
     * Adding a new app is now a single, self-describing entry here.
     */
    private readonly _appComponentMap = new Map<string, Type<BaseComponent>>([
        ["audioplayer", AudioPlayerComponent],
        ["chatter", ChatterComponent],
        ["cheetah", CheetahComponent],
        ["clippy", ClippyComponent],
        ["clipboard", ClipboardComponent],
        ["fileexplorer", FileExplorerComponent],
        ["taskmanager", TaskmanagerComponent],
        ["terminal", TerminalComponent],
        ["videoplayer", VideoPlayerComponent],
        ["photoviewer", PhotoViewerComponent],
        ["runsystem", RunSystemComponent],
        ["texteditor", TextEditorComponent],
        ["settings", SettingsComponent],
        ["hello", TitleComponent],
        ["greeting", GreetingComponent],
        ["jsdos", JSdosComponent],
        ["ruffle", RuffleComponent],
        ["codeeditor", CodeEditorComponent],
        ["markdownviewer", MarkDownViewerComponent],
        ["starfield", WarpingstarfieldComponent],
        ["boids", BoidsComponent],
        ["particleflow", ParticaleFlowComponent],
        ["pdfviewer", PdfViewerComponent]
    ]);

    constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, windowService:WindowService, 
        componentReferenceService:ComponentReferenceService, menuService:MenuService, sessionMangamentServices:SessionManagementService,
        userNotificationService:UserNotificationService, systemNotificationService:SystemNotificationService, defaultService: DefaultService,
        systemMetric:SystemMetric){

        this._appDirectory = new AppDirectory();
        this._triggerMap = new Map<string, FileInfo[]>();
     
        this._runningProcessService = runningProcessService;
        this._processIdService = processIdService;
        this._windowService = windowService;
        this._componentReferenceService = componentReferenceService;
        this._sessionMangamentServices = sessionMangamentServices;
        this._menuService = menuService;
        this._userNotificationService = userNotificationService;
        this._systemNotificationService = systemNotificationService;
        this._defaultService = defaultService;
        this._systemMetric = systemMetric;

        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this._menuService.showPropertiesView.subscribe((p) => this.showPropertiesWindow(p));
        this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.closeApplicationProcess(p)})
    }

    public runApplication(file:FileInfo):void{
        const appName = file.getOpensWith;

        // Unknown app — surface an error and bail out early.
        if(!this._appDirectory.appExist(appName)){
            const msg = `C:/App Directory/${appName}`;
            const title = msg;
            this._userNotificationService.showErrorNotification(msg, title);
            return;
        }

        const isRunning = this._runningProcessService.isProcessRunning(appName);
        const isSingleInstance = this._onlyOneInstanceAllowed.includes(appName);

        // Launch a brand-new instance when the app isn't running yet, or when it is
        // running but multiple instances are permitted.
        if(!isRunning || !isSingleInstance){
            this.addTrigger(appName, file);
            this.loadApps(appName);
            return;
        }

        // From here on: the app is a single-instance app that is already running, so we
        // reuse the existing instance instead of creating a new one.
        const runningProcess = this._runningProcessService.getProcessByName(appName);
        if(!runningProcess){
            return;
        }

        // Focus-only apps have no file content to refresh — just bring the window forward.
        if(this._focusOnlyApps.includes(runningProcess.getProcessName)){
            this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);
            return;
        }

        // File-backed single-instance apps (audioplayer, photoviewer, ...): hand the new
        // file to the running instance, focus it, and ask it to refresh its content.
        this.addTrigger(appName, file);
        this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);

        const uId = `${runningProcess.getProcessName}-${runningProcess.getProcessId}`;
        this._runningProcessService.addEventOriginator(uId);
        this._runningProcessService.changeProcessContentNotify.next();
    }

    /**
     * Toggle the clipboard flyout (summoned with Windows + V). Closes it when it
     * is already open, otherwise launches a fresh single-instance window. The
     * clipboard is launched directly (not via `runApplication`) because it has no
     * backing file — it reads its contents from the clipboard data bank.
     */
    public toggleClipboard():void{
        const isRunning = this._runningProcessService.isProcessRunning(Constants.CLIPBOARD);
        if(isRunning){
            const process = this._runningProcessService.getProcessByName(Constants.CLIPBOARD);
            if(process){
                this._runningProcessService.closeProcessNotify.next(process);
            }
            return;
        }

        this.loadApps(Constants.CLIPBOARD);
    }

    /**
     * Add a file trigger keyed by app name, so only the intended app can retrieve it.
     */
    private addTrigger(appName:string, file:FileInfo):void{
        if(!this._triggerMap.has(appName)){
            this._triggerMap.set(appName, []);
        }
        this._triggerMap.get(appName)!.push(file);
    }

    /**
     * Getting the next process trigger for the given app name.
     * Only returns a FileInfo that was placed for that specific app,
     * preventing a fast-loading app from picking up another app's file.
     */
    public getLastProcessTrigger(appName:string):FileInfo{
        const queue = this._triggerMap.get(appName);
        if(queue && queue.length > 0){
            const file = queue.shift()!;
            if(queue.length === 0){
                this._triggerMap.delete(appName);
            }
            return file;
        }

        return new FileInfo();
    }

    private async loadApps(appName:string, priorUId?:string):Promise<void>{
        this.lazyLoadComponent(appName, priorUId);
    }

    /**
     * Create and register the component associated with `appName`.
     * Looks the component type up by name, so it no longer depends on any array ordering.
     */
    private async lazyLoadComponent(appName:string, priorUId?:string) {
        const componentToLoad = this._appComponentMap.get(appName);
        if(componentToLoad !== undefined){
            const cmpntRef =  this._componentReferenceService.createComponent(componentToLoad);

            this._systemMetric.recordAppLaunch(appName);

            // When restoring a prior session, pass the previous instance id so the
            // component can re-hydrate its saved state.
            if(priorUId && (priorUId !== Constants.EMPTY_STRING)){
                cmpntRef.setInput('priorUId', priorUId);
            }

            this.addEntryToUserOpenedAppsAndSession(cmpntRef);
            //alert subscribers
            if(this._runningProcessService !== undefined){
                this._runningProcessService.processListChangeNotify.next();
            }
        }
    }
    
    private showPropertiesWindow(fileInput:FileInfo):void{
        const fileName =`${Constants.WIN_EXPLR +  fileInput.getFileName}`;
        const process = this._runningProcessService.getProcessByName(fileName);
        if(!process){
            const cmpntRef =  this._componentReferenceService.createComponent(PropertiesComponent);
            cmpntRef.setInput('fileInput',fileInput);
        }else{
            this._windowService.focusOnCurrentProcessWindowNotify.next(process.getProcessId);
        }
    }

    public closeApplicationProcess(process:Process):void{
        this._systemMetric.recordAppClose(process.getProcessName);

        // remove component ref
        this._componentReferenceService.removeComponent(process.getProcessId);

        this._processIdService.removeProcessId(process.getProcessId);

        this._windowService.removeProcessPreviewImage(process.getProcessName, process.getProcessId);

        if(!this.shouldRestoreUserOpenedApps())
            this.clearSessionData(process);

        this._runningProcessService.removeProcess(process);
        this._runningProcessService.processListChangeNotify.next();
    }

    public clearSessionData(process:Process){
        this.deleteEntryFromUserOpenedAppsAndSession(process);
    }

    private deleteEntryFromUserOpenedAppsAndSession(process:Process):void{
        const uId = `${process.getProcessName}-${process.getProcessId}`;

        if(this._runningProcessService.getProcessCount(process.getProcessName) === 1){
            this.userOpenedAppsList = this.userOpenedAppsList.filter(x => x !== process.getProcessName);
            this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList);
        }

        this.openedAppInstanceUId = this.openedAppInstanceUId.filter(x => x !== uId);
        this._sessionMangamentServices.addSession(this.appsInstanceUIDKey, this.openedAppInstanceUId);

        //this._sessionMangamentServices.removeSession(uId); 
        this._sessionMangamentServices.removeAppSession(uId); 
    }


    public fetchPriorSessionInfo():void{
        // retrieve list
        const openedAppList = this._sessionMangamentServices.getSession(this.userOpenedAppsKey) as string[];
        if(openedAppList)
            this.priorUserOpenedAppsList.push(...openedAppList);

        const openedAppInstList = this._sessionMangamentServices.getSession(this.appsInstanceUIDKey) as string[];
        if(openedAppInstList)
            this.priorOpenedAppInstanceUId.push(...openedAppInstList);

        // purge prior sesseion
        this._sessionMangamentServices.addSession(this.userOpenedAppsKey, []);
        this._sessionMangamentServices.addSession(this.appsInstanceUIDKey, []);
    }


    private addEntryToUserOpenedAppsAndSession(cmpntRef:ComponentRef<BaseComponent>):void{
        const pName = cmpntRef.instance.name;
        const pId = cmpntRef.instance.processId;
        const uId = `${pName}-${pId}`;

        if(!this.userOpenedAppsList.includes(pName))
            this.userOpenedAppsList.push(pName);

        this.openedAppInstanceUId.push(uId);

        this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList);
        this._sessionMangamentServices.addSession(this.appsInstanceUIDKey, this.openedAppInstanceUId);
    }

    public checkAndRestore():void{
        const delay = 1000; //1sec
        if(this.priorUserOpenedAppsList.length > 0){

            const tasks: [string, string][] = [];
            for(const pName of this.priorUserOpenedAppsList){
                const tmpKeys = this.priorOpenedAppInstanceUId.filter(x => x.includes(pName));
                for(const pUId of tmpKeys){
                    tasks.push([pName, pUId]);
                }
            }

            const loadApp = (index: number)=>{
                if(index >= tasks.length) 
                    return;

                const [pName, pUId] = tasks[index];
                this.loadApps(pName, pUId);

                setTimeout(() => loadApp(index + 1), delay);
            };

            loadApp(0);
        }
    }

    public reset():void{
        this.userOpenedAppsList = [];
        this.openedAppInstanceUId = [];
        this.priorUserOpenedAppsList = [];
        this.priorOpenedAppInstanceUId= [];
    }

    private shouldRestoreUserOpenedApps(): boolean{
        const restorePriorOpenedAppsState = this._defaultService.getDefaultSetting(Constants.DEFAULT_RESTORE_USER_OPENED_APPS);
        const restorePriorOpenedApps = (restorePriorOpenedAppsState === Constants.TRUE) ? true : false;

        const powerAction = this._systemNotificationService.getSystemPendingAction();
        const isShutDownOrRestart = powerAction === Constants.SYSTEM_RESTART || powerAction === Constants.SYSTEM_SHUT_DOWN;

        return restorePriorOpenedApps && isShutDownOrRestart;
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status);
    }
}