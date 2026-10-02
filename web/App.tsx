import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  CitError,
  LOCATIONS,
  MAX_STRING,
  cityFileName,
  encodePng,
  imageToRgba,
  validateCity,
  type CitImage,
  type Field,
  type ListName,
  type Problem,
} from "../src/index.ts";
import { blankDraft, draftToJson, editList, listLines, loadCit, saveCit, type Draft } from "./draft.ts";
import { imageFromFile } from "./image.ts";

const FIELD_LABELS: Partial<Record<Field, string>> = {
  name: "Name",
  mapX: "Map X",
  mapY: "Map Y",
  image: "Picture",
  locations: "",
  intro: "Intro",
  treasures: "Treasures",
};

/** "sportClub" -> "Sport club" */
function label(field: Field): string {
  return FIELD_LABELS[field] ?? field.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`).replace(/^./, (c) => c.toUpperCase());
}

const isLocation = (field: Field) => (LOCATIONS as readonly string[]).includes(field);

/** Textarea line (0-based) that a list problem points at. */
function problemLine(problem: Problem, draft: Draft): number | undefined {
  if (problem.index === undefined) return undefined;
  return listLines(draft.lists[problem.field as ListName])[problem.index]?.line;
}

function describe(problem: Problem, draft: Draft): string {
  const line = problemLine(problem, draft);
  const where = label(problem.field) + (line === undefined ? "" : ` line ${line + 1}`);
  return where ? `${where} ${problem.message}` : problem.message.replace(/^./, (c) => c.toUpperCase());
}

function focusProblem(problem: Problem, draft: Draft) {
  const el = document.getElementById(`field-${problem.field}`);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus();
  const line = problemLine(problem, draft);
  if (el instanceof HTMLTextAreaElement && line !== undefined) {
    const lines = el.value.split("\n");
    const start = lines.slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    el.setSelectionRange(start, start + lines[line].length);
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chrome and Edge only; the File System Access API isn't in TypeScript's DOM types yet. */
interface SaveFilePicker {
  showSaveFilePicker?(options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
}

/** Save As dialog where the browser has one, a plain download elsewhere. False if the user cancelled. */
async function saveFile(blob: Blob, name: string, description: string, extensions: string[]): Promise<boolean> {
  const picker = (window as SaveFilePicker).showSaveFilePicker;
  if (!picker) {
    download(blob, name);
    return true;
  }
  try {
    const handle = await picker.call(window, { suggestedName: name, types: [{ description, accept: { [blob.type]: extensions } }] });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}

function Picture({ image }: { image: CitImage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.putImageData(new ImageData(imageToRgba(image), image.width, image.height), 0, 0);
  }, [image]);
  return <canvas class="picture" ref={ref} />;
}

function Problems({ problems, draft }: { problems: Problem[]; draft: Draft }) {
  if (!problems.length) return null;
  return (
    <ul class="error">
      {problems.map((p) => (
        <li>{describe(p, draft)}</li>
      ))}
    </ul>
  );
}

function ListEditor(props: { field: ListName; draft: Draft; problems: Problem[]; onChange: (text: string) => void }) {
  const { field, draft, problems, onChange } = props;
  const text = draft.lists[field];
  const lines = text.split("\n");
  const off = isLocation(field) && !listLines(text).length;
  return (
    <section class={off ? "off" : undefined}>
      <h3>
        <label for={`field-${field}`}>{label(field)}</label>
        {off && " (not in this city)"}
      </h3>
      <div class="list">
        <div class="gutter" aria-hidden="true">
          {lines.map((line) => (
            <div class={line.length > MAX_STRING ? "over" : undefined}>{line.trim() ? line.length : " "}</div>
          ))}
        </div>
        <textarea
          id={`field-${field}`}
          wrap="off"
          rows={lines.length + 1}
          value={text}
          onInput={(e) => onChange(e.currentTarget.value)}
        />
      </div>
      <Problems problems={problems.filter((p) => p.field === field)} draft={draft} />
    </section>
  );
}

export function App() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const openInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const problems = useMemo(() => (draft ? validateCity(draftToJson(draft), draft.image) : []), [draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const okToDiscard = () => !dirty || confirm("Discard your unsaved changes?");

  function start(next: Draft, nextWarnings: string[] = []) {
    setDraft(next);
    setDirty(false);
    setWarnings(nextWarnings);
    setError("");
  }

  function update(next: Draft) {
    setDraft(next);
    setDirty(true);
    setError("");
  }

  async function openCit(file: File) {
    try {
      const { draft, warnings } = loadCit(new Uint8Array(await file.arrayBuffer()));
      start(draft, warnings);
    } catch (e) {
      if (!(e instanceof CitError || e instanceof RangeError)) throw e;
      setError(`${file.name} isn't a city file this editor can read (${e.message}).`);
    }
  }

  async function replaceImage(file: File) {
    if (!draft) return;
    try {
      update({ ...draft, image: await imageFromFile(file) });
    } catch {
      setError(`${file.name} couldn't be opened as an image.`);
    }
  }

  async function downloadPng() {
    if (!draft) return;
    const name = cityFileName(draft.name).replace(/CIT$/, "png");
    const blob = new Blob([(await encodePng(draft.image)) as Uint8Array<ArrayBuffer>], { type: "image/png" });
    await saveFile(blob, name, "PNG image", [".png"]);
  }

  async function save() {
    if (!draft || problems.length) return;
    let bytes: Uint8Array;
    try {
      bytes = saveCit(draft);
    } catch (e) {
      if (!(e instanceof CitError)) throw e;
      setError(e.message);
      return;
    }
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" });
    if (await saveFile(blob, cityFileName(draft.name), "Carmen Sandiego city", [".CIT", ".cit"])) setDirty(false);
  }

  const fileInput = (ref: typeof openInput, accept: string, onFile: (file: File) => void) => (
    <input
      type="file"
      accept={accept}
      hidden
      ref={ref}
      onChange={(e) => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file) onFile(file);
      }}
    />
  );

  return (
    <>
      <h1>Carmen Sandiego city editor</h1>
      <p>
        <button onClick={() => okToDiscard() && openInput.current!.click()}>Open .cit…</button>{" "}
        <button onClick={() => okToDiscard() && start(blankDraft())}>New city</button>
        {fileInput(openInput, ".cit", openCit)}
        {fileInput(imageInput, "image/*", replaceImage)}
      </p>
      {error && <p class="error">{error}</p>}
      {warnings.length > 0 && (
        <p>
          This file had problems, which saving will repair: {warnings.join("; ")}.{" "}
          <button onClick={() => setWarnings([])}>Dismiss</button>
        </p>
      )}

      {!draft ? (
        <p>Open a .cit file from your copy of Where in the World is Carmen Sandiego (1985), or start a new city.</p>
      ) : (
        <div class="layout">
          <aside>
            <Picture image={draft.image} />
            <p>
              <button id="field-image" onClick={() => imageInput.current!.click()}>
                Replace…
              </button>{" "}
              <button onClick={downloadPng}>Download PNG</button>
            </p>
            <p>
              <label>
                Name
                <br />
                <input id="field-name" value={draft.name} onInput={(e) => update({ ...draft, name: e.currentTarget.value })} />
              </label>
            </p>
            <p>
              <label>
                Map X{" "}
                <input
                  id="field-mapX"
                  inputMode="numeric"
                  size={4}
                  value={draft.mapX}
                  onInput={(e) => update({ ...draft, mapX: e.currentTarget.value })}
                />
              </label>{" "}
              <label>
                Map Y{" "}
                <input
                  id="field-mapY"
                  inputMode="numeric"
                  size={4}
                  value={draft.mapY}
                  onInput={(e) => update({ ...draft, mapY: e.currentTarget.value })}
                />
              </label>
            </p>
            <p>
              <small>
                Pixels on the game's 264×95 world map, which is centred on the Pacific. For reference: Athens 208, 25 ·
                New York 138, 25 · Tokyo 45, 32 · Sydney 54, 80.
              </small>
            </p>
            <Problems problems={problems.filter((p) => ["name", "mapX", "mapY", "image"].includes(p.field))} draft={draft} />

            <h2>Save</h2>
            {problems.length ? (
              <>
                <p>Fix these to save:</p>
                <ul>
                  {problems.map((p) => (
                    <li>
                      <a
                        href={`#field-${p.field}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusProblem(p, draft);
                        }}
                      >
                        {describe(p, draft)}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Ready to save{dirty ? "" : " (no unsaved changes)"}.</p>
            )}
            <button disabled={problems.length > 0} onClick={save}>
              Save {cityFileName(draft.name)}
            </button>
            <p>
              <small>
                The game finds cities by file name, so keep it to 8 letters or digits plus .CIT. If your browser saved
                it as {cityFileName(draft.name).replace(".CIT", "(1).CIT")}, rename it.
              </small>
            </p>
          </aside>

          <main>
            {(["intro", "treasures"] as const).map((field) => (
              <ListEditor field={field} draft={draft} problems={problems} onChange={(t) => update(editList(draft, field, t))} />
            ))}
            <h2 id="field-locations" tabIndex={-1}>
              Locations
            </h2>
            <p>
              What witnesses say when the thief is heading to this city, one clue per line. @1 = he/she, @2 = his/her.
              A location with no clues isn't in this city; at least 8 need clues.
            </p>
            <Problems problems={problems.filter((p) => p.field === "locations")} draft={draft} />
            {LOCATIONS.map((field) => (
              <ListEditor field={field} draft={draft} problems={problems} onChange={(t) => update(editList(draft, field, t))} />
            ))}
          </main>
        </div>
      )}
    </>
  );
}
