import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { NotificationCenterComponent } from './notificationcenter.component';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/system.types';

describe('NotificationCenterComponent', () => {
  let component: NotificationCenterComponent;
  let fixture: ComponentFixture<NotificationCenterComponent>;
  let menuService: MenuService;
  let runningProcessService: RunningProcessService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationCenterComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);
    runningProcessService = TestBed.inject(RunningProcessService);

    fixture = TestBed.createComponent(NotificationCenterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers itself as a windowless system process', () => {
    const process = runningProcessService.getProcess(component.processId);

    expect(process?.getProcessName).toBe('notificationcenter');
    expect(component.hasWindow).toBe(false);
    expect(component.type).toBe(ComponentType.System);
  });

  it('toggles the start menu open then closed across successive clicks', () => {
    const shown: number[] = [];
    const hidden: number[] = [];
    menuService.showStartMenu.subscribe(() => shown.push(1));
    menuService.hideStartMenu.subscribe(() => hidden.push(1));
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.showStartMenu(evt);
    expect(shown.length).toBe(1);
    expect(hidden.length).toBe(0);

    component.showStartMenu(evt);
    expect(shown.length).toBe(1);
    expect(hidden.length).toBe(1);
    expect(evt.stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('re-arms the toggle after the start menu is dismissed from elsewhere', () => {
    const shown: number[] = [];
    menuService.showStartMenu.subscribe(() => shown.push(1));
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.showStartMenu(evt);
    // Emitted by whatever closed the menu (taskbar click, escape, etc).
    menuService.hideStartMenu.next();
    component.showStartMenu(evt);

    expect(shown.length).toBe(2);
  });

  it('stops listening for start-menu dismissals once destroyed', () => {
    const hideSpy = jest.spyOn(component, 'hideStartMenu');

    component.ngOnDestroy();
    menuService.hideStartMenu.next();

    expect(hideSpy).not.toHaveBeenCalled();
    hideSpy.mockRestore();
  });
});
