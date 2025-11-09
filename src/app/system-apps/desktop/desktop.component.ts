import { AfterViewInit, OnInit,OnDestroy, Component, ElementRef, ViewChild} from '@angular/core';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { BIRDS, GLOBE, HALO, RINGS, WAVE } from './vanta-object/vanta.interfaces';
import { ActivityType, SortBys } from 'src/app/system-files/common.enums';
import { Colors } from './colorutil/colors';
import { FileInfo } from 'src/app/system-files/file.info';

import { ScriptService } from 'src/app/shared/system-service/script.services';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

import { GeneralMenu, NestedMenu, NestedMenuItem } from 'src/app/shared/system-component/menu/menu.types';
import * as htmlToImage from 'html-to-image';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { basename, dirname} from 'path';
import { Constants } from 'src/app/system-files/constants';

import { TaskBarIconInfo } from '../taskbarentries/taskbar.entries.type';
import { FormBuilder, FormGroup } from '@angular/forms';
import { mousePosition, IconsSizes} from './desktop.types';
import { MenuAction } from 'src/app/shared/system-component/menu/menu.enums';

import { VantaDefaults } from './vanta-object/vanta.defaults';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { DesktopGeneralHelper } from './desktop.general.helper';
import { DesktopContextMenuHelper } from './desktop.context.menu.helper';
import { DesktopIconAlignmentHelper } from './desktop.icon.alignment.helper';
import { DesktopStyleHelper } from './desktop.style.helper';
import { DragEventInfo } from 'src/app/system-files/common.interfaces';
import { concatMap } from 'rxjs';

declare let VANTA: { HALO: any; BIRDS: any;  WAVES: any;   GLOBE: any;  RINGS: any;};
@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('slideStatusAnimation', [
      state('slideOut', style({ right: '-488px' })),
      state('slideIn', style({ right: '8px' })),

      transition('* => slideIn', [
        animate('250ms ease-in')
      ]),
      transition('slideIn => slideOut', [
        animate('550ms ease-out')
      ]),
    ])
  ]
})

export class DesktopComponent implements OnInit, OnDestroy, AfterViewInit{
  @ViewChild('desktopContainer', {static: true}) desktopContainer!: ElementRef; 
  
  private _fileService!:FileService
  private _menuService!:MenuService;
  private _audioService!:AudioService;
  private _windowService!:WindowService;
  private _scriptService!:ScriptService;
  private _defaultService!:DefaultService;
  private _processIdService!:ProcessIDService;
  private _processHandlerService!:ProcessHandlerService;
  private _runningProcessService!:RunningProcessService;
  private _systemNotificationServices!:SystemNotificationService;
  private _userNotificationService!:UserNotificationService;
  private _activityHistoryService!:ActivityHistoryService;

  private _elRef:ElementRef;
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
  isDragFromDesktopActive = false;
  isDesktopTheCaller = true;

  autoAlignIcons = true;
  autoArrangeIcons = true;
  showDesktopIcons = true;
  showDesktopScreenShotPreview = false;
  showTaskBarIconToolTip = false;
  showVolumeCntrl = false;
  showOverflowPane = false;
  
  showClippy = false;
  dsktpPrevImg = Constants.EMPTY_STRING;
  slideState = 'slideOut';

  startVantaWaveColorChg = false;

  dskTopCntxtMenuStyle:Record<string, unknown> = {};
  tskBarAppIconMenuStyle:Record<string, unknown> = {};
  tskBarCntxtMenuStyle:Record<string, unknown> = {};
  tskBarPrevWindowStyle:Record<string, unknown> = {};
  tskBarToolTipStyle:Record<string, unknown> = {};

  deskTopMenuOption =  Constants.NESTED_MENU_OPTION;
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

  showDesktopIconCntxtMenu = false;
  showDesktopCntxtMenu = false;
  showTskBarAppIconCntxtMenu = false;
  showTskBarCntxtMenu = false;

  removeTskBarPrevWindowFromDOMTimeoutId!: NodeJS.Timeout;
  hideTskBarPrevWindowTimeoutId!: NodeJS.Timeout;
  showTskBarToolTipTimeoutId!: NodeJS.Timeout;
  clippyIntervalId!: NodeJS.Timeout;
  colorChgIntervalId!: NodeJS.Timeout;
  invalidCharTimeOutId!: NodeJS.Timeout;
  taskbarHideDelayTimeOutId !: NodeJS.Timeout;

  private readonly DESKTOP_SCREEN_SHOT_DIRECTORY ='/Users/Pictures/Screen-Shots';
  private readonly TERMINAL_APP ="terminal";
  private readonly TEXT_EDITOR_APP ="texteditor";
  private readonly CODE_EDITOR_APP ="codeeditor";
  private readonly MARKDOWN_VIEWER_APP ="markdownviewer";
  private readonly TASK_MANAGER_APP ="taskmanager";
  private readonly CLIPPY_APP = "clippy";
  private readonly PHOTOS_APP = "photoviewer";

  waveBkgrnd:WAVE =  {el:'#vantaCntnr'}
  ringsBkgrnd:RINGS =  {el:'#vantaCntnr'}
  haloBkgrnd:HALO =  {el:'#vantaCntnr'}
  globeBkgrnd:GLOBE =  {el:'#vantaCntnr'}
  birdBkgrnd:BIRDS =  {el:'#vantaCntnr'}

  VANTAS:any = [this.waveBkgrnd, this.ringsBkgrnd, this.haloBkgrnd, this.globeBkgrnd, this.birdBkgrnd ];
  private readonly vantaBackgroundName:string[] = ["vanta_wave","vanta_ring","vanta_halo", "vanta_globe", "vanta_bird"];
  private readonly vantaBackGroundPath:string[] = ["osdrive/Program-Files/Backgrounds/vanta.waves.min.js",  
                                          "osdrive/Program-Files/Backgrounds/vanta.rings.min.js",
                                          "osdrive/Program-Files/Backgrounds/vanta.halo.min.js", 
                                          "osdrive/Program-Files/Backgrounds/vanta.globe.min.js",
                                          "osdrive/Program-Files/Backgrounds/vanta.birds.min.js"];
  DESKTOP_PICTURES:string[] = [];

  private readonly MIN_NUMS_OF_DESKTOPS = 0;
  // i didn't subtract 1 because there is a particles flows bkgrnd in the names array
  private  maxNumberOfDesktopsBkgrnd = this.VANTAS.length-1;
  private readonly CLIPPY_INIT_DELAY = 300000; // 5mins
  private readonly COLOR_CHANGE_DELAY = 30000; // 30secs
  private readonly COLOR_TRANSITION_DURATION = 1500; // 1.5sec
  private readonly MIN_NUM_COLOR_RANGE = 200;
  private readonly MAX_NUM_COLOR_RANGE = 99999;
  private readonly DEFAULT_COLOR = 0x274c;
  private readonly DESKTOP_MENU_DELAY = 250; //250ms

  private currentDesktopNum = 0;

  readonly cheetahDsktpIconSortKey = 'cheetahDsktpIconSortKey';
  readonly cheetahDsktpIconSizeKey = 'cheetahDsktpIconSizeKey';
  readonly cheetahDsktpHideTaskBarKey = 'cheetahDsktpHideTaskBarKey';

  deskTopMenu:NestedMenu[] = [];
  taskBarContextMenuData:GeneralMenu[] = [];
  taskBarAppIconMenuData:GeneralMenu[] = [
    {icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: this.initApplicationFromTaskBar.bind(this)},
    {icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: ()=> console.log() },
  ];

  private isRenameActive = false;
  private isIconInFocusDueToPriorAction = false;
  private isIconBtnClickEvt= false;

  isWindowDragActive = false;
  isMultiSelectEnabled = true;
  isMultiSelectActive = false;
  areMultipleIconsHighlighted = false;
  isRestored = false;

  private selectedFile!:FileInfo;
  private propertiesViewFile!:FileInfo;
  private screenShot!:FileInfo;
  private currIconId = -1;
  private draggedElementId = -1;
  private prevIconId = -1; 
  private iconBtnClickCnt = 0;
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
  SECONDS_DELAY:number[] = [6000, 250, 4000, 350];
  renameForm!: FormGroup;

  desktopClickCounter = 0;

  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;
  readonly emptyTrashAudio = `${Constants.AUDIO_BASE_PATH}cheetah_recycle.wav`;
  readonly systemNotificationAudio = `${Constants.AUDIO_BASE_PATH}cheetah_notify_system_generic.wav`;
  readonly shortCutImg = `${Constants.IMAGE_BASE_PATH}shortcut.png`;
  readonly cameraImg = `${Constants.IMAGE_BASE_PATH}camera.png`
  readonly closeImg = `${Constants.IMAGE_BASE_PATH}x_32.png`

  readonly screenShotText = `
  Screenshots are saved in the screenshots folder.
  Click on the image to view it in photos app.
  `;

  multiSelectElmnt!:HTMLDivElement | null;
  multiSelectStartingPosition!:MouseEvent | null;

  markedBtnIds:string[] = [];
  movedBtnIds:string[] = [];
  files:FileInfo[] = [];

  sourceData:GeneralMenu[] = [
    {icon:'', label: 'Open', action: this.onTriggerRunApplication.bind(this) },
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
  desktopBackgroundType = Constants.EMPTY_STRING;
  desktopBackgroundValue = Constants.EMPTY_STRING;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'desktop';
  processId = 0;
  uniqueId = Constants.EMPTY_STRING;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;
  directory = Constants.DESKTOP_PATH;

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService, 
              scriptService:ScriptService, audioService:AudioService, menuService:MenuService, 
              fileService:FileService, windowService:WindowService, systemNotificationServices:SystemNotificationService,
              userNotificationService:UserNotificationService, activityHistoryService:ActivityHistoryService, formBuilder:FormBuilder,
              defaultService: DefaultService, elRef:ElementRef) { 

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
    this._activityHistoryService = activityHistoryService;
    this._defaultService = defaultService;
    this._formBuilder = formBuilder;
    this._elRef = elRef;

    // these are subs, but the desktop cmpnt is not going to be destoryed
    this._menuService.showTaskBarAppIconMenu.pipe(concatMap((p) =>this.onShowTaskBarAppIconMenu(p))).subscribe();
    this._menuService.showTaskBarConextMenu.pipe(concatMap((p) =>this.onShowTaskBarContextMenu(p))).subscribe();
    this._audioService.showVolumeControlNotify.pipe(concatMap(() => this.showVolumeControl())).subscribe();
    this._menuService.showOverFlowMenu.pipe(concatMap(() => this.showSysTrayOverFlowPane())).subscribe();

    this._menuService.hideContextMenus.subscribe((p) => { 
      if(p !== this.name)
        this.resetIconBtnsAndContextMenus();
    });

    this._windowService.hideProcessPreviewWindowNotify.subscribe(() => { this.hideTaskBarPreviewWindow()});
    this._windowService.keepProcessPreviewWindowNotify.subscribe(() => { this.keepTaskBarPreviewWindow()});
    this._windowService.windowDragIsActive.subscribe(() => {this.isWindowDragActive = true;});
    this._windowService.windowDragIsInActive.subscribe(() => {this.isWindowDragActive = false;}); 
    this._audioService.hideVolumeControlNotify.subscribe(() => { this.hideVolumeControl()});
    this._windowService.showProcessPreviewWindowNotify.subscribe((p) => { this.showTaskBarPreviewWindow(p)});

    this._fileService.dirFilesUpdateNotify.subscribe(async () =>{
      if(this._fileService.getEventOriginator() === this.name){
        await this.loadFiles();
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

    this._menuService.updateTaskBarContextMenu.subscribe(() =>{this.resetMenuOption()});
    this._systemNotificationServices.showTaskBarToolTipNotify.subscribe((p)=>{this.showTaskBarToolTip(p)});
    this._systemNotificationServices.hideTaskBarToolTipNotify.subscribe(() => {this.hideTaskBarToolTip()});

    this._defaultService.defaultSettingsChangeNotify.subscribe((p) =>{
      if(p === Constants.DEFAULT_DESKTOP_BACKGROUND){
        this.getDesktopBackgroundData();
        this.setDesktopBackgroundData();
      }

      if(p === Constants.DEFAULT_AUTO_HIDE_TASKBAR){
        this.setTaskBarVisibilityState();
      }

      if(p === Constants.DEFAULT_TASKBAR_COMBINATION){
        this.setTaskBarCombinationState();
      }
    });

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._numSequence = this.getRandomInt(this.MIN_NUM_COLOR_RANGE, this.MAX_NUM_COLOR_RANGE);
  }

  ngOnInit():void{
    this.uniqueId = `${this.name}-${this.processId}`;
    this.renameForm = this._formBuilder.nonNullable.group({
      renameInput: Constants.EMPTY_STRING,
    });

    this.getDesktopBackgroundData();
    this.setDesktopBackgroundData();

    //for quic dbg.
    //this.loadDefaultBackground();
    
    this.getDesktopMenuData();
    this.getTaskBarContextData();
    this.setTaskBarVisibilityState();
    this.setTaskBarCombinationState();
  }

  loadDefaultVantaBackground():void{
    this._scriptService.loadScript("vanta_waves", "osdrive/Program-Files/Backgrounds/vanta.waves.min.js").then(() =>{
      this._vantaEffect = VANTA.WAVES(VantaDefaults.getDefaultWave(this.DEFAULT_COLOR));
    })
  }

  loadPictureBackgrounds():void{
    if(this.DESKTOP_PICTURES.length >= 7)
      return;

    const desktopImgPath = Constants.DESKTOP_IMAGE_BASE_PATH;
    const desktopImages =  Constants.DESKTOP_PICTURE_SET;
    desktopImages.forEach(imgName => { this.DESKTOP_PICTURES.push(`${desktopImgPath}${imgName}`)});
  }

  async ngAfterViewInit():Promise<void>{
    if(this.startVantaWaveColorChg)
      this.startVantaWaveColorChange();

    this.initClippy();

    this.removeVantaJSSideEffect();
    await CommonFunctions.sleep(this.SECONDS_DELAY[3]);
    await this.loadFiles();
  }

  ngOnDestroy(): void {
    this._vantaEffect?.destroy();
  }

  destoryVanta():void{
    this._vantaEffect?.destroy();
  }

  getDesktopBackgroundData():void{
    const defaultBkgrnd = this._defaultService.getDefaultSetting(Constants.DEFAULT_DESKTOP_BACKGROUND).split(Constants.COLON);
    this.desktopBackgroundType = defaultBkgrnd[0];
    this.desktopBackgroundValue = defaultBkgrnd[1];

    if(this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC){
      this.currentDesktopNum = 0;
      this.maxNumberOfDesktopsBkgrnd = this.VANTAS.length - 1; 
    }else if(this.desktopBackgroundType === Constants.BACKGROUND_PICTURE){
      this.currentDesktopNum = 0;
      this.loadPictureBackgrounds();
      this.maxNumberOfDesktopsBkgrnd = Constants.DESKTOP_PICTURE_SET.length - 1;
    }
  }

  setStyle(desktopElmnt: HTMLDivElement, styleClasses:string[], activeClass:string) {
    // 🧹 Reset previous inline styles
    CommonFunctions.resetInlineStyles(desktopElmnt);
    desktopElmnt.classList.remove(...styleClasses);
    desktopElmnt.classList.add(activeClass);
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
        DesktopGeneralHelper.initializeApplication(this.CLIPPY_APP, 
          this._processHandlerService, this._activityHistoryService);
      }, this.CLIPPY_INIT_DELAY);
    }
  }

  stopClippy():void{
    //check if clippy is running, and end it
    const clippy = this._runningProcessService.getProcessByName(this.CLIPPY_APP);
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

  async showDesktopContextMenu(evt:MouseEvent): Promise<void>{
    evt.stopPropagation();
    evt.preventDefault();

    /**
     * There is a doubling of responses to certain events that exist on the 
     * desktop compoonent and any other component running at the time the event was triggered.
     * The desktop will always respond to the event, but other components will only respond when they are in focus.
     * If there is a count of 2 or more(highly unlikely) reponses for a given event, then, ignore the desktop's response
     */
    const evtOriginator = this._runningProcessService.getEventOriginator();
    console.log('showDesktopContextMenu - evtOriginator:',evtOriginator);

    if(evtOriginator === Constants.EMPTY_STRING){
      this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
      await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

      const menuHeight = 306; //this is not ideal.. menu height should be gotten dynmically
      const menuWidth = 210;
      this.showDesktopCntxtMenu = true;

      const result = DesktopContextMenuHelper.checkAndHandleDesktopCntxtMenuBounds(evt, menuHeight, menuWidth);
      const axis = result[0];
      this.isShiftSubMenuLeft = result[1];

      this.dskTopCntxtMenuStyle = {
        'position':'absolute',
        'width': '210px', 
        'transform':`translate(${String(axis.xAxis + 2)}px, ${String(axis.yAxis)}px)`,
        'z-index': 4,
        'opacity': 1
      }

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

  async captureComponentImg(): Promise<void>{
    const storeImgDelay = 500; // .5 sec
    const slideOutDelay = 3000; // 3 secs
    const hideDesktopScreenShotDelay = 1000; // 1 secs
    const colorOff = 'transparent';
    const colorOn = '#00adef';

    try{
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOff);
      //'#vanta > canvas'
      const dsktpCntnr = this.desktopContainer.nativeElement;
      const canvasElmnt = document.querySelector('.vanta-canvas') as HTMLCanvasElement;

      if (!dsktpCntnr) {
        console.error('Desktop container or Vanta canvas not found.');
        return;
      }

      console.log('canvasElmnt:', canvasElmnt);
      if (!canvasElmnt) {
        console.warn('Vanta canvas not found. Skipping Vanta');
      }

      this.showDesktopScreenShotPreview = true;
      const finalImg = await this.mergeGeneratedImages(dsktpCntnr, canvasElmnt);
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOn);

      this.slideState = 'slideIn';
      this.dsktpPrevImg = finalImg;

      await this._audioService.play(this.systemNotificationAudio);
      await CommonFunctions.sleep(storeImgDelay);
      await this.saveGeneratedImage(finalImg);

      await CommonFunctions.sleep(storeImgDelay);
      this._fileService.dirFilesUpdateNotify.next();

      await CommonFunctions.sleep(slideOutDelay);
      this.slideState = 'slideOut';

      await CommonFunctions.sleep(hideDesktopScreenShotDelay);
      this.showDesktopScreenShotPreview = false;

    }catch (err){
      console.error('Screenshot capture failed:', err);
      DesktopStyleHelper.changeMainDkstpBkgrndColor(colorOn);
      this.showDesktopScreenShotPreview = false;
    }
  }

  closeScreenShotPreview():void{
    this.showDesktopScreenShotPreview = false;
    this.screenShot = new FileInfo();
  }

  private async saveGeneratedImage(finalImg:string): Promise<void>{
    this.screenShot = new FileInfo();
    const timeStamp = DesktopGeneralHelper.getScreenShotTimeStamp();
    const fileName = `Screenshot ${timeStamp}.png`;
    this.screenShot.setFileName = fileName;
    this.screenShot.setCurrentPath = `${this.DESKTOP_SCREEN_SHOT_DIRECTORY}/${fileName}`;
    this.screenShot.setContentPath = finalImg;
    this.screenShot.setIconPath = finalImg;

    await this._fileService.writeFileAsync(this.DESKTOP_SCREEN_SHOT_DIRECTORY, this.screenShot);
    this.screenShot.setOpensWith = 'photoviewer';

    //###. if file explr is not running at the time of creation, this may be skipped 
    this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
  }

  private async mergeGeneratedImages(dsktpCntnr:HTMLElement, canvasElmnt:HTMLCanvasElement):Promise<string>{
    const htmlImg = await htmlToImage.toPng(dsktpCntnr);

    const vantaImg = new Image();
    if(canvasElmnt){
      const bkgrndImg =  canvasElmnt.toDataURL('image/png');
      vantaImg.src = bkgrndImg;
      await vantaImg.decode();
    }
  
    const foreGrndImg = new Image();
    foreGrndImg.src = htmlImg;
    await foreGrndImg.decode();

    const mergedImg = document.createElement('canvas');
    mergedImg.width = dsktpCntnr.offsetWidth;
    mergedImg.height = dsktpCntnr.offsetHeight; 

    const ctx = mergedImg.getContext('2d')!;
    if (!ctx) {
      console.error('Failed to get 2D rendering context.');
      return Constants.EMPTY_STRING;
    }

    // 1. Draw the Vanta background image first.
    if(canvasElmnt)
      ctx.drawImage(vantaImg, 0, 0, mergedImg.width, mergedImg.height);
    
    // 2. Draw the HTML content on top of the background.
    ctx.drawImage(foreGrndImg, 0, 0, mergedImg.width, mergedImg.height);
    ctx.imageSmoothingEnabled = true;

    return mergedImg.toDataURL('image/png');
  }

  async createFolder():Promise<void>{
    const folderName = Constants.NEW_FOLDER;
    const result =  await this._fileService.createFolderAsync(Constants.DESKTOP_PATH, folderName);
    if(result){
     await this.refresh();
    }
  }

  hideDesktopContextMenuAndOthers(isDesktopTheCaller:boolean):void{
    /**
     * There is a doubling of responses to certain events that exist on the 
     * desktop compoonent and any other component running at the time the event was triggered.
     * The desktop will always respond to the event, but other components will only respond when they are in focus.
     * If there is a count of 2 or more(highly unlikely) reponses for a given event, then, ignore the desktop's response
     */

    this.showDesktopCntxtMenu = false;
    this.showDesktopIconCntxtMenu = false;
    this.showTskBarAppIconCntxtMenu = false;
    this.showTskBarCntxtMenu = false;
    this.isShiftSubMenuLeft = false;

    if(this.showVolumeCntrl){
      this.showVolumeCntrl = false;
      this._audioService.hideVolumeControlNotify.next(Constants.EMPTY_STRING);
    }

    if(this.showOverflowPane){
      this.showOverflowPane = false;
      this._menuService.hideOverFlowMenu.next(Constants.EMPTY_STRING);
    }

    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
    this._menuService.hideSearchBox.next(Constants.EMPTY_STRING);
    this._menuService.hideStartMenu.next();

    this.closePwrDialogBox();

    // to prevent an endless loop of calls,
    if(isDesktopTheCaller)
      this._menuService.hideContextMenus.next(this.name);
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
    const pId = this._systemNotificationServices.getPwrDialogPid();
    if(pId !== 0){
      this._userNotificationService.closeDialogMsgBox(pId);
    }
  }

  showTaskBarTemporarily(evt:MouseEvent):void{
    const mainWindow = document.getElementById('vantaCntnr');
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

  async showVolumeControl(): Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);
    this.showVolumeCntrl = true;
  }

  hideVolumeControl():void{
    this.showVolumeCntrl = false;
  }

  async showSysTrayOverFlowPane(): Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);
    this.showOverflowPane = true;
  }

  hideSysTrayOverFlowPane():void{
    this.showOverflowPane = false;
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
      this.setViewBy(true, false, false);
    }

    if(viewBy === IconsSizes.MEDIUM_ICONS){
      this.setViewBy(false, true, false);
    }

    if(viewBy === IconsSizes.SMALL_ICONS){
      this.setViewBy(false, false, true);
    }

    this.changeIconsSize(viewBy);
    this.changeGridRowColSize();
    this.getDesktopMenuData();
  }

  setViewBy(isLargeIcon:boolean, isMediumIcon:boolean, isSmallIcon:boolean):void{
    this.isLargeIcon = isLargeIcon;
    this.isMediumIcon = isMediumIcon;
    this.isSmallIcon = isSmallIcon;
  }

  sortByNameM():void{
    this.sortBy(this.sortByName);
  }

  sortBySizeM():void{
    this.sortBy(this.sortBySize);
  }
  sortByItemTypeM():void{
    this.sortBy(this.sortByItemType);
  }
  sortByDateModifiedM():void{
    this.sortBy(this.sortByDateModified);
  }

  sortBy(sortBy:string):void{
    if(sortBy === SortBys.DATE_MODIFIED){
      this.setSortBy(true, false, false, false);
    }

    if(sortBy === SortBys.ITEM_TYPE){
      this.setSortBy(false, true, false, false);
    }

    if(sortBy === SortBys.NAME){
      this.setSortBy(false, false, true, false);
    }

    if(sortBy === SortBys.SIZE){
      this.setSortBy(false, false, false, true);
    }

    this.sortIcons(sortBy);
    this.getDesktopMenuData();
  }

  setSortBy(isSortByDateModified:boolean, isSortByItemType:boolean, isSortByName:boolean, isSortBySize:boolean):void{
    this.isSortByDateModified = isSortByDateModified;
    this.isSortByItemType = isSortByItemType;
    this.isSortByName = isSortByName;
    this.isSortBySize = isSortBySize;
  }

  async autoArrangeIcon():Promise<void>{
    this.autoArrangeIcons = !this.autoArrangeIcons;
    if(this.autoArrangeIcons){
      // clear (x,y) position of icons in memory
      const trueRefresh = false;
      await this.refresh(trueRefresh);
    }
    this.getDesktopMenuData();
  }

  async autoAlignIcon():Promise<void>{
    this.autoAlignIcons = !this.autoAlignIcons
    if(this.autoAlignIcons){
      DesktopIconAlignmentHelper.correctMisalignedIcons(this.movedBtnIds,
        this.GRID_SIZE, this.ROW_GAP);

      const trueRefresh = false;
      await this.refresh(trueRefresh);
    }
    this.getDesktopMenuData();
  }

  async refresh(trueRefresh = true):Promise<void>{
    this.isIconInFocusDueToPriorAction = false;

    if(trueRefresh)
      await this.loadFiles();
    else{
      const delay = 25;
      let tmpFiles:FileInfo[] = [];

      tmpFiles.push(...this.files);
      this.files = [];

      await CommonFunctions.sleep(delay);
      this.files.push(...tmpFiles);
      tmpFiles = [];
    }
  }

  hideDesktopIcon():void{
    this.showDesktopIcons = false;
    this.btnStyle ={ 'display': 'none' }
    this.getDesktopMenuData();
  }

  showDesktopIcon():void{
    this.showDesktopIcons = true;
    this.btnStyle ={'display': 'block' }
    this.getDesktopMenuData();
  }

  previousBackground():void{
    if(this.currentDesktopNum > this.MIN_NUMS_OF_DESKTOPS){
      this.currentDesktopNum--;
      const curNum = this.currentDesktopNum;

      if(this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC)
        this.loadOtherVantaBackgrounds(curNum);
      else  if(this.desktopBackgroundType === Constants.BACKGROUND_PICTURE)
        this.loadOtherPictureBackgrounds(curNum);
    }
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
  }

  nextBackground():void{
    if(this.currentDesktopNum < this.maxNumberOfDesktopsBkgrnd){
      this.currentDesktopNum++;
      const curNum = this.currentDesktopNum;

      if(this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC)
        this.loadOtherVantaBackgrounds(curNum);
      else  if(this.desktopBackgroundType === Constants.BACKGROUND_PICTURE)
        this.loadOtherPictureBackgrounds(curNum);
    }
    
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
  }

  loadOtherVantaBackgrounds(i:number):void{
    this.removeOldCanvas();
    const raiseEvent = false;
    this._scriptService.loadScript(this.vantaBackgroundName[i], this.vantaBackGroundPath[i]).then(() =>{

      this.buildVantaEffect(i);
      if(this.vantaBackgroundName[i] === "vanta_wave"){
        this.startVantaWaveColorChange();
      }else{
        this.stopVantaWaveColorChange();
      }

      const defaultDesktopBackgrounValue = `${this.desktopBackgroundType}:${this.vantaBackgroundName[i]}`;
      this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue, raiseEvent);
    })
  }

  loadOtherPictureBackgrounds(i:number):void{
    const desktopElmnt = document.getElementById('vantaCntnr') as HTMLDivElement;
    const raiseEvent = false;
    if(desktopElmnt){
      this.desktopBackgroundValue = this.DESKTOP_PICTURES[i];
      desktopElmnt.style.backgroundImage = `url(${this.desktopBackgroundValue})`;
      
      const defaultDesktopBackgrounValue = `${this.desktopBackgroundType}:${this.desktopBackgroundValue}`;
      this._defaultService.setDefultData(Constants.DEFAULT_DESKTOP_BACKGROUND, defaultDesktopBackgrounValue, raiseEvent);
    }
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
    const vantaDiv = document.getElementById('vantaCntnr') as HTMLElement;
    if(!vantaDiv) return;

    const canvases = vantaDiv.querySelectorAll('.vanta-canvas');
    canvases.forEach(canvas => vantaDiv.removeChild(canvas));

    // document.querySelectorAll('#vantaCntnr .vanta-canvas')
    // .forEach(el => el.remove());
  }

  openTerminal():void{
    DesktopGeneralHelper.initializeApplication(this.TERMINAL_APP, this._processHandlerService, this._activityHistoryService);
  }

  openTextEditor():void{
    DesktopGeneralHelper.initializeApplication(this.TEXT_EDITOR_APP, this._processHandlerService, this._activityHistoryService);
  }

  openCodeEditor():void{
    DesktopGeneralHelper.initializeApplication(this.CODE_EDITOR_APP, this._processHandlerService, this._activityHistoryService);
  }

  openMarkDownViewer():void{
    DesktopGeneralHelper.initializeApplication(this.MARKDOWN_VIEWER_APP, this._processHandlerService, this._activityHistoryService);
  }

  openTaskManager():void{
    DesktopGeneralHelper.initializeApplication(this.TASK_MANAGER_APP, this._processHandlerService, this._activityHistoryService);
  }

  async openPhotos(): Promise<void>{
    const delay = 1000; //1 sec
    this.showDesktopScreenShotPreview = false;
    await CommonFunctions.sleep(delay);
    DesktopGeneralHelper.initializeApplication(this.PHOTOS_APP, this._processHandlerService, this._activityHistoryService, this.screenShot);
  }

  buildViewByMenu():NestedMenuItem[]{

    const funct = (this.showDesktopIcons) ? this.hideDesktopIcon.bind(this) : this.showDesktopIcon.bind(this);
    const viewByMenu = DesktopGeneralHelper.handleBuildViewByMenu(this.viewBySmallIcon.bind(this), this.isSmallIcon,
    this.viewByMediumIcon.bind(this), this.isMediumIcon, this.viewByLargeIcon.bind(this),  this.isLargeIcon,
    this.autoArrangeIcon.bind(this),  this.autoArrangeIcons, this.autoAlignIcon.bind(this), this.autoAlignIcons,
    funct, this.showDesktopIcons);

    return viewByMenu;
  }

  buildSortByMenu(): NestedMenuItem[]{

    const sortByMenu = DesktopGeneralHelper.hanldeBuildSortByMenu(this.sortByNameM.bind(this),  this.isSortByName,
    this.sortBySizeM.bind(this), this.isSortBySize,
    this.sortByItemTypeM.bind(this),  this.isSortByItemType,
    this.sortByDateModifiedM.bind(this), this.isSortByDateModified);

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

  resetIconBtnsAndContextMenus(isDesktopTheCaller = false):void{
    this.hideDesktopContextMenuAndOthers(isDesktopTheCaller);
    this.btnStyleAndValuesReset();
  }

  async onShowTaskBarAppIconMenu(data:unknown[]): Promise<void>{
    //--------------------
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY)

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
    this.showTskBarAppIconCntxtMenu = true;

    if(processCount === 0){
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
    this.showTskBarAppIconCntxtMenu = false;
  }

  showTaskBarAppIconMenu():void{
    this.showTskBarAppIconCntxtMenu = true;
  }

  async onShowTaskBarContextMenu(evt:MouseEvent):Promise<void>{
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

    const menuHeight = 116;
    const menuWidth = 203;
    const taskBarHeight = 40;
    this.showTskBarCntxtMenu = true;

    const result = DesktopContextMenuHelper.checkAndHandleDesktopCntxtMenuBounds(evt, menuHeight, menuWidth);  
    const axis = result[0];
    this.isShiftSubMenuLeft = result[1];
    
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
        this.taskBarAppIconMenuData.pop();
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

  initApplicationFromTaskBar():void{
    this.showTskBarAppIconCntxtMenu = false;
    const file = this.selectedTaskBarFile;  
    this._processHandlerService.runApplication(file);
  }

  closeApplicationFromTaskBar():void{
    this.showTskBarAppIconCntxtMenu = false;
    const file = this.selectedTaskBarFile;
    const proccesses = this._runningProcessService.getProcesses()
      .filter(p => p.getProcessName === file.getOpensWith);

    this._menuService.closeApplicationFromTaskBar.next(proccesses);
  }

  pinApplicationFromTaskBar():void{
    this.showTskBarAppIconCntxtMenu = false;
    const file = this.selectedTaskBarFile;
    this._menuService.pinToTaskBar.next(file);
  }

  unPinApplicationFromTaskBar():void{
    this.showTskBarAppIconCntxtMenu = false;
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
      if(this.taskbarHideDelayTimeOutId){
        clearTimeout(this.taskbarHideDelayTimeOutId);
      }
      this.showTskBarPreviewWindow = false;
      this.previousDisplayedTaskbarPreview = appName;

      this.taskbarHideDelayTimeOutId =  setTimeout(()=>{
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

    if(this.showTskBarToolTipTimeoutId)
      clearTimeout(this.showTskBarToolTipTimeoutId);
    

   this.showTskBarToolTipTimeoutId = setTimeout(() => {
      this.showTaskBarIconToolTip = true
      this.tskBarToolTipStyle = {
        'position':'absolute',
        'z-index': 5,
        'transform': `translate(${xAxis}px, ${yAxis - 20}px)`
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
    event.preventDefault();
    event.stopPropagation();
  
    const dragInfo = this._systemNotificationServices.getDragEventInfo();
    if(dragInfo && dragInfo.origin.includes(Constants.FILE_EXPLORER)){
      const files = this._fileService.getDragAndDropFile();
      if (!files?.length) return;

      const delay = 50; //50ms
      const destPath = this.directory;
      const moveResults:Promise<boolean>[] = [];

      // Move all files concurrently
      for (const file of files) {
        const srcPath = file.getCurrentPath;
        moveResults.push(
          this._fileService.moveAsync(srcPath, destPath, file.getIsFile)
        );
      }

      // Wait for all moves to complete
      const results = await Promise.all(moveResults);
      //const allSucceeded = moveResults.every(value => value === true);
      const allSucceeded = results.every(Boolean);

      if(!allSucceeded){
        console.error('One or more move operations failed');
        return;
      }

      //I am using the ! to denote anything not containing /user/Desktop in its path, is from the file explr
      const cameFromFileExplr = files.some(f => !f.getCurrentPath.includes(Constants.DESKTOP_PATH));
      if(cameFromFileExplr){
        this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
        this._fileService.dirFilesUpdateNotify.next();
        await CommonFunctions.sleep(delay)
      }

      this._systemNotificationServices.removeDragEventInfo();
      await this.refresh();
      return;
    }

    if(!CommonFunctions.conditionalDrop(event) && this.isDragFromDesktopActive){
      console.warn('Drop failed due to condition.');
      return;
    }else{
      const droppedFiles:File[] = [];
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        droppedFiles.push(...files);
      }
      
      if(droppedFiles.length >= 1){
        const result =  await this._fileService.writeFilesAsync(this.directory, droppedFiles);
        if(result){
          await this.refresh();
        }
      }
    }
  }
  
  protected async loadFiles(): Promise<void> {
    this.files = [];
		this.files = await this._fileService.loadDirectoryFiles(this.directory);
	}
  
  removeVantaJSSideEffect(): void { 
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1 #TBD
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = Constants.EMPTY_STRING;
        elfRef.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.SECONDS_DELAY[1]);
  }

  async runApplication(file:FileInfo):Promise<void>{
    await this._audioService.play(this.cheetahNavAudio);
    CommonFunctions.handleTracking(this._activityHistoryService, file);
    this._processHandlerService.runApplication(file);
    this.btnStyleAndValuesReset();
  }

  onDesktopIconClick(evt:MouseEvent, id:number):void{
    evt.preventDefault()
    evt.stopPropagation();
    this.executeIconClickTasks(id);
    DesktopStyleHelper.setBtnStyle(id, true, this.currIconId, this.isIconInFocusDueToPriorAction);
  }

  onTriggerRunApplication():void{
    this.runApplication(this.selectedFile);
  }
  
  async onShowDesktopIconCntxtMenu(evt:MouseEvent, file:FileInfo, id:number): Promise<void>{
    evt.stopPropagation();
    evt.preventDefault();

    // show IconContexMenu is still a btn click, just a different type
    this.executeIconClickTasks(id);
    await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

    const menuHeight = (file.getIsFile)? 253 : 337; //this is not ideal.. menu height should be gotten dynmically
    const result = DesktopContextMenuHelper.adjustIconContextMenuData(file ,this.sourceData);
    this.menuData = result[0];
    this.menuOrder = result[1];

    this.selectedFile = file;
    this.propertiesViewFile = file;
    this.showDesktopIconCntxtMenu = true;

    const axis = DesktopContextMenuHelper.checkAndHandleDesktopIconCntxtMenuBounds(evt, menuHeight);
    this.iconCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${String(evt.clientX + 2)}px, ${String(axis.yAxis)}px)`,
      'z-index': 4,
    }
  }

  showPropertiesWindow():void{
    this._menuService.showPropertiesView.next(this.propertiesViewFile);
  }
  
  doNothing():void{
    console.log('do nothing called');
  }

  onCopy():void{ //##Handle Multiple files
    const action = MenuAction.COPY;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  onCut():void{ //##Handle Multiple files
    const action = MenuAction.CUT;
    const path = this.selectedFile.getCurrentPath;
    this._menuService.setStoreData([path, action]);
  }

  async onPaste():Promise<void>{ //##Handle Multiple files
    const cntntPath = this._menuService.getPath();
    const action = this._menuService.getActions();
    const delay = 50; //50ms

    // console.log(`path: ${cntntPath}`);
    // console.log(`action: ${action}`);
    //onPaste will be modified to handle cases such as multiselect, file or folder or both

    if(action === MenuAction.COPY){
      const result = await this._fileService.copyAsync(cntntPath,  Constants.DESKTOP_PATH);
      if(result){
        await CommonFunctions.sleep(delay);
        await this.refresh();
      }
    }
    else if(action === MenuAction.CUT){
      const result = await this._fileService.moveAsync(cntntPath, Constants.DESKTOP_PATH);
      if(result){
        if(cntntPath.includes(Constants.FILE_EXPLORER)){
          this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
          this._fileService.dirFilesUpdateNotify.next();

          await CommonFunctions.sleep(delay)
          await this.refresh();
        }else{
          await CommonFunctions.sleep(delay);
          await this.refresh();
        }
      }
    }
  }

  pinIconToTaskBar():void{
    this._menuService.pinToTaskBar.next(this.selectedFile);
  }

  onMouseDown(evt:MouseEvent, i: number):void{
    if(this.areMultipleIconsHighlighted && !this.markedBtnIds.includes(String(i))){
      this.clearStates();
    }
  }

  onMouseEnter(id:number):void{
    if(!this.isMultiSelectActive){
      this.isMultiSelectEnabled = false;

      DesktopIconAlignmentHelper.preCloneDesktopIcon(id);      
      DesktopStyleHelper.setBtnStyle(id, true, this.currIconId, this.isIconInFocusDueToPriorAction);
    }
  }
  
  onMouseLeave(id:number):void{
    this.isMultiSelectEnabled = true;

    if(!this.isMultiSelectActive){
      if(id !== this.currIconId){
        if(this.markedBtnIds.includes(String(id))){
          return;
        } else{
          DesktopStyleHelper.removeBtnStyle(id);
          DesktopIconAlignmentHelper.clearPreClonedIconById(id);
        }
      }
      else if((id === this.currIconId) && !this.isIconInFocusDueToPriorAction){
        DesktopStyleHelper.setBtnStyle(id, false, this.currIconId, this.isIconInFocusDueToPriorAction);
      }
    }
  }

  btnStyleAndValuesReset():void{
    this.isIconBtnClickEvt = false;
    this.iconBtnClickCnt = 0;
    this.removeIdFromMarked(this.currIconId);
    DesktopStyleHelper.removeBtnStyle(this.currIconId);
    DesktopStyleHelper.removeBtnStyle(this.prevIconId);
    this.currIconId = -1;
    this.prevIconId = -1;
    this.iconBtnClickCnt = 0;
    this.isIconInFocusDueToPriorAction = false;
  }

  removeIdFromMarked(id:number):void{
    const idx = this.markedBtnIds.findIndex(x => x === String(id));
    this.markedBtnIds = this.markedBtnIds.filter((_, index) => index !== idx);
    DesktopIconAlignmentHelper.clearPreClonedIconById(id);
  }

  getCountOfAllTheMarkedButtons():number{
    const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
    return btnIcons.length;
  }
  
  getIDsOfAllTheMarkedButtons():void{
    const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
    btnIcons.forEach(btnIcon => {
      const btnId = btnIcon.id.replace('iconBtn', Constants.EMPTY_STRING);
      if(!this.markedBtnIds.includes(btnId)){
        this.markedBtnIds.push(btnId);
        DesktopIconAlignmentHelper.preCloneDesktopIcon(Number(btnId))
      }
    });
    //console.log('this.markedBtnIds:', this.markedBtnIds);
  }
  
  removeClassAndStyleFromBtn():void{
    this.markedBtnIds.forEach(id =>{
      const btnIcon = document.getElementById(`iconBtn${id}`);
      if(btnIcon){
        DesktopStyleHelper.removeBtnStyle(Number(id));
        DesktopIconAlignmentHelper.clearPreClonedIconById(Number(id));
      }
    })
  }

  executeIconClickTasks(id:number):void{  //##
    this.prevIconId = this.currIconId 
    this.currIconId = id;
    this.isIconBtnClickEvt = true;
    this.iconBtnClickCnt++;
    this.hideDesktopContextMenuAndOthers(this.isDesktopTheCaller);

    if(!this.markedBtnIds.includes(String(id)))
        this.markedBtnIds.push(String(id));

    if(this.prevIconId !== id){
      DesktopStyleHelper.removeBtnStyle(this.prevIconId);
      //this being commented out, is totally fine
      //DesktopIconAlignmentHelper.clearPreClonedIconById(this.prevIconId);
    }
  }
  resetIconBtnClick():void{
    this.isIconBtnClickEvt = false;
    this.iconBtnClickCnt = 0;
  }

  handleIconHighLightState():void{
    this.hideDesktopContextMenuAndOthers(this.isDesktopTheCaller);

    if(!this.isRenameActive){
      this.btnStyleAndValuesReset();

      if(this.areMultipleIconsHighlighted &&  this.desktopClickCounter === 0){
        this.desktopClickCounter++;
        return;
      }

      if(this.areMultipleIconsHighlighted &&  this.desktopClickCounter === 1){
        this.clearStates();
      }
    }

    if(this.isRenameActive){
      if((this.isIconBtnClickEvt && this.iconBtnClickCnt >= 1)){ 
        //case 1a - I was only clicking on the desktop icons, initiated a rename, then clicked on the desktop empty space
        if(this.isRenameActive)
          this.isFormDirty();
  
        if(!this.isRenameActive)
          this.resetIconBtnClick();
      }
    }
  }

  clearStates():void{
    this.areMultipleIconsHighlighted = false;
    this._fileService.removeDragAndDropFile();
    this.removeClassAndStyleFromBtn();
    this.desktopClickCounter = 0;
    this.markedBtnIds = [];
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
      DesktopStyleHelper.setDivWithAndSize(this.multiSelectElmnt, 0, 0, 0, 0, false);
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

      DesktopStyleHelper.setDivWithAndSize(this.multiSelectElmnt, startX, startY, divWidth, divHeight, true);

      // Call function to check and highlight selected items
      DesktopStyleHelper.highlightSelectedItems(startX, startY, divWidth, divHeight);
    }
  }

  onDragOver(event:DragEvent):void{
    event.stopPropagation();
    event.preventDefault();
  }

  onDragEnd(evt:DragEvent):void{
    this.isDragFromDesktopActive = false;
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

    DesktopIconAlignmentHelper.clearCloneConainter();
  }
  
  onDragStart(evt:DragEvent, i: number):void {
    this.isDragFromDesktopActive = true;
    const dragEvtInfo:DragEventInfo={origin:this.uniqueId, currentLocation:Constants.EMPTY_STRING, isDragActive: this.isDragFromDesktopActive};
    this._systemNotificationServices.setDropEventInfo(dragEvtInfo);

    const countOfMarkedBtns = this.getCountOfAllTheMarkedButtons();
    const draggedElmtId = DesktopIconAlignmentHelper.handleDragStart(evt, i, countOfMarkedBtns,
       this.files, this._fileService);
       
    this.draggedElementId = draggedElmtId;
  }
  
  moveBtnIconsToNewPositionAlignOff(mPos:mousePosition):void{

    this.markedBtnIds = DesktopIconAlignmentHelper.handleMoveBtnIconsToNewPositionAlignOff(mPos, 
      this.movedBtnIds,
      this.markedBtnIds,
      this.draggedElementId,
      this.GRID_SIZE
    );
  }

  moveBtnIconsToNewPositionAlignOn(mPos: mousePosition): void {

    this.markedBtnIds = DesktopIconAlignmentHelper.handleMoveBtnIconsToNewPositionAlignOn(mPos,
      this.movedBtnIds,
      this.markedBtnIds,
      this.draggedElementId,
      this.GRID_SIZE,
      this.ROW_GAP
    )
  }

  sortIcons(sortBy:string):void {
    this.files = CommonFunctions.sortIconsBy(this.files, sortBy);
  }

  changeIconsSize(iconSize:string):void{

    const result = DesktopStyleHelper.handleChangeIconsSize(iconSize, this.GRID_SIZE, 
      this.MIN_GRID_SIZE, this.MID_GRID_SIZE, this.MAX_GRID_SIZE);

    this.iconSizeStyle = result[0];
    this.shortCutIconSizeStyle = result[1];
    this.figCapIconSizeStyle = result[2]
    
  }

  changeGridRowColSize():void{
    const result = DesktopStyleHelper.handleChangeGridRowColSize(this.GRID_SIZE,  this.ROW_GAP,
      this.MIN_GRID_SIZE, this.MID_GRID_SIZE, this.MAX_GRID_SIZE);
    this.btnStyle =  result;
  }

  async onDelete(): Promise<void> {
    // Determine which files to delete
    const filesToDelete = (this.areMultipleIconsHighlighted)
      ? this.markedBtnIds.map(id => this.files[Number(id)])
      : [this.selectedFile];

    // Run deletions concurrently
    const results = await Promise.all(
      filesToDelete.map(f => this._fileService.deleteAsync(f.getCurrentPath, f.getIsFile))
    );

    // If all deletions succeeded
    if (results.every(Boolean)) {
      this.removeDeletedFiles(filesToDelete);

      if (this.areMultipleIconsHighlighted) {
        this._fileService.removeDragAndDropFile();
      } else {
        this._menuService.resetStoreData();
      }
    }
  }

  removeDeletedFiles(deletedFiles: FileInfo[]): void {
    this.files = this.files.filter(file =>
      !deletedFiles.some(
        del => del.getFileName === file.getFileName && del.getCurrentPath === file.getCurrentPath
      )
    );
  }

  async onEmptyRecyleBin():Promise<void>{
    const count = await this._fileService.countFolderItems(Constants.RECYCLE_BIN_PATH);
    
    if(count === 1)
      await this.onEmptyRecyleBinHelper();

    else if (count > 1){
      const title = 'Delete Multiple Items';
      const msg = `Are you sure you want to permanently delete these ${count} items?`;
      const confirmed = await this._userNotificationService.showWarningNotification(msg, title);

      if(confirmed)
        await this.onEmptyRecyleBinHelper();
    }
  }

  async onEmptyRecyleBinHelper():Promise<void>{
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
    const fileContent = this.createShortCutHelper(selectedFile);

    shortCut.setContentPath = fileContent
    shortCut.setFileName= `${selectedFile.getFileName} - ${Constants.SHORTCUT}${Constants.URL}`;
    const result = await this._fileService.writeFileAsync(this.directory, shortCut);
    if(result){
      await this.loadFiles();
    }
  }

  createShortCutHelper(file:FileInfo):string{
    let fileContent = Constants.EMPTY_STRING;
    const shortCut = ` - ${Constants.SHORTCUT}`;

    fileContent = `[InternetShortcut]
FileName=${file.getFileName}${shortCut}
IconPath=${file.getIconPath}
FileType=${file.getFileType}
ContentPath=${(file.getIsFile)? file.getContentPath : file.getCurrentPath}
OpensWith=${file.getOpensWith}
`;
    return fileContent;
  }
  
  onInputChange(evt: KeyboardEvent): boolean {
    const regexStr = '^[a-zA-Z0-9_.\\s-]+$';
    const key = evt.key;

    if(this.invalidCharTimeOutId){
      clearTimeout(this.invalidCharTimeOutId);
    }

    // Block enter
    if (key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      this.isFormDirty();
      return true;
    }

    const isValid = new RegExp(regexStr).test(key);
    if (isValid) {
      DesktopStyleHelper.hideInvalidCharsToolTip();
      DesktopGeneralHelper.autoResize(this.currIconId);
      return true;
    } else {
      DesktopStyleHelper.showInvalidCharsToolTip(this.currIconId);
      this.invalidCharTimeOutId = setTimeout(() => DesktopStyleHelper.hideInvalidCharsToolTip(), this.SECONDS_DELAY[0]);
      return false;
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

    const figCapElement= document.getElementById(`figCap${this.currIconId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.currIconId}`) as HTMLElement;
    const renameTxtBoxElement= document.getElementById(`renameTxtBox${this.currIconId}`) as HTMLInputElement;
    DesktopStyleHelper.removeBtnStyle(this.currIconId);

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
  
  async onRenameFileTxtBoxDataSave():Promise<void>{ //##. if rename successful, do not re-load
    this.isRenameActive = !this.isRenameActive;
    const isRename = true;

    const figCapElement = document.getElementById(`figCap${this.currIconId}`) as HTMLElement;
    const renameContainerElement = document.getElementById(`renameContainer${this.currIconId}`) as HTMLElement;
    const renameText = this.renameForm.value.renameInput as string;
    const oldFileName = this.selectedFile.getFileName;
 
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
        //await this.loadFiles();
        const activity = CommonFunctions.getTrackingActivity(ActivityType.FILE, renameText, this.selectedFile.getCurrentPath, oldFileName, isRename);
        CommonFunctions.trackActivity(this._activityHistoryService, activity);
      }
    }else{
      this.renameForm.reset();
    }

    DesktopStyleHelper.setBtnStyle(this.currIconId, false, this.currIconId, this.isIconInFocusDueToPriorAction);
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

    const figCapElement= document.getElementById(`figCap${this.currIconId}`) as HTMLElement;
    const renameContainerElement= document.getElementById(`renameContainer${this.currIconId}`) as HTMLElement;

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
    this.resetIconBtnsAndContextMenus(this.isDesktopTheCaller);
    this.hideTaskBarPreviewWindow();
    this.hideTaskBarToolTip();
    this.closePwrDialogBox();
  }

  desktopIsActive():void{
    this.showDesktopIcon();
    this.restorPriorOpenApps();
    //this.startClippy();
  }

  setDesktopBackgroundData():void{
    const styleClasses = ['desktop_background_solid_color', 'destop_background_picture', 'destop_background_dynamic'];
    let activeClass = Constants.EMPTY_STRING;

    if(this.desktopBackgroundType === Constants.BACKGROUND_SOLID_COLOR){
      this.startVantaWaveColorChg = false;
      this.destoryVanta()
      this.removeOldCanvas();
      this.stopVantaWaveColorChange();

      const desktopElmnt = document.getElementById('vantaCntnr') as HTMLDivElement;
      if(desktopElmnt){
        activeClass = styleClasses[0];
        this.setStyle(desktopElmnt, styleClasses, activeClass);
        desktopElmnt.style.backgroundColor = this.desktopBackgroundValue;
      }
    }

    if(this.desktopBackgroundType === Constants.BACKGROUND_PICTURE 
      || this.desktopBackgroundType === Constants.BACKGROUND_SLIDE_SHOW){
      this.startVantaWaveColorChg = false;
      this.destoryVanta()
      this.removeOldCanvas();
      this.stopVantaWaveColorChange();

      const desktopElmnt = document.getElementById('vantaCntnr') as HTMLDivElement;
      if(desktopElmnt){
        activeClass = styleClasses[1];
        this.setStyle(desktopElmnt, styleClasses, activeClass);

        if(this.desktopBackgroundType === Constants.BACKGROUND_PICTURE){
          const bkgrndIdx = this.DESKTOP_PICTURES.findIndex(x => x === this.desktopBackgroundValue);
          this.currentDesktopNum = bkgrndIdx;
          desktopElmnt.style.backgroundImage = `url(${this.desktopBackgroundValue})`;
        }
        else 1
        // start slideshow
      }
    }

    if(this.desktopBackgroundType === Constants.BACKGROUND_DYNAMIC){
      const desktopScreenElmnt = document.getElementById('vantaCntnr') as HTMLDivElement;
      if(desktopScreenElmnt){
        activeClass = styleClasses[2];
        this.setStyle(desktopScreenElmnt, styleClasses, activeClass);

        const bkgrndIdx = this.vantaBackgroundName.findIndex(x => x === this.desktopBackgroundValue);
        this.currentDesktopNum = bkgrndIdx;
        this.loadOtherVantaBackgrounds(bkgrndIdx);

        if(this.desktopBackgroundValue === 'vanta_wave'){
          this.startVantaWaveColorChg = true;
          this.startVantaWaveColorChange();
        }
      }
    }
  }

  setTaskBarVisibilityState():void{
    const taskbarVisiblityState = this._defaultService.getDefaultSetting(Constants.DEFAULT_AUTO_HIDE_TASKBAR);
    if(taskbarVisiblityState === Constants.FALSE){
      this.showTheTaskBar();
    }else if(taskbarVisiblityState === Constants.TRUE){
      this.hideTheTaskBar();
    }
  }

  setTaskBarCombinationState():void{
    const taskbarCombinationState = this._defaultService.getDefaultSetting(Constants.DEFAULT_TASKBAR_COMBINATION);
    if(taskbarCombinationState === Constants.TASKBAR_COMBINATION_NEVER){
      this.unMergeTaskBarButton();
    }else if (taskbarCombinationState === Constants.TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS){
      this.mergeTaskBarButton();
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}