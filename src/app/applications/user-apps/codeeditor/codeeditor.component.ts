/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit, OnInit, Input, HostBinding } from '@angular/core';
import { Subscription } from 'rxjs';
import {extname} from 'path';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';

import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';

import { Constants } from "src/app/system-files/constants";
import { AppState } from 'src/app/system-files/state/state.interface';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { FileService } from 'src/app/shared/system-service/file.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { ThemeService } from 'src/app/shared/system-theme/theme';

// import { DiffEditorModel } from 'ngx-monaco-editor-v2';


@Component({
  selector: 'cos-codeeditor',
  templateUrl: './codeeditor.component.html',
  styleUrl: './codeeditor.component.css',
  standalone:false,
})
export class CodeEditorComponent  implements BaseComponent,  OnDestroy, AfterViewInit, OnInit {

  @ViewChild('monacoContent', {static: true}) monacoContent!: ElementRef;
  @Input() priorUId = Constants.EMPTY_STRING;
  
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _windowService!:WindowService;
  private _fileService!:FileService;
  private _sessionManagementService!:SessionManagementService

  private _themeService!:ThemeService;

  // Default styling is dark; the host gains `theme-light` for the light variant.
  @HostBinding('class.theme-light') isLightTheme = false;
  private _themeChangeSub!: Subscription;

  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _windowResizeSub!: Subscription;
  private _appState!:AppState;

  private _fileInfo!:FileInfo;
  private _editor: any;   // monaco.editor.IStandaloneCodeEditor
  private _model: any;    // monaco.editor.ITextModel
  private _languageType = Constants.EMPTY_STRING;
  private _isApplyingFileLoad = false;

  SECONDS_DELAY = 250;
  
    /* Floors mirror the CSS min-width/min-height so the resize handler
     ignores transient sub-min sizes during drag. */
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  editorOptions = {}
  code = Constants.EMPTY_STRING;
  cursorLine = 1;
  cursorCol = 1;
  selectedCount = 0;

  fileEncoding = 'UTF-8';           // replace if you can read from FileInfo
  displayLanguage = 'Plain Text';   // human label
  isDirty = false;
  

  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}vs_code.png`;
  isMaximizable = true;
  readonly name = 'codeeditor';
  processId = 0;
  type = ComponentType.User;
  displayName = (this.name as string) || 'untitled';

  constructor( processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
               sessionManagementService:SessionManagementService ,windowService:WindowService, fileService:FileService, themeService:ThemeService ){
    this._processIdService = processIdService
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService = runningProcessService;
    this._sessionManagementService = sessionManagementService;
    this._processHandlerService = triggerProcessService;
    this._windowService = windowService;
    this._fileService = fileService;
    this._themeService = themeService;


    this._runningProcessService.addProcess(this.getComponentDetail());

    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
      const monacoAny = (window as any).monaco;
      if (monacoAny) {
        monacoAny.editor.setTheme(this.isLightTheme ? 'vs' : 'vs-dark');
      }
    });
  }

  ngOnInit(): void {
    this.retrievePastSessionData();

    // Set displayName here (NOT in ngAfterViewInit). It is bound to
    // [processAppName]="displayName"; mutating it after the view is checked
    // triggers NG0100 (ExpressionChangedAfterItHasBeenCheckedError).
    const fileName = this._fileInfo?.getFileName;
    if (fileName && fileName !== Constants.EMPTY_STRING) {
      this.displayName = fileName;
    }
  }


  async ngAfterViewInit(): Promise<void> {
    // Resolve which file to load: a real file reads from its own path; a .url
    // shortcut reads from the target it points at.
    const fileSrc = this._fileService.resolveContentPath(this._fileInfo);
    // Derive the language from the resolved target. A .url shortcut's own
    // extension is '.url'; the file it points at is what we actually edit.
    const fileExt = extname(fileSrc) || this._fileInfo.getFileExtension;
    this._languageType = this.getFileTypeMap(fileExt);

    this.editorOptions = {
      language: this._languageType,
      theme: this.isLightTheme ? 'vs' : 'vs-dark',
      automaticLayout: true,

      // scrolling & layout
      wordWrap: 'on',                 // enables horizontal scrolling when needed
      scrollBeyondLastLine: false,
      minimap: { enabled: true },
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        alwaysConsumeMouseWheel: false,
      },

      // editor UX
      readOnly: false,
      renderLineHighlight: 'line',
      cursorSmoothCaretAnimation: 'on',
    };

    // Load file text
    this._isApplyingFileLoad = true;
    this.code = await this._fileService.getFileAsTextAsync(fileSrc);
    this._isApplyingFileLoad = false;

    // displayName is set in ngOnInit (before the view is checked) to avoid NG0100.

    // Status bar labels
    this.displayLanguage = this.getLanguageLabel(this._languageType);
    this.fileEncoding = this.getFileEncodingLabel();

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    await this.captureComponentImg();

      //this.storeAppState();
  }

  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    this._themeChangeSub?.unsubscribe();

    // Tear down the Monaco editor and its text model. Disposing here releases the
    // editor's internal listeners/async work; any pending operation Monaco cancels
    // as part of this raises a benign `Canceled` error (swallowed by
    // GlobalErrorHandler).
    this._editor?.dispose();
    this._model?.dispose();
    this._editor = undefined;
    this._model = undefined;
  }

  async captureComponentImg(): Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.monacoContent, this.processId, this.name, this.icon, this._windowService);
  }

  onEditorInit(editor: any): void {
    this._editor = editor;
    this._model = editor.getModel();

    // Ensure language is applied even if model already existed
    this.applyModelLanguage(this._languageType);

    // Cursor position -> Ln/Col
    editor.onDidChangeCursorPosition((e: any) => {
      this.cursorLine = e.position.lineNumber;
      this.cursorCol = e.position.column;
    });

    // Selection -> selected char count
    editor.onDidChangeCursorSelection(() => {
      this.selectedCount = this.getSelectionCharCount();
    });

    // Dirty tracking (don’t mark dirty during initial file load)
    this._model.onDidChangeContent(() => {
      if (this._isApplyingFileLoad) return;
      this.isDirty = true;
    });

    // Ctrl+S (Cmd+S on macOS) to save
    const monacoAny = (window as any).monaco;
    if (monacoAny) {
      editor.addCommand(
        monacoAny.KeyMod.CtrlCmd | monacoAny.KeyCode.KeyS,
        async () => {
          await this.saveFile();
        }
      );
    }

  }

  onKeyDown(evt: KeyboardEvent):void{
    if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 's') {
      evt.preventDefault();
    }
  }


  private getSelectionCharCount(): number {
    if (!this._editor || !this._model) return 0;

    const selection = this._editor.getSelection();
    if (!selection || selection.isEmpty()) return 0;

    const selectedText = this._model.getValueInRange(selection);
    return selectedText?.length ?? 0;
  }

  async saveFile(): Promise<void> {
    if (!this._fileInfo) return;

    const path = this._fileInfo.getCurrentPath;

    // Prefer pulling from the model (source of truth)
    const text = this._model ? this._model.getValue() : this.code;
    this._fileInfo.setStringBuffer = text;  // Update FileInfo content

    // You need a write method on FileService.
    // Implement one like: writeTextFileAsync(path: string, content: string): Promise<void>
    //await this._fileService.writeTextFileAsync(path, text);
    await this._fileService.updateFileAsync(this._fileInfo);

    this.isDirty = false;
  }

  private applyModelLanguage(language: string): void {
    // ngx-monaco-editor typically exposes monaco globally
    const monacoAny = (window as any).monaco;
    if (!monacoAny || !this._model) return;

    // Monaco expects ids like 'javascript', 'typescript', 'csharp', 'html', etc.
    // Your map currently returns 'C', 'C++', 'HTML' (these will NOT work as-is).
    const normalized = this.normalizeMonacoLanguageId(language);
    monacoAny.editor.setModelLanguage(this._model, normalized);

    this.displayLanguage = this.getLanguageLabel(normalized);
  }

  private normalizeMonacoLanguageId(lang: string): string {
    const l = (lang || '').toLowerCase();
    if (l === 'c') return 'c';
    if (l === 'c++' || l === 'cpp') return 'cpp';
    if (l === 'html') return 'html';
    if (l === 'unknown file' || !l) return 'plaintext';
    return l;
  }

  private getLanguageLabel(languageId: string): string {
    const id = this.normalizeMonacoLanguageId(languageId);
    const map: Record<string, string> = {
      plaintext: 'Plain Text',
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      csharp: 'C#',
      java: 'Java',
      python: 'Python',
      c: 'C',
      cpp: 'C++',
      html: 'HTML',
    };
    return map[id] ?? id;
  }

  private getFileEncodingLabel(): string {
    // If your FileInfo carries encoding, use it here.
    // Otherwise default:
    return 'UTF-8';
  }

  getFileTypeMap(fileExt: string): string {
    const FileExtensionLanguageMap = [
      ['.js', 'javascript'],
      ['.js.map', 'javascript'],
      ['.xml', 'xml'],
      ['.json', 'json'],
      ['.ts', 'typescript'],
      ['.cs', 'csharp'],
      ['.java', 'java'],
      ['.py', 'python'],
      ['.c', 'c'],
      ['.cpp', 'cpp'],
      ['.html', 'html'],
    ];

    for (const map of FileExtensionLanguageMap) {
      if (map[0] === fileExt) return map[1];
    }
    return 'text/plain';
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
    if(appSessionData !== null && appSessionData.appData != Constants.EMPTY_STRING){
        this.code =  appSessionData.appData as string;
    }
  }


  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() !== this.processId
      && this._windowService.getIsWindowInFocus()){

      this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
    }

    // The window-container's mousedown calls .focus() on the container (tabindex=0),
    // which steals focus from Monaco's hidden textarea and hides the caret.
    // Give focus back to the editor after that runs.
    if(this._editor){
      requestAnimationFrame(() => this._editor?.focus());
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

}
