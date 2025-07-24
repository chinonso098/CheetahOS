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
  private picSrc = Constants.EMPTY_STRING;


  SECONDS_DELAY = 250;
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
    this._windowService = windowService;
    this.processId = this._processIdService.getNewProcessId();

    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }


  async ngOnInit():Promise<void> {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();

    if(this.imageList.length > 0)
      this.images = signal([this.imageList[0]]);
    else{
      const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
      this.images = signal([currentImg]);
    }
  } 

  async ngAfterViewInit():Promise<void> {
    this.picSrc = (this.picSrc !== Constants.EMPTY_STRING) ? 
    this.picSrc : this.getPictureSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    await this.getCurrentPicturePathAndSearchForOthers();
    if(this.imageList.length > 0)
      this.images = signal([this.imageList[0]]);
    else{
      const currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
      this.images = signal([this.picSrc || currentImg]);
    }

    const appData = (this.imageList.length > 0)? this.imageList : this.picSrc;
    this.storeAppState(appData);

    //tell angular to run additional detection cycle after 
    this.changeDetectorRef.detectChanges();

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY) 
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

  focusOnInput():void{
    const photoCntnr= document.getElementById('photoCntnr') as HTMLElement;
    if(photoCntnr){
      photoCntnr?.focus();
    }
  }

  async getCurrentPicturePathAndSearchForOthers():Promise<void>{
    let imgCount = 0;

    // if stuff was reutrned from session, then use it.
    if(this.imageList.length == 0){
        // else, go fetch.
        const dirPath = dirname(this._fileInfo.getCurrentPath);
        //console.log('dirPath:', dirPath);
        const entries:string[] = await this._fileService.readDirectory(dirPath);

        //check for images
        for(const entry of entries){
          if(Constants.IMAGE_FILE_EXTENSIONS.includes(extname(entry)) ){
            imgCount = imgCount +  1;

            if(`${dirPath}/${entry}` !== this._fileInfo.getCurrentPath){
              const blobPath = await this._fileService.getFileAsBlobAsync(`${dirPath}/${entry}`);
              this.imageList.push(blobPath);
            }
          }
        }

        if(imgCount > 1){
          this.imageList.unshift(this._fileInfo.getContentPath);
        }
    }
  }

  setImageViewerWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  getPictureSrc(pathOne:string, pathTwo:string):string{
    let pictureSrc = Constants.EMPTY_STRING;
    
    if(pathOne.includes('blob:http')){
      return pathOne;
    }else if(this.checkForExt(pathOne,pathTwo)){
      pictureSrc =  `${Constants.ROOT}${this._fileInfo.getContentPath}`;
    }else{
      pictureSrc =  this._fileInfo.getCurrentPath;
      if(pictureSrc.includes(Constants.URL)){
        pictureSrc = Constants.EMPTY_STRING
      }
    }
    return pictureSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    let res = false;

    if(Constants.IMAGE_FILE_EXTENSIONS.includes(contentExt)){
      res = true;
    }else if(Constants.IMAGE_FILE_EXTENSIONS.includes(currentPathExt)){
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
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }
    this._sessionManagmentService.addAppSession(uid, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data !== Constants.EMPTY_STRING){
        if(typeof appSessionData.app_data === 'string')
          this.picSrc = appSessionData.app_data as string; 
        else
          this.imageList = appSessionData.app_data as string[];
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
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }


}
