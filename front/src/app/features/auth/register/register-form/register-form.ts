import { Component, computed, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectablePosition } from '../../../../core/models/position.model';
import { FieldIssue, RegisterRequest, Role } from '../../../../core/models/user.model';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { RoleNamePipe } from '../../../../shared/pipes/role-name.pipe';

/** Group-level validator: password and confirmation must match. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value ?? '';
  const confirm = group.get('confirmPassword')?.value ?? '';
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule, RouterLink, ErrorMessage, TranslatePipe, RoleNamePipe],
  templateUrl: './register-form.html',
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of the auth page wrapper.
  host: { class: 'contents' },
})
export class RegisterForm {
  /** Drives the submit button's disabled state and label. */
  readonly loading = input(false);

  /** Rendered in the red banner above the fields when set. */
  readonly errorMessage = input<string | null>(null);

  /** Per-field problems listed under the error banner. */
  readonly fieldIssues = input<FieldIssue[]>([]);

  /** Lines for the error banner's list. */
  protected readonly issueMessages = computed(() => this.fieldIssues().map((i) => i.message));

  /** Options for the requested user group select. */
  readonly roles = input<Role[]>([]);

  /** Job titles, loaded from the API — they are maintained on the Users screen. */
  readonly positions = input<SelectablePosition[]>([]);

  /** Emitted with the details once the form passes validation. */
  readonly submitted = output<RegisterRequest>();

  private fb = inject(FormBuilder);

  // SVG path drawn for a satisfied / unsatisfied password rule.
  readonly ruleOkIcon = 'M5 12l5 5L20 7';
  readonly ruleTodoIcon = 'M12 8v8M8 12h8';

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      positionId: ['', Validators.required],
      requestedRoleCode: ['', Validators.required],
      // Policy mirrors the backend registerSchema: length only.
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    // The parent fetches the groups; the control's default belongs to the form.
    effect(() => {
      const first = this.roles()[0];
      if (first && !this.form.controls.requestedRoleCode.value) {
        this.form.controls.requestedRoleCode.setValue(first.code);
      }
    });

    effect(() => {
      const first = this.positions()[0];
      if (first && !this.form.controls.positionId.value) {
        this.form.controls.positionId.setValue(String(first.id));
      }
    });
  }

  private get pw(): string {
    return this.form.controls.password.value;
  }

  get ruleLength(): boolean {
    return this.pw.length >= 8;
  }

  get ruleMatch(): boolean {
    const confirm = this.form.controls.confirmPassword.value;
    return this.pw.length > 0 && this.pw === confirm;
  }

  /** Re-read on each change detection pass, like the getters they wrap. `label` is a translation key. */
  get passwordRules(): { label: string; ok: boolean }[] {
    return [
      { label: 'register.rules.length', ok: this.ruleLength },
      { label: 'register.rules.match', ok: this.ruleMatch },
    ];
  }

  /** Called by the parent once the backend accepted the request. */
  reset() {
    this.form.reset({
      positionId: String(this.positions()[0]?.id ?? ''),
      requestedRoleCode: '',
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.submitted.emit({ ...v, positionId: Number(v.positionId) });
  }
}
