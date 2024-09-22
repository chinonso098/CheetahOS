import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import {extname, dirname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { TriggerProcessService } from 'src/app/shared/system-service/trigger.process.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';


@Component({
  selector: 'cos-photoviewer',
  templateUrl: './photoviewer.component.html',
  styleUrls: ['./photoviewer.component.css']
})
export class PhotoViewerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  @ViewChild('photoContainer', {static: true}) photoContainer!: ElementRef; 

  private _fileService:FileService;
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _triggerProcessService:TriggerProcessService;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private picSrc = '';
  private _consts:Constants = new Constants();

  SECONDS_DELAY = 250;
  name= 'photoviewer';
  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}photoviewer.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.System;
  displayName = 'PhotoViewer';
  private defaultImg = '/osdrive/Pictures/Samples/no_img.jpeg';
  private tst_imageList:string[] = [`${this._consts.IMAGE_BASE_PATH}Chill on the Moon.jpg`, `${this._consts.IMAGE_BASE_PATH}Mystical.jpg`,
                        `${this._consts.IMAGE_BASE_PATH}Sparkling Water.jpg`]
                      
  imageList:string[] = []            
        
  currentImg = '';
  private currentImgIndex = 0;

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:TriggerProcessService,
    stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService, private changeDetectorRef: ChangeDetectorRef,) { 
    this._fileService = fileService
    this._processIdService = processIdService;
    this._triggerProcessService = triggerProcessService;
    this._stateManagmentService = stateManagmentService;
    this._sessionManagmentService = sessionManagmentService;
    this.processId = this._processIdService.getNewProcessId();

    this.retrievePastSessionData();

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }


  ngOnInit(): void {
    this._fileInfo = this._triggerProcessService.getLastProcessTrigger();

    if(this.imageList.length > 0)
      this.currentImg = this.imageList[0];
    else
      this.currentImg = this.defaultImg
  }

  ngOnDestroy(): void {
    1
  }
  

  async ngAfterViewInit():Promise<void> {
    this.setImageViewerWindowToFocus(this.processId); 

    this.picSrc = (this.picSrc !=='') ? 
    this.picSrc : this.getPictureSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    await this.getCurrentPicturePathAndSearchForOthers();
    if(this.imageList.length > 0){
        this.currentImg = this.imageList[0];
    }else{
      this.currentImg = this.picSrc || this.defaultImg;
    }

    const appData = (this.imageList.length > 0)? this.imageList : this.picSrc;
    this.storeAppState(appData);

    //tell angular to run additional detection cycle after 
    this.changeDetectorRef.detectChanges();

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.photoContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
  }

  onKeyDown(evt:KeyboardEvent):void{

    if(evt.key == "ArrowLeft"){
      if((this.currentImgIndex >= 0)){
        this.currentImg = this.imageList[this.currentImgIndex--];

        if(this.currentImgIndex < 0){
          this.currentImgIndex = this.imageList.length - 1;
        }
      }      
    }

    if(evt.key == "ArrowRight"){
      if(this.currentImgIndex <= this.imageList.length - 1){
        this.currentImg = this.imageList[this.currentImgIndex++];

        if(this.currentImgIndex > this.imageList.length -1){
          this.currentImgIndex = 0;
        }
      }
    }
  }

  onClick(id?:number):void{

    if(id !== undefined){
      this.currentImg = this.imageList[id];
      this.currentImgIndex = id;
    }else{
      this.currentImgIndex = this.currentImgIndex + 1;
      if(this.currentImgIndex <= this.imageList.length - 1){
        this.currentImg = this.imageList[this.currentImgIndex];
      }
    }
  }

  focusOnInput():void{
    const photoCntnr= document.getElementById('photoCntnr') as HTMLElement;
    if(photoCntnr){
      photoCntnr?.focus();
    }
  }


  async getCurrentPicturePathAndSearchForOthers():Promise<void>{
    // if stuff was reutrned from session, then use it.
    if(this.imageList.length == 0  && !this.picSrc.includes('blob:http')){
        // else, go fetch.
        const dirPath = dirname(this.picSrc);
        //console.log('dirPath:', dirPath);
        const entries:string[] = await this._fileService.getEntriesFromDirectoryAsync(dirPath);

        //check for images
        for(let i = 0; i <= entries.length - 1; i++){
          if(this._consts.IMAGE_FILE_EXTENSIONS.includes(extname(entries[i]))){
            this.imageList.push(`${dirPath}/${entries[i]}`);
          }
        }
    }
  }

  setImageViewerWindowToFocus(pid:number):void{
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
  }

  getPictureSrc(pathOne:string, pathTwo:string):string{
    let pictureSrc = '';
    
    if(pathOne.includes('blob:http')){
      return pathOne;
    }else if(this.checkForExt(pathOne,pathTwo)){
      pictureSrc = '/' + this._fileInfo.getContentPath;
    }else{
      pictureSrc =  this._fileInfo.getCurrentPath;
    }
    return pictureSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = false;

    if(this._consts.IMAGE_FILE_EXTENSIONS.includes(contentExt)){
      res = true;
    }else if(this._consts.IMAGE_FILE_EXTENSIONS.includes(currentPathExt)){
      res = false;
    }
    return res;
  }

  storeAppState(app_data:unknown):void{
    const uid = `${this.name}-${this.processId}`;

    this._appState = {
      pid: this.processId,
      app_data: app_data,
      app_name: this.name,
      unique_id: uid
    }
    this._stateManagmentService.addState(uid, this._appState, StateType.App);
  }


  retrievePastSessionData():void{
    const pickUpKey = this._sessionManagmentService._pickUpKey;
    if(this._sessionManagmentService.hasTempSession(pickUpKey)){
      const tmpSessKey = this._sessionManagmentService.getTempSession(pickUpKey) || ''; 
      const retrievedSessionData = this._sessionManagmentService.getSession(tmpSessKey) as BaseState[];

      if(retrievedSessionData !== undefined){
        const appSessionData = retrievedSessionData[0] as AppState;
        if(appSessionData !== undefined  && appSessionData.app_data != ''){
          if(typeof appSessionData.app_data === 'string')
            this.picSrc = appSessionData.app_data as string; 
          else
            this.imageList = appSessionData.app_data as string[];
        }
      }
    }
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){

      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;
      // this.photoContainer.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      // this.photoContainer.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerProcessService.getLastProcessTrigger)
  }


}
