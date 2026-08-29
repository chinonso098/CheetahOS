import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { TaskbarComponent } from './taskbar.component';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Constants } from 'src/app/system-files/constants';

describe('TaskbarComponent', () => {
  let component: TaskbarComponent;
  let fixture: ComponentFixture<TaskbarComponent>;
  let menuService: MenuService;
  let systemNotificationService: SystemNotificationService;
  let defaultService: DefaultService;

  beforeEach(async () => {
    // Every service the taskbar touches is dependency-light, so the real ones
    // are used and the assertions run against genuine notification plumbing.
    await TestBed.configureTestingModule({
      declarations: [TaskbarComponent],
      imports: [NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);
    systemNotificationService = TestBed.inject(SystemNotificationService);
    defaultService = TestBed.inject(DefaultService);

    fixture = TestBed.createComponent(TaskbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('drives taskbar opacity from the lock-screen / desktop notifications', () => {
    systemNotificationService.showLockScreenNotify.next();
    expect(component.taskBarOpacity).toBe(0);

    systemNotificationService.showDesktopNotify.next();
    expect(component.taskBarOpacity).toBe(1);
  });

  it('slides out of view and back on the hide / show taskbar notifications', () => {
    systemNotificationService.hideTaskBarNotify.next();
    expect(component.slideState).toBe('slideDown');

    systemNotificationService.showTaskBarNotify.next();
    expect(component.slideState).toBe('slideUp');
  });

  it('keeps the start menu and the search box mutually exclusive', async () => {
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    let searchBoxHidden = false;
    menuService.hideSearchBox.subscribe(() => (searchBoxHidden = true));

    component.isSearchWindowVisible = true;
    await component.showStartMenu(evt);

    expect(component.isStartMenuVisible).toBe(true);
    expect(searchBoxHidden).toBe(true);
  });

  it('paints the surface with the accent color only while the accent toggle is on', () => {
    const raiseEvent = true;
    const accent = defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);

    defaultService.updateDefaultData(
        Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.TRUE, raiseEvent);
    expect(component.surfaceColor).toBe(accent);

    defaultService.updateDefaultData(
        Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.FALSE, raiseEvent);
    expect(component.surfaceColor).toBe(Constants.DEFAULT_SYSTEM_COLOR);
  });
});
