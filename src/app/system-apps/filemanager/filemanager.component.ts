import { AfterViewInit, Component, OnInit, OnDestroy, ViewChild, ElementRef} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { Process } from 'src/app/system-files/process';
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileInfo } from 'src/app/system-files/file.info';
import { Subscription } from 'rxjs';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { FileManagerService } from 'src/app/shared/system-service/file.manager.services';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { GeneralMenu } from 'src/app/shared/system-component/menu/menu.item';


@Component({
  selector: 'cos-filemanager',
  templateUrl: './filemanager.component.html',
  styleUrls: ['./filemanager.component.css']
})
export class FileManagerComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy {
  @ViewChild('myBounds', {static: true}) myBounds!: ElementRef;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;
  private _elRef:ElementRef;
  private _directoryFilesEntries!:FileEntry[];
  private _triggerProcessService:TriggerProcessService;
  private _menuService:MenuService;
  private _formBuilder:FormBuilder;
  private _consts:Constants = new Constants();

  private _viewByNotifySub!:Subscription;
  private _sortByNotifySub!:Subscription;
  private _refreshNotifySub!:Subscription;
  private _autoArrangeIconsNotifySub!:Subscription;
  private _autoAlignIconsNotifyBySub!:Subscription;
  private _showDesktopIconNotifySub!:Subscription;
  private _dirFilesUpdatedSub!: Subscription;
  private _hideContextMenuSub!:Subscription;

  private autoAlign = true;
  private autoArrange = false;
  private currentIconName = '';
  private showDesktopIcon = true;

  private isRenameActive = false;
  private isIconInFocusDueToPriorAction = false;
  private isBtnClickEvt= false;
  private isHideCntxtMenuEvt= false;

  isDraggable = true;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = -1;
  private prevSelectedElementId = -1; 
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private renameFileTriggerCnt = 0; 

  iconCntxtMenuStyle:Record<string, unknown> = {};
  iconSizeStyle:Record<string, unknown> = {};
  btnStyle:Record<string, unknown> = {};

  showCntxtMenu = false;
  gridSize = 90; //column size of grid = 90px
  SECONDS_DELAY:number[] = [6000,250];
  renameForm!: FormGroup;

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'filemanager';
  processId = 0;
  type = ComponentType.System;
  displayName = '';
  directory ='/Users/Desktop';
  files:FileInfo[] = [];

  sourceData:GeneralMenu[] = [
    {icon:'', label: 'Open', action: this.onTriggerRunProcess.bind(this) },
    {icon:'', label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:'', label: 'Open in Terminal', action: this.doNothing.bind(this) },
    {icon:'', label: 'Pin to Start', action: this.doNothing.bind(this) },
    {icon:'', label: 'Pin to Taskbar', action: this.pinIconToTaskBar.bind(this) },
    {icon:'', label: 'Cut', action: this.onCut.bind(this) },
    {icon:'', label: 'Copy', action: this.onCopy.bind(this)},
    {icon:'', label: 'Create shortcut', action: this.createShortCut.bind(this)},
    {icon:'', label: 'Delete', action: this.onDeleteFile.bind(this) },
    {icon:'', label: 'Rename', action: this.onRenameFileTxtBoxShow.bind(this) },
    {icon:'', label: 'Properties', action: this.showPropertiesWindow.bind(this) }
  ];

  menuData:GeneralMenu[] =[];
  
  fileExplrMngrMenuOption = this._consts.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  menuOrder = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileInfoService:FileService,
              triggerProcessService:TriggerProcessService, fileManagerService:FileManagerService, formBuilder: FormBuilder, menuService:MenuService, elRef: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileService = fileInfoService;
    this._triggerProcessService = triggerProcessService;
    this._menuService = menuService;
    this._formBuilder = formBuilder;
    this._elRef = elRef;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._dirFilesUpdatedSub = this._fileService.dirFilesUpdateNotify.subscribe(() =>{
      if(this._fileService.getEventOrginator() === this.name){
        this.loadFilesInfoAsync();
        this._fileService.removeEventOriginator();
      }
    });

    this._viewByNotifySub = fileManagerService.viewByNotify.subscribe((p) =>{this.changeIconsSize(p)});
    this._sortByNotifySub = fileManagerService.sortByNotify.subscribe((p)=>{this.sortIcons(p)});
    this._autoArrangeIconsNotifySub = fileManagerService.autoArrangeIconsNotify.subscribe((p) =>{this.toggleAutoArrangeIcons(p)});
    this._autoAlignIconsNotifyBySub = fileManagerService.alignIconsToGridNotify.subscribe((p) => {this.toggleAutoAlignIconsToGrid(p)});
    this._refreshNotifySub = fileManagerService.refreshNotify.subscribe(()=>{this.refreshIcons()});
    this._showDesktopIconNotifySub = fileManagerService.showDesktopIconsNotify.subscribe((p) =>{this.toggleDesktopIcons(p)});
    this._hideContextMenuSub = this._menuService.hideContextMenus.subscribe(() => { this.hideIconContextMenu()});
  }

  ngOnInit():void{
    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: '',
    });
  }

  async ngAfterViewInit():Promise<void>{
    await this.loadFilesInfoAsync();
    this.removeVantaJSSideEffect();
  }

  ngOnDestroy(): void {
    this._viewByNotifySub?.unsubscribe();
    this._sortByNotifySub?.unsubscribe();
    this._refreshNotifySub?.unsubscribe();
    this._autoArrangeIconsNotifySub?.unsubscribe();
    this._autoAlignIconsNotifyBySub?.unsubscribe();
    this._showDesktopIconNotifySub?.unsubscribe();
    this._dirFilesUpdatedSub?.unsubscribe();
    this._hideContextMenuSub?.unsubscribe();
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    let droppedFiles:File[] = [];

    if(event?.dataTransfer?.files){
        // eslint-disable-next-line no-unsafe-optional-chaining
        droppedFiles  = [...event?.dataTransfer?.files];
    }
    
    if(droppedFiles.length >= 1){
      const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
      if(result){
        this._fileService.addEventOriginator('filemanager');
        this._fileService.dirFilesUpdateNotify.next();
      }
    }
      
  }

  private async loadFilesInfoAsync():Promise<void>{
    this.files = [];
    this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.getEntriesFromDirectoryAsync(this.directory);
    this._directoryFilesEntries = this._fileService.getFileEntriesFromDirectory(directoryEntries,this.directory);

    for(let i = 0; i < directoryEntries.length; i++){
      const fileEntry = this._directoryFilesEntries[i];
      const fileInfo = await this._fileService.getFileInfoAsync(fileEntry.getPath);
      this.files.push(fileInfo)
    }
  }


  removeVantaJSSideEffect(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = '';
        elfRef.style.zIndex = '';
      }
    }, this.SECONDS_DELAY[1]);
  }

  runProcess(file:FileInfo):void{

    console.log('filemanager-runProcess:',file)
    this._triggerProcessService.startApplication(file);
    this.btnStyleAndValuesReset();
    
    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    // if((file.getOpensWith === 'fileexplorer' && file.getFileName !== 'fileexplorer') && file.getFileType ==='folder'){
    //     //this.directory = file.getCurrentPath;
    //    // await this.loadFilesInfoAsync();

    //    this._triggerProcessService.startApplication(file);
    //    this.btnStyleAndValuesReset();

    // }else{
    //     this._triggerProcessService.startApplication(file);
    //     this.btnStyleAndValuesReset();
    // }
  }

  onBtnClick(evt:MouseEvent, id:number):void{
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);

  }

  onTriggerRunProcess():void{
    this.runProcess(this.selectedFile);
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);
    this._menuService.hideContextMenus.next();

    this.adjustContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file;
    this.showCntxtMenu = !this.showCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);
  
    this.iconCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${String(evt.clientX)}px, ${String(evt.clientY)}px)`,
      'z-index': 2,
    }

    evt.preventDefault();
  }

  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }

  adjustContextMenuData(file:FileInfo):void{
    this.menuData = [];
  
    console.log('adjustContextMenuData - filename:',file.getCurrentPath);
    if(file.getIsFile){
          //files can not be opened in terminal, pinned to start, opened in new window, pin to Quick access
          this.menuOrder = this._consts.DEFAULT_FILE_MENU_ORDER;
          for(const x of this.sourceData) {
            if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Pin to Start'){ /*nothing*/}
            else{
              this.menuData.push(x);
            }
          }
      }else{
        this.menuOrder = this._consts.DEFAULT_FOLDER_MENU_ORDER;
        this.menuData = this.sourceData;
      }
  }

  doNothing():void{
    console.log('do nothing called');
  }

  onCopy():void{
    const action = 'copy';
    const path = this.selectedFile.getCurrentPath;
    this._menuService.storeData.next([path, action]);
  }

  onCut():void{
    const action = 'cut';
    const path = this.selectedFile.getCurrentPath;
    this._menuService.storeData.next([path, action]);
  }
  pinIconToTaskBar():void{
    this._menuService.pinToTaskBar.next(this.selectedFile);
  }

  doBtnClickThings(id:number):void{
    this.prevSelectedElementId = this.selectedElementId 
    this.selectedElementId = id;

    this.isBtnClickEvt = true;
    this.btnClickCnt++;
    this.isHideCntxtMenuEvt = false;
    this.hideCntxtMenuEvtCnt = 0;

    if(this.prevSelectedElementId != id){
      this.removeBtnStyle(this.prevSelectedElementId);
    }
  }

  hideIconContextMenu(caller?:string):void{
    this.showCntxtMenu = false;

    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this._menuService.hideContextMenus.next();
    }
  }

  handleIconHighLightState():void{
 
    //First case - I'm clicking only on the desktop icons
    if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt == 0)){  
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= 0)
          this.setBtnStyle(this.selectedElementId,false);

        this.isIconInFocusDueToPriorAction = false;
      }
      if(!this.isRenameActive){
        this.isBtnClickEvt = false;
        this.btnClickCnt = 0;
      }
    }else{
      this.hideCntxtMenuEvtCnt++;
      this.isHideCntxtMenuEvt = true;
      //Second case - I was only clicking on the desktop
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= 1) && (!this.isBtnClickEvt && this.btnClickCnt == 0))
        this.btnStyleAndValuesReset();
      
      //Third case - I was clicking on the desktop icons, then i click on the desktop.
      //clicking on the desktop triggers a hideContextMenuEvt
      if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt > 1))
        this.btnStyleAndValuesReset();
    }
  }

  onDragEnd(evt:any):void{
    //console.log('event type:',evt.type);
    // const rect =  this.myBounds.nativeElement.getBoundingClientRect(); 

    const btnTransform = window.getComputedStyle(evt);
    const matrix = new DOMMatrixReadOnly(btnTransform.transform);
    
    const transform = {
      translateX: matrix.m41,
      translateY: matrix.m42
    }

    // const transX = matrix.m41;
    // const transY = matrix.m42;

    console.log('TODO:FileManagerComponent, Upgrade the basic state tracking/management logic:',transform);
  }

  onDragStart(evt:DragEvent, i:number):void{
    //this.isDraggable = true
    const btnIcon = document.getElementById(`liIconBtn${i}`) as HTMLElement
    // console.log('DragStart:',btnIcon);
    // if(btnIcon){
    //   // btnIcon.style.position = 'absolute';
    //   btnIcon.style.zIndex = '4';
    // }
    // console.log('DragStart:',btnIcon);
  }

  onDragStart_Off(evt:DragEvent, i: number): void {
 
    /**
     * This method is mimick the functionality of Windows should a user attempt to drag n drop content from the 
     * desktop to the FileExplorer, or another application that support DnD
     * 
     * The issue at the moment, is that it collide with the angular2-draggable functionailty. 
     * for the time being, it is Off
     */
  
    const iconA = document.getElementById(`filemngr_fig${i}`) as HTMLElement;
  
    // Get the cloneIcon container
    const elementId = 'filemngr_clone_cntnr';
    const cloneIcon = document.getElementById(elementId);
  
    if(cloneIcon){
      // Clear any previous content in the clone container
      cloneIcon.innerHTML = '';
      cloneIcon.appendChild(iconA.cloneNode(true));
  
      cloneIcon.style.left = '-9999px';  // Move it out of view initially
      cloneIcon.style.opacity = '0.2';
  
      // Set the cloned icon as the drag image
      if (evt.dataTransfer) {
        evt.dataTransfer.setDragImage(cloneIcon, 0, 0);  // Offset positions for the drag image
      }
    }
  }
  

  onMouseEnter(id:number):void{
    this.setBtnStyle(id, true);
  }

  onMouseLeave(id:number):void{
    if(id != this.selectedElementId){
      this.removeBtnStyle(id);
    }
    else if((id == this.selectedElementId) && !this.isIconInFocusDueToPriorAction){
      this.setBtnStyle(id,false);
    }
  }

  btnStyleAndValuesReset():void{
    this.isBtnClickEvt = false;
    this.btnClickCnt = 0;
    this.removeBtnStyle(this.selectedElementId);
    this.removeBtnStyle(this.prevSelectedElementId);
    this.selectedElementId = -1;
    this.prevSelectedElementId = -1;
    this.btnClickCnt = 0;
    this.isIconInFocusDueToPriorAction = false;
  }

  removeBtnStyle(id:number):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'transparent';
      btnElement.style.border = 'none'
    }
  }

  setBtnStyle(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      btnElement.style.border = '2px solid hsla(0,0%,50%,25%)'

      if(this.selectedElementId == id){
        (isMouseHover)? btnElement.style.backgroundColor ='#607c9c' : 
          btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      }
    }
  }

  sortIcons(sortBy:string):void {
    if(sortBy === "Size"){
      this.files = this.files.sort((objA, objB) => objB.getSize - objA.getSize);
    }else if(sortBy === "Date Modified"){
      this.files = this.files.sort((objA, objB) => objB.getDateModified.getTime() - objA.getDateModified.getTime());
    }else if(sortBy === "Name"){
      this.files = this.files.sort((objA, objB) => {
        return objA.getFileName < objB.getFileName ? -1 : 1;
      });
    }else if(sortBy === "Item Type"){
      this.files = this.files.sort((objA, objB) => {
        return objA.getFileType < objB.getFileType ? -1 : 1;
      });
    }
  }

  changeIconsSize(iconSize:string):void{
    if(iconSize === 'Large Icons'){
      this.iconSizeStyle = {
        'width': '45px', 
        'height': '45px'
      }
    }

    if(iconSize === 'Medium Icons'){
      this.iconSizeStyle = {
        'width': '35px', 
        'height': '35px'
      }
    }

    if(iconSize === 'Small Icons'){
      this.iconSizeStyle = {
        'width': '30px', 
        'height': '30px'
      }
    }
  }

  toggleDesktopIcons(showIcons:boolean):void{
    this.showDesktopIcon = showIcons;
    if(!this.showDesktopIcon){
      this.btnStyle ={
        'display': 'none',
      }
    }else{
      this.btnStyle ={
        'display': 'block',
      }
    }
  }

  toggleAutoAlignIconsToGrid(alignIcon:boolean):void{
    this.autoAlign = alignIcon;
    if(!this.autoAlign){
      this.gridSize = 0;
    }else{
      this.gridSize = 90;
    }
  }

  toggleAutoArrangeIcons(arrangeIcon:boolean):void{
    this.autoArrange = arrangeIcon;

    if(this.autoArrange){
      // clear (x,y) position of icons in memory
      this.refreshIcons();
    }
  }

  async refreshIcons():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
    await this.loadFilesInfoAsync();
  }

  async onDeleteFile():Promise<void>{
    let result = false;
    if(this.selectedFile.getIsFile){
      result = await this._fileService.deleteFileAsync(this.selectedFile.getCurrentPath);
    }else{
      result = await this._fileService.deleteFolderAsync(this.selectedFile.getCurrentPath)
    }

    if(result){
      await this.loadFilesInfoAsync();
    }
  }

  async createShortCut(): Promise<void>{
    const selectedFile = this.selectedFile;
    const shortCut:FileInfo = new FileInfo();
    let fileContent = '';

    if(selectedFile.getIsFile){
      fileContent = `[InternetShortcut]
FileName=${selectedFile.getFileName} - ${this._consts.SHORTCUT}
IconPath=${selectedFile.getIconPath}
FileType=${selectedFile.getFileType}
ContentPath=${selectedFile.getContentPath}
OpensWith=${selectedFile.getOpensWith}
`;
    }else{
      //
    }

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${this._consts.SHORTCUT}${this._consts.URL}`;
    const result = await this._fileService.writeFileAsync(this.directory, shortCut);
    if(result){
      await this.loadFilesInfoAsync();
    }
  }

  onInputChange(evt:KeyboardEvent):boolean{
    const regexStr = '^[a-zA-Z0-9_.]+$';
    const res = new RegExp(regexStr).test(evt.key)
    if(res){
      this.hideInvalidCharsToolTip();
      return res
    }else{
      this.showInvalidCharsToolTip();

      setTimeout(()=>{ // hide after 6 secs
        this.hideInvalidCharsToolTip();
      },this.SECONDS_DELAY[0]) 

      return res;
    }
  }

  showInvalidCharsToolTip():void{
    // get the position of the textbox
    const toolTipID = 'invalidChars';
    const invalidCharToolTipElement = document.getElementById(toolTipID) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.selectedElementId}`) as HTMLElement;

    const rect = renameContainerElement.getBoundingClientRect();

    if(invalidCharToolTipElement){
      invalidCharToolTipElement.style.transform =`translate(${rect.x + 2}px, ${rect.y + 2}px)`;
      invalidCharToolTipElement.style.zIndex = '3';
      invalidCharToolTipElement.style.opacity = '1';
      invalidCharToolTipElement.style.transition = 'opacity 0.5s ease';
    }
  }

  hideInvalidCharsToolTip():void{
    const toolTipID = 'invalidChars';
    const invalidCharToolTipElement = document.getElementById(toolTipID) as HTMLElement;

    if(invalidCharToolTipElement){
      invalidCharToolTipElement.style.transform =`translate(${-100000}px, ${100000}px)`;
      invalidCharToolTipElement.style.zIndex = '-1';
      invalidCharToolTipElement.style.opacity = '0';
      invalidCharToolTipElement.style.transition = 'opacity 0.5s ease 1';
    }
  }

  isFormDirty():void{
    if (this.renameForm.dirty){
        this.onRenameFileTxtBoxDataSave();
    }else if(!this.renameForm.dirty){
      this.renameFileTriggerCnt ++;
      if(this.renameFileTriggerCnt > 1){
        this.onRenameFileTxtBoxHide();
        this.renameFileTriggerCnt = 0;
      }
    }
  }

  onRenameFileTxtBoxShow():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCap${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.selectedElementId}`) as HTMLElement;
    const renameTxtBoxElement= document.getElementById(`renameTxtBox${this.selectedElementId}`) as HTMLInputElement;
    this.removeBtnStyle(this.selectedElementId);
    
    if(figCapElement){
      figCapElement.style.display = 'none';
    }

    if(renameContainerElement){
      renameContainerElement.style.display = 'block';
      this.currentIconName = this.selectedFile.getFileName;
      this.renameForm.setValue({
        renameInput:this.currentIconName
      })
      renameTxtBoxElement?.focus();
      renameTxtBoxElement?.select();
    }
  }

  async onRenameFileTxtBoxDataSave():Promise<void>{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCap${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.selectedElementId}`) as HTMLElement;
    const renameText = this.renameForm.value.renameInput as string;

    if(renameText !== '' && renameText.length !== 0 && renameText !== this.currentIconName ){
     const result =   await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText, this.selectedFile.getIsFile);

      if(result){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        const fileIdx = this.files.findIndex(f => (f.getCurrentPath == this.selectedFile.getContentPath) && (f.getFileName == this.selectedFile.getFileName));
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now();
        this.files[fileIdx] = this.selectedFile;

        this.renameForm.reset();
        await this.loadFilesInfoAsync();
      }
    }else{
      this.renameForm.reset();
    }

    this.setBtnStyle(this.selectedElementId, false);
    this.renameFileTriggerCnt = 0;
   
    if(figCapElement){
      figCapElement.style.display = 'block';
    }

    if(renameContainerElement){
      renameContainerElement.style.display = 'none';
    }
  }

  onRenameFileTxtBoxHide():void{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement= document.getElementById(`figCap${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.selectedElementId}`) as HTMLElement;

    if(figCapElement){
      figCapElement.style.display = 'block';
    }

    if(renameContainerElement){
      renameContainerElement.style.display = 'none';
    }

    this.isIconInFocusDueToPriorAction = true;
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

}
