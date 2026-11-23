import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-daily-cost-engine',
  styleUrl: './daily-cost-engine.css',
  templateUrl: './daily-cost-engine.html',
})
export class DailyCostEngine {}
