import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { PhotoViewerComponent } from './photoviewer.component';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';

describe('PhotoViewerComponent', () => {
  let component: PhotoViewerComponent;
  let fixture: ComponentFixture<PhotoViewerComponent>;
  let cursorTarget: HTMLElement;

  // FileService bootstraps BrowserFS; only the directory scan used by the
  // gallery is needed and it returns nothing here.
  const fileServiceStub = {
    loadDirectoryFiles: () => Promise.resolve([]),
    resolveContentUrl: () => '',
    getFileAsBlobAsync: () => Promise.resolve(null),
  };
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => new FileInfo(),
    runApplication: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PhotoViewerComponent],
      // The info pane uses an Angular animation trigger.
      imports: [NoopAnimationsModule],
      providers: [
        { provide: FileService, useValue: fileServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PhotoViewerComponent);
    component = fixture.componentInstance;

    // updateCursor() reaches for the rendered <img> by class selector, so a
    // stand-in is placed in the document instead of booting the whole view.
    cursorTarget = document.createElement('div');
    cursorTarget.className = 'photo-viewer';
    cursorTarget.innerHTML = '<img />';
    document.body.appendChild(cursorTarget);
  });

  afterEach(() => {
    cursorTarget.remove();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('photoviewer');
    expect(component.defaultView).toBe(component.GALLERY_VIEW);
  });

  it('clamps zooming at both ends and keeps the percentage label in sync', () => {
    const start = component.zoomLevel;

    component.zoomIn();
    expect(component.zoomLevel).toBeCloseTo(start + component.zoomStep);
    expect(component.currentZoomValue).toBe(`${(component.zoomLevel * 100).toFixed(0)}%`);

    for (let i = 0; i < 60; i++) component.zoomIn();
    expect(component.zoomLevel).toBe(component.maxZoom);

    for (let i = 0; i < 100; i++) component.zoomOut();
    expect(component.zoomLevel).toBe(component.minZoom);
  });

  it('resets zoom, pan and transform origin when the view is reset', () => {
    component.zoomIn();
    component.translateX = 40;
    component.translateY = -25;
    component.transformOrigin = '10% 90%';

    component.fitToScreen();

    expect(component.zoomLevel).toBe(1);
    expect(component.currentZoomValue).toBe('100%');
    expect(component.translateX).toBe(0);
    expect(component.translateY).toBe(0);
    expect(component.transformOrigin).toBe('center center');
    expect(component.transformStyle).toBe('scale(1) translate(0px, 0px)');
  });

  it('only pans while zoomed in and while the mouse button is held', () => {
    const evt = { stopPropagation: jest.fn(), clientX: 100, clientY: 100, currentTarget: cursorTarget } as unknown as MouseEvent;

    // At the default zoom (<= 100%) panning is disabled.
    component.startPan(evt);
    expect(component.isPanning).toBe(false);

    // Zoom past 100% before panning becomes available.
    while (component.zoomLevel <= 1) component.zoomIn();
    component.startPan(evt);
    expect(component.isPanning).toBe(true);

    const moveEvt = { stopPropagation: jest.fn(), clientX: 130, clientY: 80 } as unknown as MouseEvent;
    component.pan(moveEvt);
    expect(component.translateX).toBe(30);
    expect(component.translateY).toBe(-20);

    component.endPan();
    expect(component.isPanning).toBe(false);
  });

  it('labels image sources by the folder they came from', () => {
    expect(component.getSrcName('/Users/Pictures/Sample/cat.png')).toBe('Sample');
    expect(component.getSrcName('/Users/Pictures/Screen-Shots/snip.png')).toBe('ScreenShot');
    expect(component.getSrcName('/Users/Downloads/photo.png')).toBe('Other');

    expect(component.checkForBlobURI('blob:http://localhost/abc')).toBe(true);
    expect(component.checkForBlobURI('/Users/Pictures/cat.png')).toBe(false);
  });
});
