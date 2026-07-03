import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JSdosComponent } from './jsdos.component';

describe('JSdosComponent', () => {
  let component: JSdosComponent;
  let fixture: ComponentFixture<JSdosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JSdosComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JSdosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
