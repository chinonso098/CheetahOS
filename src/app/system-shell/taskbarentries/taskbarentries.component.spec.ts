import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskBarEntriesComponent } from './taskbarentries.component';

describe('TaskBarEntriesComponent', () => {
  let component: TaskBarEntriesComponent;
  let fixture: ComponentFixture<TaskBarEntriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TaskBarEntriesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskBarEntriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
