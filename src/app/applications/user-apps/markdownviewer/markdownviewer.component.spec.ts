import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { MarkDownViewerComponent } from './markdownviewer.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('MarkDownViewerComponent', () => {
  let component: MarkDownViewerComponent;
  let fixture: ComponentFixture<MarkDownViewerComponent>;
  let sessionManagementService: SessionManagementService;

  let triggerFile: FileInfo;

  // FileService boots BrowserFS, so only the two reads the viewer performs are
  // modelled here.
  const fileServiceStub = {
    resolveContentPath: () => '/Documents/notes.md',
    getFileAsTextAsync: () => Promise.resolve('# hello'),
  };

  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    unloadScript: () => undefined,
  };

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'notes.md';
    triggerFile.setFileType = '.md';

    await TestBed.configureTestingModule({
      declarations: [MarkDownViewerComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: { getLastProcessTrigger: () => triggerFile } },
        { provide: FileService, useValue: fileServiceStub },
        { provide: ScriptService, useValue: scriptServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarkDownViewerComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    // ngAfterViewInit pulls in marked.js and starts a screenshot interval, so
    // the view is deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('markdownviewer');
    expect(component.type).toBe(ComponentType.System);
    expect(component.hasWindow).toBe(true);
  });

  it('titles the window after the markdown file that launched it', () => {
    expect(component.displayName).toBe('markdownviewer');

    component.ngOnInit();

    expect(component.displayName).toBe('notes.md');
  });

  it('persists the resolved file path under a process-unique session key', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('/Documents/notes.md');

    expect(sessionManagementService.getAppSession(uId)?.appData).toBe('/Documents/notes.md');
    expect(sessionManagementService.getAppSession(uId)?.appName).toBe('markdownviewer');
  });

  it('restores the previously viewed file path from a past session', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('/Documents/restored.md');
    component.priorUId = uId;

    component.retrievePastSessionData();

    expect((component as any).fileSrc).toBe('/Documents/restored.md');
  });

  it('swallows right-clicks so the desktop context menu stays closed', () => {
    const evt = new MouseEvent('contextmenu');
    const preventDefault = jest.spyOn(evt, 'preventDefault');
    const stopPropagation = jest.spyOn(evt, 'stopPropagation');

    component.silenceCtxEvt(evt);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(component.mkdDwnHtml).toBe(Constants.EMPTY_STRING);
  });
});
