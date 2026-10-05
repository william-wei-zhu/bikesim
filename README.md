# BikeSim (formerly RideSim DC)

Feel it before you ride it. Pick a city and a trip, see how stressful every block is, then ride it virtually in 3D or through real street photos.

Live at https://bikesim.org (DC also at https://ridesimdc.com). Started on [RideScore DC](https://ridescoredc.com) by Civic Tech DC for the Oct 3, 2026 hackathon (tag `hackathon-2026-10-03`).

```bash
npm install   # also copies the MapLibre worker into public/maplibre
npm run dev
```

Cities are listed in `lib/cities.ts`; each live city's data sits in `public/data/<city>/`. DC's comes from `notebooks/ridesim/prep.py` in the ridescoredc-models fork; other cities' from the bikesim-data pipeline (OpenStreetMap-based stress, same file format). See `CLAUDE.md` for architecture and decisions.

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/).
