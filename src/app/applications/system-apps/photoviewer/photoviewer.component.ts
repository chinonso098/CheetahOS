/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Input, HostListener, HostBinding } from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import {extname, dirname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';

@Component({
  selector: 'cos-photoviewer',
  templateUrl: './photoviewer.component.html',
  styleUrls: ['./photoviewer.component.css'],
  standalone:false,
  animations: [
    trigger('slideStatusAnimation1', [
      state('slideOut', style({zIndex: 0, right: '-300px' })),
      state('slideIn', style({ zIndex: 1, right: '0' })),

      transition('slideOut => slideIn', [
        animate('150ms ease-in'),
      ]),
      transition('slideIn => slideOut', [
        animate('100ms ease-out'),
      ]),
    ])
  ]
})
export class PhotoViewerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  @ViewChild('photoContainer', {static: true}) photoContainer!: ElementRef; 
  @Input() priorUId = Constants.EMPTY_STRING;

  @HostBinding('class.theme-light') isLightTheme = false;

  private _fileService!:FileService;
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _windowService!:WindowService;
  private _themeService!:ThemeService;

  private _windowResizeSub!: Subscription;
  private _themeChangeSub!: Subscription;

  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _picSrc = Constants.EMPTY_STRING;
  private _returnedPicSrc = Constants.EMPTY_STRING;
  private _checkThisDirectoryForMoreImages = true;
  private _skipOnInit = false;
  private _skipAfterInit = false;
  private currentImgIndex = 0;
  private readonly PATH_TO_IGNORE = '/AppData/StartMenu/photoviewer.url';

  readonly SECONDS_DELAY = 300;// 300ms
  readonly GALLERY_VIEW = 'gallery view';
  readonly PHOTO_VIEW = 'photo view'
  // Matches any base64 image data URI (png, jpeg, gif, webp, svg+xml, avif, ...),
  // e.g. 'data:image/jpeg;base64,...'.
  readonly BASE_64_IMG = /^data:image\/[\w.+-]+;base64,/i;
  firstView = Constants.EMPTY_STRING;

  defaultView = this.GALLERY_VIEW;
  favoriteImg = `${Constants.IMAGE_BASE_PATH}photos_heart.png`;
  folderPathImg = `${Constants.IMAGE_BASE_PATH}photos_info_path.png`;
  fullScaleImg = `${Constants.IMAGE_BASE_PATH}photos_scale.png`;
  galleryImg = `${Constants.IMAGE_BASE_PATH}photos_gallery.png`;
  goBackImg =  `${Constants.IMAGE_BASE_PATH}photos_go_back.png`;
  infoImg = `${Constants.IMAGE_BASE_PATH}photos_info.png`;
  nextImg = `${Constants.IMAGE_BASE_PATH}photos_next_image.png`;
  prevImg = `${Constants.IMAGE_BASE_PATH}photos_prev_image.png`;
  photoImg =  `${Constants.IMAGE_BASE_PATH}photos_info_picture.png`;
  calendarImg =  `${Constants.IMAGE_BASE_PATH}photos_info_calendar.png`;
  scaleImg = `${Constants.IMAGE_BASE_PATH}photos_scale.png`;
  scaleInImg = `${Constants.IMAGE_BASE_PATH}photos_scale_in.png`;
  sizeImg = `${Constants.IMAGE_BASE_PATH}photos_size.png`;
  slideShowImg = `${Constants.IMAGE_BASE_PATH}photos_carousel.png`;
  srcImg =  `${Constants.IMAGE_BASE_PATH}photos_info_source.png`;
  resolutionImg = `${Constants.IMAGE_BASE_PATH}photos_resolution.png`;
  resolutionImg1 = `${Constants.IMAGE_BASE_PATH}photos_info_resolution.png`;
  timeImg =  `${Constants.IMAGE_BASE_PATH}photos_info_time.png`;
  zoomInImg = `${Constants.IMAGE_BASE_PATH}photos_zoom_in.png`;
  zoomOutImg = `${Constants.IMAGE_BASE_PATH}photos_zoom_out.png`;

  currentImg = Constants.EMPTY_STRING;
  selectedIdx = 0;

  isGalleryView = false;
  GALLERY = 'Gallery';
  FAVORITE = 'Favorite';

  imageList:string[][] = [];
  unFilteredImageList:string[][] = [];
  imageListUrl:string[] = [];
  imageFileList:FileInfo[] = [];
  galleryOptions:string[][] = [[this.galleryImg, this.GALLERY]]; // [this.favoriteImg, this.FAVORITE]];;

  screenShotCount = 0;
  sampleCount = 0;
  otherCount = 0;

  imgDimension = Constants.EMPTY_STRING;
  imgSize = Constants.EMPTY_STRING;
  photoName = Constants.EMPTY_STRING;
  imgFilePath = Constants.EMPTY_STRING;
  fileDate:Date= new Date();

  readonly SCREEN_SHOT = 'ScreenShot';
  readonly SAMPLE = 'Sample';
  readonly OTHER = 'Other';
  sortBy = Constants.EMPTY_STRING;
  dash = Constants.DASH;
  imgData = '72 dpi - 24 bit';
  slideState = 'slideOut';

  zoomLevel: number = 0.8;
  zoomStep: number = 0.1;
  minZoom: number = 0.25;
  maxZoom: number = 4;
  zoomRefValue:number = 0.8;

  transformOrigin: string = 'center center'; // default
  // zoomTransform: string = 'scale(1)';
  transformStyle: string = 'scale(0.8) translate(0px, 0px)';

  // panning state
  isPanning: boolean = false;
  startX: number = 0;
  startY: number = 0;
  translateX: number = 0;
  translateY: number = 0;
  lastTranslateX: number = 0;
  lastTranslateY: number = 0;

  private readonly defaultPath = '/Users/Pictures';
  private readonly defaultImg = '/Users/Pictures/Samples/no_img.jpeg';
  private readonly samplePath = '/Users/Pictures/Sample';
  private readonly screenShotPath = '/Users/Pictures/Screen-Shots';

  isOpen = false;
  isMouseMoveActive = false;
  showImageSlide = false;
  showImageInfo = false;

  currentZoomValue = '80%';
  zoomOptions = [
    { value: 4, label: '400%'},
    { value: 3, label: '300%'},
    { value: 2, label: '200%'},
    { value: 1, label: '100%'},
    { value: 0.75, label: '75%'},
    { value: 0.5, label: '50%'},
    { value: 0.25, label: '25%'},
  ];

  readonly name= 'photoviewer';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}photoviewer.png`;
  isMaximizable = true;
  processId = 0;
  type = ComponentType.System;
  displayName = 'PhotoViewer';

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, 
              triggerProcessService:ProcessHandlerService,  sessionManagementService: SessionManagementService, private changeDetectorRef: ChangeDetectorRef,
              windowService:WindowService, themeService:ThemeService) { 
    this._fileService = fileService
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagementService = sessionManagementService;
    this._runningProcessService = runningProcessService;
    this._windowService = windowService;
    this._themeService = themeService;

    // this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info: WindowResizeInfo) => {
    //   if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
    //   this.onWindowResize();
    // });

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  async ngOnInit():Promise<void> {
    this.initTheme();
    this.retrievePastSessionData();

    // Restored from a prior session (_skipOnInit), or launched with no specific
    // image (icon / Start-menu shortcut): nothing to pre-load here — the gallery
    // is loaded by ngAfterViewInit instead.
    this.isGalleryView = this.isLaunchPhotosAppInGalleryView(this._fileInfo);
    if(this._skipOnInit || this.isGalleryView) return;

    await this.loadImageIntoPhotoView();
  }

  async ngAfterViewInit():Promise<void> {
    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();
    this.adjustImageScale();

    // A single image was already fully resolved in ngOnInit.
    if(this._skipAfterInit) return;

    this.setViewForTheFirstTime();

    // Resolve the path of the image carried by the trigger (if any).
    this._picSrc = this.getPictureSrc(this._fileInfo);
    const hasNoImageToShow = this._picSrc === Constants.EMPTY_STRING
      && this._returnedPicSrc === Constants.EMPTY_STRING;

    // Launched from the icon / shortcut with no specific image, or nothing
    // loadable resolved from the trigger or the restored session: fall back to
    // the full Pictures gallery.
    if(this.isGalleryView || hasNoImageToShow){
      await this.showPicturesGallery();
      return;
    }

    // // A real image was opened: pull in its neighbours, otherwise just show it.
    // if(this._checkThisDirectoryForMoreImages)
    //   await this.scanAndLoadImagesInCurrentDirectory();
    // else
    //   this.currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);
  }

  private initTheme():void{
    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });
  }

  // Resolve the single image carried by the launch trigger. Covers a .url
  // shortcut pointing at an image, a freshly generated screenshot (base64), and
  // an already-materialized blob URI. Each case fully sets up the photo view and
  // flags ngAfterViewInit to skip the gallery fallback.
  private async loadImageIntoPhotoView():Promise<void>{
    this.setViewForTheFirstTime();

    console.log('Loading image into photo view. File info:', this._fileInfo);

    if(!this.isGalleryView){
      this.defaultView = this.PHOTO_VIEW;
      this._skipAfterInit = true;
      //await this.scanAndLoadImagesInCurrentDirectory();
    }

    // Resolve the image source from whichever form the trigger carries: a .url
    // shortcut (fetched as a blob), a base64 screenshot, or an existing blob URI.

    if(this._fileInfo.isUrlShortcut()){
      this.currentImg = await this._fileService.getFileAsBlobAsync(this._fileInfo.getContentPath);
    }    else if(this.checkIfImgIsBase64(this._fileInfo.getStringBuffer)){
      /**
       * 2 options to load the image into the photo view:
       * 1. Use the base64 string directly as the image source (this.currentImg = file.getStringBuffer). 
       * This is simple and works well for small images, but can be inefficient for large images because the entire base64 string is loaded into memory.
       * 2. Use the file service to fetch the blob by using the getCurrentPath, and fetching the file by getFileInfoAsync. 
       * This is more efficient for large images, as it allows the browser to handle the image loading and rendering more efficiently.
       *  However, it requires an additional step to fetch the blob.
       */

      /* this.currentImg = file.getStringBuffer;
       this._fileInfo.setContentPath = file.getStringBuffer;
       const imgByteSize = CommonFunctions.getBase64SizeInBytes(file.getStringBuffer);
       this.imgSize = `${CommonFunctions.getReadableFileSizeValue(imgByteSize)} ${CommonFunctions.getFileSizeUnit(imgByteSize)}`; */

      // Use the file service to fetch the blob by using the getCurrentPath, and fetching the file by getFileInfoAsync.
      this._fileInfo  = await this._fileService.getFileInfoAsync(this._fileInfo.getCurrentPath);
      this.currentImg = this._fileInfo.getContentPath;
      this.imgFilePath = this._fileInfo.getCurrentPath;
    }
    else if(this.checkForBlobURI(this._fileInfo.getContentPath)){
      this.currentImg = this._fileInfo.getContentPath;
    }else{
      return;
    }

    //this.imageFileList.push(this._fileInfo);
    await this.scanAndLoadImagesInCurrentDirectory();
    await this.fetchImageDetails(this._fileInfo, this.currentImg);
  }


  private async showPicturesGallery():Promise<void>{
    await this.getAllPicturesInthePicturesFolder(this.defaultPath);
    this.defaultView = this.GALLERY_VIEW;
  }

  // Load the opened image alongside the other images sitting next to it, and
  // persist the resulting list to the session.
  private async scanAndLoadImagesInCurrentDirectory():Promise<void>{
    await this.getAllPicturesIntheCurrentPath();

    const wereMoreImagesFound = this.imageList.length > 0;
    if(wereMoreImagesFound)
      this.currentImg = this.imageList[0][0];
    else if(this._fileInfo.getContentPath !== Constants.EMPTY_STRING)
      this.currentImg = this._fileInfo.getContentPath;
    else
      this.currentImg = await this._fileService.getFileAsBlobAsync(this.defaultImg);

    const appData = wereMoreImagesFound ? this.imageListUrl : this._fileInfo.getCurrentPath;
    this.storeAppState(appData);
  }

  ngOnDestroy(): void {
    this._windowResizeSub?.unsubscribe();
    this._themeChangeSub?.unsubscribe();
  }

  setViewForTheFirstTime():void{
    if(this.firstView !== Constants.EMPTY_STRING) return;
    this.firstView = (this.isGalleryView) ? this.GALLERY_VIEW : this.PHOTO_VIEW;
  }

  async fetchImageDetails(file:FileInfo, byPass?:string): Promise<void>{
    if(!file 
      || (file.getContentPath === Constants.NONE && file.getCurrentPath === Constants.NONE)
      || (file.getContentPath === Constants.EMPTY_STRING)) return;

    // Only a base64 data URI, a blob URI, or a real (non-empty) path is loadable.
    // For gallery view / the .url placeholder, getContentPath is empty, and setting
    // img.src = '' makes the browser resolve it against the document URL and fire
    // onerror. Skip loading in that case to avoid the noisy "Failed to load image".
    const contentPath = (byPass) ? byPass : file.getContentPath;

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        this.imgDimension = `${width} x ${height}`;
        this.imgSize = `${file.getSize} ${file.getFileSizeUnit}`;
        this.photoName = file.getFileName;
        this.imgFilePath = file.getCurrentPath;
        this.fileDate = file.getDateAccessed;

        resolve();
      };
      img.onerror = () => {
        console.warn(`PhotoViewer: could not read image dimensions for ${contentPath}`);
        resolve(); // Still resolve to prevent blocking
      };
      img.src = contentPath;
    });
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.photoContainer, this.processId, this.name, this.icon, this._windowService);
  }

  adjustImageScale():void{
    this.scaleImg = (this.zoomLevel < 1)? this.scaleInImg : this.fullScaleImg;
  }

  onKeyDown(evt:KeyboardEvent):void{
    if(evt.key == "ArrowLeft"){
      if((this.currentImgIndex >= 0)){
        this.currentImg = this.imageList[this.currentImgIndex--][0];

        if(this.currentImgIndex < 0){
          this.currentImgIndex = this.imageList.length - 1;
        }
      }      
    }

    if(evt.key == "ArrowRight"){
      if(this.currentImgIndex <= this.imageList.length - 1){
        this.currentImg = this.imageList[this.currentImgIndex++][0];

        if(this.currentImgIndex > this.imageList.length -1){
          this.currentImgIndex = 0;
        }
      }
    }
  }

  // Handle mouse wheel zoom
  onWheel(evt: WheelEvent): void {
    evt.preventDefault();
    if (evt.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
    this.adjustImageScale();
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
    this.currentZoomValue = `${(this.zoomLevel * 100).toFixed(0)}%`;
    this.updateTransform();
    this.updateCursor();
    this.adjustImageScale();
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
    this.currentZoomValue = `${(this.zoomLevel * 100).toFixed(0)}%`;
    this.updateTransform();
    this.updateCursor();
    this.adjustImageScale();
  }

  updateCursor(): void {
    const img = document.querySelector('.photo-viewer img') as HTMLElement;
    img.style.cursor = this.zoomLevel > 1 ? 'zoom-out' : 'zoom-in';
  }
  
  onMouseMove(evt: MouseEvent): void {
    if(!this.isMouseMoveActive) return;

    const container = evt.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
  
    // Get mouse position as percentage within the container
    const x = ((evt.clientX - rect.left) / rect.width) * 100;
    const y = ((evt.clientY - rect.top) / rect.height) * 100;
  
    // Update transform origin dynamically
    this.transformOrigin = `${x}% ${y}%`;
  }

  startPan(evt: MouseEvent): void {
    evt.stopPropagation();

    if (this.zoomLevel <= 1) return; // only pan when zoomed in

    this.isPanning = true;
    this.startX = evt.clientX;
    this.startY = evt.clientY;
    this.lastTranslateX = this.translateX;
    this.lastTranslateY = this.translateY;
    (evt.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }
  
  pan(evt: MouseEvent): void {
    evt.stopPropagation();

    if (!this.isPanning) return;
  
    const deltaX = evt.clientX - this.startX;
    const deltaY = evt.clientY - this.startY;
  
    this.translateX = this.lastTranslateX + deltaX;
    this.translateY = this.lastTranslateY + deltaY;

    //this.applyPanBoundaries(evt.currentTarget as HTMLElement);
    this.updateTransform();
  }
  
  endPan(): void {
    this.isPanning = false;
    const img = document.querySelector('.photo-viewer img') as HTMLElement;
    if (img) img.style.cursor = this.zoomLevel > 1 ? 'grab' : 'zoom-in';
  }
  
  updateTransform(): void {
    this.transformStyle = `scale(${this.zoomLevel}) translate(${this.translateX}px, ${this.translateY}px)`;
  }

  applyPanBoundaries(container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const baseHeight = 550; // your default image height
    const baseWidth = rect.width * (baseHeight / rect.height); // approximate width based on container
  
    // actual image size at current zoom
    const zoomedWidth = baseWidth * this.zoomLevel;
    const zoomedHeight = baseHeight * this.zoomLevel;
  
    // maximum allowed translation (so part of image always visible)
    const maxX = (zoomedWidth - rect.width) / 2;
    const maxY = (zoomedHeight - rect.height) / 2;
  
    // clamp translation values
    this.translateX = Math.max(-maxX, Math.min(maxX, this.translateX));
    this.translateY = Math.max(-maxY, Math.min(maxY, this.translateY));
  }

   //Double-click resets everything
   resetView(): void {
    this.zoomLevel = 1;
    this.currentZoomValue = '100%';
    this.translateX = 0;
    this.translateY = 0;
    this.transformOrigin = 'center center';
    this.updateTransform();
  }

  //Fit-to-screen button resets and adjusts for container
  fitToScreen(): void {
    this.resetView();
  }

  showImageCarousel():void{
    this.showImageSlide = !this.showImageSlide;
  }

  showImageInfoPane():void{
    this.showImageInfo = !this.showImageInfo;
    this.slideState = (this.showImageInfo)? 'slideIn' : 'slideOut';
  }

  goBackToGallery(): void {
    this.defaultView = this.GALLERY_VIEW;
  }

  onZoomOptionSelect( evt:any):void{
    evt.stopPropagation();
  }

  toggleDropdown(evt?:MouseEvent):void{
    evt?.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  handleZoomSelection(option: { value: number, label: string },   evt:MouseEvent):void{

  }

  onZoomSliderChange(event: Event):void{
    const inputElement = event.target as HTMLInputElement;
    const slideValue = Number(inputElement.value);
    const zoomValue = (slideValue/100);
    if(zoomValue > this.zoomRefValue){
      this.zoomRefValue = zoomValue;
      this.zoomLevel = Math.min(this.zoomLevel + zoomValue, this.maxZoom);
    }else{
      this.zoomRefValue = zoomValue;
      this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
    }

    this.currentZoomValue = `${(this.zoomLevel * 100).toFixed(0)}%`;
    this.updateTransform();
    this.updateCursor();
  }

  async onClick(id:number): Promise<void>{
    this.currentImg = this.imageList[id][0];
    this.currentImgIndex = id;

    const file = this.imageFileList[id];
    await this.fetchImageDetails(file)
  }

  focusHere(evt:MouseEvent):void{
    evt.preventDefault();
    evt.stopPropagation();

    const photoCntnr= document.getElementById('photoCntnr') as HTMLElement;
    if(photoCntnr){
      photoCntnr?.focus();
    }

    this.focusWindow();
  }

 silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  async getAllPicturesIntheCurrentPath():Promise<void>{
    let imgCount = 0;

    // if stuff was returned from session, then use it.
    if(this.imageListUrl.length === 0  && (this._fileInfo)){
      const dirPath = dirname(this._fileInfo.getCurrentPath);
      const entries:string[] = await this._fileService.readDirectory(dirPath);

      for(const entry of entries){
        if(Constants.IMAGE_FILE_EXTENSIONS.includes(extname(entry))){
          const entryPath = `${dirPath}/${entry}`;
          imgCount = imgCount +  1;

          if(entryPath !== this._fileInfo.getCurrentPath){
            const file =  await this._fileService.getFileInfoAsync(`${dirPath}/${entry}`);
            if(file){
              this.imageList.push([file.getContentPath,  this.getSrcName(this._fileInfo.getCurrentPath)]);
              this.imageListUrl.push(file.getCurrentPath);
              this.imageFileList.push(file);
            }
          }
        }
      }

      if(imgCount > 1){
        this.imageList.unshift([this._fileInfo.getContentPath, this.getSrcName(this._fileInfo.getCurrentPath)]);
        return;
      }
    }else if(this.imageListUrl.length > 0){
      for(const entry of this.imageListUrl){
        const img = await this._fileService.getFileAsBlobAsync(entry);
        this.imageList.push([img, this.getSrcName(entry)]);
      }
      return;
    }else if(this._returnedPicSrc !== Constants.EMPTY_STRING){
      this._fileInfo =  await this._fileService.getFileInfoAsync(this._returnedPicSrc);
    }
  }

  async getAllPicturesInthePicturesFolder(path:string):Promise<void>{
    const entries:string[] = await this._fileService.readDirectory(path);
    for(const entry of entries){
      const entryPath = `${path}/${entry}`;
      const stat = await this._fileService.getStatAsync(entryPath);

      if(stat.isDirectory){
        await this.getAllPicturesInthePicturesFolder(entryPath);
      }else{
        const file =  await this._fileService.getFileInfoAsync(entryPath);
        if(file && Constants.IMAGE_FILE_EXTENSIONS.includes(file.getFileExtension) && entryPath !== this.defaultImg){

          if(entryPath.includes(this.samplePath))
            this.sampleCount++;

          if(entryPath.includes(this.screenShotPath))
            this.screenShotCount++;

          this.imageList.push([file.getContentPath, this.getSrcName(entryPath) ]);
          this.imageFileList.push(file);
        }
      }
    }

    this.otherCount = (this.imageList.length - this.sampleCount - this.screenShotCount);
  }

  getSrcName(path:string):string{

    if(path.includes(this.samplePath))
      return 'Sample';

    if(path.includes(this.screenShotPath))
      return 'ScreenShot';

    return 'Other';
  } 

  async handleGalleryOptionSelection(selection:string, idx:number, evt:MouseEvent, view:string): Promise<void>{

  }

  handleSortBy(selection:string):void{
    this.sortBy = selection;
    
    if(this.unFilteredImageList.length === 0)
      this.unFilteredImageList.push(...this.imageList);

    if(this.unFilteredImageList.length !== this.imageList.length){
      this.imageList = [];
      this.imageList.push(...this.unFilteredImageList);
    }

    this.imageList = this.imageList.filter( x => x[1] === selection);
  }

  async handlePictureSelection(img:string, evt:MouseEvent): Promise<void>{
    evt.stopPropagation();

    this.currentImg = img;
    this.defaultView = this.PHOTO_VIEW;

    const imgIdx = this.imageList.findIndex(x => x[0] === img);
    const imgFile = this.imageFileList[imgIdx + 1];
    await this.fetchImageDetails(imgFile);
  }

  @HostListener('document:click')
  onOutsideClick(): void {
    this.isOpen = false;
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();
    this.onOutsideClick();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId 
      && this._windowService.getIsWindowInFocus()) return;
      
    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  // A real image was opened: return its current path so ngAfterViewInit can also
  // pull in the other images sitting next to it. The 'launched from icon' cases
  // (NONE/NONE and the .url placeholder) are handled upstream by isLaunchPhotosAppInGalleryView.
  getPictureSrc(file:FileInfo):string{   
    if(!file) return Constants.EMPTY_STRING;

    // A real image (screenshot/blob) resolves to its saved path; a .url shortcut
    // pointing at an image resolves to the path it links to. Anything else has no
    // single image to show.
    if(this.isRealImageFile(file)) return file.getCurrentPath;
    if(file.isUrlShortcut()) return file.getContentPath;

    return Constants.EMPTY_STRING;
  }

  // True when Photos was launched without a specific image to show. There's no
  // single loadable image in these cases, so fall back to the Pictures gallery:
  //  - launched from the search menu via the Photos icon: the app trigger has
  //    currentPath 'None' (apps have no real file path) and an empty contentPath;
  //  - launched from the Start-menu shortcut: just the .url placeholder;
  //  - a blank/absent trigger.
  // A real image (file explorer, screenshot, blob/base64) always carries a
  // concrete currentPath, so it is NOT treated as a gallery launch.
  private isLaunchPhotosAppInGalleryView(file:FileInfo):boolean{
    if(!file) return true;

    // A real image (file explorer, screenshot, blob/base64) or a .url shortcut
    // pointing at an image opens directly in photo view. Everything else — the
    // Photos icon (NONE/NONE), the Start-menu .url placeholder, or a blank
    // trigger — has no single loadable image, so it falls back to the gallery.
    return !(this.isRealImageFile(file) || file.isUrlShortcut());
  }

  checkIfImgIsBase64(getContentPath:string):boolean{
    return this.BASE_64_IMG.test(getContentPath);
  }

  checkForBlobURI(getContentPath:string):boolean{
    return getContentPath.startsWith(Constants.BLOB_URI_PREFIX);
  }

  // A real (non-shortcut) image file whose content is an inline base64 image or a
  // blob URI — e.g. a screenshot saved to the Screen-Shots folder.
  private isRealImageFile(file:FileInfo):boolean{
    return file.isRealFile(Constants.IMAGE_FILE_EXTENSIONS)
      && (this.checkIfImgIsBase64(file.getContentPath) || this.checkIfImgIsBase64(file.getStringBuffer) || this.checkForBlobURI(file.getContentPath));
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
        this._skipOnInit = true;

        if(typeof appSessionData.appData === 'string')
          this._returnedPicSrc = appSessionData.appData as string; 
        else
          this.imageListUrl = appSessionData.appData as string[];
    }
  }


  onWindowResize():void{
    // CSS flex chain owns layout; just strip any leftover inline px that older
    // imperative code may have written to the photo container.
    const el = this.photoContainer?.nativeElement as HTMLElement | undefined;
    if(!el) return;
    el.style.removeProperty('height');
    el.style.removeProperty('width');
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

}

