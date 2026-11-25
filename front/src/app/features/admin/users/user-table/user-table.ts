import { Component, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY_PAGE, PageMeta } from '../../../../core/models/pagination.model';
import { Person } from '../../../../core/models/people.model';
import { Role } from '../../../../core/models/user.model';
import { LanguageService } from '../../../../core/services/language.service';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

/** Group chip colours, straight from the design. */
const CHIP_CLASSES: Record<string, string> = {
  super_admin: 'bg-grp-super-bg text-grp-super-fg',
  admin: 'bg-grp-admin-bg text-grp-admin-fg',
  project_manager: 'bg-grp-pm-bg text-grp-pm-fg',
  user: 'bg-grp-user-bg text-grp-user-fg',
  team_leader: 'bg-grp-tl-bg text-grp-tl-fg',
  technician: 'bg-grp-tech-bg text-grp-tech-fg',
};

@Component({
  selector: 'app-user-table',
  imports: [Pagination, TranslatePipe, RoleNamePipe],
  templateUrl: './user-table.html',
  styleUrls: ['../../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of the page's row.
  host: { class: 'contents' },
})
export class UserTable {
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  /** One page of the roster; `meta` says which and how many there are. */
  readonly people = input<Person[]>([]);

  readonly meta = input<PageMeta>(EMPTY_PAGE);

  /** Options for the group filter. */
  readonly roles = input<Role[]>([]);

  readonly canViewCost = input(false);

  readonly loading = input(false);

  /** employeeIds the signed-in user may edit; the parent works these out. */
  readonly manageableIds = input<Set<number>>(new Set<number>());

  readonly search = output<string>();
  readonly groupFilterChange = output<string>();
  readonly edit = output<Person>();
  readonly pageChange = output<number>();

  onSearch(event: Event): void {
    this.search.emit((event.target as HTMLInputElement).value.trim());
  }

  onGroupFilter(event: Event): void {
    this.groupFilterChange.emit((event.target as HTMLSelectElement).value);
  }

  chipClass(roleCode: string | null): string {
    return roleCode ? (CHIP_CLASSES[roleCode] ?? 'bg-gray text-muted-strong') : '';
  }

  /**
   * The Login column carries account state, as the design's does. Called from
   * the template, so it is re-evaluated — in the new language — on a switch.
   */
  loginLabel(person: Person): string {
    const t = (key: string, params?: object) => this.translate.instant(key, params) as string;

    if (!person.userId) return t('users.table.noLogin');
    if (person.status === 'PENDING') return t('users.table.awaitingApproval');
    if (person.status === 'SUSPENDED') return t('users.table.deactivated');
    if (!person.lastLoginAt) return t('users.table.neverSignedIn');

    const locale = this.language.locale();
    const when = new Date(person.lastLoginAt);
    const today = new Date();
    const sameDay = when.toDateString() === today.toDateString();
    const time = when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    if (sameDay) return t('users.table.today', { time });

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (when.toDateString() === yesterday.toDateString()) return t('users.table.yesterday');

    return when.toLocaleDateString(locale);
  }

  loginMuted(person: Person): boolean {
    return !person.userId || person.status !== 'ACTIVE';
  }
}
