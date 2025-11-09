/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, SimpleChanges, AfterViewInit, EventEmitter, Output, OnDestroy} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationType } from 'src/app/system-files/common.enums';

import { WindowService } from '../../system-service/window.service';
import { ProcessIDService } from '../../system-service/process.id.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SessionManagmentService } from '../../system-service/session.management.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { AudioService } from '../../system-service/audio.services';

import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { Subscription } from 'rxjs';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';

@Component({
  selector: 'cos-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
  standalone:false,
})

export class DialogComponent implements BaseComponent, OnChanges, AfterViewInit, OnDestroy {

  @Input() inputMsg = Constants.EMPTY_STRING;
  @Input() inputTitle = Constants.EMPTY_STRING;
  @Input() notificationType = Constants.EMPTY_STRING;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private _userNotificationServices:UserNotificationService;
  private _windowService!:WindowService;
  private _sessionManagementService: SessionManagmentService;
  private _processIdService!:ProcessIDService;
  private _systemNotificationService!:SystemNotificationService;
  private _processHandlerService!:ProcessHandlerService;
  private _audioService!:AudioService;

   private _updateInformationSub!:Subscription;

  notificationOption = Constants.EMPTY_STRING;
  errorNotification = UserNotificationType.Error;
  warnNotification = UserNotificationType.Warning;
  infoNotification =  UserNotificationType.Info;
  pwrOnOffNotification =  UserNotificationType.PowerOnOff;
  fileTransferNotification =  UserNotificationType.FileTransfer;

  readonly cheetahOS = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  readonly myComputer = `${Constants.IMAGE_BASE_PATH}my_computer.png`;
  readonly infoIcon = `${Constants.IMAGE_BASE_PATH}info.png`;
  readonly warningIcon = `${Constants.IMAGE_BASE_PATH}warning.png`;
  readonly errorIcon = `${Constants.IMAGE_BASE_PATH}red_x.png`;
  readonly fileTransferIcon = `${Constants.IMAGE_BASE_PATH}file_transfer.png`;
  readonly errorNotificationAudio = `${Constants.AUDIO_BASE_PATH}cheetah_critical_stop.wav`;
  readonly cheetahBackGroundNotifyAudio = `${Constants.AUDIO_BASE_PATH}cheetah_background.wav`;

  pwrOnOffOptions = [
    { value: 'Shut down', label: 'Closes all apps and turns off the PC.' },
    { value: 'Restart', label: 'Closes all apps and turns off the PC, and turns it on again.' }
  ];

  reOpenWindows = true;
  showExtraErroMsg = false;
  selectedOption = 'Shut down';
  pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;

  readonly ERROR_DIALOG = 'error-dialog';
  readonly WARNING_DIALOG = 'warning-dialog';
  readonly INFO_DIALOG = 'info-dialog';
  readonly FILE_TRANSFER_DIALOG = 'fileTransfer-dialog';

  readonly UPDATE = 'Update';
  readonly UPDATE_0 = 'Update0';

  // from = '<strong>Downloads</strong>';
  // to = '<b>Desktop</b>';
  // srcToDest = `from &nbsp ${this.from} &nbsp (C:/Downloads) to &nbsp ${this.to} &nbsp (C:/Users/Desktop)`;
  // transferPercentage = 35;
  // transferProgress = 35;
  // transferPercentageText = `${this.transferPercentage}% complete`;
  // fileName = 'wet ass pussy.txt';

  from = Constants.EMPTY_STRING;
  to = Constants.EMPTY_STRING;
  srcToDest = Constants.EMPTY_STRING;
  transferPercentage = 0;
  transferProgress = 0;
  private itemOrSizeCount = 0
  transferPercentageText = Constants.EMPTY_STRING;
  fileName = Constants.EMPTY_STRING;

  readonly FILE_TRANSFER_DIALOG_APP_NAME = 'fileTransferDialog';

  dialogTitle = Constants.EMPTY_STRING;
  type = ComponentType.System;
  dialogMgs = Constants.EMPTY_STRING;
  displayAdditionalMsg ='Application not found';
  name = Constants.EMPTY_STRING;
  hasWindow = false;
  isMaximizable = false;
  icon = this.fileTransferIcon;
  processId = 0;
  displayName = Constants.EMPTY_STRING;

  constructor(notificationServices:UserNotificationService,  windowService:WindowService, systemNotificationServices:SystemNotificationService, 
              sessionManagementService:SessionManagmentService, processIdService:ProcessIDService, processHandlerService:ProcessHandlerService,
              audioService:AudioService){

    this._userNotificationServices = notificationServices;
    this._sessionManagementService = sessionManagementService;
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._systemNotificationService = systemNotificationServices;
    this._processHandlerService = processHandlerService;
    this._audioService = audioService;

    this.processId = this._processIdService.getNewProcessId();


    this._updateInformationSub = this._systemNotificationService.updateInformationNotify.subscribe((p) =>{
      if(p.appName === this.FILE_TRANSFER_DIALOG_APP_NAME && p.pId === this.processId)
        this.updateFileTransferDialog(p);
    });
  }

  ngOnChanges(changes: SimpleChanges):void{
    console.log('DIALOG onCHANGES:',changes);
    this.dialogMgs = this.inputMsg;
    this.dialogTitle = this.inputTitle;

    this.notificationOption = this.notificationType;

    if(this.notificationType === UserNotificationType.PowerOnOff){
      this.setPwrDialogPid(this.UPDATE);
    }

    if(this.notificationType === UserNotificationType.Error){
      if(this.dialogMgs === this.dialogTitle)
        this.showExtraErroMsg = true;
    }

    if(this.notificationType === UserNotificationType.FileTransfer){
      this.transferPercentageText = this.dialogMgs;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    const delay = 200; //200ms

    await CommonFunctions.sleep(delay);
    this.playDialogNotifcationSound();
  }

  ngOnDestroy(): void {
    //console.log('Dialog was destroyed')
    this._updateInformationSub?.unsubscribe();
  }

  onYesDialogBox():void{
    this.confirm.emit();
    this._userNotificationServices.closeDialogMsgBox(this.processId);
  }

  onCheckboxChange():void{
    console.log('Checkbox is checked:', this.reOpenWindows);
  }

  setPwrDialogPid(action:string):void{ 
    if(this.notificationOption === UserNotificationType.PowerOnOff){
      if(action === this.UPDATE){
        this._systemNotificationService.setPwrDialogPid(this.processId);
      }else{
        this._systemNotificationService.setPwrDialogPid(0);
      }
    }
  }

  async onYesPowerDialogBox(): Promise<void>{
    const delay = 200; //200ms
    const clearSessionData = !this.reOpenWindows;
    
    this.onCloseDialogBox();
    this._processHandlerService.closeActiveProcessWithWindows(clearSessionData);

    await CommonFunctions.sleep(delay);
    if(this.selectedOption === Constants.SYSTEM_RESTART){
      if(!this.reOpenWindows)
        this._sessionManagementService.clearAppSession();

      this._systemNotificationService.restartSystemNotify.next(Constants.RSTRT_ORDER_LOCK_SCREEN);
    }else{
      if(!this.reOpenWindows)
        this._sessionManagementService.clearAppSession();

      this._systemNotificationService.shutDownSystemNotify.next();
    }
  }

  onCloseDialogBox():void{
    this.cancel.emit();
    this._userNotificationServices.closeDialogMsgBox(this.processId);

    if(this.notificationOption !== UserNotificationType.PowerOnOff){
      this._windowService.removeWindowState(this.processId);
    }

    if(this.notificationOption === UserNotificationType.PowerOnOff){
      this.setPwrDialogPid(this.UPDATE_0);
    }
  }

  onPwrDialogWindowClick(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  onPwrOptionSelect(event: any):void{
    const selectedValue = event.target.value;
    this.selectedOption = selectedValue;
    this.pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;
  }

  async playDialogNotifcationSound():Promise<void>{
    if(this.notificationOption === this.errorNotification)
      await this._audioService.play(this.errorNotificationAudio);

    if(this.notificationOption === this.warnNotification)
      await this._audioService.play(this.cheetahBackGroundNotifyAudio);
  }

  updateFileTransferDialog(update:InformationUpdate):void{
    const updateInfo = update.info;
    const firstData = 'firstData';
    const firstEntryName = updateInfo[0].split(Constants.COLON)[0];
    const firstEntryValue = Number(updateInfo[0].split(Constants.COLON)[1]);
    const isFirstData  = (firstEntryName === firstData);

    if(isFirstData){
      // this.from = Constants.EMPTY_STRING;
      // this.to = Constants.EMPTY_STRING;
      // this.srcToDest = Constants.EMPTY_STRING;
      // this.transferPercentage = 35;
      // this.transferProgress = 35;
      this.transferPercentageText = this.dialogMgs;
    }else{

    }
  }

  private generateNotificationId(): number{
    const min = 10;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}
