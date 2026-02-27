/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { Constants } from "src/app/system-files/constants";

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';

import {extname} from 'path';
import * as htmlToImage from 'html-to-image';
import { Subscription } from 'rxjs';
import { WindowService } from 'src/app/shared/system-service/window.service';

declare const Quill:any;

@Component({
  selector: 'cos-texteditor',
  templateUrl: './texteditor.component.html',
  styleUrls: ['./texteditor.component.css'],
  standalone:false,
})

export class TextEditorComponent  implements BaseComponent, OnDestroy, AfterViewInit, OnInit  {

  @ViewChild('editorSurface', { static: true }) editorSurface!: ElementRef<HTMLElement>;
  @ViewChild('editorRoot', { static: true }) editorRoot!: ElementRef<HTMLElement>;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _sessionManagmentService!:SessionManagmentService;
  private _processHandlerService!:ProcessHandlerService;
  private _scriptService!:ScriptService;
  private _fileService!:FileService;
  private _windowService!:WindowService;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _maximizeWindowSub!: Subscription;
  private fileSrc = Constants.EMPTY_STRING;
  private quill: any;

  isReady = false;
  isDirty = false;
  isSaving = false;

  cursorLine = 1;
  cursorCol = 1;
  selectedCount = 0;

  private quillSelectionHandler?: (range: any, oldRange: any, source: any) => void;
  private quillTextChangeHandler?: (delta: any, oldDelta: any, source: any) => void;

  private saveInFlight = false;
  private destroyed = false;

  SECONDS_DELAY = 250;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}text_editor.png`;
  name = 'texteditor';
  isMaximizable = false;
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              fileService:FileService,  sessionManagmentService: SessionManagmentService, scriptService: ScriptService,
              windowService:WindowService){

    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagmentService = sessionManagmentService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._windowService = windowService;


    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    this.retrievePastSessionData();
  }


  // ngAfterViewInit(): void {
  //   //this.setTextEditorWindowToFocus(this.processId); 

  //   this.fileSrc = (this.fileSrc !== Constants.EMPTY_STRING)? 
  //   this.fileSrc : this.getFileSrc(this._fileInfo.getContentPath, this._fileInfo.getCurrentPath);

  //   const options = {
  //     debug: 'info',
  //     modules: {
  //       toolbar: true,
  //     },
  //     placeholder: 'Compose an epic...',
  //     theme: 'snow'
  //   };
  //   this._scriptService.loadScript("quilljs","osdrive/Program-Files/Quill/quill.js").then( async() =>{
  
  //     const textCntnt = await this._fileService.getFileAsTextAsync(this.fileSrc);
  //     const index = 0;

  //     this.quill = new Quill(this.editorContainer.nativeElement, options)
  //     this.quill.insertText(index, textCntnt, {
  //       color: '#ffff00',
  //       italic: false,
  //     });
  //   })

  //   setTimeout(()=>{
  //     this.captureComponentImg();
  //   },this.SECONDS_DELAY) 
  // }

  async ngAfterViewInit(): Promise<void> {
    try {
      this.fileSrc = (this.fileSrc !== Constants.EMPTY_STRING)
        ? this.fileSrc
        : this.getFileSrc(this._fileInfo?.getContentPath ?? Constants.EMPTY_STRING, this._fileInfo?.getCurrentPath ?? Constants.EMPTY_STRING);

      if (!this.fileSrc || this.fileSrc === Constants.EMPTY_STRING) {
        // No file path available; still allow an empty editor.
        this.fileSrc = Constants.EMPTY_STRING;
      }

      const options = {
        debug: 'info',
        modules: { toolbar: true },
        placeholder: 'Start typing...',
        theme: 'snow'
      };

      await this._scriptService.loadScript("quilljs", "osdrive/Program-Files/Quill/quill.js");

      // Initialize Quill
      this.quill = new Quill(this.editorSurface.nativeElement, options);

      // Load file contents (if we have a real path)
      if (this.fileSrc !== Constants.EMPTY_STRING) {
        const textCntnt = await this._fileService.getFileAsTextAsync(this.fileSrc);
        // Set as plain text; keeps things predictable for line/col math
        this.quill.setText(textCntnt ?? '');
      } else {
        this.quill.setText('');
      }

      // Mark ready and compute initial status
      this.isReady = true;
      this.isDirty = false;
      this.updateCursorAndSelection();

      // Track selection changes (cursor position + selected length)
      this.quillSelectionHandler = () => this.updateCursorAndSelection();
      this.quill.on('selection-change', this.quillSelectionHandler);

      // Track text changes (dirty flag)
      this.quillTextChangeHandler = (_delta: any, _oldDelta: any, source: any) => {
        if (source === 'user') {
          this.isDirty = true;
          this.updateCursorAndSelection();
        }
      };
      this.quill.on('text-change', this.quillTextChangeHandler);

      // Snapshot for taskbar preview
      setTimeout(() => {
        if (!this.destroyed) this.captureComponentImg();
      }, this.SECONDS_DELAY);

    } catch (err) {
      console.warn('TextEditor init failed:', err);
      this.isReady = false;
    }
  }

ngOnDestroy(): void {
  this.destroyed = true;

  this._maximizeWindowSub?.unsubscribe();

  // Detach Quill handlers if initialized
  if (this.quill && this.quillSelectionHandler) {
    this.quill.off('selection-change', this.quillSelectionHandler);
  }
  if (this.quill && this.quillTextChangeHandler) {
    this.quill.off('text-change', this.quillTextChangeHandler);
  }
}

  captureComponentImg():void{
    htmlToImage.toPng(this.editorRoot.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pId: this.processId,
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
    })
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(evt: KeyboardEvent): void {
    if (!this.isReady) return;

    const key = evt.key?.toLowerCase();
    const isSave = (evt.ctrlKey || evt.metaKey) && key === 's';

    if (isSave) {
      evt.preventDefault();
      void this.saveFile();
    }
  }

  async saveFile(): Promise<void> {
    if (!this.isReady) return;
    if (this.isSaving || this.saveInFlight) return;
    if (!this.isDirty) return;

    // You need a real path to save. If your editor can be “untitled”,
    // you must implement “Save As” elsewhere.
    if (!this.fileSrc || this.fileSrc === Constants.EMPTY_STRING) {
      console.warn('No fileSrc available. Implement Save As for untitled docs.');
      return;
    }

    try {
      this.isSaving = true;
      this.saveInFlight = true;

      // Quill always has a trailing newline; remove it for file output.
      const raw = this.quill.getText(0, this.quill.getLength());
      const normalized = raw.endsWith('\n') ? raw.slice(0, -1) : raw;

      // REQUIRED: implement this method in FileService (see section 4)
      await this._fileService.writeFileAsync(this.fileSrc, normalized);

      this.isDirty = false;
      this.storeAppState(this.fileSrc);

      // Optional: refresh preview after save
      this.captureComponentImg();
    } catch (err) {
      console.warn('Save failed:', err);
    } finally {
      this.isSaving = false;
      this.saveInFlight = false;
    }
  }

  private updateCursorAndSelection(): void {
    if (!this.quill) return;

    const range = this.quill.getSelection();
    if (!range) {
      // When editor loses focus, keep last known line/col, but clear selection count
      this.selectedCount = 0;
      return;
    }

    const index = Math.max(0, range.index ?? 0);
    const length = Math.max(0, range.length ?? 0);

    this.selectedCount = length;

    // Compute line/col from plain text prefix
    // NOTE: getText returns a trailing newline for the doc; prefix math still works.
    const prefix = this.quill.getText(0, index);
    const lastNewline = prefix.lastIndexOf('\n');

    const line = prefix.split('\n').length; // 1-based
    const col = (lastNewline === -1) ? (index + 1) : (index - lastNewline);

    this.cursorLine = Math.max(1, line);
    this.cursorCol = Math.max(1, col);
  }

  maximizeWindow():void{

    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){

      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vantaCntnr') as HTMLElement;
      //window title and button bar, and windows taskbar height
      const pixelTosubtract = 30 + 40;
      this.editorRoot.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
      this.editorRoot.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;

    }
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  getFileSrc(pathOne:string, pathTwo:string):string{
    let fileSrc = Constants.EMPTY_STRING;

    if(this.checkForExt(pathOne,pathTwo)){
      fileSrc = Constants.ROOT + this._fileInfo.getContentPath;
    }else{
      fileSrc =  this._fileInfo.getCurrentPath;
    }

    return fileSrc;
  }

  checkForExt(contentPath:string, currentPath:string):boolean{
    const contentExt = extname(contentPath);
    const currentPathExt = extname(currentPath);
    const ext = ".txt";
    let res = false;

    if(contentExt != Constants.EMPTY_STRING && contentExt == ext){
      res = true;
    }else if( currentPathExt == ext){
      res = false;
    }
    return res;
  }

  storeAppState(app_data:unknown):void{
    const uId = `${this.name}-${this.processId}`;
    this._appState = {
      pId: this.processId,
      appData: app_data as string,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }
    this._sessionManagmentService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      this.fileSrc = appSessionData.appData as string;
    }
  }


  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger();
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }
}
