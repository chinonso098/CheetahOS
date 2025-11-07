import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverFlowComponent } from './overflow.component';

describe('OverFlowComponent', () => {
  let component: OverFlowComponent;
  let fixture: ComponentFixture<OverFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverFlowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OverFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
