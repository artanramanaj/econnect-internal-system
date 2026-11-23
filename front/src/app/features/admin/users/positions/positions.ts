import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY_PAGE, PageMeta } from '../../../../core/models/pagination.model';
import {
  CreatePositionRequest,
  Position,
  UpdatePositionRequest,
} from '../../../../core/models/position.model';
import { TranslatePipe } from '@ngx-translate/core';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { Pagination } from '../../../../shared/components/pagination/pagination';

/** What `updatePosition` was called with, paired with the row it applies to. */
export interface PositionEdit {
  id: number;
  changes: UpdatePositionRequest;
}

@Component({
  selector: 'app-positions',
  imports: [ReactiveFormsModule, ErrorMessage, Pagination, TranslatePipe],
  templateUrl: './positions.html',
  styleUrls: ['../type-scale.css'],
  host: { class: 'contents' },
})
export class Positions {
  /** One page of the list; `meta` says which and how many there are. */
  readonly positions = input<Position[]>([]);
  readonly meta = input<PageMeta>(EMPTY_PAGE);
  /** Across every page, so it cannot be computed from `positions`. */
  readonly activeCount = input(0);
  readonly saving = input(false);

  readonly add = output<CreatePositionRequest>();
  readonly edit = output<PositionEdit>();
  readonly remove = output<Position>();
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

  startRename(position: Position): void {
    this.renaming.set(position.id);
    this.renameForm.setValue({ name: position.name });
  }

  cancelRename(): void {
    this.renaming.set(null);
  }

  submitRename(position: Position): void {
    if (this.renameForm.invalid) {
      this.renameForm.markAllAsTouched();
      return;
    }

    const name = this.renameForm.getRawValue().name.trim();
    this.renaming.set(null);
    if (name !== position.name) this.edit.emit({ id: position.id, changes: { name } });
  }

  toggleActive(position: Position): void {
    this.edit.emit({ id: position.id, changes: { isActive: !position.isActive } });
  }

  /**
   * The server refuses this with a 409 anyway; asking first means the count is
   * in front of you before you find that out.
   */
  confirmRemove(position: Position): void {
    this.remove.emit(position);
  }

  onAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.add.emit({ name: this.addForm.getRawValue().name.trim() });
  }

  /** Called by the parent once the backend accepted the new position. */
  resetAdd(): void {
    this.addForm.reset();
  }
}
