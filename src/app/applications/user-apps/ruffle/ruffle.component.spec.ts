import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { RuffleComponent } from './ruffle.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('RuffleComponent', () => {
  let component: RuffleComponent;
  let fixture: ComponentFixture<RuffleComponent>;
  let windowService: WindowService;

  let triggerFile: FileInfo;

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'pong.swf';
    triggerFile.setFileType = '.swf';
    triggerFile.setCurrentPath = '/Games/pong.swf';

    await TestBed.configureTestingModule({
      declarations: [RuffleComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: { getLastProcessTrigger: () => triggerFile } },
        // FileService boots BrowserFS; only the calls ruffle makes are modelled.
        {
          provide: FileService,
          useValue: {
            resolveContentUrl: () => '/Games/pong.swf',
            getFileInfoAsync: () => Promise.resolve(new FileInfo()),
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

    fixture = TestBed.createComponent(RuffleComponent);
    component = fixture.componentInstance;
    windowService = TestBed.inject(WindowService);

    // ngAfterViewInit downloads and boots the Flash emulator, so the view is
    // left un-initialised and the container element is supplied by hand.
    (component as any).ruffleContainer = { nativeElement: document.createElement('div') };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('ruffle');
    expect(component.type).toBe(ComponentType.User);
    expect(component.isMaximizable).toBe(false);
  });

  it('titles and sizes the window from the swf that launched it', () => {
    const resizes: any[] = [];
    windowService.resizeProcessWindowNotify.subscribe(info => resizes.push(info));

    component.ngOnInit();

    expect(component.displayName).toBe('pong.swf');
    expect(resizes).toContainEqual({
      pId: component.processId,
      widthPx: component.WIDTH_PX,
      heightPx: component.HEIGHT_PX,
    });
  });

  it('resolves the game src from the launching file, falling back to the stored one', async () => {
    await expect(component.getGamesSrc(triggerFile)).resolves.toBe('/Games/pong.swf');

    (component as any)._gameSrc = 'blob:restored-game';
    await expect(component.getGamesSrc(new FileInfo())).resolves.toBe('blob:restored-game');
  });

  it('refuses to load a swf before the ruffle runtime is available', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    component.loadSWF('/Games/pong.swf');

    expect(consoleError).toHaveBeenCalledWith('Ruffle is not loaded');
    expect((component as any).ruffleContainer.nativeElement.children.length).toBe(0);
    consoleError.mockRestore();
  });

  it('has no still to hand the taskbar preview before a player is mounted', async () => {
    await expect(component.captureRuffleStill()).resolves.toBe(Constants.EMPTY_STRING);
  });
});
