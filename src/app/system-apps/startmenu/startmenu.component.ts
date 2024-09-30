import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css']
})
export class StartMenuComponent implements OnInit, AfterViewInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  private _elRef:ElementRef;
  private _consts:Constants = new Constants();
  private SECONDS_DELAY = 250;

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, elRef: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1 
  }
  
  ngAfterViewInit(): void {
    this.removeVantaJSSideEffect();
  }

  /**
   * NOTE:This method is temporary for the start menu
   */
  removeVantaJSSideEffect(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = '';
        elfRef.style.zIndex = '';
      }
    }, this.SECONDS_DELAY);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
