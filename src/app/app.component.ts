import { Component, OnInit, ViewChild } from '@angular/core';
import { DataService, CaseData } from 'src/app/novelcovid.service'
import {MatTableDataSource} from '@angular/material/table';
import {MatSort, SortDirection} from '@angular/material/sort';
import { ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  title = 'COVID-19';
  currentCountry: SummaryViewData;

  displayedColumns: string[] = ['country', 'cases', 'deaths'];
  tableData: MatTableDataSource<SummaryViewData> = new MatTableDataSource();
  allHistoricalData: Map<string,CaseData[]>;

  currentHistory: Array<CaseData>;
  currentCasesSeries: Array<DataSeries>;
  currentDoublingSeries: Array<DataSeries>;
  currentLogSeries: Array<DataSeries>;
  currentDeltaSeries : Array<DataPoint>;

  public yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  yAxisTickFormatting(value) {
    return Math.round(value); // this is where you can change the formatting
  }

  public logAxisTickFormattingFn = this.logAxisTickFormatting.bind(this);
  logAxisTickFormatting(value) {
    let l = Math.round(Math.exp(value)); 
    return this.exponentialNotationOf(l);
  }

  private pad(num:number, size:number): string {
    let s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

  public dateAxisTickFormattingFn = this.dateAxisTickFormatting.bind(this);
  dateAxisTickFormatting(value) {
    let date = new Date(value);
    return `${this.pad(date.getDate(), 2)}.${this.pad(date.getMonth() + 1, 2)}`;
  }

  view: any[] = [600, 400];

  // options
  legend: boolean = false;
  legendPosition: string = "below";
  showLabels: boolean = true;
  animations: boolean = true;
  xAxis: boolean = true;
  yAxis: boolean = true;
  showYAxisLabel: boolean = false;
  showXAxisLabel: boolean = true;
  xAxisLabel: string = 'Date';
  xLogLabel: string = "log(cases)"
  yAxisLabel: string = 'Cases [thousands]';
  dAxisLabel: string = "Doubling Time [days]";
  gAxisLabel: string = "New cases";
  yLogLabel: string = "log(new cases)";
  logTicks: number[] = [0, Math.log(10), Math.log(100), Math.log(1000), Math.log(10000), Math.log(100000), Math.log(1000000), Math.log(10000000), Math.log(100000000)];
  linTicks: number[] = [0, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
  timeline: boolean = false;

  get yScaleMaxCases() {
    return this.currentHistory
      .filter(h => h.updated >= this.xTimeScaleMin)
      .reduce((m,h) => h.cases > m ? h.cases : m, this.maxCases);
  }

  get yScaleMaxDelta() {
    return this.currentHistory
      .filter(h => h.updated >= this.xTimeScaleMin)
      .reduce((m,h) => h.delta > m ? h.delta : m, this.maxDelta);
  }

  maxCases: number = 1;
  maxDelta: number = 1;

  totalCaption: string = "Cases over time";
  deltaCaption: string = "New cases per day";
  logCaption: string = "new vs. total cases (logarithmic)";
  doublingCaption: string = "Doubling time over time";
  
  xLogScaleMin: number = Math.log(10);
  xLogScaleMax: number = Math.log(10000000);
  yLogScaleMin: number = 0;
  yLogScaleMax: number = Math.log(1000000);

  xTimeScaleMin: Date = new Date(Date.now() - 30 * 1000 * 60 * 60 * 24);

  colorScheme = {
    domain: [ '#E44D25', '#5AA454', '#E4C454','#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5']
  };

  constructor(private dataService: DataService) {
  }

  private exponentialNotationOf(l: number) {
    switch (l) {
      case 1: return "1";
      case 10: return "10";
      case 100: return "10^2";
      case 1000: return "10^3";
      case 10000: return "10^4";
      case 100000: return "10^5";
      case 1000000: return "10^6";
      case 10000000: return "10^7";
      case 100000000: return "10^8";
      case 1000000000: return "10^9";
    }
    return l;
  }

  async ngOnInit(): Promise<void> {

    let country = await this.dataService.getLatestWorldData();

    // get ALL historical data, of all provinces:
    this.allHistoricalData = await this.dataService.getAllHistoricalData();

    this.maxCases = 1;
    this.maxDelta = 1;

    // this will hold the latest data for each country:
    let results = new Array<SummaryViewData>();
    for(let country of this.allHistoricalData)
    {
      var countryHistory = country[1];
      this.calculateDeltaAndCo(countryHistory);
      let s = this.CreateSummaryViewData(countryHistory);
      results.push(s);
    }

    // sort by cases:
    this.tableData = new MatTableDataSource(results.sort((x, y) => x.cases > y.cases ? -1 : 1));
    this.tableData.sort = this.matSort;

    this.selectCountry(this.tableData.data[0]);
  }

  private CreateSummaryViewData(countryHistory: CaseData[]) {
    let s = new SummaryViewData();
    s.copyFrom(countryHistory[countryHistory.length - 1]);
    s.deltaDelta = s.delta - countryHistory[countryHistory.length - 2].delta;
    s.activeDelta = s.active - countryHistory[countryHistory.length - 2].active;
    s.recoveredDelta = s.recovered - countryHistory[countryHistory.length - 2].recovered;
    s.deathsDelta = s.deaths - countryHistory[countryHistory.length - 2].deaths;
    s.doublingTimeDelta = s.doublingTime - countryHistory[countryHistory.length - 2].doublingTime;
    s.growthRateDelta = s.growthRate - countryHistory[countryHistory.length - 2].growthRate;
    return s;
  }

  calculateDeltaAndCo(countryHistory: CaseData[]) {
    let i: number = 0;
    for (let entry of countryHistory) {
      entry.doublingTime = 0;
      if (i >= 4) {
        entry.doublingTime = this.CalculateDT(countryHistory, i-4, i);
        if(entry.doublingTime == -1)
        {
          entry.doublingTime = history[i - 1].doublingPoint;
        }
      }
      entry.delta = 0;
      entry.growthRate = 0;
      if(i > 0)
      {
        entry.delta = entry.cases - countryHistory[i-1].cases;
        if(countryHistory[i-1].cases > 0) {
          entry.growthRate = Math.round(100 *  entry.delta / countryHistory[i-1].cases);
        }
      }
      if(entry.country != "World" && entry.country != "USA") {
        if(this.maxCases < entry.cases) this.maxCases = entry.cases;
        if(this.maxDelta < entry.delta) this.maxDelta = entry.delta;
      }
      i++;
    }
  }

  private async RenderCountryHistory(countryName: string) {
    this.currentHistory = this.allHistoricalData.get(countryName);

    let activeCases = new DataSeries();
    activeCases.name = "Active";
    activeCases.series = new Array<DataPoint>();

    let deathCases = new DataSeries();
    deathCases.name = "Deaths";
    deathCases.series = new Array<DataPoint>();

    let recoveredCases = new DataSeries();
    recoveredCases.name = "Recovered";
    recoveredCases.series = new Array<DataPoint>();

    let doublingTimes = new DataSeries();
    doublingTimes.name = "Doubling times";
    doublingTimes.series = new Array<DataPoint>();

    let logarithmicValues = new DataSeries();
    logarithmicValues.name = "Cases";
    logarithmicValues.series = new Array<DataPoint>();

    let deltaCases = new Array<DataPoint>();

    let i: number = 0;
    for (let entry of this.currentHistory) {
      recoveredCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.recovered));
      deathCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.deaths));
      activeCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.active));

      doublingTimes.series.push(AppComponent.CreateDataPoint(entry.updated, entry.doublingTime));

      if(i > 0 && entry.cases > 0 && entry.delta > 0)
      {
        let logarithmicPoint = new DataPoint();
        logarithmicPoint.name = Math.log(entry.cases);
        logarithmicPoint.value = Math.log(entry.delta);
        logarithmicValues.series.push(logarithmicPoint);
      }

      if(i > 0 && entry.updated >= this.xTimeScaleMin)
      {
        let newCase = new DataPoint();
        newCase.name = Number(entry.updated);
        newCase.value = entry.delta;
        deltaCases.push(newCase);
      }
      i++;
    }
    this.currentCasesSeries = new Array<DataSeries>();
    this.currentCasesSeries.push(deathCases);
    this.currentCasesSeries.push(recoveredCases);
    this.currentCasesSeries.push(activeCases);
    
    this.currentDoublingSeries = new Array<DataSeries>();
    this.currentDoublingSeries.push(doublingTimes);

    this.currentLogSeries = new Array<DataSeries>();
    this.currentLogSeries.push(logarithmicValues)

    this.currentDeltaSeries = deltaCases;
  }

  private CalculateDoublingTime(hist: CaseData[], i: number): number {
    let base = hist[i - 1].cases;
    if(base < 100) return -1; // makes no sense;

    let current = hist[i].cases;
    if (current > base) {
      return Math.log(2) / Math.log(current / base);
    }
    return -1; // makes no sense
  }

  private static CreateDataPoint(date: Date, value: number): DataPoint {
    let recovered = new DataPoint();
    recovered.name = new Date(+date); //new DatePipe("en").transform(date, "dd.MM");
    recovered.value = value;
    return recovered;
  }

  private static CreateAggregatedJhuCountry(countryName: string, countryData: CaseData[]): SummaryViewData {
    let c = new SummaryViewData();
    c.country = countryName;
    c.updated = countryData[0].updated;
    c.cases = countryData.map(x => x.cases).reduce((sum: any, c: number) => { return sum + c; }, 0);
    c.recovered = countryData.map(x => x.recovered).reduce((sum: any, c: number) => { return sum + c; }, 0);
    c.deaths = countryData.map(x => x.deaths).reduce((sum: any, c: number) => { return sum + c; }, 0);
    return c;
  }

  private CalculateDT(c: CaseData[], start: number, end: number)
  {
    let sumy = 0;
    let sumxylny = 0;
    let sumxy = 0;
    let sumylny = 0;
    let sumx2y = 0;
    for(let i = start; i <= end; i++) 
    {
      let x = i - start;
      let y = c[i].cases;
      if(y < 10) return 0;
      sumy += y;
      sumxylny += x*y*Math.log(y);
      sumxy += x*y;
      sumylny += y*Math.log(y);
      sumx2y += x*x*y;
    }
    let b = (sumy * sumxylny - sumxy * sumylny) / (sumy * sumx2y - sumxy * sumxy); 
    if(b < 0.0001) return 0;
    return Math.log(2) / b;
  }

  onSelect(event) {
    console.log(event);
  }

  selectCountry(country: SummaryViewData) {
    this.currentCountry = country;
    this.tableData.filter = "";
    this.tableData._updateChangeSubscription();
    this.RenderCountryHistory(country.country);
  }

  openGitHub()
  {
    window.open("https://github.com/CodingOrca/covid19stats/blob/master/README.md");
  }
}

export class DataSeries {
  name: string;
  series: Array<DataPoint>;
}

export class DataPoint {
  name: Date | number;
  value: number;
}

// icons: arrow_drop_up, _drop_down or _left or _right
export enum Tendency {
  up, down, unchanged
}

export class SummaryViewData extends CaseData {
  recoveredDelta: Tendency;
  deathsDelta: Tendency;
  activeDelta: Tendency;
  deltaDelta: number;
  doublingTimeDelta: Tendency;
  growthRateDelta: Tendency;
}