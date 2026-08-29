import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { VolumeControlComponent } from './volumecontrol.component';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { Constants } from 'src/app/system-files/constants';

describe('VolumeControlComponent', () => {
  let component: VolumeControlComponent;
  let fixture: ComponentFixture<VolumeControlComponent>;

  const audioServiceStub = {
    changeVolumeNotify: new Subject<void>(),
    getVolume: () => 0.5,
    changeVolume: (_volume: number) => undefined,
  };

  const sliderEvent = (percentage: number) =>
    ({ target: { value: String(percentage) } }) as unknown as Event;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VolumeControlComponent],
      providers: [{ provide: AudioService, useValue: audioServiceStub }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VolumeControlComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('seeds the slider and icon from the current service volume', () => {
    component.ngOnInit();

    expect(component.adjustedVolume).toBe(50);
    expect(component.audioIcon).toBe(`${Constants.IMAGE_BASE_PATH}medium_volume.png`);
  });

  it('shows the error icon when the volume cannot be read', () => {
    const unreadableSpy = jest.spyOn(audioServiceStub, 'getVolume').mockReturnValue(-1);

    component.ngOnInit();

    expect(component.audioIcon).toBe(`${Constants.IMAGE_BASE_PATH}volume_error.png`);
    unreadableSpy.mockRestore();
  });

  it('maps every slider position onto exactly one volume icon', () => {
    const iconFor = (percentage: number) => {
      component.onVolumeSliderChange(sliderEvent(percentage));
      return component.audioIcon;
    };

    expect(iconFor(0)).toBe(`${Constants.IMAGE_BASE_PATH}no_volume.png`);
    expect(iconFor(30)).toBe(`${Constants.IMAGE_BASE_PATH}low_volume.png`);
    expect(iconFor(70)).toBe(`${Constants.IMAGE_BASE_PATH}medium_volume.png`);
    expect(iconFor(100)).toBe(`${Constants.IMAGE_BASE_PATH}high_volume.png`);
  });

  it('converts the slider percentage to a fraction and broadcasts the change', () => {
    const changeVolumeSpy = jest.spyOn(audioServiceStub, 'changeVolume');
    let notified = false;
    audioServiceStub.changeVolumeNotify.subscribe(() => (notified = true));

    component.onVolumeSliderChange(sliderEvent(35));

    expect(component.adjustedVolume).toBe(35);
    expect(changeVolumeSpy).toHaveBeenCalledWith(0.35);
    expect(notified).toBe(true);
    changeVolumeSpy.mockRestore();
  });
});
