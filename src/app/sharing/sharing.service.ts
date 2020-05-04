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
    if (country != null) {
      this.settings.country = country.country;
      let data = this._allMobilityData.filter(m => m.iso2 == this.mySelectedCountry.value.iso2 && !m.subRegion2 && !m.subRegion1);
      this.mobilityDataBS.next(data);
    }
    else
    {
      this.settings.country = null;
      this.mobilityDataBS.next(new Array<MobilityData>());
      }
  
  }

  private _allMobilityData: MobilityData[] = new Array<MobilityData>();
  public getMobilityData(iso2: string = null): MobilityData[] {
    return this._allMobilityData.filter(m => m.iso2 == iso2 && !m.subRegion2 && !m.subRegion1);
  }

  private mobilityDataBS = new BehaviorSubject<MobilityData[]>(new Array<MobilityData>());
  mobilityData = this.mobilityDataBS.asObservable();
  async loadMobilityData() {
    this._allMobilityData = await this.dataService.getMobilityData();
    if (this.mySelectedCountry != null) {
      let data = this._allMobilityData.filter(
        m => m.iso2 == this.mySelectedCountry.value.iso2 && !m.subRegion2 && !m.subRegion1);
      this.mobilityDataBS.next(data);
    }
  }

  constructor(private settings: SettingsService, private dataService: DataService) {
  }
}
