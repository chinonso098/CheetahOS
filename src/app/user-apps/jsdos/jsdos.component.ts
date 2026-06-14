/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';

import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/file.info';
import { AppState} from 'src/app/system-files/state/state.interface';

import { FileService } from 'src/app/shared/system-service/file.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { TaskBarPreviewImage } from 'src/app/system-apps/taskbarpreview/taskbar.preview';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';

import { Constants } from "src/app/system-files/constants";
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';

declare let emulatorsUi: any;
//declare let Dos: any;
@Component({
  selector: 'cos-jsdos',
  templateUrl: './jsdos.component.html',
  styleUrls: ['./jsdos.component.css'],
  standalone:false,
})
export class JSdosComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('doswindow') dosWindow!: ElementRef; 
  @Input() priorUId = Constants.EMPTY_STRING;

  private _fileService!:FileService;
  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _sessionManagementService!:SessionManagementService;
  private _scriptService!:ScriptService;
  private _windowService!:WindowService;
  
  private dosInstance: any = null; // Store js-dos instance

  // Scoped CSS injection for js-dos.css so its bundled modern-normalize /
  // Tailwind preflight (global *, html, body, h1..h6, [type='button'] ...
  // resets) cannot leak into the rest of CheetahOS. Shared across instances.
  private static readonly JS_DOS_CSS_HREF = 'osdrive/Program-Files/jsdos/js-dos.css';
  private static readonly JS_DOS_CSS_STYLE_ID = 'js-dos-css-scoped';
  private static _scopedStyleEl: HTMLStyleElement | null = null;
  private static _scopedStyleRefs = 0;
  private static _scopedStyleLoading: Promise<void> | null = null;

  private _fileInfo!:FileInfo;
  private _appState!:AppState;
  private _gameSrc = Constants.EMPTY_STRING;
  private _intervalId: any;

  SECONDS_DELAY = 5000;
  WIDTH_PX = [640,854];
  HEIGHT_PX = 480;
  FHD_WIDTH_PX = 1920;
  FHD_HEIGHT_PX = 1080;
  dosWidthPx = this.WIDTH_PX[0];

  name= 'jsdos';
  hasWindow = true;
  icon = `${Constants.IMAGE_BASE_PATH}js-dos_emulator.png`;
  isMaximizable = false;
  processId = 0;
  type = ComponentType.User;
  displayName = 'JS-Dos';

  // Options for the raw emulators-ui `DosInstance` (window.emulatorsUi.dos).
  // The wrapper-only flags (style/noSideBar/noFullscreen/noSocialLinks) do not
  // apply here — emulators-ui has no sidebar/social UI to begin with.
  dosOptions: Record<string, unknown> = {}
  // dosOptions= {
  //   style: "none",
  //   noSideBar: true,
  //   noFullscreen: true,
  //   noSocialLinks:true
  // }

  constructor(fileService:FileService, processIdService:ProcessIDService, runningProcessService:RunningProcessService, triggerProcessService:ProcessHandlerService,
              sessionManagementService: SessionManagementService, scriptService: ScriptService ,windowService:WindowService) { 
    this._fileService = fileService
    this._processIdService = processIdService;
    this._processHandlerService = triggerProcessService;
    this._sessionManagementService = sessionManagementService;
    this._scriptService = scriptService;
    this._windowService = windowService;
    this.processId = this._processIdService.getNewProcessId();
    
    this._runningProcessService = runningProcessService;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.retrievePastSessionData();

    const desktopElmnt = document.getElementById('vantaCntnr') as HTMLDivElement;
    const widthPx = (desktopElmnt && desktopElmnt.offsetWidth >= this.FHD_WIDTH_PX) ? this.WIDTH_PX[1] : this.WIDTH_PX[0];
    this.dosWidthPx = widthPx;

    const resize:WindowResizeInfo = {pId:this.processId, widthPx:widthPx, heightPx:this.HEIGHT_PX}
    this._windowService.resizeProcessWindowNotify.next(resize);
  }

  async ngAfterViewInit():Promise<void>{
    this._gameSrc = this.getGamesSrc(this._fileInfo);
    const isModule = false;
    await this.loadScopedJsDosCss();
    await this._scriptService.loadScript("js-dos", "osdrive/Program-Files/jsdos/js-dos.js", isModule);

    const data = await this._fileService.getFileAsBlobAsync(this._gameSrc);
    // Use the lower-level emulators-ui API directly instead of the DosPlayer
    // wrapper (which logs "please use emulators + emulators-ui instead" when
    // style:'none' is set). window.emulatorsUi is exposed by js-dos.js.
    this.dosInstance = emulatorsUi.dos(this.dosWindow.nativeElement, this.dosOptions);
    //this.dosInstance = await Dos(this.dosWindow.nativeElement, this.dosOptions);
    this.dosInstance.run(data);

    this.storeAppState(this._gameSrc);
    URL.revokeObjectURL(this._gameSrc);

    this.displayName = this._fileInfo.getFileName;

    await CommonFunctions.sleep(this.SECONDS_DELAY);
    this.updateComponentImg();
  }

  async captureComponentImg(): Promise<void>{
    const htmlImg = await this.captureJSDos();

    const cmpntImg:TaskBarPreviewImage = {
      pId: this.processId,
      appName: this.name,
      displayName: this.name,
      icon : this.icon,
      defaultIcon: this.icon,
      imageData: htmlImg
    }
    this._windowService.addProcessPreviewImage(this.name, cmpntImg);
  }

  ngOnDestroy(): void {
    if(this.dosInstance) {
      this.dosInstance.stop(); // Clean up emulators-ui DosInstance
      this.dosInstance = null;
    }

    // Clear the interval to prevent memory leaks
    if (this._intervalId) {
      clearInterval(this._intervalId);
      console.log('Timer cleared on destroy.');
    }


    // for multiple instances of js-dos, we dont want to unload the script until the last instance is closed
    if(this._runningProcessService.getProcessCount(this.name) <= 1){
      this.unloadScopedJsDosCss();
      this._scriptService.unloadScript( "js-dos", "osdrive/Program-Files/jsdos/js-dos.js");

      // js-dos.js attaches itself to window.Dos / window.emulatorsUi — clear
      // them so the globals are GC'd and a fresh copy is fetched next time.
      //delete (window as any).Dos;
      delete (window as any).emulatorsUi;
    }
  }

  async captureJSDos(): Promise<string> {
    const canvasElemnt = document.getElementsByClassName("emulator-canvas")[0] as HTMLCanvasElement;
    if (!canvasElemnt) return Constants.EMPTY_STRING;

    // Get video stream from canvas
    const stream = canvasElemnt.captureStream();
    const track = stream.getVideoTracks()[0];

    // Use ImageCapture (with TS override)
    const imageCapture = new (window as any).ImageCapture(track);
    const bitmap: ImageBitmap = await imageCapture.grabFrame();

    // Draw bitmap onto an offscreen canvas
    const tmp = document.createElement("canvas");
    tmp.width = bitmap.width;
    tmp.height = bitmap.height;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);

    return tmp.toDataURL("image/jpeg", 0.5);
  }

  updateComponentImg():void{
    this._intervalId = setInterval(async() => {
        await this.captureComponentImg()
    }, this.SECONDS_DELAY);
  }

  focusWindow(evt:MouseEvent):void{
    evt.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
    this.dosWindow.nativeElement.focus();
  }

  getGamesSrc(file: FileInfo):string {
    //console.log('getGamesSrc:', file);

    const { getCurrentPath, getContentPath } = file;

    if(getCurrentPath !== Constants.EMPTY_STRING && getCurrentPath.endsWith(Constants.URL)){ 
      return getContentPath;
    }

    if ((getCurrentPath !== Constants.EMPTY_STRING && getContentPath !== Constants.EMPTY_STRING)
        || (getCurrentPath !== Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING)) {
      return getCurrentPath;
    }

    if (getCurrentPath === Constants.EMPTY_STRING && getContentPath === Constants.EMPTY_STRING) {
      return this._gameSrc;
    }

    return Constants.EMPTY_STRING;
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
      this._gameSrc = appSessionData.appData as string;
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo)
  }

  /**
   * Fetches js-dos.css and injects it wrapped in `@scope (.dosbox-container)`
   * so its bundled modern-normalize / Tailwind preflight rules (which target
   * `*`, `html`, `body`, headings, form controls, etc.) only apply inside
   * the JS-DOS window and cannot bleed into the rest of CheetahOS.
   * Reference-counted so concurrent JS-DOS instances share the same <style>.
   */
  private async loadScopedJsDosCss(): Promise<void> {
    if (JSdosComponent._scopedStyleEl) {
      JSdosComponent._scopedStyleRefs++;
      return;
    }
    if (JSdosComponent._scopedStyleLoading) {
      await JSdosComponent._scopedStyleLoading;
      JSdosComponent._scopedStyleRefs++;
      return;
    }

    JSdosComponent._scopedStyleLoading = (async () => {
      const res = await fetch(JSdosComponent.JS_DOS_CSS_HREF);
      const css = await res.text();
      const style = document.createElement('style');
      style.id = JSdosComponent.JS_DOS_CSS_STYLE_ID;
      style.setAttribute('data-asset-name', 'js-dos-css');
      style.textContent = `@scope (.dosbox-container) {\n${css}\n}`;
      document.head.appendChild(style);
      JSdosComponent._scopedStyleEl = style;
    })();

    try {
      await JSdosComponent._scopedStyleLoading;
      JSdosComponent._scopedStyleRefs++;
    } finally {
      JSdosComponent._scopedStyleLoading = null;
    }
  }

  private unloadScopedJsDosCss(): void {
    JSdosComponent._scopedStyleRefs = Math.max(0, JSdosComponent._scopedStyleRefs - 1);
    if (JSdosComponent._scopedStyleRefs === 0 && JSdosComponent._scopedStyleEl) {
      JSdosComponent._scopedStyleEl.remove();
      JSdosComponent._scopedStyleEl = null;
    }
  }

}
