/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, Input } from '@angular/core';

import {extname} from 'path';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState} from 'src/app/system-files/state/state.interface';

import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { Constants } from "src/app/system-files/constants";
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';

@Component({
  selector: 'cos-pdf-viewer',
  standalone: false,
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.css'
})
export class PdfViewerComponent  implements BaseComponent, OnInit, AfterViewInit {
  @ViewChild('pdfviewer', {static: true}) pdfviewer!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _fileService:FileService;
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _processHandlerService:ProcessHandlerService;
  private _sessionManagmentService: SessionManagmentService;
  private _scriptService: ScriptService;
  private _windowService:WindowService;
  
  private zoomBy = 0;
  private pageRendering = false;
  private pdfDoc:any = null;
  private pdfjsLib: any = null; // Store js-dos instance
  private pageNumPending:any = null;

  pageNum = 0;
  pageCount = 0;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private pdfFileSrc = Constants.EMPTY_STRING;

  // Support HiDPI-screens.
  readonly OUTPUT_SCALE = window.devicePixelRatio || 1;
  readonly SECONDS_DELAY = 450;
  readonly ZOOM_FACTOR = 0.1;
  readonly DEFAULT_SCALE = 1;

  name= 'pdfviewer';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}pdf_js.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'PDFViewer';

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagmentService: SessionManagmentService, scriptService: ScriptService ,windowService:WindowService) { 
    this._fileService = fileService
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this.processId = this._processIdService.getNewProcessId();
    
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
  }

  async ngAfterViewInit(): Promise<void> {
    const firstPage = 1;
    this.pdfFileSrc = (this.pdfFileSrc !== Constants.EMPTY_STRING)
      ? this.pdfFileSrc
      : this.getPDFSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

    this._scriptService
      .loadScript("pdf-js", "osdrive/Program-Files/PDF-JS/build/pdf.mjs")
      .then(async() => {
        // Ensure pdfjsLib is available from the loaded script
        this.pdfjsLib = (window as any).pdfjsLib;
        // Now set the workerSrc
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'osdrive/Program-Files/PDF-JS/build/pdf.worker.mjs';

        const file = await this._fileService.getFileAsBlobAsync(this.pdfFileSrc);
        const isLoaded = await this.loadPDFFile(file);

        if(isLoaded){
          this.pageNum = firstPage
          await this.renderPage(firstPage);
        }

        this.displayName = this._fileInfo.getFileName;
    });

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.captureComponentImg();
  }

  async loadPDFFile(srcFile: string): Promise<boolean> {
    try {
      // Asynchronous load file
      const loadingTask = this.pdfjsLib.getDocument(srcFile);
      const pdf:any = await loadingTask.promise;

      this.pdfDoc = pdf;
      this.pageCount = pdf.numPages;

      return true;
    }catch (error){
      console.error('Error loading PDF file:', error);
      return false;
    }
  }

  async renderPage(pageNumber:number): Promise<void>{
    // Fetch page
    this.pdfDoc.getPage(pageNumber).then(async (page:any) =>{
      const viewport = this.getViewPort(page);
      const transform = this.getTransform();

      // Prepare canvas using PDF page dimensions
      const canvas = document.getElementById(`pdf-canvas-${this.processId}`) as HTMLCanvasElement;
      if(canvas){
        const context = this.getCanvasCntxt(canvas, this.OUTPUT_SCALE, viewport);
        const renderContext = this.getRenderCntxt(context, transform, this.OUTPUT_SCALE, viewport);
        const renderTask = page.render(renderContext);
        renderTask.promise.then(async() =>{
          this.pageRendering  = false;
          if(this.pageNumPending !== null){
            await this.renderPage(this.pageNumPending);
            this.pageNumPending = null;
          }
        });
      }
    });
  }

  async pageZoom(pageNumber:number): Promise<void>{
    // Fetch page
    this.pdfDoc.getPage(pageNumber).then(async (page:any) =>{
      const viewport = this.getViewPort(page);
      const transform = this.getTransform();

      // Prepare canvas using PDF page dimensions
      const canvas = document.getElementById(`pdf-canvas-${this.processId}`) as HTMLCanvasElement;
      if(canvas){
        const context = this.getCanvasCntxt(canvas, this.OUTPUT_SCALE, viewport);
        const renderContext = this.getRenderCntxt(context, transform, this.OUTPUT_SCALE, viewport);
        page.render(renderContext);
      }
    });
  }

  getViewPort(page:any):any{
    const newScale = this.DEFAULT_SCALE + this.zoomBy;
    return page.getViewport({scale: newScale});
  }

  getTransform():number[] | null{
    return this.OUTPUT_SCALE !== 1
          ? [this.OUTPUT_SCALE, 0, 0, this.OUTPUT_SCALE, 0, 0]
          : null; 
  }
  
  getCanvasCntxt(canvas: HTMLCanvasElement, outputScale: number, viewport: any): CanvasRenderingContext2D | null{
    const context = canvas.getContext('2d');
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.style.width = `${Math.floor(viewport.width)}px`;

    return context
  }

  getRenderCntxt(context: CanvasRenderingContext2D | null, transform: number[] | null, outputScale: number, viewport: any):any{
    // Render PDF page into canvas context
    const renderContext = {
      canvasContext: context,
      transform: transform,
      viewport: viewport
    };

    return renderContext;
  }

  async queueRenderPage(num:number):Promise<void>{
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      await this.renderPage(num);
    }
  }

  async zoomIn():Promise<void>{
    if(this.zoomBy === 0.5) return;

    if(this.zoomBy < 0.5){
      this.zoomBy += this.ZOOM_FACTOR;
      await this.pageZoom(this.pageNum);
    }
  }

  async zoomOut():Promise<void>{
    if(this.zoomBy === -0.5) return;

    if(this.zoomBy > -0.5){
      this.zoomBy -= this.ZOOM_FACTOR;
      await this.pageZoom(this.pageNum);
    }
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.pdfviewer.nativeElement).then(htmlImg =>{
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

  async onPrevPage():Promise<void>{
    if (this.pageNum <= 1) {
      return;
    }
    this.pageNum--;
    //this.resetZoom();
    await this.queueRenderPage(this.pageNum);
  }

  async onNextPage():Promise<void>{
    if (this.pageNum >= this.pdfDoc.numPages) {
      return;
    }
    this.pageNum++;
    //this.resetZoom();
    await this.queueRenderPage(this.pageNum);
  }

  resetZoom():void{
    this.zoomBy = 0;
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  getPDFSrc(pathOne:string, pathTwo:string):string{
    let pdfSrc = Constants.EMPTY_STRING;

    if(this.checkForExt(pathOne,pathTwo)){
      pdfSrc = Constants.ROOT + this._fileInfo.getContentPath;
    }else{
      pdfSrc =  this._fileInfo.getCurrentPath;
    }

    return pdfSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".jsdos";
    let res = false;

    if(contentExt !== Constants.EMPTY_STRING && contentExt == ext){
      res = true;
    }else if( currentPathExt === ext){
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
      this.pdfFileSrc = appSessionData.app_data as string;
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._processHandlerService.getLastProcessTrigger)
  }

}
