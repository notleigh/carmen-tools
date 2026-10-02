# carmen-cit

Tools for the city files (`.CIT`) of *Where in the World is Carmen Sandiego* (1985, DOS):
a browser editor and a command-line extract/pack. No game files are included; bring your own.

    npm install
    npm run dev          # editor at http://localhost:5173
    npm run build        # static site in dist/
    npm test             # add CARMEN_DIR=/path/to/game to also round-trip the real .CIT files

    npm run extract -- -o OUTDIR FILE.CIT ...   # .CIT -> CITY.json + CITY.png
    npm run pack -- -o OUTDIR CITY.json ...     # back to .CIT

Both the editor and `pack` refuse to write a city that breaks the rules in `src/validate.ts`.
