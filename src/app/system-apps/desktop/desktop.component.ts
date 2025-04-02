import { AfterViewInit, OnInit,OnDestroy, Component, ElementRef, ViewChild} from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { BIRDS, GLOBE, HALO, RINGS, WAVE } from './vanta-object/vanta.interfaces';
import { IconsSizes, SortBys } from './desktop.enums';
import { FileManagerService } from 'src/app/shared/system-service/file.manager.services';
import { Colors } from './colorutil/colors';
import { FileInfo } from 'src/app/system-files/file.info';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
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

declare let VANTA: { HALO: any; BIRDS: any;  WAVES: any;   GLOBE: any;  RINGS: any;};

@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css'],
  animations: [
    trigger('slideStatusAnimation', [
      state('slideOut', style({ right: '-200px' })),
      state('slideIn', style({ right: '2px' })),

      transition('* => slideIn', [
        animate('1s ease-in')
      ]),
      transition('slideIn => slideOut', [
        animate('2s ease-out')
      ]),
    ]),

    trigger('slideStartMenuAnimation', [
      transition(':enter', [
        style({transform: 'translateY(100%)'}), 
        animate('200ms ease-out', style({ transform: 'translateY(0)'}))
      ]),
      transition(':leave', [
        style({transform: 'translateY(0)'}),
        animate('200ms ease-in', style({ transform: 'translateY(100%)'}))
      ]),
    ])
  ]
})

export class DesktopComponent implements OnInit, OnDestroy, AfterViewInit{

  @ViewChild('desktopContainer', {static: true}) desktopContainer!: ElementRef; 

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileManagerServices:FileManagerService;
  private _fileService:FileService;
  private _triggerProcessService:TriggerProcessService;
  private _scriptService: ScriptService;
  private _menuService: MenuService;
  private _windowService:WindowService;
  private _audioService:AudioService;
  private _systemNotificationServices:SystemNotificationService;

  private _vantaEffect: any;
  private _numSequence = 0;
  private _charSequence = 'a';
  private _charSequenceCount = 0;

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

  autoAlignIcons = true;
  autoArrangeIcons = true;
  showDesktopIcons = true;
  showDesktopScreenShotPreview = false;
  showStartMenu = false;
  showVolumeControl = false;
  showClippy = true;
  dsktpPrevImg = '';
  slideState = 'slideIn';

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
  selectedFileFromTaskBar!:FileInfo;
  appToPreview = '';
  appToPreviewIcon = '';
  previousDisplayedTaskbarPreview = '';
  removeTskBarPrevWindowFromDOMTimeoutId!: NodeJS.Timeout;
  hideTskBarPrevWindowTimeoutId!: NodeJS.Timeout;
  clippyIntervalId!: NodeJS.Timeout;
  colorChgIntervalId!: NodeJS.Timeout;

  readonly DESKTOP_DIRECTORY ='/Users/Desktop';
  readonly DESKTOP_SCREEN_SHOT_DIRECTORY ='/Users/Documents/Screen-Shots';
  readonly TERMINAL_APP ="terminal";
  readonly TEXT_EDITOR_APP ="texteditor";
  readonly CODE_EDITOR_APP ="codeeditor";
  readonly MARKDOWN_VIEWER_APP ="markdownviewer";
  readonly TASK_MANAGER_APP ="taskmanager";

  waveBkgrnd:WAVE =  {el:'#vanta'}
  ringsBkgrnd:RINGS =  {el:'#vanta'}
  haloBkgrnd:HALO =  {el:'#vanta'}
  globeBkgrnd:GLOBE =  {el:'#vanta'}
  birdBkgrnd:BIRDS =  {el:'#vanta'}

  VANTAS:any = [this.waveBkgrnd, this.ringsBkgrnd,this.haloBkgrnd, this.globeBkgrnd, this.birdBkgrnd ];
  private MIN_NUMS_OF_DESKTOPS = 0;
  private MAX_NUMS_OF_DESKTOPS = this.VANTAS.length - 1;
  private CURRENT_DESTOP_NUM = 0;
  private CLIPPY_INIT_DELAY = 300000; // 5mins
  private COLOR_CHANGE_DELAY = 60000; // 1min
  private COLOR_TRANSITION_DURATION = 2000; // 2sec

  private MIN_NUM_COLOR_RANGE = 200;
  private MAX_NUM_COLOR_RANGE = 99999;
  private DEFAULT_COLOR = 0x274c;
  
  deskTopMenu:NestedMenu[] = [];
  taskBarContextMenuData:GeneralMenu[] = [];
  taskBarAppIconMenuData:GeneralMenu[] = [
    {icon:'', label: '', action: this.openApplicationFromTaskBar.bind(this)},
    {icon:'', label: '', action: ()=> console.log() },
  ];

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'desktop';
  processId = 0;
  type = ComponentType.System;
  displayName = '';


  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService,fileManagerServices:FileManagerService,
              triggerProcessService:TriggerProcessService, scriptService: ScriptService, audioService: AudioService, 
              menuService: MenuService, fileService:FileService, windowService:WindowService, systemNotificationServices:SystemNotificationService ) { 

    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._fileManagerServices = fileManagerServices;
    this._triggerProcessService = triggerProcessService;
    this._scriptService = scriptService;
    this._menuService = menuService;
    this._fileService = fileService;
    this._windowService = windowService;
    this._audioService = audioService;
    this._systemNotificationServices = systemNotificationServices;

    // these are subs, but the desktop cmpnt is not going to be destoryed
    this._menuService.showTaskBarAppIconMenu.subscribe((p) => { this.onShowTaskBarAppIconMenu(p)});
    this._menuService.showTaskBarConextMenu.subscribe((p) => { this.onShowTaskBarContextMenu(p)});
    this._windowService.showProcessPreviewWindowNotify.subscribe((p) => { this.showTaskBarPreviewWindow(p)});
    this._menuService.hideContextMenus.subscribe(() => { this.hideContextMenu()});
    this._windowService.hideProcessPreviewWindowNotify.subscribe(() => { this.hideTaskBarPreviewWindow()});
    this._windowService.keepProcessPreviewWindowNotify.subscribe(() => { this.keepTaskBarPreviewWindow()});
    this._menuService.showStartMenu.subscribe(() => { this.showTheStartMenu()});
    this._menuService.hideStartMenu.subscribe(() => { this.hideTheStartMenu()});
    this._audioService.hideShowVolumeControlNotify.subscribe(() => { this.hideShowVolumeControl()});

    this._systemNotificationServices.showDesktopNotify.subscribe(() => {this.startClippy()})
    this._systemNotificationServices.showLockScreenNotify.subscribe(() => {
      this.stopClippy(); 
      this.hideVolumeControl();
    });


    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
    this._numSequence = this.getRandomInt(this.MIN_NUM_COLOR_RANGE, this.MAX_NUM_COLOR_RANGE);
  }

  ngOnInit():void{
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

  ngAfterViewInit():void{
    this.startVantaWaveColorChange();
    this.hideContextMenu();
    this.initClippy();
  }

  ngOnDestroy(): void {
    this._vantaEffect?.destroy();
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
    if(this.CURRENT_DESTOP_NUM === 0){
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
    this.showClippy = false;
    clearInterval(this.clippyIntervalId);
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

    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(evtOriginator === Constants.EMPTY_STRING){
      const menuHeight = 306; //this is not ideal.. menu height should be gotten dynmically
      const menuWidth = 210;
  
      this._menuService.hideContextMenus.next();
      this.showDesktopCntxtMenu = true;
      const axis = this.checkAndHandleMenuBounds(evt, menuHeight, menuWidth);

      this.dskTopCntxtMenuStyle = {
        'position':'absolute',
        'width': '210px', 
        'transform':`translate(${String(axis.xAxis + 2)}px, ${String(axis.yAxis)}px)`,
        'z-index': 4,
        'opacity':1
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
      this._fileService.addEventOriginator('filemanager');
      this._fileService.dirFilesUpdateNotify.next();
    }
  }

  hideContextMenu(caller?:string):void{

    /**
     * There is a doubling of responses to certain events that exist on the 
     * desktop compoonent and any other component running at the time the event was triggered.
     * The desktop will always respond to the event, but other components will only respond when they are in focus.
     * If there is a count of 2 or more(highly unlikely) reponses for a given event, then, ignore the desktop's response
     */

    this.showDesktopCntxtMenu = false;
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

  resetLockScreenTimeOut():void{
    this._systemNotificationServices.resetLockScreenTimeOutNotify.next();
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

    this._fileManagerServices.viewByNotify.next(viewBy);
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

    this._fileManagerServices.sortByNotify.next(sortBy);
    this.getDesktopMenuData();
  }

  autoArrangeIcon():void{
    this.autoArrangeIcons = !this.autoArrangeIcons
    this._fileManagerServices.autoArrangeIconsNotify.next(this.autoArrangeIcons);
    this.getDesktopMenuData();
  }

  autoAlignIcon():void{
    this.autoAlignIcons = !this.autoAlignIcons
    this._fileManagerServices.alignIconsToGridNotify.next(this.autoAlignIcons);
    this.getDesktopMenuData();
  }

  refresh():void{
    this._fileManagerServices.refreshNotify.next();
  }

  showDesktopIcon():void{
    this.showDesktopIcons = !this.showDesktopIcons
    this._fileManagerServices.showDesktopIconsNotify.next(this.showDesktopIcons);
    this.getDesktopMenuData();
  }

  previousBackground():void{
    if(this.CURRENT_DESTOP_NUM > this.MIN_NUMS_OF_DESKTOPS){
      this.CURRENT_DESTOP_NUM --;
      const curNum = this.CURRENT_DESTOP_NUM;
      this.loadOtherBackgrounds(curNum);
    }
    this.hideContextMenu();
  }

  nextBackground():void{
    if(this.CURRENT_DESTOP_NUM < this.MAX_NUMS_OF_DESKTOPS){
      this.CURRENT_DESTOP_NUM ++;
      const curNum = this.CURRENT_DESTOP_NUM;
      this.loadOtherBackgrounds(curNum);
    }
    
    this.hideContextMenu();
  }

  loadOtherBackgrounds(i:number):void{
    const names:string[] = ["vanta-waves","rings","halo", "globe", "birds"]
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

    this._triggerProcessService.startApplication(file);
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

    const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified ]

    return sortByMenu
  }

  showTheDesktop():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show open windows', action:this.showOpenWindows.bind(this)}
    // raise show the destop evt

    this.taskBarContextMenuData[0] = menuOption;
  }

  showOpenWindows():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Show the desktop', action: this.showTheDesktop.bind(this)}

    //raise evt

    this.taskBarContextMenuData[0] = menuOption;
  }

  hideTheTaskBar():void{
    1
  }

  mergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Unmerge taskbar Icons', action:this.unMergeTaskBarButton.bind(this)}
    this._menuService.mergeUnMergeTaskBarIcon.next();
    this.taskBarContextMenuData[3] = menuOption;
  }

  unMergeTaskBarButton():void{
    const menuOption:GeneralMenu = {icon:'', label: 'Merge taskbar Icons', action: this.mergeTaskBarButton.bind(this)}
    this._menuService.mergeUnMergeTaskBarIcon.next();
    this.taskBarContextMenuData[3] = menuOption;
  }


  buildNewMenu(): NestedMenuItem[]{

    const newFolder:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder',  action: this.createFolder.bind(this),  variables:true , 
      emptyline:false, styleOption:'C' }

    const textEditor:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}quill.png`, label:'Rich Text',  action: this.openTextEditor.bind(this),  variables:true , 
      emptyline:false, styleOption:'C' }

    const codeEditor:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}vs_code.png`, label:'Code Editor',  action: this.openCodeEditor.bind(this),  variables:true , 
        emptyline:false, styleOption:'C' }

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
      if(n == 0){
        this._vantaEffect = VANTA.WAVES(vanta)
      }
      if(n == 1){
        this._vantaEffect = VANTA.RINGS(vanta)
      }
      if(n == 2){
        this._vantaEffect = VANTA.HALO(vanta)
      }
      if(n == 3){
        this._vantaEffect = VANTA.GLOBE(vanta)
      }
      if(n == 4){
        this._vantaEffect = VANTA.BIRDS(vanta)
      }

    } catch (err) {
      console.error('err:',err);
      //this.buildVantaEffect(this.CURRENT_DESTOP_NUM);
    }
  }

  onShowTaskBarAppIconMenu(data:unknown[]):void{
    const rect = data[0] as DOMRect;
    const file = data[1] as FileInfo;
    const isPinned = data[2] as boolean;
    this.selectedFileFromTaskBar = file;

    this.switchBetweenPinAndUnpin(isPinned);
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

    const axis = this.checkAndHandleMenuBounds(evt, menuHeight, menuWidth);    
    this.tskBarCntxtMenuStyle = {
      'position':'absolute',
      'transform':`translate(${axis.xAxis + 2}px, ${evt.y - menuHeight - taskBarHeight }px)`,
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
    const file = this.selectedFileFromTaskBar;
    const processCount = this._runningProcessService.getProcesses()
      .filter(p => p.getProcessName === file.getOpensWith).length;

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
    const file = this.selectedFileFromTaskBar;  
    this._triggerProcessService.startApplication(file);
  }

  closeApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedFileFromTaskBar;
    const proccesses = this._runningProcessService.getProcesses()
      .filter(p => p.getProcessName === file.getOpensWith);

    this._menuService.closeApplicationFromTaskBar.next(proccesses);
  }

  pinApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedFileFromTaskBar;
    this._menuService.pinToTaskBar.next(file);
  }

  unPinApplicationFromTaskBar():void{
    this.showTskBarAppIconMenu = false;
    const file = this.selectedFileFromTaskBar;
    this._menuService.unPinFromTaskBar.next(file);
  }

  showTaskBarPreviewWindow(data:unknown[]):void{
    const taskbarHideDelay = 400;
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
      'transform':`translate(${String(rect.x - 59)}px, ${String(rect.y - 131)}px)`,
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
    this.clearTimeout();
  }

  removeOldTaskBarPreviewWindowNow():void{
    this.showTskBarPreviewWindow = false;
  }

  clearTimeout():void{
    clearTimeout(this.hideTskBarPrevWindowTimeoutId);
    clearTimeout(this.removeTskBarPrevWindowFromDOMTimeoutId);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}