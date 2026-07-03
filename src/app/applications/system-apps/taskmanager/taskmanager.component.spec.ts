import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskmanagerComponent } from './taskmanager.component';

describe('TaskmanagerComponent', () => {
  let component: TaskmanagerComponent;
  let fixture: ComponentFixture<TaskmanagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TaskmanagerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskmanagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
