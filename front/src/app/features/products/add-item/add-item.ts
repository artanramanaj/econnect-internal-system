import { Component, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import {
  CreateItemRequest,
  EMPTY_ITEM_OPTIONS,
  ItemOptions,
  ItemType,
  UnitOption,
} from '../../../core/models/item.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { CodeLabelPipe } from '../../../shared/pipes/code-label.pipe';
import { decimal, notBlank, parseDecimal } from '../../../shared/forms/decimal';
import { BROCHURE_MAX_MB, BrochureProblem, brochureProblem, sizeLabel } from '../item-form';

/** The new item, plus the PDF to attach to it once it exists. */
export interface AddItemSubmit {
  item: CreateItemRequest;
  brochure: File | null;
}

type UnitRow = FormGroup<{ unitCode: FormControl<string>; factor: FormControl<string> }>;

/** Units that only make sense for work, never as a product's base unit. */
const SERVICE_ONLY_UNITS: readonly string[] = ['hr'];

/**
 * The always-there "add a product" card beside the table (add-employee is the
 * model). Purely presentational: the parent owns the services, calls reset()
 * on success, and shows server errors in the page banner.
 */
@Component({
  selector: 'app-add-item',
  imports: [ReactiveFormsModule, TranslatePipe, ErrorMessage, CodeLabelPipe],
  templateUrl: './add-item.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> is the flex row's direct child.
  host: { class: 'contents' },
})
export class AddItem {
  readonly options = input<ItemOptions>(EMPTY_ITEM_OPTIONS);

  /** Without quote.view_cost there is no cost field; the server refuses one anyway. */
  readonly canViewCost = input(false);

  readonly saving = input(false);

  readonly submitted = output<AddItemSubmit>();

  private fb = inject(FormBuilder);

  readonly types: ItemType[] = ['PRODUCT', 'SERVICE'];
  readonly maxMb = BROCHURE_MAX_MB;

  readonly form = this.fb.nonNullable.group({
    sku: ['', [notBlank, Validators.maxLength(60)]],
    type: this.fb.nonNullable.control<ItemType>('PRODUCT'),
    description: ['', [notBlank, Validators.minLength(2), Validators.maxLength(255)]],
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

  /** The PDF picked for the new item; uploaded by the parent after the create. */
  readonly brochure = signal<File | null>(null);
  readonly brochureError = signal<BrochureProblem | null>(null);

  constructor() {
    // A new item starts on the first rate in force (the standard one: the
    // server sorts by rate), once the rates are known.
    effect(() => {
      const first = this.options().vatRates[0];
      if (first && this.form.controls.vatCode.value === '') {
        this.form.controls.vatCode.setValue(first.code);
      }
    });

    // Switching to Product drops a base unit a product cannot have (Hours).
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const base = this.form.controls.baseUnitCode;
      if (type === 'PRODUCT' && SERVICE_ONLY_UNITS.includes(base.value)) base.setValue('');
    });
  }

  /** The base units the chosen type may have: no Hours for a product. */
  baseUnits(): UnitOption[] {
    const units = this.options().units;
    return this.form.controls.type.value === 'PRODUCT'
      ? units.filter((unit) => !SERVICE_ONLY_UNITS.includes(unit.code))
      : units;
  }

  private unitRow(): UnitRow {
    return this.fb.nonNullable.group({
      unitCode: ['', Validators.required],
      factor: ['', [Validators.required, decimal({ positive: true })]],
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
      this.units.controls.filter((_, i) => i !== index).map((row) => row.controls.unitCode.value),
    );
    return this.options().units.filter(
      (unit) => unit.code === own || (unit.code !== base && !taken.has(unit.code)),
    );
  }

  /** "18.00" as the rate is said: 18. */
  percent(rate: string): number {
    return Number(rate);
  }

  /** Touched and wrong: when a field shows its message. */
  invalid(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  pickedSize(file: File): string {
    return sizeLabel(file.size);
  }

  onBrochurePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file again still fires a change event.
    input.value = '';
    if (!file) return;

    const problem = brochureProblem(file);
    this.brochureError.set(problem);
    this.brochure.set(problem ? null : file);
  }

  clearBrochure(): void {
    this.brochure.set(null);
    this.brochureError.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const optional = (text: string) => text.trim() || undefined;

    this.submitted.emit({
      item: {
        sku: v.sku.trim(),
        type: v.type,
        description: v.description.trim(),
        categoryId: v.categoryId ? Number(v.categoryId) : undefined,
        brandId: v.brandId ? Number(v.brandId) : undefined,
        manufacturer: optional(v.manufacturer),
        barcode: optional(v.barcode),
        baseUnitCode: v.baseUnitCode,
        vatCode: v.vatCode,
        // An empty cost field means "none yet": the column defaults to 0.
        costPrice:
          this.canViewCost() && v.costPrice.trim() !== '' ? parseDecimal(v.costPrice) : undefined,
        units: v.units.map((row) => ({
          unitCode: row.unitCode,
          factor: parseDecimal(row.factor),
        })),
      },
      brochure: this.brochure(),
    });
  }

  /** Called by the parent once the backend accepted the new item. */
  reset(): void {
    this.units.clear();
    this.form.reset({
      sku: '',
      type: 'PRODUCT',
      description: '',
      categoryId: '',
      brandId: '',
      manufacturer: '',
      barcode: '',
      baseUnitCode: '',
      vatCode: this.options().vatRates[0]?.code ?? '',
      costPrice: '',
    });
    this.clearBrochure();
  }
}
