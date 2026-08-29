import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { VideoPlayerComponent } from './videoplayer.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';

describe('VideoPlayerComponent', () => {
  let component: VideoPlayerComponent;
  let fixture: ComponentFixture<VideoPlayerComponent>;
  let sessionManagementService: SessionManagementService;

  // FileService (BrowserFS), ScriptService (video.js <script> injection) and
  // AudioService (Howler) are all replaced so the player logic can be tested
  // without any of those runtimes.
  const fileServiceStub = {
    resolveContentUrl: () => '',
    getFileAsBlobAsync: () => Promise.resolve(null),
  };
  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    loadStyle: () => Promise.resolve(),
    unloadScript: () => undefined,
    unloadStyle: () => undefined,
  };
  const audioServiceStub = {
    play: jest.fn(),
    stop: jest.fn(),
  };

  const makeFileInfo = (fileName: string, fileType: string): FileInfo => {
    const info = new FileInfo();
    info.setFileName = fileName;
    info.setFileType = fileType;
    return info;
  };

  let triggerFile: FileInfo;
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => triggerFile,
    runApplication: jest.fn(),
  };

  beforeEach(async () => {
    triggerFile = makeFileInfo('holiday.mp4', '.mp4');

    await TestBed.configureTestingModule({
      declarations: [VideoPlayerComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: FileService, useValue: fileServiceStub },
        { provide: ScriptService, useValue: scriptServiceStub },
        { provide: AudioService, useValue: audioServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoPlayerComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    // ngAfterViewInit downloads and boots video.js, so the view is not initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('videoplayer');
    expect(component.hasWindow).toBe(true);
  });

  it('titles the window with the file it was launched with', () => {
    component.ngOnInit();
    expect(component.displayName).toBe('holiday.mp4');
  });

  it('restores the media type and source from a prior session', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState(['video/mp4', 'osdrive/Users/Videos/holiday.mp4']);

    expect(sessionManagementService.getAppSession(uId)).not.toBeNull();

    component.priorUId = uId;
    component.retrievePastSessionData();

    expect((component as any).fileType).toBe('video/mp4');
    expect((component as any).videoSrc).toBe('osdrive/Users/Videos/holiday.mp4');
  });

  it('keeps the recents list free of duplicates', () => {
    component.addToRecentsList('a.mp4');
    component.addToRecentsList('b.mp4');
    component.addToRecentsList('a.mp4');

    expect(component.recents).toEqual(['a.mp4', 'b.mp4']);
  });

  it('opens the top menu and closes it again from either menu action', () => {
    component.showMenu();
    expect(component.showTopMenu).toBe(true);

    component.openFileExplorer();
    expect(component.showTopMenu).toBe(false);

    component.showMenu();
    component.playPrevious();
    expect(component.showTopMenu).toBe(false);
  });
});
