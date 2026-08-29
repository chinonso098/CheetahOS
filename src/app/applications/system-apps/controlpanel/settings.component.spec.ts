import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Constants } from 'src/app/system-files/constants';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  // Light-weight stubs. The component only needs a process id, the ability to
  // register itself, a window service (used by the preview-image capture and
  // focus logic) and a default-settings store. Returning empty strings keeps
  // every "getXData" loader on its safe default path.
  const processIdServiceStub = {
    getNewProcessId: () => 1,
  };
  // ProcessHandlerService and FileService bootstrap the virtual file system, so
  // they are replaced with the two members SettingsComponent actually touches.
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => undefined,
  };
  const fileServiceStub = {
    getFolderSizeAsync: () => Promise.resolve(0),
  };
  const windowServiceStub = {
    focusOnCurrentProcessWindowNotify: new Subject<number>(),
    getProcessWindowIDWithHighestZIndex: () => 0,
    addProcessPreviewImage: () => undefined,
  };
  const defaultServiceStub = {
    defaultSettingsChangeNotify: new Subject<string>(),
    getDefaultSetting: () => Constants.EMPTY_STRING,
    updateDefaultData: () => undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsComponent],
      // ReactiveFormsModule / FormsModule back the search form and the toggle
      // checkboxes; NO_ERRORS_SCHEMA lets the isolated template reference the
      // app-level <cos-primarywindow> host and custom directives without pulling
      // in the whole AppModule.
      imports: [ReactiveFormsModule, FormsModule],
      providers: [
        { provide: ProcessIDService, useValue: processIdServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: FileService, useValue: fileServiceStub },
        { provide: WindowService, useValue: windowServiceStub },
        { provide: DefaultService, useValue: defaultServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('persists the clipboard-history preference when toggled', () => {
    const updateSpy = jest.spyOn(defaultServiceStub, 'updateDefaultData');

    component.isSaveClipboardHistory = false;
    component.changeSaveClipboardHistoryState();

    expect(component.clipboardSaveStateText).toBe(Constants.OFF);
    expect(updateSpy).toHaveBeenCalledWith(Constants.DEFAULT_CLIP_BOARD_STATE, Constants.FALSE);
  });

  it('persists the viewport-bounds preference when toggled on', () => {
    const updateSpy = jest.spyOn(defaultServiceStub, 'updateDefaultData');

    component.isEnforceViewPortBound = true;
    component.changeEnforceViewPortBoundState();

    expect(component.enforceViewPortBoundText).toBe(Constants.ON);
    expect(updateSpy).toHaveBeenCalledWith(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS, Constants.TRUE);
  });

  it('opens the requested pane and remembers which sidebar row is active', async () => {
    const clipboardIdx = 3;
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    await component.handleMenuSelection('Clipboard', clipboardIdx, evt, 'System');

    expect(component.selectedSystemOption).toBe('Clipboard');
    expect(component.selectedIdx).toBe(clipboardIdx);
    expect(evt.stopPropagation).toHaveBeenCalled();
  });

  it('builds the settings landing page and its sub-panes', () => {
    const homeTitles = component.generateControlPanelOptions().map(o => o.title);
    const systemTitles = component.generateSystemOptions().map(o => o.title);

    expect(homeTitles.length).toBe(3);
    expect(systemTitles).toContain('Clipboard');
    expect(component.generateApplicationOptions().length).toBe(1);
    expect(component.generatePersonalizationOptions().length).toBe(4);
  });
});
