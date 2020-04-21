import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private mySelectedCountry = new BehaviorSubject<string>('');
  selectedCountry = this.mySelectedCountry.asObservable();
  setSelectedCountry(country: string) {
    this.mySelectedCountry.next(country);
    localStorage.setItem("selectedCountry", country);
  }

  private myPerMilSummary = new BehaviorSubject<boolean>(false);
  perMilSummary = this.myPerMilSummary.asObservable();
  setPerMilSummary(on: boolean) {
    this.myPerMilSummary.next(on);
    localStorage.setItem("perMillSummary", on.toString());
  }


  constructor() {     
    this.mySelectedCountry.next(localStorage.getItem("selectedCountry"));
    this.myPerMilSummary.next(JSON.parse(localStorage.getItem("perMillSummary")));
  }
}
