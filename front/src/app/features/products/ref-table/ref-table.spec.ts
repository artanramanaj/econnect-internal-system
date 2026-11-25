import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { CatalogRef } from '../../../core/models/item.model';
import { RefRename, RefTable } from './ref-table';

const REFS: CatalogRef[] = [
  { id: 1, name: 'Cables', itemCount: 0 },
  { id: 2, name: 'Cameras', itemCount: 3 },
];

describe('RefTable', () => {
  let component: RefTable;
  let fixture: ComponentFixture<RefTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefTable],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RefTable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'categories');
    fixture.componentRef.setInput('refs', REFS);
    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 2, totalPages: 1 });
    fixture.componentRef.setInput('canManage', true);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const rowButton = (row: Element, label: string) =>
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);

  it('should render the heading for its kind and a row per entry with its count', () => {
    expect(el().textContent).toContain('Categories');
    expect(rows()).toHaveLength(2);
    expect(rows()[1].textContent).toContain('Cameras');
    expect(rows()[1].textContent).toContain('3');
  });

  it('should emit a trimmed add and reset only when the parent says so', async () => {
    const added: string[] = [];
    component.add.subscribe((name) => added.push(name));

    component.addForm.controls.name.setValue('  CCTV ');
    component.onAdd();
    expect(added).toEqual(['CCTV']);

    // Still holding the text until the server accepts it.
    expect(component.addForm.controls.name.value).toBe('  CCTV ');
    component.resetAdd();
    expect(component.addForm.controls.name.value).toBe('');

    // Too short never leaves the card.
    component.addForm.controls.name.setValue('x');
    component.onAdd();
    await fixture.whenStable();
    expect(added).toEqual(['CCTV']);
    expect(el().textContent).toContain('Enter a name of 2 to 80 characters');
  });

  it('should rename inline and emit only a real change', async () => {
    const renames: RefRename[] = [];
    component.rename.subscribe((change) => renames.push(change));

    rowButton(rows()[0], 'Rename')?.click();
    await fixture.whenStable();
    component.renameForm.controls.name.setValue('Cabling');
    component.submitRename(REFS[0]);
    expect(renames).toEqual([{ id: 1, name: 'Cabling' }]);

    // Submitting the unchanged name is a no-op.
    component.startRename(REFS[1]);
    component.submitRename(REFS[1]);
    expect(renames).toHaveLength(1);
  });

  it('should allow deleting only an unused entry, saying why not otherwise', () => {
    const removed: CatalogRef[] = [];
    component.remove.subscribe((ref) => removed.push(ref));

    const used = rowButton(rows()[1], 'Delete') as HTMLButtonElement;
    expect(used.disabled).toBe(true);
    expect(used.title).toContain('Used by 3');

    rowButton(rows()[0], 'Delete')?.click();
    expect(removed.map((r) => r.id)).toEqual([1]);
  });

  it('should be a read-only card without catalog.manage', async () => {
    fixture.componentRef.setInput('canManage', false);
    await fixture.whenStable();

    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelectorAll('button')).toHaveLength(0);
    expect(rows()).toHaveLength(2);
  });
});
