import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  get country(): string {
    return localStorage.getItem("selectedCountry");
  } 
  
  set country(country: string) {
    localStorage.setItem("selectedCountry", country);
  }

  get tabIndex(): number {
    let s = localStorage.getItem("selectedTab");
    if(s == null) return 0;
    return Number.parseInt(s);
  }

  set tabIndex(i: number) {
    localStorage.setItem("selectedTab", i.toString())
  }

  private myPerMilSummary = new BehaviorSubject<boolean>(false);
  perMilSummary = this.myPerMilSummary.asObservable();
  setPerMilSummary(on: boolean) {
    this.myPerMilSummary.next(on);
    localStorage.setItem("perMillSummary", on.toString());
  }

  constructor() {     
    this.myPerMilSummary.next(JSON.parse(localStorage.getItem("perMillSummary")));
  }
}
