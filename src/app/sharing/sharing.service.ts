import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint, MobilityData} from '../data-model';
import { SettingsService } from '../settings/settings.service';
import { DataService } from '../data/data.service';

@Injectable({
  providedIn: 'root'
})
export class SharingService {
  infectiousPeriod: number = 5;
  quarantinePeriod: number = 14;
  maximumInfectionPeriod: number = 28;
  daysForAverage: number = 7;

  private selectedCountriesBS = new BehaviorSubject<SummaryViewData>(new SummaryViewData());
  selectedCountry = this.selectedCountriesBS.asObservable();
  selectCountry(country: SummaryViewData) {
    this.selectedCountriesBS.next(country);
    if (country != null) {
      let data = this.allMobilityData.filter(m => m.iso2 == this.selectedCountriesBS.value.iso2 && !m.subRegion2 && !m.subRegion1);
      this.mobilityDataBS.next(data);
      this.currentHistoryBS.next(this.allHistoricalData.get(country.country))
    }
    else
    {
      this.mobilityDataBS.next(new Array<MobilityData>());
      this.currentHistoryBS.next(new Array<CaseData>());
    }
  }

  private mobilityDataBS = new BehaviorSubject<MobilityData[]>(new Array<MobilityData>());
  mobilityData = this.mobilityDataBS.asObservable();

  private countriesBS = new BehaviorSubject<SummaryViewData[]>(new Array<SummaryViewData>());
  countries = this.countriesBS.asObservable();

  private currentHistoryBS = new BehaviorSubject<CaseData[]>(new Array<CaseData>());
  currentHistory = this.currentHistoryBS.asObservable();

  constructor(private settings: SettingsService, private dataService: DataService) {
  }

  private allHistoricalData: Map<string, CaseData[]> = new Map<string, CaseData[]>();
  private allMobilityData: MobilityData[] = new Array<MobilityData>();

  private getMobilityData(iso2: string = null): MobilityData[] {
    return this.allMobilityData.filter(m => m.iso2 == iso2 && !m.subRegion2 && !m.subRegion1);
  }

  async load() {
    this.allMobilityData = await this.dataService.getMobilityData();

    // get ALL historical data, of all provinces:
    this.allHistoricalData = await this.dataService.getAllHistoricalData();
    let yesterdayData = await this.dataService.getYesterdaysData();
    let mortalityRates = await this.dataService.getMortalityRates();

    // this will hold the latest data for each country:
    let results = new Array<SummaryViewData>();
    for (let country of this.allHistoricalData) {
      let cn = country[0];
      switch (country[0].toLowerCase()) {
        case "west bank and gaza":
          cn = "Palestine";
        case "lao people\"s democratic republic":
          cn = "Lao People's Democratic Republic";
        case "holy see":
          cn = "Holy See (Vatican City State)";
        case "cote d'ivoire":
          cn = "Côte d'Ivoire";
        case "burma":
          cn = "Myanmar";
      }
      var countryHistory = country[1];
      var countryDetails = yesterdayData.find(e => e.country == cn);
      if (countryDetails == null && cn == "World") {
        countryDetails = await this.dataService.getYesterdaysWorldData();
      }
      this.calculateDeltaAndCo(countryDetails, countryHistory);
      let s = this.CreateSummaryViewData(countryDetails, countryHistory);
      if (mortalityRates.has(cn)) {
        s.mortalityRate = mortalityRates.get(cn);
      }
      results.push(s);
    }

    this.countriesBS.next(results.sort((x, y) => x.cases > y.cases ? -1 : 1));
    this.settings.country.subscribe(c => {
      let cc = this.countriesBS.value.find(d => d.country == c);
      if (cc == null && this.countriesBS.value.length > 0) cc = this.countriesBS.value[0];
      this.selectCountry(cc);
    });
  }

  private CreateSummaryViewData(countryDetails: YesterdayData, countryHistory: CaseData[]) {
    let s = new SummaryViewData();
    s.copyFrom(countryHistory[countryHistory.length - 1]);
    s.deltaDelta = s.delta - countryHistory[countryHistory.length - 2].delta;
    s.activeDelta = s.active - countryHistory[countryHistory.length - 2].active;
    s.recoveredDelta = s.recovered - countryHistory[countryHistory.length - 2].recovered;
    s.deathsDelta = s.deaths - countryHistory[countryHistory.length - 2].deaths;
    s.reproductionNumberDelta = s.reproductionNumber - countryHistory[countryHistory.length - 2].reproductionNumber;
    s.infectionRateDelta = s.infectionRate - countryHistory[countryHistory.length - 2].infectionRate;
    let mData = this.getMobilityData(countryDetails?.countryInfo?.iso2);
    if (mData != null && mData.length > 0)
      s.mobilityChange = SharingService.calculateAverageMobility(mData.length - 1, this.daysForAverage, mData);
    else s.mobilityChange = null;

    if (countryDetails != null) {
      s.todayCases = countryDetails.todayCases;
      s.todayDeaths = countryDetails.todayDeaths;
      s.critical = countryDetails.critical;
      s.tests = countryDetails.tests;
      s.testsPerMille = countryDetails.testsPerOneMillion / 1000.0;
      s.casesPerMille = countryDetails.casesPerOneMillion / 1000.0;
      s.deathsPerMille = countryDetails.deathsPerOneMillion / 1000.0;
      s.flag = countryDetails.countryInfo.flag;
      s.iso2 = countryDetails.countryInfo.iso2;
    }
    return s;
  }

  calculateDeltaAndCo(countryDetails: YesterdayData, countryHistory: CaseData[]) {
    for (let i = 0; i < countryHistory.length; i++) {
      let entry = countryHistory[i];
      entry.correctedDelta = entry.delta = 0;
      entry.infectionRate = 0;
      entry.assumedInfectious = 0;
      entry.assumedQuarantine = 0;
      if (i > 0) {
        entry.delta = entry.cases - countryHistory[i - 1].cases;
        this.calculateDeltaCorrectionFactor(i, countryHistory);
      }
    }

    for (let i = 0; i < countryHistory.length; i++) {
      let entry = countryHistory[i];
      if (i > 0) {
        entry.assumedInfectious = countryHistory[i - 1].assumedInfectious;
        entry.assumedQuarantine = countryHistory[i - 1].assumedQuarantine
        entry.assumedInfectious += entry.correctedDelta;
        if (i > this.infectiousPeriod) {
          entry.assumedInfectious -= countryHistory[i - this.infectiousPeriod].correctedDelta;
          entry.assumedQuarantine += countryHistory[i - this.infectiousPeriod].correctedDelta;
        }
        if (i > this.quarantinePeriod) {
          entry.assumedQuarantine -= countryHistory[i - this.quarantinePeriod].correctedDelta;
        }
        let j = Math.min(this.daysForAverage, i);
        entry.infectionRate = 100 * this.calculateAverageReproductionRate(i, j, countryHistory);
      }
      entry.reproductionNumber = entry.infectionRate / 100 * this.infectiousPeriod;
    }
  }

  // if delta for n is negative, the correction of cases is distributed across the previous
  // 'quarantinePeriod', with a quantity proportional to the delta of that day, so that
  // the negative delta of this day is corrected to 0.
  calculateDeltaCorrectionFactor(n: number, h: CaseData[]): number {
    if (h[n].delta >= 0) {
      h[n].correctedDelta = h[n].delta;
      return;
    }
    h[n].correctedDelta = 0;
    let positives = 0;
    let start = Math.max(0, n - this.quarantinePeriod);
    for (let i = start; i < n; i++) {
      positives += h[i].correctedDelta;
    }
    if (positives <= 0) return;
    let factor = (positives + h[n].delta) / positives;
    for (let i = start; i < n; i++) {
      h[i].correctedDelta *= factor;
    }
  }

  calculateAverageReproductionRate(n: number, m: number, hist: CaseData[]): number {
    let a = 0;
    let b = 0;
    for (let i = n - m; i < n; i++) {
      b += (- 2 * hist[i + 1].correctedDelta * hist[i].assumedInfectious);
      a += hist[i].assumedInfectious * hist[i].assumedInfectious;
    }
    if (a == 0) return 0;
    return -b / (2 * a);
  }

  static calculateAverageMobility(i: number, averagePeriod: number, hist: MobilityData[]) {
    let avg = 0;
    let count = Math.min(averagePeriod - 1, i);
    for (let k = i - count; k <= i; k++) {
      avg += hist[k].average / (count + 1);
    }
    return avg;
  }
}
