import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private countryBS = new BehaviorSubject<string>(null);
  country = this.countryBS.asObservable();  
  setCountry(country: string) {
    localStorage.setItem("selectedCountry", country);
    this.countryBS.next(country);
  }

  private tabIndexBS = new BehaviorSubject<number>(0);
  tabIndex = this.tabIndexBS.asObservable();
  setTabIndex(index: number) {
    localStorage.setItem("selectedTab", index.toString())
    this.tabIndexBS.next(index);
  }

  private perMilSummaryBS = new BehaviorSubject<boolean>(false);
  perMilSummary = this.perMilSummaryBS.asObservable();
  setPerMilSummary(on: boolean) {
    this.perMilSummaryBS.next(on);
    localStorage.setItem("perMillSummary", on.toString());
  }

  constructor() {
    let perMillSummaryString = localStorage.getItem("perMillSummary");
    if (!perMillSummaryString) this.perMilSummaryBS.next(false);
    else this.perMilSummaryBS.next(JSON.parse(perMillSummaryString));

    let tabIndexString = localStorage.getItem("selectedTab");
    if (!tabIndexString) this.tabIndexBS.next(0);
    else this.tabIndexBS.next(Number.parseInt(tabIndexString));

    this.countryBS.next(localStorage.getItem("selectedCountry"))
  }
}
