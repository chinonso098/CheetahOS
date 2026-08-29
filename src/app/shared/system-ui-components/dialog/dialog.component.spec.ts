import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { DialogComponent } from './dialog.component';
import { FileService } from '../../system-service/file.service';
import { WindowService } from '../../system-service/window.service';
import { DefaultService } from '../../system-service/defaults.services';
import { ProcessIDService } from '../../system-service/process.id.service';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { RunningProcessService } from '../../system-service/running.process.service';
import { UserNotificationService } from '../../system-service/user.notification.service';
import { SystemNotificationService } from '../../system-service/system.notification.service';
import { AudioService } from '../../system-service/audio.services';
import { ThemeService } from '../../system-theme/theme';
import { UserNotificationType } from 'src/app/system-files/commons/common.enums';
import { Constants } from 'src/app/system-files/constants';

describe('DialogComponent', () => {
  let component: DialogComponent;
  let fixture: ComponentFixture<DialogComponent>;

  const DIALOG_PID = 42;

  // The dialog is a multiplexer over UserNotificationType, so the stubs only need
  // the notification subjects it subscribes to plus the handful of commands it
  // issues when the user picks an option.
  const processIdServiceStub = {
    getNewProcessId: () => DIALOG_PID,
  };
  const userNotificationServiceStub = {
    closeDialogMsgBox: (_pid: number) => undefined,
  };
  const systemNotificationServiceStub = {
    updateInformationNotify: new Subject<unknown>(),
    autoCloseDialogNotify: new Subject<number>(),
    setPwrDialogPid: (_pid: number) => undefined,
    setAppSelectionDialogPid: (_pid: number) => undefined,
  };
  const windowServiceStub = {
    removeWindowState: (_pid: number) => undefined,
  };
  const fileServiceStub = {
    cancelFileTransferNotify: new Subject<number>(),
    getAppAssociaton: (appName: string) => `${appName}.png`,
  };
  const defaultServiceStub = {
    defaultSettingsChangeNotify: new Subject<string>(),
    getDefaultSetting: () => Constants.DEFAULT_ACCENT_COLOR_VALUE,
    updateDefaultData: () => undefined,
  };
  const themeServiceStub = {
    themeChange: new Subject<unknown>(),
    isLightTheme: () => true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DialogComponent],
      // [(ngModel)] backs the power/zip/app-selection controls; NO_ERRORS_SCHEMA
      // stands in for the <cos-primarywindow>/<cos-secondarywindow> hosts.
      imports: [FormsModule],
      providers: [
        { provide: ProcessIDService, useValue: processIdServiceStub },
        { provide: UserNotificationService, useValue: userNotificationServiceStub },
        { provide: SystemNotificationService, useValue: systemNotificationServiceStub },
        { provide: RunningProcessService, useValue: {} },
        { provide: ProcessHandlerService, useValue: { setDefaultAppOverRide: () => undefined } },
        { provide: WindowService, useValue: windowServiceStub },
        { provide: AudioService, useValue: { play: () => Promise.resolve() } },
        { provide: FileService, useValue: fileServiceStub },
        { provide: DefaultService, useValue: defaultServiceStub },
        { provide: ThemeService, useValue: themeServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('describes the selected power option and hides the confirm question for non-shutdown choices', () => {
    const event = { target: { value: component.LOCK_SCREEN } } as unknown as Event;

    component.onPwrOptionSelect(event);

    expect(component.selectedOption).toBe(component.LOCK_SCREEN);
    expect(component.pwrOnOffOptionsTxt)
        .toBe(component.pwrOnOffOptions.find((x) => x.value === component.LOCK_SCREEN)?.label);
    expect(component.isQuestionHidden).toBe(true);
  });

  it('emits cancel and releases the window state when a delete warning is dismissed', () => {
    const cancelSpy = jest.fn();
    const removeWindowStateSpy = jest.spyOn(windowServiceStub, 'removeWindowState');
    const closeSpy = jest.spyOn(userNotificationServiceStub, 'closeDialogMsgBox');
    component.cancel.subscribe(cancelSpy);
    component.notificationOption = UserNotificationType.DeleteWarning;

    component.onCloseDialogBox();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(removeWindowStateSpy).toHaveBeenCalledWith(DIALOG_PID);
    expect(closeSpy).toHaveBeenCalledWith(DIALOG_PID);

    removeWindowStateSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it('emits the chosen app from the create-shortcut picker and resets on back', () => {
    const okSpy = jest.fn();
    component.ok.subscribe(okSpy);
    component.notificationType = UserNotificationType.CreateShortcut;
    component.ngOnChanges({} as SimpleChanges);

    expect(component.shortcutAppList.length).toBeGreaterThan(0);

    const stopPropagation = jest.fn();
    component.onSelectShortcutApp(
        component.shortcutAppList[0], { stopPropagation } as unknown as MouseEvent);
    expect(component.shortcutSelectedApp).toBe(component.shortcutAppList[0].name);
    expect(component.isShortcutDropdownOpen).toBe(false);

    component.onNext();
    expect(okSpy).toHaveBeenCalledWith(component.shortcutAppList[0].name);

    component.onShortcutBack();
    expect(component.shortcutSelectedApp).toBe(Constants.EMPTY_STRING);
  });

  it('closes itself only when the auto-close notification targets its own process id', () => {
    const closeSpy = jest.spyOn(userNotificationServiceStub, 'closeDialogMsgBox');

    systemNotificationServiceStub.autoCloseDialogNotify.next(DIALOG_PID + 1);
    expect(closeSpy).not.toHaveBeenCalled();

    systemNotificationServiceStub.autoCloseDialogNotify.next(DIALOG_PID);
    expect(closeSpy).toHaveBeenCalledWith(DIALOG_PID);

    closeSpy.mockRestore();
  });
});
