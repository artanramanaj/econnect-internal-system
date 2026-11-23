import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/services/toast.service';
import { Toast } from './shared/components/toast/toast';

@Component({
  imports: [RouterOutlet, Toast],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // The one <app-toast> in the app lives here, so it survives every navigation.
  protected readonly toasts = inject(ToastService);
}
