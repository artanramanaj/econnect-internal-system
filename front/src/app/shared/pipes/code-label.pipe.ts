import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Data the API identifies by a code — a unit (`pcs`), a VAT rate
 * (`STANDARD`) — rendered from the `<namespace>.<code>` key, so it follows the
 * UI language:
 *
 *   {{ unit.code | codeLabel: 'units' : unit.name }}
 *
 * A code the files do not know (one the ProData sync brought in) falls back
 * to the name the server stored, then to the code itself.
 *
 * Impure on purpose: a pure pipe would not re-run on a language switch.
 */
@Pipe({ name: 'codeLabel', pure: false })
export class CodeLabelPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(code: string | null | undefined, namespace: string, fallback?: string | null): string {
    if (!code) return '—';
    const key = `${namespace}.${code}`;
    const text = this.translate.instant(key) as string;
    return text === key ? fallback || code : text;
  }
}
