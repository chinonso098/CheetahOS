import {Component,ViewChild, ViewContainerRef, ViewRef, OnDestroy, Type, AfterViewInit} from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { ComponentType } from './system-files/component.types';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { Process } from './system-files/process';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { Subscription } from 'rxjs';
import { StartProcessService } from './shared/system-service/start.process.service';
import { BaseComponent } from './system-base/base/base.component';
import { TitleComponent } from './user-apps/title/title.component';
import { GreetingComponent } from './user-apps/greeting/greeting.component';
import { FileexplorerComponent } from './system-apps/fileexplorer/fileexplorer.component';
import { TaskmanagerComponent } from './system-apps/taskmanager/taskmanager.component';
import { SessionManagmentService } from './shared/system-service/session.management.service';

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
  private _startProcessService:StartProcessService;
  private _sessionMangamentServices:SessionManagmentService;
  private _componentRefView!:ViewRef;

  private _closeProcessSub!:Subscription;
  private _startProcessSub!:Subscription;
  private _appNotFoundSub!:Subscription;
  private _appIsRunningSub!:Subscription;  

  private userOpenedAppsList: string[] = [];
  private userOpenedAppsKey = "openedApps";

  hasWindow = false;
  icon = '';
  name = 'CheetahOS';
  processId = 0;
  //I know, I'm cheeting here
  type = ComponentType.systemComponent;

  //:TODO when you have more apps with a UI worth looking at, add a way to select the right component for the give
  //appname
  private apps: {type: Type<BaseComponent>}[] =[
    {type: FileexplorerComponent},
    {type: GreetingComponent},
    {type: TaskmanagerComponent},
    {type: TitleComponent},
  ];

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService,componentReferenceService:ComponentReferenceService, startProcessService:StartProcessService,
    sessionMangamentServices:SessionManagmentService){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()

    this._componentReferenceService = componentReferenceService;
    this._runningProcessService = runningProcessService;
    this._startProcessService = startProcessService;
    this._sessionMangamentServices = sessionMangamentServices;

    this._startProcessSub = this._startProcessService.startProcessNotify.subscribe((appName) =>{this.loadApps(appName)})
    this._startProcessSub = this._startProcessService.appNotFoundNotify.subscribe((appName) =>{this.loadApps(appName)})
    this._runningProcessService.closeProcessNotify.subscribe((p) =>{this.onCloseBtnClicked(p)})
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnDestroy(): void {
    this._closeProcessSub?.unsubscribe();
    this._startProcessSub?.unsubscribe();
    this._appNotFoundSub?.unsubscribe();
    this._appIsRunningSub?.unsubscribe();
  }

  ngAfterViewInit():void{
    
    // This quiets the - Expression has changed after it was checked.
      setTimeout(()=> {
        const openedAppList = this._sessionMangamentServices.getSession(this.userOpenedAppsKey) as string[];
        if(openedAppList != null || openedAppList != undefined){
          for(let i= 0; i < openedAppList.length; i++){
              this.loadApps(openedAppList[i]);
          }
        }
    }, 1500);
  }

  async loadApps(appName:string):Promise<void>{
    if(appName == 'hello'){
      this.lazyLoadComponment();
    }else{
      alert(`The app: ${appName} was not found. It could have been deleted or location changed.`)
    }
  }

  private async lazyLoadComponment() {
    const input = 3; // for the title component
    const componentToLoad = this.apps[input];
    const componentRef = this.itemViewContainer.createComponent<BaseComponent>(componentToLoad.type);
    const pid = componentRef.instance.processId
    this.addEntryFromUserOpenedApps(componentRef.instance.name);
    this._componentReferenceService.addComponentReference(pid, componentRef);

   //alert subscribers
   this._runningProcessService.processListChangeNotify.next()
  }

  onCloseBtnClicked(eventData:Process){
    
    const componentToDelete = this._componentReferenceService.getComponentReference(eventData.getProcessId);
    this._componentRefView = componentToDelete.hostView;

    // eslint-disable-next-line prefer-const
    let iVCntr  = this.itemViewContainer.indexOf(this._componentRefView);
    this.itemViewContainer.remove(iVCntr);

    this._runningProcessService.removeProcess(eventData)
    this._componentReferenceService.removeComponentReference(eventData.getProcessId);
    this._processIdService.removeProcessId(eventData.getProcessId);
    this.deleteEntryFromUserOpenedApps(eventData.getProcessName);

    //alert subscribers
    this._runningProcessService.processListChangeNotify.next()
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private deleteEntryFromUserOpenedApps(proccessName:string){
      const deleteCount = 1
      const pidIndex = this.userOpenedAppsList.indexOf(proccessName)

      if (pidIndex !== -1) 
        this.userOpenedAppsList.splice(pidIndex, deleteCount);

      this._sessionMangamentServices.addSession("openedApps", this.userOpenedAppsList)
  }

  private addEntryFromUserOpenedApps(proccessName:string){
    this.userOpenedAppsList.push(proccessName);
    this._sessionMangamentServices.addSession("openedApps", this.userOpenedAppsList)
}

}
