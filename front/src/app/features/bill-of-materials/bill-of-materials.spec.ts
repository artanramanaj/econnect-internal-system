import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { BillOfMaterials } from './bill-of-materials';

describe('BillOfMaterials', () => {
  let component: BillOfMaterials;
  let fixture: ComponentFixture<BillOfMaterials>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillOfMaterials],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(BillOfMaterials);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
