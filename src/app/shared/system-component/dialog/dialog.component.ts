/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, SimpleChanges, AfterViewInit, EventEmitter, Output, OnDestroy} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationType } from 'src/app/system-files/common.enums';

import { FileService } from '../../system-service/file.service';
import { WindowService } from '../../system-service/window.service';
import { ProcessIDService } from '../../system-service/process.id.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SessionManagmentService } from '../../system-service/session.management.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { AudioService } from '../../system-service/audio.services';

import { basename} from 'path';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { Subscription } from 'rxjs';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';
import { FileInfo } from 'src/app/system-files/file.info';

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
  @Input() inputFile!:FileInfo; 
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private _userNotificationServices:UserNotificationService;
  private _windowService!:WindowService;
  private _sessionManagementService: SessionManagmentService;
  private _processIdService!:ProcessIDService;
  private _systemNotificationService!:SystemNotificationService;
  private _processHandlerService!:ProcessHandlerService;
  private _audioService!:AudioService;
  private _fileService!:FileService;

  private _updateInformationSub!:Subscription;
  private _autoCloseDialogSub!:Subscription;

  notificationOption = Constants.EMPTY_STRING;
  errorNotification = UserNotificationType.Error;
  warnNotification = UserNotificationType.Warning;
  infoNotification =  UserNotificationType.Info;
  pwrOnOffNotification =  UserNotificationType.PowerOnOff;
  deleteWarnNotification = UserNotificationType.DeleteWarning;
  fileTransferProgressNotification =  UserNotificationType.FileTransferProgress;
  deleteProgressNotification = UserNotificationType.FileDeleteProgress;

  readonly cheetahOS = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  readonly myComputer = `${Constants.IMAGE_BASE_PATH}my_computer.png`;
  readonly contentInRecycleBin = `${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
  readonly emptyRecycleBin = `${Constants.IMAGE_BASE_PATH}empty_bin.png`;
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

  readonly FILE_TRANSFER_DIALOG_APP_NAME = 'fileTransferDialog';
  private transferAction = Constants.EMPTY_STRING;
  showEsitmateIntervalId!: NodeJS.Timeout;
  isInit = true;
  isFileTransferInProgress = false;
  isFileDeleteInProgress = false;
  from = Constants.BLANK_SPACE;
  to = Constants.BLANK_SPACE;
  srcToDestPart1 = Constants.BLANK_SPACE;
  srcToDestPart2 = Constants.BLANK_SPACE;
  transferPercentage = 0;
  transferProgress = 0;
  progressUpdateText = Constants.BLANK_SPACE;
  fileName = Constants.BLANK_SPACE;

  fIcon = Constants.EMPTY_STRING;
  fName = Constants.EMPTY_STRING;
  fType = Constants.EMPTY_STRING;
  fPath = Constants.EMPTY_STRING;
  fDateCreated!:Date;

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
              audioService:AudioService, fileService:FileService){

    this._userNotificationServices = notificationServices;
    this._sessionManagementService = sessionManagementService;
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._systemNotificationService = systemNotificationServices;
    this._processHandlerService = processHandlerService;
    this._audioService = audioService;
    this._fileService = fileService;

    this.processId = this._processIdService.getNewProcessId();

    this._updateInformationSub = this._systemNotificationService.updateInformationNotify.subscribe((p) =>{
      if(p.appName === this.FILE_TRANSFER_DIALOG_APP_NAME && p.pId === this.processId)
        this.updateFileTransferDialog(p);
    });

    this._autoCloseDialogSub = this._systemNotificationService.autoCloseDialogNotify.subscribe((p) =>{
      if(p === this.processId)
        this._userNotificationServices.closeDialogMsgBox(this.processId);
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

    if(this.notificationType === UserNotificationType.FileTransferProgress || this.notificationType === UserNotificationType.FileDeleteProgress){
      if(this.notificationType === UserNotificationType.FileTransferProgress){ 
        this.isFileTransferInProgress = true;
        this.progressUpdateText = this.dialogMgs;
        this.transferAction = this.inputTitle;
      }

      if(this.notificationType === UserNotificationType.FileDeleteProgress){ 
        this.isFileDeleteInProgress = true;
        this.dialogTitle = this.dialogMgs;
        this.progressUpdateText = this.dialogMgs;
        this.from = this.inputTitle.replace('Preparing to recycle from ', Constants.EMPTY_STRING);
        this.srcToDestPart1 = 'Preparing to recycle from';
      }
    }

    if(this.notificationType === UserNotificationType.DeleteWarning){
      this.fIcon = this.inputFile.getIconPath;
      this.fName = this.inputFile.getFileName;
      this.fType = this.inputFile.getFileType;
      this.fPath = this.inputFile.getCurrentPath;
      this.fDateCreated = this.inputFile.getDateCreated;
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
    this._autoCloseDialogSub?.unsubscribe();
  }

  onYesDialogBox():void{
    if(this.notificationOption === UserNotificationType.Warning || this.notificationOption === UserNotificationType.DeleteWarning){
      this.confirm.emit();
    }
    
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
    if(this.notificationOption === UserNotificationType.Warning || this.notificationOption === UserNotificationType.DeleteWarning){
      this.cancel.emit();
    }

    if(this.notificationOption === UserNotificationType.FileTransferProgress){
      this._fileService.cancelFileTransferNotify.next(this.processId);
    }

    if(this.notificationOption !== UserNotificationType.PowerOnOff){
      this._windowService.removeWindowState(this.processId);
    }

    if(this.notificationOption === UserNotificationType.PowerOnOff){
      this.setPwrDialogPid(this.UPDATE_0);
    }

    this._userNotificationServices.closeDialogMsgBox(this.processId);
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

    if(this.notificationOption === this.warnNotification || this.notificationOption === this.deleteWarnNotification)
      await this._audioService.play(this.cheetahBackGroundNotifyAudio);
  }

  updateFileTransferDialog(update:InformationUpdate):void{
    const updateInfo = update.info;
    const firstData = 'firstData';
    const firstEntryName = updateInfo[0].split(Constants.COLON)[0];
    const firstEntryValue = Number(updateInfo[0].split(Constants.COLON)[1]);
    const isFirstData  = (firstEntryName === firstData);

    console.log('updateFileTransferDialog:', update);

    if(isFirstData){
      this.progressUpdateText = this.dialogMgs;
      this.showEstimating();
    }else{
      this.isInit = false;
      if(this.showEsitmateIntervalId)
        clearInterval(this.showEsitmateIntervalId);

      this.setTransferDialogFields(updateInfo);
    }
  }

  showEstimating():void{
    const delay = 250; //.25 sec
    const maxAppendNum = 5;
    let counter = -1;
    this.progressUpdateText = this.dialogMgs;

    this.showEsitmateIntervalId = setInterval(() => {
      while(counter < maxAppendNum){
        const curString = this.progressUpdateText;
        if(counter >= 0){
          this.progressUpdateText = `${curString}.`;
        }
        counter++;
        break;
      }

      if(counter === maxAppendNum) {
        this.progressUpdateText = this.dialogMgs;
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
    if (this.from === Constants.BLANK_SPACE) 
      this.from = basename(srcPath)
    
    if (this.to === Constants.BLANK_SPACE) 
      this.to = basename(destPath)
    
    // Compose status message
    this.srcToDestPart1 = `${this.transferAction} ${copiedFiles} items from`;
    this.srcToDestPart2 ='to';
  
    // Compute transfer progress safely
    const value = this.getTransferPercentage(totalFiles, copiedFiles);
    this.transferPercentage = value;
    this.transferProgress = value;
    this.progressUpdateText = `${value}% complete`;
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
  
    const percentage = Math.round((curVal / total) * 100);
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0–100
  }
  

  private generateNotificationId(): number{
    const min = 10;
    const max = 999;
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }
}
