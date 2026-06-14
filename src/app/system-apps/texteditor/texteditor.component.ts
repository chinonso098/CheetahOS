/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { Constants } from "src/app/system-files/constants";

import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState } from 'src/app/system-files/state/state.interface';

import {extname} from 'path';
import { Subscription } from 'rxjs';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
  private _sessionManagementService!:SessionManagementService;
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
  private none = "None";

  SECONDS_DELAY = 250;
  /* Floors mirror the CSS min-width/min-height so the resize handler
     ignores transient sub-min sizes during drag. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}text_editor.png`;
  name = 'texteditor';
  isMaximizable = true;
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;


  constructor(processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              fileService:FileService,  sessionManagementService: SessionManagementService, scriptService: ScriptService,
              windowService:WindowService){

    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagementService = sessionManagementService;
    this._scriptService = scriptService;
    this._fileService = fileService;
    this._windowService = windowService;


    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit():void{
    this.retrievePastSessionData();
  }


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

      const isModule = false;
      await this._scriptService.loadStyle("quilljs-css", "osdrive/Program-Files/Quill/quill.snow.css");
      await this._scriptService.loadScript("quilljs", "osdrive/Program-Files/Quill/quill.js", isModule);

      // Initialize Quill
      this.quill = new Quill(this.editorSurface.nativeElement, options);

      // Load file contents (if we have a real path)
      if (this.fileSrc !== Constants.EMPTY_STRING && this.fileSrc !== this.none) {
        const textCntnt = await this._fileService.getFileAsTextAsync(this.fileSrc);
        // Set as plain text; keeps things predictable for line/col math
        this.quill.setText(textCntnt ?? Constants.EMPTY_STRING);
      } else {
        this.quill.setText(Constants.EMPTY_STRING);
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
      if (!this.destroyed){
        await CommonFunctions.sleep(this.SECONDS_DELAY) 
        await this.captureComponentImg();
      }

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
    

    // for multiple instances of quill, we dont want to unload the script until the last instance is closed
    if(this._runningProcessService.getProcessCount(this.name) <= 1){
      this._scriptService.unloadScript( "quilljs", "osdrive/Program-Files/Quill/quill.js");
      this._scriptService.unloadStyle("quilljs-css", "osdrive/Program-Files/Quill/quill.snow.css");

      // quill.js attaches itself to window.Quill — clear it so the
      // global is GC'd and a fresh copy is fetched next time.
      delete (window as any).Quill;
    }
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.editorRoot, this.processId, this.name, this.icon, this._windowService);
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
    // if (!this.fileSrc || this.fileSrc === Constants.EMPTY_STRING) {
    //   console.warn('No fileSrc available. Implement Save As for untitled docs.');
    //   return;
    // }

    try {
      this.isSaving = true;
      this.saveInFlight = true;

      // Quill always has a trailing newline; remove it for file output.
      const raw = this.quill.getText(0, this.quill.getLength());
      const normalized = raw.endsWith('\n') ? raw.slice(0, -1) : raw;

      await this.saveFileHelperAsync(normalized);

      this.isDirty = false;
      this.storeAppState(this.fileSrc);

      // Optional: refresh preview after save
      await this.captureComponentImg();
    } catch (err) {
      console.warn('Save failed:', err);
    } finally {
      this.isSaving = false;
      this.saveInFlight = false;
    }
  }

  // private async autoSave(): Promise<void> {
  //   if (!this.isReady) return;
  //   if (this.isSaving || this.saveInFlight) return;
  //   if (!this.isDirty) return;

  //   await this.saveFile();
  // }

  private async saveFileHelperAsync(textData:string): Promise<void> {
    const fileName = 'Untitled.txt';

    //Opened the app itself without going through a text file, so no proper fileinfo is passed through.
    //Try to get the last trigger info from process handler service,
    //which will be set if the app was triggered by opening a file.
    if(this._fileInfo 
      && this._fileInfo.getCurrentPath === this.none 
      && this._fileInfo.getContentPath === Constants.EMPTY_STRING){ 

        const destPath = Constants.DOCUMENTS_PATH;
        this._fileInfo.setFileType = ".txt";
        this._fileInfo.setFileExtension = ".txt";
        this._fileInfo.setCurrentPath = destPath;
        this._fileInfo.setStringBuffer = textData;
        this._fileInfo.setFileName = fileName;

      await this._fileService.writeFileAsync(destPath, this._fileInfo);
    }
    else{ // In other cases, such as opening through file explorer, the fileinfo will be passed through correctly, so we can just use it.
      this._fileInfo.setStringBuffer = textData;
      await this._fileService.updateFileAsync(this._fileInfo);
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
    // Bring maximize in line with the responsive layout. The editor root
    // (.editor-main-container) is width/height:100% inside a flex column, so
    // the primary window owns the box size and CSS reflows to fill it. We no
    // longer measure #vantaCntnr and stamp explicit pixel sizes (which fought
    // the responsive 100% and double-counted chrome). Just clear any stale
    // inline px so CSS can take over.
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.editorRoot.nativeElement.style.removeProperty('width');
      this.editorRoot.nativeElement.style.removeProperty('height');
    }
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
    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData !== Constants.EMPTY_STRING){
      this.fileSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }
}
