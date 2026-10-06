// City registry: every city-specific value the app needs. Pure data (no React, no browser APIs),
// so the geocode route, pages and the map engine can all import it.
// Street data for each city is built by pipeline/ (bikesim-data) and served from the bikesim-data bucket.

export interface CityPlace { label: string; x: number; y: number }

export interface City {
  slug: string;
  /** Full name for titles and copy: "Washington, DC". */
  name: string;
  /** Short name for tight spots: "DC". */
  short: string;
  /** State or district, for the city picker: "WA". */
  state: string;
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
  /** Build date of the city's street data; part of its URL so a rebuild never meets a stale cache. */
  data: string;
  examples: { label: string; from: CityPlace; to: CityPlace }[];
  /** Free public aerial photo tiles for the city, if any. */
  aerial?: { tiles: string; bounds: [number, number, number, number]; attribution: string };
}

const OSM_LTS = { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", by: "BikeSim's stress model" };
const OSM_RECORDS = "OpenStreetMap's street tags";

// USGS National Map orthoimagery: public domain, covers every US city.
const usgs = (box: City["box"]): City["aerial"] => ({
  tiles: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
  bounds: box, attribution: "Aerial photos: USGS The National Map",
});

const p = (label: string, y: number, x: number): CityPlace => ({ label, x, y });
const trip = (from: CityPlace, to: CityPlace) => ({ label: `${from.label} to ${to.label}`, from, to });

/** Cities with OSM-based stress share these values. */
function osmCity(c: Omit<City, "stress" | "records" | "crashes" | "live" | "zoom" | "aerial"> & Partial<Pick<City, "stress" | "zoom">>): City {
  return { stress: OSM_LTS, records: OSM_RECORDS, crashes: false, live: true, zoom: 13.4, aerial: usgs(c.box), ...c };
}

export const CITIES: City[] = [
  {
    slug: "dc", name: "Washington, DC", short: "DC", state: "DC", live: true,
    // Opens over downtown and the Mall so the 3D city reads immediately (buildings appear from zoom 13).
    center: [-77.0275, 38.8975], zoom: 13.4,
    box: [-77.12, 38.79, -76.909, 38.996],
    searchHint: ", Washington, DC", searchWords: ["washington", "dc", "district of columbia"],
    stress: { name: "RideScore DC", url: "https://ridescoredc.com", by: "Civic Tech DC" },
    records: "DDOT's street records", crashes: true, transit: "Metro", data: "2026-10-05",
    examples: [
      trip(p("Petworth", 38.9413, -77.0247), p("The Wharf", 38.8786, -77.0236)),
      trip(p("Anacostia", 38.8625, -76.9952), p("Eastern Market", 38.8862, -76.9963)),
      trip(p("Georgetown", 38.9055, -77.0628), p("Union Station", 38.8973, -77.0063)),
    ],
    // DC government's 2025 aerial photos (the same imagery RideScore DC's Imagery button uses).
    aerial: {
      tiles: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Ortho2025_WebMercator/MapServer/tile/{z}/{y}/{x}",
      bounds: [-77.12, 38.79, -76.909, 38.996], attribution: "Aerial photos © DC Office of the Chief Technology Officer",
    },
  },
  osmCity({
    slug: "new-york", name: "New York City", short: "NYC", state: "NY", center: [-73.9857, 40.7484], zoom: 13.2,
    box: [-74.26, 40.49, -73.70, 40.92], searchHint: ", New York, NY",
    searchWords: ["new york", "nyc", "brooklyn", "queens", "bronx", "manhattan", "staten island"], transit: "Subway", data: "2026-10-05",
    examples: [
      trip(p("Williamsburg", 40.7143, -73.9614), p("Union Square", 40.7359, -73.9911)),
      trip(p("Prospect Park", 40.6602, -73.9690), p("Brooklyn Bridge Park", 40.7003, -73.9967)),
      trip(p("Harlem", 40.8116, -73.9465), p("Central Park South", 40.7661, -73.9764)),
    ],
  }),
  osmCity({
    slug: "seattle", name: "Seattle", short: "Seattle", state: "WA", center: [-122.335, 47.608],
    box: [-122.46, 47.48, -122.22, 47.74], searchHint: ", Seattle, WA", searchWords: ["seattle"], transit: "Link", data: "2026-10-05",
    examples: [
      trip(p("Fremont", 47.6510, -122.3500), p("Pike Place Market", 47.6097, -122.3422)),
      trip(p("Capitol Hill", 47.6253, -122.3222), p("University of Washington", 47.6553, -122.3035)),
      trip(p("Ballard", 47.6687, -122.3847), p("South Lake Union", 47.6265, -122.3366)),
    ],
  }),
  osmCity({
    slug: "portland", name: "Portland", short: "Portland", state: "OR", center: [-122.676, 45.52],
    box: [-122.84, 45.43, -122.47, 45.66], searchHint: ", Portland, OR", searchWords: ["portland"], transit: "MAX", data: "2026-10-05",
    examples: [
      trip(p("Alberta Arts", 45.5590, -122.6450), p("Pioneer Square", 45.5189, -122.6793)),
      trip(p("Sellwood", 45.4647, -122.6530), p("OMSI", 45.5084, -122.6655)),
      trip(p("Hawthorne", 45.5122, -122.6337), p("Pearl District", 45.5285, -122.6826)),
    ],
  }),
  osmCity({
    slug: "san-francisco", name: "San Francisco", short: "SF", state: "CA", center: [-122.4194, 37.7793],
    box: [-122.52, 37.70, -122.35, 37.84], searchHint: ", San Francisco, CA", searchWords: ["san francisco", "sf"], transit: "BART", data: "2026-10-05",
    examples: [
      trip(p("The Mission", 37.7599, -122.4148), p("Ferry Building", 37.7955, -122.3937)),
      trip(p("Golden Gate Park", 37.7694, -122.4862), p("Civic Center", 37.7793, -122.4176)),
      trip(p("Noe Valley", 37.7502, -122.4337), p("Caltrain 4th & King", 37.7764, -122.3943)),
    ],
  }),
  osmCity({
    slug: "los-angeles", name: "Los Angeles", short: "LA", state: "CA", center: [-118.2437, 34.0522], zoom: 13,
    box: [-118.67, 33.70, -118.15, 34.34], searchHint: ", Los Angeles, CA", searchWords: ["los angeles", "la"], transit: "Metro", data: "2026-10-05",
    examples: [
      trip(p("Echo Park", 34.0782, -118.2606), p("Union Station", 34.0562, -118.2365)),
      trip(p("Venice Beach", 33.9850, -118.4695), p("Santa Monica Pier", 34.0094, -118.4973)),
      trip(p("Koreatown", 34.0618, -118.3004), p("USC", 34.0224, -118.2851)),
    ],
  }),
  osmCity({
    slug: "chicago", name: "Chicago", short: "Chicago", state: "IL", center: [-87.6298, 41.8818],
    box: [-87.94, 41.64, -87.52, 42.03], searchHint: ", Chicago, IL", searchWords: ["chicago"], transit: "L", data: "2026-10-05",
    examples: [
      trip(p("Wicker Park", 41.9088, -87.6796), p("The Loop", 41.8827, -87.6278)),
      trip(p("Logan Square", 41.9231, -87.7093), p("Lincoln Park Zoo", 41.9211, -87.6340)),
      trip(p("Hyde Park", 41.7943, -87.5907), p("Museum Campus", 41.8663, -87.6170)),
    ],
  }),
  osmCity({
    slug: "boston", name: "Boston", short: "Boston", state: "MA", center: [-71.0589, 42.3601],
    box: [-71.19, 42.23, -70.99, 42.40], searchHint: ", Boston, MA", searchWords: ["boston"], transit: "T", data: "2026-10-05",
    examples: [
      trip(p("Jamaica Plain", 42.3097, -71.1151), p("Back Bay", 42.3503, -71.0810)),
      trip(p("South End", 42.3388, -71.0765), p("North End", 42.3647, -71.0542)),
      trip(p("Fenway", 42.3467, -71.0972), p("Boston Common", 42.3550, -71.0656)),
    ],
  }),
  osmCity({
    slug: "philadelphia", name: "Philadelphia", short: "Philly", state: "PA", center: [-75.1652, 39.9526],
    box: [-75.28, 39.87, -74.96, 40.14], searchHint: ", Philadelphia, PA", searchWords: ["philadelphia", "philly"], transit: "SEPTA", data: "2026-10-05",
    examples: [
      trip(p("Fishtown", 39.9721, -75.1340), p("City Hall", 39.9524, -75.1636)),
      trip(p("University City", 39.9522, -75.1932), p("Rittenhouse Square", 39.9496, -75.1718)),
      trip(p("South Philly", 39.9260, -75.1700), p("Art Museum", 39.9656, -75.1810)),
    ],
  }),
  osmCity({
    slug: "pittsburgh", name: "Pittsburgh", short: "Pittsburgh", state: "PA", center: [-79.9959, 40.4406],
    box: [-80.10, 40.36, -79.86, 40.51], searchHint: ", Pittsburgh, PA", searchWords: ["pittsburgh"], transit: "T", data: "2026-10-05",
    examples: [
      trip(p("Lawrenceville", 40.4670, -79.9600), p("Point State Park", 40.4416, -80.0127)),
      trip(p("Squirrel Hill", 40.4384, -79.9228), p("Oakland", 40.4443, -79.9532)),
      trip(p("South Side", 40.4286, -79.9800), p("Strip District", 40.4517, -79.9850)),
    ],
  }),
  osmCity({
    slug: "minneapolis", name: "Minneapolis", short: "Minneapolis", state: "MN", center: [-93.265, 44.9778],
    box: [-93.33, 44.89, -93.19, 45.06], searchHint: ", Minneapolis, MN", searchWords: ["minneapolis"], transit: "Light rail", data: "2026-10-05",
    examples: [
      trip(p("Uptown", 44.9490, -93.2980), p("Stone Arch Bridge", 44.9808, -93.2531)),
      trip(p("Lake Nokomis", 44.9086, -93.2420), p("Minnehaha Falls", 44.9153, -93.2110)),
      trip(p("Northeast", 45.0000, -93.2560), p("University of Minnesota", 44.9740, -93.2277)),
    ],
  }),
  osmCity({
    slug: "denver", name: "Denver", short: "Denver", state: "CO", center: [-104.9903, 39.7392],
    box: [-105.11, 39.61, -104.60, 39.91], searchHint: ", Denver, CO", searchWords: ["denver"], transit: "Light rail", data: "2026-10-05",
    examples: [
      trip(p("Highlands", 39.7620, -105.0110), p("Union Station", 39.7530, -105.0002)),
      trip(p("Washington Park", 39.7000, -104.9700), p("State Capitol", 39.7393, -104.9848)),
      trip(p("City Park", 39.7476, -104.9505), p("RiNo", 39.7690, -104.9790)),
    ],
  }),
  osmCity({
    slug: "austin", name: "Austin", short: "Austin", state: "TX", center: [-97.7431, 30.2672],
    box: [-97.94, 30.10, -97.56, 30.52], searchHint: ", Austin, TX", searchWords: ["austin"], transit: "CapMetro", data: "2026-10-05",
    examples: [
      trip(p("Hyde Park", 30.3050, -97.7290), p("Texas Capitol", 30.2747, -97.7404)),
      trip(p("East Austin", 30.2620, -97.7220), p("Zilker Park", 30.2669, -97.7729)),
      trip(p("South Congress", 30.2470, -97.7500), p("UT Austin", 30.2849, -97.7341)),
    ],
  }),
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

/** Where each city's street data lives: network.bin, streets.pmtiles, blocks.json, pois.json, meta.json. */
const DATA_ROOT = process.env.NEXT_PUBLIC_DATA_BASE || "https://storage.googleapis.com/bikesim-data";
export const cityDataBase = (c: City) => `${DATA_ROOT}/${c.slug}/${c.data}`;
