import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand-panel',
  imports: [RouterLink],
  templateUrl: './brand-panel.html',
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct flex child of the auth page wrapper.
  host: { class: 'contents' },
})
export class BrandPanel {
  /** Small uppercase line above the heading. */
  readonly eyebrow = input('');

  readonly heading = input.required<string>();

  readonly description = input('');

  /** Label above the chip list, e.g. "What we deliver". */
  readonly chipsLabel = input('');

  readonly chips = input<string[]>([]);

  readonly footnote = input('');

  /** Decorative network graphic behind the copy. */
  readonly showGraphic = input(false);

  /** Wraps the logo in a routerLink when set. */
  readonly logoLink = input<string | null>(null);

  /**
   * Flex basis, padding and gap for the section. The component owns only the
   * brand look — spacing stays with the caller, because Tailwind resolves
   * conflicting utilities (`p-12` vs `px-14`) by stylesheet order, not by the
   * order they appear in the class attribute.
   */
  readonly extraClasses = input('');

  protected readonly classes = computed(() =>
    `relative overflow-hidden bg-dark-blue text-white flex flex-col ${this.extraClasses()}`.trim(),
  );
}
