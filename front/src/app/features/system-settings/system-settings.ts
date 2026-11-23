import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-system-settings',
  styleUrl: './system-settings.css',
  templateUrl: './system-settings.html',
})
export class SystemSettings {}
