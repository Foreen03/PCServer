export interface PhoneDevice {
  id: string
  name: string
  /** Logical width in dp/pt (portrait) */
  width: number
  /** Logical height in dp/pt (portrait) */
  height: number
  /** Corner radius of the screen bezel */
  bezelRadius: number
}

export const PHONE_DEVICES: PhoneDevice[] = [
  { id: "iphone-15", name: "iPhone 15", width: 393, height: 852, bezelRadius: 48 },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", width: 430, height: 932, bezelRadius: 52 },
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, bezelRadius: 0 },
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 892, bezelRadius: 44 },
  { id: "pixel-8-pro", name: "Pixel 8 Pro", width: 448, height: 998, bezelRadius: 44 },
  { id: "samsung-s24", name: "Samsung Galaxy S24", width: 412, height: 915, bezelRadius: 40 },
  { id: "samsung-s24-ultra", name: "Samsung Galaxy S24 Ultra", width: 412, height: 915, bezelRadius: 12 },
  { id: "oneplus-12", name: "OnePlus 12", width: 412, height: 919, bezelRadius: 44 },
  { id: "ipad-mini", name: "iPad Mini", width: 744, height: 1133, bezelRadius: 20 },
  { id: "ipad-pro-11", name: "iPad Pro 11\"", width: 834, height: 1194, bezelRadius: 20 },
  { id: "samsung-tab-s9", name: "Samsung Galaxy Tab S9", width: 800, height: 1280, bezelRadius: 16 },
  { id: "custom-16-9", name: "Generic 16:9", width: 412, height: 732, bezelRadius: 32 },
]
