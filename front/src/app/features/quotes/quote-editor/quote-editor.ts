import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Decimal } from 'decimal.js';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import { CreatePartnerRequest, Partner, Site } from '../../../core/models/partner.model';
import {
  CatalogueHit,
  QuoteDetail,
  QuoteSaveResponse,
  RevisionHead,
  UpdateQuoteRequest,
} from '../../../core/models/quote.model';
import { ApiError, FieldIssue } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { PartnerService } from '../../../core/services/partner.service';
import { QuoteService } from '../../../core/services/quote.service';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { notBlank } from '../../../shared/forms/decimal';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { LinePick, LineSearch } from '../line-search/line-search';
import { PartnerPicker } from '../partner-picker/partner-picker';
import {
  LineGroup,
  freeLine,
  lineFromHit,
  lineFromSaved,
  previewTotals,
  toLineInput,
} from '../quote-form';
import { QuoteLines } from '../quote-lines/quote-lines';
import { needsApproval } from '../quote-pricing';
import { STATUS_CLASSES, shortPercent } from '../quote-status';
import { QuoteTotals } from '../quote-totals/quote-totals';

/**
 * One page for a new quote (/quotes/new) and a saved one (/quotes/:id).
 *
 * Saving a new quote creates it with revision 1.0; saving an existing one
 * creates the next revision — earlier ones are never changed. The totals on
 * screen are a live preview; the server recalculates on every save and its
 * figures replace them.
 */
@Component({
  selector: 'app-quote-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ErrorMessage,
    MoneyPipe,
    PartnerPicker,
    QuoteLines,
    LineSearch,
    QuoteTotals,
  ],
  templateUrl: './quote-editor.html',
  styleUrls: ['./quote-editor.css', '../../../shared/styles/type-scale.css'],
})
export class QuoteEditor {
  private quoteService = inject(QuoteService);
  private partnerService = inject(PartnerService);
  private auth = inject(AuthService);
  private language = inject(LanguageService);
  private translate = inject(TranslateService);
  private toasts = inject(ToastService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly options = this.quoteService.options;
  readonly statusClasses = STATUS_CLASSES;

  /** The saved quote being edited; null while creating a new one. */
  readonly quote = signal<QuoteDetail | null>(null);
  readonly revisions = signal<RevisionHead[]>([]);

  readonly partners = signal<Partner[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly hits = signal<CatalogueHit[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searching = signal(false);
  readonly creatingPartner = signal(false);

  readonly error = signal<string | null>(null);
  readonly fieldIssues = signal<FieldIssue[]>([]);
  protected readonly issueMessages = computed(() =>
    this.fieldIssues().map((issue) => `${issue.field}: ${issue.message}`),
  );
  readonly partnerError = signal<string | null>(null);

  /** The reject form: closed, or open with its note. */
  readonly rejecting = signal(false);
  readonly rejectNote = this.fb.nonNullable.control('', [
    notBlank,
    Validators.minLength(2),
    Validators.maxLength(1000),
  ]);

  readonly form = this.fb.nonNullable.group({
    // Ids as the selects hold them: strings, '' for none.
    partnerId: ['', Validators.required],
    siteId: [''],
    title: ['', [notBlank, Validators.minLength(2), Validators.maxLength(160)]],
    validUntil: [''],
    paymentTerms: ['', Validators.maxLength(160)],
    notes: ['', Validators.maxLength(4000)],
    lines: this.fb.nonNullable.array<LineGroup>([]),
  });

  readonly lines = this.form.controls.lines;

  /** The form as a signal, so the totals follow every keystroke. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Live totals over the lines that currently parse. */
  readonly preview = computed(() => {
    this.formValue();
    return previewTotals(this.lines.getRawValue());
  });

  /**
   * Whether saving now would send the quote for approval. Never for an
   * approver: their own save below the minimum is only warned about.
   */
  readonly willNeedApproval = computed(
    () =>
      !this.options().canApprove &&
      needsApproval(this.preview().overallMarkupPct, new Decimal(this.options().minMarkupPct || '0')),
  );

  /** Section names in use, as suggestions for the next line. */
  readonly sectionNames = computed(() => {
    this.formValue();
    return [...new Set(this.lines.controls.map((line) => line.controls.section.value).filter(Boolean))];
  });

  /** Writing needs both: a price is defined on its cost. The server decides anyway. */
  private readonly mayWrite = computed(
    () => this.auth.hasPermission('quote.manage') && this.auth.hasPermission('quote.view_cost'),
  );

  /** False once the quote has left the statuses in which it can be edited. */
  readonly editable = computed(() => {
    const quote = this.quote();
    if (!this.mayWrite()) return false;
    return quote === null || this.options().editableStatuses.includes(quote.status);
  });

  /**
   * Approve / reject: waiting for approval, the user may approve, and it is
   * not their own revision. The server enforces all three; this only hides
   * buttons that would be refused.
   */
  readonly canDecide = computed(() => {
    const quote = this.quote();
    return (
      quote !== null &&
      quote.status === 'PENDING_APPROVAL' &&
      this.options().canApprove &&
      quote.revision.createdBy.id !== this.auth.currentUser()?.id
    );
  });

  private readonly partnerPicker = viewChild(PartnerPicker);

  private readonly partnerSearch = new Subject<string>();
  private readonly itemSearch = new Subject<string>();

  constructor() {
    this.quoteService.loadOptions().subscribe({ error: () => undefined });

    // The options (which statuses are editable) and the session can land
    // after the quote, so access is re-applied whenever the answer changes.
    effect(() => this.applyAccess(this.editable()));

    this.partnerSearch
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.partnerService.search(term).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe((partners) => this.partners.set(partners));

    this.itemSearch
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length < 2) {
            this.searching.set(false);
            return of([] as CatalogueHit[]);
          }
          this.searching.set(true);
          return this.quoteService.searchItems(term).pipe(
            finalize(() => this.searching.set(false)),
            catchError(() => of([] as CatalogueHit[])),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((hits) => this.hits.set(hits));

    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const id = Number(params.get('id'));
        if (Number.isInteger(id) && id > 0) this.load(id);
        else this.startNew();
      });
  }

  // ---------- loading ----------

  private startNew(): void {
    this.quote.set(null);
    this.revisions.set([]);
    this.partnerService.search().subscribe({
      next: (partners) => this.partners.set(partners),
      error: () => undefined,
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.quoteService
      .getQuote(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.show(res.quote),
        error: (err) => this.showError(err),
      });
  }

  /** Puts a saved quote on screen: the server's figures replace the preview. */
  private show(quote: QuoteDetail): void {
    this.quote.set(quote);
    this.rejecting.set(false);

    this.lines.clear({ emitEvent: false });
    for (const line of quote.revision.lines) {
      this.lines.push(lineFromSaved(this.fb, line), { emitEvent: false });
    }
    this.form.reset({
      partnerId: String(quote.partner.id),
      siteId: quote.site ? String(quote.site.id) : '',
      title: quote.title,
      validUntil: quote.validUntil ?? '',
      paymentTerms: quote.paymentTerms ?? '',
      notes: quote.notes ?? '',
    });

    // The lines were just rebuilt, so they need the access applied again.
    this.applyAccess(this.editable());

    this.loadSites(quote.partner.id);
    this.quoteService.getRevisions(quote.id).subscribe({
      next: (revisions) => this.revisions.set(revisions),
      error: () => undefined,
    });
  }

  /** A quote that can no longer be edited is shown with every field disabled. */
  private applyAccess(editable: boolean): void {
    if (editable) this.form.enable({ emitEvent: false });
    else this.form.disable({ emitEvent: false });
  }

  private loadSites(partnerId: number): void {
    this.partnerService.sites(partnerId).subscribe({
      next: (sites) => this.sites.set(sites),
      error: () => this.sites.set([]),
    });
  }

  // ---------- client ----------

  onPartnerSearch(term: string): void {
    this.partnerSearch.next(term);
  }

  /** A new client: its sites, and its usual payment terms if none were typed. */
  onPartnerPicked(id: string): void {
    this.form.controls.siteId.setValue('');
    this.sites.set([]);
    if (!id) return;

    this.loadSites(Number(id));
    const partner = this.partners().find((p) => String(p.id) === id);
    if (partner?.paymentTerms && !this.form.controls.paymentTerms.value.trim()) {
      this.form.controls.paymentTerms.setValue(partner.paymentTerms);
    }
  }

  createPartner(payload: CreatePartnerRequest): void {
    this.creatingPartner.set(true);
    this.partnerError.set(null);
    this.partnerService
      .create(payload)
      .pipe(finalize(() => this.creatingPartner.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          // The new client goes on top of the dropdown and is picked.
          this.partners.update((list) => [res.partner, ...list]);
          this.form.controls.partnerId.setValue(String(res.partner.id));
          this.onPartnerPicked(String(res.partner.id));
          this.partnerPicker()?.closeForm();
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiError | undefined;
          const details = (body?.issues ?? []).map((issue) => issue.message).join(' ');
          this.partnerError.set(
            [body?.message ?? this.translate.instant('common.somethingWentWrong'), details]
              .filter(Boolean)
              .join(' '),
          );
        },
      });
  }

  // ---------- lines ----------

  onItemSearch(term: string): void {
    this.itemSearch.next(term);
  }

  private defaultVat(): { code: string; rate: string } | null {
    const first = this.options().vatRates[0];
    return first ? { code: first.code, rate: first.rate } : null;
  }

  addFromCatalogue(pick: LinePick): void {
    this.insert(lineFromHit(this.fb, pick.hit, pick.section, this.defaultVat()), pick.section);
    this.hits.set([]);
  }

  addFreeLine(section: string): void {
    const unitCode = this.options().units.find((u) => u.code === 'pcs')?.code ?? this.options().units[0]?.code ?? '';
    this.insert(freeLine(this.fb, section, { unitCode, vat: this.defaultVat() }), section);
  }

  /** After the last line of its section, so a section stays together; else at the end. */
  private insert(line: LineGroup, section: string): void {
    const controls = this.lines.controls;
    let at = -1;
    for (let i = controls.length - 1; i >= 0; i--) {
      if (controls[i]!.controls.section.value === section) {
        at = i + 1;
        break;
      }
    }
    if (at === -1) this.lines.push(line);
    else this.lines.insert(at, line);
  }

  // ---------- saving ----------

  save(): void {
    if (!this.editable()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.translate.instant('quotes.editor.fixFields'));
      this.fieldIssues.set([]);
      return;
    }

    const v = this.form.getRawValue();
    const header = {
      siteId: v.siteId ? Number(v.siteId) : null,
      title: v.title.trim(),
      label: this.quote()?.label ?? null,
      validUntil: v.validUntil || null,
      paymentTerms: v.paymentTerms.trim() || null,
      notes: v.notes.trim() || null,
      lines: v.lines.map(toLineInput),
    };

    const existing = this.quote();
    this.saving.set(true);
    this.error.set(null);
    this.fieldIssues.set([]);

    if (existing === null) {
      this.quoteService
        .createQuote({ partnerId: Number(v.partnerId), ...header })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (res) => {
            this.toastSaved(res);
            // The quote now has a number and an address of its own.
            void this.router.navigate(['/quotes', res.quote.id], { replaceUrl: true });
          },
          error: (err) => this.showError(err),
        });
      return;
    }

    const body: UpdateQuoteRequest = { version: existing.version, ...header };
    this.quoteService
      .saveQuote(existing.id, body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toastSaved(res);
          this.show(res.quote);
        },
        error: (err) => this.showError(err),
      });
  }

  /** A save below the minimum markup is a warning, held for approval or not. */
  private toastSaved(res: QuoteSaveResponse): void {
    if (res.lowMarkup) this.toasts.warning(res.message);
    else this.toasts.success(res.message);
  }

  // ---------- approval ----------

  approve(): void {
    const quote = this.quote();
    if (!quote) return;
    this.decide(this.quoteService.approve(quote.id));
  }

  openReject(): void {
    this.rejectNote.reset('');
    this.rejecting.set(true);
  }

  reject(): void {
    const quote = this.quote();
    if (!quote) return;
    if (this.rejectNote.invalid) {
      this.rejectNote.markAsTouched();
      return;
    }
    this.decide(this.quoteService.reject(quote.id, this.rejectNote.value.trim()));
  }

  private decide(request: ReturnType<QuoteService['approve']>): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldIssues.set([]);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => {
        this.toasts.success(res.message);
        this.show(res.quote);
      },
      error: (err) => this.showError(err),
    });
  }

  // ---------- display ----------

  /** Called from the template, so it re-renders in the new language on a switch. */
  when(iso: string): string {
    return new Date(iso).toLocaleString(this.language.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  percent(value: string | null | undefined): string {
    return shortPercent(value);
  }

  private showError(err: HttpErrorResponse): void {
    const body = err.error as ApiError | undefined;
    this.error.set(body?.message ?? this.translate.instant('common.somethingWentWrong'));
    this.fieldIssues.set(body?.issues ?? []);
  }
}
