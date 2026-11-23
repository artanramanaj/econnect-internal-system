import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LoginRequest } from '../../../../core/models/user.model';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';

@Component({
  selector: 'app-sign-in-form',
  imports: [ReactiveFormsModule, RouterLink, ErrorMessage, TranslatePipe],
  templateUrl: './sign-in-form.html',
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of the auth page wrapper.
  host: { class: 'contents' },
})
export class SignInForm {
  /** Drives the submit button's disabled state and label. */
  readonly loading = input(false);

  /** Rendered in the banner above the fields when set. */
  readonly errorMessage = input<string | null>(null);

  /** Emitted with the credentials once the form passes validation. */
  readonly submitted = output<LoginRequest>();

  private fb = inject(FormBuilder);

  readonly showPassword = signal(false);

  // Length only, mirroring the register policy. The server checks the hash, not
  // the policy — this is here to save a pointless round trip.
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
