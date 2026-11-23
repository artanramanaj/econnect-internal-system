import { Component, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SelectablePosition } from '../../../core/models/position.model';
import { ApiError, FieldIssue, RegisterRequest, Role } from '../../../core/models/user.model';
import { BrandPanel } from '../../../shared/components/brand-panel/brand-panel';
import { LanguageSwitcher } from '../../../shared/components/language-switcher/language-switcher';
import { RegisterForm } from './register-form/register-form';

@Component({
  selector: 'app-register',
  imports: [BrandPanel, RegisterForm, LanguageSwitcher, TranslatePipe],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private authService = inject(AuthService);
  private toasts = inject(ToastService);
  private translate = inject(TranslateService);

  private registerForm = viewChild.required(RegisterForm);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  fieldIssues = signal<FieldIssue[]>([]);
  roles = signal<Role[]>([]);
  positions = signal<SelectablePosition[]>([]);

  /**
   * Steps shown in the brand panel, as translation keys the template renders.
   * The first one is the current step.
   */
  readonly steps = [
    { title: 'register.steps.send.title', detail: 'register.steps.send.detail' },
    { title: 'register.steps.review.title', detail: 'register.steps.review.detail' },
    { title: 'register.steps.activation.title', detail: 'register.steps.activation.detail' },
  ];

  constructor() {
    this.authService.getRequestableRoles().subscribe({
      next: (res) => this.roles.set(res.roles),
      error: () => this.errorMessage.set(this.translate.instant('register.loadGroupsFailed')),
    });

    this.authService.getSelectablePositions().subscribe({
      next: (res) => this.positions.set(res.positions),
      error: () => this.errorMessage.set(this.translate.instant('register.loadPositionsFailed')),
    });
  }

  onSubmit(details: RegisterRequest) {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.fieldIssues.set([]);

    this.authService
      .register(details)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.registerForm().reset();
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiError | undefined;
          this.errorMessage.set(body?.message ?? this.translate.instant('register.failed'));
          this.fieldIssues.set(body?.issues ?? []);
        },
      });
  }
}
