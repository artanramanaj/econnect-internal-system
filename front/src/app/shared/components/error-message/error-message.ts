import { Component, input } from '@angular/core';

/**
 * `inline` — a short hint under a single form field.
 * `banner` — the boxed alert above a form or page, e.g. a failed request.
 */
export type ErrorMessageVariant = 'inline' | 'banner';

@Component({
  selector: 'app-error-message',
  templateUrl: './error-message.html',
  // `contents` keeps the host out of the layout box model, so the inner element
  // stays a direct flex child and the caller's `gap` spacing still applies.
  host: { class: 'contents' },
})
export class ErrorMessage {
  readonly message = input.required<string>();

  readonly variant = input<ErrorMessageVariant>('inline');

  /**
   * Extra lines listed under a banner's message, such as per-field issues
   * returned by the API. Plain strings, so this component stays unaware of the
   * API's error shape. Ignored by the inline variant.
   */
  readonly details = input<readonly string[]>([]);
}
