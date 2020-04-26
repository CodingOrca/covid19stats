export class CaseData {
  updated: Date;

  country: string; 
  cases: number;
  deaths: number;
  recovered: number;
  assumedInfectious: number = 0;
  assumedQuarantine: number = 0;
  assumedHospitalized: number = 0;
  assumedICU: number = 0;

  get active(): number {
    return this.cases - this.recovered - this.deaths;
  }

  delta: number;
  reproductionNumber: number;
  infectionRate: number = 0;
  
  mobilityChange: number = 0;
  stayHomeChange: number = 0;

  public copyFrom(c: CaseData) {
    this.updated = new Date(c.updated);
    this.country = c.country;
    this.cases = c.cases;
    this.deaths = c.deaths;
    this.recovered = c.recovered;
    this.assumedQuarantine = c.assumedQuarantine;
    this.assumedInfectious = c.assumedInfectious;
    this.delta = c.delta;
    this.reproductionNumber = c.reproductionNumber;
    this.infectionRate = c.infectionRate;
    this.mobilityChange = c.mobilityChange;
  }
}
  
export class CountryInfo {
  iso2: string;
  iso3: string;
  lat: number;
  long: number;
  flag: string;
}

export class YesterdayData {
  updated: number;
  country: string;
  countryInfo: CountryInfo;
  cases: number;
  todayCases: number;
  deaths: number;
  todayDeaths: number;
  recovered: number;
  active: number;
  critical: number;
  casesPerOneMillion: number;
  deathsPerOneMillion: number;
  tests: number;
  testsPerOneMillion: number; 
}

export class SummaryViewData extends CaseData {
  todayCases: number;
  todayDeaths: number;
  critical: number;
  
  tests: number;
  casesPerMille: number;
  deathsPerMille: number;
  testsPerMille: number; 

  get population(): number {
    return this.cases * 1000 / this.casesPerMille;
  }

  get populationScaleFactor(): number {
    return 1000 / this.testsPerMille;
  }

  get populationScaledCasesPerMille(): number {
    return this.casesPerMille * this.populationScaleFactor;
  }

  get populationScaledActivePerMille(): number {
    return this.activePerMille * this.populationScaleFactor;
  }

  get populationScaledRecoveredPerMille(): number {
    return this.recoveredPerMille * this.populationScaleFactor;
  }

  get populationScaledDeathsPerMille(): number {
    return this.deathsPerMille * this.populationScaleFactor;
  }

  get populationScaledCases(): number {
    return this.cases * this.populationScaleFactor;
  }

  get populationScaledActive(): number {
    return this.active * this.populationScaleFactor;
  }

  get populationScaledRecovered(): number {
    return this.recovered * this.populationScaleFactor;
  }

  get populationScaledDeaths(): number {
    return this.deaths * this.populationScaleFactor;
  }

  get recoveredPerMille(): number {
    return 1000 * this.recovered / this.population;
  }

  get activePerMille(): number {
    return 1000 * this.active / this.population;
  }

  get criticalPerMille(): number {
    return 1000 * this.critical / this.population;
  }

  flag: string;
  iso2: string;

  recoveredDelta: Tendency;
  deathsDelta: Tendency;
  activeDelta: Tendency;
  deltaDelta: number;
  infectionRateDelta: Tendency;
  reproductionNumberDelta: Tendency;

  mortalityRate: number;

  get casesPercentOfTested(): number {
    return 100 * this.cases / this.tests;
  }

  get mortalityRatePerDay(): number {
    return Math.round(this.mortalityRate / 365);    
  }
}
  
  // icons: arrow_drop_up, _drop_down or _left or _right
export enum Tendency {
  up, down, unchanged
}

export class DataSeries {
  name: any;
  series: Array<DataPoint>;
}

export class DataPoint {
  name: any;
  value: number;
}

export class MobilityData {
  iso2: string;
  region: string;
  subRegion1: string;
  subRegion2: string;
  date: Date;
  retailAndRecreation: number = 0;
  groceryAndPharmacy: number = 0;
  parks: number = 0;
  transitStations: number = 0;
  workplace: number = 0;
  residential: number = 0;
  get average(): number {
    return (this.retailAndRecreation + this.groceryAndPharmacy + this.parks +
      this.transitStations + this.workplace) / 5;
  }
}