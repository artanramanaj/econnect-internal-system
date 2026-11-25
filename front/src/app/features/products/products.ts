import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CatalogRefsService, RefKind } from '../../core/services/catalog-refs.service';
import { ItemService } from '../../core/services/item.service';
import { ToastService } from '../../core/services/toast.service';
import { CatalogRef, Item, ItemDetail, ItemQuery, UpdateItemRequest } from '../../core/models/item.model';
import { ApiError, FieldIssue } from '../../core/models/user.model';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { DeleteModal } from '../../shared/components/delete-modal/delete-modal';
import { AddItem, AddItemSubmit } from './add-item/add-item';
import { DEFAULT_ITEM_FILTERS, ItemFilters, ItemTable } from './item-table/item-table';
import { ItemDrawer } from './item-drawer/item-drawer';
import { RefRename, RefTable } from './ref-table/ref-table';

@Component({
  selector: 'app-products',
  imports: [ItemTable, AddItem, ItemDrawer, RefTable, ErrorMessage, DeleteModal, TranslatePipe],
  templateUrl: './products.html',
  styleUrls: ['./products.css', '../../shared/styles/type-scale.css'],
})
export class Products {
  private catalogue = inject(ItemService);
  private catalogRefs = inject(CatalogRefsService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private toasts = inject(ToastService);

  readonly items = this.catalogue.items;
  readonly meta = this.catalogue.meta;
  readonly options = this.catalogue.options;
  /** From the server: whether it sent cost prices at all. */
  readonly canViewCost = this.catalogue.canViewCost;

  readonly categories = this.catalogRefs.categories;
  readonly categoriesMeta = this.catalogRefs.categoriesMeta;
  readonly brands = this.catalogRefs.brands;
  readonly brandsMeta = this.catalogRefs.brandsMeta;

  /**
   * Hides the write controls from people who would only get a 403. The
   * server still decides. Read-only users (catalog.view) open items to look.
   */
  readonly canManage = computed(() => this.auth.hasPermission('catalog.manage'));

  readonly loading = signal(false);
  readonly saving = signal(false);

  /** Page-level failures: list loads, the add card, the ref tables. */
  readonly error = signal<string | null>(null);
  readonly fieldIssues = signal<FieldIssue[]>([]);
  protected readonly issueMessages = computed(() => this.fieldIssues().map((i) => i.message));

  /** Failures of a write made in the drawer, shown inside it. */
  readonly drawerError = signal<string | null>(null);
  readonly drawerIssues = signal<FieldIssue[]>([]);
  protected readonly drawerIssueMessages = computed(() =>
    this.drawerIssues().map((i) => i.message),
  );

  readonly searchTerm = signal('');
  readonly filters = signal<ItemFilters>(DEFAULT_ITEM_FILTERS);

  /** The drawer is open while an item is being looked at or edited. */
  readonly editing = signal<ItemDetail | null>(null);

  /** The category or brand the delete modal is asking about; null while it is closed. */
  readonly refToDelete = signal<{ kind: RefKind; ref: CatalogRef } | null>(null);

  /** Translation namespace of each ref table, for the modal's wording. */
  protected readonly refKeys: Record<RefKind, string> = {
    categories: 'items.refs.categories',
    brands: 'items.refs.brands',
  };

  /** Rendered only when canManage, hence not required. */
  private readonly addCard = viewChild(AddItem);
  private readonly categoriesTable = viewChild<RefTable>('categoriesTable');
  private readonly brandsTable = viewChild<RefTable>('brandsTable');

  private readonly searchInput = new Subject<string>();

  /** Every other list load: filters, page changes, reloads after a write. */
  private readonly listLoads = new Subject<ItemQuery>();

  constructor() {
    // One stream for every list load, so switchMap can drop the response of
    // an earlier request when a later one starts: a slow search must not
    // overwrite the page you have since moved to. A new search term always
    // goes back to page 1 — the old page number means nothing in a new set.
    merge(
      this.searchInput.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => this.query({ page: 1 })),
      ),
      this.listLoads,
    )
      .pipe(
        switchMap((query) => {
          // Set here, not before switchMap: cancelling the previous request
          // runs its finalize first, which would otherwise clear this again.
          this.loading.set(true);
          return this.catalogue.loadItems(query).pipe(
            finalize(() => this.loading.set(false)),
            // Caught inside, so one failed request does not end the stream
            // and leave the search box dead for the rest of the visit.
            catchError((err: HttpErrorResponse) => {
              this.showError(err);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.listLoads.next(this.query({ page: 1 }));
    this.refreshOptions();
    this.reloadRefs();
  }

  // ---------- list ----------

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchInput.next(term);
  }

  onFilter(change: Partial<ItemFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    // query() carries the search term too, so a filter change does not
    // silently discard what is still sitting in the search box.
    this.listLoads.next(this.query({ page: 1 }));
  }

  onPage(page: number): void {
    this.listLoads.next(this.query({ page }));
  }

  /** The current search, filters and page, with whatever the caller overrides. */
  private query(override: Partial<ItemQuery> = {}): ItemQuery {
    return {
      q: this.searchTerm() || undefined,
      ...this.filters(),
      page: this.meta().page,
      ...override,
    };
  }

  /**
   * Refetch the page being looked at. After a delete or archive it may no
   * longer exist; the server then serves the last page there is, and `meta`
   * reports which one that was.
   */
  private reloadList(): void {
    this.listLoads.next(this.query());
  }

  /** The dropdowns' categories, brands and manufacturers change with any write. */
  private refreshOptions(): void {
    this.catalogue.loadOptions().subscribe({ error: () => undefined });
  }

  /** The two management tables, on their current pages: item writes move the counts. */
  private reloadRefs(): void {
    this.catalogRefs
      .load('categories', this.categoriesMeta().page)
      .subscribe({ error: () => undefined });
    this.catalogRefs.load('brands', this.brandsMeta().page).subscribe({ error: () => undefined });
  }

  // ---------- adding ----------

  /** From the add card: create, then attach the PDF if one was picked. */
  submitAdd(payload: AddItemSubmit): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldIssues.set([]);

    this.catalogue.createItem(payload.item).subscribe({
      next: (res) => {
        const finish = (brochureFailure?: HttpErrorResponse) => {
          this.saving.set(false);
          this.toasts.success(res.message);
          this.addCard()?.reset();
          this.reloadList();
          this.refreshOptions();
          this.reloadRefs();
          // The item exists; only its PDF failed. Say so, after the toast.
          if (brochureFailure) this.showError(brochureFailure);
        };

        if (!payload.brochure) {
          finish();
          return;
        }
        this.catalogue.uploadBrochure(res.item.id, payload.brochure).subscribe({
          next: () => finish(),
          error: (err: HttpErrorResponse) => finish(err),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  // ---------- drawer ----------

  /** The list row has no units or history, so the drawer opens on a fresh read. */
  openItem(item: Item): void {
    this.error.set(null);
    this.catalogue.getItem(item.id).subscribe({
      next: (res) => {
        this.clearDrawerError();
        this.editing.set(res.item);
      },
      error: (err) => this.showError(err),
    });
  }

  closeDrawer(): void {
    this.editing.set(null);
  }

  update(changes: UpdateItemRequest): void {
    const item = this.editing();
    if (!item) return;

    this.beginWrite();
    this.catalogue
      .updateItem(item.id, changes)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          // Stays open on the saved copy: the new cost-history row shows at once.
          this.editing.set(res.item);
          this.refreshOptions();
          // A moved category/brand moves the usage counts below.
          this.reloadRefs();
        },
        error: (err) => this.showDrawerError(err),
      });
  }

  setArchived(isArchived: boolean): void {
    const item = this.editing();
    if (!item) return;

    this.beginWrite();
    this.catalogue
      .updateItem(item.id, { isArchived })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.closeDrawer();
          // Under the default filter the row has just left the list.
          this.reloadList();
        },
        error: (err) => this.showDrawerError(err),
      });
  }

  remove(): void {
    const item = this.editing();
    if (!item) return;

    this.beginWrite();
    this.catalogue
      .deleteItem(item.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.closeDrawer();
          this.reloadList();
          this.refreshOptions();
          this.reloadRefs();
        },
        error: (err) => this.showDrawerError(err),
      });
  }

  // ---------- the item's PDF ----------

  /** From a table row; failures land in the page banner. */
  openPdf(item: Item): void {
    this.error.set(null);
    this.catalogue.openBrochure(item.id).subscribe({ error: (err) => this.showError(err) });
  }

  /** From the drawer, for the item it is open on. */
  openCurrentPdf(): void {
    const item = this.editing();
    if (!item) return;
    this.clearDrawerError();
    this.catalogue.openBrochure(item.id).subscribe({ error: (err) => this.showDrawerError(err) });
  }

  uploadBrochure(file: File): void {
    const item = this.editing();
    if (!item) return;

    this.beginWrite();
    this.catalogue
      .uploadBrochure(item.id, file)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.editing.set(res.item);
        },
        error: (err) => this.showDrawerError(err),
      });
  }

  removeBrochure(): void {
    const item = this.editing();
    if (!item) return;

    this.beginWrite();
    this.catalogue
      .removeBrochure(item.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.editing.set(res.item);
        },
        error: (err) => this.showDrawerError(err),
      });
  }

  // ---------- categories & brands ----------

  addRef(kind: RefKind, name: string): void {
    this.beginPageWrite();
    this.catalogRefs
      .create(kind, name)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.refTable(kind)?.resetAdd();
          this.reloadRefs();
          // The dropdowns offer the new name at once.
          this.refreshOptions();
        },
        error: (err) => this.showError(err),
      });
  }

  renameRef(kind: RefKind, change: RefRename): void {
    this.beginPageWrite();
    this.catalogRefs
      .rename(kind, change.id, change.name)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.refreshOptions();
          // Items carry the id, so rows showing the old name follow suit.
          this.reloadList();
        },
        error: (err) => this.showError(err),
      });
  }

  /** From a row's Delete: nothing is sent until the modal says yes. */
  removeRef(kind: RefKind, ref: CatalogRef): void {
    this.refToDelete.set({ kind, ref });
  }

  cancelRemoveRef(): void {
    this.refToDelete.set(null);
  }

  confirmRemoveRef(): void {
    const target = this.refToDelete();
    if (!target) return;
    const { kind, ref } = target;
    // Closed before the request, so a refusal (still in use) shows in the
    // page banner rather than behind the modal.
    this.refToDelete.set(null);

    this.beginPageWrite();
    this.catalogRefs
      .remove(kind, ref.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          // Step back a page if the last row of a later page just went.
          const meta = kind === 'categories' ? this.categoriesMeta() : this.brandsMeta();
          const target =
            meta.page > 1 && (meta.total - 1) <= (meta.page - 1) * meta.pageSize
              ? meta.page - 1
              : meta.page;
          this.catalogRefs.load(kind, target).subscribe({ error: () => undefined });
          this.refreshOptions();
        },
        error: (err) => this.showError(err),
      });
  }

  onRefPage(kind: RefKind, page: number): void {
    this.catalogRefs.load(kind, page).subscribe({ error: () => undefined });
  }

  private refTable(kind: RefKind): RefTable | undefined {
    return kind === 'categories' ? this.categoriesTable() : this.brandsTable();
  }

  // ---------- plumbing ----------

  private beginWrite(): void {
    this.saving.set(true);
    this.clearDrawerError();
  }

  /** For writes whose errors belong in the page banner, not the drawer. */
  private beginPageWrite(): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldIssues.set([]);
  }

  private clearDrawerError(): void {
    this.drawerError.set(null);
    this.drawerIssues.set([]);
  }

  private showError(err: HttpErrorResponse): void {
    const body = err.error as ApiError | undefined;
    this.error.set(body?.message ?? this.translate.instant('common.somethingWentWrong'));
    this.fieldIssues.set(body?.issues ?? []);
  }

  private showDrawerError(err: HttpErrorResponse): void {
    const body = err.error as ApiError | undefined;
    this.drawerError.set(body?.message ?? this.translate.instant('common.somethingWentWrong'));
    this.drawerIssues.set(body?.issues ?? []);
  }
}
