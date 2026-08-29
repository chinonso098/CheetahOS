import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { CodeEditorComponent } from './codeeditor.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { ComponentType } from 'src/app/system-files/system.types';

describe('CodeEditorComponent', () => {
  let component: CodeEditorComponent;
  let fixture: ComponentFixture<CodeEditorComponent>;
  let sessionManagementService: SessionManagementService;

  let triggerFile: FileInfo;
  let updateFileAsync: jest.Mock;

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'main.ts';
    triggerFile.setFileType = '.ts';
    triggerFile.setCurrentPath = '/Documents/main.ts';

    updateFileAsync = jest.fn().mockResolvedValue(true);

    // FileService boots BrowserFS, so only the calls the editor makes are modelled.
    await TestBed.configureTestingModule({
      declarations: [CodeEditorComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: { getLastProcessTrigger: () => triggerFile } },
        {
          provide: FileService,
          useValue: {
            resolveContentPath: () => '/Documents/main.ts',
            getFileAsTextAsync: () => Promise.resolve('const a = 1;'),
            updateFileAsync,
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CodeEditorComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    // ngAfterViewInit boots Monaco, so the view is deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('codeeditor');
    expect(component.type).toBe(ComponentType.User);
    expect(component.isDirty).toBe(false);
  });

  it('titles the window after the file that launched it', () => {
    component.ngOnInit();

    expect(component.displayName).toBe('main.ts');
  });

  it('maps file extensions to Monaco language ids', () => {
    expect(component.getFileTypeMap('.ts')).toBe('typescript');
    expect(component.getFileTypeMap('.js')).toBe('javascript');
    expect(component.getFileTypeMap('.cpp')).toBe('cpp');
    expect(component.getFileTypeMap('.md')).toBe('text/plain');
  });

  it('writes the model contents back to disk and clears the dirty flag', async () => {
    (component as any)._model = { getValue: () => 'const a = 2;', dispose: jest.fn() };
    component.isDirty = true;

    await component.saveFile();

    expect(updateFileAsync).toHaveBeenCalledWith(triggerFile);
    expect(triggerFile.getStringBuffer).toBe('const a = 2;');
    expect(component.isDirty).toBe(false);
  });

  it('restores previously edited code from a past session', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('let restored = true;');
    component.priorUId = uId;

    component.retrievePastSessionData();

    expect(component.code).toBe('let restored = true;');
    expect(sessionManagementService.getAppSession(uId)?.appName).toBe('codeeditor');
  });
});
