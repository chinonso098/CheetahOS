import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemtrayComponent } from './systemtray.component';

describe('SystemtrayComponent', () => {
  let component: SystemtrayComponent;
  let fixture: ComponentFixture<SystemtrayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemtrayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemtrayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
