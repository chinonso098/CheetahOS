import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationCenterComponent } from './notificationcenter.component';

describe('StartButtonComponent', () => {
  let component: NotificationCenterComponent;
  let fixture: ComponentFixture<NotificationCenterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NotificationCenterComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
