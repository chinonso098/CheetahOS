import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { JSdosComponent } from './jsdos.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('JSdosComponent', () => {
  let component: JSdosComponent;
  let fixture: ComponentFixture<JSdosComponent>;
  let sessionManagementService: SessionManagementService;
  let windowService: WindowService;

  let triggerFile: FileInfo;

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'doom.jsdos';
    triggerFile.setFileType = '.jsdos';
    triggerFile.setCurrentPath = '/Games/doom.jsdos';

    await TestBed.configureTestingModule({
      declarations: [JSdosComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: { getLastProcessTrigger: () => triggerFile } },
        // FileService boots BrowserFS; only the two calls jsdos makes are modelled.
        {
          provide: FileService,
          useValue: {
            resolveContentPath: () => '/Games/doom.jsdos',
            getFileAsBlobAsync: () => Promise.resolve('blob:doom'),
          },
        },
        {
          provide: ScriptService,
          useValue: { loadScript: () => Promise.resolve(), unloadScript: () => undefined },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(JSdosComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    windowService = TestBed.inject(WindowService);
    // ngAfterViewInit downloads and boots the DOS emulator, so the view is
    // deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('jsdos');
    expect(component.type).toBe(ComponentType.User);
    expect(component.isMaximizable).toBe(false);
  });

  it('titles the window after the game that launched it', () => {
    component.ngOnInit();

    expect(component.displayName).toBe('doom.jsdos');
  });

  it('asks the window manager for a fixed emulator-sized window on startup', () => {
    const resizes: any[] = [];
    windowService.resizeProcessWindowNotify.subscribe(info => resizes.push(info));

    component.ngOnInit();

    // No full-HD desktop container in the test DOM, so the narrow width wins.
    expect(component.dosWidthPx).toBe(component.WIDTH_PX[0]);
    expect(resizes).toContainEqual({
      pId: component.processId,
      widthPx: component.WIDTH_PX[0],
      heightPx: component.HEIGHT_PX,
    });
  });

  it('reuses the stored game src when there is no launching file', () => {
    (component as any)._gameSrc = 'blob:restored-game';

    expect(component.getGamesSrc(new FileInfo())).toBe('blob:restored-game');
    expect(component.getGamesSrc(triggerFile)).toBe('/Games/doom.jsdos');
  });

  it('has no still to hand the taskbar preview before the emulator canvas exists', async () => {
    await expect(component.captureJSDos()).resolves.toBe(Constants.EMPTY_STRING);
  });
});
