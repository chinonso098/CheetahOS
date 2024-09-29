import {Component,ViewChild, ViewContainerRef, ViewRef, OnDestroy, Type, AfterViewInit} from '@angular/core';
import { Subscription } from 'rxjs';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { TriggerProcessService } from './shared/system-service/trigger.process.service';
import { SessionManagmentService } from './shared/system-service/session.management.service';
import { NotificationService } from './shared/system-service/notification.service';
import { StateManagmentService } from './shared/system-service/state.management.service';

import { ComponentType } from './system-files/component.types';
import { NotificationType } from './system-files/notification.type';
import { Process } from './system-files/process';
import { AppDirectory } from './system-files/app.directory';
import { Constants } from 'src/app/system-files/constants';

import { BaseComponent } from './system-base/base/base.component';
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
import { MenuService } from './shared/system-service/menu.services';
import { FileInfo } from './system-files/file.info';

@Component({
  selector: 'cos-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

/**
 *  This is the main app component
 */
export class AppComponent implements OnDestroy, AfterViewInit {
 
  @ViewChild('processContainerRef',  { read: ViewContainerRef })
  private itemViewContainer!: ViewContainerRef

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _componentReferenceService:ComponentReferenceService;
  private _triggerProcessService:TriggerProcessService;
  private _sessionMangamentServices:SessionManagmentService;
  private _notificationServices:NotificationService;
  private _stateManagmentService:StateManagmentService;
  private _menuService:MenuService;
  private _componentRefView!:ViewRef;
  private _appDirectory:AppDirectory;
  private _consts:Constants = new Constants();

  private _closeProcessSub!:Subscription;
  private _closeMsgDialogSub!:Subscription;
  private _startProcessSub!:Subscription;
  private _appNotFoundSub!:Subscription;
  private _appIsRunningSub!:Subscription;  
  private _errorNotifySub!:Subscription;
  private _infoNotifySub!:Subscription;  
  private _warnNotifySub!:Subscription;  
  private _showPropertiesViewSub!:Subscription;
  private _closePropertiesViewSub!:Subscription;

  private userOpenedAppsList:string[] = [];
  private retreivedKeys:string[] = [];
  private userOpenedAppsKey = "openedApps";
  private reOpendAppsCounter = 0;
  private SECONDS_DELAY:number[] =[1500, 1500];

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'system';
  processId = 0;
  type = ComponentType.System;
  displayName = '';

  //:TODO when you have more apps with a UI worth looking at, add a way to select the right component for the give
  //appname
  private apps: {type: Type<BaseComponent>}[] =[
    {type: AudioPlayerComponent},
    {type: FileExplorerComponent},
    {type: TaskmanagerComponent},
    {type: TerminalComponent},
    // {type: TaskmanagerMiniComponent},
    {type: VideoPlayerComponent},
    {type: PhotoViewerComponent},
    {type: TextEditorComponent},
    {type: TitleComponent},
    {type: GreetingComponent},
    {type: JSdosComponent},
    {type: RuffleComponent},
    {type: CodeEditorComponent},
    {type: MarkDownViewerComponent},
  ];


  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService,componentReferenceService:ComponentReferenceService, triggerProcessService:TriggerProcessService,
    sessionMangamentServices:SessionManagmentService, notificationServices:NotificationService, stateManagmentService:StateManagmentService, menuService:MenuService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._componentReferenceService = componentReferenceService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;
    this._sessionMangamentServices = sessionMangamentServices;
    this._notificationServices = notificationServices;
    this._stateManagmentService = stateManagmentService;
    this._menuService = menuService;

    this._startProcessSub = this._triggerProcessService.startProcessNotify.subscribe((appName) =>{this.loadApps(appName)})
    this._appNotFoundSub = this._triggerProcessService.appNotFoundNotify.subscribe((appName) =>{this.showDialogMsgBox(NotificationType.Error,appName)})
    this._appIsRunningSub = this._triggerProcessService.appIsRunningNotify.subscribe((appName) =>{this.showDialogMsgBox(NotificationType.Info,appName)})
    this._errorNotifySub = this._notificationServices.errorNotify.subscribe((appName) =>{this.showDialogMsgBox(NotificationType.Error,appName)})
    this._infoNotifySub = this._notificationServices.InfoNotify.subscribe((appName) =>{this.showDialogMsgBox(NotificationType.Info,appName)})
    this._warnNotifySub = this._notificationServices.warningNotify.subscribe((appName) =>{this.showDialogMsgBox(NotificationType.Warning,appName)})
    this._closeProcessSub = this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.onCloseBtnClicked(p)})
    this._closeMsgDialogSub = this._notificationServices.closeDialogBoxNotify.subscribe((i) =>{this.closeDialogMsgBoxOrPropertiesView(i)})
    this._showPropertiesViewSub = this._menuService.showPropertiesView.subscribe((p) => this.showPropertiesWindow(p));
    this._closePropertiesViewSub = this._menuService.closePropertiesView.subscribe((p) => this.closeDialogMsgBoxOrPropertiesView(p));
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._appDirectory = new AppDirectory();
  }

  ngOnDestroy():void{
    this._closeProcessSub?.unsubscribe();
    this._closeMsgDialogSub?.unsubscribe();
    this._startProcessSub?.unsubscribe();
    this._appNotFoundSub?.unsubscribe();
    this._appIsRunningSub?.unsubscribe();
    this._errorNotifySub?.unsubscribe();
    this._infoNotifySub?.unsubscribe();
    this._warnNotifySub?.unsubscribe();
    this._showPropertiesViewSub?.unsubscribe();
    this._closePropertiesViewSub?.unsubscribe();
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

  async loadApps(appName:string):Promise<void>{
    this.lazyLoadComponment(this._appDirectory.getAppPosition(appName));
  }

  private async lazyLoadComponment(appPosition:number) {
    const componentToLoad = this.apps[appPosition];
    const componentRef = this.itemViewContainer.createComponent<BaseComponent>(componentToLoad.type);
    const pid = componentRef.instance.processId
    this.addEntryFromUserOpenedApps(componentRef.instance.name);
    this._componentReferenceService.addComponentReference(pid, componentRef);

   //alert subscribers
   this._runningProcessService.processListChangeNotify.next()
  }

  private showDialogMsgBox(dialogMsgType:string, msg:string):void{
    const componentRef = this.itemViewContainer.createComponent(DialogComponent);
    const notificationId = componentRef.instance.notificationId;
    this._componentReferenceService.addComponentReference(notificationId, componentRef);

    if(dialogMsgType === NotificationType.Error){
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }else if(dialogMsgType === NotificationType.Info){
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }else{
      componentRef.setInput('inputMsg', msg);
      componentRef.setInput('notificationType', dialogMsgType);
    }
  }

  private showPropertiesWindow(fileInput:FileInfo):void{
    const componentRef = this.itemViewContainer.createComponent(PropertiesComponent);
    const propertyId = componentRef.instance.propertyId;
    this._componentReferenceService.addComponentReference(propertyId, componentRef);
    componentRef.setInput('fileInput',fileInput);
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
    this._runningProcessService.removeProcessImage(eventData.getProcessName, eventData.getProcessId);

    this._componentReferenceService.removeComponentReference(eventData.getProcessId);
    this._processIdService.removeProcessId(eventData.getProcessId);
    this.deleteEntryFromUserOpenedAppsAndSession(eventData);

    this._runningProcessService.processListChangeNotify.next()
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private deleteEntryFromUserOpenedAppsAndSession(proccess:Process):void{
      const deleteCount = 1
      const pidIndex = this.userOpenedAppsList.indexOf(proccess.getProcessName)

      if (pidIndex !== -1) 
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
   
    if(priorOpendApps.length > 0){
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
      let tmpCounter = 0;
      let i = this.reOpendAppsCounter;

      for(i; i < pSessionData.length; i++){
        if (tmpCounter < 1){
          const appName = priorSessionData[i].split('-')[0];
          this._sessionMangamentServices.addSession(pickUpKey, priorSessionData[i]);
          this.loadApps(appName);

          tmpCounter++;
        }
      }

      if(this.reOpendAppsCounter == pSessionData.length - 1)
        clearInterval(interval);

      this.reOpendAppsCounter++;
    },this.SECONDS_DELAY[1], priorSessionData);

  }

  private addEntryFromUserOpenedApps(proccessName:string):void{
    this.userOpenedAppsList.push(proccessName);
    this._sessionMangamentServices.addSession(this.userOpenedAppsKey, this.userOpenedAppsList)
  }

}
