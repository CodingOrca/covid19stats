import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { YesterdayData, CountryInfo, CaseData, MobilityData} from '../data-model';
@Injectable({
  providedIn: 'root'
})

export class DataService {

  constructor(private http: HttpClient) { 
  }

  async getYesterdaysWorldData(): Promise<YesterdayData>
  {
    let caseData = await this.http.get<YesterdayData>("https://corona.lmao.ninja/v2/all").toPromise();
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
    return await this.http.get<YesterdayData[]>("https://corona.lmao.ninja/v2/countries?yesterday=true").toPromise();
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
    let timeline = await this.http.get<HistTimeline>(`https://corona.lmao.ninja/v2/historical/All?lastdays=all`).toPromise();
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

  public async getMortalityRates(): Promise<Map<string,number>> 
  {
    let content = await this.http.get('assets/mortalityRate.csv', {responseType: 'text'}).toPromise();
    let splits = content.toString().split('\n');
    let result = new Map<string,number>();
    for(let i = 0; i < splits.length; i++) {
      let kv = splits[i].split('|');
      if(kv.length != 2) continue;
      let c = kv[0].trim();
      let n = Number.parseInt(kv[1].trim());
      result.set(c,n);
    }
    return result;
  }

  public async getMobilityData(): Promise<MobilityData[]> {
    let result = new Array<MobilityData>();
    let content = await this.http.get('assets/Global_Mobility_Report.csv', {responseType: 'text'}).toPromise();
    let splits = content.toString().split('\n');
    for(let i = 1; i < splits.length; i++) {
      let kv = splits[i].split(';');
      if(kv.length != 11) continue;
      let item = new MobilityData();
      item.iso2 = kv[0];
      item.region = kv[1];
      item.subRegion1 = kv[2];
      item.subRegion2 = kv[3];
      item.date = new Date(kv[4]);
      item.retailAndRecreation = Number.parseInt(kv[5]);
      item.groceryAndPharmacy = Number.parseInt(kv[6]);
      item.parks = Number.parseInt(kv[7]);
      item.transitStations = Number.parseInt(kv[8]);
      item.workplace = Number.parseInt(kv[9]);
      item.residential = Number.parseInt(kv[10]);
      result.push(item);
    }
    return result;
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

