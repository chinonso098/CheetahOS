import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { Subscription } from 'rxjs';

@Component({
  selector: 'cos-controlpanel',
  templateUrl: './controlpanel.component.html',
  styleUrls: ['./controlpanel.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class ControlPanelComponent implements OnInit, OnDestroy {

  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _menuService:MenuService;
  private _windowService:WindowService;
  private _hideStartMenuSub!:Subscription;

  readonly aboutImg = `${Constants.IMAGE_BASE_PATH}cp_info.png`;
  readonly notificationImg = `${Constants.IMAGE_BASE_PATH}cp_notification.png`;
  readonly storageImg = `${Constants.IMAGE_BASE_PATH}cp_storage.png`;
  readonly screenImg = `${Constants.IMAGE_BASE_PATH}cp_screen.png`;
  readonly clipboardImg = `${Constants.IMAGE_BASE_PATH}cp_clipboard.png`;

  readonly ABOUT = 'About';
  readonly NOTIFICATION = 'Notifications & actions';
  readonly STORAGE = 'Storage';
  readonly SCREEN = 'Screen';
  readonly CLIPBOARD = 'Clipboard';
  readonly ON = 'On';
  readonly OFF = 'Off';

  readonly clipboardText =
`When you copy or cut something in Cheetah, it's copied to the
 clipboad for you to paste.`;

  readonly clipboardHisotryText = 
`Save multiple items to the clipboard to use later. Press the
 Cheetah logo key + V to view your clipboard history and paste
 from it.`;

 isSaveClipboardHistory = true;
 clipboardSaveStateText = this.ON;

  selectedOption = this.SCREEN;
  selectedIdx = 0;

  settingOptions!:string[][];
  
  isMaximizable = false;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}settings.png`;
  name = 'controlpanel';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService, 
               windowService:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.settingOptions = this.generateOptions();
  }

  ngOnDestroy(): void {
    this._hideStartMenuSub?.unsubscribe();
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  generateOptions():string[][]{
    const options = [[this.screenImg, this.SCREEN], [this.notificationImg, this.NOTIFICATION],  
                     [this.storageImg, this.STORAGE], [this.clipboardImg, this.CLIPBOARD], [this.aboutImg, this.ABOUT]];
    return options;
  }

  handleSelection(selection:string, idx:number, evt:MouseEvent):void{
    evt.stopPropagation();

    this.selectedOption = selection;
    this.selectedIdx = idx;
  }

  saveUnSaveClipBoardHisotry():void{


    //this.isSaveClipboardHistory = !this.isSaveClipboardHistory;

    this.clipboardSaveStateText = (this.isSaveClipboardHistory)? this.ON : this.OFF;
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
