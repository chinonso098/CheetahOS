import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrimaryWindowComponent } from './window.component';

describe('WindowComponent', () => {
  let component: PrimaryWindowComponent;
  let fixture: ComponentFixture<PrimaryWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PrimaryWindowComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrimaryWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
