import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'products',
        canActivate: [permissionGuard('catalog.view', 'catalog.manage')],
        loadComponent: () => import('./features/products/products').then((m) => m.Products),
      },
      {
        path: 'quotes',
        canActivate: [permissionGuard('quote.manage', 'quote.accept', 'quote.approve')],
        loadComponent: () => import('./features/quotes/quotes').then((m) => m.Quotes),
      },
      {
        // Declared before 'quotes/:id', which would otherwise take "new" for an id.
        path: 'quotes/new',
        canActivate: [permissionGuard('quote.manage')],
        loadComponent: () =>
          import('./features/quotes/quote-editor/quote-editor').then((m) => m.QuoteEditor),
      },
      {
        path: 'quotes/:id',
        canActivate: [permissionGuard('quote.manage', 'quote.accept', 'quote.approve')],
        loadComponent: () =>
          import('./features/quotes/quote-editor/quote-editor').then((m) => m.QuoteEditor),
      },
      {
        path: 'team-allocations',
        loadComponent: () =>
          import('./features/team-allocations/team-allocations').then((m) => m.TeamAllocations),
      },
      {
        path: 'daily-cost-engine',
        loadComponent: () =>
          import('./features/daily-cost-engine/daily-cost-engine').then((m) => m.DailyCostEngine),
      },
      {
        path: 'bom',
        loadComponent: () =>
          import('./features/bill-of-materials/bill-of-materials').then((m) => m.BillOfMaterials),
      },
      {
        path: 'quote-reconciler',
        loadComponent: () =>
          import('./features/quote-reconciler/quote-reconciler').then((m) => m.QuoteReconciler),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/system-settings/system-settings').then((m) => m.SystemSettings),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('admin.users', 'admin.users.non_admin')],
        loadComponent: () => import('./features/admin/users/users').then((m) => m.Users),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
