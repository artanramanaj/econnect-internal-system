import { HotToastService } from '@ngxpert/hot-toast';
import { ToastType } from './toast';

/**
 * Test double for HotToastService: records each call instead of mounting the
 * real overlay in jsdom. Provide `stub.provider` and assert on `stub.calls`.
 */
export function toastStub() {
  const calls: [ToastType, string][] = [];
  const record = (type: ToastType) => (message: string) => {
    calls.push([type, message]);
  };

  return {
    calls,
    provider: {
      provide: HotToastService,
      useValue: {
        success: record('success'),
        error: record('error'),
        info: record('info'),
        warning: record('warning'),
      },
    },
  };
}
