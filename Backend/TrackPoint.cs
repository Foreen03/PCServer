namespace Backend
{
    public class TrackPoint
    {
        public double Lat { get; set; }
        public double Lon { get; set; }
        public DateTime Time { get; set; }
        public double? Elevation { get; set; }
        public double? Speed { get; set; }     // m/s, stored in <extensions>
        public double? Cadence { get; set; }   // raw cadence value
        public double? Heading { get; set; }   // degrees true north
    }
}