import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
//import { animate, style, transition, trigger } from '@angular/animations';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/file.info';

import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

import { applyEffect } from "src/osdrive/Cheetah/System/Fluent Effect";
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { trigger, transition, style, animate, state, keyframes } from '@angular/animations';

@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('slideStartMenuAnimation', [
      // Hidden (default)
      state('slideDown', style({
        bottom: '-540px',
        zIndex: -1,
      })),
  
      // Visible (open)
      state('slideUp', style({
        bottom: '0px',
        zIndex: 3,
      })),
  
      // --- Slide Up (Open) ---
      transition('* => slideUp', [
        // Prepare visible state first
        style({ zIndex: 3, bottom: '-540px' }),
  
        // Keyframe-based bounce animation
        animate(
          '550ms cubic-bezier(0.25, 1.25, 0.5, 1)',
          keyframes([
            style({ bottom: '-540px', offset: 0 }),
            style({ bottom: '5px', offset: 0.8 }),  // slight overshoot
            style({ bottom: '0px', offset: 1.0 })   // settle into place
          ])
        )
      ]),
  
      // --- Slide Down (Close) ---
      transition('slideUp => slideDown', [
        animate(
          '420ms cubic-bezier(0.4, 0, 0.2, 1)',
          keyframes([
            style({ bottom: '0px', offset: 0 }),
            style({ bottom: '-20px', offset: 0.8 }),
            style({ bottom: '-540px', offset: 1.0 })
          ])
        ),
        style({ zIndex: -1 })
      ]),
    ])
  ]
})

export class StartMenuComponent implements OnInit, AfterViewInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _userNotificationService:UserNotificationService;
  private _systemNotificationService:SystemNotificationService;
  private _menuService:MenuService;
  private _fileService:FileService;
  private _elRef:ElementRef;

  slideState = 'slideDown';

  txtOverlayMenuStyle:Record<string, unknown> = {};
  delayStartMenuOverlayHideTimeoutId!: NodeJS.Timeout;
  delayStartMenuOverlayShowTimeoutId!: NodeJS.Timeout;

  startMenuFiles:FileInfo[] = [];
  private SECONDS_DELAY = 250;
  readonly START_MENU_DIRECTORY ='/AppData/StartMenu';
  readonly Documents= 'Documents';
  readonly Pictures = 'Pictures'
  readonly Music = 'Music';


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, processHandlerService:ProcessHandlerService,
               elRef: ElementRef, fileService:FileService, userNotificationService:UserNotificationService,
               menuService:MenuService, systemNotificationService:SystemNotificationService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;
    this._fileService = fileService;
    this._processHandlerService = processHandlerService ;
    this._userNotificationService = userNotificationService;
    this._systemNotificationService = systemNotificationService;
    this._menuService = menuService;

    this.processId = this._processIdService.getNewProcessId();
    if(this._runningProcessService.getProcesses().findIndex(x => x.getProcessName === this.name) === -1){
      this._runningProcessService.addProcess(this.getComponentDetail());
    }

    this._menuService.showStartMenu.subscribe(() => {this.showStartMenu()});
    this._menuService.hideStartMenu.subscribe(() => {this.hideStartMenu()});

    this._systemNotificationService.showLockScreenNotify.subscribe(() => {this.lockScreenIsActive()});
    this._systemNotificationService.showDesktopNotify.subscribe(() => {this.desktopIsActive()});
  }

  ngOnInit(): void {
    1 
  }
  
  async ngAfterViewInit():Promise<void>{
    const delay = 1500; //1.5secs
    await CommonFunctions.sleep(delay);
    await this.loadFilesInfoAsync();
    this.removeVantaJSSideEffect();
  }

  /**
   * NOTE:This method is temporary for the start menu
   */
  removeVantaJSSideEffect(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = Constants.EMPTY_STRING;
        elfRef.style.zIndex = Constants.EMPTY_STRING;
      }
    }, this.SECONDS_DELAY);
  }

  showStartMenu():void{
    this.slideState = 'slideUp';
  }

  hideStartMenu():void{
    this.slideState = 'slideDown';
  }

  // Store listener for removal
  private overlaySlideOutListener = () => {
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    if (smIconTxtOverlay) {
        smIconTxtOverlay.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.6)';
        this.txtOverlayMenuStyle = { display: 'flex' };
    }
  };

  // Show Overlay Function
  startMenuOverlaySlideOut(): void {
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);

    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    if (!smIconTxtOverlay) return;

    this.delayStartMenuOverlayShowTimeoutId = setTimeout(() => {
        smIconTxtOverlay.style.width = '48px';
        smIconTxtOverlay.style.transition = 'width 0.3s ease';
        smIconTxtOverlay.style.width = '248px';
        smIconTxtOverlay.style.transitionDelay = '0.75s';

        // Remove any existing listener before adding a new one
        smIconTxtOverlay.removeEventListener('transitionend', this.overlaySlideOutListener);
        smIconTxtOverlay.addEventListener('transitionend', this.overlaySlideOutListener, { once: true });
    }, 500);
  }

  lockScreenIsActive():void{
    const startMenuElmnt = document.getElementById('the-window-startmenu') as HTMLDivElement;
    if(startMenuElmnt){
      startMenuElmnt.style.opacity = '0';
    }

    this.hideStartMenu();
  }

  desktopIsActive():void{
    const startMenuElmnt = document.getElementById('the-window-startmenu') as HTMLDivElement;
    if(startMenuElmnt){
      startMenuElmnt.style.opacity = '1';
    }
  }

  
  // Hide Overlay Function
  startMenuOverlaySlideIn(): void {
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);

    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    if (!smIconTxtOverlay) return;

    // Ensure we remove any transition listeners to prevent race conditions
    smIconTxtOverlay.removeEventListener('transitionend', this.overlaySlideOutListener);

    this.delayStartMenuOverlayHideTimeoutId = setTimeout(() => {
        smIconTxtOverlay.style.transition = 'width 0.3s ease';
        smIconTxtOverlay.style.width = '48px';
        smIconTxtOverlay.style.boxShadow = 'none';

        // Ensure text hides after transition completes
        smIconTxtOverlay.addEventListener('transitionend', () => {
            this.txtOverlayMenuStyle = { display: 'none' };
        }, { once: true });
    }, 250);
  }



  onBtnHover():void{

    // applyEffect('.start-menu-main-overlay-content', {
    //   lightColor: 'rgba(255,255,255,0.1)',
    //   gradientSize: 150,
    // });

    // applyEffect('.start-menu-main-overlay-content', {
    //   lightColor: 'rgba(255,255,255,0.1)',
    //   gradientSize: 150,
    // });

    applyEffect('.start-menu-list-ol', {
      clickEffect: true,
      lightColor: 'rgba(255,255,255,0.1)',
      gradientSize: 35,
      isContainer: true,
      children: {
        borderSelector: '.start-menu-list-li',
        elementSelector: '.start-menu-list-btn',
        lightColor: 'rgba(255,255,255,0.3)',
        gradientSize: 150
      }
    })


    // applyEffect('.start-menu-main-overlay-container', {
    //   clickEffect: true,
    //   lightColor: 'rgba(255,255,255,0.6)',
    //   gradientSize: 80,
    //   isContainer: true,
    //   children: {
    //     borderSelector: '.start-menu-main-overlay-icon-text-content',
    //     elementSelector: '.start-menu-overlay-icon',
    //     lightColor: 'rgba(255,255,255,0.3)',
    //     gradientSize: 150
    //   }
    // })
  }

  private async loadFilesInfoAsync():Promise<void>{
    this.startMenuFiles = [];
    //this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.loadDirectoryFiles(this.START_MENU_DIRECTORY);
    this.startMenuFiles.push(...directoryEntries)
  }

  runProcess(file:FileInfo, evt:MouseEvent):void{
    evt.stopPropagation();
    console.log('startmanager-runProcess:',file);

    this.hideStartMenu();
    this._processHandlerService.runApplication(file);
  }


  openFolderPath(folderName:string, evt:MouseEvent):void{
   const path = `/Users/${folderName}`;

   const file = new FileInfo();
   file.setFileName = folderName;
   file.setOpensWith = Constants.FILE_EXPLORER;
   file.setIsFile = false;
   file.setCurrentPath = path;

    this.runProcess(file, evt);
  }

  power(evt:MouseEvent):void{
    evt.stopPropagation();

    this.hideStartMenu();
    const msg = 'Shut Down Cheetah';
    this._userNotificationService.showPowerOnOffNotification(msg);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
