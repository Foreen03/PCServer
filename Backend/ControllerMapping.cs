using Newtonsoft.Json;
using System.Collections.Generic;

namespace Backend
{
    public class ControllerMapping
    {
        [JsonProperty("controllerMapping")]
        public MappingConfig? Mapping { get; set; }
    }

    public class MappingConfig
    {
        [JsonProperty("enabled")]
        public bool Enabled { get; set; }

        [JsonProperty("buttonMap")]
        public Dictionary<string, string>? ButtonMap { get; set; }

        [JsonProperty("axisMap")]
        public Dictionary<string, AxisConfig>? AxisMap { get; set; }

        [JsonProperty("sensorMap")]
        public Dictionary<string, SensorConfig>? SensorMap { get; set; }
    }

    public class AxisConfig
    {
        [JsonProperty("target")]
        public string? Target { get; set; }

        [JsonProperty("mode")]
        public string? Mode { get; set; }

        [JsonProperty("source")]
        public string? Source { get; set; }

        [JsonProperty("invert")]
        public bool Invert { get; set; }

        [JsonProperty("deadzone")]
        public double Deadzone { get; set; }

        [JsonProperty("scale")]
        public double Scale { get; set; }

        [JsonProperty("clamp")]
        public List<double>? Clamp { get; set; }

        [JsonProperty("smoothing")]
        public double Smoothing { get; set; }
    }

    public class SensorConfig
    {
        [JsonProperty("target")]
        public string? Target { get; set; }

        [JsonProperty("mode")]
        public string? Mode { get; set; }

        [JsonProperty("min_val")]
        public int MinValue { get; set; }

        [JsonProperty("max_val")]
        public int MaxValue { get; set; }

        [JsonProperty("responseCurve")]
        public string? ResponseCurve { get; set; }

        [JsonProperty("thresholds")]
        public Dictionary<string, int>? Thresholds { get; set; }

        [JsonProperty("smoothing")]
        public double Smoothing { get; set; }

        [JsonProperty("deadzone")]
        public int Deadzone { get; set; }
    }
}
