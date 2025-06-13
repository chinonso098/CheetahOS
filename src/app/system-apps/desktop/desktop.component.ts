import { AfterViewInit, OnInit,OnDestroy, Component, ElementRef, ViewChild} from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { BIRDS, GLOBE, HALO, RINGS, WAVE } from './vanta-object/vanta.interfaces';
import { IconsSizes, SortBys } from './desktop.enums';
import { Colors } from './colorutil/colors';
import { FileInfo } from 'src/app/system-files/file.info';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { GeneralMenu, MenuPositiom, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.types';
import * as htmlToImage from 'html-to-image';
import { FileService } from 'src/app/shared/system-service/file.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { TaskBarIconInfo } from '../taskbarentries/taskbar.entries.type';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FileEntry } from 'src/app/system-files/file.entry';
import { mousePosition } from './desktop.types';

declare let VANTA: { HALO: any; BIRDS: any;  WAVES: any;   GLOBE: any;  RINGS: any;};

@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css'],
  animations: [
    trigger('slideStatusAnimation', [
      state('slideOut', style({ right: '-400px' })),
      state('slideIn', style({ right: '0px' })),

      transition('* => slideIn', [
        animate('150ms ease-in')
      ]),
      transition('slideIn => slideOut', [
        animate('2s ease-out')
      ]),
    ]),

    trigger('slideStartMenuAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(200%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0%)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 })),
      ]),
    ])
  ]
})

export class DesktopComponent implements OnInit, OnDestroy, AfterViewInit{

  @ViewChild('desktopContainer', {static: true}) desktopContainer!: ElementRef; 
  
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;
  private _elRef:ElementRef;
  private _directoryFilesEntries!:FileEntry[];
  private _processHandlerService:ProcessHandlerService;

  private _audioService:AudioService;
  private _menuService:MenuService;
  private _systemNotificationServices:SystemNotificationService;
  private _formBuilder:FormBuilder;
  private _scriptService: ScriptService;
  private _windowService:WindowService;


  private _vantaEffect: any;
  private _numSequence = Constants.NUM_ZERO;
  private _charSequence = 'a';
  private _charSequenceCount = Constants.NUM_ZERO;

  readonly largeIcons = IconsSizes.LARGE_ICONS;
  readonly mediumIcons = IconsSizes.MEDIUM_ICONS;
  readonly smallIcons = IconsSizes.SMALL_ICONS

  isLargeIcon = true;
  isMediumIcon = false;
  isSmallIcon = false;

  readonly sortByName = SortBys.NAME;
  readonly sortByItemType = SortBys.ITEM_TYPE;
  readonly sortBySize = SortBys.SIZE;
  readonly sortByDateModified = SortBys.DATE_MODIFIED;

  isSortByName = false;
  isSortByItemType = false;
  isSortBySize = false;
  isSortByDateModified = false;
  isShiftSubMenuLeft = false;
  isTaskBarHidden = false
  isTaskBarTemporarilyVisible = false

  autoAlignIcons = true;
  autoArrangeIcons = true;
  showDesktopIcons = true;
  showDesktopScreenShotPreview = false;
  showStartMenu = false;
  showVolumeControl = false;
  showDesktopIconCntxtMenu = false;
  showClippy = true;
  dsktpPrevImg = Constants.EMPTY_STRING;
  slideState = 'slideOut'

  dskTopCntxtMenuStyle:Record<string, unknown> = {};
  tskBarAppIconMenuStyle:Record<string, unknown> = {};
  tskBarCntxtMenuStyle:Record<string, unknown> = {};
  tskBarPrevWindowStyle:Record<string, unknown> = {};
  deskTopMenuOption =  Constants.NESTED_MENU_OPTION;
  showDesktopCntxtMenu = false;
  showTskBarAppIconMenu = false;
  showTskBarCntxtMenu = false;
  showTskBarPreviewWindow = false;
  tskBarPreviewWindowState = 'in';
  tskBarAppIconMenuOption =  Constants.TASK_BAR_APP_ICON_MENU_OPTION;
  tskBarContextMenuOption = Constants.TASK_BAR_CONTEXT_MENU_OPTION
  menuOrder = Constants.DEFAULT_MENU_ORDER;
  selectedTaskBarFile!:FileInfo;
  appToPreview = Constants.EMPTY_STRING;
  appToPreviewIcon = Constants.EMPTY_STRING;
  previousDisplayedTaskbarPreview = Constants.EMPTY_STRING;
  removeTskBarPrevWindowFromDOMTimeoutId!: NodeJS.Timeout;
  hideTskBarPrevWindowTimeoutId!: NodeJS.Timeout;
  clippyIntervalId!: NodeJS.Timeout;
  colorChgIntervalId!: NodeJS.Timeout;

  private readonly DESKTOP_DIRECTORY ='/Users/Desktop';
  private readonly DESKTOP_SCREEN_SHOT_DIRECTORY ='/Users/Documents/Screen-Shots';
  private readonly TERMINAL_APP ="terminal";
  private readonly TEXT_EDITOR_APP ="texteditor";
  private readonly CODE_EDITOR_APP ="codeeditor";
  private readonly MARKDOWN_VIEWER_APP ="markdownviewer";
  private readonly TASK_MANAGER_APP ="taskmanager";

  waveBkgrnd:WAVE =  {el:'#vanta'}
  ringsBkgrnd:RINGS =  {el:'#vanta'}
  haloBkgrnd:HALO =  {el:'#vanta'}
  globeBkgrnd:GLOBE =  {el:'#vanta'}
  birdBkgrnd:BIRDS =  {el:'#vanta'}

  VANTAS:any = [this.waveBkgrnd, this.ringsBkgrnd,this.haloBkgrnd, this.globeBkgrnd, this.birdBkgrnd ];
  private readonly MIN_NUMS_OF_DESKTOPS = Constants.NUM_ZERO;
  private readonly MAX_NUMS_OF_DESKTOPS = this.VANTAS.length - Constants.NUM_ONE;
  private readonly CLIPPY_INIT_DELAY = 300000; // 5mins
  private readonly COLOR_CHANGE_DELAY = 60000; // 1min
  private readonly COLOR_TRANSITION_DURATION = 2000; // 2sec
  private readonly MIN_NUM_COLOR_RANGE = 200;
  private readonly MAX_NUM_COLOR_RANGE = 99999;
  private readonly DEFAULT_COLOR = 0x274c;

  private currentDesktopNum = Constants.NUM_ZERO;

  readonly cheetahDsktpIconSortKey = 'cheetahDsktpIconSortKey';
  readonly cheetahDsktpIconSizeKey = 'cheetahDsktpIconSizeKey';
  readonly cheetahDsktpHideTaskBarKey = 'cheetahDsktpHideTaskBarKey';


  deskTopMenu:NestedMenu[] = [];
  taskBarContextMenuData:GeneralMenu[] = [];
  taskBarAppIconMenuData:GeneralMenu[] = [
    {icon:'', label: '', action: this.openApplicationFromTaskBar.bind(this)},
    {icon:'', label: '', action: ()=> console.log() },
  ];

  private isRenameActive = false;
  private isIconInFocusDueToPriorAction = false;
  private isBtnClickEvt= false;
  private isHideCntxtMenuEvt= false;

  isWindowDragActive = false;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;
  isRestored = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo
  private selectedElementId = Constants.MINUS_ONE;
  private draggedElementId = Constants.MINUS_ONE;
  private prevSelectedElementId = Constants.MINUS_ONE; 
  private hideCntxtMenuEvtCnt = Constants.NUM_ZERO;
  private btnClickCnt = Constants.NUM_ZERO;
  private renameFileTriggerCnt = Constants.NUM_ZERO; 
  private currentIconName = Constants.EMPTY_STRING;

  iconCntxtMenuStyle:Record<string, unknown> = {};
  iconSizeStyle:Record<string, unknown> = {};
  btnStyle:Record<string, unknown> = {};

  readonly GRID_SIZE = 90; //column size of grid = 90px
  SECONDS_DELAY:number[] = [6000, 250, 4000];
  renameForm!: FormGroup;

  deskTopClickCounter = Constants.NUM_ZERO;

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
  
  dsktpMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'desktop';
  processId = Constants.NUM_ZERO;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  directory ='/Users/Desktop';


  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService, 
              scriptService: ScriptService, audioService: AudioService, menuService: MenuService, 
              fileService:FileService, windowService:WindowService, systemNotificationServices:SystemNotificationService,
              formBuilder: FormBuilder, elRef: ElementRef ) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
  
    this._processHandlerService = triggerProcessService;
    this._scriptService = scriptService;
    this._menuService = menuService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;
    this._formBuilder = formBuilder;
    this._elRef = elRef;

    // these are subs, but the desktop cmpnt is not going to be destoryed
    this._menuService.showTaskBarAppIconMenu.subscribe((p) => { this.onShowTaskBarAppIconMenu(p)});
    this._menuService.showTaskBarConextMenu.subscribe((p) => { this.onShowTaskBarContextMenu(p)});
    this._windowService.showProcessPreviewWindowNotify.subscribe((p) => { this.showTaskBarPreviewWindow(p)});
    this._menuService.hideContextMenus.subscribe(() => { this.hideDesktopContextMenuAndOthers()});
    this._windowService.hideProcessPreviewWindowNotify.subscribe(() => { this.hideTaskBarPreviewWindow()});
    this._windowService.keepProcessPreviewWindowNotify.subscribe(() => { this.keepTaskBarPreviewWindow()});
    this._windowService.windowDragIsActive.subscribe(() => {this.isWindowDragActive = true;});
    this._windowService.windowDragIsInActive.subscribe(() => {this.isWindowDragActive = false;});
    this._menuService.showStartMenu.subscribe(() => { this.showTheStartMenu()});
    this._menuService.hideStartMenu.subscribe(() => { this.hideTheStartMenu()});
    this._audioService.hideShowVolumeControlNotify.subscribe(() => { this.hideShowVolumeControl()});

    // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destroyed
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {
      this.desktopIsActive();
      setTimeout(() => {
        this.poitionShortCutIconProperly();
      }, 10);
    })
    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {
      this.lockScreenIsActive();
    });

    this._menuService.updateTaskBarContextMenu.subscribe(()=>{this.resetMenuOption()});

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._numSequence = this.getRandomInt(this.MIN_NUM_COLOR_RANGE, this.MAX_NUM_COLOR_RANGE);
  }

  ngOnInit():void{
    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: '',
    });

    this._scriptService.loadScript("vanta-waves","osdrive/Program-Files/Backgrounds/vanta.waves.min.js").then(() =>{
      this._vantaEffect = VANTA.WAVES({
        el: '#vanta',
        color:this.DEFAULT_COLOR, 
        waveHeight:20,
        shininess:45,
        waveSpeed:0.20,
        zoom:0.9,     
      });
    })
    
    this.getDesktopMenuData();
    this.getTaskBarContextData();
  }

  ngOnDestroy(): void {
    this._vantaEffect?.destroy();
  }

  async ngAfterViewInit():Promise<void>{
    this.startVantaWaveColorChange();
    this.hideDesktopContextMenuAndOthers();
    this.initClippy();

    await this.loadFilesInfoAsync();
    this.removeVantaJSSideEffect();
    setTimeout(() => this.poitionShortCutIconProperly(), 10);
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

 /** Generates the next color dynamically */
  getNextColor(): number {
    const charSet = ['a', 'b', 'c', 'd', 'e', 'f'];
    if (this._numSequence < this.MAX_NUM_COLOR_RANGE) {
      this._numSequence++;
    } else {
      this._numSequence = this.MIN_NUM_COLOR_RANGE;
      this._charSequenceCount = (this._charSequenceCount + 1) % charSet.length;
      this._charSequence = charSet[this._charSequenceCount];
    }

    return Number(`0x${this._numSequence}${this._charSequence}`);
  }

  /** Smoothly transitions to the next color */
  private transitionToNextColor(): void {
    const startColor = this._vantaEffect.options.color;
    const endColor = this.getNextColor();
    const startTime = performance.now();

    //Vanta wave
    if(this.currentDesktopNum === 0){
      const animateColorTransition = (time: number) => {
        const progress = Math.min((time - startTime) / this.COLOR_TRANSITION_DURATION, 1);
        const interpolatedColor = Colors.interpolateHexColor(startColor, endColor, progress);
        this._vantaEffect.setOptions({ color: interpolatedColor });
  
        if (progress < Constants.NUM_ONE) {
          requestAnimationFrame(animateColorTransition);
        }
      };
      requestAnimationFrame(animateColorTransition);
    }
  }

  initClippy():void{
    if(this.showClippy){
      this.clippyIntervalId = setInterval(() =>{
        const appName = 'clippy';
        this.openApplication(appName);
      },this.CLIPPY_INIT_DELAY);
    }
  }

  stopClippy():void{
    this.showClippy = false;
    const appName = 'clippy';
    clearInterval(this.clippyIntervalId);

    //check if clippy is running, and end it
    const clippy = this._runningProcessService.getProcessByName(appName);
    if(clippy)
      this._runningProcessService.closeProcessNotify.next(clippy)
  }

  startClippy():void{
    this.showClippy = true;
    this.initClippy();
  }

  getRandomInt(min:number, max:number):number{
    return Math.floor(Math.random() * (max - min) + min);
  }

  showDesktopContextMenu(evt:MouseEvent):void{
    /**
     * There is a doubling of responses to certain events that exist on the 
     * desktop compoonent and any other component running at the time the event was triggered.
     * The desktop will always respond to the event, but other components will only respond when they are in focus.
     * If there is a count of 2 or more(highly unlikely) reponses for a given event, then, ignore the desktop's response
     */

    console.log('showDesktopContextMenu:',evt);
    const evtOriginator = this._runningProcessService.getEventOrginator();
    console.log('evtOriginator:',evtOriginator);
   
    if(evtOriginator === Constants.EMPTY_STRING){
      const menuHeight = 306; //this is not ideal.. menu height should be gotten dynmically
      const menuWidth = 210;
  
      this._menuService.hideContextMenus.next();
      this.showDesktopCntxtMenu = true;
      const axis = this.checkAndHandleMenuBounds(evt, menuHeight, menuWidth);

      this.dskTopCntxtMenuStyle = {
        'position':'absolute',
        'width': '210px', 
        'transform':`translate(${String(axis.xAxis + Constants.NUM_TWO)}px, ${String(axis.yAxis)}px)`,
        'z-index': Constants.NUM_FOUR,
        'opacity': Constants.NUM_ONE
      }
      evt.preventDefault();
    }
    else{
      this._runningProcessService.removeEventOriginator();
    }

    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
  }

  shiftViewSubMenu():void{ this.shiftNestedMenuPosition(0); }

  shiftSortBySubMenu():void{this.shiftNestedMenuPosition(1);  }

  shiftNewSubMenu():void { this.shiftNestedMenuPosition(8); }

  shiftNestedMenuPosition(i:number):void{
    const nestedMenu =  document.getElementById(`dmNestedMenu-${i}`) as HTMLDivElement;
    if(nestedMenu){
      if(this.isShiftSubMenuLeft){
        nestedMenu.style.left = '-98%';
      }
      else{
        nestedMenu.style.left = '98%';
      }
    }
  }

  checkAndHandleMenuBounds(evt:MouseEvent, menuHeightInput:number, menuWidthInput:number):MenuPositiom{

    let xAxis = Constants.NUM_ZERO;
    let yAxis = Constants.NUM_ZERO;
    const menuWidth = menuWidthInput;
    const menuHeight = menuHeightInput;
    const subMenuWidth = 205;
    const taskBarHeight = 40;

    const mainWindow = document.getElementById('vanta');
    const windowWidth =  mainWindow?.offsetWidth || Constants.NUM_ZERO;
    const windowHeight =  mainWindow?.offsetHeight || Constants.NUM_ZERO;

    const horizontalDiff =  windowWidth - evt.clientX;
    const verticalDiff = windowHeight - evt.clientY;

    let horizontalShift = false;
    let verticalShift = false;

    if((horizontalDiff) < menuWidth){
      horizontalShift = true;
      const diff = menuWidth - horizontalDiff;
      xAxis = evt.clientX - diff;
    }

    if((horizontalDiff) < (menuWidth + subMenuWidth)){
      this.isShiftSubMenuLeft = true;
    }

    if((verticalDiff) >= taskBarHeight && (verticalDiff) <= menuHeight){
      const shifMenuUpBy = menuHeight - verticalDiff;
      verticalShift = true;
      yAxis = evt.clientY - shifMenuUpBy - taskBarHeight;
    }
    
    xAxis = (horizontalShift)? xAxis : evt.clientX;
    yAxis = (verticalShift)? yAxis : evt.clientY;
 
    return {xAxis, yAxis};
  }

  showTheStartMenu():void{
    // I'm not sure why the delay is needed for the start menu to be displayed
    const Delay = 40;
    setTimeout(()=>{
      this.showStartMenu = true;
    },Delay)
  }

  hideTheStartMenu():void{
    this.showStartMenu = false;
  }

  captureComponentImg():void{
    const slideOutDelay = 4000;
    const hideDeskopScreenShotDelay = 6000;

    htmlToImage.toPng(this.desktopContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const screenShot:FileInfo = new FileInfo();
      screenShot.setFileName = 'screen_shot.png'
      screenShot.setCurrentPath = `${this.DESKTOP_SCREEN_SHOT_DIRECTORY}/screen_shot.png`;
      screenShot.setContentPath = htmlImg;
      screenShot.setIconPath = htmlImg;

      this.showDesktopScreenShotPreview = true;
      this.slideState = 'slideIn';
      this.dsktpPrevImg = htmlImg;

      // const img = new Image();
      // img.src = htmlImg;
      // document.body.appendChild(img);

      setTimeout(()=>{
        this.slideState = 'slideOut';
        this._fileService.writeFileAsync(this.DESKTOP_SCREEN_SHOT_DIRECTORY, screenShot);
        this._fileService.addEventOriginator('fileexplorer');
        this._fileService.dirFilesUpdateNotify.next();
      },slideOutDelay);

      setTimeout(()=>{
        this.showDesktopScreenShotPreview = false;
      },hideDeskopScreenShotDelay);
    })
  }

  async createFolder():Promise<void>{
    const folderName = Constants.NEW_FOLDER;
    const result =  await this._fileService.createFolderAsync(this.DESKTOP_DIRECTORY, folderName);
    if(result){
      // this._fileService.addEventOriginator('desktop');
      // this._fileService.dirFilesUpdateNotify.next();
      this.refresh();
    }
  }

  hideDesktopContextMenuAndOthers(caller?:string):void{

    /**
     * There is a doubling of responses to certain events that exist on the 
     * desktop compoonent and any other component running at the time the event was triggered.
     * The desktop will always respond to the event, but other components will only respond when they are in focus.
     * If there is a count of 2 or more(highly unlikely) reponses for a given event, then, ignore the desktop's response
     */

    this.showDesktopCntxtMenu = false;
    this.showDesktopIconCntxtMenu = false;
    this.showTskBarAppIconMenu = false;
    this.showTskBarCntxtMenu = false;
    this.isShiftSubMenuLeft = false;

    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this._menuService.hideContextMenus.next();
    }

    //only if start menu is visible
    if(this.showStartMenu){
      this.showStartMenu = false;

      const uid = `${this.name}-${this.processId}`;
      this._runningProcessService.addEventOriginator(uid);

      this._menuService.hideStartMenu.next();
    }

    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
  }

  performTasks(evt:MouseEvent):void{
    this.resetLockScreenTimeOut();

    if(this.isTaskBarHidden){
      this.showTaskBarTemporarily(evt);
    }
  }

  resetLockScreenTimeOut():void{
    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
  }

  showTaskBarTemporarily(evt:MouseEvent):void{
    const mainWindow = document.getElementById('vanta');
    if(mainWindow){
      const maxHeight = mainWindow.offsetHeight;
      const clientY = evt.clientY;
      const diff = (maxHeight - clientY);
      if(!this.isTaskBarTemporarilyVisible){
        if(diff <= 5){
          this.isTaskBarTemporarilyVisible = true;
          this._systemNotificationServices.showTaskBarNotify.next();
          this.showTaskBarTemporarilyHelper();
        }
      }else if(this.isTaskBarTemporarilyVisible){
        if(diff <= 40){
          this.isTaskBarTemporarilyVisible = true;
        }else{
          this.isTaskBarTemporarilyVisible = false;
          this._systemNotificationServices.hideTaskBarNotify.next();
        }
      }
    }
  }

  // if mouse remains withing 40px of the bottom, keep showing the taksbar
  showTaskBarTemporarilyHelper():void{
    const delay = 10; //10ms
    const intervalId = setInterval(() => {
      if (!this.isTaskBarTemporarilyVisible) {
        clearInterval(intervalId);
      }
    }, delay);
  }

  hideShowVolumeControl():void{
    this.showVolumeControl = !this.showVolumeControl;
  }

  hideVolumeControl():void{
    this.showVolumeControl = false;
  }

  viewByLargeIcon():void{
    this.viewBy(this.largeIcons)
  }

  viewByMediumIcon():void{
    this.viewBy(this.mediumIcons)
  }

  viewBySmallIcon():void{
    this.viewBy(this.smallIcons)
  }

  viewBy(viewBy:string):void{
    if(viewBy === IconsSizes.LARGE_ICONS){
      this.isLargeIcon = true;
      this.isMediumIcon = false;
      this.isSmallIcon = false;
    }

    if(viewBy === IconsSizes.MEDIUM_ICONS){
      this.isMediumIcon = true;
      this.isLargeIcon = false;
      this.isSmallIcon = false;
    }

    if(viewBy === IconsSizes.SMALL_ICONS){
      this.isSmallIcon = true;
      this.isMediumIcon = false;
      this.isLargeIcon = false;
    }

    this.changeIconsSize(viewBy);
    this.getDesktopMenuData();
  }

  sortByNameM():void{
    this.sortBy(this.sortByName)
  }

  sortBySizeM():void{
    this.sortBy(this.sortBySize)
  }
  sortByItemTypeM():void{
    this.sortBy(this.sortByItemType)
  }
  sortByDateModifiedM():void{
    this.sortBy(this.sortByDateModified)
  }

  sortBy(sortBy:string):void{

    if(sortBy === SortBys.DATE_MODIFIED){
      this.isSortByDateModified = true;
      this.isSortByItemType = false;
      this.isSortByName = false;
      this.isSortBySize = false;
    }

    if(sortBy === SortBys.ITEM_TYPE){
      this.isSortByItemType = true;
      this.isSortByDateModified = false;
      this.isSortByName = false;
      this.isSortBySize = false;
    }

    if(sortBy === SortBys.SIZE){
      this.isSortBySize  = true;
      this.isSortByItemType = false;
      this.isSortByName = false;
      this.isSortByDateModified = false;
    }

    if(sortBy === SortBys.NAME){
      this.isSortByName  = true;
      this.isSortByItemType = false;
      this.isSortByDateModified = false;
      this.isSortBySize = false;
    }

    this.sortIcons(sortBy);
    this.getDesktopMenuData();
  }

  autoArrangeIcon():void{
    this.autoArrangeIcons = !this.autoArrangeIcons
    if(this.autoArrangeIcons){
      // clear (x,y) position of icons in memory
      this.refresh();
    }
    this.getDesktopMenuData();
  }

  autoAlignIcon():void{
    this.autoAlignIcons = !this.autoAlignIcons
    console.log('toggleAutoAlignIconsToGrid:',this.autoAlignIcons);
    if(this.autoAlignIcons){
      this.correctMisalignedIcons();
    }
    this.getDesktopMenuData();
  }

  async refresh():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
    await this.loadFilesInfoAsync();
    setTimeout(() => this.poitionShortCutIconProperly(), 10);
  }

  hideDesktopIcon():void{
    this.showDesktopIcons = false;
    this.btnStyle ={
        'display': 'none',
    }
    this.getDesktopMenuData();
  }

  showDesktopIcon():void{
    this.showDesktopIcons = true;
      this.btnStyle ={
        'display': 'block',
      }
    this.getDesktopMenuData();
  }

  previousBackground():void{
    if(this.currentDesktopNum > this.MIN_NUMS_OF_DESKTOPS){
      this.currentDesktopNum --;
      const curNum = this.currentDesktopNum;
      this.loadOtherBackgrounds(curNum);
    }
    this.hideDesktopContextMenuAndOthers();
  }

  nextBackground():void{
    if(this.currentDesktopNum < this.MAX_NUMS_OF_DESKTOPS){
      this.currentDesktopNum ++;
      const curNum = this.currentDesktopNum;
      this.loadOtherBackgrounds(curNum);
    }
    
    this.hideDesktopContextMenuAndOthers();
  }

  loadOtherBackgrounds(i:number):void{
    const names:string[] = ["vanta-waves","vanta-rings","vanta-halo", "vanta-globe", "vanta-birds"]
    const bkgrounds:string[] = ["osdrive/Program-Files/Backgrounds/vanta.waves.min.js", "osdrive/Program-Files/Backgrounds/vanta.rings.min.js","osdrive/Program-Files/Backgrounds/vanta.halo.min.js",
                                 "osdrive/Program-Files/Backgrounds/vanta.globe.min.js", "osdrive/Program-Files/Backgrounds/vanta.birds.min.js"];
        

    this._scriptService.loadScript(names[i], bkgrounds[i]).then(() =>{
      this.buildVantaEffect(i);

      if(names[i] === "vanta-waves"){
        this.startVantaWaveColorChange();
      }else{
        this.stopVantaWaveColorChange();
      }
    })
  }

  stopVantaWaveColorChange():void{
    clearInterval(this.colorChgIntervalId);
  }

  startVantaWaveColorChange():void{
    this.colorChgIntervalId = setInterval(() => {
      this.transitionToNextColor();
    }, this.COLOR_CHANGE_DELAY);
  }

  openTerminal():void{
    this.openApplication(this.TERMINAL_APP);
  }

  openTextEditor():void{
    this.openApplication(this.TEXT_EDITOR_APP);
  }

  openCodeEditor():void{
    this.openApplication(this.CODE_EDITOR_APP);
  }

  openMarkDownViewer():void{
    this.openApplication(this.MARKDOWN_VIEWER_APP);
  }

  openTaskManager():void{
    this.openApplication(this.TASK_MANAGER_APP);
  }

  async onPaste():Promise<void>{
    const cntntPath = this._menuService.getPath();
    const action = this._menuService.getActions();

    console.log(`path: ${cntntPath}`);
    console.log(`action: ${action}`);

    if(action === 'copy'){
      const result = await this._fileService.copyHandler('',cntntPath,this.DESKTOP_DIRECTORY);
      if(result){
        this.refresh();
      }
    }
    else if(action === 'cut'){
      const result = await this._fileService.movehandler(this.DESKTOP_DIRECTORY, [cntntPath]);
      if(result){
        this.refresh();
      }
    }
  }

  openApplication(arg0:string):void{
    const file = new FileInfo();

    file.setOpensWith = arg0;

    if(arg0 ==  this.MARKDOWN_VIEWER_APP){
      file.setCurrentPath = '/Users/Desktop';
      file.setContentPath = '/Users/Documents/Credits.md';
    }

    this._processHandlerService.startApplicationProcess(file);
  }

  buildViewByMenu():NestedMenuItem[]{

    const smallIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Small icons',  action: this.viewBySmallIcon.bind(this),  variables:this.isSmallIcon, 
      emptyline:false, styleOption:'A' }

    const mediumIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Medium icons',  action: this.viewByMediumIcon.bind(this),  variables:this.isMediumIcon, 
      emptyline:false, styleOption:'A' }

    const largeIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Large icons', action: this.viewByLargeIcon.bind(this), variables:this.isLargeIcon,
      emptyline:true, styleOption:'A' }

    const autoArrageIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Auto arrange icons',  action: this.autoArrangeIcon.bind(this),  variables:this.autoArrangeIcons, 
      emptyline:false, styleOption:'B' }

    const autoAlign:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Align icons to grid',  action: this.autoAlignIcon.bind(this),  variables:this.autoAlignIcons, 
      emptyline:true, styleOption:'B' }

    const showDesktopIcons:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Show desktop icons',  action: this.showDesktopIcon.bind(this), variables:this.showDesktopIcons,
      emptyline:false,  styleOption:'B' }

    const viewByMenu = [smallIcon,mediumIcon,largeIcon, autoArrageIcon, autoAlign,showDesktopIcons];

    return viewByMenu;
  }

  buildSortByMenu(): NestedMenuItem[]{

    const sortByName:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Name',  action: this.sortByNameM.bind(this),  variables:this.isSortByName , 
      emptyline:false, styleOption:'A' }

    const sortBySize:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Size',  action: this.sortBySizeM.bind(this),  variables:this.isSortBySize , 
      emptyline:false, styleOption:'A' }

    const sortByItemType:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Item type',  action: this.sortByItemTypeM.bind(this),  variables:this.isSortByItemType, 
      emptyline:false, styleOption:'A' }

    const sortByDateModified:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Date modified',  action: this.sortByDateModifiedM.bind(this),  variables:this.isSortByDateModified, 
      emptyline:false, styleOption:'A' }

    const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified];

    return sortByMenu
  }

  showTheDesktop():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show open windows', action:this.showOpenWindows.bind(this)}
    // raise show the destop evt
    this._menuService.showTheDesktop.next();
    this.taskBarContextMenuData[0] = menuOption;
  }

  resetMenuOption():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show the desktop', action: this.showTheDesktop.bind(this)}
    this.taskBarContextMenuData[0] = menuOption;
  }

  showOpenWindows():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show the desktop', action: this.showTheDesktop.bind(this)}
    this._menuService.showOpenWindows.next();
    this.taskBarContextMenuData[0] = menuOption;
  }

  hideTheTaskBar():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show the taskbar', action:this.showTheTaskBar.bind(this)}
    this.isTaskBarHidden = true;
    this._systemNotificationServices.hideTaskBarNotify.next();
    this.taskBarContextMenuData[2] = menuOption;
  }

  showTheTaskBar():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Hide the taskbar', action:this.hideTheTaskBar.bind(this)}
    this.isTaskBarHidden = false;
    this._systemNotificationServices.showTaskBarNotify.next();
    this.taskBarContextMenuData[2] = menuOption;
  }

  mergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Unmerge taskbar Icons', action:this.unMergeTaskBarButton.bind(this)}
    this._menuService.mergeTaskBarIcon.next();
    this.taskBarContextMenuData[3] = menuOption;
  }

  unMergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Merge taskbar Icons', action: this.mergeTaskBarButton.bind(this)}
    this._menuService.UnMergeTaskBarIcon.next();
    this.taskBarContextMenuData[3] = menuOption;
  }


  buildNewMenu(): NestedMenuItem[]{

    const newFolder:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action: this.createFolder.bind(this),  variables:true , 
      emptyline:false, styleOption:'C'}

    const textEditor:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}quill.png`, label:'Rich Text',  action: this.openTextEditor.bind(this),  variables:true , 
      emptyline:false, styleOption:'C'}

    const codeEditor:NestedMenuItem={icon:`${Constants.IMAGE_BASE_PATH}vs_code.png`, label:'Code Editor',  action: this.openCodeEditor.bind(this),  variables:true , 
        emptyline:false, styleOption:'C'}

    const sortByMenu = [newFolder, textEditor, codeEditor ]

    return sortByMenu
  }

  getDesktopMenuData():void{
    this.deskTopMenu = [
        {icon1:'',  icon2: `${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'View', nest:this.buildViewByMenu(), action: ()=>'', action1: this.shiftViewSubMenu.bind(this), emptyline:false},
        {icon1:'',  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'Sort by', nest:this.buildSortByMenu(), action: ()=>'', action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
        {icon1:'',  icon2:'', label: 'Refresh', nest:[], action:this.refresh.bind(this), action1: ()=> '', emptyline:true},
        {icon1:'',  icon2:'', label: 'Paste', nest:[], action:this.onPaste.bind(this), action1: ()=> '', emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}terminal.png`, icon2:'', label:'Open in Terminal', nest:[], action: this.openTerminal.bind(this), action1: ()=> '', emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}camera.png`, icon2:'', label:'Screen Shot', nest:[], action: this.captureComponentImg.bind(this), action1: ()=> '', emptyline:false},
        {icon1:'',  icon2:'', label:'Next Background', nest:[], action: this.nextBackground.bind(this), action1: ()=> '', emptyline:false},
        {icon1:'',  icon2:'', label:'Previous Background', nest:[], action: this.previousBackground.bind(this), action1: ()=> '', emptyline:true},
        {icon1:'',  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'New', nest:this.buildNewMenu(), action: ()=> '', action1: this.shiftNewSubMenu.bind(this), emptyline:true},
        {icon1:'',  icon2:'', label:'Many Thanks', nest:[], action: this.openMarkDownViewer.bind(this), action1: ()=> '', emptyline:false}
      ]
  }

  getTaskBarContextData():void{
    this.taskBarContextMenuData = [
      {icon:'', label: 'Show the desktop', action: this.showTheDesktop.bind(this)},
      {icon:'', label: 'Task Manager', action: this.openTaskManager.bind(this)},
      {icon:'', label: 'Hide the taskbar', action:this.hideTheTaskBar.bind(this)},
      {icon:'', label: 'Merge taskbar Icons', action: this.mergeTaskBarButton.bind(this)}
    ]
  }

  private buildVantaEffect(n:number) {

    try {
      const vanta = this.VANTAS[n];
      if(n === Constants.NUM_ZERO){
        this._vantaEffect = VANTA.WAVES(vanta)
      }
      if(n === Constants.NUM_ONE){
        this._vantaEffect = VANTA.RINGS(vanta)
      }
      if(n === Constants.NUM_TWO){
        this._vantaEffect = VANTA.HALO(vanta)
      }
      if(n === Constants.NUM_THREE){
        this._vantaEffect = VANTA.GLOBE(vanta)
      }
      if(n === Constants.NUM_FOUR){
        this._vantaEffect = VANTA.BIRDS(vanta)
      }

    } catch (err) {
      console.error('err:',err);
      //this.buildVantaEffect(this.CURRENT_DESTOP_NUM);
    }
  }

  onShowTaskBarAppIconMenu(data:unknown[]):void{
    const rect = data[0] as DOMRect;
    const tskBarIcon = data[1] as TaskBarIconInfo; 
   
    const file = new FileInfo();
    file.setOpensWith = tskBarIcon.opensWith;
    file.setIconPath = tskBarIcon.defaultIconPath;
    this.selectedTaskBarFile = file;

    if((tskBarIcon.isPinned && tskBarIcon.isOtherPinned) || (!tskBarIcon.isPinned && tskBarIcon.isOtherPinned))
      this.switchBetweenPinAndUnpin(true);
    else
      this.switchBetweenPinAndUnpin(false);
    // first count, then show the cntxt menu
    const processCount = this.countInstaceAndSetMenu();

    this.removeOldTaskBarPreviewWindowNow();
    this.showTskBarAppIconMenu = true;

    if(processCount == Constants.NUM_ZERO){
      this.tskBarAppIconMenuStyle = {
        'position':'absolute',
        'transform':`translate(${String(rect.x - 60)}px, ${String(rect.y - 72)}px)`,
        'z-index': Constants.NUM_FIVE,
      }
    }else {
      this.tskBarAppIconMenuStyle = {
        'position':'absolute',
        'transform':`translate(${String(rect.x - 60)}px, ${String(rect.y - 104)}px)`,
        'z-index': Constants.NUM_FIVE,
      }
    }
  }

  hideTaskBarAppIconMenu():void{
    this.showTskBarAppIconMenu = false;
  }

  showTaskBarAppIconMenu():void{
    this.showTskBarAppIconMenu = true;
  }

  onShowTaskBarContextMenu(evt:MouseEvent):void{
    const menuHeight = 116;
    const menuWidth = 203;
    const taskBarHeight = 40;
    this.showTskBarCntxtMenu = true;

    const axis = this.checkAndHandleMenuBounds(evt, menuHeight, menuWidth);    
    this.tskBarCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${axis.xAxis + 2}px, ${evt.y - menuHeight - taskBarHeight}px)`,
      'z-index': Constants.NUM_FIVE,
    }
  }

  hideTaskBarContextMenu():void{
    this.showTskBarCntxtMenu = false;
  }

  showTaskBarContextMenu():void{
    this.showTskBarCntxtMenu = true;
  }

  switchBetweenPinAndUnpin(isAppPinned:boolean):void{
    if(isAppPinned){
      const menuEntry = {icon:`${Constants.IMAGE_BASE_PATH}unpin_24.png`, label:'Unpin from taskbar', action: this.unPinApplicationFromTaskBar.bind(this)}
      const rowOne = this.taskBarAppIconMenuData[1];
      rowOne.icon = menuEntry.icon;
      rowOne.label = menuEntry.label;
      rowOne.action = menuEntry.action;
      this.taskBarAppIconMenuData[1] = rowOne;
    }else if(!isAppPinned){
      const menuEntry = {icon:`${Constants.IMAGE_BASE_PATH}pin_24.png`, label:'Pin to taskbar', action: this.pinApplicationFromTaskBar.bind(this)}
      const rowOne = this.taskBarAppIconMenuData[1];
      rowOne.icon = menuEntry.icon;
      rowOne.label = menuEntry.label;
      rowOne.action = menuEntry.action;
      this.taskBarAppIconMenuData[1] = rowOne;
    }
  }

  countInstaceAndSetMenu():number{
    const file = this.selectedTaskBarFile;
    const processCount = this._runningProcessService.getProcessCount(file.getOpensWith);

    const rowZero = this.taskBarAppIconMenuData[0];
    rowZero.icon = file.getIconPath;
    rowZero.label = file.getOpensWith;
    this.taskBarAppIconMenuData[0] = rowZero;

    if(processCount === Constants.NUM_ZERO){
      if(this.taskBarAppIconMenuData.length === Constants.NUM_THREE){
        this.taskBarAppIconMenuData.pop()
      }
    }else if(processCount === Constants.NUM_ONE){
      if(this.taskBarAppIconMenuData.length === Constants.NUM_TWO){
        const menuEntry = {icon:`${Constants.IMAGE_BASE_PATH}x_32.png`, label: 'Close window', action:this.closeApplicationFromTaskBar.bind(this)};
        this.taskBarAppIconMenuData.push(menuEntry);
      }else{
        const rowTwo = this.taskBarAppIconMenuData[2];
        rowTwo.label = 'Close window';
        this.taskBarAppIconMenuData[2] = rowTwo;
      }
    }else{
      const rowTwo = this.taskBarAppIconMenuData[2];
      if(!rowTwo){
        const menuEntry = {icon:`${Constants.IMAGE_BASE_PATH}x_32.png`, label: 'Close all windows', action:this.closeApplicationFromTaskBar.bind(this)};
        this.taskBarAppIconMenuData.push(menuEntry);
      }else{
      rowTwo.label = 'Close all windows';
      this.taskBarAppIconMenuData[2] = rowTwo;
      }
    }

    return processCount;
  }

  openApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedTaskBarFile;  
    this._processHandlerService.startApplicationProcess(file);
  }

  closeApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedTaskBarFile;
    const proccesses = this._runningProcessService.getProcesses()
      .filter(p => p.getProcessName === file.getOpensWith);

    this._menuService.closeApplicationFromTaskBar.next(proccesses);
  }

  pinApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedTaskBarFile;
    this._menuService.pinToTaskBar.next(file);
  }

  unPinApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedTaskBarFile;
    this._menuService.unPinFromTaskBar.next(file);
  }

  showTaskBarPreviewWindow(data:unknown[]):void{
    const taskbarHideDelay = 350;
    const rect = data[0] as DOMRect;
    const appName = data[1] as string;
    const iconPath = data[2] as string;

    this.appToPreview = appName;
    this.appToPreviewIcon = iconPath;
    this.hideTaskBarAppIconMenu();

    if(this.previousDisplayedTaskbarPreview !== appName){
      this.showTskBarPreviewWindow = false;
      this.previousDisplayedTaskbarPreview = appName;

      setTimeout(()=>{
        this.showTskBarPreviewWindow = true;
        this.tskBarPreviewWindowState = 'in';
      },taskbarHideDelay);
    }else{
      this.showTskBarPreviewWindow = true;
      this.tskBarPreviewWindowState = 'in';
      this.clearTimeout();
    }

    this.tskBarPrevWindowStyle = {
      'position':'absolute',
      'transform':`translate(${String((rect.x))}px, ${String(rect.y - 131)}px)`,
      'z-index': Constants.NUM_FIVE,
    }
  }

  hideTaskBarPreviewWindow():void{
    this.hideTskBarPrevWindowTimeoutId = setTimeout(()=>{
      this.tskBarPreviewWindowState = 'out';
    }, 100)
    
    this.removeTskBarPrevWindowFromDOMTimeoutId = setTimeout(()=>{
      this.showTskBarPreviewWindow = false;
      //this.hideTaskBarContextMenu();
    }, 300)
  }

  keepTaskBarPreviewWindow():void{
    this.clearTimeout();
  }

  removeOldTaskBarPreviewWindowNow():void{
    this.showTskBarPreviewWindow = false;
  }

  clearTimeout():void{
    clearTimeout(this.hideTskBarPrevWindowTimeoutId);
    clearTimeout(this.removeTskBarPrevWindowFromDOMTimeoutId);
  }

  async onDrop(event:DragEvent):Promise<void>{
    //Some about z-index is causing the drop to desktop to act funny.
    event.preventDefault();
    let droppedFiles:File[] = [];

    if(event?.dataTransfer?.files){
        // eslint-disable-next-line no-unsafe-optional-chaining
        droppedFiles  = [...event?.dataTransfer?.files];
    }
    
    if(droppedFiles.length >= Constants.NUM_ONE){
      const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
      if(result){
        this._fileService.addEventOriginator('desktop');
        this._fileService.dirFilesUpdateNotify.next();
        this.refresh();
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
        elfRef.style.position = Constants.EMPTY_STRING;
        elfRef.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.SECONDS_DELAY[1]);
  }
  
  
  poitionShortCutIconProperly():void{

  // when i move an icon from it's original position, exclude the icon id 
    for(let i = 0;  i < this.files.length; i++){

      if(!this.movedBtnIds.includes(String(i))){
        const figElmnt = document.getElementById(`dsktpmngr_fig${i}`) as HTMLElement;
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

    console.log('desktopmanager-runProcess:',file)
    this._audioService.play(this.cheetahNavAudio);
    this._processHandlerService.startApplicationProcess(file);
    this.btnStyleAndValuesReset();
    
    // console.log('what was clicked:',file.getFileName +'-----' + file.getOpensWith +'---'+ file.getCurrentPath +'----'+ file.getIcon) TBD
    // if((file.getOpensWith === 'fileexplorer' && file.getFileName !== 'fileexplorer') && file.getFileType ==='folder'){
    //     //this.directory = file.getCurrentPath;
    //    // await this.loadFilesInfoAsync();

    //    this._processHandlerService.startApplication(file);
    //    this.btnStyleAndValuesReset();

    // }else{
    //     this._processHandlerService.startApplication(file);
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
  
  onShowDesktopIconCntxtMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    const menuHeight = 213; //this is not ideal.. menu height should be gotten dynmically
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);
    this._menuService.hideContextMenus.next();

    this.adjustContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file;
    this.showDesktopIconCntxtMenu = true;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);

    const axis = this.checkAndHandleMenuBounds_filemnger(evt, menuHeight);
  
    this.iconCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${String(evt.clientX + Constants.NUM_TWO)}px, ${String(axis.yAxis)}px)`,
      'z-index': Constants.NUM_FOUR,
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
  
  checkAndHandleMenuBounds_filemnger(evt:MouseEvent, menuHeight:number):MenuPositiom{
    let yAxis = Constants.NUM_ZERO;
    const xAxis = Constants.NUM_ZERO;
    const taskBarHeight = 40;

    const mainWindow = document.getElementById('vanta');
    const windowHeight =  mainWindow?.offsetHeight || Constants.NUM_ZERO;
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
    this.btnClickCnt = Constants.NUM_ZERO;
    this.removeBtnStyle(this.selectedElementId);
    this.removeBtnStyle(this.prevSelectedElementId);
    this.selectedElementId = Constants.MINUS_ONE;
    this.prevSelectedElementId = Constants.MINUS_ONE;
    this.btnClickCnt = Constants.NUM_ZERO;
    this.isIconInFocusDueToPriorAction = false;
  }

  removeBtnStyle(id:number):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.borderColor = Constants.EMPTY_STRING;
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
        btnElement.style.backgroundColor = Constants.EMPTY_STRING;
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
    const btnIcons = document.querySelectorAll('.dsktpmngr-multi-select-highlight');
    return btnIcons.length;
  }
  
  getIDsOfAllTheMarkedButtons():void{
    const btnIcons = document.querySelectorAll('.dsktpmngr-multi-select-highlight');
    btnIcons.forEach(btnIcon => {
      const btnId = btnIcon.id.replace('iconBtn', Constants.EMPTY_STRING);
      if(!this.markedBtnIds.includes(btnId))
        this.markedBtnIds.push(btnId);
    });
    console.log('this.markedBtnIds:', this.markedBtnIds);
  }
  
  removeClassAndStyleFromBtn():void{
    this.markedBtnIds.forEach(id =>{
      const btnIcon = document.getElementById(`iconBtn${id}`);
      if(btnIcon){
        btnIcon.classList.remove('dsktpmngr-multi-select-highlight');
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
    this.hideCntxtMenuEvtCnt = Constants.NUM_ZERO;

    if(this.prevSelectedElementId != id){
      this.removeBtnStyle(this.prevSelectedElementId);
    }
  }
  
  hideIconContextMenu(caller?:string):void{
    this.showDesktopIconCntxtMenu = false;
    // to prevent an endless loop of calls,
    if(caller !== undefined && caller === this.name){
      this._menuService.hideContextMenus.next();
    }
  }

  handleIconHighLightState():void{
    //First case - I'm clicking only on the desktop icons
    if((this.isBtnClickEvt && this.btnClickCnt >= Constants.NUM_ONE) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt == Constants.NUM_ZERO)){  
      if(this.isRenameActive){
        this.isFormDirty();
      }
      if(this.isIconInFocusDueToPriorAction){
        if(this.hideCntxtMenuEvtCnt >= Constants.NUM_ZERO)
          this.setBtnStyle(this.selectedElementId,false);

        this.isIconInFocusDueToPriorAction = false;
      }
      if(!this.isRenameActive){
        this.isBtnClickEvt = false;
        this.btnClickCnt = Constants.NUM_ZERO;
      }
      console.log('turn off - areMultipleIconsHighlighted')
      this.areMultipleIconsHighlighted = false;
    }else{
      this.hideCntxtMenuEvtCnt++;
      this.isHideCntxtMenuEvt = true;
      //Second case - I was only clicking on the desktop
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= Constants.NUM_ONE) && (!this.isBtnClickEvt && this.btnClickCnt == Constants.NUM_ZERO)){
        this.deskTopClickCounter++;
        this.btnStyleAndValuesReset();

        //reset after clicking on the desktop 2wice
        if(this.deskTopClickCounter >= Constants.NUM_TWO){
          console.log('turn off - areMultipleIconsHighlighted-1')
          this.areMultipleIconsHighlighted = false;
          this.removeClassAndStyleFromBtn();
          this.deskTopClickCounter = Constants.NUM_ZERO;
          this.markedBtnIds = [];
        }
      }
      //Third case - I was clicking on the desktop icons, then i click on the desktop.
      //clicking on the desktop triggers a hideContextMenuEvt
      if((this.isBtnClickEvt && this.btnClickCnt >= Constants.NUM_ONE) && (this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt > Constants.NUM_ONE))
        this.btnStyleAndValuesReset();
    }
  }

  activateMultiSelect(evt:MouseEvent):void{
    if(this.isWindowDragActive) return;

    if(this.isMultiSelectEnabled){    
      this.isMultiSelectActive = true;
      this.multiSelectElmnt = document.getElementById('dskTopMultiSelectPane') as HTMLDivElement;
      this.multiSelectStartingPosition = evt;
    }
  }
  
  deActivateMultiSelect():void{ 
    if(this.multiSelectElmnt){
      this.setDivWithAndSize(this.multiSelectElmnt, Constants.NUM_ZERO, Constants.NUM_ZERO, Constants.NUM_ZERO, Constants.NUM_ZERO, false);
    }

    this.multiSelectElmnt = null;
    this.multiSelectStartingPosition = null;
    this.isMultiSelectActive = false;

    const markedBtnCount = this.getCountOfAllTheMarkedButtons();
    if(markedBtnCount === Constants.NUM_ZERO)
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

    const btnIcons = document.querySelectorAll('.dsktpmngr_btn');
    btnIcons.forEach((btnIcon) => {
        const btnIconRect = btnIcon.getBoundingClientRect();

        // Check if the item is inside the selection area
        if ( btnIconRect.right > selectionRect.left && btnIconRect.left < selectionRect.right &&
            btnIconRect.bottom > selectionRect.top && btnIconRect.top < selectionRect.bottom){
            btnIcon.classList.add('dsktpmngr-multi-select-highlight'); 
        } else {
            btnIcon.classList.remove('dsktpmngr-multi-select-highlight');
        }
    });
  }

  onDragEnd(evt:DragEvent):void{
    // Get the cloneIcon container
    const elementId = 'dsktpmngr_clone_cntnr';
    const mPos:mousePosition = {
      clientX: evt.clientX,
      clientY: evt.clientY,
      offsetX: evt.offsetX,
      offsetY: evt.offsetY,
      x: evt.x,
      y: evt.y,
    }

    if(this.autoAlignIcons && this.markedBtnIds.length >= Constants.NUM_ZERO){
      this.moveBtnIconsToNewPositionAlignOn(mPos);
    }else if (!this.autoAlignIcons && this.markedBtnIds.length >= Constants.NUM_ZERO){
      this.moveBtnIconsToNewPositionAlignOff(mPos);
    }
    
    this.poitionShortCutIconProperly();

    const cloneIcon = document.getElementById(elementId);
    if(cloneIcon) 
      cloneIcon.innerHTML = Constants.EMPTY_STRING;
    
  }
  
  onDragStart(evt:DragEvent, i: number): void {
  
    // Get the cloneIcon container
    const elementId = 'dsktpmngr_clone_cntnr';
    const cloneIcon = document.getElementById(elementId);
    const countOfMarkedBtns = this.getCountOfAllTheMarkedButtons();
    let counter = Constants.NUM_ZERO;

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
          evt.dataTransfer.setDragImage(cloneIcon, Constants.NUM_ZERO, Constants.NUM_ZERO);  // Offset positions for the drag image
        }
      }else{
        this.markedBtnIds.forEach(id =>{
          const srcIconElmnt = document.getElementById(`iconBtn${id}`) as HTMLElement;
          const srcShortCutElmnt = document.getElementById(`shortCut${id}`) as HTMLImageElement;

          const tmpTop = srcShortCutElmnt.style.top;
          const tmpLeft = srcShortCutElmnt.style.left;
  
          if(counter === Constants.NUM_ZERO)
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
          if(counter !== countOfMarkedBtns - Constants.NUM_ONE)
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
          evt.dataTransfer.setDragImage(cloneIcon, Constants.NUM_ZERO, Constants.NUM_ZERO);  // Offset positions for the drag image
        }
      }
    }
  }
  
  moveBtnIconsToNewPositionAlignOff(mPos:mousePosition):void{
    let counter = Constants.NUM_ZERO;
    let justAdded = false;

    if(this.markedBtnIds.length === Constants.NUM_ZERO){
      justAdded = true;
      this.markedBtnIds.push(String(this.draggedElementId));
    }

    this.markedBtnIds.forEach(id =>{
      const btnIcon = document.getElementById(`dsktpmngr_li${id}`);
      const btnIconElmnt = document.getElementById(`dsktpmngr_li${id}`) as HTMLElement;
      const srcShortCutElmnt = document.getElementById(`shortCut${id}`) as HTMLImageElement;
      this.movedBtnIds.push(id);
      if(btnIcon){
        const btnIconRect = btnIcon.getBoundingClientRect();
        const xDiff = mPos.x - btnIconRect.left;
        const newX = btnIconRect.left + xDiff;

        let newY = Constants.NUM_ZERO;
        if(counter === Constants.NUM_ZERO)
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
    const dsktpmngrOlElmnt = document.getElementById('dsktpmngr_ol') as HTMLElement;
    const maxIconWidth = this.GRID_SIZE;
    const maxIconHeight = this.GRID_SIZE;
    const offset = 7;
    
    if (!dsktpmngrOlElmnt) return;
  
    const gridWidth = dsktpmngrOlElmnt.clientWidth; // Get total width of the container
    const columnCount = Math.floor(gridWidth / maxIconWidth); // Assuming each icon is 100px wide
    const columnWidth = Math.floor(gridWidth / columnCount) - 1; // Compute exact column width

    let counter = Constants.NUM_ZERO;
    let justAdded = false;
    let newY = Constants.NUM_ZERO;

    if(this.markedBtnIds.length === Constants.NUM_ZERO){
      justAdded = true;
      this.markedBtnIds.push(String(this.draggedElementId));
    }

    this.markedBtnIds.forEach(id =>{
      const btnIconElmnt = document.getElementById(`dsktpmngr_li${id}`) as HTMLElement;
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
      const btnIcon = document.getElementById(`dsktpmngr_li${id}`);

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
        return objA.getFileName < objB.getFileName ? Constants.MINUS_ONE : Constants.NUM_ONE;
      });
    }else if(sortBy === "Item Type"){
      this.files = this.files.sort((objA, objB) => {
        return objA.getFileType < objB.getFileType ? Constants.MINUS_ONE : Constants.NUM_ONE;
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
    let fileContent = Constants.EMPTY_STRING;

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
      if(this.renameFileTriggerCnt > Constants.NUM_ONE){
        this.onRenameFileTxtBoxHide();
        this.renameFileTriggerCnt = Constants.NUM_ZERO;
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

    if(renameText !== Constants.EMPTY_STRING && renameText.length !== Constants.NUM_ZERO && renameText !== this.currentIconName ){
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
    this.renameFileTriggerCnt = Constants.NUM_ZERO;
    
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

  restorPriorOpenApps():void{
    if(!this.isRestored){
      setTimeout(()=> {
        console.log('check for apps re-open......')
        this._processHandlerService.checkAndRestore();
        this.isRestored = true;
      }, this.SECONDS_DELAY[2]);
    }
  }

  lockScreenIsActive():void{
    this.hideDesktopIcon();
    this.stopClippy(); 
    this.hideVolumeControl();
  }

  desktopIsActive():void{
    this.showDesktopIcon();
    this.restorPriorOpenApps();
    this.startClippy();
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}