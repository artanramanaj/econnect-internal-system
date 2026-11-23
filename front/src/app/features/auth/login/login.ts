import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoginRequest } from '../../../core/models/user.model';
import { BrandPanel } from '../../../shared/components/brand-panel/brand-panel';
import { LanguageSwitcher } from '../../../shared/components/language-switcher/language-switcher';
import { SignInForm } from './sign-in-form/sign-in-form';

/** Chip copy for the brand panel, as translation keys. */
const CAPABILITY_KEYS = [
  'brand.capabilities.cctv',
  'brand.capabilities.accessControl',
  'brand.capabilities.fireAlarm',
  'brand.capabilities.intrusion',
  'brand.capabilities.barrier',
  'brand.capabilities.it',
  'brand.capabilities.lowVoltage',
];

@Component({
  selector: 'app-login',
  imports: [BrandPanel, SignInForm, LanguageSwitcher, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toasts = inject(ToastService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Translated chips. Reads the language signal so a switch re-renders them. */
  readonly capabilities = computed(() => {
    this.language.current();
    return CAPABILITY_KEYS.map((key) => this.translate.instant(key) as string);
  });

  onSubmit(credentials: LoginRequest) {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login(credentials)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          void this.router.navigate(['/dashboard']);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? this.translate.instant('login.failed'));
        },
      });
  }
}
