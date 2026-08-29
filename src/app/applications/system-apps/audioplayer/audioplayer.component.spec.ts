import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AudioPlayerComponent } from './audioplayer.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let fixture: ComponentFixture<AudioPlayerComponent>;
  let sessionManagementService: SessionManagementService;

  // FileService (BrowserFS), ScriptService (Howler / siriwave <script> tags)
  // and AudioService (Howler) are stubbed so the player's own logic can be
  // exercised without loading any of those runtimes.
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
    getVolume: () => 1,
    // Called from ngOnDestroy when the fixture is torn down.
    removeExternalAudioSrc: jest.fn(),
  };

  let triggerFile: FileInfo;
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => triggerFile,
    runApplication: jest.fn(),
  };

  beforeEach(async () => {
    triggerFile = new FileInfo();
    triggerFile.setFileName = 'song.mp3';
    triggerFile.setFileType = '.mp3';

    await TestBed.configureTestingModule({
      declarations: [AudioPlayerComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: FileService, useValue: fileServiceStub },
        { provide: ScriptService, useValue: scriptServiceStub },
        { provide: AudioService, useValue: audioServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioPlayerComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    // ngAfterViewInit loads Howler + siriwave and measures the canvas, so the
    // view is deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('audioplayer');
    expect(component.hasWindow).toBe(true);
  });

  it('titles the window with the track it was launched with', () => {
    component.ngOnInit();
    expect(component.displayName).toBe('song.mp3');
  });

  it('formats elapsed seconds as m:ss', () => {
    expect(component.formatTime(0)).toBe('0:00');
    expect(component.formatTime(9)).toBe('0:09');
    expect(component.formatTime(65)).toBe('1:05');
    expect(component.formatTime(600)).toBe('10:00');
  });

  it('picks a supported audio extension from either candidate path', () => {
    expect(component.getExt('/Music/song.mp3', '/Music')).toBe('.mp3');
    // Falls back to the current path when the content path is not audio.
    expect(component.getExt('/Music/cover.png', '/Music/song.wav')).toBe('.wav');
    // Neither path names an audio file.
    expect(component.getExt('/Music/cover.png', '/Music')).toBe('');
  });

  it('restores the track source from a prior session and de-dupes recents', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('osdrive/Users/Music/song.mp3');
    expect(sessionManagementService.getAppSession(uId)).not.toBeNull();

    component.priorUId = uId;
    component.retrievePastSessionData();
    expect((component as any).audioSrc).toBe('osdrive/Users/Music/song.mp3');

    component.addToRecentsList('song.mp3');
    component.addToRecentsList('song.mp3');
    expect(component.recents).toEqual(['song.mp3']);
  });
});
