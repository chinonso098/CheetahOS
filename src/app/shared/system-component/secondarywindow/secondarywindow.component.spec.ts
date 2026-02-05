import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecondaryWindowComponent } from './secondarywindow.component';

describe('SecondaryWindowComponent', () => {
  let component: SecondaryWindowComponent;
  let fixture: ComponentFixture<SecondaryWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SecondaryWindowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecondaryWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
