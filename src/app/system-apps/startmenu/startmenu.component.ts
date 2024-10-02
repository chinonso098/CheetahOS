import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/file.info';
import { FileService } from 'src/app/shared/system-service/file.service';
import { FileEntry } from 'src/app/system-files/file.entry';

import { applyEffect } from "src/osdrive/Cheetah/System/Fluent Effect";

@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css']
})
export class StartMenuComponent implements OnInit, AfterViewInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _fileService:FileService;

  private _elRef:ElementRef;
  private _consts:Constants = new Constants();
  txtOverlayMenuStyle:Record<string, unknown> = {};
  private SECONDS_DELAY = 250;

  startMenuFiles:FileInfo[] = [];
  private _startMenuDirectoryFilesEntries!:FileEntry[];
  directory ='/AppData/StartMenu';

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, elRef: ElementRef, fileService:FileService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;
    this._fileService = fileService;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1 
  }
  
  async ngAfterViewInit():Promise<void>{

    setTimeout(async () => {
      await this.loadFilesInfoAsync();
    }, 100);
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

  startMenuOverlaySlideOut(): void {
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
  
    if (smIconTxtOverlay) {
      // Set initial position and visibility
      smIconTxtOverlay.style.width = '48px';

      // Allow the browser to calculate the layout before applying the animation
      smIconTxtOverlay.style.transition = 'width 0.4s ease'; // Set the transition for left
      smIconTxtOverlay.style.width = '248px'; // Animate to 248px
      smIconTxtOverlay.style.transitionDelay = '1s';
      //smIconTxtOverlay.style.backgroundColor = 'rgba(33,33, 33, 0.6)';

      setTimeout(() => {
        smIconTxtOverlay.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.6)';
        this.txtOverlayMenuStyle = {
          'display': 'flex'
        }
      }, 1400); // Use a small timeout to ensure styles are applied in the correct order
    } 
  }

  startMenuOverlaySlideIn(): void {
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;

    if (smIconTxtOverlay) {
      // Ensure the element has the transition property set for smooth animation
      smIconTxtOverlay.style.transition = 'width 0.75s ease';
      smIconTxtOverlay.style.width = '48px';
      smIconTxtOverlay.style.boxShadow = 'none';
      //smIconTxtOverlay.style.backgroundColor = 'transparent';

      // After the transition ends, hide the element
      setTimeout(() => {
        this.txtOverlayMenuStyle = {
          'display': 'none'
        }
      }, 300); // Set this to match the transition duration (.3s)
    }
  }

  onBtnHover():void{
    // applyEffect('.start-menu-list-btn', {
    //   lightColor: 'rgba(255,255,255,0.1)',
    //   gradientSize: 150,
    // });

    applyEffect('.start-menu-list-ol', {
      clickEffect: true,
      lightColor: 'rgba(255,255,255,0.6)',
      gradientSize: 40,
      isContainer: true,
      children: {
        borderSelector: '.start-menu-list-li',
        elementSelector: '.start-menu-list-btn',
        lightColor: 'rgba(255,255,255,0.3)',
        gradientSize: 150
      }
    })
  }

  onBtnExit():void{
//
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



  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
