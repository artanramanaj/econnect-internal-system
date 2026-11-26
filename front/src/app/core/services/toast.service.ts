import { Injectable, signal } from '@angular/core';
import { ToastMessage } from '../../shared/components/toast/toast';

/**
 * Holds the toast to show next. The root App binds `current` to <app-toast>;
 * pages call `success(res.message)` and carry on — no page owns a banner.
 *
 * Each call creates a new object, so repeating the same text still fires.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _current = signal<ToastMessage | null>(null);

  readonly current = this._current.asReadonly();

  success(text: string): void {
    this._current.set({ text, type: 'success' });
  }

  error(text: string): void {
    this._current.set({ text, type: 'error' });
  }

  /** Done, but with something to look at (a quote saved below the minimum markup). */
  warning(text: string): void {
    this._current.set({ text, type: 'warning' });
  }
}
