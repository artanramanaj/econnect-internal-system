import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogueHit } from '../../../core/models/quote.model';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

/** A catalogue match picked for a section. */
export interface LinePick {
  hit: CatalogueHit;
  section: string;
}

/**
 * "Add a line": a catalogue search with its results, and a button for a free
 * line with no catalogue item. Presentational — the parent runs the search
 * (debounced) and adds the line; this only says what was typed and picked.
 */
@Component({
  selector: 'app-line-search',
  imports: [TranslatePipe, MoneyPipe],
  templateUrl: './line-search.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  host: { class: 'contents' },
})
export class LineSearch {
  /** Matches for the current term, from the parent. */
  readonly hits = input<CatalogueHit[]>([]);
  readonly searching = input(false);
  /** Sections already in the quote, offered as suggestions. */
  readonly sections = input<string[]>([]);
  readonly canViewCost = input(false);

  readonly search = output<string>();
  readonly pick = output<LinePick>();
  /** A free line for the given section. */
  readonly addFree = output<string>();

  readonly term = signal('');
  /** The section new lines go into; kept between adds. */
  readonly section = signal('');

  onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.term.set(value);
    this.search.emit(value.trim());
  }

  onSection(event: Event): void {
    this.section.set((event.target as HTMLInputElement).value);
  }

  choose(hit: CatalogueHit): void {
    this.pick.emit({ hit, section: this.section().trim() });
    this.clear();
  }

  free(): void {
    this.addFree.emit(this.section().trim());
    this.clear();
  }

  /** The results list shows from two characters on, like the server's search. */
  open(): boolean {
    return this.term().trim().length >= 2;
  }

  private clear(): void {
    this.term.set('');
    this.search.emit('');
  }
}
