import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Person, UpdatePersonRequest } from '../../../../core/models/people.model';
import { SelectablePosition } from '../../../../core/models/position.model';
import { Role, UserStatus } from '../../../../core/models/user.model';
import { LanguageService } from '../../../../core/services/language.service';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

/** A row of the position select. `retired` marks the one not on the selectable list. */
interface PositionOption {
  id: number;
  name: string;
  retired?: boolean;
}

@Component({
  selector: 'app-user-edit-drawer',
  imports: [ReactiveFormsModule, TranslatePipe, RoleNamePipe],
  templateUrl: './user-edit-drawer.html',
  styleUrls: ['../type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // overlay keeps its own fixed positioning.
  host: { class: 'contents' },
})
export class UserEditDrawer {
  readonly person = input.required<Person>();

  readonly canViewCost = input(false);

  readonly saving = input(false);

  /** Whether the row being edited is the signed-in user's own account. */
  readonly isSelf = input(false);

  /** Options for the group select; the parent prepends the current group. */
  readonly roleOptions = input<Role[]>([]);

  /** Active positions. This person's own may be retired — see positionOptions. */
  readonly positions = input<SelectablePosition[]>([]);

  readonly close = output<void>();
  readonly save = output<UpdatePersonRequest>();
  readonly roleChange = output<string>();
  readonly statusChange = output<UserStatus>();
  readonly deactivate = output<void>();

  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly confirmingDelete = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    positionId: [''],
    phone: [''],
    hourlyCost: [''],
    isFieldStaff: [false],
  });

  constructor() {
    // Refills whenever the parent opens the drawer on a different row, or
    // swaps in a fresh copy after a save.
    effect(() => {
      const p = this.person();
      this.confirmingDelete.set(false);
      this.form.reset({
        firstName: p.firstName,
        lastName: p.lastName,
        positionId: p.positionId === null ? '' : String(p.positionId),
        phone: p.phone ?? '',
        hourlyCost: p.hourlyCost ?? '',
        isFieldStaff: p.isFieldStaff,
      });
    });
  }

  /**
   * Active positions, plus this person's own even when it has been retired.
   * Without that, opening a retired employee would show the wrong title
   * selected and saving would silently reassign them.
   */
  readonly positionOptions = computed<PositionOption[]>(() => {
    const active = this.positions();
    const { positionId, position } = this.person();
    if (positionId === null || active.some((p) => p.id === positionId)) return active;

    // Not on the selectable list, so it has been retired. The person row
    // carries its id and name, which is all the option needs. The language
    // signal is read so the fallback label follows a switch.
    this.language.current();
    const fallback = this.translate.instant('users.drawer.positionFallback', {
      id: positionId,
    }) as string;
    return [{ id: positionId, name: position ?? fallback, retired: true }, ...active];
  });

  onRoleChange(event: Event): void {
    const roleCode = (event.target as HTMLSelectElement).value;
    if (roleCode !== this.person().roleCode) this.roleChange.emit(roleCode);
  }

  onStatusChange(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as UserStatus;
    if (status !== this.person().status) this.statusChange.emit(status);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.save.emit({
      firstName: v.firstName,
      lastName: v.lastName,
      positionId: v.positionId === '' ? null : Number(v.positionId),
      phone: v.phone || null,
      isFieldStaff: v.isFieldStaff,
      ...(v.hourlyCost !== '' ? { hourlyCost: Number(v.hourlyCost) } : {}),
    });
  }
}
