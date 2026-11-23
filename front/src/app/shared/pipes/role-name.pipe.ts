import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Anything that names a group: a code, a list of codes, or a `{ code, name }` row. */
type RoleLike = string | string[] | { code: string; name?: string } | null | undefined;

/**
 * Group names come from the API in English (`Role.name`). This renders them
 * from the `roles.<code>` keys instead, so they follow the UI language, and
 * falls back to the server's name for a code the files do not know.
 *
 * Impure on purpose: a pure pipe would not re-run on a language switch.
 */
@Pipe({ name: 'roleName', pure: false })
export class RoleNamePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(role: RoleLike, separator = ', '): string {
    if (role === null || role === undefined) return '—';
    if (Array.isArray(role)) return role.map((code) => this.one(code)).join(separator);
    return typeof role === 'string' ? this.one(role) : this.one(role.code, role.name);
  }

  private one(code: string, fallback = code): string {
    const key = `roles.${code}`;
    const text = this.translate.instant(key) as string;
    return text === key ? fallback : text;
  }
}
