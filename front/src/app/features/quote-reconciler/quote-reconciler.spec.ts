import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { QuoteReconciler } from './quote-reconciler';

describe('QuoteReconciler', () => {
  let component: QuoteReconciler;
  let fixture: ComponentFixture<QuoteReconciler>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteReconciler],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteReconciler);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
