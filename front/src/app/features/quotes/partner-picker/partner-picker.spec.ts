import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { CreatePartnerRequest, Partner } from '../../../core/models/partner.model';
import { PartnerPicker } from './partner-picker';

const PARTNERS: Partner[] = [
  {
    id: 1,
    partnerNumber: 'P-0001',
    legalName: 'Northgate Logistics Sh.p.k.',
    tradeName: 'Northgate Logistics',
    fiscalNumber: '600112233',
    city: 'Prishtinë',
    email: null,
    phone: null,
    paymentTerms: '50% advance, 50% on completion',
    isCustomer: true,
    isSupplier: false,
  },
];

describe('PartnerPicker', () => {
  let component: PartnerPicker;
  let fixture: ComponentFixture<PartnerPicker>;
  let partnerControl: FormControl<string>;
  let siteControl: FormControl<string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerPicker],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    partnerControl = new FormControl('', { nonNullable: true, validators: Validators.required });
    siteControl = new FormControl('', { nonNullable: true });

    fixture = TestBed.createComponent(PartnerPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('partnerControl', partnerControl);
    fixture.componentRef.setInput('siteControl', siteControl);
    fixture.componentRef.setInput('partners', PARTNERS);
    fixture.componentRef.setInput('sites', [{ id: 9, name: 'Main warehouse', address: null, city: 'Prishtinë' }]);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

  it('should list the clients with their number and the picked client’s sites', () => {
    expect(text()).toContain('Northgate Logistics (P-0001)');
    expect(text()).toContain('Main warehouse · Prishtinë');
  });

  it('should emit the search term and the picked client', () => {
    const terms: string[] = [];
    const picked: string[] = [];
    component.search.subscribe((term) => terms.push(term));
    component.picked.subscribe((id) => picked.push(id));

    const search = el().querySelector('input[type="search"]') as HTMLInputElement;
    search.value = ' north ';
    search.dispatchEvent(new Event('input'));

    const select = el().querySelector('#quote-partner') as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change'));

    expect(terms).toEqual(['north']);
    expect(partnerControl.value).toBe('1');
    expect(picked).toEqual(['1']);
  });

  it('should ask for a client once the field was touched and left empty', async () => {
    partnerControl.markAsTouched();
    await fixture.whenStable();

    expect(text()).toContain('Choose a client');
  });

  it('should create a client from the inline form, legal name required', async () => {
    const created: CreatePartnerRequest[] = [];
    component.create.subscribe((payload) => created.push(payload));

    button('New client').click();
    await fixture.whenStable();

    component.submitNew();
    await fixture.whenStable();
    expect(created).toEqual([]);
    expect(text()).toContain('Name must be at least 2 characters');

    component.newForm.controls.legalName.setValue('  Arena Business Center Sh.p.k. ');
    component.newForm.controls.city.setValue('Ferizaj');
    component.submitNew();

    // Blank optionals are left out rather than sent as "".
    expect(created).toEqual([{ legalName: 'Arena Business Center Sh.p.k.', city: 'Ferizaj' }]);

    // The parent closes the form once the server accepted it.
    component.closeForm();
    await fixture.whenStable();
    expect(el().querySelector('#new-client-name')).toBeNull();
  });

  it('should show a failed create inside the form', async () => {
    button('New client').click();
    fixture.componentRef.setInput('createError', 'Name must be at least 2 characters');
    await fixture.whenStable();

    expect(el().querySelector('form')?.textContent).toContain('Name must be at least 2 characters');
  });

  it('should show a saved quote’s client as fixed text', async () => {
    fixture.componentRef.setInput('locked', {
      id: 1,
      partnerNumber: 'P-0001',
      legalName: 'Northgate Logistics Sh.p.k.',
      tradeName: 'Northgate Logistics',
      city: 'Prishtinë',
    });
    await fixture.whenStable();

    expect(el().querySelector('#quote-partner')).toBeNull();
    expect(text()).toContain('Northgate Logistics');
    expect(text()).toContain('P-0001');
    // The site can still be changed.
    expect(el().querySelector('#quote-site')).toBeTruthy();
  });
});
