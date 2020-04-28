import { Component, OnInit, ViewChild, AfterViewInit, Input } from '@angular/core';
import { DataService as DataService } from 'src/app/data/data.service';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint, MobilityData} from './data-model';
import { MatTableDataSource} from '@angular/material/table';
import { MatSort, SortDirection} from '@angular/material/sort';
import { ViewEncapsulation } from '@angular/core';
import { SettingsService } from './settings/settings.service';
import { SharingService } from './sharing/sharing.service';
import { GraphicsComponent } from './graphics/graphics.component';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit{

  currentCountry: SummaryViewData = new SummaryViewData();
  currentHistory: CaseData[] = new Array<CaseData>();
  currentMobilityData: MobilityData[] = new Array<MobilityData>();

  infectiousPeriod: number = 5;
  quarantinePeriod: number = 14;
  maximumInfectionPeriod: number = 28;
  daysForAverage: number = 7;
  
  title = 'COVID-19 cases - figures and plots';
  today: Date = new Date();

  displayedColumns: string[] = ['country', 'cases', 'active', 'critical', 'deaths'];
  tableData: MatTableDataSource<SummaryViewData> = new MatTableDataSource();
  allHistoricalData: Map<string, CaseData[]> = new Map<string, CaseData[]>();

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  private perMillSummary: boolean;
  

  constructor(private settingsService: SettingsService, 
    private sharingService: SharingService,
    private dataService: DataService)
  {
    sharingService.mobilityData.subscribe(newData => this.currentMobilityData = newData);
    this.sharingService.selectedCountry.subscribe(c => {
      this.currentCountry = c;
      this.tableData.filter = "";
      this.tableData._updateChangeSubscription();
      this.currentHistory = this.allHistoricalData.get(c.country);
    });
  }

  async ngOnInit(): Promise<void> {
    this.settingsService.perMilSummary.subscribe(on => this.perMillSummary = on);
    await this.sharingService.loadMobilityData();

    // get ALL historical data, of all provinces:
    this.allHistoricalData = await this.dataService.getAllHistoricalData();
    let yesterdayData = await this.dataService.getYesterdaysData();
    let mortalityRates = await this.dataService.getMortalityRates();

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
    this.tableData.sort.active = "cases";
    this.sharingService.setSelectedCountry(this.tableData.data.find( c=> c.country == this.settingsService.country));
  }

  ngAfterViewInit() {
    this.changeTabToIndex(this.settingsService.tabIndex);
    this.tableData._updateChangeSubscription();
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
    let mData = this.sharingService.getMobilityData(countryDetails?.countryInfo?.iso2);
    if (mData != null && mData.length > 0)
      s.mobilityChange = GraphicsComponent.calculateAverageMobility(mData.length - 1, this.daysForAverage, mData);
    else s.mobilityChange = null;

    if(countryDetails != null) {
      s.todayCases = countryDetails.todayCases;
      s.todayDeaths = countryDetails.todayDeaths;
      s.critical = countryDetails.critical;
      s.tests = countryDetails.tests;
      s.testsPerMille = countryDetails.testsPerOneMillion  / 1000.0;
      s.casesPerMille = countryDetails.casesPerOneMillion / 1000.0;
      s.deathsPerMille = countryDetails.deathsPerOneMillion / 1000.0;
      s.flag = countryDetails.countryInfo.flag;  
      s.iso2 = countryDetails.countryInfo.iso2; 
    }
    return s;
  }

  calculateDeltaAndCo(countryDetails: YesterdayData, countryHistory: CaseData[]) {
    let i: number = 0;
    for (let entry of countryHistory) {
      entry.delta = 0;
      entry.infectionRate = 0;
      entry.assumedInfectious = 0;
      entry.assumedQuarantine = 0;
      if(i > 0)
      {
        entry.delta = entry.cases - countryHistory[i-1].cases;
        entry.assumedInfectious += entry.delta + countryHistory[i-1].assumedInfectious;
        entry.assumedQuarantine = countryHistory[i-1].assumedQuarantine
        if(i > this.infectiousPeriod) {
          entry.assumedInfectious -= countryHistory[i-this.infectiousPeriod].delta;
          entry.assumedQuarantine += countryHistory[i-this.infectiousPeriod].delta;
        }
        if(i > this.quarantinePeriod) {
          entry.assumedQuarantine -= countryHistory[i-this.quarantinePeriod].delta;
        }
        let j = Math.min(this.daysForAverage, i);
        entry.infectionRate = 100 * this.calculateAverageReproRate(i, j, countryHistory);
      }
      entry.reproductionNumber = entry.infectionRate / 100 * this.infectiousPeriod;
      i++;
    }
  }

  calculateAverageReproRate(n: number, m: number, hist: CaseData[]): number {
    let a = 0;
    let b = 0;
    for (let i = n - m; i < n; i++) {
      //if (hist[i].delta <= 0 || hist[i].assumedInfectious <= 0) continue;
      b += (- 2 * hist[i + 1].delta * hist[i].assumedInfectious);
      a += hist[i].assumedInfectious * hist[i].assumedInfectious;
    }
    if (a == 0 ) return 5;
    return -b / (2 * a);
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

  selectCountry(country: SummaryViewData) {
    this.sharingService.setSelectedCountry(country);
  }

  get selectedTabIndex() {
    return this.settingsService.tabIndex;
  }

  @Input() set selectedTabIndex(index: number) {
    this.changeTabToIndex(index);
    this.settingsService.tabIndex = index;
  }

  changeTabToIndex(index: number) {
    switch(index) {
      case 0:
        this.displayedColumns = ['country', 'cases', 'delta', 'deaths', 'reproductionNumber'];
        break;
      case 1:
        this.displayedColumns = ['country', 'cases', 'active', 'recovered', 'deaths'];
        break;
      case 2:
        this.displayedColumns = ['country', 'delta', 'recoveredDelta', 'deathsDelta', 'reproductionNumber'];
        break;
      case 3:
        this.displayedColumns = ['country', 'delta', 'activeDelta', 'mobilityChange', 'reproductionNumber'];
        break;
      case 4:
        this.displayedColumns = ['country', 'delta', 'mobilityChange', 'reproductionNumber'];
        break;
    }
    this.tableData._updateChangeSubscription();
  }
}
