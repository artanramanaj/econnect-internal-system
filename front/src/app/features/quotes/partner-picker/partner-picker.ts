import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CreatePartnerRequest, Partner, Site } from '../../../core/models/partner.model';
import { QuotePartner } from '../../../core/models/quote.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { notBlank } from '../../../shared/forms/decimal';

/**
 * The client and site fields of the quote editor: the client is chosen from a
 * dropdown or by searching — two icon buttons switch between the two — with
 * an inline "+ New client" form, and the picked client's sites.
 * On a saved quote the client is fixed and shown as text.
 *
 * Presentational: the parent searches, creates and loads sites; the two
 * FormControls are the parent's.
 */
@Component({
  selector: 'app-partner-picker',
  imports: [ReactiveFormsModule, TranslatePipe, ErrorMessage],
  templateUrl: './partner-picker.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  host: { class: 'contents' },
})
export class PartnerPicker {
  /** Ids as the selects hold them: strings, '' for none. */
  readonly partnerControl = input.required<FormControl<string>>();
  readonly siteControl = input.required<FormControl<string>>();

  readonly partners = input<Partner[]>([]);
  /** The picked client's sites. */
  readonly sites = input<Site[]>([]);

  /** Set on a saved quote: its client can no longer be changed. */
  readonly locked = input<QuotePartner | null>(null);

  /** A client is being created. */
  readonly creating = input(false);
  /** Why the last create failed. Shown in the inline form. */
  readonly createError = input<string | null>(null);

  readonly search = output<string>();
  readonly picked = output<string>();
  readonly create = output<CreatePartnerRequest>();

  private fb = inject(FormBuilder);

  /** Whether the inline new-client form is open. */
  readonly adding = signal(false);

  /** How the client is chosen: from the dropdown, or by searching. */
  readonly mode = signal<'select' | 'search'>('select');
  /** What is typed in the search box. */
  readonly term = signal('');

  /**
   * The client picked from a search, kept so the dropdown can still show it
   * once the list is reloaded without the search term.
   */
  private readonly chosen = signal<Partner | null>(null);

  /** The dropdown's clients: the loaded ones, plus the one picked by search. */
  readonly options = computed(() => {
    const list = this.partners();
    const chosen = this.chosen();
    return chosen && !list.some((p) => p.id === chosen.id) ? [chosen, ...list] : list;
  });

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly injector = inject(Injector);

  setMode(mode: 'select' | 'search'): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    if (mode === 'search') {
      afterNextRender(() => this.searchBox()?.nativeElement.focus(), { injector: this.injector });
    } else {
      this.clearSearch();
    }
  }

  /** A search result clicked: picked, and back to the dropdown showing it. */
  choose(partner: Partner): void {
    const control = this.partnerControl();
    control.setValue(String(partner.id));
    control.markAsTouched();
    this.chosen.set(partner);
    this.picked.emit(control.value);
    this.setMode('select');
  }

  /** Leaving the search: the dropdown gets the full list back. */
  private clearSearch(): void {
    if (this.term() !== '') {
      this.term.set('');
      this.search.emit('');
    }
  }

  readonly newForm = this.fb.nonNullable.group({
    legalName: ['', [notBlank, Validators.minLength(2), Validators.maxLength(160)]],
    city: ['', Validators.maxLength(80)],
    fiscalNumber: ['', Validators.maxLength(30)],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    paymentTerms: ['', Validators.maxLength(160)],
  });

  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim();
    this.term.set(term);
    this.search.emit(term);
  }

  onPick(): void {
    this.picked.emit(this.partnerControl().value);
  }

  label(partner: { legalName: string; tradeName: string | null; partnerNumber: string }): string {
    return `${partner.tradeName || partner.legalName} (${partner.partnerNumber})`;
  }

  /** Touched and wrong: when the client field shows its message. */
  partnerInvalid(): boolean {
    const control = this.partnerControl();
    return control.touched && control.invalid;
  }

  openForm(): void {
    this.newForm.reset();
    this.adding.set(true);
  }

  /** Called by the parent too, once the backend accepted the new client. */
  closeForm(): void {
    this.adding.set(false);
  }

  submitNew(): void {
    if (this.newForm.invalid) {
      this.newForm.markAllAsTouched();
      return;
    }
    const v = this.newForm.getRawValue();
    const optional = (text: string) => text.trim() || undefined;
    this.create.emit({
      legalName: v.legalName.trim(),
      city: optional(v.city),
      fiscalNumber: optional(v.fiscalNumber),
      phone: optional(v.phone),
      email: optional(v.email),
      paymentTerms: optional(v.paymentTerms),
    });
  }
}
