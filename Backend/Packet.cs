using Newtonsoft.Json;
using System.Collections.Generic;

namespace Backend
{
    public class Packet
    {
        public string packetType;
        
        [JsonProperty("timestamp")]
        public long timeStamp;
        
        public Dictionary<string, object> payload;

        public Packet(string packetType, long timeStamp, Dictionary<string, object> payload)
        {
            this.packetType = packetType;
            this.timeStamp = timeStamp;
            this.payload = payload;
        }
    }
}
