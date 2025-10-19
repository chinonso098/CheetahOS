/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, signal, WritableSignal, Input } from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import {extname, dirname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';

@Component({
  selector: 'cos-photoviewer',
  templateUrl: './photoviewer.component.html',
  styleUrls: ['./photoviewer.component.css'],
  standalone:false
})
export class PhotoViewerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  @ViewChild('photoContainer', {static: true}) photoContainer!: ElementRef; 
  @Input() priorUId = Constants.EMPTY_STRING;

  private _fileService:FileService;
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _windowService:WindowService;
  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _picSrc = Constants.EMPTY_STRING;
  private _skip = false;
  private currentImgIndex = 0;
  private readonly PATH_TO_IGNORE = '/AppData/StartMenu/photoviewer.url';

  readonly SECONDS_DELAY = 500;
  readonly GALLERY_VIEW = 'gallery view';
  readonly PHOTO_VIEW = 'photo view'
  readonly BASE_64_PNG_IMG = 'data:image/png;base64';

  defaultView = this.GALLERY_VIEW;
  galleryImg = `${Constants.IMAGE_BASE_PATH}photos_gallery.png`;
  favoriteImg = `${Constants.IMAGE_BASE_PATH}photos_heart.png`;
  currentImg = Constants.EMPTY_STRING;
  selectedIdx = -1;

  GALLERY = 'Gallery';
  FAVORITE = 'Favortie';

  imageList:string[] = [];
  galleryOptions:string[][] = [[this.galleryImg, this.GALLERY], [this.favoriteImg, this.FAVORITE]];

  name= 'photoviewer';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}photoviewer.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.System;
  displayName = 'PhotoViewer';
  private readonly defaultPath = '/Users/Pictures';
  private readonly defaultImg = '/Users/Pictures/Samples/no_img.jpeg';
  tst_imageList:string[] = ['osdrive/Users/Pictures/Samples/Chill on the Moon.jpg', 'osdrive/Users/Pictures/Samples/mystical.jpg',
                        'osdrive/Users/Pictures/Samples/Sparkling Water.jpg', 'osdrive/Users/Pictures/Samples/Sunset Car.jpg',
                         'osdrive/Users/Pictures/Samples/Sunset.jpg']
  

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
              triggerProcessService:ProcessHandlerService,  sessionManagmentService: SessionManagmentService, private changeDetectorRef: ChangeDetectorRef,
              windowService:WindowService) { 
    this._fileService = fileService
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    
    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  async ngOnInit():Promise<void> {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
    console.log('this._fileInfo:', this._fileInfo);

    if(this.checkIfImgIsBase64(this._fileInfo.getContentPath)){
      this.currentImg = this._fileInfo.getContentPath;
      return;
    }else{
      const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
      this.currentImg = currentImg;
    }
  } 

  async ngAfterViewInit():Promise<void> {

    this._picSrc = this.getPictureSrc(this._fileInfo);
    if(this._picSrc === Constants.EMPTY_STRING){
      await this.getAllPicturesInthePicturesFolder(this.defaultPath);
      return;
    }

    if(!this._skip){
      await this.getAllPicturesIntheCurrentPath();

      if(this.imageList.length > 0)
        this.currentImg = this.imageList[0];
      // else{
      //   const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
      //   this.currentImg = this._fileInfo.getContentPath || currentImg;
      // }

      const appData = (this.imageList.length > 0)? this.imageList : this._picSrc;
      this.storeAppState(appData);
    }else{
      this.currentImg = this._picSrc;
    }

    //tell angular to run additional detection cycle after 
    this.changeDetectorRef.detectChanges();

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.captureComponentImg();
  }

  ngOnDestroy(): void {
    1
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.photoContainer.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
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

  focusHere(evt:MouseEvent):void{
    evt.stopPropagation();

    const photoCntnr= document.getElementById('photoCntnr') as HTMLElement;
    if(photoCntnr){
      photoCntnr?.focus();
    }

    this.focusWindow();
  }

  async getAllPicturesIntheCurrentPath():Promise<void>{
    let imgCount = 0;

    // if stuff was reutrned from session, then use it.
    if(this.imageList.length === 0){
      // else, go fetch.
      const dirPath = dirname(this._fileInfo.getCurrentPath);
      const entries:string[] = await this._fileService.readDirectory(dirPath);

      //check for images
      for(const entry of entries){
        if(Constants.IMAGE_FILE_EXTENSIONS.includes(extname(entry)) ){
          imgCount = imgCount +  1;

          if(`${dirPath}/${entry}` !== this._fileInfo.getCurrentPath){
            const file =  await this._fileService.getFileInfo(`${dirPath}/${entry}`);
            if(file)
              this.imageList.push(file.getContentPath);
          }
        }
      }

      if(imgCount > 1){
        this.imageList.unshift(this._fileInfo.getContentPath);
      }
    }
  }

  async getAllPicturesInthePicturesFolder(path:string):Promise<void>{
    const entries:string[] = await this._fileService.readDirectory(path);
    for(const entry of entries){
      const entryPath = `${path}/${entry}`;
      const isDirectory = await this._fileService.isDirectory(entryPath);

      if(isDirectory){
        await this.getAllPicturesInthePicturesFolder(entryPath);
      }else{
        const file =  await this._fileService.getFileInfo(entryPath);

        if(file && Constants.IMAGE_FILE_EXTENSIONS.includes(file.getFileExtension) && entryPath !== this.defaultImg)
          this.imageList.push(file.getContentPath);
      }
    }
  }

  async handleMenuSelection(selection:string, idx:number, evt:MouseEvent, view:string): Promise<void>{

  }


  handlePictureSelection(img:string, evt:MouseEvent):void{
    evt.stopPropagation();
  }


  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  getPictureSrc(file:FileInfo):string{    
    const { getCurrentPath, getContentPath } = file;
    if(this.checkIfImgIsBase64(getContentPath)){
      this._skip = true;
      return getContentPath;
    }

    if (getCurrentPath === this.PATH_TO_IGNORE && getContentPath === Constants.EMPTY_STRING) {
      return Constants.EMPTY_STRING;
    }

    if((getCurrentPath !== Constants.EMPTY_STRING && getContentPath !== Constants.EMPTY_STRING)
      || (getCurrentPath !== Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING)){
      return getCurrentPath;
    }

    if (getCurrentPath === Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING) {
      return this._picSrc;
    }

    return Constants.EMPTY_STRING;
  }

  checkIfImgIsBase64(getContentPath:string):boolean{
    if(getContentPath.substring(0, 21) === this.BASE_64_PNG_IMG)
      return true;

    return false
  }

  storeAppState(app_data:unknown):void{
    const uid = `${this.name}-${this.processId}`;
    this._appState = {
      pid: this.processId,
      app_data: app_data,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
        if(typeof appSessionData.app_data === 'string')
          this._picSrc = appSessionData.app_data as string; 
        else
          this.imageList = appSessionData.app_data as string[];
    }
  }

  maximizeWindow():void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uid === evtOriginator){

      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vantaCntnr') as HTMLElement;
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;
      // this.photoContainer.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0 ) - pixelTosubtract}px`;
      // this.photoContainer.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }


}
