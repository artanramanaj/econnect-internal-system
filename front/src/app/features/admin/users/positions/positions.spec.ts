import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { Position } from '../../../../core/models/position.model';
import { PositionEdit, Positions } from './positions';

const POSITIONS: Position[] = [
  { id: 1, name: 'Technician', isActive: true, employeeCount: 2 },
  { id: 4, name: 'Sales', isActive: true, employeeCount: 0 },
  { id: 12, name: 'Installer', isActive: false, employeeCount: 1 },
];

describe('Positions', () => {
  let component: Positions;
  let fixture: ComponentFixture<Positions>;
  let added: { name: string }[];
  let edited: PositionEdit[];
  let removed: Position[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Positions],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Positions);
    component = fixture.componentInstance;

    added = [];
    edited = [];
    removed = [];
    component.add.subscribe((p) => added.push(p));
    component.edit.subscribe((p) => edited.push(p));
    component.remove.subscribe((p) => removed.push(p));

    fixture.componentRef.setInput('positions', POSITIONS);
    fixture.componentRef.setInput('activeCount', 2);
    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 3, totalPages: 1 });
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const buttonIn = (row: Element, label: string) =>
    Array.from(row.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;

  it('should list every position with its headcount and status', () => {
    expect(rows()).toHaveLength(3);
    expect(rows()[0].textContent).toContain('Technician');
    expect(rows()[0].textContent).toContain('In use');
    expect(rows()[2].textContent).toContain('Installer');
    expect(rows()[2].textContent).toContain('Retired');
    expect(el().textContent).toContain('2 of 3 in use');
  });

  it('should show the pager only when there is more than one page, and bubble its clicks', async () => {
    const pages: number[] = [];
    component.pageChange.subscribe((p) => pages.push(p));

    expect(el().querySelector('app-pagination nav')).toBeNull();

    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 23, totalPages: 3 });
    await fixture.whenStable();

    el().querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expect(pages).toEqual([2]);
  });

  it('should not emit an empty or too-short new name', () => {
    component.addForm.setValue({ name: 'A' });
    component.onAdd();

    expect(added).toHaveLength(0);
    expect(component.addForm.controls.name.touched).toBe(true);
  });

  it('should emit a trimmed new position', () => {
    component.addForm.setValue({ name: '  Warehouse keeper  ' });
    component.onAdd();

    expect(added).toEqual([{ name: 'Warehouse keeper' }]);
  });

  it('should disable Delete while people still hold the position', () => {
    // Technician: 2 people. Sales: nobody.
    expect(buttonIn(rows()[0], 'Delete').disabled).toBe(true);
    expect(buttonIn(rows()[1], 'Delete').disabled).toBe(false);
  });

  it('should emit a rename only when the name actually changed', async () => {
    component.startRename(POSITIONS[0]);
    await fixture.whenStable();
    expect(component.renaming()).toBe(1);

    component.submitRename(POSITIONS[0]);
    expect(edited).toHaveLength(0);
    expect(component.renaming()).toBeNull();

    component.startRename(POSITIONS[0]);
    component.renameForm.setValue({ name: 'Field technician' });
    component.submitRename(POSITIONS[0]);

    expect(edited).toEqual([{ id: 1, changes: { name: 'Field technician' } }]);
  });

  it('should toggle a position between retired and in use', () => {
    component.toggleActive(POSITIONS[0]);
    component.toggleActive(POSITIONS[2]);

    expect(edited).toEqual([
      { id: 1, changes: { isActive: false } },
      { id: 12, changes: { isActive: true } },
    ]);
  });

  it('should label the retired row Restore rather than Retire', () => {
    expect(buttonIn(rows()[0], 'Retire')).toBeTruthy();
    expect(buttonIn(rows()[2], 'Restore')).toBeTruthy();
  });

  it('should clear the add field on resetAdd', () => {
    component.addForm.setValue({ name: 'Warehouse' });
    component.resetAdd();

    expect(component.addForm.controls.name.value).toBe('');
  });
});
