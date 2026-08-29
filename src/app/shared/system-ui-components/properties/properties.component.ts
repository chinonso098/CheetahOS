/* eslint-disable @angular-eslint/prefer-standalone */
import {Component, Input, OnChanges, OnDestroy, HostBinding, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { basename, dirname} from 'path';
import { Constants } from "src/app/system-files/constants";
import { Subscription } from 'rxjs';

import { Process } from 'src/app/system-files/process';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ProcessIDService } from '../../system-service/process.id.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { WindowService } from '../../system-service/window.service';
import { FileService } from '../../system-service/file.service';
import { DefaultService } from '../../system-service/defaults.services';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { QuickAccessService } from '../../system-service/quick.access.service';

@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css',
  standalone:false,
})

export class PropertiesComponent implements BaseComponent, OnChanges, OnDestroy{
  @Input() fileInput!:FileInfo;
  // When true the window renders the "Folder Options" settings view instead of a file/folder
  // properties view. In this mode no `fileInput` is supplied.
  @Input() isFolderOptions = false;
  // Mirrors the system theme onto the host so the dialog picks up the dark palette.
  @HostBinding('class.theme-dark') isDarkTheme = false;

  // ---- Folder Options (General tab) state ---------------------------------
  // Each control persists its value to DefaultService the moment it changes, so the
  // dialog needs no Apply/Cancel — OK just closes the window.
  readonly folderOptionsTitle = Constants.FOLDER_OPTIONS_TITLE;
  readonly openToQuickAccess = Constants.OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;
  readonly openToThisPc = Constants.OPEN_FILE_EXPLORER_TO_THIS_PC;
  openFileExplorerTo = Constants.OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;
  openFolderInSameWindow = true;
  showHiddenFilesAndFolders = false;
  showFileExtensions = false;
  displayFullPathInTitleBar = false;
  showRecentlyUsedFiles = true;
  showFrequentlyUsedFolders = true;

  fileFolder = 'File folder';
  osDisk = 'OSDisk';
 
  createdfileDate:Date= new Date();
  accessedfileDate:Date= new Date();
  modifiedfileDate:Date= new Date();

  isFile = true;
  isInRecycleBin = false;
  isRootFolder = false;
  URL = Constants.URL;
  readonly capacity = Constants.STORAGE_CAPACITY;
 
  type = ComponentType.System;
  hasWindow = false;

  name = Constants.EMPTY_STRING;
  icon = Constants.EMPTY_STRING;
  origin = Constants.EMPTY_STRING;
  iconPath = Constants.EMPTY_STRING;
  contains = Constants.EMPTY_STRING;
  location = Constants.EMPTY_STRING;
  opensWith = Constants.EMPTY_STRING;
  displayName = Constants.EMPTY_STRING;
  // Text shown in the window title bar, e.g. "report.txt Properties". Kept separate from
  // `name` so the in-body label can stay as the plain item name.
  displayMsg = Constants.EMPTY_STRING;
  fileSizeUnit = Constants.EMPTY_STRING;
  // Free space and total capacity can fall in a different size band than the used space,
  // so each keeps its own unit label instead of sharing `fileSizeUnit`.
  availableSpaceUnit = Constants.EMPTY_STRING;
  capacityUnit = Constants.EMPTY_STRING;

  circumference: number = 2 * Math.PI * 35; // Circumference for a circle with radius 35
  strokeDashoffset: number = this.circumference; // Initialize to full offset (all white)

  processId = 0;
  fileSize = 0;
  fileSize2 = 0;
  fileSizeOnDisk = 0;
  fileSizeOnDisk2 = 0;
  availableSpace = 0;
  availableSpace2 = 0;
  capacity2 = 0;

  private hiddenName = Constants.EMPTY_STRING
  private hiddenIcon = `${Constants.IMAGE_BASE_PATH}file_explorer.png`;
  private openInWindowIcon = `${Constants.IMAGE_BASE_PATH}open_in_window.png`;
  private openInNewWindowIcon = `${Constants.IMAGE_BASE_PATH}open_in_new_window.png`;
  quickAccessHistoryIcon = `${Constants.IMAGE_BASE_PATH}quick_access_history.png`;
  hideShowIcon = `${Constants.IMAGE_BASE_PATH}hide_show.png`;

  openInIconState = this.openInWindowIcon;

  private _themeSub?:Subscription;

  // Services are injected directly as readonly constructor parameters, which removes the
  // manual field assignments (and the non-null `!` assertions they previously required).
  constructor(private readonly _processIdService:ProcessIDService,
              private readonly _runningProcessService:RunningProcessService,
              private readonly _windowService:WindowService,
              private readonly _fileService:FileService,
              private readonly _defaultService:DefaultService,
              private readonly _themeService:ThemeService,
              private readonly _quickAccessService:QuickAccessService){
    // Reserve a process id as soon as the component is created so it stays stable for the
    // lifetime of this properties window.
    this.processId = this._processIdService.getNewProcessId();
    this.isDarkTheme = !this._themeService.isLightTheme();
    this._themeSub = this._themeService.themeChange.subscribe(() => {
      this.isDarkTheme = !this._themeService.isLightTheme();
    });
  }

  ngOnDestroy():void{
    this._themeSub?.unsubscribe();
  }

  async ngOnChanges(changes: SimpleChanges):Promise<void>{
    // Folder Options mode: no `fileInput` is bound, so skip the file/folder detail work
    // entirely and seed the settings view instead. The backing process is registered once.
    if(this.isFolderOptions){
      if(changes['isFolderOptions']?.firstChange){
        this.initFolderOptions();
        this._runningProcessService.addProcess(this.getComponentDetail());
      }
      return;
    }

    // Recompute the displayed details whenever the bound file/folder changes.
    await this.doStuff();

    // Register the backing process only once, the first time `fileInput` is set. Doing it
    // on every change would push duplicate processes that all share this component's single
    // processId. `doStuff()` runs first so `hiddenName`/`icon` are populated before the
    // process detail is built.
    if(changes['fileInput']?.firstChange){
      this._runningProcessService.addProcess(this.getComponentDetail());
    }
  }

  // ---- Folder Options ------------------------------------------------------

  private initFolderOptions():void{
    this.name = this.folderOptionsTitle;
    this.displayMsg = this.folderOptionsTitle;
    this.hiddenName = `${Constants.WIN_EXPLR + this.folderOptionsTitle}`;
    this.icon = this.hiddenIcon;
    this.iconPath = this.hiddenIcon;

    this.openFileExplorerTo =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FILE_EXPLORER_TO) || Constants.OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;
    this.openFolderInSameWindow =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW) !== Constants.FALSE;

    if(this.openFolderInSameWindow){
      this.openInIconState = this.openInWindowIcon;
    } else {
      this.openInIconState = this.openInNewWindowIcon;
    }

    this.showHiddenFilesAndFolders =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS) === Constants.TRUE;
    this.showFileExtensions =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FILE_EXTENSIONS) === Constants.TRUE;
    this.displayFullPathInTitleBar =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR) === Constants.TRUE;
    this.showRecentlyUsedFiles =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_RECENTLY_USED_FILES) !== Constants.FALSE;
    this.showFrequentlyUsedFolders =
      this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS) !== Constants.FALSE;
  }

  private persistFolderOption(key:string, value:boolean):void{
    // raiseEvent:true — open File Explorer windows subscribe and apply the change live.
    const raiseEvent = true;
    this._defaultService.updateDefaultData(key, value ? Constants.TRUE : Constants.FALSE, raiseEvent);
  }

  onBrowseFoldersChange(sameWindow:boolean):void{
    this.openFolderInSameWindow = sameWindow;

    if(this.openFolderInSameWindow){
      this.openInIconState = this.openInWindowIcon;
    } else {
      this.openInIconState = this.openInNewWindowIcon;
    }

    this.persistFolderOption(Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW, sameWindow);
  }

  onOpenFileExplorerToChange(evt:Event):void{
    const value = (evt.target as HTMLSelectElement).value;
    this.openFileExplorerTo = value;
   const raiseEvent = true;
    // String-valued setting (not a boolean flag), so it bypasses persistFolderOption.
    this._defaultService.updateDefaultData(Constants.DEFAULT_OPEN_FILE_EXPLORER_TO, value, raiseEvent);
  }

  onHiddenFilesChange(show:boolean):void{
    this.showHiddenFilesAndFolders = show;
    this.persistFolderOption(Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS, show);
  }

  onToggleShowFileExtensions():void{
    this.showFileExtensions = !this.showFileExtensions;
    this.persistFolderOption(Constants.DEFAULT_SHOW_FILE_EXTENSIONS, this.showFileExtensions);
  }

  onToggleDisplayFullPath():void{
    this.displayFullPathInTitleBar = !this.displayFullPathInTitleBar;
    this.persistFolderOption(Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR, this.displayFullPathInTitleBar);
  }

  onToggleRecentlyUsedFiles():void{
    this.showRecentlyUsedFiles = !this.showRecentlyUsedFiles;
    this.persistFolderOption(Constants.DEFAULT_SHOW_RECENTLY_USED_FILES, this.showRecentlyUsedFiles);
  }

  onToggleFrequentlyUsedFolders():void{
    this.showFrequentlyUsedFolders = !this.showFrequentlyUsedFolders;
    this.persistFolderOption(Constants.DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS, this.showFrequentlyUsedFolders);
  }

  onClearFileExplorerHistory():void{
    // Placeholder: no File Explorer history store exists yet. Kept as a no-op so the
    // Privacy section's Clear button is wired and ready when history lands.
    this._quickAccessService.clear();
  }

  async doStuff():Promise<void> {
    this.name = this.fileInput.getFileName;
    this.displayMsg = `${this.fileInput.getFileName} Properties`;
    const currPath = dirname(this.fileInput.getCurrentPath);
    this.location = `C: ${currPath}`;
    this.icon = this._fileService.getAppAssociaton(this.fileInput.getOpensWith);
    this.iconPath = this.fileInput.getIconPath;
    this.opensWith = this.fileInput.getOpensWith;
    this.hiddenName = `${Constants.WIN_EXPLR + this.fileInput.getFileName}`;
    this.isFile = this.fileInput.getIsFile;
    this.isInRecycleBin = (currPath.includes(Constants.RECYCLE_BIN_PATH));
    this.isRootFolder = (currPath === Constants.ROOT) && (this.fileInput.getCurrentPath === Constants.ROOT);

    if(this.fileInput.getIsFile){
      this.getFileSize();

      if(this.isInRecycleBin){
        this.fileFolder = this.fileInput.getFileType;
        this.getOrigin();
      }
    }
    
    if(!this.fileInput.getIsFile){
      this.icon = this.fileInput.getIconPath;

      if(!this.isRootFolder)
        await this.getFolderContentDetails();

      await this.getFolderSizeData();
      if(this.isInRecycleBin){
        this.getOrigin();
      }

      if(this.isRootFolder){
        this.fileFolder = 'Local Disk';
        this.icon = `${Constants.IMAGE_BASE_PATH}os_disk_1.png`;
        this.iconPath = `${Constants.IMAGE_BASE_PATH}os_disk_1.png`;
        this.displayMsg = `${this.fileFolder} (C:) Properties`;
        this.location = 'BrowserFS';
      }
    }
  }

  async getFolderContentDetails():Promise<void>{
    const count =  await this._fileService.countFolderItems(this.fileInput.getCurrentPath);
    if(count === 0){
      this.contains = '0 Files, 0 Folders';
    }else{
      this.contains = await this._fileService.getFullCountOfFolderItems(this.fileInput.getCurrentPath);
    }
  }

  getFileSize():void{
    this.fileSize = this.fileInput.getSize;
    this.fileSize2 = this.fileInput.getSizeInBytes;

    const tmpFilesOnDisk = this.getRandomNumber(this.fileInput.getSizeInBytes);
    this.fileSizeOnDisk = CommonFunctions.getReadableFileSizeValue(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed(0));

    this.fileSizeUnit = this.fileInput.getFileSizeUnit;
    this.createdfileDate = this.fileInput.getDateCreated;
    this.accessedfileDate = this.fileInput.getDateAccessed;
    this.modifiedfileDate = this.fileInput.getDateModified;
  }

  async getFolderSizeData():Promise<void>{

    let folderSize = 0;
    if(this.fileInput.getContentPath === Constants.ROOT)
      // Lazily triggers the one-time full-drive walk on first drive Properties open.
      folderSize = await this._fileService.getUsedStorageAsync();
    else
      folderSize = await this._fileService.getFolderSizeAsync(this.fileInput.getCurrentPath);

    this.fileSize = CommonFunctions.getReadableFileSizeValue(folderSize);
    this.fileSize2 = folderSize;

    const tmpFilesOnDisk = this.getRandomNumber(folderSize);
    this.fileSizeOnDisk = CommonFunctions.getReadableFileSizeValue(tmpFilesOnDisk);
    this.fileSizeOnDisk2 = Number(tmpFilesOnDisk.toFixed(0));

    this.fileSizeUnit  = CommonFunctions.getFileSizeUnit(folderSize);
    this.createdfileDate = this.fileInput.getDateCreated;
    this.accessedfileDate = this.fileInput.getDateAccessed;
    this.modifiedfileDate = this.fileInput.getDateModified;

    if(this.isRootFolder){
      this.availableSpace = this.capacity - folderSize;
      this.availableSpace2 = CommonFunctions.getReadableFileSizeValue(this.availableSpace);
      this.capacity2 =  CommonFunctions.getReadableFileSizeValue(this.capacity);

      // Give free space and capacity their own unit labels so a value shown in (say) GB
      // isn't mislabelled with the used-space unit (which may be MB).
      this.availableSpaceUnit = CommonFunctions.getFileSizeUnit(this.availableSpace);
      this.capacityUnit = CommonFunctions.getFileSizeUnit(this.capacity);

      this.updateCapacityImg(folderSize);
    }
  }

  updateCapacityImg(used:number): void {
    // Calculate stroke-dashoffset based on the input value
    // 100% progress means 0 offset, 0% means full offset
    this.strokeDashoffset = this.circumference * (1 - used/ this.capacity);
  }

  getOrigin():void{
    const cntntOrigin = this._fileService.getFolderOrigin(this.fileInput.getCurrentPath);
    if(cntntOrigin !== Constants.EMPTY_STRING)
      this.origin = basename(dirname(cntntOrigin));
    else
      this.origin = 'Unknown';
  }

  onClosePropertyView():void{
    this._windowService.closeWindowProcessNotify.next(this.processId);
  }

  /**
   * Approximates Windows' "size on disk", which is normally a little larger than the
   * logical file size because of cluster allocation. We simulate that by padding the given
   * size with a random amount between 0% and 5%.
   * NOTE: this is intentionally non-deterministic and is only an estimate used for display.
   */
  private getRandomNumber(x:number): number{
    const fivePercent = x * 0.05;
    const randomAddition = Math.random() * fivePercent; // 0 .. 5% of x
    const result = x + randomAddition;

    // Limit to 2 decimal places.
    return parseFloat(result.toFixed(2));
  }

  setPropertyWindowToFocus(pId:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pId);
  }

  private getComponentDetail():Process{
    // Prefer the icon resolved for the current item so the process entry matches what the
    // user is viewing; fall back to the generic file-explorer icon if it isn't ready yet.
    const processIcon = this.icon || this.hiddenIcon;
    return new Process(this.processId, this.hiddenName, processIcon, this.hasWindow, this.type);
  }

}

