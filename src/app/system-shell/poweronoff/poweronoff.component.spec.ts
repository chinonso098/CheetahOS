import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PowerOnOffComponent } from './poweronoff.component';

describe('PowerOnOffComponent', () => {
  let component: PowerOnOffComponent;
  let fixture: ComponentFixture<PowerOnOffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PowerOnOffComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PowerOnOffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
