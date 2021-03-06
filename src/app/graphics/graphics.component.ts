import { Component, OnInit, Input, Output, EventEmitter, ɵisDefaultChangeDetectionStrategy } from '@angular/core';
import { DataSeries, SummaryViewData, CaseData, DataPoint, MobilityData } from '../data-model';
import { SettingsService } from '../settings/settings.service';
import { SharingService } from '../sharing/sharing.service';

@Component({
  selector: 'app-graphics',
  templateUrl: './graphics.component.html',
  styleUrls: ['./graphics.component.scss']
})
export class GraphicsComponent implements OnInit {
  
  currentCountry: SummaryViewData;

  currentHistory: CaseData[] = new Array<CaseData>();

  xTimeScaleMin: Date = new Date("2020-01-22");
  // xTimeScaleMin: Date = new Date(Date.now() - 45 * 1000 * 60 * 60 * 24);
  xTimeScaleMax: Date = new Date(Date.now() - 1 * 1000 * 60 * 60 * 24);
  currentCasesSeries: Array<DataSeries>;
  currentReproductionSeries: Array<DataSeries>;
  currentLogSeries: Array<DataSeries>;
  currentDeltaSeries: Array<DataSeries>;
  currentMobilitySeries: Array<DataSeries>;

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
  reproductionTicks: number[] = [0, 1, 2, 3, 4];
  timeline: boolean = false;
  yLogScaleMin: number = Math.log(1000);
  yLogScaleMax: number = Math.log(10000000);

  totalCaption: string = "Cases over time";
  deltaCaption: string = "New cases per day";
  logCaption: string = "Cases (logarithmic) over time";
  reproductionCaption: string = "Reproduction Number over time";

  public yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  yAxisTickFormatting(value: number) {
    let suffix = "";
    let v = value;
    if (Math.abs(v) >= 1000000) {
      suffix = "M";
      v = value / 1000000;
    }
    else if (Math.abs(v) >= 1000) {
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

  private pad(num: number, size: number): string {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
  }
  private months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  public dateAxisTickFormattingFn = this.dateAxisTickFormatting.bind(this);
  dateAxisTickFormatting(value) {
    let date = new Date(value);
    let month = date.getMonth();
    let dayOfMonth = date.getDate();
    if (dayOfMonth < 8) return `${this.months[month]}`;
    else return "";//`${this.pad(date.getDate(), 2)}`;
  }

  deltaTimeTicks: Array<Date> = [new Date(2020, 0, 22), new Date()];
  private setDeltaTimeTicks() {
    this.deltaTimeTicks = new Array<Date>();
    let series = this.currentDeltaSeries[0].series;
    for (let i = 0; i < series.length; i++) {
      let date = new Date(series[i].name);
      if (date.getDate() == 1) {
        this.deltaTimeTicks.push(new Date(date));
      }
    }
  }

  get yScaleMaxCases() {
    return this.currentHistory
      .filter(h => h.updated >= this.xTimeScaleMin)
      .reduce((m, h) => h.cases > m ? h.cases : m, this.maxCases);
  }

  get yScaleMaxDelta() {
    return this.currentHistory
      .filter(h => h.updated >= this.xTimeScaleMin)
      .reduce((m, h) => h.delta > m ? h.delta : m, this.maxDelta);
  }

  colorScheme = {
    domain: ['#ff6666', '#ff7777', '#ff8888', '#66aa66', '#6666ff', '#a8385d', '#aae3f5']
  };

  deltaColorScheme = {
    domain: ['#ff6666', '#6666ff', '#66aa66', '#a8385d', '#aae3f5']
  };

  mobilityColorScheme = {
    domain: ['#ddffff', '#ddddff', '#ffccdd', '#ffddcc', '#000000']
  };

  maxCases: number = 1;
  maxDelta: number = 10000;

  mobilityData: MobilityData[] = new Array<MobilityData>();  

  constructor(private settingsService: SettingsService, private sharingService: SharingService) { 
    settingsService.tabIndex.subscribe(i => this._selectedTabIndex = i);
  }

  ngOnInit(): void {
    this.maxCases = 1;
    this.maxDelta = 10000;
    this.sharingService.mobilityData.subscribe(m => {
      this.mobilityData = m;
      this.renderMobilityData();
    });
    this.sharingService.selectedCountry.subscribe(c => {
      this.currentCountry = c;
    });
    this.sharingService.currentHistory.subscribe(h => {
      this.currentHistory = h;
      this.renderCountryHistory();
    })
  }

  private async renderCountryHistory() {
    let activeCases = this.createSeries("Active but assumed recovered");
    let infectiousCases = this.createSeries("Active infectious (estimated)");
    let quarantineCases = this.createSeries("Active in quarantine (estimated)");
    let deathCases = this.createSeries("Deaths");
    let recoveredCases = this.createSeries("Recovered");
    let reproductionNumbers = this.createSeries("Reproduction number");
    let logarithmicValues = this.createSeries("Cases");
    let deltaCases = this.createSeries("New Cases");
    let deltaDeaths = this.createSeries("New Deaths");

    for (let i = 0; this.currentHistory != null && i < this.currentHistory.length; i++) {
      let entry = this.currentHistory[i];
      recoveredCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.recovered));
      deathCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.deaths));
      activeCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, 
        entry.active - entry.assumedInfectious - entry.assumedQuarantine));
      infectiousCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.assumedInfectious));
      quarantineCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.assumedQuarantine));

      reproductionNumbers.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.reproductionNumber));

      if (i > 0 && entry.cases > 0 && entry.delta > 0) {
        let logarithmicPoint = new DataPoint();
        logarithmicPoint.name = entry.updated;
        logarithmicPoint.value = Math.log(entry.cases);
        logarithmicValues.series.push(logarithmicPoint);
      }

      if (i > 0 && entry.updated >= this.xTimeScaleMin) {
        let prev = this.currentHistory[i - 1];
        let averageDelta = SharingService.calculateAverageDelta(i, 7, this.currentHistory);
        if(averageDelta < 0) averageDelta  = 0;
        let deltaCasesPoint = GraphicsComponent.CreateDataPoint(entry.updated, averageDelta);
        let deltaDeathsPoint = GraphicsComponent.CreateDataPoint(entry.updated, entry.deaths - prev.deaths);
        if(deltaDeathsPoint.value < 0) deltaDeathsPoint.value = 0;
        deltaCases.series.push(deltaCasesPoint);
        deltaDeaths.series.push(deltaDeathsPoint);
      }
    }
    this.currentCasesSeries = new Array<DataSeries>();
    this.currentCasesSeries.push(infectiousCases);
    this.currentCasesSeries.push(quarantineCases);
    this.currentCasesSeries.push(activeCases);
    this.currentCasesSeries.push(recoveredCases);
    this.currentCasesSeries.push(deathCases);

    this.currentReproductionSeries = new Array<DataSeries>();
    this.currentReproductionSeries.push(reproductionNumbers);

    this.currentLogSeries = new Array<DataSeries>();
    this.currentLogSeries.push(logarithmicValues)

    this.currentDeltaSeries = new Array<DataSeries>();
    this.currentDeltaSeries.push(deltaCases);
    this.currentDeltaSeries.push(deltaDeaths);

    this.setDeltaTimeTicks();
  }

  private renderMobilityData() {
    this.currentMobilitySeries = new Array<DataSeries>();
    let averageSeries = this.createSeries("7 days average");
    let retailSeries = this.createSeries("retail & recreation");
    let grocerySeries = this.createSeries("grocery & pharmacies");
    // let parksSeries = this.createSeries("parks");
    let transitSeries = this.createSeries("transit stations");
    let workplaceSeries = this.createSeries("workplace");
    //let residentialSeries = this.createSeries("residential");
    this.currentMobilitySeries.push(retailSeries);
    this.currentMobilitySeries.push(grocerySeries);
    // this.currentMobilitySeries.push(parksSeries);
    this.currentMobilitySeries.push(transitSeries);
    this.currentMobilitySeries.push(workplaceSeries);
    this.currentMobilitySeries.push(averageSeries);
    //this.currentMobilitySeries.push(residentialSeries);
    for (let i = 0; i < this.mobilityData.length; i++) {
      let item = this.mobilityData[i];
      let avg = SharingService.calculateAverageMobility(i, 7, this.mobilityData);
      averageSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, avg));
      retailSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.retailAndRecreation));
      grocerySeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.groceryAndPharmacy));
      // parksSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.parks));
      transitSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.transitStations));
      workplaceSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.workplace));
      //residentialSeries.series.push(GraphicsComponent.CreateDataPoint(item.date, item.residential));
    }
  }

  private createSeries(name: string): DataSeries {
    let series = new DataSeries();
    series.name = name;
    series.series = new Array<DataPoint>();
    return series;
  }

  private static CreateDataPoint(date: Date, value: number): DataPoint {
    let recovered = new DataPoint();
    recovered.name = new Date(+date); //new DatePipe("en").transform(date, "dd.MM");
    recovered.value = value;
    return recovered;
  }

  onSelect(event) {
    console.log(event);
  }

  private _selectedTabIndex: number = 0;
  get selectedTabIndex(): number {
    return this._selectedTabIndex;
  }

  set selectedTabIndex(index: number) {
    this.settingsService.setTabIndex(index);
  }

}
