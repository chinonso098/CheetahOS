import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticaleflowComponent } from './particaleflow.component';

describe('ParticaleflowComponent', () => {
  let component: ParticaleflowComponent;
  let fixture: ComponentFixture<ParticaleflowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ParticaleflowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticaleflowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
