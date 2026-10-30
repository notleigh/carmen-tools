# WWCSE prototype scripts (throwaway)

Evidence for issue #1. No game data is included: run these against your own copy.
Run them from the folder holding `CITIES.DAT` and `CARMEN.DAT`, passing this folder's path as `DIR`.
First create the character table next to `res.py`:

    python3 -I -c "open('DIR/table.bin','wb').write(open('CARMEN.EXE','rb').read()[0x1bdcd:0x1bdcd+256])"

| Script | Run | Shows |
|---|---|---|
| `ok2.py` | `python3 -I DIR/ok2.py DIR` | Okumura LZSS reproduces all 163 images (uses `okumura.py`) |
| `txt.py` | `python3 -I DIR/txt.py DIR` | Text encoder reproduces all 367 city text resources; its nine `CITIES.DAT` "failures" are raw +10 resources |
| `order.py` | `python3 -I DIR/order.py DIR` | The stored row/column order is always the smaller encoding |
| `render.py` | `python3 -I DIR/render.py DIR CITIES.DAT 10002 10001 out.png` | Renders an image with its palette; assumes an even width |
| `unpack.py` | `python3 -I DIR/unpack.py CARMEN.EXE unp.bin` | Unpacks EXEPACK so the disassembly matches the real code layout |
| `ids.py` | `python3 -I DIR/ids.py CITIES.DAT CARMEN.DAT` | Resource id ranges and header sizes |

`okumura.py` run directly reports 138/163 because it rounds odd-width rows down; `ok2.py` has the fix.
The palette analysis is in `../wwcse-palette.prototype.py`.
