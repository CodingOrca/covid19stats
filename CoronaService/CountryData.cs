using Microsoft.WindowsAzure.Storage.Table;
using Newtonsoft.Json;
using System;

namespace CoronaService
{
  public class CountryEntity : TableEntity
  {
    public CountryEntity(CountryData country)
    {
      Name = country.Name;
      ProvinceName = country.ProvinceName;
      UpdateTime = country.UpdateTime;
      ConfirmedCases = country.StatisticData.ConfirmedCases;
      Deaths = country.StatisticData.Deaths;
      Recovered = country.StatisticData.Recovered;

      PartitionKey = country.Name + "_" + country.ProvinceName ?? "";
      RowKey = country.UpdateTime.ToString("yyyy-MM-dd hh:mm:ss");
    }

    public string Name { get; set; }

    public string ProvinceName { get; set; }

    public DateTime UpdateTime { get; set; }

    [JsonProperty(PropertyName = "confirmed")]
    public int ConfirmedCases { get; set; }

    [JsonProperty(PropertyName = "deaths")]
    public int Deaths { get; set; }

    [JsonProperty(PropertyName = "recovered")]
    public int Recovered { get; set; }
  }

  public class CountryData
  {
    [JsonProperty(PropertyName = "country")]
    public string Name { get; set; }

    [JsonProperty(PropertyName = "province")]
    public string ProvinceName { get; set; }

    [JsonProperty(PropertyName = "updatedAt")]
    public DateTime UpdateTime { get; set; }

    [JsonProperty(PropertyName = "stats")]
    public StatisticData StatisticData { get; set; }

    [JsonProperty(PropertyName = "coordinates")]
    public Coordinates Coordinates { get; set; }
  }

  public class StatisticData
  { 
    [JsonProperty(PropertyName = "confirmed")]
    public int ConfirmedCases { get; set; }

    [JsonProperty(PropertyName = "deaths")]
    public int Deaths { get; set; }

    [JsonProperty(PropertyName = "recovered")]
    public int Recovered { get; set; }

  }

  public class Coordinates
  {
    [JsonProperty(PropertyName = "latitude")]
    public double Latitude { get; set; }

    [JsonProperty(PropertyName = "longitude")]
    public double Longitude { get; set; }
  }
}
