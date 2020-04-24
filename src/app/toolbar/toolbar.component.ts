import { Component, OnInit, Input } from '@angular/core';
import { SummaryViewData, CaseData } from '../data-model';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialog } from '../info-dialog';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css']
})
export class ToolbarComponent implements OnInit {

  @Input() currentCountry: SummaryViewData;
  @Input() currentHistory: CaseData[];

  constructor(public dialog: MatDialog) { }

  ngOnInit(): void {
  }

  openGitHub()
  {
//    window.open("https://github.com/CodingOrca/covid19stats/blob/master/README.md");
    const dialogRef = this.dialog.open(InfoDialog, {
      minWidth: '100vw',
      data: {country: this.currentCountry, history: this.currentHistory}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

}
