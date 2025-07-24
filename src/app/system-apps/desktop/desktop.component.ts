import { AfterViewInit, OnInit,OnDestroy, Component, ElementRef, ViewChild} from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { BIRDS, GLOBE, HALO, RINGS, WAVE } from './vanta-object/vanta.interfaces';
import { SortBys } from 'src/app/system-files/common.enums';
import { Colors } from './colorutil/colors';
import { FileInfo } from 'src/app/system-files/file.info';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { GeneralMenu, MenuPosition, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.types';
import * as htmlToImage from 'html-to-image';
import { FileService } from 'src/app/shared/system-service/file.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { dirname} from 'path';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { TaskBarIconInfo } from '../taskbarentries/taskbar.entries.type';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FileEntry } from 'src/app/system-files/file.entry';
import { mousePosition, IconsSizes, IconsSizesPX, ShortCutIconsSizes, ShortCutIconsBottom} from './desktop.types';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { VantaDefaults } from './vanta-object/vanta.defaults';
import { CommonFunctions } from 'src/app/system-files/common.functions';

declare let VANTA: { HALO: any; BIRDS: any;  WAVES: any;   GLOBE: any;  RINGS: any;};

@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('slideStatusAnimation', [
      state('slideOut', style({ right: '-480px' })),
      state('slideIn', style({ right: '0px' })),

      transition('* => slideIn', [
        animate('250ms ease-in')
      ]),
      transition('slideIn => slideOut', [
        animate('1750ms ease-out')
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
  
  private _fileService:FileService;
  private _menuService:MenuService;
  private _audioService:AudioService;
  private _windowService:WindowService;
  private _scriptService: ScriptService;
  private _processIdService:ProcessIDService;
  private _processHandlerService:ProcessHandlerService;
  private _runningProcessService:RunningProcessService;
  private _systemNotificationServices:SystemNotificationService;
  private _userNotificationService:UserNotificationService;

  private _elRef:ElementRef;
  private _directoryFilesEntries!:FileEntry[];
  private _formBuilder:FormBuilder;

  private _vantaEffect: any;
  private _numSequence = 0;
  private _charSequence = 'a';
  private _charSequenceCount = 0;

  readonly largeIcons = IconsSizes.LARGE_ICONS;
  readonly mediumIcons = IconsSizes.MEDIUM_ICONS;
  readonly smallIcons = IconsSizes.SMALL_ICONS

  isLargeIcon = false;
  isMediumIcon = true;
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
  isTaskBarHidden = false;
  isTaskBarTemporarilyVisible = false;

  autoAlignIcons = true;
  autoArrangeIcons = true;
  showDesktopIcons = true;
  showDesktopScreenShotPreview = false;
  showTaskBarIconToolTip = false;
  showStartMenu = false;
  showVolumeControl = false;
  showDesktopIconCntxtMenu = false;
  showClippy = false;
  dsktpPrevImg = Constants.EMPTY_STRING;
  slideState = 'slideOut'

  dskTopCntxtMenuStyle:Record<string, unknown> = {};
  tskBarAppIconMenuStyle:Record<string, unknown> = {};
  tskBarCntxtMenuStyle:Record<string, unknown> = {};
  tskBarPrevWindowStyle:Record<string, unknown> = {};
  tskBarToolTipStyle:Record<string, unknown> = {};

  deskTopMenuOption =  Constants.NESTED_MENU_OPTION;
  showDesktopCntxtMenu = false;
  showTskBarAppIconMenu = false;
  showTskBarCntxtMenu = false;
  showTskBarPreviewWindow = false;
  tskBarPreviewWindowState = 'in';
  tskBarToolTipText = Constants.EMPTY_STRING;
  tskBarAppIconMenuOption =  Constants.TASK_BAR_APP_ICON_MENU_OPTION;
  tskBarContextMenuOption = Constants.TASK_BAR_CONTEXT_MENU_OPTION
  menuOrder = Constants.DEFAULT_MENU_ORDER;
  selectedTaskBarFile!:FileInfo;
  appToPreview = Constants.EMPTY_STRING;
  appToPreviewIcon = Constants.EMPTY_STRING;
  previousDisplayedTaskbarPreview = Constants.EMPTY_STRING;
  removeTskBarPrevWindowFromDOMTimeoutId!: NodeJS.Timeout;
  hideTskBarPrevWindowTimeoutId!: NodeJS.Timeout;
  showTskBarToolTipTimeoutId!: NodeJS.Timeout;
  clippyIntervalId!: NodeJS.Timeout;
  colorChgIntervalId!: NodeJS.Timeout;

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

  VANTAS:any = [this.waveBkgrnd, this.ringsBkgrnd, this.haloBkgrnd, this.globeBkgrnd, this.birdBkgrnd ];
  private readonly MIN_NUMS_OF_DESKTOPS = 0;

  // i didn't subtract 1 because there is a particles flows bkgrnd in the names array
  private readonly MAX_NUMS_OF_DESKTOPS = this.VANTAS.length;
  private readonly CLIPPY_INIT_DELAY = 300000; // 5mins
  private readonly COLOR_CHANGE_DELAY = 30000; // 30secs
  private readonly COLOR_TRANSITION_DURATION = 1500; // 1.5sec
  private readonly MIN_NUM_COLOR_RANGE = 200;
  private readonly MAX_NUM_COLOR_RANGE = 99999;
  private readonly DEFAULT_COLOR = 0x274c;

  private currentDesktopNum = 0;

  readonly cheetahDsktpIconSortKey = 'cheetahDsktpIconSortKey';
  readonly cheetahDsktpIconSizeKey = 'cheetahDsktpIconSizeKey';
  readonly cheetahDsktpHideTaskBarKey = 'cheetahDsktpHideTaskBarKey';


  deskTopMenu:NestedMenu[] = [];
  taskBarContextMenuData:GeneralMenu[] = [];
  taskBarAppIconMenuData:GeneralMenu[] = [
    {icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: this.openApplicationFromTaskBar.bind(this)},
    {icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: ()=> console.log() },
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
  private selectedElementId = -1;
  private draggedElementId = -1;
  private prevSelectedElementId = -1; 
  private hideCntxtMenuEvtCnt = 0;
  private btnClickCnt = 0;
  private renameFileTriggerCnt = 0; 
  private currentIconName = Constants.EMPTY_STRING;

  iconCntxtMenuStyle:Record<string, unknown> = {};
  iconSizeStyle:Record<string, unknown> = {};
  shortCutIconSizeStyle:Record<string, unknown> = {};
  figCapIconSizeStyle:Record<string, unknown> = {};
  btnStyle:Record<string, unknown> = {};

  readonly MIN_GRID_SIZE = 70;
  readonly MID_GRID_SIZE = 90;
  readonly MAX_GRID_SIZE = 120;

  GRID_SIZE = this.MID_GRID_SIZE; //column size of grid = 90px
  ROW_GAP = 25;
  SECONDS_DELAY:number[] = [6000, 250, 4000, 300];
  renameForm!: FormGroup;

  deskTopClickCounter = 0;

  cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;
  emptyTrashAudio = `${Constants.AUDIO_BASE_PATH}cheetah_recycle.wav`;
  shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;

  multiSelectElmnt!:HTMLDivElement | null;
  multiSelectStartingPosition!:MouseEvent | null;

  markedBtnIds:string[] = [];
  movedBtnIds:string[] = [];
  files:FileInfo[] = [];

  sourceData:GeneralMenu[] = [
    {icon:'', label: 'Open', action: this.onTriggerRunProcess.bind(this) },
    {icon:`${Constants.IMAGE_BASE_PATH}recycle bin_folder_small.png`, label: 'Empty Recycle Bin', action:this.onEmptyRecyleBin.bind(this) },
    {icon:'', label: 'Pin to Quick access', action: this.doNothing.bind(this) },
    {icon:'', label: 'Open in Terminal', action: this.doNothing.bind(this) },
    {icon:'', label: 'Pin to Start', action: this.doNothing.bind(this) },
    {icon:'', label: 'Pin to Taskbar', action: this.pinIconToTaskBar.bind(this) },
    {icon:'', label: 'Cut', action: this.onCut.bind(this) },
    {icon:'', label: 'Copy', action: this.onCopy.bind(this)},
    {icon:'', label: 'Create shortcut', action: this.createShortCut.bind(this)},
    {icon:'', label: 'Delete', action: this.onDelete.bind(this) },
    {icon:'', label: 'Rename', action: this.onRenameFileTxtBoxShow.bind(this) },
    {icon:'', label: 'Properties', action: this.showPropertiesWindow.bind(this) }
  ];

  menuData:GeneralMenu[] =[];
  
  dsktpMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'desktop';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  directory = Constants.DESKTOP_PATH;


  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService, 
              scriptService:ScriptService, audioService:AudioService, menuService:MenuService, 
              fileService:FileService, windowService:WindowService, systemNotificationServices:SystemNotificationService,
              userNotificationService:UserNotificationService, formBuilder:FormBuilder, elRef:ElementRef) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
  
    this._processHandlerService = triggerProcessService;
    this._scriptService = scriptService;
    this._menuService = menuService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;
    this._userNotificationService = userNotificationService;
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


    this._fileService.dirFilesUpdateNotify.subscribe(() =>{
      if(this._fileService.getEventOriginator() === this.name){
        this.loadFiles();
        this._fileService.removeEventOriginator();
      }
    });

    // this is a sub, but since this cmpnt will not be closed, it doesn't need to be destroyed
    this._systemNotificationServices.showDesktopNotify.subscribe(() => {
      this.desktopIsActive();
    })
    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {
      this.lockScreenIsActive();
    });

    this._menuService.updateTaskBarContextMenu.subscribe(()=>{this.resetMenuOption()});
    this._systemNotificationServices.showTaskBarToolTipNotify.subscribe((p)=>{this.showTaskBarToolTip(p)});
    this._systemNotificationServices.hideTaskBarToolTipNotify.subscribe(() => {this.hideTaskBarToolTip()});

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._numSequence = this.getRandomInt(this.MIN_NUM_COLOR_RANGE, this.MAX_NUM_COLOR_RANGE);
  }

  ngOnInit():void{
    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: Constants.EMPTY_STRING,
    });


    this.loadDefaultBackground();
    this.getDesktopMenuData();
    this.getTaskBarContextData();
  }

  loadDefaultBackground():void{
    this._scriptService.loadScript("vanta-waves","osdrive/Program-Files/Backgrounds/vanta.waves.min.js").then(() =>{
      this._vantaEffect = VANTA.WAVES(VantaDefaults.getDefaultWave(this.DEFAULT_COLOR));
    })
  }

  async ngAfterViewInit():Promise<void>{
    this.startVantaWaveColorChange();
    this.hideDesktopContextMenuAndOthers();
    this.initClippy();

   this.removeVantaJSSideEffect();
    await CommonFunctions.sleep(this.SECONDS_DELAY[3])
    await this.loadFiles();
  }

  ngOnDestroy(): void {
    this._vantaEffect?.destroy();
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
  
        if (progress < 1) {
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
    const appName = 'clippy';
    //check if clippy is running, and end it
    const clippy = this._runningProcessService.getProcessByName(appName);
    if(clippy)
      this._runningProcessService.closeProcessNotify.next(clippy);

    clearInterval(this.clippyIntervalId);
    this.showClippy = false;
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
      const axis = this.checkAndHandleDesktopCntxtMenuBounds(evt, menuHeight, menuWidth);

      this.dskTopCntxtMenuStyle = {
        'position':'absolute',
        'width': '210px', 
        'transform':`translate(${String(axis.xAxis + 2)}px, ${String(axis.yAxis)}px)`,
        'z-index': 4,
        'opacity': 1
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

  checkAndHandleDesktopCntxtMenuBounds(evt:MouseEvent, menuHeightInput:number, menuWidthInput:number):MenuPosition{

    let xAxis = 0;
    let yAxis = 0;
    const menuWidth = menuWidthInput;
    const menuHeight = menuHeightInput;
    const subMenuWidth = 205;
    const taskBarHeight = 40;

    const mainWindow = document.getElementById('vanta');
    const windowWidth =  mainWindow?.offsetWidth || 0;
    const windowHeight =  mainWindow?.offsetHeight || 0;

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

  async captureComponentImg(): Promise<void>{
    const storeImgDelay = 1000;
    const slideOutDelay = 4000;
    const hideDeskopScreenShotDelay = 2000;

    const htmlImg = await htmlToImage.toPng(this.desktopContainer.nativeElement);
    this.showDesktopScreenShotPreview = true;
    this.slideState = 'slideIn';
    this.dsktpPrevImg = htmlImg;
     
    const screenShot:FileInfo = new FileInfo();
    screenShot.setFileName = 'screen_shot.png'
    screenShot.setCurrentPath = `${this.DESKTOP_SCREEN_SHOT_DIRECTORY}/screen_shot.png`;
    screenShot.setContentPath = htmlImg;
    screenShot.setIconPath = htmlImg;
     
    await CommonFunctions.sleep(storeImgDelay);
    this._fileService.writeFileAsync(this.DESKTOP_SCREEN_SHOT_DIRECTORY, screenShot);
    this._fileService.addEventOriginator(Constants.FILE_EXPLORER);

    await CommonFunctions.sleep(storeImgDelay);
    this._fileService.dirFilesUpdateNotify.next();

    await CommonFunctions.sleep(slideOutDelay);
    this.slideState = 'slideOut';

    await CommonFunctions.sleep(hideDeskopScreenShotDelay);
    this.showDesktopScreenShotPreview = false;
  }

  async createFolder():Promise<void>{
    const folderName = Constants.NEW_FOLDER;
    const result =  await this._fileService.createFolderAsync(Constants.DESKTOP_PATH, folderName);
    if(result){
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

    setTimeout(() => {
      this.closePwrDialogBox();
    }, 10);

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

  closePwrDialogBox():void{
    const pid = this._systemNotificationServices.getPwrDialogPid();

    if(pid !== 0){
      this._userNotificationService.closeDialogMsgBox(pid);
    }
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
    const intervalId = setInterval(() => {
      if (!this.isTaskBarTemporarilyVisible) {
        clearInterval(intervalId);
      }
    }, 10); //10ms
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
    this.changeGridRowColSize();
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
    if(this.autoAlignIcons){
      this.correctMisalignedIcons();
    }
    this.getDesktopMenuData();
  }

  async refresh():Promise<void>{
    this.isIconInFocusDueToPriorAction = false;
    await this.loadFiles();
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
      this.currentDesktopNum--;
      const curNum = this.currentDesktopNum;
      this.loadOtherBackgrounds(curNum);
    }
    this.hideDesktopContextMenuAndOthers();
  }

  nextBackground():void{
    if(this.currentDesktopNum < this.MAX_NUMS_OF_DESKTOPS){
      this.currentDesktopNum++;
      const curNum = this.currentDesktopNum;
      this.loadOtherBackgrounds(curNum);
    }
    
    this.hideDesktopContextMenuAndOthers();
  }

  loadOtherBackgrounds(i:number):void{
    this.removeOldCanvas();

    const names:string[] = ["vanta-waves","vanta-rings","vanta-halo", "vanta-globe", "vanta-birds", "particle-flow"];
    const bkgrounds:string[] = ["osdrive/Program-Files/Backgrounds/vanta.waves.min.js", "osdrive/Program-Files/Backgrounds/vanta.rings.min.js","osdrive/Program-Files/Backgrounds/vanta.halo.min.js",
                                "osdrive/Program-Files/Backgrounds/vanta.globe.min.js", "osdrive/Program-Files/Backgrounds/vanta.birds.min.js", "osdrive/Program-Files/Backgrounds/ParticleFlow/index.js"];
        

    this._scriptService.loadScript(names[i], bkgrounds[i]).then(() =>{

      if(names[i] !== "particle-flow")
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

  removeOldCanvas():void{

    const vantaDiv = document.getElementById('vanta') as HTMLElement;
    if(!vantaDiv) return;

    const canvas = vantaDiv.querySelector('canvas');
    if (canvas){
      vantaDiv.removeChild(canvas);
    }
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

  openApplication(arg0:string):void{
    const file = new FileInfo();

    file.setOpensWith = arg0;

    if(arg0 ==  this.MARKDOWN_VIEWER_APP){
      file.setCurrentPath = Constants.DESKTOP_PATH;
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
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Show open windows', action:this.showOpenWindows.bind(this)}
    // raise show the destop evt
    this._menuService.showTheDesktop.next();
    this.taskBarContextMenuData[0] = menuOption;
  }

  resetMenuOption():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Show the desktop', action: this.showTheDesktop.bind(this)}
    this.taskBarContextMenuData[0] = menuOption;
  }

  showOpenWindows():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Show the desktop', action: this.showTheDesktop.bind(this)}
    this._menuService.showOpenWindows.next();
    this.taskBarContextMenuData[0] = menuOption;
  }

  hideTheTaskBar():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Show the taskbar', action:this.showTheTaskBar.bind(this)}
    this.isTaskBarHidden = true;
    this._systemNotificationServices.hideTaskBarNotify.next();
    this.taskBarContextMenuData[2] = menuOption;
  }

  showTheTaskBar():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Hide the taskbar', action:this.hideTheTaskBar.bind(this)}
    this.isTaskBarHidden = false;
    this._systemNotificationServices.showTaskBarNotify.next();
    this.taskBarContextMenuData[2] = menuOption;
  }

  mergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Unmerge taskbar Icons', action:this.unMergeTaskBarButton.bind(this)}
    this._menuService.mergeTaskBarIcon.next();
    this.taskBarContextMenuData[3] = menuOption;
  }

  unMergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:Constants.EMPTY_STRING, label: 'Merge taskbar Icons', action: this.mergeTaskBarButton.bind(this)}
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
    const empty = Constants.EMPTY_STRING;
    this.deskTopMenu = [
        {icon1:empty,  icon2: `${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'View', nest:this.buildViewByMenu(), action: ()=>empty, action1: this.shiftViewSubMenu.bind(this), emptyline:false},
        {icon1:empty,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'Sort by', nest:this.buildSortByMenu(), action: ()=>empty, action1: this.shiftSortBySubMenu.bind(this), emptyline:false},
        {icon1:empty,  icon2:'', label: 'Refresh', nest:[], action:this.refresh.bind(this), action1: ()=> empty, emptyline:true},
        {icon1:empty,  icon2:'', label: 'Paste', nest:[], action:this.onPaste.bind(this), action1: ()=> empty, emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}terminal.png`, icon2:'', label:'Open in Terminal', nest:[], action: this.openTerminal.bind(this), action1: ()=> '', emptyline:false},
        {icon1:`${Constants.IMAGE_BASE_PATH}camera.png`, icon2:'', label:'Screen Shot', nest:[], action: this.captureComponentImg.bind(this), action1: ()=> '', emptyline:false},
        {icon1:empty,  icon2:'', label:'Next Background', nest:[], action: this.nextBackground.bind(this), action1: ()=> empty, emptyline:false},
        {icon1:empty,  icon2:'', label:'Previous Background', nest:[], action: this.previousBackground.bind(this), action1: ()=> empty, emptyline:true},
        {icon1:empty,  icon2:`${Constants.IMAGE_BASE_PATH}arrow_next_1.png`, label:'New', nest:this.buildNewMenu(), action: ()=> empty, action1: this.shiftNewSubMenu.bind(this), emptyline:true},
        {icon1:empty,  icon2:'', label:'Many Thanks', nest:[], action: this.openMarkDownViewer.bind(this), action1: ()=> empty, emptyline:false}
      ]
  }

  getTaskBarContextData():void{
    const empty = Constants.EMPTY_STRING;
    this.taskBarContextMenuData = [
      {icon:empty, label: 'Show the desktop', action: this.showTheDesktop.bind(this)},
      {icon:empty, label: 'Task Manager', action: this.openTaskManager.bind(this)},
      {icon:empty, label: 'Hide the taskbar', action:this.hideTheTaskBar.bind(this)},
      {icon:empty, label: 'Merge taskbar Icons', action: this.mergeTaskBarButton.bind(this)}
    ]
  }

  private buildVantaEffect(n:number) {

    try {
      const vanta = this.VANTAS[n];
      if(n === 0){
        this._vantaEffect = VANTA.WAVES(VantaDefaults.getDefaultWave(this.DEFAULT_COLOR))
      }
      if(n === 1){
        this._vantaEffect = VANTA.RINGS(vanta)
      }
      if(n === 2){
        this._vantaEffect = VANTA.HALO(vanta)
      }
      if(n === 3){
        this._vantaEffect = VANTA.GLOBE(vanta)
      }
      if(n === 4){
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

    if(processCount == 0){
      this.tskBarAppIconMenuStyle = {
        'position':'absolute',
        'transform':`translate(${String(rect.x - 60)}px, ${String(rect.y - 72)}px)`,
        'z-index': 5,
      }
    }else {
      this.tskBarAppIconMenuStyle = {
        'position':'absolute',
        'transform':`translate(${String(rect.x - 60)}px, ${String(rect.y - 104)}px)`,
        'z-index': 5,
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

    const axis = this.checkAndHandleDesktopCntxtMenuBounds(evt, menuHeight, menuWidth);    
    this.tskBarCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${axis.xAxis + 2}px, ${evt.y - menuHeight - taskBarHeight}px)`,
      'z-index': 5,
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

    if(processCount === 0){
      if(this.taskBarAppIconMenuData.length === 3){
        this.taskBarAppIconMenuData.pop()
      }
    }else if(processCount === 1){
      if(this.taskBarAppIconMenuData.length === 2){
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
      this.clearTskBarRelatedTimeout();
    }

    this.tskBarPrevWindowStyle = {
      'position':'absolute',
      'transform':`translate(${String(rect.x)}px, ${String(rect.y - 131)}px)`,
      'z-index': 5,
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
    this.clearTskBarRelatedTimeout();
  }

  showTaskBarToolTip(data:unknown[]):void{
    const delay = 1500; //1.5secs
    const rect = data[0] as number[];
    const xAxis = rect[0]; const yAxis = rect[1];
    const appName = data[1] as string;

    this.tskBarToolTipText = appName;

   this.showTskBarToolTipTimeoutId = setTimeout(() => {
      this.showTaskBarIconToolTip = true
      this.tskBarToolTipStyle = {
        'position':'absolute',
        'z-index': 5,
        'transform': `translate(${xAxis- 6}px, ${yAxis - 20}px)`
      }
    }, delay);
  }

  hideTaskBarToolTip():void{
    const delay = 200; //200msecs

    clearTimeout(this.showTskBarToolTipTimeoutId);
    setTimeout(() => {
      this.showTaskBarIconToolTip = false;
    }, delay);
  }

  removeOldTaskBarPreviewWindowNow():void{
    this.showTskBarPreviewWindow = false;
  }

  clearTskBarRelatedTimeout():void{
    clearTimeout(this.hideTskBarPrevWindowTimeoutId);
    clearTimeout(this.removeTskBarPrevWindowFromDOMTimeoutId);
  }

  async onDrop(event:DragEvent):Promise<void>{
    const evtOriginator = this._runningProcessService.getEventOrginator();
    console.log('Dsktp onDrop evtOriginator:', evtOriginator);

    if(evtOriginator === Constants.EMPTY_STRING){
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
          // this._fileService.addEventOriginator('desktop');
          // this._fileService.dirFilesUpdateNotify.next();
          this.refresh();
        }
      }
    }
        
  }
  
  protected async loadFiles(): Promise<void> {
    this.files = [];
		this.files = await this._fileService.loadDirectoryFiles(this.directory);
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

  async runProcess(file:FileInfo):Promise<void>{
    console.log('desktopmanager-runProcess:',file)
    await this._audioService.play(this.cheetahNavAudio);
    this._processHandlerService.startApplicationProcess(file);
    this.btnStyleAndValuesReset();
  }

  onBtnClick(evt:MouseEvent, id:number):void{
    this.doBtnClickThings(id);
    this.setBtnStyle(id, true);
  }

  onTriggerRunProcess():void{
    this.runProcess(this.selectedFile);
  }
  
  onShowDesktopIconCntxtMenu(evt:MouseEvent, file:FileInfo, id:number):void{
    const menuHeight = 253; //this is not ideal.. menu height should be gotten dynmically
    const uid = `${this.name}-${this.processId}`;
    this._runningProcessService.addEventOriginator(uid);
    this._menuService.hideContextMenus.next();

    this.adjustIconContextMenuData(file);
    this.selectedFile = file;
    this.propertiesViewFile = file;
    this.showDesktopIconCntxtMenu = true;

    // show IconContexMenu is still a btn click, just a different type
    this.doBtnClickThings(id);

    const axis = this.checkAndHandleDesktopIconCntxtMenuBounds(evt, menuHeight);
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

  adjustIconContextMenuData(file:FileInfo):void{
    this.menuData = [];
    if(file.getIsFile){
        //files can not be opened in terminal, pinned to start, opened in new window, or pin to Quick access
        this.menuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
        for(const x of this.sourceData) {
          if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Pin to Start' || x.label === 'Empty Recycle Bin'){ /*nothing*/}
          else{
            this.menuData.push(x);
          }
        }
    }else{
      if(file.getCurrentPath === Constants.RECYCLE_BIN_PATH){ 
        this.menuOrder = Constants.RECYCLE_BIN_MENU_ORDER;
        for(const x of this.sourceData){
          if(x.label === 'Open' || x.label === 'Empty Recycle Bin' || x.label === 'Create shortcut'){ 
            this.menuData.push(x);
          }
        }
      }else{
        this.menuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
        this.menuData = this.sourceData.filter(x => x.label !== 'Empty Recycle Bin');
      }
    }
  }
  
  checkAndHandleDesktopIconCntxtMenuBounds(evt:MouseEvent, menuHeight:number):MenuPosition{

    let yAxis = 0;
    let verticalShift = false;

    const xAxis = 0;
    const taskBarHeight = 40;
    const mainWindow = document.getElementById('vanta');
    const windowHeight =  mainWindow?.offsetHeight || 0;
    const verticalSum = evt.clientY + menuHeight;

    console.log('verticalSum:', verticalSum);

    if(verticalSum >= windowHeight || (windowHeight - verticalSum) <= 40){
      verticalShift = true;
      const shifMenuUpBy = verticalSum - windowHeight;
      yAxis = evt.clientY - (shifMenuUpBy + taskBarHeight);
    }

    if(!verticalShift){
      yAxis = evt.clientY;
    }

    return {xAxis, yAxis};
  }

  doNothing():void{
    console.log('do nothing called');
  }

  onCopy():void{
    const action = MenuAction.COPY;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  onCut():void{
    const action = MenuAction.CUT;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  async onPaste():Promise<void>{
    const cntntPath = this._menuService.getPath();
    const action = this._menuService.getActions();

    console.log(`path: ${cntntPath}`);
    console.log(`action: ${action}`);

    //onPaste will be modified to handle cases such as multiselect, file or folder or both

    if(action === MenuAction.COPY){
      const result = await this._fileService.copyAsync(cntntPath,  Constants.DESKTOP_PATH);
      if(result){
        this.refresh();
      }
    }
    else if(action === MenuAction.CUT){
      const delay = 20; //20ms
      const result = await this._fileService.moveAsync(cntntPath, Constants.DESKTOP_PATH);
      if(result){
        if(!cntntPath.includes(Constants.DESKTOP_PATH)){
          console.log('refresh explor')
          this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
          this._fileService.dirFilesUpdateNotify.next();


          await CommonFunctions.sleep(delay)
          this.refresh();
        }else{
            this.refresh();
        }
      }
    }
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
      else if((id === this.selectedElementId) && !this.isIconInFocusDueToPriorAction){
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
    const figCapElement = document.getElementById(`figCap${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.borderColor = Constants.EMPTY_STRING;
    }

    if(figCapElement){
        figCapElement.style.overflow = 'hidden'; 
        figCapElement.style.overflowWrap = 'unset'
        figCapElement.style.webkitLineClamp = '2';
    }
  }

  setBtnStyle(id:number, isMouseHover:boolean):void{
    const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
    const figCapElement = document.getElementById(`figCap${id}`) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';


      if(this.selectedElementId === id){
        (isMouseHover)? btnElement.style.backgroundColor ='#607c9c' : 
          btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
      }

      if(!isMouseHover && this.isIconInFocusDueToPriorAction){
        btnElement.style.backgroundColor = Constants.EMPTY_STRING;
        btnElement.style.border = '1px solid white'
      }
    }

    if(figCapElement){
      if(this.selectedElementId === id){
          figCapElement.style.overflow = 'unset'; 
          figCapElement.style.overflowWrap = 'break-word';
          figCapElement.style.webkitLineClamp = 'unset'
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
    const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
    return btnIcons.length;
  }
  
  getIDsOfAllTheMarkedButtons():void{
    const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
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
        btnIcon.classList.remove('desktopIcon-multi-select-highlight');
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
  
  // hideIconContextMenu(caller?:string):void{
  //   this.showDesktopIconCntxtMenu = false;
  //   // to prevent an endless loop of calls,
  //   if(caller !== undefined && caller === this.name){
  //     this._menuService.hideContextMenus.next();
  //   }
  // }

  handleIconHighLightState():void{

    //First case - I'm clicking only on the desktop icons
    if((this.isBtnClickEvt && this.btnClickCnt >= 1) && (!this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt === 0)){  
      if(this.isRenameActive){
        console.log('herer');
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
      if((this.isHideCntxtMenuEvt && this.hideCntxtMenuEvtCnt >= 1) && (!this.isBtnClickEvt && this.btnClickCnt === 0)){
        this.deskTopClickCounter++;
        this.btnStyleAndValuesReset();

        //reset after clicking on the desktop 2wice
        if(this.deskTopClickCounter >= 1 && !this.areMultipleIconsHighlighted){
          this.deskTopClickCounter = 0;
        }else if(this.deskTopClickCounter >= 2){
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
    if(this.isWindowDragActive) return;

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
    divElmnt.style.border = '1px solid #047cd4';
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

    const btnIcons = document.querySelectorAll('.desktopIcon-btn');
    btnIcons.forEach((btnIcon) => {
        const btnIconRect = btnIcon.getBoundingClientRect();

        // Check if the item is inside the selection area
        if ( btnIconRect.right > selectionRect.left && btnIconRect.left < selectionRect.right &&
            btnIconRect.bottom > selectionRect.top && btnIconRect.top < selectionRect.bottom){
            btnIcon.classList.add('desktopIcon-multi-select-highlight'); 
        } else {
            btnIcon.classList.remove('desktopIcon-multi-select-highlight');
        }
    });
  }

  onDragEnd(evt:DragEvent):void{
    // Get the cloneIcon container
    const elementId = 'desktopIcon_clone_cntnr';
    const mPos:mousePosition = {
      clientX: evt.clientX,
      clientY: evt.clientY,
      offsetX: evt.offsetX,
      offsetY: evt.offsetY,
      x: evt.x,
      y: evt.y,
    }

    if(this.autoAlignIcons && this.markedBtnIds.length >= 0){
      this.moveBtnIconsToNewPositionAlignOn(mPos);
    }else if (!this.autoAlignIcons && this.markedBtnIds.length >= 0){
      this.moveBtnIconsToNewPositionAlignOff(mPos);
    }

    const cloneIcon = document.getElementById(elementId);
    if(cloneIcon) 
      cloneIcon.innerHTML = Constants.EMPTY_STRING;
    
  }
  
  onDragStart(evt:DragEvent, i: number): void {
  
    // Get the cloneIcon container
    const elementId = 'desktopIcon_clone_cntnr';
    const cloneIcon = document.getElementById(elementId);
    const countOfMarkedBtns = this.getCountOfAllTheMarkedButtons();
    let counter = 0;

    if(cloneIcon){
      //Clear any previous content in the clone container
      cloneIcon.innerHTML = Constants.EMPTY_STRING;
      if(countOfMarkedBtns <= 1){
        this.draggedElementId = i;
        const srcIconElmnt = document.getElementById(`iconBtn${i}`) as HTMLElement;

        cloneIcon.appendChild(srcIconElmnt.cloneNode(true));

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
          const spaceDiv = document.createElement('div');

          // Add create an empty div that will be used for spacing between each cloned icon
          spaceDiv.setAttribute('id', `spacediv${id}`);
          spaceDiv.style.transform =  'translate(0, 0)';
          spaceDiv.style.width =  'fit-content';
          spaceDiv.style.height =  '20px';

          cloneIcon.appendChild(srcIconElmnt.cloneNode(true));
          if(counter !== countOfMarkedBtns - 1)
            cloneIcon.appendChild(spaceDiv);

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
      const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`) as HTMLElement;

      this.movedBtnIds.push(id);
      if(btnIconElmnt){
        const btnIconRect = btnIconElmnt.getBoundingClientRect();
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
    const gridEl = document.getElementById('desktopIcon_ol') as HTMLElement;
    const heightAdjustment = 20;
    const iconWidth = this.GRID_SIZE; 
    const iconHeight = this.GRID_SIZE - heightAdjustment;  

    if (!gridEl) return;

    const rect = gridEl.getBoundingClientRect();
    const relativeX = mPos.x - rect.left;
    const relativeY = mPos.y - rect.top;

    const effectiveRowHeight = iconHeight + this.ROW_GAP;

    let counter = 0;
    let justAdded = false;

    if (this.markedBtnIds.length === 0) {
      justAdded = true;
      this.markedBtnIds.push(String(this.draggedElementId));
    }

    this.markedBtnIds.forEach(id => {
      const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`) as HTMLElement;
      this.movedBtnIds.push(id);

      if (btnIconElmnt) {
        // Calculate grid position (1-based index for CSS Grid)
        const col = Math.floor(relativeX / iconWidth) + 1;
        const row = Math.floor(relativeY / effectiveRowHeight) + 1 + counter;

        btnIconElmnt.style.removeProperty('position');
        btnIconElmnt.style.removeProperty('transform');
        btnIconElmnt.style.setProperty('--grid-col', col.toString());
        btnIconElmnt.style.setProperty('--grid-row', row.toString());
        btnIconElmnt.style.gridColumn = `var(--grid-col)`;
        btnIconElmnt.style.gridRow = `var(--grid-row)`;
      }

      counter++;
    });

    if (justAdded) 
      this.markedBtnIds.pop();
  }

  correctMisalignedIcons(): void {
    const heightAdjustment = 20;
    const iconWidth = this.GRID_SIZE;
    const iconHeight = this.GRID_SIZE - heightAdjustment
    const rowGap = this.ROW_GAP; 
    const effectiveRowHeight = iconHeight + rowGap; 
    const offsetY = 5;

    const grid = document.getElementById('desktopIcon_ol');
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();

    this.movedBtnIds.forEach((id) => {
      const btnIcon = document.getElementById(`desktopIcon_li${id}`);
      if (!btnIcon) return;

      const iconRect = btnIcon.getBoundingClientRect();

      // Convert to coordinates relative to the grid container
      const relativeLeft = iconRect.left - gridRect.left;
      const relativeTop = iconRect.top - gridRect.top;

      // Snap to nearest column and row
      const correctedX = Math.round(relativeLeft / iconWidth) * iconWidth;
      const correctedY = Math.round(relativeTop / effectiveRowHeight) * effectiveRowHeight;

      // Apply corrected transform (positioning within grid)
      btnIcon.style.position = 'absolute';
      btnIcon.style.transform = `translate(${correctedX}px, ${correctedY + offsetY}px)`;
    });
  }


  sortIcons(sortBy:string):void {
    this.files = CommonFunctions.sortIconsBy(this.files, sortBy);
  }

  changeIconsSize(iconSize:string):void{
    const iconsSizes:number[][] = [[IconsSizesPX.SMALL_ICONS, ShortCutIconsSizes.SMALL_ICONS, ShortCutIconsBottom.SMALL_ICONS], 
                                   [IconsSizesPX.MEDIUM_ICONS, ShortCutIconsSizes.MEDIUM_ICONS, ShortCutIconsBottom.MEDIUM_ICONS], 
                                   [IconsSizesPX.LARGE_ICONS, ShortCutIconsSizes.LARGE_ICONS, ShortCutIconsBottom.LARGE_ICONS], 
                                  ];

    const size = (iconSize === IconsSizes.SMALL_ICONS) ? iconsSizes[0] :
                 (iconSize === IconsSizes.MEDIUM_ICONS) ? iconsSizes[1] :
                 iconsSizes[2];

    this.GRID_SIZE = (iconSize === IconsSizes.SMALL_ICONS) ? this.MIN_GRID_SIZE :
                     (iconSize === IconsSizes.MEDIUM_ICONS) ? this.MID_GRID_SIZE :
                     this.MAX_GRID_SIZE;

    this.iconSizeStyle = {
      'width': `${size[0]}px`, 
      'height': `${size[0]}px`,
    }
    this.shortCutIconSizeStyle = {
      'width': `${size[1]}px`, 
      'height': `${size[1]}px`,
      'bottom': `${size[2]}px`
    }
    this.figCapIconSizeStyle ={
      'width': `${this.GRID_SIZE}px`, 
    }
  }

  changeGridRowColSize():void{
    const rowSpace  = this.ROW_GAP; //row space of 25px between each icons

    const colSize = (this.GRID_SIZE === this.MAX_GRID_SIZE) ? this.MAX_GRID_SIZE :
                    (this.GRID_SIZE === this.MID_GRID_SIZE) ? this.MID_GRID_SIZE :
                    this.MIN_GRID_SIZE;

    const rowSize = (this.GRID_SIZE === this.MAX_GRID_SIZE)? (this.MAX_GRID_SIZE - rowSpace) :
                    (this.GRID_SIZE === this.MID_GRID_SIZE)? (this.MID_GRID_SIZE - rowSpace) :
                    (this.MIN_GRID_SIZE - rowSpace);

    const dsktpmngrOlElmnt = document.getElementById('desktopIcon_ol') as HTMLElement;
    if(dsktpmngrOlElmnt){
      dsktpmngrOlElmnt.style.gridTemplateColumns = `repeat(auto-fill, ${colSize}px)`;
      dsktpmngrOlElmnt.style.gridTemplateRows = `repeat(auto-fill,${rowSize}px)`;
    }

    this.btnStyle = {
      'width': `${colSize}px`, 
      'height': 'min-content',
      // 'height': `${rowSize}px`,
    }
  }

  async onDelete():Promise<void>{
    let result = false;
    result = await this._fileService.deleteAsync(this.selectedFile.getCurrentPath, this.selectedFile.getIsFile);
    if(result){
      this._menuService.resetStoreData();
      await this.loadFiles();
    }
  }

  async onEmptyRecyleBin():Promise<void>{
    let result = false;
    const isRecycleBin = true;
    const isFile = false;

    await this._audioService.play(this.emptyTrashAudio);
    result = await this._fileService.deleteAsync(Constants.RECYCLE_BIN_PATH, isFile, isRecycleBin);
    if(result){
      this._menuService.resetStoreData();
      await this.loadFiles();
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
      await this.loadFiles();
    }
  }
  
  onInputChange(evt: KeyboardEvent): boolean {
    const regexStr = '^[a-zA-Z0-9_.\\s-]+$';
    const key = evt.key;

    // Block enter
    if (key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      console.log('llasdlaldlasd')
      this.isFormDirty();
      return true;
    }

    const isValid = new RegExp(regexStr).test(key);

    if (isValid) {
      this.hideInvalidCharsToolTip();
      this.autoResize();
      return true;
    } else {
      this.showInvalidCharsToolTip();
      setTimeout(() => this.hideInvalidCharsToolTip(), this.SECONDS_DELAY[0]);
      return false;
    }
  }


  autoResize() {
    const renameTxtBoxElmt = document.getElementById(`renameTxtBox${this.selectedElementId}`) as HTMLTextAreaElement;
    if(renameTxtBoxElmt){
      renameTxtBoxElmt.style.height = 'auto'; // Reset the height
      renameTxtBoxElmt.style.height = renameTxtBoxElmt.scrollHeight + 'px'; // Set new height
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


    if((figCapElement && renameContainerElement && renameTxtBoxElement)) {
      figCapElement.style.display = 'none';
      renameContainerElement.style.display = 'block';
      
      renameTxtBoxElement.style.display = 'block';
      renameTxtBoxElement.style.zIndex = '3'; // ensure it's on top

      this.currentIconName = this.selectedFile.getFileName;
      this.renameForm.setValue({
        renameInput:this.currentIconName
      })

      renameTxtBoxElement.focus();
      renameTxtBoxElement.select();
    }
  }
  
  async onRenameFileTxtBoxDataSave():Promise<void>{
    this.isRenameActive = !this.isRenameActive;

    const figCapElement = document.getElementById(`figCap${this.selectedElementId}`) as HTMLElement;
    const renameContainerElement = document.getElementById(`renameContainer${this.selectedElementId}`) as HTMLElement;
    const renameText = this.renameForm.value.renameInput as string;
 
    if(renameText !== Constants.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName ){
      const result =   await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText, this.selectedFile.getIsFile);

      if(result){
        // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
        const fileIdx = this.files.findIndex(f => (dirname(f.getCurrentPath) === dirname(this.selectedFile.getCurrentPath)) && (f.getFileName === this.selectedFile.getFileName));
        this.selectedFile.setFileName = renameText;
        this.selectedFile.setDateModified = Date.now().toString();
        this.files[fileIdx] = this.selectedFile;

        this.renameForm.reset();
        this._menuService.resetStoreData();
        await this.loadFiles();
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
    this.stopClippy();
    this.hideDesktopIcon(); 
    this.hideVolumeControl();
    this.hideDesktopContextMenuAndOthers();
    this.hideTaskBarPreviewWindow();
    this.hideTaskBarToolTip();
    this.closePwrDialogBox();
  }

  desktopIsActive():void{
    this.showDesktopIcon();
    this.restorPriorOpenApps();
    //this.startClippy();
  }

  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}