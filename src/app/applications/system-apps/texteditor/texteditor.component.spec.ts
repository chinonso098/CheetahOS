import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TextEditorComponent } from './texteditor.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';

describe('TextEditorComponent', () => {
  let component: TextEditorComponent;
  let fixture: ComponentFixture<TextEditorComponent>;
  let sessionManagementService: SessionManagementService;

  // Quill is loaded at runtime from osdrive; a tiny fake exposes only the
  // handful of methods the component calls so the editor logic can be tested
  // without the real script.
  const makeFakeQuill = (text: string, range: { index: number, length: number } | null) => ({
    getText: (start = 0, len = text.length) => text.substring(start, start + len),
    getLength: () => text.length,
    getSelection: () => range,
    on: () => undefined,
    off: () => undefined,
  });

  // FileService bootstraps BrowserFS and ScriptService injects <script>/<link>
  // tags into the document, so both are replaced with inert stubs.
  const fileServiceStub = {
    resolveContentPath: () => '',
    getFileAsTextAsync: () => Promise.resolve(''),
    writeFileAsync: jest.fn().mockResolvedValue(true),
    updateFileAsync: jest.fn().mockResolvedValue(true),
  };
  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    loadStyle: () => Promise.resolve(),
    unloadScript: () => undefined,
    unloadStyle: () => undefined,
  };
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => new FileInfo(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextEditorComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: FileService, useValue: fileServiceStub },
        { provide: ScriptService, useValue: scriptServiceStub },
      ],
      // The template hosts <cos-primarywindow> and other app-level components.
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextEditorComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    // No detectChanges(): ngAfterViewInit downloads and boots Quill.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('texteditor');
    expect(component.hasWindow).toBe(true);
  });

  it('starts idle: not ready, not dirty and at line 1, column 1', () => {
    expect(component.isReady).toBe(false);
    expect(component.isDirty).toBe(false);
    expect(component.isSaving).toBe(false);
    expect(component.cursorLine).toBe(1);
    expect(component.cursorCol).toBe(1);
  });

  it('round-trips the open file path through the session store', () => {
    const filePath = '/Users/Documents/notes.txt';
    component.storeAppState(filePath);

    const uId = `${component.name}-${component.processId}`;
    expect(sessionManagementService.getAppSession(uId)?.appData).toBe(filePath);

    // A relaunch restores the path from the prior unique id.
    component.priorUId = uId;
    component.retrievePastSessionData();
    expect((component as any).fileSrc).toBe(filePath);
  });

  it('derives the status-bar line, column and selection count from the caret', () => {
    (component as any).quill = makeFakeQuill('alpha\nbravo\ncharlie', { index: 9, length: 3 });

    (component as any).updateCursorAndSelection();

    // Index 9 lands on the 4th character of the second line ("bra|vo").
    expect(component.cursorLine).toBe(2);
    expect(component.cursorCol).toBe(4);
    expect(component.selectedCount).toBe(3);
  });

  it('only saves on Ctrl+S once the editor is ready', () => {
    const saveSpy = jest.spyOn(component, 'saveFile').mockResolvedValue(undefined);
    const evt = { key: 's', ctrlKey: true, metaKey: false, preventDefault: jest.fn() } as unknown as KeyboardEvent;

    component.isReady = false;
    component.onKeyDown(evt);
    expect(saveSpy).not.toHaveBeenCalled();

    component.isReady = true;
    component.onKeyDown(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
