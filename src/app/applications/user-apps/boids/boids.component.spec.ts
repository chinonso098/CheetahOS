import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { BoidsComponent } from './boids.component';
import { ScriptService } from 'src/app/shared/system-service/script.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('BoidsComponent', () => {
  let component: BoidsComponent;
  let fixture: ComponentFixture<BoidsComponent>;
  let sessionManagementService: SessionManagementService;
  let windowService: WindowService;

  // ScriptService injects the p5.js <script> tag; the sketch itself is never
  // booted here because ngAfterViewInit is not run.
  const scriptServiceStub = {
    loadScript: () => Promise.resolve(),
    unloadScript: () => undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoidsComponent],
      // The flocking sliders are driven by a reactive FormGroup.
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ScriptService, useValue: scriptServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoidsComponent);
    component = fixture.componentInstance;
    sessionManagementService = TestBed.inject(SessionManagementService);
    windowService = TestBed.inject(WindowService);
    // ngAfterViewInit instantiates p5 and starts a capture interval.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('boids');
    expect(component.type).toBe(ComponentType.User);
  });

  it('builds a slider control for each flocking behaviour', async () => {
    await component.ngOnInit();

    expect(component.sliders).toEqual(['align', 'cohesion', 'separation']);
    for (const slider of component.sliders) {
      expect(component.form.get(slider)).not.toBeNull();
    }
  });

  it('returns an empty string when there is no p5 canvas to capture', () => {
    expect(component.captureCanvasStill()).toBe(Constants.EMPTY_STRING);
  });

  it('ignores resize broadcasts before p5 has created its canvas', () => {
    windowService.resizeProcessWindowNotify.next(
      { pId: component.processId, widthPx: 800, heightPx: 600 } as any);

    // No p5 instance yet, so onWindowResize bails out rather than throwing.
    expect(() => component.onWindowResize()).not.toThrow();
  });

  it('persists its state under a process-unique session key', () => {
    const uId = `${component.name}-${component.processId}`;
    component.storeAppState('flock-state');

    expect(sessionManagementService.getAppSession(uId)?.appData).toBe('flock-state');
    expect(sessionManagementService.getAppSession(uId)?.appName).toBe('boids');
  });
});
