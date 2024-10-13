import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/file.info';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileEntry } from 'src/app/system-files/file.entry';

import { applyEffect } from "src/osdrive/Cheetah/System/Fluent Effect";
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';


@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css'],
  animations: [
    trigger('slideUpToggle', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)'  }), // Start from 100% down
        animate('0.3s ease-out', style({ transform: 'translateY(0%)' })) // Slide up to its original position
      ]),
    ])
  ]
})

export class StartMenuComponent implements OnInit, AfterViewInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _fileService:FileService;

  private _elRef:ElementRef;
  private _consts:Constants = new Constants();
  txtOverlayMenuStyle:Record<string, unknown> = {};

  private SECONDS_DELAY = 250;

  Documents= 'Documents';
  Pictures = 'Pictures'
  Music = 'Music';


  delayStartMenuOverlayHideTimeoutId!: NodeJS.Timeout;
  delayStartMenuOverlayShowTimeoutId!: NodeJS.Timeout;

  startMenuFiles:FileInfo[] = [];
  private _startMenuDirectoryFilesEntries!:FileEntry[];
  directory ='/AppData/StartMenu';

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
              elRef: ElementRef, fileService:FileService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;
    this._fileService = fileService;
    this._triggerProcessService = triggerProcessService;

    this.processId = this._processIdService.getNewProcessId()
    if(this._runningProcessService.getProcesses().findIndex(x => x.getProcessName === this.name) === -1){
      this._runningProcessService.addProcess(this.getComponentDetail());
    }
  }

  ngOnInit(): void {
    1 
  }
  
  async ngAfterViewInit():Promise<void>{
    setTimeout(async () => {
      await this.loadFilesInfoAsync();
    }, this.SECONDS_DELAY);
    // 
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
        elfRef.style.position = '';
        elfRef.style.zIndex = '';
      }
    }, this.SECONDS_DELAY);
  }

 

  // Show Overlay Function
  startMenuOverlaySlideOut(): void {

    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    // Clear the show timeout as well if needed
    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);

    // Begin the show process
    this.delayStartMenuOverlayShowTimeoutId = setTimeout(() => {
      if (smIconTxtOverlay) {
        // Set initial position and visibility
        smIconTxtOverlay.style.width = '48px';
        smIconTxtOverlay.style.transition = 'width 0.3s ease'; // Set transition
        smIconTxtOverlay.style.width = '248px'; // Animate to 248px
        smIconTxtOverlay.style.transitionDelay = '0.75s';

        // Box-shadow animation after expansion
        smIconTxtOverlay.addEventListener('transitionend', () => {
          smIconTxtOverlay.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.6)';
          this.txtOverlayMenuStyle = { 'display': 'flex' }; // Make visible after slide out
        }, { once: true });
      }
    }, 500); // Delay the start of the animation
  }

  // Hide Overlay Function
  startMenuOverlaySlideIn(): void {


    clearTimeout(this.delayStartMenuOverlayShowTimeoutId);
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
    // Clear the hide timeout if necessary
    clearTimeout(this.delayStartMenuOverlayHideTimeoutId);

    // Begin the hide process
    this.delayStartMenuOverlayHideTimeoutId = setTimeout(() => {
      if (smIconTxtOverlay ) {
        // Start shrinking animation
        smIconTxtOverlay.style.transition = 'width 0.3s ease';
        smIconTxtOverlay.style.width = '48px';
        smIconTxtOverlay.style.boxShadow = 'none';

        // Once transition ends, hide the overlay
        smIconTxtOverlay.addEventListener('transitionstart', () => {
          this.txtOverlayMenuStyle = { 'display': 'none' }; // Hide after slide in
        }, { once: true });
      }
    }, 250); // Add a slight delay to match the UX behavior
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
    this._fileService.resetDirectoryFiles();
    const directoryEntries  = await this._fileService.getEntriesFromDirectoryAsync(this.directory);
    this._startMenuDirectoryFilesEntries = this._fileService.getFileEntriesFromDirectory(directoryEntries,this.directory);

    for(let i = 0; i < directoryEntries.length; i++){
      const fileEntry = this._startMenuDirectoryFilesEntries[i];
      const fileInfo = await this._fileService.getFileInfoAsync(fileEntry.getPath);
      this.startMenuFiles.push(fileInfo)
    }
  }

  runProcess(file:FileInfo):void{
    console.log('startmanager-runProcess:',file)
    this._triggerProcessService.startApplication(file);
  }


  openFolderPath(folderName:string):void{
   const path = `/Users/${folderName}`;

   const file = new FileInfo();
   file.setFileName = folderName;
   file.setOpensWith = 'fileexplorer';
   file.setIsFile = false;
   file.setCurrentPath = path;

  this.runProcess(file);
  }

  power():void{
    location.reload();
  }


  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
