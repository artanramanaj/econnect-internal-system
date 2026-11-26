import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { NavLink } from '../../shared/components/nav-link/nav-link';
import { RoleNamePipe } from '../../shared/pipes/role-name.pipe';

@Component({
  imports: [NavLink, LanguageSwitcher, TranslatePipe, RoleNamePipe],
  selector: 'app-sidebar',
  styleUrl: './sidebar.css',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toasts = inject(ToastService);

  readonly displayName = this.authService.displayName;
  readonly currentUser = this.authService.currentUser;

  /**
   * Hides the link from people the route guard would bounce anyway.
   * hasPermission reads the permissions signal, so this recomputes by itself
   * once /api/auth/me resolves the session.
   */
  readonly canManageUsers = computed(
    () =>
      this.authService.hasPermission('admin.users') ||
      this.authService.hasPermission('admin.users.non_admin'),
  );

  /** Same reasoning: the products route is guarded by these two codes. */
  readonly canViewCatalog = computed(
    () =>
      this.authService.hasPermission('catalog.view') ||
      this.authService.hasPermission('catalog.manage'),
  );

  /** The quotes routes are guarded by these three codes. */
  readonly canViewQuotes = computed(
    () =>
      this.authService.hasPermission('quote.manage') ||
      this.authService.hasPermission('quote.accept') ||
      this.authService.hasPermission('quote.approve'),
  );

  /** "New quote" only for people who may create one. */
  readonly canWriteQuotes = computed(() => this.authService.hasPermission('quote.manage'));

  logout() {
    this.authService.logout().subscribe({
      // Navigate either way — a failed logout still clears the client session.
      next: (res) => {
        this.toasts.success(res.message);
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.authService.clear();
        void this.router.navigate(['/login']);
      },
    });
  }
}
