import { Component, OnInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-startbutton',
  templateUrl: './startbutton.component.html',
  styleUrls: ['./startbutton.component.css']
})
export class StartButtonComponent implements OnInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  private _consts:Constants = new Constants();

  private isStartMenuVisible = false;

  hasWindow = false;
  hover = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startbutton';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1 
  }

  showStarMenu():void{
    if(!this.isStartMenuVisible){
      this._runningProcessService.showProcessNotify.next();
      this.isStartMenuVisible = true;
    }
    else{
      this._runningProcessService.hideProcessNotify.next();
      this.isStartMenuVisible = false;
    }

  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
