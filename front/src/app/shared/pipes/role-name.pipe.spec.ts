import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { RoleNamePipe } from './role-name.pipe';

type RoleInput = string | string[] | { code: string; name: string } | null;

@Component({
  imports: [RoleNamePipe],
  template: `<span>{{ role() | roleName }}</span>`,
})
class HostComponent {
  // A signal, not a plain field: the app is zoneless.
  readonly role = signal<RoleInput>('technician');
}

describe('RoleNamePipe', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.trim();

  it('should translate a known group code', () => {
    expect(text()).toBe('Technician');
  });

  it('should prefer the translation over the name the server sent', async () => {
    host.role.set({ code: 'project_manager', name: 'Project Manager' });
    await fixture.whenStable();

    expect(text()).toBe('Project manager');
  });

  it('should fall back to the server name for a code the files do not know', async () => {
    host.role.set({ code: 'auditor', name: 'Auditor' });
    await fixture.whenStable();

    expect(text()).toBe('Auditor');
  });

  it('should join a list of codes', async () => {
    host.role.set(['admin', 'technician']);
    await fixture.whenStable();

    expect(text()).toBe('Admin, Technician');
  });

  it('should render a dash for no group', async () => {
    host.role.set(null);
    await fixture.whenStable();

    expect(text()).toBe('—');
  });
});
