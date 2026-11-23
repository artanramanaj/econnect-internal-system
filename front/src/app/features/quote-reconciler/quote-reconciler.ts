import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-quote-reconciler',
  styleUrl: './quote-reconciler.css',
  templateUrl: './quote-reconciler.html',
})
export class QuoteReconciler {}
