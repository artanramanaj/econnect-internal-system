import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { TeamAllocations } from './team-allocations';

describe('TeamAllocations', () => {
  let component: TeamAllocations;
  let fixture: ComponentFixture<TeamAllocations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamAllocations],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamAllocations);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
