import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { TaskBarPreviewComponent } from './taskbarpreview.component';
import { TaskBarPreviewImage } from './taskbar.preview';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Constants } from 'src/app/system-files/constants';

describe('TaskBarPreviewComponent', () => {
  let component: TaskBarPreviewComponent;
  let fixture: ComponentFixture<TaskBarPreviewComponent>;
  let windowService: WindowService;
  let systemNotificationService: SystemNotificationService;
  let defaultService: DefaultService;

  const APP_NAME = 'texteditor';
  const PREVIEW_PID = 55;

  const previewImage = (): TaskBarPreviewImage => ({
    pId: PREVIEW_PID,
    appName: APP_NAME,
    displayName: 'Untitled',
    icon: `${Constants.IMAGE_BASE_PATH}texteditor.png`,
    defaultIcon: `${Constants.IMAGE_BASE_PATH}texteditor.png`,
    imageData: Constants.EMPTY_STRING,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskBarPreviewComponent],
      imports: [NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    windowService = TestBed.inject(WindowService);
    systemNotificationService = TestBed.inject(SystemNotificationService);
    defaultService = TestBed.inject(DefaultService);

    fixture = TestBed.createComponent(TaskBarPreviewComponent);
    component = fixture.componentInstance;
    component.name = APP_NAME;
  });

  afterEach(() => {
    component.ngOnDestroy();
    systemNotificationService.removeAppIconNotication(PREVIEW_PID);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens faded in and pulls its tiles from the window service', () => {
    windowService.addProcessPreviewImage(APP_NAME, previewImage());

    component.ngOnInit();

    expect(component.fadeState).toBe('in');
    expect(component.componentImages.length).toBe(1);
    expect(component.componentImages[0].pId).toBe(PREVIEW_PID);
  });

  it('tints the preview surface only while the accent toggle is on', () => {
    const raiseEvent = true;
    const accent = defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);

    defaultService.updateDefaultData(
        Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.TRUE, raiseEvent);
    expect(component.surfaceColor).toBe(accent);
    expect(component.tileHoverBg).toContain(accent);

    defaultService.updateDefaultData(
        Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.FALSE, raiseEvent);
    expect(component.surfaceColor).toBe(Constants.DEFAULT_SYSTEM_COLOR);
    expect(component.tileHoverBg).not.toContain(accent);
  });

  it('keeps the flyout alive on hover and restores the desktop on leave', () => {
    let kept = 0;
    let hidden = 0;
    let restored = 0;
    windowService.keepProcessPreviewWindowNotify.subscribe(() => kept++);
    windowService.hideProcessPreviewWindowNotify.subscribe(() => hidden++);
    windowService.restoreProcessesWindowNotify.subscribe(() => restored++);

    component.keepTaskBarPreviewWindow();
    expect(kept).toBe(1);

    component.hideTaskBarPreviewWindowAndRestoreDesktop();
    expect(hidden).toBe(1);
    expect(restored).toBe(1);
  });

  it('refreshes tile labels and icons from the latest app notification', () => {
    windowService.addProcessPreviewImage(APP_NAME, previewImage());
    component.ngOnInit();
    const renamedIcon = `${Constants.IMAGE_BASE_PATH}terminal.png`;
    systemNotificationService.setAppIconNotication(PREVIEW_PID, ['notes.txt', renamedIcon]);

    component.checkForUpdatedTaskBarPrevInfo();

    expect(component.componentImages[0].displayName).toBe('notes.txt');
    expect(component.componentImages[0].icon).toBe(renamedIcon);
  });
});
