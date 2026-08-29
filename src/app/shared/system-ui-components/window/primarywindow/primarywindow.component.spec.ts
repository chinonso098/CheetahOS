import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AngularDraggableModule } from 'angular2-draggable';

import { PrimaryWindowComponent } from './primarywindow.component';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Constants } from 'src/app/system-files/constants';
import { WindowConstants } from '../window.constants';

describe('PrimaryWindowComponent', () => {
  let component: PrimaryWindowComponent;
  let fixture: ComponentFixture<PrimaryWindowComponent>;
  let windowService: WindowService;
  let runningProcessService: RunningProcessService;
  let defaultService: DefaultService;

  const APP_NAME = 'texteditor';
  const WINDOW_PID = 101;

  beforeEach(async () => {
    // The window co-ordinates its state through the real (dependency-light)
    // system services, so they are used as-is rather than stubbed; the animation
    // and drag/resize modules the template needs are supplied instead.
    await TestBed.configureTestingModule({
      declarations: [PrimaryWindowComponent],
      imports: [NoopAnimationsModule, DragDropModule, AngularDraggableModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    windowService = TestBed.inject(WindowService);
    runningProcessService = TestBed.inject(RunningProcessService);
    defaultService = TestBed.inject(DefaultService);

    fixture = TestBed.createComponent(PrimaryWindowComponent);
    component = fixture.componentInstance;
    component.runningProcessID = WINDOW_PID;
    component.processAppName = APP_NAME;
    component.processAppIcon = `${Constants.IMAGE_BASE_PATH}texteditor.png`;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adopts its inputs and registers the window under a name-pid unique id', () => {
    const newProcessNames: string[] = [];
    runningProcessService.newProcessNotify.subscribe((n) => newProcessNames.push(n));

    component.ngOnInit();

    expect(component.processId).toBe(WINDOW_PID);
    expect(component.name).toBe(APP_NAME);
    expect(component.uniqueId).toBe(`${APP_NAME}-${WINDOW_PID}`);
    expect(newProcessNames).toContain(`${APP_NAME}-${WINDOW_PID}`);
  });

  it('only constrains dragging to the desktop when viewport bounds are enforced', () => {
    defaultService.updateDefaultData(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS, Constants.TRUE, false);
    expect(component.dragBoundarySelector).toBe('#vantaCntnr');

    defaultService.updateDefaultData(Constants.DEFAULT_ENFORCE_VIEWPORT_BOUNDS, Constants.FALSE, false);
    expect(component.dragBoundarySelector).toBe(Constants.EMPTY_STRING);
  });

  it('mirrors its position into the animation params and drops the z-index when hidden', () => {
    component.windowLeftPx = 120;
    component.windowTopPx = 60;

    component.applyPositionStyles();
    expect(component.strWindowLeftPx).toBe('120px');
    expect(component.strWindowTopPx).toBe('60px');
    expect(component.currentStyles['opacity']).toBe(1);

    component.hideWindow = true;
    component.applyPositionStyles();
    expect(component.currentStyles['opacity']).toBe(0);
    expect(component.currentStyles['z-index']).toBe(WindowConstants.HIDDEN_Z_INDEX);
  });

  it('publishes its live geometry back to the central window state store', () => {
    component.ngOnInit();
    windowService.addWindowState({
      appName: APP_NAME,
      pId: WINDOW_PID,
      widthPx: 0,
      heightPx: 0,
      leftPx: 0,
      topPx: 0,
      zIndex: 0,
      isVisible: true,
    });

    component.windowLeftPx = 10;
    component.windowTopPx = 20;
    component.windowWidthPx = 640;
    component.windowHeightPx = 480;
    component.syncStatePositionSize();

    const state = windowService.getWindowState(WINDOW_PID);
    expect(state?.leftPx).toBe(10);
    expect(state?.topPx).toBe(20);
    expect(state?.widthPx).toBe(640);
    expect(state?.heightPx).toBe(480);
  });
});
