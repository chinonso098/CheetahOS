import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunSystemComponent } from './runsystem.component';

describe('RunSystemComponent', () => {
  let component: RunSystemComponent;
  let fixture: ComponentFixture<RunSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunSystemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunSystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
