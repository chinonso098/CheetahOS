import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
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
  const runningProcessServiceStub = {
    addProcess: () => undefined,
  };
  const windowServiceStub = {
    focusOnCurrentProcessWindowNotify: new Subject<number>(),
    getProcessWindowIDWithHighestZIndex: () => 0,
    addProcessPreviewImage: () => undefined,
  };
  const defaultServiceStub = {
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
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
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
});
