import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Role, User } from '../../../../core/models/user.model';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

@Component({
  selector: 'app-access-request',
  imports: [TranslatePipe, RoleNamePipe],
  templateUrl: './access-request.html',
  styleUrls: ['../type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of <main>.
  host: { class: 'contents' },
})
export class AccessRequest {
  /** Accounts awaiting approval. */
  readonly requests = input<User[]>([]);

  /** Groups this actor may hand out — the options in each card's select. */
  readonly grantableRoles = input<Role[]>([]);

  /** Every group, used to resolve a code to its display name. */
  readonly roles = input<Role[]>([]);

  /** Group picked in each card, keyed by user id. */
  readonly selectedRoles = input<Record<number, string>>({});

  readonly saving = input(false);

  readonly roleChange = output<{ userId: number; roleCode: string }>();
  readonly approve = output<User>();
  readonly reject = output<User>();

  onRoleChange(userId: number, event: Event): void {
    this.roleChange.emit({ userId, roleCode: (event.target as HTMLSelectElement).value });
  }

  roleName(code: string | null): string {
    if (!code) return '—';
    return this.roles().find((r) => r.code === code)?.name ?? code;
  }
}
