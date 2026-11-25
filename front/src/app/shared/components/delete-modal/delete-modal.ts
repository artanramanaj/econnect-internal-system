import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Gives each modal its own ids for aria-labelledby / aria-describedby. */
let nextId = 0;

/**
 * Asks before something is deleted, in place of the browser's `confirm()`.
 *
 * The parent decides when it shows — render it inside an `@if` — and what
 * happens next: `confirm` means go ahead, `cancel` means leave it be. The ✕,
 * the backdrop and Escape all count as cancel. Heading and message arrive
 * already translated, so any screen can word its own question.
 */
@Component({
  selector: 'app-delete-modal',
  imports: [TranslatePipe],
  templateUrl: './delete-modal.html',
  host: {
    // `contents` keeps the host out of the layout box model, so the inner
    // overlay keeps its own fixed positioning.
    class: 'contents',
    '(document:keydown.escape)': 'cancel.emit()',
  },
})
export class DeleteModal {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  protected readonly headingId = `delete-modal-heading-${nextId}`;
  protected readonly messageId = `delete-modal-message-${nextId++}`;

  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    // Start on Cancel, so a stray Enter cannot delete anything; on close,
    // hand focus back to whatever opened the modal.
    const opener = inject(DOCUMENT).activeElement as HTMLElement | null;
    afterNextRender(() => this.cancelButton().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => opener?.focus());
  }
}
