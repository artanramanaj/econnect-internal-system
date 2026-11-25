import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  EMPTY_ITEM_OPTIONS,
  ItemDetail,
  ItemOptions,
  ItemType,
  UnitOption,
  UpdateItemRequest,
} from '../../../core/models/item.model';
import { LanguageService } from '../../../core/services/language.service';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { CodeLabelPipe } from '../../../shared/pipes/code-label.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  BROCHURE_MAX_MB,
  BrochureProblem,
  asTyped,
  brochureProblem,
  decimal,
  notBlank,
  parseDecimal,
  sizeLabel,
} from '../item-form';

type UnitRow = FormGroup<{ unitCode: FormControl<string>; factor: FormControl<string> }>;

@Component({
  selector: 'app-item-drawer',
  imports: [ReactiveFormsModule, TranslatePipe, ErrorMessage, CodeLabelPipe, MoneyPipe],
  templateUrl: './item-drawer.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // overlay keeps its own fixed positioning.
  host: { class: 'contents' },
})
export class ItemDrawer {
  /** The item being edited; creating happens in the add-product card. */
  readonly item = input.required<ItemDetail>();

  readonly options = input<ItemOptions>(EMPTY_ITEM_OPTIONS);

  readonly canViewCost = input(false);

  /** Without catalog.manage the drawer is a read-only view. */
  readonly canManage = input(false);

  readonly saving = input(false);

  /** A failed write. Shown in here: a page banner would sit behind the backdrop. */
  readonly error = input<string | null>(null);

  /** The `issues[]` messages that came with it. */
  readonly issues = input<readonly string[]>([]);

  readonly close = output<void>();
  readonly update = output<UpdateItemRequest>();
  /** true archives, false restores. */
  readonly archive = output<boolean>();
  readonly remove = output<void>();
  /** Open the item's PDF in a new tab. */
  readonly openPdf = output<void>();
  /** Attach or replace the item's PDF; uploads straight away, outside the form. */
  readonly uploadBrochure = output<File>();
  readonly removeBrochure = output<void>();

  private fb = inject(FormBuilder);
  private language = inject(LanguageService);

  readonly confirmingDelete = signal(false);

  /** Why the last picked file was refused, if it was. */
  readonly brochureError = signal<BrochureProblem | null>(null);

  readonly types: ItemType[] = ['PRODUCT', 'SERVICE'];
  readonly maxMb = BROCHURE_MAX_MB;

  readonly form = this.fb.nonNullable.group({
    sku: ['', [notBlank, Validators.maxLength(60)]],
    type: this.fb.nonNullable.control<ItemType>('PRODUCT'),
    description: ['', [notBlank, Validators.minLength(2), Validators.maxLength(255)]],
    // Ids as the selects hold them: strings, '' for none. The names must match
    // the server's syncOwnedFields, which is what locks them on PRODATA items.
    categoryId: [''],
    brandId: [''],
    manufacturer: ['', Validators.maxLength(80)],
    barcode: ['', Validators.maxLength(60)],
    baseUnitCode: ['', Validators.required],
    vatCode: ['', Validators.required],
    costPrice: ['', decimal()],
    units: this.fb.nonNullable.array<UnitRow>([]),
  });

  readonly units = this.form.controls.units;

  readonly isProData = computed(() => this.item().source === 'PRODATA');

  /**
   * Fields read-only on this item: whatever the sync owns, when it came from
   * ProData. The list comes from the server, so it is not kept twice.
   */
  readonly lockedFields = computed(
    () => new Set(this.isProData() ? this.options().syncOwnedFields : []),
  );

  constructor() {
    // Refills whenever the parent opens another item or swaps in the saved copy.
    effect(() => this.fill(this.item()));

    // Separate from fill, and created after it so it runs after it: options
    // can land after the drawer opened, and must not wipe what was typed; the
    // rows fill just added must be disabled too in a read-only drawer.
    effect(() => this.applyAccess(this.lockedFields(), this.canManage()));
  }

  private fill(item: ItemDetail): void {
    this.confirmingDelete.set(false);
    this.brochureError.set(null);

    this.units.clear({ emitEvent: false });
    for (const unit of item.units) {
      this.units.push(this.unitRow(unit.unitCode, asTyped(unit.factor)), { emitEvent: false });
    }

    this.form.reset({
      sku: item.sku,
      type: item.type,
      description: item.description,
      categoryId: item.category ? String(item.category.id) : '',
      brandId: item.brand ? String(item.brand.id) : '',
      manufacturer: item.manufacturer ?? '',
      barcode: item.barcode ?? '',
      baseUnitCode: item.baseUnitCode,
      vatCode: item.vatCode,
      costPrice: item.costPrice ? asTyped(item.costPrice) : '',
    });
  }

  private applyAccess(locked: Set<string>, canManage: boolean): void {
    for (const [name, control] of Object.entries(this.form.controls)) {
      if (!canManage || locked.has(name)) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
  }

  private unitRow(unitCode = '', factor = ''): UnitRow {
    return this.fb.nonNullable.group({
      unitCode: [unitCode, Validators.required],
      factor: [factor, [Validators.required, decimal({ positive: true })]],
    });
  }

  addUnit(): void {
    this.units.push(this.unitRow());
  }

  removeUnit(index: number): void {
    this.units.removeAt(index);
  }

  /**
   * Units one alternative-unit row may pick: not the base unit, and not one
   * another row already has. The row's own value always stays, so a select
   * never silently changes under the user.
   */
  unitChoices(index: number): UnitOption[] {
    const own = this.units.at(index).controls.unitCode.value;
    const base = this.form.controls.baseUnitCode.value;
    const taken = new Set(
      this.units.controls
        .filter((_, i) => i !== index)
        .map((row) => row.controls.unitCode.value),
    );
    return this.options().units.filter(
      (unit) => unit.code === own || (unit.code !== base && !taken.has(unit.code)),
    );
  }

  /** "18.00" as the rate is said: 18. */
  percent(rate: string): number {
    return Number(rate);
  }

  /** [selected] needs a string compare: the select holds ids as strings. */
  isPicked(value: string, id: number): boolean {
    return value === String(id);
  }

  /** "1.2 MB" for the brochure chip. */
  brochureSize(size: number | null): string {
    return sizeLabel(size);
  }

  onBrochurePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file again still fires a change event.
    input.value = '';
    if (!file) return;

    const problem = brochureProblem(file);
    this.brochureError.set(problem);
    if (!problem) this.uploadBrochure.emit(file);
  }

  /** Touched and wrong: when a field shows its message. */
  invalid(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  /** Called from the template, so it is re-evaluated — in the new language — on a switch. */
  when(iso: string): string {
    return new Date(iso).toLocaleString(this.language.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  onSubmit(): void {
    if (!this.canManage()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const units = v.units.map((row) => ({
      unitCode: row.unitCode,
      factor: parseDecimal(row.factor),
    }));
    // An emptied cost field means "leave it": the column cannot be null.
    const cost =
      this.canViewCost() && v.costPrice.trim() !== '' ? parseDecimal(v.costPrice) : undefined;

    const changes: UpdateItemRequest = {
      sku: v.sku.trim(),
      type: v.type,
      description: v.description.trim(),
      // Null clears the column; an empty select means "no value".
      categoryId: v.categoryId ? Number(v.categoryId) : null,
      brandId: v.brandId ? Number(v.brandId) : null,
      manufacturer: v.manufacturer.trim() || null,
      barcode: v.barcode.trim() || null,
      baseUnitCode: v.baseUnitCode,
      vatCode: v.vatCode,
      costPrice: cost,
      units,
    };
    // Locked fields stay out altogether: the sync owns them, and the server
    // would refuse a changed one anyway.
    for (const field of this.lockedFields()) {
      delete changes[field as keyof UpdateItemRequest];
    }
    this.update.emit(changes);
  }
}
