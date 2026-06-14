/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppDirectory } from 'src/app/system-files/app.directory';
import { WindowService } from 'src/app/shared/system-service/window.service';

interface RunAppEntry {
  name: string;
  icon: string;
}

@Component({
  selector: 'cos-runsystem',
  templateUrl: './runsystem.component.html',
  styleUrl: './runsystem.component.css',
  standalone:false,
})
export class RunSystemComponent implements BaseComponent, OnInit {

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _windowService!:WindowService;
  private _appDirectory:AppDirectory;

  hasWindow = false;
  isDialog = true;
  icon = `${Constants.IMAGE_BASE_PATH}run.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Run';
  name = 'runsystem';

  // UI state
  inputValue = '';
  isDropdownOpen = false;
  appList:RunAppEntry[] = [];

  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, processHandlerService:ProcessHandlerService, windowService:WindowService) {
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = processHandlerService;
    this._windowService = windowService;
    this._appDirectory = new AppDirectory();

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    // exclude cheetah, clippy, runsystem, clipboard
    this.appList = this._appDirectory.getAppList().filter(appName => !this._appDirectory.getHiddenApp().includes(appName)).map((appName) => ({
      name: appName,
      icon: this._appDirectory.getAppIcon(appName),
    }));
  }

  toggleDropdown(evt:MouseEvent):void{
    evt.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectApp(app:RunAppEntry, evt:MouseEvent):void{
    evt.stopPropagation();
    this.inputValue = app.name;
    this.isDropdownOpen = false;
  }

  onInputChange():void{
    this.isDropdownOpen = false;
  }

  onOk():void{
    const appName = this.inputValue.trim();
    if(appName === Constants.EMPTY_STRING)
      return;

    const file = new FileInfo();
    file.setFileName = appName;
    file.setOpensWith = appName;

    this._processHandlerService.runApplication(file);
    this.closeRunWindow();
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. 
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  private closeRunWindow():void{
    const processToClose = this._runningProcessService.getProcess(this.processId);
    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  onClosePropertyView():void{
    this.closeRunWindow();
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

}
