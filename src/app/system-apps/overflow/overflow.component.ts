/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, effect } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';
import { FileIndexerService } from 'src/app/shared/system-service/file.indexer.services';

@Component({
  selector: 'cos-overflow',
  templateUrl: './overflow.component.html',
  styleUrl: './overflow.component.css',
  standalone:false,
})
export class OverFlowComponent implements AfterViewInit {
  private _runningProcessService!:RunningProcessService;
  private _systemNotificationService:SystemNotificationService;
  private _fileIndexerService!:FileIndexerService;

  chatterIcon =`${Constants.IMAGE_BASE_PATH}chatter.png`;
  taskManagerIcon =`${Constants.IMAGE_BASE_PATH}taskmanager_grid.png`;
  indexingGif  =`${Constants.GIF_BASE_PATH}file_system_index.gif`;

  tskMngrUtil = 0; // accepts a number between 0 and 100
  showTskMngrUtil = false;
  showChatterIcon = false;
  showIndexingIcon = false;

  private readonly TASK_MANAGER = "taskmanager";

  constructor(runningProcessService:RunningProcessService, systemNotificationService:SystemNotificationService, fileIndexerService:FileIndexerService) { 
    this._runningProcessService = runningProcessService;
    this._systemNotificationService = systemNotificationService;
    this._fileIndexerService = fileIndexerService;

    effect(() => { if (this._runningProcessService.processListChangeNotify() > 0) { this.hideShowTaskManagerUtil(); this.hideShowChatter(); } });

    effect(() => {
      const p = this._systemNotificationService.updateInformationNotify();
      if (p !== null) {
        if(p.appName === this.TASK_MANAGER)
          this.updateTaskManager(p);
      }
    });

    effect(() => { const p = this._fileIndexerService.IndexingInProgress(); if (p !== null) this.showIndexingIcon = p; });
  }

  async ngAfterViewInit():Promise<void>{  
    const delay = 500; //.5 secs  
    await CommonFunctions.sleep(delay);
    this.hideShowTaskManagerUtil();
    this.hideShowChatter();
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
    // Basic guard: ensure update and info exist
    if (!update || !Array.isArray(update.info) || update.info.length === 0) {
      console.warn("updateTaskManager: Invalid or empty update.info");
      return;
    }
  
    const updatedInfo = update.info;
    const firstInfo = updatedInfo[0];
  
    // Ensure firstInfo is a string containing a colon
    if (typeof firstInfo !== "string" || !firstInfo.includes(Constants.COLON)) {
      console.warn("updateTaskManager: Malformed info string", firstInfo);
      return;
    }
  
    const parts = firstInfo.split(Constants.COLON);
    if (parts.length < 2) {
      console.warn("updateTaskManager: Missing data after colon");
      return;
    }
  
    const cpuData = parts[1].trim();
    const cpuUtil = Number(cpuData);
  
    // Validate that cpuUtil is a finite number
    if (isNaN(cpuUtil) || !isFinite(cpuUtil)) {
      console.warn("updateTaskManager: Invalid CPU utilization value", cpuData);
      return;
    }
  
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
