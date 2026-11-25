import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PermissionMatrix } from '../../../../core/models/people.model';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

@Component({
  selector: 'app-groups-permissions',
  imports: [TranslatePipe, RoleNamePipe],
  templateUrl: './groups-permissions.html',
  styleUrls: ['../../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of <main>.
  host: { class: 'contents' },
})
export class GroupsPermissions {
  /** Null until /api/roles/matrix resolves. */
  readonly matrix = input<PermissionMatrix | null>(null);
}
