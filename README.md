# carmen-tools

Tools for editing city data in the original DOS version of *Where in the World is Carmen Sandiego* from 1985. Feel like updating the original cities for some of the things that have happened in the intervening 40 years? Go for it! Want to clear up that the Soviet Union isn't a thing any more? Be my guest.

Under the hood it's a typescript library with a CLI that converts the original `.CIT` files into hopefully easily editable JSON files and PNG images. It also contains a vite / preact web interface if you prefer to edit that way.

I have no idea if this works at all on other versions, but given there's some logic specific to the 4-colour CGA images it feels a safe bet that it won't. (With that said, it's actually the later DOS VGA version that I have memories of, so potential future addition?)

## Love this city

On the disk for Where in the World is Carmen Sandiego there's a series of `.CIT` files that dictate the data for each city in the game: Where it appears on the map, the glorious CGA image, as well as things like intro text and clues that point to the city while you're investigating. You can pop the files in a text editor and you'll likely be able to see all the strings.

As long as the `.CIT` files are valid and conform to the DOS-style 8.3 filename length, the game will read them, and I haven't figured out a practical maximum of files as yet. So yeah, this means you can use these tools to create more cities for your game if you're convinced it was a crime that Naseby, New Zealand (population 140) was missing from the original game.

## CLI

Kick things off with:

```
npm install
```

Run extract to convert Carmen Sandiego's `.CIT` files into JSON with a png for easy editing:
```
npm run extract -- -o OUTDIR FILE.CIT
```

Edit as much as you like, and then run pack to go back from JSON/PNG to CIT files.
```
npm run pack -- -o OUTDIR CITY.json
```

## Editing the files

The JSON files contain a relative file path to the png of the image, which will 136x164 pixels in the classic CGA pallette. If you're adding your own image you do need to stick to the same dimensions, but it ram each pixel down to whatever the closest matching CGA colour is (no dithering etc.) In any case, probably better editing using the CGA colours.

I've tried to add sensible validation based on what my good friend Claude found digging around, but it won't be perfect (`src/validate.ts`). Keeping clue strings below 160 seems sensible, but the best reference is extracting a couple of existing files and getting a sense of the lengths that read alright. The web interface (below!) has validation baked in to the frontend.

Clues are used across genders, so use `@1` & `@2` for placeholders, where `@1 = he/she` and `@2 = his/her)`. As in `"@1 changed @2 money to dollarbucks."` will end up as `"He changed his money to dollarbucks."`

## Testing

The extraction / pack covers a few oddities about the original file format (Rome contains 3 intro strings, but only uses two of them?) So the original files can be round-tripped. There's even a handy test to prove if you set the env var `CARMEN_DIR` to point to a real copy of the game.

```
CARMEN_DIR=/path/to/game
npm test
```

## Web interface
There's a basic web interface included that uses the same underlying libraries. Drop in a `.CIT` file, edit away, and then save it back out again.

It's hosted at https://notleigh.github.io/carmen-tools/ and redeploys on every push to `main`.

Run a local dev server with
```
npm run dev          # editor at http://localhost:5173
```

Or do a build
```
npm run build        # static site in dist/
```