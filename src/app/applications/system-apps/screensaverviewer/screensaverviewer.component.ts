/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';
import { FileInfo } from 'src/app/system-files/fs/file.info';

/**
 * Full-viewport, windowless viewer for dynamic (.ssvr) screen savers.
 *
 * Launched by opening a `.ssvr` file (see FileService.getOpensWith). It hosts
 * the self-contained saver page in a sandboxed iframe that fully covers the
 * screen -- the same isolation technique the lock screen uses
 * (LoginHelpers.buildIframeElement) so the saver's own globals / render loop
 * never collide with the Angular app.
 *
 * Dismissal: like a real screen saver, ANY user activity (mouse move, click,
 * key, scroll, touch) tears the whole thing down. A short arming grace period
 * prevents the launching double-click from instantly closing it.
 */
@Component({
  selector: 'cos-screensaverviewer',
  templateUrl: './screensaverviewer.component.html',
  styleUrl: './screensaverviewer.component.css',
  standalone: false,
})
export class ScreenSaverViewerComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  private _processIdService: ProcessIDService;
  private _runningProcessService: RunningProcessService;
  private _processHandlerService: ProcessHandlerService;
  private _fileService: FileService;
  private _elementRef: ElementRef;

  private _fileInfo!: FileInfo;
  private _iframe?: HTMLIFrameElement;
  private _armTimeoutId?: ReturnType<typeof setTimeout>;
  private _isClosing = false;

  /**
   * Grace period before the dismiss listeners are armed. Without it, the
   * residual mouse movement / click that launched the saver would dismiss it
   * on the same tick it appears.
   */
  private static readonly ARM_DELAY_MS = 600;

  /** User-activity events that dismiss the saver once armed. */
  private static readonly DISMISS_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

  // ---- Process metadata (windowless system app) --------------------------
  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}scrn_saver.png`;
  readonly name = 'screensaverviewer';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  constructor( processIdService: ProcessIDService, runningProcessService: RunningProcessService,
    processHandlerService: ProcessHandlerService, fileService: FileService, elementRef: ElementRef) {
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = processHandlerService;
    this._fileService = fileService;
    this._elementRef = elementRef;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    // Bind once so add/removeEventListener reference the same function.
    this._onDismiss = this._onDismiss.bind(this);
  }

  ngAfterViewInit(): void {
    const src = this.resolveSaverSrc();
    if (src === Constants.EMPTY_STRING) {
      // Nothing to show -- close cleanly rather than render an empty overlay.
      this.closeSelf();
      return;
    }

    this._iframe = this.buildIframe(src);
    (this._elementRef.nativeElement as HTMLElement).appendChild(this._iframe);

    // Arm dismissal after the grace period.
    this._armTimeoutId = setTimeout(() => this.armDismissListeners(), ScreenSaverViewerComponent.ARM_DELAY_MS);
  }

  ngOnDestroy(): void {
    if (this._armTimeoutId) clearTimeout(this._armTimeoutId);
    this.removeDismissListeners();
    this.cleanupIframe();
  }

  /**
   * Build the sandboxed, full-cover iframe. Mirrors
   * LoginHelpers.buildIframeElement, with pointer-events disabled so mouse
   * movement passes through to the host (a sandboxed iframe would otherwise
   * swallow mousemove and the saver could never detect activity to dismiss).
   */
  private buildIframe(src: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    // iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    // Allow the saver's scripts/WebGL but deny same-origin, navigation, popups.
    iframe.setAttribute('sandbox', 'allow-scripts');

    // Load the saver markup via srcdoc instead of pointing src at the .ssvr
    // file directly. GitHub Pages does not recognise the .ssvr extension and
    // serves it as application/octet-stream, which the browser tries to
    // DOWNLOAD rather than render inline; because the frame is sandboxed
    // without 'allow-downloads' that download is blocked and logged, and the
    // saver never appears. srcdoc hands the browser the HTML directly, so it
    // is always parsed as a document regardless of the server's Content-Type.
    // Mirrors LoginHelpers.buildIframeElement.
    fetch(src)
      .then((res) => res.text())
      .then((html) => { iframe.srcdoc = html; })
      .catch((err) => console.warn('ScreenSaverViewer: failed to load dynamic screensaver:', err));

    return iframe;
  }

  /** Resolve the served URL of the .ssvr file that triggered this viewer. */
  private resolveSaverSrc(): string {
    const virtualPath = this._fileInfo?.getCurrentPath ?? Constants.EMPTY_STRING;
    if (virtualPath === Constants.EMPTY_STRING) return Constants.EMPTY_STRING;

    // getCurrentPath is a virtual OS path (e.g. /Cheetah/Themes/.../flowerbox.ssvr).
    // The iframe needs a real HTTP url; getDirectFileUrl maps it onto the served
    // osdrive layer -- the same form the lock screen loads -- which also keeps the
    // saver's relative resource references (scripts/textures) resolving correctly.
    return this._fileService.getDirectFileUrl(virtualPath);
  }

  private armDismissListeners(): void {
    for (const evt of ScreenSaverViewerComponent.DISMISS_EVENTS) {
      window.addEventListener(evt, this._onDismiss, { passive: true });
    }
  }

  private removeDismissListeners(): void {
    for (const evt of ScreenSaverViewerComponent.DISMISS_EVENTS) {
      window.removeEventListener(evt, this._onDismiss);
    }
  }

  private _onDismiss(): void {
    this.closeSelf();
  }

  private cleanupIframe(): void {
    if (!this._iframe) return;
    this._iframe.srcdoc = Constants.EMPTY_STRING; // unload the hosted page
    this._iframe.remove();
    this._iframe = undefined;
  }

  /**
   * Tear down this process. Routed through closeProcessNotify so the standard
   * pipeline (ProcessHandlerService.closeApplicationProcess) removes the
   * dynamic component from the view container and runs ngOnDestroy. Guarded so
   * a burst of dismiss events only closes once.
   */
  private closeSelf(): void {
    if (this._isClosing) return;
    this._isClosing = true;

    this.removeDismissListeners();

    const processToClose = this._runningProcessService.getProcess(this.processId);
    if (processToClose) 
      this._runningProcessService.closeProcessNotify.next(processToClose);
    
  }

  private getComponentDetail(): Process {
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._fileInfo);
  }
}
