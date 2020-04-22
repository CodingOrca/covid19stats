import { TestBed } from '@angular/core/testing';

import { NovelCovidService } from './novel-covid.service';

describe('NovelCovidService', () => {
  let service: NovelCovidService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NovelCovidService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
