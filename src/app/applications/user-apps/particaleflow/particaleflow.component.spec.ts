import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ParticaleFlowComponent } from './particaleflow.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';

describe('ParticaleFlowComponent', () => {
  let component: ParticaleFlowComponent;
  let fixture: ComponentFixture<ParticaleFlowComponent>;
  let sessionManagementService: SessionManagementService;
  let windowService: WindowService;
  let runningProcessService: RunningProcessService;

  // ProcessHandlerService owns the whole launch pipeline; the particle app only
  // needs it to exist.
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => undefined,
    runApplication: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ParticaleFlowComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticaleFlowComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    windowService = TestBed.inject(WindowService);
    runningProcessService = TestBed.inject(RunningProcessService);
    // ngAfterViewInit builds a 2D canvas and starts a requestAnimationFrame
    // loop, so the view is deliberately left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('particleflow');
    expect(component.type).toBe(ComponentType.User);
  });

  it('registers itself with the running process list on construction', () => {
    const own = runningProcessService.getProcess(component.processId);

    expect(own).toBeTruthy();
    expect(own?.getProcessName).toBe('particleflow');
    expect(own?.getHasWindow).toBe(true);
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

  it('does nothing on resize while the canvas has not been created', () => {
    // No host element and no canvas yet, so the handler must bail out quietly.
    expect(() => component.onWindowResize()).not.toThrow();
  });

  it('persists its state under a process-unique session key', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('flow-state');

    expect(sessionManagementService.getAppSession(uId)?.appData).toBe('flow-state');
    expect(sessionManagementService.getAppSession(uId)?.appName).toBe('particleflow');
  });
});
