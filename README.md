# BikeSim

Feel it before you ride it. Pick a city and a trip, see how stressful every block is, then ride it virtually through real street photos or a 3D model of the city.

Live at https://bikesim.org for 13 US cities (ridesimdc.com redirects). Started as RideSim DC on [RideScore DC](https://ridescoredc.com) by Civic Tech DC for the Oct 3, 2026 hackathon (tag `hackathon-2026-10-03`).

```bash
npm install   # also copies the MapLibre worker into public/maplibre
npm run dev
```

- Cities are listed in `lib/cities.ts`. Each city's street data (`network.bin`, `streets.pmtiles`, `blocks.json`, `pois.json`, `meta.json`) is served from the public bucket `gs://bikesim-data/<city>/<build date>/`.
- `pipeline/` builds that data from OpenStreetMap and scores every block with Level of Traffic Stress (Furth 2017 criteria; DC uses RideScore DC's scores). See `pipeline/README.md`.
- Accounts (needed for Street View after two rides per device, and for saved trips; sign-in emails go through Resend SMTP) use Firebase on the GCP project `ridesimdc`. Copy the `NEXT_PUBLIC_*` variables into `.env.local` to run them locally.

See `CLAUDE.md` for architecture and decisions.

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/). Street data © OpenStreetMap contributors (ODbL).
