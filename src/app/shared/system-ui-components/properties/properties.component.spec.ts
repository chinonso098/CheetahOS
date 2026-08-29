import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';

import { PropertiesComponent } from './properties.component';
import { ProcessIDService } from '../../system-service/process.id.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { WindowService } from '../../system-service/window.service';
import { FileService } from '../../system-service/file.service';
import { DefaultService } from '../../system-service/defaults.services';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { QuickAccessService } from '../../system-service/quick.access.service';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

describe('PropertiesComponent', () => {
  let component: PropertiesComponent;
  let fixture: ComponentFixture<PropertiesComponent>;

  const PROPERTIES_PID = 7;
  const settings = new Map<string, string>();

  const processIdServiceStub = {
    getNewProcessId: () => PROPERTIES_PID,
  };
  const runningProcessServiceStub = {
    addProcess: (_process: Process) => undefined,
  };
  const windowServiceStub = {
    closeWindowProcessNotify: new Subject<number>(),
    focusOnCurrentProcessWindowNotify: new Subject<number>(),
  };
  const defaultServiceStub = {
    getDefaultSetting: (key: string) => settings.get(key) ?? Constants.EMPTY_STRING,
    updateDefaultData: () => undefined,
  };
  const themeServiceStub = {
    themeChange: new Subject<unknown>(),
    isLightTheme: () => true,
  };

  // Exercised in "Folder Options" mode: no `fileInput` binding is required, which keeps
  // the test off the async BrowserFS-backed size/content lookups.
  const folderOptionsChange = {
    isFolderOptions: new SimpleChange(false, true, true),
  } as unknown as SimpleChanges;

  beforeEach(async () => {
    settings.clear();

    await TestBed.configureTestingModule({
      declarations: [PropertiesComponent],
      providers: [
        { provide: ProcessIDService, useValue: processIdServiceStub },
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
        { provide: WindowService, useValue: windowServiceStub },
        { provide: FileService, useValue: { getAppAssociaton: () => Constants.EMPTY_STRING } },
        { provide: DefaultService, useValue: defaultServiceStub },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: QuickAccessService, useValue: { clear: () => undefined } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesComponent);
    component = fixture.componentInstance;
    component.isFolderOptions = true;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers a process once when the folder-options view is first bound', async () => {
    const addProcessSpy = jest.spyOn(runningProcessServiceStub, 'addProcess');

    await component.ngOnChanges(folderOptionsChange);
    await component.ngOnChanges({
      isFolderOptions: new SimpleChange(true, true, false),
    } as unknown as SimpleChanges);

    expect(component.displayMsg).toBe(Constants.FOLDER_OPTIONS_TITLE);
    expect(addProcessSpy).toHaveBeenCalledTimes(1);
    addProcessSpy.mockRestore();
  });

  it('seeds the folder-options controls from the persisted defaults', async () => {
    settings.set(Constants.DEFAULT_OPEN_FILE_EXPLORER_TO, Constants.OPEN_FILE_EXPLORER_TO_THIS_PC);
    settings.set(Constants.DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW, Constants.FALSE);
    settings.set(Constants.DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS, Constants.TRUE);
    settings.set(Constants.DEFAULT_SHOW_RECENTLY_USED_FILES, Constants.FALSE);

    await component.ngOnChanges(folderOptionsChange);

    expect(component.openFileExplorerTo).toBe(Constants.OPEN_FILE_EXPLORER_TO_THIS_PC);
    expect(component.openFolderInSameWindow).toBe(false);
    expect(component.showHiddenFilesAndFolders).toBe(true);
    expect(component.showRecentlyUsedFiles).toBe(false);
    // Not persisted -> keeps its "on unless explicitly false" default.
    expect(component.showFrequentlyUsedFolders).toBe(true);
  });

  it('persists a folder-option toggle and raises the live-update event', () => {
    const updateSpy = jest.spyOn(defaultServiceStub, 'updateDefaultData');
    const raiseEvent = true;

    component.showFileExtensions = false;
    component.onToggleShowFileExtensions();

    expect(component.showFileExtensions).toBe(true);
    expect(updateSpy)
        .toHaveBeenCalledWith(Constants.DEFAULT_SHOW_FILE_EXTENSIONS, Constants.TRUE, raiseEvent);
    updateSpy.mockRestore();
  });

  it('routes close and focus through the window service using its own process id', () => {
    const closed: number[] = [];
    const focused: number[] = [];
    windowServiceStub.closeWindowProcessNotify.subscribe((pid) => closed.push(pid));
    windowServiceStub.focusOnCurrentProcessWindowNotify.subscribe((pid) => focused.push(pid));

    component.onClosePropertyView();
    component.setPropertyWindowToFocus(component.processId);

    expect(closed).toEqual([PROPERTIES_PID]);
    expect(focused).toEqual([PROPERTIES_PID]);
  });
});
