import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-nav-link',
  templateUrl: './nav-link.html',
  // `contents` keeps the host out of the layout box model, so the inner <a>
  // stays a direct flex child of the parent <nav class="flex flex-col gap-1">.
  host: { class: 'contents' },
})
export class NavLink {
  /** Accepts a string path or a router commands array. */
  readonly link = input.required<string | unknown[]>();

  /** Appended to the base look for one-off variants. */
  readonly extraClasses = input('');

  /** Classes applied while the route is active. */
  readonly activeClasses = input('bg-primary text-white');

  /** Match the full URL instead of a prefix — for links like "/". */
  readonly exact = input(false);

  protected readonly classes = computed(() =>
    `px-4 py-3 rounded-lg text-sm font-medium hover:bg-white/10 transition ${this.extraClasses()}`.trim(),
  );

  protected readonly activeOptions = computed(() => ({ exact: this.exact() }));
}
