import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { DataSeries, SummaryViewData, CaseData, DataPoint } from '../data-model';
import { SettingsService } from '../settings/settings.service';

@Component({
  selector: 'app-graphics',
  templateUrl: './graphics.component.html',
  styleUrls: ['./graphics.component.scss']
})
export class GraphicsComponent implements OnInit {
  
  myCurrentCountry: SummaryViewData
  get currentCountry(): SummaryViewData {
    return this.myCurrentCountry;
  };

  @Input() set currentCountry(value: SummaryViewData) {
    this.myCurrentCountry = value;
    this.RenderCountryHistory();
  }

  myCurrentHistory: CaseData[] = new Array<CaseData>();
  get currentHistory(): CaseData[] {
    return this.myCurrentHistory;
  }

  @Input() set currentHistory(history: CaseData[])
  {
    this.myCurrentHistory = history;
    this.RenderCountryHistory();
  }

  xTimeScaleMin: Date = new Date(Date.now() - 42 * 1000 * 60 * 60 * 24);
  xTimeScaleMax: Date = new Date(Date.now() - 1 * 1000 * 60 * 60 * 24);
  currentCasesSeries: Array<DataSeries>;
  currentReproductionSeries: Array<DataSeries>;
  currentLogSeries: Array<DataSeries>;
  currentDeltaSeries: Array<DataSeries>;

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

  public dateAxisTickFormattingFn = this.dateAxisTickFormatting.bind(this);
  dateAxisTickFormatting(value) {
    let date = new Date(value);
    return `${this.pad(date.getDate(), 2)}.${this.pad(date.getMonth() + 1, 2)}`;
  }

  deltaTimeTicks: Array<string | Date> = [new Date(2020, 0, 22), new Date()];
  private setDeltaTimeTicks() {
    this.deltaTimeTicks = new Array<string | Date>();
    for (let i = 0; i < this.currentDeltaSeries.length; i++) {
      let date = new Date(this.currentDeltaSeries[i].name);
      if (date.getDay() == 0) {
        this.deltaTimeTicks.push(this.currentDeltaSeries[i].name);
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
    domain: ['#ff6666', '#ff7777', '#66aa66', '#6666ff', '#a8385d', '#aae3f5']
  };

  deltaColorScheme = {
    domain: ['#ff6666', '#66aa66', '#6666ff', '#a8385d', '#aae3f5']
  };

  maxCases: number = 1;
  maxDelta: number = 10000;

  constructor(private settingsService: SettingsService) { 
  }

  ngOnInit(): void {
    this.maxCases = 1;
    this.maxDelta = 10000;
  }

  private async RenderCountryHistory() {
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
      recoveredCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.recovered));
      deathCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.deaths));
      activeCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.active - entry.infectious));
      contagiousCases.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.infectious));

      reproductionNumbers.series.push(GraphicsComponent.CreateDataPoint(entry.updated, entry.reproductionNumber));

      if (i > 0 && entry.cases > 0 && entry.delta > 0) {
        let logarithmicPoint = new DataPoint();
        logarithmicPoint.name = entry.updated;
        logarithmicPoint.value = Math.log(entry.cases);
        logarithmicValues.series.push(logarithmicPoint);
      }

      if (i > 0 && entry.updated >= this.xTimeScaleMin) {
        let prev = this.currentHistory[i - 1];
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

  private static CreateDataPoint(date: Date, value: number): DataPoint {
    let recovered = new DataPoint();
    recovered.name = new Date(+date); //new DatePipe("en").transform(date, "dd.MM");
    recovered.value = value;
    return recovered;
  }

  onSelect(event) {
    console.log(event);
  }

  @Output() selectedTabIndexChange = new EventEmitter();

  get selectedTabIndex() {
    return this.settingsService.tabIndex;
  }

  set selectedTabIndex(index: number) {
    this.settingsService.tabIndex = index;
    this.selectedTabIndexChange.emit(this.selectedTabIndex);
  }

}
