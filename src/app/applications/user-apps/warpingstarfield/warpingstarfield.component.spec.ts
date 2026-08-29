import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { WarpingstarfieldComponent } from './warpingstarfield.component';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('WarpingstarfieldComponent', () => {
  let component: WarpingstarfieldComponent;
  let fixture: ComponentFixture<WarpingstarfieldComponent>;
  let sessionManagementService: SessionManagementService;
  let windowService: WindowService;
  let runningProcessService: RunningProcessService;

  // ScriptService injects the three.js <script> tag; the WebGL scene is never
  // created here because ngAfterViewInit is not run.
  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    unloadScript: () => undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WarpingstarfieldComponent],
      providers: [
        { provide: ScriptService, useValue: scriptServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(WarpingstarfieldComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    windowService = TestBed.inject(WindowService);
    runningProcessService = TestBed.inject(RunningProcessService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('starfield');
    expect(component.type).toBe(ComponentType.User);
    expect(component.isMaximizable).toBe(true);
  });

  it('registers itself with the running process list on construction', () => {
    const own = runningProcessService.getProcess(component.processId);

    expect(own).toBeTruthy();
    expect(own?.getProcessName).toBe('starfield');
    expect(own?.getHasWindow).toBe(true);
  });

  it('has nothing to capture before the WebGL canvas exists', async () => {
    await expect(component.captureCanvasStill()).resolves.toBe(Constants.EMPTY_STRING);
  });

  it('ignores resize broadcasts smaller than its minimum window size', () => {
    const resizeSpy = jest.spyOn(component, 'onWindowResize');

    windowService.resizeProcessWindowNotify.next(
      { pId: component.processId, widthPx: 100, heightPx: 100 } as any);
    expect(resizeSpy).not.toHaveBeenCalled();

    windowService.resizeProcessWindowNotify.next(
      { pId: component.processId, widthPx: 900, heightPx: 700 } as any);
    expect(resizeSpy).toHaveBeenCalled();
  });

  it('persists its state under a process-unique session key', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('warp-state');

    expect(sessionManagementService.getAppSession(uId)?.appData).toBe('warp-state');
    expect(sessionManagementService.getAppSession(uId)?.appName).toBe('starfield');
  });
});
