import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticaleFlowComponent } from './particaleflow.component';

describe('ParticaleflowComponent', () => {
  let component: ParticaleFlowComponent;
  let fixture: ComponentFixture<ParticaleFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ParticaleFlowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticaleFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
