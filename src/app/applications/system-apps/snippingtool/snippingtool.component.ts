/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input,
  HostBinding, HostListener, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import * as htmlToImage from 'html-to-image';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';

type CaptureMode = 'rectangle' | 'window' | 'fullscreen' | 'freeform';
type EditorTool = 'none' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'crop';
type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';
type Phase = 'idle' | 'countdown' | 'selecting' | 'editing';

interface Point { x: number; y: number; }
interface Rect { left: number; top: number; width: number; height: number; }

@Component({
  selector: 'cos-snippingtool',
  templateUrl: './snippingtool.component.html',
  styleUrls: ['./snippingtool.component.css'],
  standalone: false,
})
export class SnippingToolComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  @ViewChild('editorCanvas', { static: true }) editorCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('editorArea', { static: true }) editorAreaRef!: ElementRef<HTMLElement>;
  @ViewChild('fileInput', { static: true }) fileInputRef!: ElementRef<HTMLInputElement>;
  @Input() priorUId = Constants.EMPTY_STRING;

  @HostBinding('class.theme-light') isLightTheme = false;

  private _processIdService: ProcessIDService;
  private _runningProcessService: RunningProcessService;
  private _processHandlerService: ProcessHandlerService;
  private _windowService: WindowService;
  private _fileService: FileService;
  private _themeService: ThemeService;
  private _userNotificationService: UserNotificationService;
  private _cdr: ChangeDetectorRef;

  private _themeChangeSub!: Subscription;
  private _resizeObserver?: ResizeObserver;

  readonly name = 'snippingtool';
  hasWindow = true;
  isMaximizable = true;
  icon = `${Constants.IMAGE_BASE_PATH}snip_tool.png`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Snipping Tool';

  readonly MIN_WIDTH_PX = 640;
  readonly MIN_HEIGHT_PX = 420;
  private readonly SCREENSHOT_DIR = '/Users/Pictures/Screen-Shots';

  // ── capture configuration ─────────────────────────────────────────────
  captureMode: CaptureMode = 'rectangle';
  selectedDelay = 0; // seconds
  readonly delayOptions = [0, 3, 5, 10];
  readonly captureModes: { mode: CaptureMode; label: string }[] = [
    { mode: 'rectangle', label: 'Rectangle' },
    { mode: 'window', label: 'Window' },
    { mode: 'fullscreen', label: 'Full screen' },
    { mode: 'freeform', label: 'Freeform' },
  ];

  // ── editor tool state ─────────────────────────────────────────────────
  tool: EditorTool = 'none';
  shapeKind: ShapeKind = 'rectangle';
  penColor = '#e10600';
  penSize = 4;
  highlighterColor = '#fff100';
  highlighterSize = 18;

  readonly palette: string[] = [
    '#000000', '#ffffff', '#c8c8c8', '#7f7f7f', '#e10600', '#ff8c00',
    '#ffd400', '#7bd400', '#00a651', '#00adef', '#0053a6', '#7a3fbf',
    '#e5007e', '#8b4513', '#00d1c1', '#ff69b4',
  ];
  readonly shapeKinds: ShapeKind[] = ['rectangle', 'ellipse', 'line', 'arrow'];

  // ── ui flags ──────────────────────────────────────────────────────────
  phase: Phase = 'idle';
  showBanner = true;
  showModeMenu = false;
  showDelayMenu = false;
  showPenMenu = false;
  showHighlighterMenu = false;
  showShapeMenu = false;
  showOverflowMenu = false;
  showZoomMenu = false;
  showRuler = false;
  isBusy = false;
  countdownValue = 0;

  zoom = 1;
  readonly zoomSteps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

  // ── selection overlay state ───────────────────────────────────────────
  selecting = false;
  selectionRect: Rect = { left: 0, top: 0, width: 0, height: 0 };
  freeformPath: Point[] = [];
  windowRects: Rect[] = [];
  hoverWindowIndex = -1;
  private _selStart: Point = { x: 0, y: 0 };
  private _srcDataUrl = Constants.EMPTY_STRING;
  private _srcNaturalW = 0;
  private _srcNaturalH = 0;
  private _srcViewW = 0;
  private _srcViewH = 0;

  // ── editor canvas / drawing internals ─────────────────────────────────
  hasImage = false;
  private _baseImage: HTMLImageElement | null = null;
  private _imgW = 0;
  private _imgH = 0;
  private _annotationCanvas: HTMLCanvasElement | null = null;
  private _annotationCtx: CanvasRenderingContext2D | null = null;
  private _displayCtx: CanvasRenderingContext2D | null = null;

  private _drawing = false;
  private _lastPoint: Point = { x: 0, y: 0 };
  private _startPoint: Point = { x: 0, y: 0 };

  private _history: ImageData[] = [];
  private _historyIndex = -1;

  // The file this app was launched with (a desktop screenshot). This is the
  // ONLY launch path — the app is hidden from every app catalogue.
  private _triggerFile?: FileInfo;

  constructor(processIdService: ProcessIDService, runningProcessService: RunningProcessService,
    processHandlerService: ProcessHandlerService, windowService: WindowService, fileService: FileService,
    themeService: ThemeService, userNotificationService: UserNotificationService, cdr: ChangeDetectorRef) {
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = processHandlerService;
    this._windowService = windowService;
    this._fileService = fileService;
    this._themeService = themeService;
    this._userNotificationService = userNotificationService;
    this._cdr = cdr;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    this.isLightTheme = this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isLightTheme = this._themeService.isLightTheme();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.editorCanvasRef?.nativeElement;
    if (canvas) this._displayCtx = canvas.getContext('2d');

    // Re-fit the loaded image whenever the editor area changes size (window
    // open, manual resize, maximize, restore).
    this._resizeObserver = new ResizeObserver(() => {
      if (!this.hasImage) return;
      this.fitToWindow();
      this.renderCanvas();
      this._cdr.detectChanges();
    });
    this._resizeObserver.observe(this.editorAreaRef.nativeElement);

    await this.loadTriggerImage();
  }

  // Load the screenshot the app was launched with straight into the editor.
  private async loadTriggerImage(): Promise<void> {
    const file = this._triggerFile;
    if (!file) return;

    const buffer = file.getStringBuffer;
    const contentPath = file.getContentPath;
    let src = Constants.EMPTY_STRING;
    if (buffer && /^data:image\//i.test(buffer)) src = buffer;
    else if (contentPath && (contentPath.startsWith('blob:') || /^data:image\//i.test(contentPath))) src = contentPath;
    if (src === Constants.EMPTY_STRING) return;

    try {
      await this.loadIntoEditor(src);
    } catch (err) {
      console.error('Snipping Tool: failed to load launch screenshot:', err);
    }
  }

  ngOnDestroy(): void {
    this._themeChangeSub?.unsubscribe();
    this._resizeObserver?.disconnect();
  }

  // #region ── Window helpers ────────────────────────────────────────────
  silenceCtxEvt(evt?: MouseEvent): void {
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  private getOwnWindowElement(): HTMLElement | null {
    const host = document.querySelector('cos-snippingtool') as HTMLElement | null;
    return (host?.closest('.window-container') as HTMLElement) ?? null;
  }
  // #endregion

  // #region ── Menus ─────────────────────────────────────────────────────
  private closeAllMenus(): void {
    this.showModeMenu = false;
    this.showDelayMenu = false;
    this.showPenMenu = false;
    this.showHighlighterMenu = false;
    this.showShapeMenu = false;
    this.showOverflowMenu = false;
    this.showZoomMenu = false;
  }

  toggleModeMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showModeMenu; this.closeAllMenus(); this.showModeMenu = !s; }
  toggleDelayMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showDelayMenu; this.closeAllMenus(); this.showDelayMenu = !s; }
  togglePenMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showPenMenu; this.closeAllMenus(); this.showPenMenu = !s; }
  toggleHighlighterMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showHighlighterMenu; this.closeAllMenus(); this.showHighlighterMenu = !s; }
  toggleShapeMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showShapeMenu; this.closeAllMenus(); this.showShapeMenu = !s; }
  toggleOverflowMenu(evt: MouseEvent): void { evt.stopPropagation(); const s = this.showOverflowMenu; this.closeAllMenus(); this.showOverflowMenu = !s; }
  toggleZoomMenu(evt: MouseEvent): void { evt.stopPropagation(); this.showZoomMenu = !this.showZoomMenu; }

  @HostListener('document:click')
  onDocumentClick(): void { this.closeAllMenus(); }

  selectMode(mode: CaptureMode): void { this.captureMode = mode; this.closeAllMenus(); }
  selectDelay(delay: number): void { this.selectedDelay = delay; this.closeAllMenus(); }
  get selectedModeLabel(): string { return this.captureModes.find(m => m.mode === this.captureMode)?.label ?? 'Rectangle'; }
  get selectedDelayLabel(): string { return this.selectedDelay === 0 ? 'No delay' : `${this.selectedDelay}-second delay`; }
  dismissBanner(): void { this.showBanner = false; }
  // #endregion

  // #region ── Capture ───────────────────────────────────────────────────
  async onNewSnip(): Promise<void> {
    if (this.isBusy) return;
    this.closeAllMenus();
    this.isBusy = true;

    try {
      if (this.selectedDelay > 0) {
        this.phase = 'countdown';
        for (let i = this.selectedDelay; i > 0; i--) {
          this.countdownValue = i;
          this._cdr.detectChanges();
          await CommonFunctions.sleep(1000);
        }
      }

      const captured = await this.captureDesktop();
      if (captured === Constants.EMPTY_STRING) {
        this.phase = this.hasImage ? 'editing' : 'idle';
        this._userNotificationService.showErrorNotification('Snip capture failed.', `${this.name}-${this.processId}`);
        return;
      }

      // Resolve the natural vs on-screen size so selection coordinates map correctly.
      const img = new Image();
      img.src = captured;
      await img.decode();
      this._srcDataUrl = captured;
      this._srcNaturalW = img.naturalWidth;
      this._srcNaturalH = img.naturalHeight;

      if (this.captureMode === 'fullscreen') {
        await this.loadIntoEditor(captured);
        return;
      }

      // Open the full-viewport selection overlay.
      this.selectionRect = { left: 0, top: 0, width: 0, height: 0 };
      this.freeformPath = [];
      this.hoverWindowIndex = -1;
      if (this.captureMode === 'window') this.computeWindowRects();
      this.phase = 'selecting';
    } catch (err) {
      console.error('Snip capture failed:', err);
      this.phase = this.hasImage ? 'editing' : 'idle';
    } finally {
      this.isBusy = false;
      this._cdr.detectChanges();
    }
  }

  private async captureDesktop(): Promise<string> {
    const dsktp = document.getElementById('vantaCntnr') as HTMLElement | null;
    if (!dsktp) return Constants.EMPTY_STRING;

    const vanta = document.querySelector('.vanta-canvas') as HTMLCanvasElement | null;
    const ownWin = this.getOwnWindowElement();

    // Record the on-screen size the capture was taken at so overlay CSS pixels
    // can be scaled to the image's natural pixels when cropping.
    this._srcViewW = dsktp.clientWidth;
    this._srcViewH = dsktp.clientHeight;

    try {
      if (ownWin) ownWin.style.visibility = 'hidden';
      // Let the browser paint the now-hidden window before snapshotting.
      await CommonFunctions.sleep(80);
      return await this.mergeDesktopImages(dsktp, vanta);
    } catch (err) {
      console.error('mergeDesktopImages failed:', err);
      return Constants.EMPTY_STRING;
    } finally {
      if (ownWin) ownWin.style.visibility = 'visible';
    }
  }

  // Composite the Vanta WebGL background (not captured by html-to-image) with the
  // rasterized DOM. Mirrors the desktop component's own screenshot pipeline.
  private async mergeDesktopImages(dsktpCntnr: HTMLElement, canvasElmnt: HTMLCanvasElement | null): Promise<string> {
    const htmlImg = await htmlToImage.toPng(dsktpCntnr);

    const vantaImg = new Image();
    if (canvasElmnt) {
      vantaImg.src = canvasElmnt.toDataURL('image/png');
      await vantaImg.decode();
    }

    const foreGrndImg = new Image();
    foreGrndImg.src = htmlImg;
    await foreGrndImg.decode();

    const merged = document.createElement('canvas');
    merged.width = dsktpCntnr.offsetWidth;
    merged.height = dsktpCntnr.offsetHeight;

    const ctx = merged.getContext('2d');
    if (!ctx) return Constants.EMPTY_STRING;

    if (canvasElmnt) ctx.drawImage(vantaImg, 0, 0, merged.width, merged.height);
    ctx.drawImage(foreGrndImg, 0, 0, merged.width, merged.height);
    ctx.imageSmoothingEnabled = true;

    return merged.toDataURL('image/png');
  }

  private computeWindowRects(): void {
    const own = this.getOwnWindowElement();
    const nodes = Array.from(document.querySelectorAll('.window-container')) as HTMLElement[];
    this.windowRects = nodes
      .filter(n => n !== own && n.offsetWidth > 0 && n.offsetHeight > 0)
      .map(n => {
        const r = n.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
  }
  // #endregion

  // #region ── Selection overlay interaction ─────────────────────────────
  onSelectionDown(evt: MouseEvent): void {
    if (this.captureMode === 'window') return;
    evt.preventDefault();
    this.selecting = true;
    this._selStart = { x: evt.clientX, y: evt.clientY };
    if (this.captureMode === 'freeform') {
      this.freeformPath = [{ x: evt.clientX, y: evt.clientY }];
    } else {
      this.selectionRect = { left: evt.clientX, top: evt.clientY, width: 0, height: 0 };
    }
  }

  onSelectionMove(evt: MouseEvent): void {
    if (this.captureMode === 'window') {
      this.hoverWindowIndex = this.windowRects.findIndex(r =>
        evt.clientX >= r.left && evt.clientX <= r.left + r.width &&
        evt.clientY >= r.top && evt.clientY <= r.top + r.height);
      return;
    }
    if (!this.selecting) return;
    if (this.captureMode === 'freeform') {
      this.freeformPath.push({ x: evt.clientX, y: evt.clientY });
    } else {
      this.selectionRect = {
        left: Math.min(this._selStart.x, evt.clientX),
        top: Math.min(this._selStart.y, evt.clientY),
        width: Math.abs(evt.clientX - this._selStart.x),
        height: Math.abs(evt.clientY - this._selStart.y),
      };
    }
  }

  async onSelectionUp(evt: MouseEvent): Promise<void> {
    if (this.captureMode === 'window') {
      if (this.hoverWindowIndex < 0) return;
      const r = this.windowRects[this.hoverWindowIndex];
      await this.cropAndLoad(r, null);
      return;
    }
    if (!this.selecting) return;
    this.selecting = false;

    if (this.captureMode === 'freeform') {
      if (this.freeformPath.length < 3) { this.cancelSelection(); return; }
      const bounds = this.pathBounds(this.freeformPath);
      await this.cropAndLoad(bounds, this.freeformPath);
      return;
    }

    if (this.selectionRect.width < 2 || this.selectionRect.height < 2) { this.cancelSelection(); return; }
    await this.cropAndLoad(this.selectionRect, null);
  }

  get freeformPoints(): string {
    return this.freeformPath.map(p => `${p.x},${p.y}`).join(' ');
  }

  get srcDataUrl(): string { return this._srcDataUrl; }

  private pathBounds(path: Point[]): Rect {
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  }

  cancelSelection(): void {
    this.selecting = false;
    this.freeformPath = [];
    this.selectionRect = { left: 0, top: 0, width: 0, height: 0 };
    this.phase = this.hasImage ? 'editing' : 'idle';
  }

  // Crop a viewport-space rect out of the captured source image, optionally
  // masking to a freeform polygon, then hand the result to the editor.
  private async cropAndLoad(rectVp: Rect, polygon: Point[] | null): Promise<void> {
    const scaleX = this._srcNaturalW / (this._srcViewW || 1);
    const scaleY = this._srcNaturalH / (this._srcViewH || 1);

    const src = new Image();
    src.src = this._srcDataUrl;
    await src.decode();

    let sx = rectVp.left * scaleX;
    let sy = rectVp.top * scaleY;
    let sw = rectVp.width * scaleX;
    let sh = rectVp.height * scaleY;

    // Clamp to the image bounds.
    if (sx < 0) { sw += sx; sx = 0; }
    if (sy < 0) { sh += sy; sy = 0; }
    if (sx + sw > this._srcNaturalW) sw = this._srcNaturalW - sx;
    if (sy + sh > this._srcNaturalH) sh = this._srcNaturalH - sy;
    if (sw <= 0 || sh <= 0) { this.cancelSelection(); return; }

    const out = document.createElement('canvas');
    out.width = Math.round(sw);
    out.height = Math.round(sh);
    const ctx = out.getContext('2d');
    if (!ctx) { this.cancelSelection(); return; }

    if (polygon && polygon.length >= 3) {
      ctx.beginPath();
      ctx.moveTo((polygon[0].x - rectVp.left) * scaleX, (polygon[0].y - rectVp.top) * scaleY);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo((polygon[i].x - rectVp.left) * scaleX, (polygon[i].y - rectVp.top) * scaleY);
      }
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
    await this.loadIntoEditor(out.toDataURL('image/png'));
  }
  // #endregion

  // #region ── Editor: load / render ─────────────────────────────────────
  private async loadIntoEditor(dataUrl: string): Promise<void> {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    this._baseImage = img;
    this._imgW = img.naturalWidth;
    this._imgH = img.naturalHeight;

    this._annotationCanvas = document.createElement('canvas');
    this._annotationCanvas.width = this._imgW;
    this._annotationCanvas.height = this._imgH;
    this._annotationCtx = this._annotationCanvas.getContext('2d');

    this.hasImage = true;
    this.phase = 'editing';
    this.tool = 'none';
    this._history = [];
    this._historyIndex = -1;
    this.zoom = 1;
    this._cdr.detectChanges();

    const canvas = this.editorCanvasRef.nativeElement;
    canvas.width = this._imgW;
    canvas.height = this._imgH;
    this._displayCtx = canvas.getContext('2d');

    this.pushHistory();
    this.fitToWindow();
    this.renderCanvas();
  }

  private renderCanvas(preview?: (ctx: CanvasRenderingContext2D) => void): void {
    if (!this._displayCtx || !this._baseImage) return;
    const ctx = this._displayCtx;
    ctx.clearRect(0, 0, this._imgW, this._imgH);
    ctx.drawImage(this._baseImage, 0, 0);
    if (this._annotationCanvas) ctx.drawImage(this._annotationCanvas, 0, 0);
    if (preview) preview(ctx);
  }
  // #endregion

  // #region ── Editor: tools ─────────────────────────────────────────────
  selectTool(tool: EditorTool): void {
    this.tool = this.tool === tool ? 'none' : tool;
    if (tool !== 'pen') this.showPenMenu = false;
    if (tool !== 'highlighter') this.showHighlighterMenu = false;
    if (tool !== 'shape') this.showShapeMenu = false;
  }

  pickPenColor(color: string): void { this.penColor = color; this.tool = 'pen'; }
  pickHighlighterColor(color: string): void { this.highlighterColor = color; this.tool = 'highlighter'; }
  pickShape(kind: ShapeKind): void { this.shapeKind = kind; this.tool = 'shape'; this.showShapeMenu = false; }

  private toCanvasPoint(evt: MouseEvent): Point {
    const canvas = this.editorCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (canvas.width / rect.width),
      y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  onCanvasDown(evt: MouseEvent): void {
    if (this.phase !== 'editing' || this.tool === 'none') return;
    evt.preventDefault();
    this._drawing = true;
    const p = this.toCanvasPoint(evt);
    this._startPoint = p;
    this._lastPoint = p;

    const actx = this._annotationCtx;
    if (!actx) return;

    if (this.tool === 'pen' || this.tool === 'highlighter') {
      actx.save();
      this.configureStroke(actx);
      actx.beginPath();
      actx.moveTo(p.x, p.y);
      // A dot for a single click.
      actx.lineTo(p.x + 0.01, p.y + 0.01);
      actx.stroke();
      actx.restore();
      this.renderCanvas();
    } else if (this.tool === 'eraser') {
      this.eraseAt(p);
      this.renderCanvas();
    }
  }

  onCanvasMove(evt: MouseEvent): void {
    if (!this._drawing) return;
    const p = this.toCanvasPoint(evt);
    const actx = this._annotationCtx;
    if (!actx) return;

    if (this.tool === 'pen' || this.tool === 'highlighter') {
      const target = this.showRuler ? { x: p.x, y: this._startPoint.y } : p;
      actx.save();
      this.configureStroke(actx);
      actx.beginPath();
      actx.moveTo(this._lastPoint.x, this._lastPoint.y);
      actx.lineTo(target.x, target.y);
      actx.stroke();
      actx.restore();
      this._lastPoint = this.showRuler ? { x: target.x, y: this._startPoint.y } : p;
      this.renderCanvas();
    } else if (this.tool === 'eraser') {
      this.eraseLine(this._lastPoint, p);
      this._lastPoint = p;
      this.renderCanvas();
    } else if (this.tool === 'shape' || this.tool === 'crop') {
      this.renderCanvas(ctx => this.drawShapePreview(ctx, this._startPoint, p));
    }
  }

  async onCanvasUp(evt: MouseEvent): Promise<void> {
    if (!this._drawing) return;
    this._drawing = false;
    const p = this.toCanvasPoint(evt);

    if (this.tool === 'shape') {
      const actx = this._annotationCtx;
      if (actx) this.drawShape(actx, this._startPoint, p);
      this.renderCanvas();
      this.pushHistory();
    } else if (this.tool === 'crop') {
      await this.applyCrop(this._startPoint, p);
    } else if (this.tool === 'pen' || this.tool === 'highlighter' || this.tool === 'eraser') {
      this.pushHistory();
    }
  }

  onCanvasLeave(): void {
    if (this._drawing && (this.tool === 'pen' || this.tool === 'highlighter' || this.tool === 'eraser')) {
      this._drawing = false;
      this.pushHistory();
    } else {
      this._drawing = false;
    }
  }

  private configureStroke(ctx: CanvasRenderingContext2D): void {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (this.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.highlighterColor;
      ctx.lineWidth = this.highlighterSize;
      ctx.lineCap = 'butt';
    } else {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.penColor;
      ctx.lineWidth = this.penSize;
    }
  }

  private eraseAt(p: Point): void {
    const actx = this._annotationCtx;
    if (!actx) return;
    actx.save();
    actx.globalCompositeOperation = 'destination-out';
    actx.beginPath();
    actx.arc(p.x, p.y, this.penSize * 2.5, 0, Math.PI * 2);
    actx.fill();
    actx.restore();
  }

  private eraseLine(from: Point, to: Point): void {
    const actx = this._annotationCtx;
    if (!actx) return;
    actx.save();
    actx.globalCompositeOperation = 'destination-out';
    actx.lineJoin = 'round';
    actx.lineCap = 'round';
    actx.lineWidth = this.penSize * 5;
    actx.beginPath();
    actx.moveTo(from.x, from.y);
    actx.lineTo(to.x, to.y);
    actx.stroke();
    actx.restore();
  }

  private drawShapePreview(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    ctx.save();
    this.drawShape(ctx, a, b);
    ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    ctx.save();
    ctx.strokeStyle = this.penColor;
    ctx.fillStyle = this.penColor;
    ctx.lineWidth = this.penSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.shapeKind === 'rectangle') {
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (this.shapeKind === 'ellipse') {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.shapeKind === 'line') {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (this.shapeKind === 'arrow') {
      this.drawArrow(ctx, a, b);
    }
    ctx.restore();
  }

  private drawArrow(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    const head = Math.max(10, this.penSize * 3);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  private async applyCrop(a: Point, b: Point): Promise<void> {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    if (width < 4 || height < 4) { this.renderCanvas(); return; }

    // Composite current base + annotations, then crop that.
    const composite = document.createElement('canvas');
    composite.width = this._imgW;
    composite.height = this._imgH;
    const cctx = composite.getContext('2d');
    if (!cctx || !this._baseImage) return;
    cctx.drawImage(this._baseImage, 0, 0);
    if (this._annotationCanvas) cctx.drawImage(this._annotationCanvas, 0, 0);

    const cropped = document.createElement('canvas');
    cropped.width = Math.round(width);
    cropped.height = Math.round(height);
    const ctx = cropped.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(composite, left, top, width, height, 0, 0, cropped.width, cropped.height);

    await this.loadIntoEditor(cropped.toDataURL('image/png'));
  }
  // #endregion

  // #region ── Undo / redo ───────────────────────────────────────────────
  private pushHistory(): void {
    if (!this._annotationCtx) return;
    const snap = this._annotationCtx.getImageData(0, 0, this._imgW, this._imgH);
    // Drop any redo tail before recording a new state.
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push(snap);
    this._historyIndex = this._history.length - 1;
  }

  get canUndo(): boolean { return this._historyIndex > 0; }
  get canRedo(): boolean { return this._historyIndex < this._history.length - 1; }

  undo(): void {
    if (!this.canUndo || !this._annotationCtx) return;
    this._historyIndex--;
    this._annotationCtx.putImageData(this._history[this._historyIndex], 0, 0);
    this.renderCanvas();
  }

  redo(): void {
    if (!this.canRedo || !this._annotationCtx) return;
    this._historyIndex++;
    this._annotationCtx.putImageData(this._history[this._historyIndex], 0, 0);
    this.renderCanvas();
  }
  // #endregion

  // #region ── Zoom ──────────────────────────────────────────────────────
  get zoomLabel(): string { return `${Math.round(this.zoom * 100)}%`; }

  setZoom(value: number): void { this.zoom = value; this.showZoomMenu = false; this.showOverflowMenu = false; }

  zoomIn(): void {
    const next = this.zoomSteps.find(z => z > this.zoom);
    if (next) this.zoom = next;
  }

  zoomOut(): void {
    const lower = [...this.zoomSteps].reverse().find(z => z < this.zoom);
    if (lower) this.zoom = lower;
  }

  fitToWindow(): void {
    const wrapper = this.editorAreaRef?.nativeElement;
    if (!wrapper || !this._imgW || !this._imgH) { this.zoom = 1; return; }
    const pad = 32;
    const zx = (wrapper.clientWidth - pad) / this._imgW;
    const zy = (wrapper.clientHeight - pad) / this._imgH;
    this.zoom = Math.max(0.1, Math.min(1, Math.min(zx, zy)));
  }

  get canvasStyle(): Record<string, string> {
    return {
      width: `${this._imgW * this.zoom}px`,
      height: `${this._imgH * this.zoom}px`,
    };
  }
  // #endregion

  // #region ── Actions: save / copy / open ───────────────────────────────
  private exportPng(): string {
    if (!this._baseImage) return Constants.EMPTY_STRING;
    const out = document.createElement('canvas');
    out.width = this._imgW;
    out.height = this._imgH;
    const ctx = out.getContext('2d');
    if (!ctx) return Constants.EMPTY_STRING;
    ctx.drawImage(this._baseImage, 0, 0);
    if (this._annotationCanvas) ctx.drawImage(this._annotationCanvas, 0, 0);
    return out.toDataURL('image/png');
  }

  async saveSnip(): Promise<void> {
    this.closeAllMenus();
    if (!this.hasImage) return;
    const dataUrl = this.exportPng();
    if (dataUrl === Constants.EMPTY_STRING) return;

    const timeStamp = this.getTimeStamp();
    const fileName = `Snip ${timeStamp}.png`;

    const fileInfo = new FileInfo();
    fileInfo.setFileName = fileName;
    fileInfo.setCurrentPath = `${this.SCREENSHOT_DIR}/${fileName}`;
    fileInfo.setStringBuffer = dataUrl;
    fileInfo.setIconPath = dataUrl;
    fileInfo.setFileType = '.png';
    fileInfo.setFileExtension = '.png';

    const ok = await this._fileService.writeFileAsync(this.SCREENSHOT_DIR, fileInfo);
    if (ok) {
      this._userNotificationService.showInfoNotification(`Saved to ${this.SCREENSHOT_DIR}`, `${this.name}-${this.processId}`);
      if (this._runningProcessService.isProcessRunning(Constants.FILE_EXPLORER)) {
        this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
        this._fileService.dirFilesUpdateNotify.next();
      }
    } else {
      this._userNotificationService.showErrorNotification('Could not save the snip.', `${this.name}-${this.processId}`);
    }
  }

  async copySnip(): Promise<void> {
    this.closeAllMenus();
    if (!this.hasImage) return;
    const dataUrl = this.exportPng();
    if (dataUrl === Constants.EMPTY_STRING) return;

    try {
      const blob = await (await fetch(dataUrl)).blob();
      // eslint-disable-next-line no-undef
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this._userNotificationService.showInfoNotification('Snip copied to clipboard.', `${this.name}-${this.processId}`);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      this._userNotificationService.showErrorNotification('Copy to clipboard is not available.', `${this.name}-${this.processId}`);
    }
  }

  triggerOpenFile(): void {
    this.closeAllMenus();
    this.fileInputRef.nativeElement.click();
  }

  async onFileChosen(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await this.loadIntoEditor(reader.result as string);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  openScreenshotsFolder(): void {
    this.closeAllMenus();
    const folder = new FileInfo();
    folder.setCurrentPath = this.SCREENSHOT_DIR;
    folder.setFileName = 'Screen-Shots';
    folder.setOpensWith = Constants.FILE_EXPLORER;
    folder.setFileType = Constants.FOLDER;
    this._processHandlerService.runApplication(folder);
  }

  toggleRuler(): void { this.showRuler = !this.showRuler; this.closeAllMenus(); }
  // #endregion

  // #region ── Keyboard shortcuts ────────────────────────────────────────
  @HostListener('window:keydown', ['$event'])
  onKeyDown(evt: KeyboardEvent): void {
    const inFocus = this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId;
    if (!inFocus) return;

    if (evt.key === 'Escape' && this.phase === 'selecting') { evt.preventDefault(); this.cancelSelection(); return; }
    if (!evt.ctrlKey) return;

    const key = evt.key.toLowerCase();
    if (key === 'n') { evt.preventDefault(); this.onNewSnip(); }
    else if (key === 's') { evt.preventDefault(); this.saveSnip(); }
    else if (key === 'c' && this.hasImage) { evt.preventDefault(); this.copySnip(); }
    else if (key === 'z' && this.hasImage) { evt.preventDefault(); this.undo(); }
    else if (key === 'y' && this.hasImage) { evt.preventDefault(); this.redo(); }
    else if (key === 'o') { evt.preventDefault(); this.triggerOpenFile(); }
  }
  // #endregion

  private getTimeStamp(): string {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const s = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${h}_${m}_${s}_${ampm}`;
  }

  private getComponentDetail(): Process {
    this._triggerFile = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type, this._triggerFile);
  }
}
