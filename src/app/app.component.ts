import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { DataService } from 'src/app/novelcovid.service';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint} from './data-model';
import { MatTableDataSource} from '@angular/material/table';
import { MatSort, SortDirection} from '@angular/material/sort';
import { ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialog } from './info-dialog';
import { SettingsService } from './settings/settings.service';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit{

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  private _perMillSummary: boolean = true;
  get perMillSummary(): boolean {
    return this._perMillSummary;
  }
  set perMillSummary(value: boolean)
  {
    this.settingsService.setPerMilSummary(value);
  }

  infectiousPeriod: number = 5;
  maximumInfectionPeriod: number = 28;
  daysForAverage: number = 5;
  xTimeScaleMin: Date = new Date(Date.now() - 42 * 1000 * 60 * 60 * 24);
  xTimeScaleMax: Date = new Date(Date.now() - 1 * 1000 * 60 * 60 * 24);
  
  title = 'COVID-19 statistic data and forecast';
  currentCountry: SummaryViewData;
  today: Date = new Date();

  displayedColumns: string[] = ['country', 'cases', 'active', 'critical', 'deaths'];
  tableData: MatTableDataSource<SummaryViewData> = new MatTableDataSource();
  allHistoricalData: Map<string,CaseData[]>;

  currentHistory: Array<CaseData>;
  currentCasesSeries: Array<DataSeries>;
  currentReproductionSeries: Array<DataSeries>;
  currentLogSeries: Array<DataSeries>;
  currentDeltaSeries : Array<DataSeries>;

  public yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  yAxisTickFormatting(value: number) {
    let suffix = "";
    let v = value;
    if(Math.abs(v) >= 1000000)
    {
      suffix = "M";
      v = value / 1000000;
    }
    else if(Math.abs(v) >= 1000)
    {
      suffix = "k";
      v = value / 1000;
    };
    return `${Math.round(v)}${suffix}`;
  }

  public logAxisTickFormattingFn = this.logAxisTickFormatting.bind(this);
  logAxisTickFormatting(value) {
    let l = Math.round(Math.exp(value)); 
    return this.exponentialNotationOf(l);
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
  dAxisLabel: string = "Reproduction number";
  gAxisLabel: string = "New cases";
  yLogLabel: string = "log(new cases)";
  yLogTicks: number[] = [Math.log(1000), Math.log(10000), Math.log(100000), Math.log(1000000)];
  linTicks: number[] = [10, 100, 1000, 10000, 100000];
  reproductionTicks: number[] = [0,1,2,3,4];
  timeline: boolean = false;
  yLogScaleMin: number = Math.log(1000);
  yLogScaleMax: number = Math.log(10000000);


  deltaTimeTicks: Array<string | Date> = [new Date(2020,0,22), new Date()];
  private setDeltaTimeTicks() {
    this.deltaTimeTicks = new Array<string | Date>();
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
  logCaption: string = "Cases (logarithmic) over time";
  reproductionCaption: string = "Reproduction Number over time";
  
  colorScheme = {
    domain: [ '#ff6666', '#ff7777', '#66aa66',  '#6666ff', '#a8385d', '#aae3f5']
  };

  deltaColorScheme = {
    domain: [ '#ff6666', '#66aa66',  '#6666ff', '#a8385d', '#aae3f5']
  };

  constructor(private settingsService: SettingsService, private dataService: DataService, public dialog: MatDialog) {
  }

  async ngOnInit(): Promise<void> {

    this.settingsService.perMilSummary.subscribe(on => this._perMillSummary = on);

    // get ALL historical data, of all provinces:
    this.allHistoricalData = await this.dataService.getAllHistoricalData();
    let yesterdayData = await this.dataService.getYesterdaysData();
    let mortalityRates = await this.dataService.getMortalityRates();

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
      this.calculateDeltaAndCo(countryDetails, countryHistory);
      let s = this.CreateSummaryViewData(countryDetails, countryHistory);
      if(mortalityRates.has(cn)) {
        s.mortalityRate = mortalityRates.get(cn);        
      }
      results.push(s);
    }

    // sort by cases:
    this.tableData = new MatTableDataSource(results.sort((x, y) => x.cases > y.cases ? -1 : 1));
    this.tableData.sort = this.matSort;

    this.selectedIndexChange(0);
    this.settingsService.selectedCountry.subscribe( country =>
      {
        let c = this.tableData.data.find(e => e.country == country);
        if(c == null) c = this.tableData.data[0];
        this.currentCountry = c;
        this.tableData.filter = "";
        this.tableData._updateChangeSubscription();
        this.RenderCountryHistory(country);    
      })
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
    s.deltaDeaths = s.deaths - countryHistory[countryHistory.length - 2].deaths;
    s.activeDelta = s.active - countryHistory[countryHistory.length - 2].active;
    s.recoveredDelta = s.recovered - countryHistory[countryHistory.length - 2].recovered;
    s.deathsDelta = s.deaths - countryHistory[countryHistory.length - 2].deaths;
    s.reproductionNumberDelta = s.reproductionNumber - countryHistory[countryHistory.length - 2].reproductionNumber;
    s.infectionRateDelta = s.infectionRate - countryHistory[countryHistory.length - 2].infectionRate;
    if(countryDetails != null) {
      s.todayCases = countryDetails.todayCases;
      s.todayDeaths = countryDetails.todayDeaths;
      s.critical = countryDetails.critical;
      s.tests = countryDetails.tests;
      s.testsPerMille = countryDetails.testsPerOneMillion  / 1000.0;
      s.casesPerMille = countryDetails.casesPerOneMillion / 1000.0;
      s.deathsPerMille = countryDetails.deathsPerOneMillion / 1000.0;
      s.flag = countryDetails.countryInfo.flag;   
    }
    return s;
  }

  calculateDeltaAndCo(countryDetails: YesterdayData, countryHistory: CaseData[]) {
    let i: number = 0;
    for (let entry of countryHistory) {
      entry.delta = 0;
      entry.infectionRate = 0;
      entry.infectious = 0;
      if(i > 0)
      {
        entry.delta = entry.cases - countryHistory[i-1].cases;
        entry.infectious += entry.delta + countryHistory[i-1].infectious;
        if(i > this.infectiousPeriod) {
          entry.infectious -= countryHistory[i-this.infectiousPeriod].delta;
        }
        let j = Math.min(this.daysForAverage,i);
        for(let k = i-j; k < i; k++)
        {
          if(countryHistory[k].infectious > 0) {
            let gDelta = countryHistory[k+1].cases - countryHistory[k].cases;
            entry.infectionRate += 100 *  gDelta / countryHistory[k].infectious / j;
          }
        }
      }
      //entry.reproductionNumber = Math.pow(1+entry.infectionRate/100, this.infectiousPeriod) - 1;
      entry.reproductionNumber = entry.infectionRate / 100 * this.infectiousPeriod;
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
    activeCases.name = "Active, assumed non-infectious";
    activeCases.series = new Array<DataPoint>();

    let contagiousCases = new DataSeries();
    contagiousCases.name = "Active, assumed infectious";
    contagiousCases.series = new Array<DataPoint>();

    let deathCases = new DataSeries();
    deathCases.name = "Deaths";
    deathCases.series = new Array<DataPoint>();

    let recoveredCases = new DataSeries();
    recoveredCases.name = "Recovered";
    recoveredCases.series = new Array<DataPoint>();

    let reproductionNumbers = new DataSeries();
    reproductionNumbers.name = "Reproduction number";
    reproductionNumbers.series = new Array<DataPoint>();

    let logarithmicValues = new DataSeries();
    logarithmicValues.name = "Cases";
    logarithmicValues.series = new Array<DataPoint>();

    let deltaSeries = new Array<DataSeries>();

    for (let i = 0; i < this.currentHistory.length; i++) {
      let entry = this.currentHistory[i];
      recoveredCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.recovered));
      deathCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.deaths));
      activeCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.active - entry.infectious));
      contagiousCases.series.push(AppComponent.CreateDataPoint(entry.updated, entry.infectious));

      reproductionNumbers.series.push(AppComponent.CreateDataPoint(entry.updated, entry.reproductionNumber));

      if(i > 0 && entry.cases > 0 && entry.delta > 0)
      {
        let logarithmicPoint = new DataPoint();
        logarithmicPoint.name = entry.updated;
        logarithmicPoint.value = Math.log(entry.cases);
        logarithmicValues.series.push(logarithmicPoint);
      }

      if(i > 0 && entry.updated >= this.xTimeScaleMin)
      {
        let prev = this.currentHistory[i-1];
        let newSeries = new DataSeries();
        newSeries.name = entry.updated.toString();
        newSeries.series = new Array<DataPoint>();

        let newCase = new DataPoint();
        newCase.name = "New Cases";
        newCase.value = entry.delta;
        newSeries.series.push(newCase);

        newCase = new DataPoint();
        newCase.name = "New recovered";
        newCase.value = - (entry.recovered - prev.recovered);
        newSeries.series.push(newCase);

        newCase = new DataPoint();
        newCase.name = "New Deaths";
        newCase.value = - (entry.deaths - prev.deaths);
        newSeries.series.push(newCase);

        deltaSeries.push(newSeries);
      }
    }
    this.currentCasesSeries = new Array<DataSeries>();
    this.currentCasesSeries.push(contagiousCases);
    this.currentCasesSeries.push(activeCases);
    this.currentCasesSeries.push(recoveredCases);
    this.currentCasesSeries.push(deathCases);
    
    this.currentReproductionSeries = new Array<DataSeries>();
    this.currentReproductionSeries.push(reproductionNumbers);

    this.currentLogSeries = new Array<DataSeries>();
    this.currentLogSeries.push(logarithmicValues)

    this.currentDeltaSeries = deltaSeries;
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
    this.settingsService.setSelectedCountry(country.country);
  }

  openGitHub()
  {
//    window.open("https://github.com/CodingOrca/covid19stats/blob/master/README.md");
    const dialogRef = this.dialog.open(InfoDialog, {
      minWidth: '100vw',
      height: "100vh",
      data: {country: this.currentCountry, history: this.currentHistory}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  selectedIndexChange(index: number)
  {
    switch(index) {
      case 0:
        this.displayedColumns = ['country', 'cases', 'delta', 'deaths', 'reproductionNumber'];
        break;
      case 1:
        this.displayedColumns = ['country', 'cases', 'active', 'recovered', 'deaths'];
        break;
      case 2:
        this.displayedColumns = ['country', 'cases', 'delta', 'infectionRate', 'reproductionNumber'];
        break;
      case 3:
        this.displayedColumns = ['country', 'cases', 'delta', 'infectionRate', 'reproductionNumber'];
        break;
      case 3:
        this.displayedColumns = ['country', 'cases', 'delta', 'infectionRate'];
        break;
    }
    this.tableData._updateChangeSubscription();
  }
}
