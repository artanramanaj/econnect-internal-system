import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** How many page-number buttons show at once. */
const WINDOW = 5;

@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe],
  templateUrl: './pagination.html',
  // `contents` keeps the host out of the layout box model, so the inner <nav>
  // is a direct child of whatever card footer or flex column the caller puts
  // it in and that container's gap and alignment still apply.
  host: { class: 'contents' },
})
export class Pagination {
  /** The current page, 1-based. */
  readonly page = input.required<number>();

  /** Total number of rows across every page. */
  readonly total = input.required<number>();

  readonly pageSize = input(10);

  /** aria-label for the nav; set it when a screen has more than one pager. */
  readonly label = input('Pagination');

  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  /**
   * A sliding window of up to WINDOW numbers centred on the current page and
   * clamped to the ends. No ellipsis: the lists this pages are short enough
   * that moving at most a couple of pages per click is fine.
   */
  readonly pages = computed(() => {
    const count = this.totalPages();
    const size = Math.min(WINDOW, count);
    const start = Math.min(Math.max(1, this.page() - Math.floor(size / 2)), count - size + 1);
    return Array.from({ length: size }, (_, i) => start + i);
  });

  readonly hasPrevious = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());

  go(target: number): void {
    if (target < 1 || target > this.totalPages() || target === this.page()) return;
    this.pageChange.emit(target);
  }
}
