import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint, MobilityData} from '../data-model';
import { SettingsService } from '../settings/settings.service';
import { DataService } from '../data/data.service';

@Injectable({
  providedIn: 'root'
})
export class SharingService {
  private mySelectedCountry = new BehaviorSubject<SummaryViewData>(new SummaryViewData());
  selectedCountry = this.mySelectedCountry.asObservable();
  setSelectedCountry(country: SummaryViewData) {
    this.mySelectedCountry.next(country);
    if(country != null) {
      this.settings.country = country.country;
    }
  }

  private mobilityDataBS = new BehaviorSubject<MobilityData[]>(new Array<MobilityData>());
  mobilityData = this.mobilityDataBS.asObservable();
  setMobilityData(data: MobilityData[]) {
    this.mobilityDataBS.next(data);
  }

  constructor(private settings: SettingsService, private dataService: DataService) { 
  }
}
