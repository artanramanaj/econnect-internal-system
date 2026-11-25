import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreatePersonRequest } from '../../../../core/models/people.model';
import { SelectablePosition } from '../../../../core/models/position.model';
import { TranslatePipe } from '@ngx-translate/core';
import { Role } from '../../../../core/models/user.model';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

@Component({
  selector: 'app-add-employee',
  imports: [ReactiveFormsModule, ErrorMessage, TranslatePipe, RoleNamePipe],
  templateUrl: './add-employee.html',
  styleUrls: ['../../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of the page's row.
  host: { class: 'contents' },
})
export class AddEmployee {
  /** Groups this actor may hand out. */
  readonly grantableRoles = input<Role[]>([]);

  /** Active positions only — a retired title is not offered to a new hire. */
  readonly positions = input<SelectablePosition[]>([]);

  readonly saving = input(false);

  readonly submitted = output<CreatePersonRequest>();

  private fb = inject(FormBuilder);

  /**
   * Flat, and mirroring the register form field for field: everyone added here
   * gets an account, so there is no optional login block to enable and disable.
   * `onSubmit` nests the account fields back into the `login` object the API
   * expects.
   */
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    positionId: ['', Validators.required],
    roleCode: ['', Validators.required],
    // Same policy as register: length only.
    password: ['', [Validators.required, Validators.minLength(8)]],
    hourlyCost: [''],
  });

  readonly showPassword = signal(false);

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  /** Kept in a signal so the derived tile updates without zone change detection. */
  private readonly hourlyInput = signal('');

  readonly dailyPreview = computed(() => {
    const hourly = Number(this.hourlyInput());
    return Number.isFinite(hourly) && hourly > 0 ? (hourly * 8).toFixed(2) : '0.00';
  });

  constructor() {
    // The parent fetches the groups; the control's default belongs to the form.
    effect(() => {
      const first = this.grantableRoles()[0];
      if (first && !this.form.controls.roleCode.value) {
        this.form.controls.roleCode.setValue(first.code);
      }
    });

    // Same idea for positions: both lists arrive from the parent after a fetch.
    effect(() => {
      const first = this.positions()[0];
      if (first && !this.form.controls.positionId.value) {
        this.form.controls.positionId.setValue(String(first.id));
      }
    });

    this.form.controls.hourlyCost.valueChanges.subscribe((v) => this.hourlyInput.set(v));
  }

  /** Called by the parent once the backend accepted the person. */
  reset(): void {
    this.form.reset({
      // Re-seeded rather than blanked, so the selects are never empty after a save.
      positionId: String(this.positions()[0]?.id ?? ''),
      roleCode: this.grantableRoles()[0]?.code ?? '',
    });
    this.hourlyInput.set('');
    // Re-mask so the next hire's password isn't shown in clear by default.
    this.showPassword.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.submitted.emit({
      firstName: v.firstName,
      lastName: v.lastName,
      ...(v.positionId ? { positionId: Number(v.positionId) } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.hourlyCost !== '' ? { hourlyCost: Number(v.hourlyCost) } : {}),
      login: {
        username: v.username,
        email: v.email,
        password: v.password,
        roleCode: v.roleCode,
      },
    });
  }
}
