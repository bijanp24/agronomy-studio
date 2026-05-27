import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { QueryComponent } from './query.component';

describe('QueryComponent', () => {
  let component: QueryComponent;
  let fixture: ComponentFixture<QueryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit when question is empty', () => {
    component.question.set('   ');
    component.submit();
    expect(component.loading()).toBe(false);
  });

  it('should track query history', () => {
    // Directly test history mechanism
    component['addToHistory']('Test question', 5);
    expect(component.history().length).toBe(1);
    expect(component.history()[0].question).toBe('Test question');
  });

  it('should clear history', () => {
    component['addToHistory']('Q1', 2);
    component['addToHistory']('Q2', 3);
    component.clearHistory();
    expect(component.history().length).toBe(0);
  });

  it('should deduplicate history entries', () => {
    component['addToHistory']('Same question', 1);
    component['addToHistory']('Same question', 3);
    expect(component.history().length).toBe(1);
    expect(component.history()[0].rowCount).toBe(3);
  });
});
