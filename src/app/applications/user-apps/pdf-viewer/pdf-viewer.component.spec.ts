import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { PdfViewerComponent } from './pdf-viewer.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('PdfViewerComponent', () => {
  let component: PdfViewerComponent;
  let fixture: ComponentFixture<PdfViewerComponent>;

  let triggerFile: FileInfo;

  // FileService boots BrowserFS, so only the two reads the viewer performs are
  // modelled here.
  const fileServiceStub = {
    resolveContentPath: () => '/Documents/manual.pdf',
    getFileAsBlobAsync: () => Promise.resolve('blob:manual'),
  };

  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    unloadScript: () => undefined,
  };

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'manual.pdf';
    triggerFile.setFileType = '.pdf';

    await TestBed.configureTestingModule({
      declarations: [PdfViewerComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: { getLastProcessTrigger: () => triggerFile } },
        { provide: FileService, useValue: fileServiceStub },
        { provide: ScriptService, useValue: scriptServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdfViewerComponent);
    component = fixture.componentInstance;
    // ngAfterViewInit downloads pdf.mjs and renders to a canvas, so the view is
    // deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('pdfviewer');
    expect(component.type).toBe(ComponentType.User);
    expect(component.pageNum).toBe(0);
  });

  it('titles the window after the pdf file that launched it', () => {
    component.ngOnInit();

    expect(component.displayName).toBe('manual.pdf');
  });

  it('has no still to hand the taskbar preview when the canvas is missing', async () => {
    await expect(component.capturePDFStill(null as any)).resolves.toBe(Constants.EMPTY_STRING);
  });

  it('keeps paging within the bounds of the loaded document', async () => {
    // destroy() is what ngOnDestroy calls when the fixture is torn down.
    (component as any).pdfDoc = { numPages: 2, destroy: jest.fn() };
    jest.spyOn(component, 'queueRenderPage').mockResolvedValue(undefined);
    jest.spyOn(component, 'captureComponentImg').mockResolvedValue(undefined);
    component.pageNum = 1;

    await component.onPrevPage();
    expect(component.pageNum).toBe(1); // already on the first page

    await component.onNextPage();
    expect(component.pageNum).toBe(2);

    await component.onNextPage();
    expect(component.pageNum).toBe(2); // already on the last page

    await component.onPrevPage();
    expect(component.pageNum).toBe(1);
  });

  it('scales the viewport by the accumulated zoom and resets it on demand', () => {
    const page = { getViewport: jest.fn(() => ({ width: 10, height: 10 })) };

    component.getViewPort(page);
    expect(page.getViewport).toHaveBeenLastCalledWith({ scale: component.DEFAULT_SCALE });

    (component as any).zoomBy = component.ZOOM_FACTOR;
    component.getViewPort(page);
    expect(page.getViewport).toHaveBeenLastCalledWith(
      { scale: component.DEFAULT_SCALE + component.ZOOM_FACTOR });

    component.resetZoom();
    component.getViewPort(page);
    expect(page.getViewport).toHaveBeenLastCalledWith({ scale: component.DEFAULT_SCALE });
  });
});
