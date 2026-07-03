import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RuffleComponent } from './ruffle.component';

describe('RuffleComponent', () => {
  let component: RuffleComponent;
  let fixture: ComponentFixture<RuffleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RuffleComponent]
    });
    fixture = TestBed.createComponent(RuffleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
