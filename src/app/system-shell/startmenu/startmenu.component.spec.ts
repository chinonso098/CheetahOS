import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { StartMenuComponent } from './startmenu.component';
import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';
import { DialogMessage } from 'src/app/shared/system-ui-components/dialog/dialog.types';

describe('StartMenuComponent', () => {
  let component: StartMenuComponent;
  let fixture: ComponentFixture<StartMenuComponent>;
  let menuService: MenuService;
  let systemNotificationService: SystemNotificationService;

  const fileServiceStub = { loadDirectoryFiles: () => Promise.resolve([]) };
  const processHandlerServiceStub = { runApplication: jest.fn() };
  const userNotificationServiceStub = { showPowerOnOffNotification: jest.fn() };

  beforeEach(async () => {
    processHandlerServiceStub.runApplication.mockClear();
    userNotificationServiceStub.showPowerOnOffNotification.mockClear();

    await TestBed.configureTestingModule({
      declarations: [StartMenuComponent],
      imports: [NoopAnimationsModule],
      providers: [
        { provide: FileService, useValue: fileServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: UserNotificationService, useValue: userNotificationServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);
    systemNotificationService = TestBed.inject(SystemNotificationService);

    fixture = TestBed.createComponent(StartMenuComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts closed and claims keyboard ownership only while open', () => {
    expect(component.isMenuOpen).toBe(false);

    menuService.showStartMenu.next();
    expect(component.isMenuOpen).toBe(true);
    expect(menuService.isStartMenuOpen).toBe(true);

    menuService.hideStartMenu.next();
    expect(component.isMenuOpen).toBe(false);
    expect(menuService.isStartMenuOpen).toBe(false);
  });

  it('closes itself when the lock screen takes over', () => {
    menuService.showStartMenu.next();

    systemNotificationService.showLockScreenNotify.next();

    expect(component.isMenuOpen).toBe(false);
  });

  it('closes the menu then launches the selected app', async () => {
    menuService.showStartMenu.next();
    const file = new FileInfo();
    file.setFileName = 'Documents';
    file.setOpensWith = Constants.FILE_EXPLORER;
    const evt = { stopPropagation: jest.fn() } as unknown as Event;

    await component.runProcess(file, evt);

    expect(component.isMenuOpen).toBe(false);
    expect(processHandlerServiceStub.runApplication).toHaveBeenCalledWith(file);
  });

  it('asks for shutdown confirmation from the power button', () => {
    const evt = { stopPropagation: jest.fn() } as unknown as Event;

    component.power(evt);

    expect(component.isMenuOpen).toBe(false);
    expect(userNotificationServiceStub.showPowerOnOffNotification)
      .toHaveBeenCalledWith(DialogMessage.SHUT_DOWN_CHEETAH);
  });
});
