# RideSim DC

Feel it before you ride it. Pick any trip in Washington, DC, see how stressful every block is, then ride it virtually in 3D or through real street photos.

Live at https://ridesimdc.com. Built on [RideScore DC](https://ridescoredc.com) by Civic Tech DC.

```bash
npm install   # also copies the MapLibre worker into public/maplibre
npm run dev
```

Data in `public/data/` is produced by `notebooks/ridesim/prep.py` in the ridescoredc-models fork. See `CLAUDE.md` for architecture and decisions.

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/).
