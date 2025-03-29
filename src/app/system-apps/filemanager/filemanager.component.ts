import { AfterViewInit, Component, OnInit, ViewChild, ElementRef} from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Process } from 'src/app/system-files/process';
import { FileEntry } from 'src/app/system-files/file.entry';
import { FileInfo } from 'src/app/system-files/file.info';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { FileManagerService } from 'src/app/shared/system-service/file.manager.services';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';
import { GeneralMenu, MenuPositiom } from 'src/app/shared/system-component/menu/menu.types';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { mousePosition } from './filemanager.types';


@Component({
  selector: 'cos-filemanager',
  templateUrl: './filemanager.component.html',
  styleUrls: ['./filemanager.component.css']
})
export class FileManagerComponent implements BaseComponent, OnInit, AfterViewInit {
  @ViewChild('myBounds', {static: true}) myBounds!: ElementRef;
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;
  private _elRef:ElementRef;
  private _directoryFilesEntries!:FileEntry[];
  private _triggerProcessService:TriggerProcessService;
  private _fileManagerService:FileManagerService;
  private _audioService:AudioService;
  private _menuService:MenuService;
  private _systemNotificationServices:SystemNotificationService;
  private _formBuilder:FormBuilder;


  private autoAlign = true;
  private autoArrange = false;
  private currentIconName = '';
  private showDesktopIcon = true;

  private isRenameActive = false;
  private isIconInFocusDueToPriorAction = false;
  private isBtnClickEvt= false;
  private isHideCntxtMenuEvt= false;

  isDraggable = true;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = -1;
  private draggedElementId = -1;
  private prevSelectedElementId = -1; 
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private renameFileTriggerCnt = 0; 

  iconCntxtMenuStyle:Record<string, unknown> = {};
  iconSizeStyle:Record<string, unknown> = {};
  btnStyle:Record<string, unknown> = {};

  showCntxtMenu = false;
  readonly GRID_SIZE = 90; //column size of grid = 90px
  SECONDS_DELAY:number[] = [6000,250];
  renameForm!: FormGroup;

  deskTopClickCounter = 0;

  cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;
  shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;

  multiSelectElmnt!:HTMLDivElement | null;
  multiSelectStartingPosition!:MouseEvent | null;

  markedBtnIds:string[] = [];
  movedBtnIds:string[] = [];
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
  
  fileExplrMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  menuOrder = '';

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'filemanager';
  processId = 0;
  type = ComponentType.System;
  displayName = '';
  directory ='/Users/Desktop';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, fileInfoService:FileService,
              triggerProcessService:TriggerProcessService, fileManagerService:FileManagerService, formBuilder: FormBuilder, 
              menuService:MenuService, elRef: ElementRef, audioService:AudioService, systemNotificationServices:SystemNotificationService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileManagerService = fileManagerService
    this._fileService = fileInfoService;
    this._triggerProcessService = triggerProcessService;
    this._menuService = menuService;
    this._formBuilder = formBuilder;
    this._elRef = elRef;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    this._fileService.dirFilesUpdateNotify.subscribe(() =>{
      if(this._fileService.getEventOriginator() === this.name){
        this.loadFilesInfoAsync();
        this._fileService.removeEventOriginator();
      }
    });

    this._fileManagerService.viewByNotify.subscribe((p) =>{this.changeIconsSize(p)});
    this._fileManagerService.sortByNotify.subscribe((p)=>{this.sortIcons(p)});
    this._fileManagerService.autoArrangeIconsNotify.subscribe((p) =>{this.toggleAutoArrangeIcons(p)});
    this._fileManagerService.alignIconsToGridNotify.subscribe((p) => {this.toggleAutoAlignIconsToGrid(p)});
    this._fileManagerService.refreshNotify.subscribe(()=>{this.refreshIcons()});
    this._fileManagerService.showDesktopIconsNotify.subscribe((p) =>{this.toggleDesktopIcons(p)});
    this._menuService.hideContextMenus.subscribe(() => { this.hideIconContextMenu()});

    // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destoryed
    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {
      this.desktopIsActive()
      setTimeout(() => {
        this.poitionShortCutIconProperly();
      }, 10);
    });
  }

  ngOnInit():void{
    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: '',
    });
  }

  async ngAfterViewInit():Promise<void>{
    await this.loadFilesInfoAsync();
    this.removeVantaJSSideEffect();
    setTimeout(() => this.poitionShortCutIconProperly(), 10);
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  async onDrop(event:DragEvent):Promise<void>{

   //Some about z-index is causing the drop to desktop to act funny.

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


 poitionShortCutIconProperly():void{

  // when i move an icon from it's original position, exclude the icon id 
    for(let i = 0;  i < this.files.length; i++){

      if(!this.movedBtnIds.includes(String(i))){
        const figElmnt = document.getElementById(`filemngr_fig${i}`) as HTMLElement;
        const shortCutElmnt = document.getElementById(`shortCut${i}`) as HTMLImageElement;
  
        if(figElmnt && shortCutElmnt){
          const figElmntRect = figElmnt.getBoundingClientRect();
          shortCutElmnt.style.top = `${figElmntRect.top + 18}px`;
          shortCutElmnt.style.left = `${figElmntRect.left + 20}px`;
        }
      }
    }
 }


  runProcess(file:FileInfo):void{

    console.log('filemanager-runProcess:',file)
    this._audioService.play(this.cheetahNavAudio);
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
    this._audioService.play(this.cheetahNavAudio);
    this.runProcess(this.selectedFile);
  }

  onShowIconContextMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    const menuHeight = 213; //this is not ideal.. menu height should be gotten dynmically
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);
    this._menuService.hideContextMenus.next();

    this.adjustContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file;
    this.showCntxtMenu = !this.showCntxtMenu;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);

    const axis = this.checkAndHandleMenuBounds(evt, menuHeight);
  
    this.iconCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${String(evt.clientX + 2)}px, ${String(axis.yAxis)}px)`,
      'z-index': 4,
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
          this.menuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
          for(const x of this.sourceData) {
            if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Pin to Start'){ /*nothing*/}
            else{
              this.menuData.push(x);
            }
          }
      }else{
        this.menuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
        this.menuData = this.sourceData;
      }
  }

  checkAndHandleMenuBounds(evt:MouseEvent, menuHeight:number):MenuPositiom{
    let yAxis = 0;
    const xAxis = 0;
    const taskBarHeight = 40;

    const mainWindow = document.getElementById('vanta');
    const windowHeight =  mainWindow?.offsetHeight || 0;
    const verticalDiff = windowHeight - evt.clientY;

    let verticalShift = false;
    if((verticalDiff) >= taskBarHeight && (verticalDiff) <= menuHeight){
      const shifMenuUpBy = menuHeight - verticalDiff;
      verticalShift = true;
      yAxis = evt.clientY - shifMenuUpBy - taskBarHeight;
    }
    
    if(!verticalShift){
      if(verticalDiff >= 215 && verticalDiff <= 230){
        yAxis = evt.clientY - 35;
      }else  if(verticalDiff >= 231 && verticalDiff <= 246){
        yAxis = evt.clientY - 17.5;
      }else{
        yAxis = evt.clientY;
      }
    }

    return {xAxis, yAxis};
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

  onMouseEnter(id:number):void{
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;

      if(this.markedBtnIds.includes(String(id))){
        this.setMultiSelectStyleOnBtn(id, true);
      } else{
        this.setBtnStyle(id, true);
      }
    }
  }

  onMouseLeave(id:number):void{
    this.isMultiSelectEnabled = true;

    if(!this.isMultiSelectActive){
      if(id != this.selectedElementId){
        if(this.markedBtnIds.includes(String(id))){
          this.setMultiSelectStyleOnBtn(id, false);
        } else{
          this.removeBtnStyle(id);
        }
      }
      else if((id == this.selectedElementId) && !this.isIconInFocusDueToPriorAction){
        this.setBtnStyle(id,false);
      }
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
      btnElement.style.borderColor = 'transparent'
    }
  }

  setBtnStyle(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';

      if(this.selectedElementId == id){
        (isMouseHover)? btnElement.style.backgroundColor ='#607c9c' : 
          btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      }

      if(!isMouseHover && this.isIconInFocusDueToPriorAction){
        btnElement.style.backgroundColor = 'transparent';
        btnElement.style.border = '2px solid white'
      }
    }
  }

  setMultiSelectStyleOnBtn(id:number,  isMouseHover:boolean):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    if(btnElement){
      if(!isMouseHover){
        btnElement.style.backgroundColor = 'rgba(0, 150, 255, 0.3)';
        btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';
      }else{
        btnElement.style.backgroundColor = '#607c9c';
        btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';
      }
    }
  }

  getCountOfAllTheMarkedButtons():number{
    const btnIcons = document.querySelectorAll('.filemngr-multi-select-highlight');
    return btnIcons.length;
  }
 
  getIDsOfAllTheMarkedButtons():void{
   const btnIcons = document.querySelectorAll('.filemngr-multi-select-highlight');
   btnIcons.forEach(btnIcon => {
     const btnId = btnIcon.id.replace('iconBtn', Constants.EMPTY_STRING);
     if(!this.markedBtnIds.includes(btnId))
       this.markedBtnIds.push(btnId);
   });
   console.log('this.markedBtnIds:', this.markedBtnIds);
  }
 
  removeTransparentStyle(elmntId:string):void{
   const btnIconsElmnt = document.getElementById(elmntId) as HTMLButtonElement;
   if(btnIconsElmnt){
     btnIconsElmnt.style.backgroundColor = '';
     btnIconsElmnt.style.borderColor = '';
   }
  }
 
  removeClassAndStyleFromBtn():void{
   this.markedBtnIds.forEach(id =>{
     const btnIcon = document.getElementById(`iconBtn${id}`);
     if(btnIcon){
       btnIcon.classList.remove('filemngr-multi-select-highlight');
     }
     this.removeBtnStyle(Number(id));
   })
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
      console.log('turn off - areMultipleIconsHighlighted')
      this.areMultipleIconsHighlighted = false;
    }else{
      this.hideCntxtMenuEvtCnt++;
      this.isHideCntxtMenuEvt = true;
      //Second case - I was only clicking on the desktop
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= 1) && (!this.isBtnClickEvt && this.btnClickCnt == 0)){
        this.deskTopClickCounter++;
        this.btnStyleAndValuesReset();

        //reset after clicking on the desktop 2wice
        if(this.deskTopClickCounter >= 2){
          console.log('turn off - areMultipleIconsHighlighted-1')
          this.areMultipleIconsHighlighted = false;
          this.removeClassAndStyleFromBtn();
          this.deskTopClickCounter = 0;
          this.markedBtnIds = [];
        }
      }
      //Third case - I was clicking on the desktop icons, then i click on the desktop.
      //clicking on the desktop triggers a hideContextMenuEvt
      if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt > 1))
        this.btnStyleAndValuesReset();
    }
  }

  activateMultiSelect(evt:MouseEvent):void{
    if(this.isMultiSelectEnabled){    
      this.isMultiSelectActive = true;
      this.multiSelectElmnt = document.getElementById('dskTopMultiSelectPane') as HTMLDivElement;
      this.multiSelectStartingPosition = evt;
    }
  }

  deActivateMultiSelect():void{ 
    if(this.multiSelectElmnt){
      this.setDivWithAndSize(this.multiSelectElmnt, 0, 0, 0, 0, false);
    }

    this.multiSelectElmnt = null;
    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    const markedBtnCount = this.getCountOfAllTheMarkedButtons();
    if(markedBtnCount === 0)
      this.areMultipleIconsHighlighted = false;
    else{
      this.areMultipleIconsHighlighted = true;
      this.getIDsOfAllTheMarkedButtons();
    }
  }

  updateDivWithAndSize(evt:any):void{
    if(this.multiSelectStartingPosition && this.multiSelectElmnt){
      const startingXPoint = this.multiSelectStartingPosition.clientX;
      const startingYPoint = this.multiSelectStartingPosition.clientY;

      const currentXPoint = evt.clientX;
      const currentYPoint = evt.clientY;

      const startX = Math.min(startingXPoint, currentXPoint);
      const startY = Math.min(startingYPoint, currentYPoint);
      const divWidth = Math.abs(startingXPoint - currentXPoint);
      const divHeight = Math.abs(startingYPoint - currentYPoint);

      this.setDivWithAndSize(this.multiSelectElmnt, startX, startY, divWidth, divHeight, true);

      // Call function to check and highlight selected items
      this.highlightSelectedItems(startX, startY, divWidth, divHeight);
    }
  }

  setDivWithAndSize(divElmnt:HTMLDivElement, initX:number, initY:number, width:number, height:number, isShow:boolean):void{

    divElmnt.style.position = 'absolute';
    divElmnt.style.transform =  `translate(${initX}px , ${initY}px)`;
    divElmnt.style.height =  `${height}px`;
    divElmnt.style.width =  `${width}px`;

    divElmnt.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    divElmnt.style.backdropFilter = 'blur(5px)';
    if(isShow){
      divElmnt.style.zIndex = '2';
      divElmnt.style.display =  'block';
    }else{
      divElmnt.style.zIndex = '0';
      divElmnt.style.display =  'none';
    }
  }

  highlightSelectedItems(initX: number, initY: number, width: number, height: number): void {
    const selectionRect = {
        left: initX,
        top: initY,
        right: initX + width,
        bottom: initY + height
    };

    const btnIcons = document.querySelectorAll('.filemngr_btn');
    btnIcons.forEach((btnIcon) => {
        const btnIconRect = btnIcon.getBoundingClientRect();

        // Check if the item is inside the selection area
        if ( btnIconRect.right > selectionRect.left && btnIconRect.left < selectionRect.right &&
            btnIconRect.bottom > selectionRect.top && btnIconRect.top < selectionRect.bottom){
            btnIcon.classList.add('filemngr-multi-select-highlight'); 
        } else {
            btnIcon.classList.remove('filemngr-multi-select-highlight');
            this.removeTransparentStyle(btnIcon.id);
        }
    });
 }


  onDragEnd(evt:DragEvent):void{
    console.log('event type:',evt.type);
    console.log('onDragEnd evt:',evt);

    // Get the cloneIcon container
    const elementId = 'filemngr_clone_cntnr';
    const mPos:mousePosition = {
      clientX: evt.clientX,
      clientY: evt.clientY,
      offsetX: evt.offsetX,
      offsetY: evt.offsetY,
      x: evt.x,
      y: evt.y,
    }

    if(this.autoAlign && this.markedBtnIds.length >= 0){
      this.moveBtnIconsToNewPositionAlignOn(mPos);
    }else if (!this.autoAlign && this.markedBtnIds.length >= 0){
      this.moveBtnIconsToNewPositionAlignOff(mPos);
    }
   
    this.poitionShortCutIconProperly();

    const cloneIcon = document.getElementById(elementId);
    if(cloneIcon) 
      cloneIcon.innerHTML = '';
    
  }

  onDragStart(evt:DragEvent, i: number): void {
 
    // Get the cloneIcon container
    const elementId = 'filemngr_clone_cntnr';
    const cloneIcon = document.getElementById(elementId);
    const countOfMarkedBtns = this.getCountOfAllTheMarkedButtons();
    let counter = 0;

    if(cloneIcon){
      //Clear any previous content in the clone container
      cloneIcon.innerHTML = Constants.EMPTY_STRING;
      if(countOfMarkedBtns <= 1){
        this.draggedElementId = i;
        const srcIconElmnt = document.getElementById(`iconBtn${i}`) as HTMLElement;
        const srcShortCutElmnt = document.getElementById(`shortCut${i}`) as HTMLImageElement;

        const tmpTop = srcShortCutElmnt.style.top;
        const tmpLeft = srcShortCutElmnt.style.left;

        srcShortCutElmnt.style.top = '22px'; 
        srcShortCutElmnt.style.left = '24px';
        const clonedShortcut = srcShortCutElmnt.cloneNode(true);
        
        cloneIcon.appendChild(srcIconElmnt.cloneNode(true));
        cloneIcon.appendChild(clonedShortcut);

        //restore old positions
        srcShortCutElmnt.style.top = tmpTop;
        srcShortCutElmnt.style.left = tmpLeft;
        
         // Move it out of view initially
        cloneIcon.style.left = '-9999px';  
        cloneIcon.style.opacity = '0.2';
    
        // Set the cloned icon as the drag image
        if (evt.dataTransfer) {
          evt.dataTransfer.setDragImage(cloneIcon, 0, 0);  // Offset positions for the drag image
        }
      }else{
        this.markedBtnIds.forEach(id =>{
          const srcIconElmnt = document.getElementById(`iconBtn${id}`) as HTMLElement;
          const srcShortCutElmnt = document.getElementById(`shortCut${id}`) as HTMLImageElement;

          const tmpTop = srcShortCutElmnt.style.top;
          const tmpLeft = srcShortCutElmnt.style.left;
  
          if(counter === 0)
            srcShortCutElmnt.style.top = '22px'; 
          else{
            const product = (this.GRID_SIZE * counter);
            srcShortCutElmnt.style.top = `${22 + product}px`; 
          }
          srcShortCutElmnt.style.left = '24px';
          const clonedShortcut = srcShortCutElmnt.cloneNode(true);

          const spaceDiv = document.createElement('div');
          // Add create an empty div that will be used for spacing between each cloned icon
          spaceDiv.setAttribute('id', `spacediv${id}`);
          spaceDiv.style.transform =  'translate(0, 0)';
          spaceDiv.style.width =  'fit-content';
          spaceDiv.style.height =  '20px';

          cloneIcon.appendChild(srcIconElmnt.cloneNode(true));
          cloneIcon.appendChild(clonedShortcut);
          if(counter !== countOfMarkedBtns - 1)
            cloneIcon.appendChild(spaceDiv);

          //restore old positions
          srcShortCutElmnt.style.top = tmpTop;
          srcShortCutElmnt.style.left = tmpLeft;
          counter++;
        });

        cloneIcon.style.left = '-9999px';  // Move it out of view initially
        cloneIcon.style.opacity = '0.2';

        // Set the cloned icon as the drag image
        if (evt.dataTransfer) {
          evt.dataTransfer.setDragImage(cloneIcon, 0, 0);  // Offset positions for the drag image
        }
      }
    }
  }

  moveBtnIconsToNewPositionAlignOff(mPos:mousePosition):void{
    let counter = 0;
    let justAdded = false;

    if(this.markedBtnIds.length === 0){
      justAdded = true;
      this.markedBtnIds.push(String(this.draggedElementId));
    }

    this.markedBtnIds.forEach(id =>{
      const btnIcon = document.getElementById(`filemngr_li${id}`);
      const btnIconElmnt = document.getElementById(`filemngr_li${id}`) as HTMLElement;
      const srcShortCutElmnt = document.getElementById(`shortCut${id}`) as HTMLImageElement;
      this.movedBtnIds.push(id);
      if(btnIcon){
        const btnIconRect = btnIcon.getBoundingClientRect();
        const xDiff = mPos.x - btnIconRect.left;
        const newX = btnIconRect.left + xDiff;

        let newY = 0;
        if(counter === 0)
            newY = mPos.y;
        else{
          const yDiff = btnIconRect.top - mPos.y;
          const product = (this.GRID_SIZE * counter);
          newY = btnIconRect.top - yDiff + product;
        }

        srcShortCutElmnt.style.position = 'absolute';
        srcShortCutElmnt.style.top = `${22}px`; 
        srcShortCutElmnt.style.left = `${24}px`;

        btnIconElmnt.style.position = 'absolute';
        btnIconElmnt.style.transform = `translate(${Math.abs(newX)}px, ${Math.abs(newY)}px)`;
      }
      counter++;
    });

    if(justAdded){
      this.markedBtnIds.pop();
    }
  }

  moveBtnIconsToNewPositionAlignOn(mPos: mousePosition): void {
    const fileMngrOlElmnt = document.getElementById('filemngr_ol') as HTMLElement;
    const maxIconWidth = this.GRID_SIZE;
    const maxIconHeight = this.GRID_SIZE;
    const offset = 7;
    
    if (!fileMngrOlElmnt) return;
  
    const gridWidth = fileMngrOlElmnt.clientWidth; // Get total width of the container
    const columnCount = Math.floor(gridWidth / maxIconWidth); // Assuming each icon is 100px wide
    const columnWidth = Math.floor(gridWidth / columnCount) - 1; // Compute exact column width

    let counter = 0;
    let justAdded = false;
    let newY = 0;

    if(this.markedBtnIds.length === 0){
      justAdded = true;
      this.markedBtnIds.push(String(this.draggedElementId));
    }

    this.markedBtnIds.forEach(id =>{
      const btnIconElmnt = document.getElementById(`filemngr_li${id}`) as HTMLElement;
      const srcShortCutElmnt = document.getElementById(`shortCut${id}`) as HTMLImageElement;
      this.movedBtnIds.push(id);

      if(btnIconElmnt){
        // Calculate snap position
        const newX = (Math.round(mPos.x / columnWidth) * columnWidth);
        if(counter === 0)
            newY = (Math.round(mPos.y / maxIconHeight) * maxIconHeight) + offset;
        else{
          const product = (this.GRID_SIZE * counter);
          newY =(Math.round(mPos.y / maxIconHeight) * maxIconHeight) + product + offset;
        }
  
        srcShortCutElmnt.style.position = 'absolute';
        srcShortCutElmnt.style.top = `${22}px`; 
        srcShortCutElmnt.style.left = `${24}px`;

        btnIconElmnt.style.position = 'absolute';
        btnIconElmnt.style.transform = `translate(${Math.abs(newX)}px, ${Math.abs(newY)}px)`;
      }

      counter++;
    });

    if(justAdded) 
      this.markedBtnIds.pop(); 
  }

  correctMisalignedIcons(): void {
    const columnWidth = this.GRID_SIZE;
    const rowHeight = this.GRID_SIZE;
    const offset = 7;

    this.movedBtnIds.forEach((id) => {
      const btnIcon = document.getElementById(`filemngr_li${id}`);

      if(btnIcon){
        const rect = btnIcon.getBoundingClientRect();
        //console.log('correctMisalignedIcons:',rect);

        const correctedX = Math.round(rect.left / columnWidth) * columnWidth;
        const correctedY = (Math.round(rect.top / rowHeight) * rowHeight) + offset;
        //console.log(`New Position ->: X:${correctedX}, Y:${correctedY}`);

        // Apply the transformation
        const btnIconElmnt = btnIcon as HTMLElement
        if(btnIconElmnt){
          //btnIconElmnt.style.position = 'absolute';
          btnIconElmnt.style.transform = `translate(${correctedX}px, ${correctedY}px)`;
        }
      }
    });
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
    console.log('toggleAutoAlignIconsToGrid:',alignIcon);
    this.autoAlign = alignIcon;
    if(this.autoAlign){
      this.correctMisalignedIcons();
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
FileName=${selectedFile.getFileName} - ${Constants.SHORTCUT}
IconPath=${selectedFile.getIconPath}
FileType=${selectedFile.getFileType}
ContentPath=${selectedFile.getContentPath}
OpensWith=${selectedFile.getOpensWith}
`;
    }else{
      //
    }

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${Constants.SHORTCUT}${Constants.URL}`;
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

  lockScreenIsActive():void{
    this.toggleDesktopIcons(false);
  }

  desktopIsActive():void{
    this.toggleDesktopIcons(true);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }

}
