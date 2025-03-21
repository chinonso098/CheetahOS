import { Component, ElementRef, AfterViewInit } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
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

  
  SECONDS_DELAY = 250;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
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

  showTaskBarContextMenu(evt:MouseEvent):void{
    if(this._runningProcessService.getEventOrginator() === Constants.EMPTY_STRING){
      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);
  
      // const taskBarElmnt = document.getElementById('the-window-taskbar') as HTMLDivElement;
      // const rect =  taskBarElmnt.getBoundingClientRect();
  
      this._menuService.showTaskBarConextMenu.next(evt);
    }

    evt.preventDefault();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
