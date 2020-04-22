import { Component, OnInit, ViewChild, AfterViewInit, Input } from '@angular/core';
import { NovelCovidService } from 'src/app/novel-covid/novel-covid.service';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint} from './data-model';
import { MatTableDataSource} from '@angular/material/table';
import { MatSort, SortDirection} from '@angular/material/sort';
import { ViewEncapsulation } from '@angular/core';
import { SettingsService } from './settings/settings.service';
import { SharingService } from './sharing/sharing.service';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit{

  currentCountry: SummaryViewData;
  currentHistory: CaseData[];

  infectiousPeriod: number = 5;
  maximumInfectionPeriod: number = 28;
  daysForAverage: number = 7;
  
  title = 'COVID-19 cases - figures and plots';
  today: Date = new Date();

  displayedColumns: string[] = ['country', 'cases', 'active', 'critical', 'deaths'];
  tableData: MatTableDataSource<SummaryViewData> = new MatTableDataSource();
  allHistoricalData: Map<string,CaseData[]>;

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  private perMillSummary: boolean;
  

  constructor(
    private settingsService: SettingsService, 
    private sharingService: SharingService,
    private dataService: NovelCovidService) {
  }

  async ngOnInit(): Promise<void> {

    this.settingsService.perMilSummary.subscribe(on => this.perMillSummary = on);

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

    this.sharingService.selectedCountry.subscribe(c => 
      {
        if(c == null) c = this.tableData.data[0];
        this.currentCountry = c;
        this.tableData.filter = "";
        this.tableData._updateChangeSubscription();
        this.currentHistory = this.allHistoricalData.get(c.country);
      });
    this.sharingService.setSelectedCountry(this.tableData.data.find( c=> c.country == this.settingsService.country));
  }

  ngAfterViewInit() {
    this.changeTabToIndex(this.settingsService.tabIndex);
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
      i++;
    }
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
