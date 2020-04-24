import {Component, Inject, OnInit} from '@angular/core';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {SummaryViewData, DataSeries, DataPoint, CaseData} from "./data-model";
import { SettingsService } from './settings/settings.service';
import { MatSliderChange } from '@angular/material/slider';

export interface DialogData {
    country: SummaryViewData;
    history: CaseData[];
}

@Component({
    selector: 'info-dialog',
    templateUrl: 'info-dialog.html',
})
export class InfoDialog implements OnInit {
    currentCountry: SummaryViewData;
    currentHistory: CaseData[];
    simulationHistory: CaseData[];
    mathModelSeries: DataSeries[];
    simulationSeries: DataSeries[];
    infectionRateSeries: DataSeries[];
    reproductionTicks: number[] = [0,1,2,3,4,5,6,7,8,9];

    public yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
    yAxisTickFormatting(value: number) {
      let suffix = "";
      let v = value;
      if(v >= 1000000) {
          suffix = "M";
          v = value / 1000000;
      }
      else if(v >= 1000)
      {
        suffix = "k";
        v = value / 1000;
      };
      return `${Math.round(v)}${suffix}`;
    }
  
    reproductionNumberMin = 0.5;
    reproductionNumberMax = 2.0;
    reproductionNumberStep = 0.01;
    reproductionNumber: number = 2.0;
    infectionPeriodMin = 2;
    infectionPeriodMax = 30;
    infectionPeriodStep = 1;
    infectionPeriod: number = 5;
    activePeriod: number = 14;

    private maxActive: number = 1000000;
    get desiredMaxActive() {
        return this.maxActive.toString();
    }
    set desiredMaxActive(value: string) {
        this.maxActive = Number.parseInt(value);
    }

    private _perMillSummary: boolean = true;
    get perMillSummary(): boolean {
        return this._perMillSummary;
    }
    set perMillSummary(value: boolean)
    {
        this.settingsService.setPerMilSummary(value);
    }
    
    constructor(
        private settingsService: SettingsService,
        public dialogRef: MatDialogRef<InfoDialog>,
        @Inject(MAT_DIALOG_DATA) public data: DialogData) 
    {
        this.currentCountry = data.country;
        this.currentHistory = data.history;
        this.settingsService.perMilSummary.subscribe(on => this._perMillSummary = on);
        this.reproductionNumber = this.currentCountry.reproductionNumber;
        this.createMathModelSeries();
        this.resetSimulationHistory();
    }

    public resetSimulationHistory() {
        this.simulationSeries = this.resetSimulationSeries();
    }

    async ngOnInit(): Promise<void> {
    }

    createMathModelSeries() {
        this.mathModelSeries = this.resetSimulationSeries();
        let aSeries = new DataSeries();
        aSeries.name = "simulated active";
        aSeries.series = new Array<DataPoint>();
        this.mathModelSeries.push(aSeries);
        let rSeries = new DataSeries();
        rSeries.name = "simulated recovered";
        rSeries.series = new Array<DataPoint>();
        this.mathModelSeries.push(rSeries);
        // let sSeries = this.mathModelSeries.find(s => s.name=="susceptible");

        let r = this.reproductionNumber / this.infectionPeriod; 
        //Math.pow(this.reproductionNumber + 1, 1 / this.healingTime) - 1;
        let population = this.currentCountry.population;

        let startIndex = this.simulationHistory.length;
        let startDate = this.simulationHistory[0].updated;
        for(let i = startIndex; i < 700; i++) {
            let h = new CaseData();
            h.updated = new Date(Number(startDate) + i * 1000 * 60 * 60 * 24)
            h.deaths = 0;
            h.delta = r * this.simulationHistory[i-1].infectious * (population - this.simulationHistory[i-1].active - this.simulationHistory[i-1].recovered) / population;
            if(h.delta < 0) h.delta = 0;
            h.cases = this.simulationHistory[i-1].cases + h.delta;
            h.recovered = this.simulationHistory[i-1].recovered;
            h.infectious = this.simulationHistory[i-1].infectious + h.delta;
            if(i >= this.activePeriod) {
                h.recovered += this.simulationHistory[i-this.activePeriod].delta;
            }
            if(i >= this.infectionPeriod) {
                h.infectious -= this.simulationHistory[i-this.infectionPeriod].delta;
            }
            this.simulationHistory.push(h);
            this.addPointToSeries(h.updated, h.active, aSeries);
            this.addPointToSeries(h.updated, h.recovered, rSeries);
            // this.addPointToSeries(i, population - h.recovered - h.active, sSeries);
        }
    }

    resetSimulationSeries(): DataSeries[]{
        let series = new Array<DataSeries>();
        let aSeries = new DataSeries();
        aSeries.name = "active";
        aSeries.series = new Array<DataPoint>();
        series.push(aSeries);
        let rSeries = new DataSeries();
        rSeries.name = "recovered";
        rSeries.series = new Array<DataPoint>();
        series.push(rSeries);
        // let sSeries = new DataSeries();
        // sSeries.name = "susceptible";
        // sSeries.series = new Array<DataPoint>();
        // series.push(sSeries);

        this.infectionRateSeries = new Array<DataSeries>();
        let rateSeries = new DataSeries();
        rateSeries.name = "Measured Reproduction number";
        rateSeries.series = new Array<DataPoint>();
        this.infectionRateSeries.push(rateSeries);

        this.simulationHistory = new Array<CaseData>();
        for(let i = 0; i < this.currentHistory.length; i++)
        {
            let h = new CaseData();
            h.copyFrom(this.currentHistory[i]);
            this.simulationHistory.push(h);
            this.addPointToSeries(h.updated, h.active, aSeries);
            this.addPointToSeries(h.updated, h.recovered, rSeries);
            //this.addPointToSeries(i, this.currentCountry.population - h.active - h.recovered, sSeries);
            this.addPointToSeries(h.updated, h.reproductionNumber, rateSeries);
        }
        return series;
    }

    createSimulationSeries() {
        this.simulationSeries = this.resetSimulationSeries()

        let aSeries = this.simulationSeries.find(s => s.name=="active");
        let rSeries = this.simulationSeries.find(s => s.name=="recovered");
//        let sSeries = this.simulationSeries.find(s => s.name=="susceptible");
        let rateSeries = new DataSeries();
        rateSeries.name = "Simulated reproduction number";
        rateSeries.series = new Array<DataPoint>();
        this.infectionRateSeries.push(rateSeries);

        let population = this.currentCountry.population;
        let t = this.infectionPeriod;
        let rMin = 1 / this.infectionPeriod;
        let rMax = 5 / this.infectionPeriod;
        let startIndex = this.simulationHistory.length;
        let startDate = this.simulationHistory[0].updated;
        let r = this.simulationHistory[startIndex-1].infectionRate / 100;
        for(let i = startIndex; i < 800; i++) {
            let h = new CaseData();
            h.updated = new Date(Number(startDate) + i * 1000 * 60 * 60 * 24)
            h.deaths = 0;
            h.delta = r * this.simulationHistory[i-1].active * 
                (population - this.simulationHistory[i-1].active - 
                    this.simulationHistory[i-1].recovered) / population;
            if(h.delta < 0) h.delta = 0;
            h.cases = this.simulationHistory[i-1].cases + h.delta;
            h.recovered = this.simulationHistory[i-1].recovered;
            if(i >= t) {
                h.recovered += this.simulationHistory[i-t].delta;
            }
            this.simulationHistory.push(h);

            h.infectionRate = 0;
            let j = Math.min(5,i);
            for(let k = i-j; k < i; k++)
            {
              if(this.simulationHistory[k].active > 0) {
                // average of the last 'j' daily growth factors;
                // daily growth factor is defined as 
                // the number of new infections today (delta) caused by one hundred yesterdays infected (active)
                let gDelta = this.simulationHistory[k+1].cases - this.simulationHistory[k].cases;
                let s = (population - this.simulationHistory[k].active - this.simulationHistory[k].recovered)/population;
                h.infectionRate += 100 * gDelta / (this.simulationHistory[k].active * s) / j;
              }
            }
            h.reproductionNumber = h.infectionRate / 100 * this.infectionPeriod; // Math.pow(1 + h.infectionRate/100, this.healingTime) - 1;
            this.addPointToSeries(h.updated, h.active, aSeries);
            this.addPointToSeries(h.updated, h.recovered, rSeries);
            // this.addPointToSeries(i, population - h.active - h.recovered, sSeries);
            this.addPointToSeries(h.updated, h.reproductionNumber, rateSeries);
            if(i % 14 != 0) continue;
            let forecast = this.calculateForecast(r, this.simulationHistory, t, population);
            if(forecast < this.maxActive * 0.9  && r < rMax) {
                r  = Math.min(rMax, r + 0.5 / this.infectionPeriod);
                forecast = this.calculateForecast(r, this.simulationHistory, t, population);
            }
            while(forecast > this.maxActive && r > rMin) {
                r = Math.max(rMin, r - 0.5 / this.infectionPeriod);
                forecast = this.calculateForecast(r, this.simulationHistory, t, population);
            }
        }
    }

    private addPointToSeries(i: Date, v: number, aSeries: DataSeries) {
        let p = new DataPoint();
        p.name = i;
        p.value = v;
        aSeries.series = [...aSeries.series, p];
    }

    calculateForecast(r: number, hist: CaseData[], t: number, population: number): number {
        let forecasts = new Array<CaseData>();
        let c = new CaseData();
        let hi = hist.length - 1;
        c.copyFrom(hist[hi]);
        forecasts.push(c);
        let max = c.active;
        for(let i = 1; i <= t; i++) {
            let h = new CaseData();
            h.deaths = 0;
            h.delta = r * forecasts[i-1].active * (population - forecasts[i-1].active - forecasts[i-1].recovered) / population;
            if(h.delta < 0) h.delta = 0;
            h.cases = forecasts[i-1].cases + h.delta;
            h.recovered = forecasts[i-1].recovered;
            if(hi + i - t >= 0) {
                h.recovered += hist[hi + i - t].delta;
            }
            forecasts.push(h);
            if(h.active > max) max = h.active;
        }
        return max;
    }

    sleep(ms: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    infectionPeriodPreview(event: MatSliderChange)
    {
        this.infectionPeriod = event.value;
        this.createMathModelSeries();
    }

    reproductionNumberPreview(event: MatSliderChange)
    {
        this.reproductionNumber = event.value;
        this.createMathModelSeries();
    }
}