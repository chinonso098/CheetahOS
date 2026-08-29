import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { ClipboardComponent } from './clipboard.component';
import { ClipboardService, ClipboardEntry } from 'src/app/application-services/clipboard.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';
import { Constants } from 'src/app/system-files/constants';

describe('ClipboardComponent', () => {
  let component: ClipboardComponent;
  let fixture: ComponentFixture<ClipboardComponent>;
  let menuService: MenuService;
  let runningProcessService: RunningProcessService;

  const entry = (id: string, action: string): ClipboardEntry => ({
    id,
    action,
    path: `/Users/Documents/${id}.txt`,
    displayName: `${id}.txt`,
    iconPath: `${Constants.IMAGE_BASE_PATH}generic_program.png`,
    isFile: true,
    pinned: false,
    timestamp: 0,
  });

  let isEnabled = true;
  let storedEntries: ClipboardEntry[] = [];
  const clipboardServiceStub = {
    clipboardChangeNotify: new Subject<void>(),
    isClipboardEnabled: () => isEnabled,
    getEntries: () => storedEntries,
    togglePin: jest.fn(),
    removeEntry: jest.fn(),
    clearAll: jest.fn(),
  };
  const userNotificationServiceStub = { showInfoNotification: jest.fn() };

  beforeEach(async () => {
    isEnabled = true;
    storedEntries = [entry('notes', MenuAction.COPY)];
    clipboardServiceStub.togglePin.mockClear();
    clipboardServiceStub.removeEntry.mockClear();
    userNotificationServiceStub.showInfoNotification.mockClear();

    await TestBed.configureTestingModule({
      declarations: [ClipboardComponent],
      providers: [
        { provide: ClipboardService, useValue: clipboardServiceStub },
        { provide: UserNotificationService, useValue: userNotificationServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);
    runningProcessService = TestBed.inject(RunningProcessService);

    fixture = TestBed.createComponent(ClipboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the history and follows later clipboard changes', () => {
    component.ngOnInit();
    expect(component.hasEntries).toBe(true);

    storedEntries = [entry('notes', MenuAction.COPY), entry('report', MenuAction.CUT)];
    clipboardServiceStub.clipboardChangeNotify.next();

    expect(component.entries.length).toBe(2);
    expect(component.isCutAction(component.entries[1])).toBe(true);
  });

  it('prompts the user instead of listing anything when history is off', () => {
    isEnabled = false;

    component.ngOnInit();

    expect(component.hasEntries).toBe(false);
    expect(userNotificationServiceStub.showInfoNotification)
      .toHaveBeenCalledWith(expect.stringContaining('Clipboard history is turned off'),
        `${component.name}-${component.processId}`);
  });

  it('stages the clicked entry for paste and closes the flyout', () => {
    component.ngOnInit();
    let closedPid = -1;
    runningProcessService.closeProcessNotify.subscribe((p) => (closedPid = p.getProcessId));

    component.onPasteEntry(component.entries[0]);

    expect(menuService.getStoreData()).toEqual([component.entries[0].path, MenuAction.COPY]);
    expect(closedPid).toBe(component.processId);
  });

  it('keeps row actions from also triggering the paste-on-click row handler', () => {
    component.ngOnInit();
    const pinEvt = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    const removeEvt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.onTogglePin(pinEvt, component.entries[0]);
    component.onRemoveEntry(removeEvt, component.entries[0]);

    expect(pinEvt.stopPropagation).toHaveBeenCalled();
    expect(removeEvt.stopPropagation).toHaveBeenCalled();
    expect(clipboardServiceStub.togglePin).toHaveBeenCalledWith('notes');
    expect(clipboardServiceStub.removeEntry).toHaveBeenCalledWith('notes');
  });
});
