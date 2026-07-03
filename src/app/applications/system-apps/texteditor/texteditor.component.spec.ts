import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextEditorComponent } from './texteditor.component';

describe('TextEditorComponent', () => {
  let component: TextEditorComponent;
  let fixture: ComponentFixture<TextEditorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TextEditorComponent]
    });
    fixture = TestBed.createComponent(TextEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
