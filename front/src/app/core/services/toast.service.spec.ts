import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = TestBed.inject(ToastService);
  });

  it('should start with nothing to show', () => {
    expect(service.current()).toBeNull();
  });

  it('should expose a success message', () => {
    service.success('Signed in');
    expect(service.current()).toEqual({ text: 'Signed in', type: 'success' });
  });

  it('should expose an error message', () => {
    service.error('Nope');
    expect(service.current()).toEqual({ text: 'Nope', type: 'error' });
  });

  it('should produce a new object for a repeated text, so the toast fires again', () => {
    service.success('Saved.');
    const first = service.current();
    service.success('Saved.');

    expect(service.current()).toEqual(first);
    expect(service.current()).not.toBe(first);
  });
});
