import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogRef } from '../../../core/models/item.model';
import { RefKind } from '../../../core/services/catalog-refs.service';
import { EMPTY_PAGE, PageMeta } from '../../../core/models/pagination.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { Pagination } from '../../../shared/components/pagination/pagination';

/** What `rename` was called with, paired with the row it applies to. */
export interface RefRename {
  id: number;
  name: string;
}

/**
 * One managed list — categories or brands — with inline add, inline rename and
 * a guarded delete (the positions card is the model). Instantiated twice by
 * the products screen; `kind` picks the headings.
 */
@Component({
  selector: 'app-ref-table',
  imports: [ReactiveFormsModule, ErrorMessage, Pagination, TranslatePipe],
  templateUrl: './ref-table.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  host: { class: 'contents' },
})
export class RefTable {
  readonly kind = input.required<RefKind>();

  /** One page of the list; `meta` says which and how many there are. */
  readonly refs = input<CatalogRef[]>([]);
  readonly meta = input<PageMeta>(EMPTY_PAGE);
  readonly saving = input(false);

  /** Read-only card (no add form, no actions) for catalog.view users. */
  readonly canManage = input(false);

  readonly add = output<string>();
  readonly rename = output<RefRename>();
  readonly remove = output<CatalogRef>();
  readonly pageChange = output<number>();

  private fb = inject(FormBuilder);

  readonly addForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
  });

  /** Id of the row being renamed, if any. */
  readonly renaming = signal<number | null>(null);

  readonly renameForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
  });

  startRename(ref: CatalogRef): void {
    this.renaming.set(ref.id);
    this.renameForm.setValue({ name: ref.name });
  }

  cancelRename(): void {
    this.renaming.set(null);
  }

  submitRename(ref: CatalogRef): void {
    if (this.renameForm.invalid) {
      this.renameForm.markAllAsTouched();
      return;
    }

    const name = this.renameForm.getRawValue().name.trim();
    this.renaming.set(null);
    if (name !== ref.name) this.rename.emit({ id: ref.id, name });
  }

  /**
   * The server refuses this with a 409 anyway; disabling with the count in the
   * tooltip says so before you click.
   */
  confirmRemove(ref: CatalogRef): void {
    this.remove.emit(ref);
  }

  onAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.add.emit(this.addForm.getRawValue().name.trim());
  }

  /** Called by the parent once the backend accepted the new row. */
  resetAdd(): void {
    this.addForm.reset();
  }
}
