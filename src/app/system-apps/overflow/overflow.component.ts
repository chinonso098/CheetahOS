/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, OnDestroy, Component } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Subscription } from 'rxjs';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';

@Component({
  selector: 'cos-overflow',
  templateUrl: './overflow.component.html',
  styleUrl: './overflow.component.css',
  standalone:false,
})
export class OverFlowComponent implements AfterViewInit, OnDestroy {
  private _runningProcessService!:RunningProcessService;
  private _systemNotificationService:SystemNotificationService;

  private _processListChangeSub!:Subscription;
  private _updateInformationSub!:Subscription;

  chatterIcon =`${Constants.IMAGE_BASE_PATH}chatter.png`;
  taskManagerIcon =`${Constants.IMAGE_BASE_PATH}taskmanager_grid.png`;
  indexingGif  =`${Constants.GIF_BASE_PATH}file_system_index.gif`;

  tskMngrUtil = 0; // accepts a number between 0 and 100
  showTskMngrUtil = false;
  showChatterIcon = false;
  showIndexingIcon = false;

  private readonly TASK_MANAGER = "taskmanager";

  constructor(runningProcessService:RunningProcessService, systemNotificationService:SystemNotificationService) { 
    this._runningProcessService = runningProcessService;
    this._systemNotificationService = systemNotificationService;

    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{
      this.hideShowTaskManagerUtil();
      this.hideShowChatter();
    });

    this._updateInformationSub = this._systemNotificationService.updateInformationNotify.subscribe((p) =>{
      if(p.appName === this.TASK_MANAGER)
        this.updateTaskManager(p);
    });
  }

  async ngAfterViewInit():Promise<void>{  
    const delay = 500; //.5 secs  
    await CommonFunctions.sleep(delay);
    this.hideShowTaskManagerUtil();
    this.hideShowChatter();
  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
    this._updateInformationSub?.unsubscribe();
  }

  async hideShowTaskManagerUtil():Promise<void>{
    const isRunning = this._runningProcessService.isProcessRunning(this.TASK_MANAGER);
    const delay = 100; //.1 secs 

    if(!isRunning){
      this.showTskMngrUtil = false;
      return;
    }

    this.showTskMngrUtil = true;
    await CommonFunctions.sleep(delay);

    const overFlowElmnt = document.getElementById('tskMngrOverFlowIcon') as HTMLDivElement;
    if(overFlowElmnt){
      overFlowElmnt.style.backgroundImage = `url(${this.taskManagerIcon})`;
    }
  }

  updateTaskManager(update:InformationUpdate):void{
    const updatedInfo = update.info;
    const cpuData =  updatedInfo[0].split(Constants.COLON)[1];
    const cpuUtil = Number(cpuData);
    this.tskMngrUtil = cpuUtil;
  }

  hideShowChatter():void{
    const chatter = "chatter";
    const isRunning = this._runningProcessService.isProcessRunning(chatter);
    if(!isRunning){
      this.showChatterIcon = false;
      return;
    }

    this.showChatterIcon = true;
  }

  getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
