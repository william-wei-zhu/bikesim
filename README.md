# RideSim DC

Break the walls, ride the city. A 3D map of where Washington, DC streets become walls for people on bikes, who those walls cut off, and which single fixes would connect the most residents.

Live at https://ridesimdc.com. Built on [RideScore DC](https://ridescoredc.com) by Civic Tech DC.

```bash
npm install   # also copies the MapLibre worker into public/maplibre
npm run dev
```

Data in `public/data/` is produced by `notebooks/ridesim/prep.py` in the ridescoredc-models fork. See `CLAUDE.md` for architecture and decisions.

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/).
