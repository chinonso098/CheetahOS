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
import { SessionManagmentService } from "./session.management.service";

import { ComponentReferenceService } from "./component.reference.service";
import { PropertiesComponent } from "../system-component/properties/properties.component";
import { AudioPlayerComponent } from "src/app/system-apps/audioplayer/audioplayer.component";
import { ChatterComponent } from "src/app/system-apps/chatter/chatter.component";
import { CheetahComponent } from "src/app/system-apps/cheetah/cheetah.component";
import { ClippyComponent } from "src/app/system-apps/clippy/clippy.component";
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


@Injectable({
    providedIn: 'root'
})

export class ProcessHandlerService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _windowService:WindowService;
    private _componentReferenceService:ComponentReferenceService;
    private _sessionMangamentServices:SessionManagmentService;
    private _menuService:MenuService;
    private _userNotificationService:UserNotificationService;

    private _appDirectory:AppDirectory;
    private _TriggerList:FileInfo[];

    private _onlyOneInstanceAllowed:string[] = ["audioplayer", "chatter", "cheetah", "jsdos", "photoviewer", 
        "ruffle", "runsystem", "taskmanager", "videoplayer", "starfield", "boids", "particleflow"];

    private userOpenedAppsList:string[] = [];
    private openedAppInstanceUID:string[] = [];
    private userOpenedAppsKey = Constants.USER_OPENED_APPS;
    private appsInstanceUIDKey = Constants.USER_OPENED_APPS_INSTANCE;

    name = 'trgr_proc_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'inits components';

    readonly TASK_MANAGER = "taskmanager";
    readonly CHATTER ="chatter";
    readonly RUN_SYSTEM = "runsystem";
    readonly CHEETAH = "cheetah";
    readonly BOIDS = "boids";
    readonly STAR_FIELD = "starfield";
    readonly PARTICLE_FLOW = "particleflow";
       
    //:TODO when you have more apps with a UI worth looking at, add a way to select the right component for the give
    //appname
    private apps: {type: Type<BaseComponent>}[] =[
        {type: AudioPlayerComponent},
        {type: ChatterComponent},
        {type: CheetahComponent},
        {type: ClippyComponent},
        {type: FileExplorerComponent},
        {type: TaskmanagerComponent},
        {type: TerminalComponent},
        {type: VideoPlayerComponent},
        {type: PhotoViewerComponent},
        {type: RunSystemComponent},
        {type: TextEditorComponent},
        {type: TitleComponent},
        {type: GreetingComponent},
        {type: JSdosComponent},
        {type: RuffleComponent},
        {type: CodeEditorComponent},
        {type: MarkDownViewerComponent},
        {type: WarpingstarfieldComponent},
        {type: BoidsComponent},
        {type: ParticaleFlowComponent},
    ];

    constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService, windowService:WindowService, 
        componentReferenceService:ComponentReferenceService, menuService:MenuService, sessionMangamentServices:SessionManagmentService,
        userNotificationService:UserNotificationService){

        this._appDirectory = new AppDirectory();
        this._TriggerList = [];
     
        this._runningProcessService = runningProcessService;
        this._processIdService = processIdService;
        this._windowService = windowService;
        this._componentReferenceService = componentReferenceService;
        this._sessionMangamentServices = sessionMangamentServices;
        this._menuService = menuService;
        this._userNotificationService = userNotificationService;


        this.processId = this._processIdService.getNewProcessId();
        this._runningProcessService.addProcess(this.getProcessDetail());
        this._runningProcessService.addService(this.getServiceDetail());

        this._menuService.showPropertiesView.subscribe((p) => this.showPropertiesWindow(p));
        this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.closeApplicationProcess(p)})
    }

    startApplicationProcess(file:FileInfo):void{
        let msg = Constants.EMPTY_STRING;
        if(this._appDirectory.appExist(file.getOpensWith)){

            if(!this._runningProcessService.isProcessRunning(file.getOpensWith) || 
                (this._runningProcessService.isProcessRunning(file.getOpensWith) && !this._onlyOneInstanceAllowed.includes(file.getOpensWith))){
                this.loadApps(file.getOpensWith);
                this._TriggerList.push(file);
                return;
            }else{
                if(this._onlyOneInstanceAllowed.includes(file.getOpensWith)){
                   const runningProcess = this._runningProcessService.getProcessByName(file.getOpensWith);
                    // msg = `Only one instance of ${file.getOpensWith} is allowed to run.`;
                    //this._userNotificationService.showInfoNotification(msg);

                    if(runningProcess){
                        if( runningProcess.getProcessName === this.BOIDS ||
                            runningProcess.getProcessName === this.CHATTER || 
                            runningProcess.getProcessName === this.CHEETAH ||
                            runningProcess.getProcessName === this.STAR_FIELD || 
                            runningProcess.getProcessName === this.RUN_SYSTEM || 
                            runningProcess.getProcessName === this.TASK_MANAGER || 
                            runningProcess.getProcessName === this.PARTICLE_FLOW ){
                            this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);
                        }else{
                            const uid = `${runningProcess.getProcessName}-${runningProcess.getProcessId}`;
  
                            this._TriggerList.push(file);
                            this._windowService.focusOnCurrentProcessWindowNotify.next(runningProcess.getProcessId);
                            
                            this._runningProcessService.addEventOriginator(uid);
                            this._runningProcessService.changeProcessContentNotify.next();
                        }
                    }
                    return;
                }             
            }
        }

        msg = `Osdrive:/App Directory/${file.getOpensWith}`;
        this._userNotificationService.showErrorNotification(msg);
        return;
    }

    /**
     * Getting the last process from the Trigger, will remove it the TriggerList.
     */
    getLastProcessTrigger():FileInfo{
        if(this._TriggerList.length > 0){
           return this._TriggerList.pop() || new FileInfo;
        }

        return new FileInfo;
    }

    async loadApps(appName:string, priorUID?:string):Promise<void>{
        this.lazyLoadComponment(this._appDirectory.getAppPosition(appName), priorUID);
    }

    private async lazyLoadComponment(appPosition:number, priorUID?:string) {
        const componentToLoad = this.apps[appPosition];
        if(componentToLoad !== undefined){   
            const cmpntRef =  this._componentReferenceService.createComponent(componentToLoad.type);

            if(priorUID && (priorUID !== Constants.EMPTY_STRING)){
                console.log('CLIPPY IS GETTING ON MY NERVES:', priorUID);
                cmpntRef.setInput('priorUId',priorUID);
            }


            this.addEntryFromUserOpenedAppssAndSession(cmpntRef);
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

    closeApplicationProcess(eventData:Process, clearSessionData?:boolean):void{
        // remove component ref
        this._componentReferenceService.removeComponent(eventData.getProcessId)

        this._processIdService.removeProcessId(eventData.getProcessId);

        this._windowService.removeProcessPreviewImage(eventData.getProcessName, eventData.getProcessId);
 
        if((clearSessionData === undefined) || clearSessionData)
            this.deleteEntryFromUserOpenedAppsAndSession(eventData);

        this._runningProcessService.removeProcess(eventData);
        this._runningProcessService.processListChangeNotify.next();
    }

    closeActiveProcessWithWindows(clearSessionData:boolean):void{
        const proccesses = this._runningProcessService.getProcesses().filter(x => x.getHasWindow === true);
        for(const proccess of proccesses){
            this.closeApplicationProcess(proccess, clearSessionData);
        }
    }

    private deleteEntryFromUserOpenedAppsAndSession(proccess:Process):void{
      const deleteCount = 1;
      const uid = `${proccess.getProcessName}-${proccess.getProcessId}`;

      let pidIndex = this.userOpenedAppsList.indexOf(proccess.getProcessName);
      if(pidIndex !== -1) 
        this.userOpenedAppsList.splice(pidIndex, deleteCount);

      this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList);

      pidIndex = this.openedAppInstanceUID.indexOf(uid);
      if(pidIndex !== -1) 
        this.openedAppInstanceUID.splice(pidIndex, deleteCount);

        this._sessionMangamentServices.addSession(this.appsInstanceUIDKey, this.openedAppInstanceUID);

      this._sessionMangamentServices.removeSession(uid); 
      this._sessionMangamentServices.removeAppSession(uid); 
    }

    private fetchPriorSessionInfo():string[]{
        const openedAppList = this._sessionMangamentServices.getSession(this.userOpenedAppsKey) as string[];
        //console.log('openedAppList:', openedAppList);
        if(openedAppList)
            return openedAppList;

        return [];
    }

    private restorePriorSession(priorOpenedApps: string[]):void{
        const delay = 750; //400ms
        if(priorOpenedApps.length > 0){
            const openedAppInstList = this._sessionMangamentServices.getSession(this.appsInstanceUIDKey) as string[];
            //console.log('openedAppInstList:', openedAppInstList);

            const tasks: [string, string][] = [];
            for(const pName of priorOpenedApps){
                const tmpKeys = openedAppInstList.filter(x => x.includes(pName));
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

    private addEntryFromUserOpenedAppssAndSession(cmpntRef:ComponentRef<BaseComponent>):void{
        const pName = cmpntRef.instance.name;
        const pID = cmpntRef.instance.processId;
        const uID = `${pName}-${pID}`;

        if(!this.userOpenedAppsList.includes(pName))
            this.userOpenedAppsList.push(pName);

        this.openedAppInstanceUID.push(uID);

        this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList);
        this._sessionMangamentServices.addSession(this.appsInstanceUIDKey, this.openedAppInstanceUID);
    }

    checkAndRestore():void{
        const priorSessionInfo = this.fetchPriorSessionInfo();
        this.restorePriorSession(priorSessionInfo);
    }

    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}