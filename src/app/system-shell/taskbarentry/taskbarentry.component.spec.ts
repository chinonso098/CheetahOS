import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';

import { TaskBarEntryComponent } from './taskbarentry.component';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('TaskBarEntryComponent', () => {
  let component: TaskBarEntryComponent;
  let fixture: ComponentFixture<TaskBarEntryComponent>;

  const CHROME_ICON = `${Constants.IMAGE_BASE_PATH}texteditor.png`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskBarEntryComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskBarEntryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('copies its inputs into the process detail on init', () => {
    component.taskBarIconImgUrl = CHROME_ICON;
    component.taskBarIconName = 'texteditor';
    component.taskBarPid = 77;

    component.ngOnInit();

    expect(component.icon).toBe(CHROME_ICON);
    expect(component.defaultIcon).toBe(CHROME_ICON);
    expect(component.name).toBe('texteditor');
    expect(component.processId).toBe(77);
    expect(component.type).toBe(ComponentType.System);
  });

  it('adopts the new pid and entry type immediately when the inputs change', () => {
    component.taskBarPid = 91;
    component.taskBarEntryType = component.taskBarShowLabelEntryOption;

    component.ngOnChanges({
      taskBarPid: new SimpleChange(0, 91, false),
    });

    expect(component.processId).toBe(91);
    expect(component.setTaskBarEntryType).toBe(component.taskBarShowLabelEntryOption);
  });

  it('defers the icon and label refresh until after the change settles', () => {
    jest.useFakeTimers();
    const refreshDelayMs = 5;
    component.taskBarIconName = 'terminal';
    component.taskBarIconImgUrl = CHROME_ICON;

    component.ngOnChanges({
      taskBarIconName: new SimpleChange(Constants.EMPTY_STRING, 'terminal', false),
    });
    expect(component.name).toBe(Constants.EMPTY_STRING);

    jest.advanceTimersByTime(refreshDelayMs);
    expect(component.name).toBe('terminal');
    expect(component.icon).toBe(CHROME_ICON);
    jest.useRealTimers();
  });

  it('starts out windowless with no icon or label', () => {
    expect(component.hasWindow).toBe(false);
    expect(component.hover).toBe(false);
    expect(component.icon).toBe(Constants.EMPTY_STRING);
    expect(component.displayName).toBe(Constants.EMPTY_STRING);
  });
});
