import {Component,ViewChild, ViewContainerRef, ViewRef, OnDestroy, Type, OnInit, AfterViewInit} from '@angular/core';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { TriggerProcessService } from './shared/system-service/trigger.process.service';
import { SessionManagmentService } from './shared/system-service/session.management.service';
import { UserNotificationService } from './shared/system-service/user.notification.service';
import { StateManagmentService } from './shared/system-service/state.management.service';
import { WindowService } from './shared/system-service/window.service';
import { MenuService } from './shared/system-service/menu.services';
import { ScriptService } from './shared/system-service/script.services';

import { ComponentType } from './system-files/system.types';
import { UserNotificationType } from './system-files/notification.type';
import { Process } from './system-files/process';
import { AppDirectory } from './system-files/app.directory';
import { Constants } from 'src/app/system-files/constants';

import { BaseComponent } from './system-base/base/base.component.interface';
import { CheetahComponent } from './system-apps/cheetah/cheetah.component';
import { ClippyComponent } from './system-apps/clippy/clippy.component';
import { TitleComponent } from './user-apps/title/title.component';
import { GreetingComponent } from './user-apps/greeting/greeting.component';
import { FileExplorerComponent } from './system-apps/fileexplorer/fileexplorer.component';
import { TaskmanagerComponent } from './system-apps/taskmanager/taskmanager.component';
import { JSdosComponent } from './user-apps/jsdos/jsdos.component';
import { VideoPlayerComponent } from './system-apps/videoplayer/videoplayer.component';
import { AudioPlayerComponent } from './system-apps/audioplayer/audioplayer.component';
import { TerminalComponent } from './system-apps/terminal/terminal.component';
import { RuffleComponent } from './user-apps/ruffle/ruffle.component';
import { PhotoViewerComponent } from './system-apps/photoviewer/photoviewer.component';
import { DialogComponent } from './shared/system-component/dialog/dialog.component';
import { TextEditorComponent } from './system-apps/texteditor/texteditor.component';
import { CodeEditorComponent } from './user-apps/codeeditor/codeeditor.component';
import { MarkDownViewerComponent } from './user-apps/markdownviewer/markdownviewer.component';
import { PropertiesComponent } from './shared/system-component/properties/properties.component';
import { ChatterComponent } from './system-apps/chatter/chatter.component';
import { RunSystemComponent } from './system-apps/runsystem/runsystem.component';
import { WarpingstarfieldComponent } from './user-apps/warpingstarfield/warpingstarfield.component';
import { FileInfo } from './system-files/file.info';
import { BoidsComponent } from './user-apps/boids/boids.component';

@Component({
  selector: 'cos-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

/**
 *  This is the main app component
 */
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
 
  // @ViewChild('processContainerRef',  { read: ViewContainerRef })
  // private itemViewContainer!: ViewContainerRef
  
  @ViewChild('processContainerRef', { read: ViewContainerRef })itemViewContainer!: ViewContainerRef

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _componentReferenceService:ComponentReferenceService;
  private _triggerProcessService:TriggerProcessService;
  private _sessionMangamentServices:SessionManagmentService;
  private _notificationServices:UserNotificationService;
  private _stateManagmentService:StateManagmentService;
  private _menuService:MenuService;
  private _windowService:WindowService;
  private _componentRefView!:ViewRef;
  private _appDirectory:AppDirectory;


  private userOpenedAppsList:string[] = [];
  private retreivedKeys:string[] = [];
  private userOpenedAppsKey = "openedApps";
  private reOpendAppsCounter = Constants.ZERO;
  private SECONDS_DELAY:number[] =[1500, 1500];

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system';
  processId = Constants.ZERO;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

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


  // the order of the service init matter.
  //runningProcesssService must come first
  constructor(runningProcessService:RunningProcessService, processIdService:ProcessIDService,  windowService:WindowService,
    componentReferenceService:ComponentReferenceService, triggerProcessService:TriggerProcessService, sessionMangamentServices:SessionManagmentService,
    scriptService:ScriptService, notificationServices:UserNotificationService, stateManagmentService:StateManagmentService, menuService:MenuService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._componentReferenceService = componentReferenceService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;
    this._sessionMangamentServices = sessionMangamentServices;
    this._notificationServices = notificationServices;
    this._stateManagmentService = stateManagmentService;
    this._windowService = windowService;
    this._menuService = menuService;


    // these are all subs, but the app cmpnt will not be closed, unsubsribe is not needed
    this._triggerProcessService.startProcessNotify.subscribe((appName) =>{this.loadApps(appName)})
    this._triggerProcessService.appNotFoundNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.Error,appName)})
    this._triggerProcessService.appIsRunningNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.Info,appName)})

    this._notificationServices.errorNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.Error,appName)})
    this._notificationServices.InfoNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.Info,appName)})
    this._notificationServices.warningNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.Warning,appName)})
    this._notificationServices.powerOnOffNotify.subscribe((appName) =>{this.showDialogMsgBox(UserNotificationType.PowerOnOff,appName)})
    this._notificationServices.closeDialogBoxNotify.subscribe((i) =>{this.closeDialogMsgBoxOrPropertiesView(i)})

    this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.onCloseBtnClicked(p)})
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._menuService.showPropertiesView.subscribe((p) => this.showPropertiesWindow(p));
    this._menuService.closePropertiesView.subscribe((p) => this.closeDialogMsgBoxOrPropertiesView(p));

    this._appDirectory = new AppDirectory();
  }

  ngOnInit(): void {
    1
  }

  ngAfterViewInit():void{
    // This quiets the - Expression has changed after it was checked.
    //TODO: change detection is the better solution TBD
    setTimeout(()=> {
        const priorSessionInfo = this.fetchPriorSessionInfo();
        const sessionKeys = this.getSessionKey(priorSessionInfo);
        this.restorePriorSession(sessionKeys);
    }, this.SECONDS_DELAY[0]);

    //this.showPropertiesWindow();
  }

  ngOnDestroy():void{
    1
  }

  async loadApps(appName:string):Promise<void>{
    this.lazyLoadComponment(this._appDirectory.getAppPosition(appName));
  }

  private async lazyLoadComponment(appPosition:number) {
    const componentToLoad = this.apps[appPosition];
    if(componentToLoad !== undefined){   
      const componentRef = this.itemViewContainer.createComponent<BaseComponent>(componentToLoad.type);
      const pid = componentRef.instance.processId
      this.addEntryFromUserOpenedApps(componentRef.instance.name);
      this._componentReferenceService.addComponentReference(pid, componentRef);
  
     //alert subscribers
      if(this._runningProcessService !== undefined){
        this._runningProcessService.processListChangeNotify.next();
      }
    }
  }

  private showDialogMsgBox(dialogMsgType:string, msg:string):void{
    const componentRef = this.itemViewContainer.createComponent(DialogComponent);
    const notificationId = componentRef.instance.notificationId;
    this._componentReferenceService.addComponentReference(notificationId, componentRef);

    if(dialogMsgType === UserNotificationType.Error){
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }else if(dialogMsgType === UserNotificationType.Info){
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }else if(dialogMsgType === UserNotificationType.PowerOnOff){
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }else{
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }
  }

  private showPropertiesWindow(fileInput:FileInfo):void{

    // checkif property view is already visible
    console.log('propertyView:', fileInput);
    const fileName =`${Constants.WIN_EXPLR +  fileInput.getFileName}`;
    console.log('propertyView fileName:', fileName);

    const process = this._runningProcessService.getProcessByName(fileName);
    if(!process){
      const componentRef = this.itemViewContainer.createComponent(PropertiesComponent);
      const propertyId = componentRef.instance.processId;
      this._componentReferenceService.addComponentReference(propertyId, componentRef);
      componentRef.setInput('fileInput',fileInput);
    }
  }

  private closeDialogMsgBoxOrPropertiesView(dialogId:number):void{
    const componentToDelete = this._componentReferenceService.getComponentReference(dialogId);
    this._componentRefView = componentToDelete.hostView;
    const iVCntr  = this.itemViewContainer.indexOf(this._componentRefView);
    this.itemViewContainer.remove(iVCntr);
  }

  onCloseBtnClicked(eventData:Process):void{
    
    const componentToDelete = this._componentReferenceService.getComponentReference(eventData.getProcessId);
    this._componentRefView = componentToDelete.hostView;
    const iVCntr  = this.itemViewContainer.indexOf(this._componentRefView);
    this.itemViewContainer.remove(iVCntr);

    const uid = `${eventData.getProcessName}-${eventData.getProcessId}`;
    this._stateManagmentService.removeState(uid);

    this._runningProcessService.removeProcess(eventData);
    this._windowService.removeProcessPreviewImage(eventData.getProcessName, eventData.getProcessId);

    this._componentReferenceService.removeComponentReference(eventData.getProcessId);
    this._processIdService.removeProcessId(eventData.getProcessId);
    this.deleteEntryFromUserOpenedAppsAndSession(eventData);

    this._runningProcessService.processListChangeNotify.next();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
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
    },this.SECONDS_DELAY[1], priorSessionData);

  }

  private addEntryFromUserOpenedApps(proccessName:string):void{
    this.userOpenedAppsList.push(proccessName);
    this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList)
  }

}
