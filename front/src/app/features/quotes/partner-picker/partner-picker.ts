import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CreatePartnerRequest, Partner, Site } from '../../../core/models/partner.model';
import { QuotePartner } from '../../../core/models/quote.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { notBlank } from '../../../shared/forms/decimal';

/**
 * The client and site fields of the quote editor: a searchable client
 * dropdown with an inline "+ New client" form, and the picked client's sites.
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

  readonly newForm = this.fb.nonNullable.group({
    legalName: ['', [notBlank, Validators.minLength(2), Validators.maxLength(160)]],
    city: ['', Validators.maxLength(80)],
    fiscalNumber: ['', Validators.maxLength(30)],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    paymentTerms: ['', Validators.maxLength(160)],
  });

  onSearch(event: Event): void {
    this.search.emit((event.target as HTMLInputElement).value.trim());
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
