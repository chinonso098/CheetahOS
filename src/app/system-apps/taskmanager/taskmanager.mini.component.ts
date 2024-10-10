import { Component, OnInit,OnDestroy} from '@angular/core';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { Process } from 'src/app/system-files/process';

@Component({
  selector: 'cos-taskmanager-mini',
  templateUrl: './taskmanager.mini.component.html',
  styleUrls: ['./taskmanager.component.css']
})
export class TaskmanagerMiniComponent implements BaseComponent,OnInit,OnDestroy {

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  
  private _processListChangeSub!: Subscription;
 
  processes:Process[] =[];

  hasWindow = true;
  icon = 'osdrive/Cheetah/System/Imageres/taskmanager.png';
  name = 'taskmanager';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Task Manager';


  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService,triggerProcessService:TriggerProcessService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._triggerProcessService = triggerProcessService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{this.updateRunningProcess();})
  }

  ngOnInit(): void {
   this.processes = this._runningProcessService.getProcesses();

  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
  }

  onMoreDetailsBtnClick():void{
    const file:FileInfo = new FileInfo();
    file.setIconPath = '/osdrive/Cheetah/System/Imageres/taskmanger.png';
    file.setOpensWith = 'taskmanager';
    file.setFileType ='.png';

    const processToClose = this._runningProcessService.getProcess(this.processId);
    this._triggerProcessService.startApplication(file);

    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  setTaskMangrMiniWindowToFocus(pid: number):void {
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  updateRunningProcess():void{
    this.processes = this._runningProcessService.getProcesses();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}
