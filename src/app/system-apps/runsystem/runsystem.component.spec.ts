import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunsystemComponent } from './runsystem.component';

describe('RunsystemComponent', () => {
  let component: RunsystemComponent;
  let fixture: ComponentFixture<RunsystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunsystemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunsystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
