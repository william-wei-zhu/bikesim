// City registry: every city-specific value the app needs. Pure data (no React, no browser APIs),
// so the geocode route, pages and the map engine can all import it.
// A city is `live` once its street data is built into public/data/<slug>/ (see the bikesim-data pipeline).

export interface CityPlace { label: string; x: number; y: number }

export interface City {
  slug: string;
  /** Full name for titles and copy: "Washington, DC". */
  name: string;
  /** Short name for tight spots: "DC". */
  short: string;
  live: boolean;
  /** Opening camera over downtown, north up. */
  center: [number, number];
  zoom: number;
  /** City limits as [west, south, east, north]: bounds the address search and (padded) the map. */
  box: [number, number, number, number];
  /** Appended to address searches that don't already name the city, e.g. ", Seattle, WA". */
  searchHint: string;
  /** Lower-case words that mean the search already names the city. */
  searchWords: string[];
  /** Where the stress scores come from, credited in the trip panel, footer and About. */
  stress: { name: string; url: string; by?: string };
  /** What the per-block facts come from, for the "estimated" note: "DDOT's street records". */
  records: string;
  /** True when blocks.json carries 5-year crash counts. */
  crashes: boolean;
  /** Search suggestion label for transit stations ("Metro" in DC). */
  transit: string;
  examples: { label: string; from: CityPlace; to: CityPlace }[];
  /** Free public aerial photo tiles for the city, if any. */
  aerial?: { tiles: string; bounds: [number, number, number, number]; attribution: string };
}

const OSM_LTS = { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright" };

// Cities waiting on data share these defaults; each gets real values when its data is built.
function soon(slug: string, name: string, short: string, center: [number, number], box: City["box"], searchHint: string, searchWords: string[]): City {
  return {
    slug, name, short, live: false, center, zoom: 13.4, box, searchHint, searchWords,
    stress: OSM_LTS, records: "OpenStreetMap", crashes: false, transit: "Station", examples: [],
  };
}

export const CITIES: City[] = [
  {
    slug: "dc", name: "Washington, DC", short: "DC", live: true,
    // Opens over downtown and the Mall so the 3D city reads immediately (buildings appear from zoom 13).
    center: [-77.0275, 38.8975], zoom: 13.4,
    box: [-77.12, 38.79, -76.909, 38.996],
    searchHint: ", Washington, DC", searchWords: ["washington", "dc", "district of columbia"],
    stress: { name: "RideScore DC", url: "https://ridescoredc.com", by: "Civic Tech DC" },
    records: "DDOT's street records", crashes: true, transit: "Metro",
    examples: [
      { label: "Petworth to the Wharf", from: { label: "Petworth", x: -77.0247, y: 38.9413 }, to: { label: "The Wharf", x: -77.0236, y: 38.8786 } },
      { label: "Anacostia to Eastern Market", from: { label: "Anacostia", x: -76.9952, y: 38.8625 }, to: { label: "Eastern Market", x: -76.9963, y: 38.8862 } },
      { label: "Georgetown to Union Station", from: { label: "Georgetown", x: -77.0628, y: 38.9055 }, to: { label: "Union Station", x: -77.0063, y: 38.8973 } },
    ],
    // DC government's 2025 aerial photos (the same imagery RideScore DC's Imagery button uses).
    aerial: {
      tiles: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Ortho2025_WebMercator/MapServer/tile/{z}/{y}/{x}",
      bounds: [-77.12, 38.79, -76.909, 38.996], attribution: "Aerial photos © DC Office of the Chief Technology Officer",
    },
  },
  soon("seattle", "Seattle", "Seattle", [-122.335, 47.608], [-122.46, 47.48, -122.22, 47.74], ", Seattle, WA", ["seattle"]),
  soon("portland", "Portland", "Portland", [-122.676, 45.52], [-122.84, 45.43, -122.47, 45.66], ", Portland, OR", ["portland"]),
  soon("san-francisco", "San Francisco", "SF", [-122.4194, 37.7793], [-122.52, 37.70, -122.35, 37.84], ", San Francisco, CA", ["san francisco", "sf"]),
  soon("los-angeles", "Los Angeles", "LA", [-118.2437, 34.0522], [-118.67, 33.70, -118.15, 34.34], ", Los Angeles, CA", ["los angeles", "la"]),
  soon("chicago", "Chicago", "Chicago", [-87.6298, 41.8818], [-87.94, 41.64, -87.52, 42.03], ", Chicago, IL", ["chicago"]),
  soon("austin", "Austin", "Austin", [-97.7431, 30.2672], [-97.94, 30.10, -97.56, 30.52], ", Austin, TX", ["austin"]),
  soon("pittsburgh", "Pittsburgh", "Pittsburgh", [-79.9959, 40.4406], [-80.10, 40.36, -79.86, 40.51], ", Pittsburgh, PA", ["pittsburgh"]),
  soon("boston", "Boston", "Boston", [-71.0589, 42.3601], [-71.19, 42.23, -70.99, 42.40], ", Boston, MA", ["boston"]),
  soon("new-york", "New York City", "NYC", [-73.9857, 40.7484], [-74.26, 40.49, -73.70, 40.92], ", New York, NY", ["new york", "nyc", "brooklyn", "queens", "bronx", "manhattan", "staten island"]),
  soon("philadelphia", "Philadelphia", "Philly", [-75.1652, 39.9526], [-75.28, 39.87, -74.96, 40.14], ", Philadelphia, PA", ["philadelphia", "philly"]),
  soon("minneapolis", "Minneapolis", "Minneapolis", [-93.265, 44.9778], [-93.33, 44.89, -93.19, 45.06], ", Minneapolis, MN", ["minneapolis"]),
  soon("denver", "Denver", "Denver", [-104.9903, 39.7392], [-105.11, 39.61, -104.60, 39.91], ", Denver, CO", ["denver"]),
];

export const LIVE_CITIES = CITIES.filter((c) => c.live);

export function getCity(slug: string | null | undefined): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/** The map may pan a little past the city limits, never across the country. */
export function cityMaxBounds(c: City): [[number, number], [number, number]] {
  const [w, s, e, n] = c.box;
  return [[w - 0.23, s - 0.09], [e + 0.16, n + 0.08]];
}

/** Where each city's street data lives. */
export const cityDataBase = (c: City) => `/data/${c.slug}`;
