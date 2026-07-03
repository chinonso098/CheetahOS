import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPlayerComponent } from './videoplayer.component';

describe('WinampComponent', () => {
  let component: VideoPlayerComponent;
  let fixture: ComponentFixture<VideoPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VideoPlayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
