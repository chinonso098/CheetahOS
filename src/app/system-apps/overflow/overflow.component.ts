/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, OnDestroy, Component } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-overflow',
  templateUrl: './overflow.component.html',
  styleUrl: './overflow.component.css',
  standalone:false,
})
export class OverFlowComponent implements AfterViewInit, OnDestroy {
  private _runningProcessService!:RunningProcessService;
  private _processListChangeSub!:Subscription;

  audioIcon =`${Constants.IMAGE_BASE_PATH}no_volume.png`;
  taskManagerIcon =`${Constants.IMAGE_BASE_PATH}taskmanager_grid.png`

  tskMngrUtil = 0; // accepts a number between 0 and 100
  showTskMngrUtil = false;

  constructor(runningProcessService:RunningProcessService) { 
    this._runningProcessService = runningProcessService;
    this._processListChangeSub = this._runningProcessService.processListChangeNotify.subscribe(() =>{this.hideShowTaskManagerUtil()});
  }

  async ngAfterViewInit():Promise<void>{  
    const delay = 500; //.5 secs  
    await CommonFunctions.sleep(delay);
    this.hideShowTaskManagerUtil();
  }

  ngOnDestroy(): void {
    this._processListChangeSub?.unsubscribe();
  }

  async hideShowTaskManagerUtil():Promise<void>{
    const tskMnger = "taskmanager";
    const isRunning = this._runningProcessService.isProcessRunning(tskMnger);
    const delay = 100; //.1 secs  
    const delay1 = 2000; //2secs  

    if(!isRunning){
      this.showTskMngrUtil = false;
      return;
    }

    this.showTskMngrUtil = true;
    await CommonFunctions.sleep(delay);

    const overFlowElmnt = document.getElementById('tskMngrOverFlowIcon') as HTMLDivElement;
    if(overFlowElmnt){
      overFlowElmnt.style.backgroundImage = `url(${this.taskManagerIcon})`;

      setInterval(() => {
        this.tskMngrUtil = this.getRandomInt(10, 100);
      }, delay1);
    }
  }

  getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
