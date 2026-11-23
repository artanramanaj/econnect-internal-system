import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-team-allocations',
  styleUrl: './team-allocations.css',
  templateUrl: './team-allocations.html',
})
export class TeamAllocations {}
