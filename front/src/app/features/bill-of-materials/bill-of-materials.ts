import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-bill-of-materials',
  styleUrl: './bill-of-materials.css',
  templateUrl: './bill-of-materials.html',
})
export class BillOfMaterials {}
