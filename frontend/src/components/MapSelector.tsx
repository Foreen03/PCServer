import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LatLng } from "leaflet";
import { useState } from "react";

interface MapSelectorProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const [position, setPosition] = useState<LatLng | null>(null);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  return (
    <div style={{ height: "400px", width: "100%" }}>
      <MapContainer
        center={[2.924231, 101.643027]}
        zoom={17}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />
        {position && <Marker position={position}></Marker>}
      </MapContainer>
    </div>
  );
};

export default MapSelector;
