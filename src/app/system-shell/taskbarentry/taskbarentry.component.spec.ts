import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskBarEntryComponent } from './taskbarentry.component';

describe('TaskBarEntryComponent', () => {
  let component: TaskBarEntryComponent;
  let fixture: ComponentFixture<TaskBarEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TaskBarEntryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskBarEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
