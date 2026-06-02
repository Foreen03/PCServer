import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLng } from "leaflet";
import { useState } from "react";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapSelectorProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialPosition?: { lat: number; lng: number } | null;
  height?: string;
}

const MapSelector = ({ onLocationSelect, initialPosition, height = "400px" }: MapSelectorProps) => {
  const [position, setPosition] = useState<LatLng | null>(
    initialPosition ? new LatLng(initialPosition.lat, initialPosition.lng) : null
  );

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const center: [number, number] = initialPosition
    ? [initialPosition.lat, initialPosition.lng]
    : [2.924231, 101.643027];

  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={17}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />
        {position && <Marker position={position} icon={defaultIcon}></Marker>}
      </MapContainer>
    </div>
  );
};

export default MapSelector;

