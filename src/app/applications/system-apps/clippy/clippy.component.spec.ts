import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ClippyComponent } from './clippy.component';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

describe('ClippyComponent', () => {
  let component: ClippyComponent;
  let fixture: ComponentFixture<ClippyComponent>;
  let runningProcessService: RunningProcessService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClippyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    runningProcessService = TestBed.inject(RunningProcessService);

    fixture = TestBed.createComponent(ClippyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers itself as a windowless user process on a fixed pid', () => {
    const process = runningProcessService.getProcess(component.processId);

    expect(process?.getProcessName).toBe('clippy');
    expect(component.hasWindow).toBe(false);
    expect(component.type).toBe(ComponentType.User);
  });

  it('picks a matching animation, duration and quote on init', () => {
    component.ngOnInit();

    expect(component.selectedAnimation)
      .toBe(component.clippyAnimations[component.randomSelection]);
    expect(component.selectedDuration)
      .toBe(component.clippyDurations[component.randomSelection]);
    expect(component.clippyTextQuotes).toContain(component.toolTipText);
  });

  it('never picks an index outside the animation list', () => {
    const lastIndex = component.clippyAnimations.length - 1;

    for (let i = 0; i < 50; i++) {
      const pick = component.randomIntFromInterval(0, lastIndex);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThanOrEqual(lastIndex);
    }
  });

  it('switches to the annoyed animation when clicked', () => {
    component.ngOnInit();

    component.onClippyGifCntnrClick();
    expect(component.toolTipText).toBe(component.clippyTextTips[0]);
    expect(component.gifPath).toBe(`${Constants.GIF_BASE_PATH}clippy_no.gif`);

    component.toolTipText = Constants.EMPTY_STRING;
    component.onToolTipCntnrClick();
    expect(component.toolTipText).toBe(component.clippyTextTips[0]);
  });
});
