/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, SimpleChanges, AfterViewInit, EventEmitter, Output, OnDestroy} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { UserNotificationType } from 'src/app/system-files/common.enums';

import { FileService } from '../../system-service/file.service';
import { WindowService } from '../../system-service/window.service';
import { DefaultService } from '../../system-service/defaults.services';
import { ProcessIDService } from '../../system-service/process.id.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { AudioService } from '../../system-service/audio.services';

import { basename} from 'path';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { Subscription } from 'rxjs';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';
import { FileInfo } from 'src/app/system-files/file.info';
import { WindowResizeInfo } from '../window/windows.types';
import { Process } from 'src/app/system-files/process';

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
  @Input() inputCallingProcessUId = Constants.EMPTY_STRING;
  @Input() inputFile!:FileInfo; 
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private _userNotificationServices:UserNotificationService;
  private _windowService!:WindowService;
  private _processIdService!:ProcessIDService;
  private _systemNotificationService!:SystemNotificationService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _audioService!:AudioService;
  private _fileService!:FileService;
  private _defaultService!:DefaultService;

  private _updateInformationSub!:Subscription;
  private _autoCloseDialogSub!:Subscription;

  notificationOption = Constants.EMPTY_STRING;
  errorNotification = UserNotificationType.Error;
  warnNotification = UserNotificationType.Warning;
  infoNotification =  UserNotificationType.Info;
  pwrOnOffNotification =  UserNotificationType.PowerOnOff;
  zipExtractNotification = UserNotificationType.ZipExtract;
  deleteWarnNotification = UserNotificationType.DeleteWarning;
  inUseWarnNotification = UserNotificationType.InUseWarning;
  fileTransferProgressNotification =  UserNotificationType.FileTransferProgress;
  deleteProgressNotification = UserNotificationType.FileDeleteProgress;

  readonly cheetahOS = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  readonly myComputer = `${Constants.IMAGE_BASE_PATH}my_computer.png`;
  readonly contentInRecycleBin = `${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
  readonly arrowDown = `${Constants.IMAGE_BASE_PATH}arrow_down.png`;
  readonly arrowUp = `${Constants.IMAGE_BASE_PATH}arrow_up.png`;
  readonly infoIcon = `${Constants.IMAGE_BASE_PATH}info.png`;
  readonly warningIcon = `${Constants.IMAGE_BASE_PATH}warning.png`;
  readonly errorIcon = `${Constants.IMAGE_BASE_PATH}red_x.png`;
  readonly fileTransferIcon = `${Constants.IMAGE_BASE_PATH}file_transfer.png`;
  readonly fileDeleteIcon = `${Constants.IMAGE_BASE_PATH}file_delete.png`;
  readonly folderDeleteIcon = `${Constants.IMAGE_BASE_PATH}folder_delete.png`;

  deleteDialogIcon = Constants.EMPTY_STRING;

  readonly errorNotificationAudio = `${Constants.AUDIO_BASE_PATH}cheetah_critical_stop.wav`;
  readonly cheetahBackGroundNotifyAudio = `${Constants.AUDIO_BASE_PATH}cheetah_background.wav`;

  readonly SHUT_DOWN = 'Shut down';
  readonly RESTART = 'Restart';
  readonly LOCK_SCREEN = 'Lock screen';
  readonly LOG_OFF = 'Log Off';

  showMoreDetails = false;
  arrowPosition = this.arrowDown;
  detailsAmount = 'More details';

  pwrOnOffOptions = [
    { value: this.SHUT_DOWN, label: 'Closes all apps and turns off the PC.' },
    { value: this.RESTART, label: 'Closes all apps and turns off the PC, and turns it on again.' },
    { value: this.LOCK_SCREEN, label: 'Lock screen. apps and session will persist' },
    { value: this.LOG_OFF, label: 'Closes all apps and sign out' }
  ];

  reOpenWindows = true;
  showExtraErroMsg = false;
  selectedOption = this.SHUT_DOWN;
  pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === this.selectedOption)?.label;

  readonly ERROR_DIALOG = 'error-dialog';
  readonly WARNING_DIALOG = 'warning-dialog';
  readonly INFO_DIALOG = 'info-dialog';
  readonly FILE_TRANSFER_DIALOG = 'fileTransfer-dialog';
  readonly FILE_TRANSFER_DIALOG_APP_NAME = 'fileTransferDialog';

  readonly SET_PWR_DIALOG_PID_ON_OPEN = 'Update';
  readonly SET_PWR_DIALOG_PID_ON_CLOSE = 'Update0';

  private transferAction = Constants.EMPTY_STRING;
  showEsitmateIntervalId!: NodeJS.Timeout;
  isInit = true;
  isDialog = true;
  isQuestionHidden = false;
  isFileTransferInProgress = false;
  isFileDeleteInProgress = false;
  isFolder = false;
  showTitleBarImg = false;
  from = Constants.BLANK_SPACE;
  to = Constants.BLANK_SPACE;
  srcToDestPart1 = Constants.BLANK_SPACE;
  srcToDestPart2 = Constants.BLANK_SPACE;
  transferPercentage = 0;
  transferProgress = 0;
  progressUpdateText = Constants.BLANK_SPACE;
  fileName = Constants.BLANK_SPACE;
  timeRemaining = Constants.EMPTY_STRING;
  itemsRemaining = Constants.EMPTY_STRING;
  itemsRemainingSize = Constants.EMPTY_STRING;

  fIcon = Constants.EMPTY_STRING;
  fName = Constants.EMPTY_STRING;
  fType = Constants.EMPTY_STRING;
  fPath = Constants.EMPTY_STRING;
  fSize = Constants.EMPTY_STRING;
  fDateCreated!:Date;

  dialogTitle = Constants.EMPTY_STRING;
  type = ComponentType.System;
  dialogMgs = Constants.EMPTY_STRING;
  inUseSuggestion = Constants.EMPTY_STRING;
  displayAdditionalMsg ='Application not found';
  zipExtractDestination = Constants.EMPTY_STRING;
  zipExtractShowOnComplete = true;
  name = Constants.EMPTY_STRING;
  hasWindow = false;
  isMaximizable = false;
  isMinimizable = false;
  turnOffWindowStacking = true;
  turnOffWindowOpenCloseAnimation = true;
  icon = this.fileTransferIcon;
  processId = 0;
  displayName = Constants.EMPTY_STRING;

  constructor(runningProcessService:RunningProcessService, notificationServices:UserNotificationService,  windowService:WindowService,
              systemNotificationServices:SystemNotificationService, processIdService:ProcessIDService,  processHandlerService:ProcessHandlerService, 
              audioService:AudioService, fileService:FileService, defaultService:DefaultService){

    this._userNotificationServices = notificationServices;
    this._processHandlerService = processHandlerService;
    this._processIdService = processIdService;
    this._windowService = windowService;
    this._systemNotificationService = systemNotificationServices;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._fileService = fileService;
    this._defaultService = defaultService;

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
      this.getRestoreUserOpenedAppDefault();
      this.setPwrDialogPid(this.SET_PWR_DIALOG_PID_ON_OPEN);
    }

    if(this.notificationType === UserNotificationType.Error){
      if(this.dialogMgs === this.dialogTitle)
        this.showExtraErroMsg = true;
    }

    if(this.notificationType === UserNotificationType.ZipExtract){
      this.zipExtractDestination = this.dialogMgs || '/Users/Documents/New folder';
      this.zipExtractShowOnComplete = true;
    }

    if(this.notificationType === UserNotificationType.FileTransferProgress || this.notificationType === UserNotificationType.FileDeleteProgress){
      let action = Constants.EMPTY_STRING;
      this.showTitleBarImg = true;
      
      if(this.notificationType === UserNotificationType.FileTransferProgress){ 
        this.isFileTransferInProgress = true;
        this.progressUpdateText = this.dialogMgs;
        this.transferAction = this.inputTitle;
        action = 'xfer';
      }

      if(this.notificationType === UserNotificationType.FileDeleteProgress){ 
        this.isFileDeleteInProgress = true;
        this.dialogTitle = this.dialogMgs;
        this.progressUpdateText = this.dialogMgs;
        const parts = this.inputTitle.split(Constants.COLON);
        this.srcToDestPart1 = `${parts[0]} ${parts[1]}`;
        this.from  = parts[2];
        action = 'del';
      }
      this.setFileTransferDialogComponentDetail(action);
    }

    if(this.notificationType === UserNotificationType.DeleteWarning || this.notificationType === UserNotificationType.InUseWarning){
      this.fIcon = this.inputFile.getIconPath;
      this.fName = this.inputFile.getFileName;
      this.fType = this.inputFile.getIsFile ? CommonFunctions.getFileTypeName(this.inputFile.getFileType) : 'Folder';
      //this.fPath = this.inputFile.getCurrentPath;
      this.fSize = `${this.inputFile.getSize} ${this.inputFile.getFileSizeUnit}`;
      this.fDateCreated = this.inputFile.getDateCreated;

      this.deleteDialogIconChange();

      if(this.notificationType === UserNotificationType.InUseWarning){
        this.showTitleBarImg = true;
        this.inUseSuggestion = this.inputFile.getIsFile ? 'Close the file and try again' : 'Close the folder or file and try again';
        this.isFolder = !this.inputFile.getIsFile;
      }
    }
  }

  deleteDialogIconChange():void{
    if(this.notificationOption !== UserNotificationType.DeleteWarning) return;

    if(this.inputFile.getCurrentPath.includes(Constants.RECYCLE_BIN_PATH)){
      this.deleteDialogIcon = this.inputFile.getIsFile ? this.fileDeleteIcon : this.folderDeleteIcon;
      return;
    }

    this.deleteDialogIcon = this.contentInRecycleBin;
  }

  async ngAfterViewInit(): Promise<void> {
    const delay = 200; //200ms
    await CommonFunctions.sleep(delay);
    await this.playDialogNotifcationSound();
  }

  ngOnDestroy(): void {
    //console.log('Dialog was destroyed')
    this._updateInformationSub?.unsubscribe();
    this._autoCloseDialogSub?.unsubscribe();
  }

  onYesDialogBox():void{
    if(this.notificationOption === UserNotificationType.Warning 
      || this.notificationOption === UserNotificationType.DeleteWarning
      || this.notificationOption === UserNotificationType.InUseWarning){
      this.confirm.emit();
    }
    
    this._userNotificationServices.closeDialogMsgBox(this.processId);
  }

  onReOpenWindowsCheckboxChange():void{
    //console.log('onReOpenWindows is checked:', this.reOpenWindows);
    const raiseEvent = false;
    const restorePriorOpenedApps = this.reOpenWindows ? Constants.TRUE : Constants.FALSE;
    this._defaultService.updateDefaultData(Constants.DEFAULT_RESTORE_USER_OPENED_APPS, restorePriorOpenedApps, raiseEvent);
  }

  /**
   * The power dialog can be closed in two two ways
   * A. by clicking yes / no on from the dialog window
   * B. by clicking on the desktop when the dialog window is visible.
   * 
   * This method simply sets the pid, just in case the power dialog is closed by clicking on the desktop
   * if the pid is not 0, then dialog is closed.
   * @param action 
   */

  setPwrDialogPid(action:string):void{ 
    if(this.notificationOption === UserNotificationType.PowerOnOff){
      if(action === this.SET_PWR_DIALOG_PID_ON_OPEN){
        this._systemNotificationService.setPwrDialogPid(this.processId);
      }else{
        this._systemNotificationService.setPwrDialogPid(0);
      }
    }
  }

  /** When Yes is clicked on Shutdown or Restart Power dialog.*/
  async onYesPowerDialogBox(): Promise<void>{
    const delay = 200; //200ms    
    this.onCloseDialogBox();

    if(this.selectedOption === this.LOCK_SCREEN || this.selectedOption === this.LOG_OFF){
      if(this.selectedOption === this.LOCK_SCREEN)
        this._systemNotificationService.lockScreenNotify.next();

      if(this.selectedOption === this.LOG_OFF){
        CommonFunctions.logOff(this._systemNotificationService, this._runningProcessService, this._processHandlerService, this._windowService);
        this._systemNotificationService.logOffNotify.next();
      }

      return;
    }
  
    CommonFunctions.prepareSystemForShutdownOrRestart(this.selectedOption, this._systemNotificationService, 
      this._runningProcessService, this._processHandlerService, this._windowService, this._defaultService);
   
    await CommonFunctions.sleep(delay);
    if(this.selectedOption === Constants.SYSTEM_RESTART){
      this._systemNotificationService.restartSystemNotify.next(Constants.RSTRT_ORDER_LOCK_SCREEN);
    }else{
      this._systemNotificationService.shutDownSystemNotify.next();
    }
  }

  onCloseDialogBox(evt?:MouseEvent):void{
    evt?.stopImmediatePropagation();

    if(this.notificationOption === UserNotificationType.Warning 
      || this.notificationOption === UserNotificationType.DeleteWarning
      || this.notificationOption === UserNotificationType.InUseWarning){
      this.cancel.emit();
    }

    if(this.notificationOption === UserNotificationType.FileTransferProgress){
      this._fileService.cancelFileTransferNotify.next(this.processId);
    }

    if(this.notificationOption !== UserNotificationType.PowerOnOff){
      this._windowService.removeWindowState(this.processId);
    }

    if(this.notificationOption === UserNotificationType.PowerOnOff){
      this.setPwrDialogPid(this.SET_PWR_DIALOG_PID_ON_CLOSE);
    }

    this._userNotificationServices.closeDialogMsgBox(this.processId);
  }

  onPwrDialogWindowClick(evt:MouseEvent):void{
    evt.stopPropagation();
  }

  onPwrOptionSelect(event: any):void{
    const selectedValue = event.target.value;
    this.selectedOption = selectedValue;
    this.pwrOnOffOptionsTxt = this.pwrOnOffOptions.find(x => x.value === selectedValue)?.label;
    this.isQuestionHidden = (selectedValue === this.SHUT_DOWN || this.selectedOption === this.RESTART) ? false : true;
  }

  onZipExtract():void{
    this.onYesDialogBox();
  }

  onZipExtractBrowse():void{
    // Placeholder for folder-picker integration.
  }

  async playDialogNotifcationSound():Promise<void>{
    if(this.notificationOption === this.errorNotification)
      await this._audioService.play(this.errorNotificationAudio);

    if(this.notificationOption === this.warnNotification 
      || this.notificationOption === this.deleteWarnNotification 
      || this.notificationOption === this.infoNotification)

      await this._audioService.play(this.cheetahBackGroundNotifyAudio);
  }

  updateFileTransferDialog(update:InformationUpdate):void{
    const updateInfo = update.info;
    const initInformation = 'initInformation';
    const initInformationName = updateInfo[0].split(Constants.COLON)[0];
   // const initInformationValue = Number(updateInfo[0].split(Constants.COLON)[1]);
    const isInitInformation  = (initInformationName === initInformation);

    if(isInitInformation){
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

    this.fileName = Constants.BLANK_SPACE;
    this.timeRemaining = 'Calculating...';
    this.itemsRemaining ='Calculating...';

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

  setTransferDialogFields(update: string[]):void{
    // Validate the update array and its required indices
    if (!Array.isArray(update) || update.length < 5) {
      console.warn("setTransferDialogFields: Invalid or incomplete update array", update);
      return;
    }

    let timeRemaining = Constants.EMPTY_STRING;
    let itemsRemaining = 0;
    let itemsRemainingSize = 0;
    let itemsRemainingSizeUnit = Constants.EMPTY_STRING;
    let fileName = Constants.EMPTY_STRING;
  
    // 0 srcPath, 1 destPath, 2 totalNumberOfFiles, 3 numberOfFiles Copied/Moved, 
    // 4 timeRemaining, 5 itemsRemaining, 6 itemsRemainingSize, 7 fileName
    // Safely extract values with guards
    const srcPath = this.safeGetValue(update[0]);
    const destPath = this.safeGetValue(update[1]);
    const totalFiles = Number(this.safeGetValue(update[2]));
    const movedFiles = Number(this.safeGetValue(update[3]));

    if(this.showMoreDetails){
      timeRemaining = CommonFunctions.formatDuration(Number(this.safeGetValue(update[4])));
      itemsRemaining = Number(this.safeGetValue(update[5]));
      itemsRemainingSize = CommonFunctions.getReadableFileSizeValue(Number(this.safeGetValue(update[6])));
      itemsRemainingSizeUnit = CommonFunctions.getFileSizeUnit(Number(this.safeGetValue(update[6])));
      fileName = this.safeGetValue(update[7]);
    }
  
    // Validate numeric values
    if(!isFinite(totalFiles) || !isFinite(movedFiles) || totalFiles <= 0){
      console.warn("setTransferDialogFields: Invalid file counts", { totalFiles, copiedFiles: movedFiles });
      return;
    }
  
    // Only set `from` and `to` once if they’re blank initially
    if (this.from === Constants.BLANK_SPACE) 
      this.from = basename(srcPath)
    
    if (this.to === Constants.BLANK_SPACE) 
      this.to = basename(destPath)
    
    // Compose status message
    this.srcToDestPart1 = `${this.transferAction} ${movedFiles} items from`;
    this.srcToDestPart2 ='to';
  
    // Compute transfer progress safely
    const value = this.getTransferPercentage(totalFiles, movedFiles);
    this.transferPercentage = value;
    this.transferProgress = value;
    this.progressUpdateText = (this.notificationType === UserNotificationType.FileDeleteProgress) 
    ? `${movedFiles} items recycled` 
    : `${value}% complete`;

    this.fileName = fileName;
    this.timeRemaining = `About ${timeRemaining}`;
    this.itemsRemaining = `${itemsRemaining} (${itemsRemainingSize} ${itemsRemainingSizeUnit})`;
  
    //Auto-close if 100% complete
    if(value >= 100){
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
  safeGetValue(input: string):string{
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
  getTransferPercentage(total: number, curVal: number):number{
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

  changeDetailsAmount():void{
    this.showMoreDetails = !this.showMoreDetails;
    this.arrowPosition = (this.showMoreDetails)? this.arrowUp : this.arrowDown;
    this.detailsAmount = (this.showMoreDetails)? 'Fewer details' : 'More details';


    const fileTransferElmnt = document.getElementById(
      `fileTransferDialog-${this.processId}`
    ) as HTMLDivElement | null;
    
    if(fileTransferElmnt){
      const fileTransferTailElmnt = document.getElementById(
        `fileTransferDialogTail-${this.processId}`
      ) as HTMLDivElement | null;
    
      const baseHeight = 135;
      const titleBarHeight = 30;
      const detailsHeight = this.showMoreDetails ? 60 : 0;
      const totalHeight = baseHeight + titleBarHeight + detailsHeight;
    
      fileTransferElmnt.style.height = `${totalHeight}px`;
    
      const resize: WindowResizeInfo = {
        pId: this.processId,  widthPx: 450, heightPx: totalHeight
      };
    
      this._windowService.resizeProcessWindowNotify.next(resize);
    
      if(fileTransferTailElmnt){
        fileTransferTailElmnt.style.position = 'fixed';
        fileTransferTailElmnt.style.bottom = '0';
      }
    }
  }

  getRestoreUserOpenedAppDefault():void{
    const restorePriorOpenedApps = this._defaultService.getDefaultSetting(Constants.DEFAULT_RESTORE_USER_OPENED_APPS);
    this.reOpenWindows = (restorePriorOpenedApps === Constants.TRUE) ? true : false;
  }

  private setFileTransferDialogComponentDetail(action:string):void{
    const folderIcon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
    const dialogName = Constants.BLANK_SPACE;
    const hasWindow = true;

    const process = new Process(this.processId, dialogName, folderIcon, hasWindow, this.type);
    this._runningProcessService.addProcess(process);
    this._runningProcessService.processListChangeNotify.next();
  }

}
