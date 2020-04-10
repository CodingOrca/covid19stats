import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})

export class DataService {

  constructor(private http: HttpClient) { 
  }

  async getYesterdaysWorldData(): Promise<YesterdayData>
  {
    let caseData = await this.http.get<YesterdayData>("https://corona.lmao.ninja/all").toPromise();
    caseData.country = "World";
    caseData.countryInfo = new CountryInfo();
    caseData.countryInfo.flag = "assets/globe_PNG62.png"
    return caseData;
  }

  async getLatestCountryData(): Promise<Array<CaseData>>
  {
    var jhuCountries = await this.http.get<Array<JhuCountry>>("https://corona.lmao.ninja/v2/jhucsse").toPromise();
    let result = new Array<CaseData>();
    for(let jhuCountry of jhuCountries)
    {
      let caseData = new CaseData();
      caseData.country = jhuCountry.country;
      caseData.cases = jhuCountry.stats.confirmed;
      caseData.deaths = jhuCountry.stats.deaths;
      caseData.recovered = jhuCountry.stats.recovered;
      result.push(caseData);
    }
    return result;
  }

  async getHistoricalCountryData(countryName: string): Promise<Array<CaseData>>
  {
    let history = await this.http.get<HistCountry>(`https://corona.lmao.ninja/v2/historical/${encodeURIComponent(countryName)}`).toPromise();
    let result = new Array<CaseData>();
    let keys = Object.keys(history.timeline.cases);

    for(let key of keys)
    {
      let caseData = new CaseData();
      caseData.country = history.country;
      caseData.updated = new Date(key);

      caseData.cases = history.timeline.cases[key];
      caseData.recovered = history.timeline.recovered[key];
      caseData.deaths = history.timeline.deaths[key];

      result.push(caseData);
    }  

    return result;
  }

  async getYesterdaysData(): Promise<YesterdayData[]> {
    return await this.http.get<YesterdayData[]>("https://corona.lmao.ninja/yesterday?sort=cases").toPromise();
  }

  async getAllHistoricalData(): Promise<Map<string,CaseData[]>>
  {
    let allHistory = await this.http.get<HistCountry[]>(`https://corona.lmao.ninja/v2/historical?lastdays=all`).toPromise();
    let result = new Map<string, CaseData[]>();
    for(let provinceHistory of allHistory)
    {
      if(!result.has(provinceHistory.country))
      {
         result.set(provinceHistory.country, new Array<CaseData>());
      }
      let history = result.get(provinceHistory.country);
      let keys = Object.keys(provinceHistory.timeline.cases);

      for(let key of keys)
      {
        let date = new Date(key);
        let caseData = history.find (
          cd => cd.updated.getDate() == date.getDate() && 
          cd.updated.getMonth() == date.getMonth() && 
          cd.updated.getFullYear() == date.getFullYear()
        );

        if(caseData == null)
        {
          caseData = new CaseData();
          caseData.country = provinceHistory.country;
          caseData.updated = date;
          caseData.cases = caseData.recovered = caseData.deaths = 0;
          history.push(caseData);
        }
        caseData.cases += provinceHistory.timeline.cases[key];
        caseData.recovered += provinceHistory.timeline.recovered[key];
        caseData.deaths += provinceHistory.timeline.deaths[key];
      }
    }
    result.set("World", await this.getHistoricalWorldData());
    return result;
  }

  private async getHistoricalWorldData(): Promise<CaseData[]>
  {
    let timeline = await this.http.get<HistTimeline>(`https://corona.lmao.ninja/v2/historical/All`).toPromise();
    let result = new Array<CaseData>();
    let keys = Object.keys(timeline.cases);

    for(let key of keys)
    {
      let caseData = new CaseData();
      caseData.country = "World";
      caseData.updated = new Date(key);

      caseData.cases = timeline.cases[key];
      caseData.recovered = timeline.recovered[key];
      caseData.deaths = timeline.deaths[key];

      result.push(caseData);
    }  

    return result;
  }
}

export class CaseData {
  updated: Date;

  country: string; 
  cases: number;
  deaths: number;
  recovered: number;
  get active(): number {
    return this.cases - this.recovered - this.deaths;
  }

  delta: number;
  doublingTime: number;
  growthRate: number;

  public copyFrom(c: CaseData) {
    this.country = c.country;
    this.cases = c.cases;
    this.deaths = c.deaths;
    this.recovered = c.recovered;
    this.updated = new Date(c.updated);
    this.delta = c.delta;
    this.doublingTime = c.doublingTime;
    this.growthRate = c.growthRate;
  }
}

class JhuCountry {
  country: string;
  province: string;
  updatedAt: string;
  stats: JhuCaseData;
  coordinates: Coordinates;
}

class JhuCaseData {
  confirmed: number | null;
  deaths: number | null;
  recovered: number;
}

class HistCountry {
  country: string;
  provinces: Array<string>;
  timeline: HistTimeline;
}

class HistTimeline {
  cases: any;
  deaths: any;
  recovered: any;
}

export class CountryInfo {
  iso2: string;
  iso3: string;
  lat: number;
  long: number;
  flag: string;
}

export class YesterdayData {
  updated: number;
  country: string;
  countryInfo: CountryInfo;
  cases: number;
  todayCases: number;
  deaths: number;
  todayDeaths: number;
  recovered: number;
  active: number;
  critical: number;
  casesPerOneMillion: number;
  deathsPerOneMillion: number;
  tests: number;
  testsPerOneMillion: number; 
}