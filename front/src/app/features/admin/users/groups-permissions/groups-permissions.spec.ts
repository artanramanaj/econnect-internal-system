import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { PermissionMatrix } from '../../../../core/models/people.model';
import { GroupsPermissions } from './groups-permissions';

const MATRIX: PermissionMatrix = {
  groups: [
    { id: 1, code: 'admin', name: 'Admin' },
    { id: 2, code: 'technician', name: 'Technician' },
  ],
  rows: [
    {
      label: 'Manage users',
      area: 'Administration',
      cells: [{ kind: 'yes' }, { kind: 'no' }],
    },
    {
      label: 'View costs',
      area: 'Projects',
      cells: [{ kind: 'yes' }, { kind: 'text', text: 'Own only' }],
    },
  ],
};

describe('GroupsPermissions', () => {
  let fixture: ComponentFixture<GroupsPermissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsPermissions],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupsPermissions);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should show a loading note until the matrix arrives', () => {
    expect(el().textContent).toContain('Loading permissions…');
    expect(el().querySelector('table')).toBeNull();
  });

  it('should render a column per group and a row per permission', async () => {
    fixture.componentRef.setInput('matrix', MATRIX);
    await fixture.whenStable();

    // One header cell for the label column, plus one per group.
    expect(el().querySelectorAll('thead th')).toHaveLength(3);
    expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el().textContent).toContain('Manage users');
    expect(el().textContent).toContain('Administration');
  });

  it('should draw each cell kind in its own way', async () => {
    fixture.componentRef.setInput('matrix', MATRIX);
    await fixture.whenStable();

    expect(el().querySelectorAll('svg[aria-label="Yes"]')).toHaveLength(2);
    expect(el().querySelectorAll('[aria-label="No"]')).toHaveLength(1);
    expect(el().textContent).toContain('Own only');
  });
});
