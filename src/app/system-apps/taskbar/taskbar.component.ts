import { Component, ElementRef, AfterViewInit } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-taskbar',
  templateUrl: './taskbar.component.html',
  styleUrls: ['./taskbar.component.css']
})
export class TaskbarComponent implements AfterViewInit{

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _el: ElementRef;
  private _consts:Constants = new Constants();
  
  SECONDS_DELAY = 250;

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbar';
  processId = 0;
  type = ComponentType.System
  displayName = ''

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService, el: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._el = el;
    
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  
  ngAfterViewInit(): void {

    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const tskBar = this._el.nativeElement;
      if(tskBar) {
        tskBar.style.position = '';
        tskBar.style.zIndex = '';
      }
    }, this.SECONDS_DELAY);
  }

  hideContextMenus():void{
    this._menuService.hideContextMenus.next();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
