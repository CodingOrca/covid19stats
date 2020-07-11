import { Component, OnInit, ViewChild, AfterViewInit, Input } from '@angular/core';
import { DataService as DataService } from 'src/app/data/data.service';
import { SummaryViewData, YesterdayData, CaseData, DataSeries, DataPoint, MobilityData} from './data-model';
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

export class AppComponent implements OnInit {
  
  currentCountry: SummaryViewData = new SummaryViewData();
  currentHistory: CaseData[] = new Array<CaseData>();
  currentMobilityData: MobilityData[] = new Array<MobilityData>();

  title = 'COVID-19 cases - figures and plots';
  today: Date = new Date();

  displayedColumns: string[];
  table: MatTableDataSource<SummaryViewData> = new MatTableDataSource();

  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  constructor(private settingsService: SettingsService, 
    private sharingService: SharingService,
    private dataService: DataService)
  {
  }

  async ngOnInit(): Promise<void> {
    await this.sharingService.load();
    this.sharingService.countries.subscribe(countries => {
      this.table = new MatTableDataSource(countries);
      this.table.sort = this.matSort;
      this.table.sort.active = "cases";
    });
    this.settingsService.tabIndex.subscribe(index => this.changeTabToIndex(index));
    this.sharingService.mobilityData.subscribe(newData => this.currentMobilityData = newData);
    this.sharingService.selectedCountry.subscribe(c => this.currentCountry = c);
    this.sharingService.currentHistory.subscribe(h => this.currentHistory = h);
  }

  selectCountry(country: SummaryViewData) {
    this.sharingService.selectCountry(country);
    this.settingsService.setCountry(country?.country);
  }

  changeTabToIndex(index: number) {
    switch(index) {
      case 0:
        this.displayedColumns = ['country', 'cases', 'delta', 'deaths', 'reproductionNumber'];
        break;
      case 1:
        this.displayedColumns = ['country', 'cases', 'delta', 'deaths', 'deathsDelta'];
        break;
      case 2:
        this.displayedColumns = ['country', 'cases', 'delta', 'deathsDelta', 'reproductionNumber'];
        break;
      case 3:
        this.displayedColumns = ['country', 'delta', 'activeDelta', 'mobilityChange', 'reproductionNumber'];
        break;
      case 4:
        this.displayedColumns = ['country', 'delta', 'mobilityChange', 'reproductionNumber'];
        break;
    }
    this.table._updateChangeSubscription();
  }
}
