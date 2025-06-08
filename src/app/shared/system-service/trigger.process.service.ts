import { Injectable, Type} from "@angular/core";
import { RunningProcessService } from "./running.process.service";
import { AppDirectory } from "src/app/system-files/app.directory";
import { FileInfo } from "src/app/system-files/file.info";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { WindowService } from "./window.service";
import { BaseService } from "./base.service.interface";
import { ComponentReferenceService } from "./component.reference.service";
import { PropertiesComponent } from "../system-component/properties/properties.component";
import { MenuService } from "./menu.services";
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
import { SessionManagmentService } from "./session.management.service";
import { UserNotificationService } from "./user.notification.service";

@Injectable({
    providedIn: 'root'
})

export class ControlProcessService implements BaseService{

    private _runningProcessService:RunningProcessService;
    private _processIdService:ProcessIDService;
    private _windowService:WindowService;
    private _componentReferenceService:ComponentReferenceService;
    private _sessionMangamentServices:SessionManagmentService;
    private _menuService:MenuService;
    private _userNotificationService:UserNotificationService;

    //   private _componentReferenceService:ComponentReferenceService;
    //   private _controlProcessService:ControlProcessService;
    //   private _sessionMangamentServices:SessionManagmentService;
    //   
    //   private _stateManagmentService:StateManagmentService;
    //   private _menuService:MenuService;
    //   private _windowService:WindowService;

    //   private _appDirectory:AppDirectory;
    private _appDirectory:AppDirectory;
    private _TriggerList:FileInfo[];

    private _onlyOneInstanceAllowed:string[] = ["audioplayer", "chatter", "cheetah", "jsdos", "photoviewer", 
        "ruffle", "runsystem", "taskmanager", "videoplayer"];

    private userOpenedAppsList:string[] = [];
    private retreivedKeys:string[] = [];
    private userOpenedAppsKey = "openedApps";
    private reOpendAppsCounter = Constants.ZERO;

    name = 'trgr_proc_svc';
    icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
    processId = 0;
    type = ProcessType.Cheetah;
    status  = Constants.SERVICES_STATE_RUNNING;
    hasWindow = false;
    description = 'inits components ';
        

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
        // {type: TaskmanagerMiniComponent},
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


    startApplication(file:FileInfo):void{
        let msg = '';
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
                        if(runningProcess.getProcessName ==="runsystem" || runningProcess.getProcessName ==="cheetah"){
                            this._windowService.focusOnCurrentProcess_WWC_Notify.next(runningProcess.getProcessId);
                        }else if(runningProcess.getProcessName ==="taskmanager" || runningProcess.getProcessName ==="chatter"){
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

    async loadApps(appName:string):Promise<void>{
        this.lazyLoadComponment(this._appDirectory.getAppPosition(appName));
    }

    private async lazyLoadComponment(appPosition:number) {
        const componentToLoad = this.apps[appPosition];
        if(componentToLoad !== undefined){   
            const cmpntRef =  this._componentReferenceService.createComponent(componentToLoad.type);
            this.addEntryFromUserOpenedApps(cmpntRef.instance.name);

            //alert subscribers
            if(this._runningProcessService !== undefined){
                this._runningProcessService.processListChangeNotify.next();
            }
        }
    }
    
    private showPropertiesWindow(fileInput:FileInfo):void{

        // checkif property view is already visible
        console.log('propertyView:', fileInput);
        const fileName =`${Constants.WIN_EXPLR +  fileInput.getFileName}`;
        console.log('propertyView fileName:', fileName);

        const process = this._runningProcessService.getProcessByName(fileName);
        if(!process){
            const cmpntRef =  this._componentReferenceService.createComponent(PropertiesComponent);
            cmpntRef.setInput('fileInput',fileInput);
        }else{
            this._windowService.focusOnCurrentProcessWindowNotify.next(process.getProcessId);
        }
    }

    // private closePropertiesView(dialogId:number):void{
    //     const componentToDelete = this._componentReferenceService.getComponentReference(dialogId);
    //     this._componentRefView = componentToDelete.hostView;
    //     const iVCntr  = this._viewContainerRef.indexOf(this._componentRefView);
    //     this._viewContainerRef.remove(iVCntr);
    // }

    closeApplicationProcess(eventData:Process):void{
        // remove component ref
        this._componentReferenceService.removeComponent(eventData.getProcessId)

        //remove state data
        const uid = `${eventData.getProcessName}-${eventData.getProcessId}`;
        //this._stateManagmentService.removeState(uid);


        this._processIdService.removeProcessId(eventData.getProcessId);

        this._windowService.removeProcessPreviewImage(eventData.getProcessName, eventData.getProcessId);
 
        this._runningProcessService.removeProcess(eventData);
        this._runningProcessService.processListChangeNotify.next();
    }

    private deleteEntryFromUserOpenedAppsAndSession(proccess:Process):void{
      const deleteCount = Constants.ONE
      const pidIndex = this.userOpenedAppsList.indexOf(proccess.getProcessName)

      if (pidIndex !== Constants.MINUS_ONE) 
        this.userOpenedAppsList.splice(pidIndex, deleteCount);

      this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList)
      const uid = `${proccess.getProcessName}-${proccess.getProcessId}`;
      this._sessionMangamentServices.removeSession(uid);
    }

    private fetchPriorSessionInfo():string[]{
        const openedAppList = this._sessionMangamentServices.getSession(this.userOpenedAppsKey) as string[];

        if(openedAppList != null || openedAppList != undefined)
        return openedAppList;

        return [];
    }

    private getSessionKey(priorOpendApps:string[]):string[]{
    
        if(priorOpendApps.length > Constants.ZERO){
        const sessionKeys = this._sessionMangamentServices.getKeys();

        for(let i= 0; i < priorOpendApps.length; i++){
            const tmpKey = sessionKeys.filter(x => x.includes(priorOpendApps[i]));
            
            for(let j = 0; j < tmpKey.length; j++)
            this.retreivedKeys.push(tmpKey[j]);
        }
        }

        return this.retreivedKeys;
    }

    private restorePriorSession(priorSessionData:string[]):void{
        const pickUpKey = this._sessionMangamentServices._pickUpKey;

        const interval =  setInterval((pSessionData) => {
        let tmpCounter = Constants.ZERO;
        let i = this.reOpendAppsCounter;

        for(i; i < pSessionData.length; i++){
            if (tmpCounter < Constants.ONE){
            const appName = priorSessionData[i].split('-')[0];
            this._sessionMangamentServices.addSession(pickUpKey, priorSessionData[i]);
            this.loadApps(appName);

            tmpCounter++;
            }
        }

        if(this.reOpendAppsCounter == pSessionData.length - Constants.ONE)
            clearInterval(interval);

        this.reOpendAppsCounter++;
        },1500, priorSessionData);

    }

    private addEntryFromUserOpenedApps(proccessName:string):void{
        this.userOpenedAppsList.push(proccessName);
        this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList)
    }


    private getProcessDetail():Process{
        return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
    }

    private getServiceDetail():Service{
        return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
    }
}