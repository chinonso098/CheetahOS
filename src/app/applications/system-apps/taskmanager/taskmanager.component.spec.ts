import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TaskmanagerComponent } from './taskmanager.component';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { RefreshRates, RefreshRatesIntervals, DisplayViews, TableColumns } from './taskmanager.enum';
import { Process } from 'src/app/system-files/process';
import { ComponentType } from 'src/app/system-files/system.types';

describe('TaskmanagerComponent', () => {
  let component: TaskmanagerComponent;
  let fixture: ComponentFixture<TaskmanagerComponent>;
  let runningProcessService: RunningProcessService;

  // The only heavyweight collaborator: UserNotificationService opens real
  // dialogs, so the "cannot end this task" path is observed through a spy.
  const notificationServiceStub = {
    showInfoNotification: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskmanagerComponent],
      providers: [
        { provide: UserNotificationService, useValue: notificationServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskmanagerComponent);
    component = fixture.componentInstance;
    runningProcessService = TestBed.inject(RunningProcessService);
    // ngOnInit is safe (reads the process list); ngAfterViewInit starts the
    // refresh interval and measures the DOM, so detectChanges() is avoided.
    component.ngOnInit();
    notificationServiceStub.showInfoNotification.mockClear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('taskmanager');
    expect(component.processes.length).toBeGreaterThan(0);
  });

  it('accepts refresh rates inside the supported range and ignores the rest', () => {
    component.refreshRate(RefreshRates.HIGH);
    expect(component.selectedRefreshRate).toBe(RefreshRates.HIGH);
    expect((component as any).refreshRateInterval).toBe(RefreshRatesIntervals.HIGH);

    component.refreshRate(RefreshRates.PAUSED);
    expect(component.selectedRefreshRate).toBe(RefreshRates.PAUSED);

    // Out of range: the previous selection is left untouched.
    component.refreshRate(99);
    expect(component.selectedRefreshRate).toBe(RefreshRates.PAUSED);
  });

  it('flips the sort direction each time the same header is clicked', () => {
    component.sortTable(TableColumns.NAME, true);
    expect(component.isDescSorting(TableColumns.NAME)).toBe(true);
    expect(component.isAscSorting(TableColumns.NAME)).toBe(false);

    component.sortTable(TableColumns.NAME, true);
    expect(component.isAscSorting(TableColumns.NAME)).toBe(true);

    // A different column is not reported as sorted.
    expect(component.isAscSorting(TableColumns.PID)).toBe(false);
  });

  it('switches between the mini and detailed views', () => {
    component.onFewerDetailsBtnClick();
    expect(component.viewOptions).toBe(DisplayViews.MINI_VIEW);

    component.onMoreDetailsBtnClick();
    expect(component.viewOptions).toBe(DisplayViews.DETAILED_VIEW);
  });

  it('refuses to end protected processes but closes ordinary ones', () => {
    const closeSpy = jest.fn();
    runningProcessService.closeProcessNotify.subscribe(closeSpy);

    // "desktop" is on the closingNotAllowed list.
    const protectedProcess = new Process(9101, 'desktop', '', true, ComponentType.System);
    runningProcessService.addProcess(protectedProcess);
    component.onProcessSelected(0, 9101);
    component.onEndTaskBtnClick();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(notificationServiceStub.showInfoNotification).toHaveBeenCalled();

    const userProcess = new Process(9102, 'boids', '', true, ComponentType.User);
    runningProcessService.addProcess(userProcess);
    component.onProcessSelected(1, 9102);
    component.onEndTaskBtnClick();

    expect(closeSpy).toHaveBeenCalledWith(userProcess);
  });
});
