using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Backend
{
    public class PCPacket
    {
        public string? type { get; set; }
        public long timeStamp { get; set; }
        public string? data { get; set; }
    }
}
