import { Component, effect, inject, input, untracked } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  text: string;
  type: ToastType;
}

/**
 * Fires a toast whenever `message` is set to a new object with non-empty text.
 *
 * Renders nothing where it is placed — the toast itself is drawn in the
 * library's overlay on <body>, which outlives any routed page. Mounted once in
 * the root App and driven by ToastService, so a toast fired just before a
 * navigation still shows. Identity, not text, is what the effect watches: pass
 * a fresh object to show the same words twice in a row.
 */
@Component({
  selector: 'app-toast',
  template: '',
  // `hidden`, so the empty host never takes a slot in a parent's flex `gap`.
  host: { class: 'hidden' },
})
export class Toast {
  readonly message = input<ToastMessage | null>(null);

  private readonly toast = inject(HotToastService);

  constructor() {
    effect(() => {
      const message = this.message();
      if (!message?.text) return;

      untracked(() => this.toast[message.type](message.text));
    });
  }
}
