import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { DailyCostEngine } from './daily-cost-engine';

describe('DailyCostEngine', () => {
  let component: DailyCostEngine;
  let fixture: ComponentFixture<DailyCostEngine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyCostEngine],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyCostEngine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
