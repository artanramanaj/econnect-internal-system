# eConnect — frontend

Angular 22, standalone components, zoneless. Tailwind v4; theme tokens live in the
`@theme` block in `src/styles.css`. Run tests with `ng test` (Vitest via
`@angular/build:unit-test`) — not `vitest` directly, which misses the globals setup
and fails every spec with `describe is not defined`.

## Folder conventions

- `core/` — app-wide singletons: guards, interceptors, services, models.
- `features/` — one folder per routed screen (`features/projects/`). Nest only when a
  feature has real siblings (`features/auth/login`, `features/auth/register`).
- `layouts/` — chrome assembled around `<router-outlet>`: `main-layout/`, `sidebar/`.
- `shared/` — reusable, app-agnostic UI. Nothing here may inject `AuthService` or
  hardcode a route name; if it does, it belongs in `layouts/` or `features/`.

A screen's own child components live in folders beside its files
(`features/auth/login/sign-in-form/`), so the whole screen reads as one unit. The
moment a second screen imports one, it moves to `shared/components/` — that is why
`brand-panel/` sits there and `sign-in-form/` does not.

Routes are declared in `src/app/app.routes.ts`, all lazy via `loadComponent`. Adding a
screen means a folder in `features/` plus a child route there — a sidebar link alone
does nothing.

## Naming

Modern CLI style: `sidebar.ts` exporting `class Sidebar`, not `sidebar.component.ts`.
Services keep the suffix (`auth.service.ts` → `AuthService`). Selector prefix `app-`.
Signal inputs (`input()`, `input.required()`), not `@Input()`. Control flow is `@if` /
`@for`, not `*ngIf` / `*ngFor`.

## i18n — Albanian (`sq`, default) and English (`en`)

The UI is bilingual and switches at runtime (ngx-translate). **Never hardcode
user-facing text** in a template or a TS file; every new string is a key added to
**both** `public/i18n/en.json` and `public/i18n/sq.json` (same key set — the pair is
compared by hand, so add to both in the same change). Keys are namespaced dot paths:
`fields.*` for form labels shared across screens, `common.*` for buttons, then one
namespace per screen (`login.*`, `users.table.*`, …).

- Templates: `{{ 'users.table.heading' | translate }}`; attributes as bindings,
  `[placeholder]="'login.usernamePlaceholder' | translate"`; params as
  `'users.requests.groupFor' | translate: { username }`. Import `TranslatePipe` in the
  component's `imports`.
- TS: `inject(TranslateService).instant('register.failed')`. A list built in TS (chips,
  steps, rules) holds keys and the template translates them; if it must hold text, read
  `LanguageService.current()` inside the `computed` so a switch recomputes it.
- Group names: `{{ role | roleName }}` (`shared/pipes/role-name.pipe.ts`), never
  `role.name` directly — the server sends English names, the pipe renders `roles.<code>`.
- Dates and numbers: pass `LanguageService.locale()` to `toLocaleDateString` and co.
- `LanguageService` (`core/services/`) owns the choice: localStorage, the account's
  `locale` (PATCH `/api/auth/me/locale`), `<html lang>`, and — through
  `core/interceptors/language.interceptor.ts` — the `Accept-Language` header on every
  `/api` call. API messages therefore arrive already translated: show `res.message`
  and `issues[].message` as they are. The switcher is
  `shared/components/language-switcher`.
- Data the server returns as translation keys (the permission matrix rows) is rendered
  with the pipe on the client, so a switch never needs a refetch.

## Testing

Specs are zoneless: mutating a plain field will not re-render. When a spec rebinds an
input, put signals on the host component — see
`src/app/shared/components/nav-link/nav-link.spec.ts`.

Specs that render `routerLink` need `provideRouter([])`. Anything that reaches
`AuthService` also needs `provideHttpClient()` + `provideHttpClientTesting()`, because
the service calls `inject(HttpClient)` in a field initializer — so the provider is
required at construction, not just when a request fires. `LanguageService` injects
`AuthService`, so the same applies to anything that reads the language (the switcher,
the user table, the edit drawer).

Any component whose template uses the `translate` or `roleName` pipe needs
`provideTranslateTesting()` from `src/app/core/i18n/translate.testing.ts` in its
providers. It serves the real `public/i18n/en.json` synchronously, so assert on the
English text.
