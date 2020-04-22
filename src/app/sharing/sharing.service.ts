import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint} from '../data-model';
import { SettingsService } from '../settings/settings.service';

@Injectable({
  providedIn: 'root'
})
export class SharingService {
  private mySelectedCountry = new BehaviorSubject<SummaryViewData>(null);
  selectedCountry = this.mySelectedCountry.asObservable();
  setSelectedCountry(country: SummaryViewData) {
    this.mySelectedCountry.next(country);
    this.settings.country = country.country;
  }

  constructor(private settings: SettingsService) { }
}
