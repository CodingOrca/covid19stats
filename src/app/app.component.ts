import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { DataService, CaseData, YesterdayData } from 'src/app/novelcovid.service'
import {MatTableDataSource} from '@angular/material/table';
import {MatSort, SortDirection} from '@angular/material/sort';
import { ViewEncapsulation } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit{

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  title = 'COVID-19';
  currentCountry: SummaryViewData;

  // displayedColumns: string[] = ['country', 'cases', 'delta', 'active', 'recovered', 'deaths', 'growthRate', 'doublingTime'];
  displayedColumns: string[] = ['country', 'cases', 'active', 'critical', 'deaths'];
  tableData: MatTableDataSource<SummaryViewData> = new MatTableDataSource();
  allHistoricalData: Map<string,CaseData[]>;

  currentHistory: Array<CaseData>;
  currentCasesSeries: Array<DataSeries>;
  currentDoublingSeries: Array<DataSeries>;
  currentLogSeries: Array<DataSeries>;
  currentDeltaSeries : Array<DataPoint>;

  public yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  yAxisTickFormatting(value: number) {
    let suffix = "";
    if(value > 1000)
    {
      suffix = "k";
      value = value / 1000;
    };
    return `${Math.round(value)}${suffix}`;
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
  xLogTicks: number[] = [Math.log(10), Math.log(100), Math.log(1000), Math.log(10000), Math.log(100000), Math.log(1000000)];
  yLogTicks: number[] = [0, Math.log(10), Math.log(100), Math.log(1000), Math.log(10000), Math.log(100000)];
  linTicks: number[] = [10, 100, 1000, 10000, 100000];
  timeline: boolean = false;
  xLogScaleMin: number = Math.log(10);
  xLogScaleMax: number = Math.log(10000000);
  yLogScaleMin: number = 0;
  yLogScaleMax: number = Math.log(1000000);


  deltaTimeTicks: Array<Number | Date> = [new Date(2020,0,22), Date.now()];
  private setDeltaTimeTicks() {
    this.deltaTimeTicks = new Array<Number | Date>();
    for(let i = 0; i < this.currentDeltaSeries.length; i++) {
      let date = new Date(this.currentDeltaSeries[i].name);
      if(date.getDay() == 0) {
        this.deltaTimeTicks.push(this.currentDeltaSeries[i].name);
      }
    }
  }

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
  maxDelta: number = 10000;

  totalCaption: string = "Cases over time";
  deltaCaption: string = "New cases per day";
  logCaption: string = "new vs. total cases (logarithmic)";
  doublingCaption: string = "Doubling time over time";
  
  xTimeScaleMin: Date = new Date(Date.now() - 30 * 1000 * 60 * 60 * 24);
  xTimeScaleMax: Date = new Date(Date.now() - 1 * 1000 * 60 * 60 * 24);

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

    let country = await this.dataService.getYesterdaysWorldData();

    // get ALL historical data, of all provinces:
    this.allHistoricalData = await this.dataService.getAllHistoricalData();
    let yesterdayData = await this.dataService.getYesterdaysData();

    this.maxCases = 1;
    this.maxDelta = 10000;

    // this will hold the latest data for each country:
    let results = new Array<SummaryViewData>();
    for(let country of this.allHistoricalData)
    {
      let cn = country[0];
      switch(country[0].toLowerCase())
      {
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
      if(countryDetails == null && cn == "World")
      {
        countryDetails = await this.dataService.getYesterdaysWorldData();
      }
      this.calculateDeltaAndCo(countryHistory);
      let s = this.CreateSummaryViewData(countryDetails, countryHistory);
      results.push(s);
    }

    // sort by cases:
    this.tableData = new MatTableDataSource(results.sort((x, y) => x.cases > y.cases ? -1 : 1));
    this.tableData.sort = this.matSort;

    this.selectCountry(this.tableData.data[0]);
  }

  ngAfterViewInit() {
    this.tableData.sort.active = "cases";
    this.tableData.sort._markInitialized();
    this.tableData._updateChangeSubscription();
  }

  private CreateSummaryViewData(countryDetails: YesterdayData, countryHistory: CaseData[]) {
    let s = new SummaryViewData();
    s.copyFrom(countryHistory[countryHistory.length - 1]);
    s.deltaDelta = s.delta - countryHistory[countryHistory.length - 2].delta;
    s.activeDelta = s.active - countryHistory[countryHistory.length - 2].active;
    s.recoveredDelta = s.recovered - countryHistory[countryHistory.length - 2].recovered;
    s.deathsDelta = s.deaths - countryHistory[countryHistory.length - 2].deaths;
    s.doublingTimeDelta = s.doublingTime - countryHistory[countryHistory.length - 2].doublingTime;
    s.growthRateDelta = s.growthRate - countryHistory[countryHistory.length - 2].growthRate;
    if(countryDetails != null) {
      s.todayCases = countryDetails.todayCases;
      s.todayDeaths = countryDetails.todayDeaths;
      s.critical = countryDetails.critical;
      s.tests = countryDetails.tests;
      s.testsPerOneMillion = countryDetails.testsPerOneMillion;
      s.casesPerOneMillion = countryDetails.casesPerOneMillion;
      s.deathsPerOneMillion = countryDetails.deathsPerOneMillion;
      s.flag = countryDetails.countryInfo.flag;   
    }
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
        let j = Math.min(4,i);
        entry.delta = entry.cases - countryHistory[i-j].cases;
        if(countryHistory[i-j].cases > 0) {
          entry.growthRate = 100 *  entry.delta / countryHistory[i-j].cases / j;
        }
      }
      if(entry.country != "World" && entry.country != "USA") {
        if(this.maxCases < entry.cases) this.maxCases = entry.cases;
        // if(this.maxDelta < entry.delta) this.maxDelta = entry.delta;
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
    this.setDeltaTimeTicks();
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
  todayCases: number;
  todayDeaths: number;
  critical: number;
 
  tests: number;
  casesPerOneMillion: number;
  deathsPerOneMillion: number;
  testsPerOneMillion: number; 

  flag: string;

  recoveredDelta: Tendency;
  deathsDelta: Tendency;
  activeDelta: Tendency;
  deltaDelta: number;
  doublingTimeDelta: Tendency;
  growthRateDelta: Tendency;
}