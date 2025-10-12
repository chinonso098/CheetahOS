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
import {
  style,
  trigger,
  transition,
  animate,
  query,
  group,
} from '@angular/animations';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';


@Component({
  selector: 'cos-photoviewer',
  templateUrl: './photoviewer.component.html',
  styleUrls: ['./photoviewer.component.css'],
  standalone:false,
  animations: [
    trigger('slideToggle', [
      transition( '* => *', [
          group([ query( ':enter', style({ transform: 'translateX({{ enterStart }}) scale(0.25)' }),
              { optional: true }),
            query( ':leave',[
                animate( '750ms ease-in-out', style({ transform: 'translateX({{ leaveEnd }}) scale(0.25)' })),
              ],
              { optional: true }
            ),
            query(':enter', [ animate( '750ms ease-in-out', style({ transform: 'translateX(0) scale(1)' }) ),
              ],
              { optional: true }
            ),
          ]),
        ],
        { params: { leaveEnd: '', enterStart: '', }, }
      ),
    ]),
  ],
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

  readonly SECONDS_DELAY = 500;
   readonly BASE_64_PNG_IMG = 'data:image/png;base64';

  name= 'photoviewer';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}photoviewer.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.System;
  displayName = 'PhotoViewer';
  private defaultPath = '/Users/Pictures/';
  private defaultImg = '/Users/Pictures/Samples/no_img.jpeg';
  private tst_imageList:string[] = ['/Users/Pictures/Samples/Chill on the Moon.jpg', '/Users/Pictures/Samples/mystical.jpg',
                        '/Users/Pictures/Samples/Sparkling Water.jpg', '/Users/Pictures/Samples/Sunset Car.jpg', '/Users/Pictures/Samples/Sunset.jpg']
                      
  imageList:string[] = [];
  protected images: WritableSignal<string[]> =  signal([this.imageList[0]]);
  protected selectedIndex = signal(1);
  protected animationDirection = signal<'right' | 'left'>('right');
  disableAnimations = true;
  

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

    if(this.checkIfImgIsBase64(this._fileInfo.getContentPath)){
      this.images = signal([this._fileInfo.getContentPath]);
      return;
    }

    if(this.imageList.length > 0)
      this.images = signal([this.imageList[0]]);
    else{
      const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
      this.images = signal([currentImg]);
    }
  } 

  async ngAfterViewInit():Promise<void> {
    this._picSrc = this.getPictureSrc(this._fileInfo);

    if(!this._skip){
      await this.getCurrentPicturePathAndSearchForOthers();
      if(this.imageList.length > 0)
        this.images = signal([this.imageList[0]]);
      else{
        const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
        this.images = signal([this._fileInfo.getContentPath || currentImg]);
      }

      const appData = (this.imageList.length > 0)? this.imageList : this._picSrc;
      this.storeAppState(appData);
    }else{
      this.images = signal([this._picSrc]);
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
    if(evt.key === "ArrowLeft"){
      if (this.selectedIndex() > 0) {
        this.animationDirection.set('left');
        this.selectedIndex.set(this.selectedIndex() - 1);
        this.images.set([this.imageList[this.selectedIndex()]]);
      }
    }

    if(evt.key === "ArrowRight"){
      if (this.selectedIndex() < this.imageList.length - 1) {
        this.animationDirection.set('right');
        this.selectedIndex.set(this.selectedIndex() + 1);
        this.images.set([this.imageList[this.selectedIndex()]]);
      }
    }
  }

  onClick(id?:number):void{

    if(id !== undefined){
      this.images.set([this.imageList[id]]);
    }else{
      if (this.selectedIndex() < this.imageList.length - 1) {
        this.animationDirection.set('right');
        this.selectedIndex.set(this.selectedIndex() + 1);
        this.images.set([this.imageList[this.selectedIndex()]]);
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

  async getCurrentPicturePathAndSearchForOthers():Promise<void>{
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

    if ((getCurrentPath !== Constants.EMPTY_STRING && getContentPath !== Constants.EMPTY_STRING)
        || (getCurrentPath !== Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING)) {
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
