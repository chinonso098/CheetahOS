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

import { basename, dirname} from 'path';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { delay, Subscription } from 'rxjs';
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

  fakeEsitmateIntervalId!: NodeJS.Timeout;
  isInit = true;
  from = Constants.BLANK_SPACE;
  to = Constants.BLANK_SPACE;
  srcToDest = Constants.BLANK_SPACE;
  transferPercentage = 0;
  transferProgress = 0;
  transferPercentageText = Constants.BLANK_SPACE;
  fileName = Constants.BLANK_SPACE;

  readonly FILE_TRANSFER_DIALOG_APP_NAME = 'fileTransferDialog';
  private transferAction = Constants.EMPTY_STRING;

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
      this.transferAction = this.inputTitle;
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
      this.transferPercentageText = this.dialogMgs;
      this.fakeEstimating();
    }else{
      this.isInit = false;
      if(this.fakeEsitmateIntervalId)
        clearInterval(this.fakeEsitmateIntervalId);

      this.setTransferDialogFields(updateInfo);
    }
  }

  fakeEstimating():void{
    const delay = 1000; //1 sec
    const maxAppendNum = 5;
    let counter = -1;
    this.transferPercentageText = this.dialogMgs;

    this.fakeEsitmateIntervalId = setInterval(() => {
      while(counter < maxAppendNum){
        const curString = this.transferPercentageText;
        if(counter >= 0){
          this.transferPercentageText = `${curString}.`;
        }
        counter++;
        break;
      }

      if(counter === maxAppendNum) {
        this.transferPercentageText = this.dialogMgs;
        counter = 0
      }
    }, delay);
  }

  setTransferDialogFields(update: string[]): void {
    // Validate the update array and its required indices
    if (!Array.isArray(update) || update.length < 5) {
      console.warn("setTransferDialogFields: Invalid or incomplete update array", update);
      return;
    }
  
    // 0 srcPath, 1 destPath, 2 totalNumberOfFiles, 3 numberOfFilesCopied, 4 fileName
    // Safely extract values with guards
    const srcPath = this.safeGetValue(update[0]);
    const destPath = this.safeGetValue(update[1]);
    const totalFiles = Number(this.safeGetValue(update[2]));
    const copiedFiles = Number(this.safeGetValue(update[3]));
    const fileName = this.safeGetValue(update[4]);
  
    // Validate numeric values
    if (!isFinite(totalFiles) || !isFinite(copiedFiles) || totalFiles <= 0) {
      console.warn("setTransferDialogFields: Invalid file counts", { totalFiles, copiedFiles });
      return;
    }
  
    // Only set `from` and `to` once if they’re blank initially
    if (this.from === Constants.BLANK_SPACE) {
      this.from = `<strong>${basename(srcPath)}</strong>`;
    }

    if (this.to === Constants.BLANK_SPACE) {
      this.to = `<strong>${basename(destPath)}</strong>`;
    }
    // Compose status message
    this.srcToDest = `${this.transferAction} ${copiedFiles} items from &nbsp ${this.from} &nbsp to &nbsp ${this.to}`;

  
    // Compute transfer progress safely
    const value = this.getTransferPercentage(totalFiles, copiedFiles);
    this.transferPercentage = value;
    this.transferProgress = value;
    this.transferPercentageText = `${value}% complete`;
    this.fileName = fileName;
  
    //Auto-close if 100% complete
    if (value >= 100) {
      const delay = 1000; // 1 sec
      setTimeout(() => {
        this._userNotificationServices.closeDialogMsgBox(this.processId);
      }, delay);
    }
  }
  
  // --- Safe helpers ---
  
  /**
   * Safely extracts the value after a colon. Returns an empty string if invalid.
   */
  safeGetValue(input: string): string {
    if (typeof input !== "string" || !input.includes(Constants.COLON)) {
      console.warn("safeGetValue: Malformed input", input);
      return Constants.EMPTY_STRING;
    }
  
    const parts = input.split(Constants.COLON);
    return parts.length > 1 ? parts[1].trim() : Constants.EMPTY_STRING;
  }
  
  /**
   * Safely computes percentage with zero and NaN checks.
   */
  getTransferPercentage(total: number, curVal: number): number {
    if (!isFinite(total) || total <= 0) {
      console.warn("getTransferPercentage: Invalid total value", total);
      return 0;
    }
    if (!isFinite(curVal) || curVal < 0) {
      console.warn("getTransferPercentage: Invalid current value", curVal);
      return 0;
    }
  
    const percentage = (curVal / total) * 100;
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0–100
  }
  

  private generateNotificationId(): number{
    const min = 10;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}
