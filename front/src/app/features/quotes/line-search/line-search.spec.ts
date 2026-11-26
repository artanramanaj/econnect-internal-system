import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { CatalogueHit } from '../../../core/models/quote.model';
import { LinePick, LineSearch } from './line-search';

const HITS: CatalogueHit[] = [
  {
    id: 11,
    sku: 'CAM-IPD4-28',
    description: 'IP dome camera 4 MP',
    type: 'PRODUCT',
    baseUnitCode: 'pcs',
    vatCode: 'STANDARD',
    vatRate: '18.00',
    category: 'IP Camera System',
    hasBrochure: false,
    costPrice: '72.0000',
  },
];

describe('LineSearch', () => {
  let component: LineSearch;
  let fixture: ComponentFixture<LineSearch>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LineSearch],
      // The money pipe reads LanguageService, which injects AuthService, which
      // injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LineSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const typeInto = async (selector: string, value: string) => {
    const input = el().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  it('should emit what is typed and open the results from two characters on', async () => {
    const terms: string[] = [];
    component.search.subscribe((term) => terms.push(term));

    await typeInto('#line-search', 'c');
    expect(el().querySelector('[role="listbox"]')).toBeNull();

    await typeInto('#line-search', ' cam ');
    expect(terms).toEqual(['c', 'cam']);
    expect(el().querySelector('[role="listbox"]')).toBeTruthy();
  });

  it('should emit the picked match with the section, then clear the search', async () => {
    const picks: LinePick[] = [];
    const terms: string[] = [];
    component.pick.subscribe((pick) => picks.push(pick));
    component.search.subscribe((term) => terms.push(term));

    fixture.componentRef.setInput('hits', HITS);
    await typeInto('#line-section', ' CCTV ');
    await typeInto('#line-search', 'cam');

    (el().querySelector('[role="option"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(picks).toEqual([{ hit: HITS[0], section: 'CCTV' }]);
    expect(component.term()).toBe('');
    expect(terms.at(-1)).toBe('');
    // The section stays for the next line.
    expect(component.section()).toBe(' CCTV ');
  });

  it('should say when nothing matches, but not while still searching', async () => {
    await typeInto('#line-search', 'zzz');
    expect(el().textContent).toContain('Nothing in the catalogue matches.');

    fixture.componentRef.setInput('searching', true);
    await fixture.whenStable();
    expect(el().textContent).not.toContain('Nothing in the catalogue matches.');
    expect(el().textContent).toContain('Searching…');
  });

  it('should offer a free line for the current section', async () => {
    const sections: string[] = [];
    component.addFree.subscribe((section) => sections.push(section));

    await typeInto('#line-section', 'Labour');
    const free = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Free line'),
    ) as HTMLButtonElement;
    free.click();

    expect(sections).toEqual(['Labour']);
  });
});
