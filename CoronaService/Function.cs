using Microsoft.Azure.WebJobs;
using Microsoft.Extensions.Logging;
using Microsoft.WindowsAzure.Storage.Blob;
using Microsoft.WindowsAzure.Storage.Table;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace CoronaService
{
    public static class Function
    {
        [FunctionName("Function")]
        public static async Task Run(
          [TimerTrigger("%TriggerScheduleExpression%")]TimerInfo myTimer,
          [Table("jhurawdata")]CloudTable rawDataTable,
          [Blob("jhurawdata")]CloudBlobContainer rawDataContainer,
          ILogger log)
        {
            await rawDataContainer.CreateIfNotExistsAsync();
            log.LogInformation($"C# Timer trigger function executed at: {DateTime.Now}");
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync("https://corona.lmao.ninja/v2/jhucsse");
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();

                var blobName = DateTime.UtcNow.ToString("yyyy-MM-dd-HHmmss") + ".json";
                var blob = rawDataContainer.GetBlockBlobReference(blobName);
                await blob.UploadTextAsync(content);

                var countryList = JsonConvert.DeserializeObject<List<CountryData>>(content);
                foreach (var country in countryList)
                {
                    var entity = new CountryEntity(country);
                    await rawDataTable.ExecuteAsync(TableOperation.InsertOrReplace(entity));
                }
            }
        }
    }
}
