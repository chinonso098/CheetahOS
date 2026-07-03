import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoidsComponent } from './boids.component';

describe('BoidsComponent', () => {
  let component: BoidsComponent;
  let fixture: ComponentFixture<BoidsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoidsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoidsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
