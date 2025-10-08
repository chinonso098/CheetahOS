import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup } from '@angular/forms';

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

  readonly systemImg = `${Constants.IMAGE_BASE_PATH}cp_system.png`;
  readonly appsImg = `${Constants.IMAGE_BASE_PATH}cp_apps.png`;
  readonly personalizationImg = `${Constants.IMAGE_BASE_PATH}cp_personalization.png`;

  readonly LANDING_VIEW = 'Landing';
  readonly SYSTEM_VIEW = 'System';
  readonly SYSTEM_VIEW_EXTRA = 'Screen, sound, notification'
  readonly APPS_VIEW = 'Apps';
  readonly APPS_VIEW_EXTRA = 'Uninstall, default, optional features';
  readonly PERSONALIZATION_VIEW = 'Personalize';
  readonly PERSONALIZATION_VIEW_EXTRA = 'Background, lock screen, colors';

  DEFAULT_VIEW = this.LANDING_VIEW;

  readonly SYSTEM_ABOUT = 'About';
  readonly SYSTEM_NOTIFICATION = 'Notifications & actions';
  readonly SYSTEM_STORAGE = 'Storage';
  readonly SYSTEM_SCREEN = 'Screen';
  readonly SYSTEM_CLIPBOARD = 'Clipboard';
  readonly ON = 'On';
  readonly OFF = 'Off';


  private _formBuilder:FormBuilder;
  searchBarForm!: FormGroup;

  searchPlaceHolder = 'FInd a seeting';

  readonly clipboardText =
`When you copy or cut something in Cheetah, it's copied to the
 clipboad for you to paste.`;

  readonly clipboardHisotryText = 
`Save multiple items to the clipboard to use later. Press the
 Cheetah logo key + V to view your clipboard history and paste
 from it.`;

 isSaveClipboardHistory = true;
 clipboardSaveStateText = this.ON;

  selectedOption = this.SYSTEM_SCREEN;
  selectedIdx = 0;

  controlPanelOptions!:string[][];
  systemOptions!:string[][];
  
  isMaximizable = false;
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}settings.png`;
  name = 'controlpanel';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService, 
               windowService:WindowService, formBuilder:FormBuilder) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._windowService = windowService;

    this._formBuilder = formBuilder;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {

    this.searchBarForm = this._formBuilder.nonNullable.group({
      searchBarText: Constants.EMPTY_STRING,
    });

    // this._searchBoxChangeSub = this.searchBarForm.get('searchBarText')?.valueChanges
    //   .pipe(debounceTime(delay))
    //   .subscribe(value => {
    //     this.currentSearchString = value;
    //     this.handleSearch(value);
    //   });


    this.controlPanelOptions = this.generateControlPanelOptions();
    this.systemOptions = this.generateSystemOptions();
  }

  ngOnDestroy(): void {
    this._hideStartMenuSub?.unsubscribe();
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  generateControlPanelOptions():string[][]{
    const options = [[this.systemImg, this.SYSTEM_VIEW, this.SYSTEM_VIEW_EXTRA], [this.appsImg, this.APPS_VIEW,  this.APPS_VIEW_EXTRA],  
                     [this.personalizationImg, this.PERSONALIZATION_VIEW, this.PERSONALIZATION_VIEW_EXTRA]];
    return options;
  }

  generateSystemOptions():string[][]{
    const options = [[this.screenImg, this.SYSTEM_SCREEN], [this.notificationImg, this.SYSTEM_NOTIFICATION],  
                     [this.storageImg, this.SYSTEM_STORAGE], [this.clipboardImg, this.SYSTEM_CLIPBOARD], [this.aboutImg, this.SYSTEM_ABOUT]];
    return options;
  }

  handleControlPanelSelection(selection:string, idx:number, evt:MouseEvent):void{
    evt.stopPropagation();

    this.DEFAULT_VIEW = selection;
    //this.selectedIdx = idx;
  }

  handleSystemSelection(selection:string, idx:number, evt:MouseEvent):void{
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
