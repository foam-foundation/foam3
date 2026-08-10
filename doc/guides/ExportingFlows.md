# Exporting ("Lifting") Flows

When you build or edit a Reflow flow in the running app, it lives in the `flowDAO` on the
server. To capture it — to check it into source control, move it between environments, or hand
it to someone else — you "lift" it out of the DAO as text. This guide covers the reliable way to
do that from the UI.

## Steps

1. **Open Reflow.** Navigate to the Reflow console (search the app menu for **Reflow** and open
   it).

2. **Open the Flow DAO.** In the console, type:

   ```
   dao flow
   ```

   This runs the `dao` command against `flowDAO` and renders a table of every saved flow.

3. **Find the flow with a `where` clause.** The flow list can be long, so filter it with an
   [AQL](./AutoQueryParser.md) query in the DAO browser's search bar instead of scrolling. Match
   on the flow's `name`:

   ```
   name="PropertyBorder"
   ```

   Other useful filters:

   ```
   name~"Demo"          // contains "Demo"
   category="demos"     // all flows in the demos category
   ```

   The table narrows to the matching flow(s).

4. **Open the export in a new tab.** Select the flow's row and choose **Download**. Two format
   options appear:

   - **JSON** — a plain JSON representation of the flow object. Good for inspection, diffing, or
     tooling that expects JSON.
   - **J (journal)** — the journal form, i.e. the `p({ ... })` entry you see in a `.jrl` file.
     This is what a `flows.jrl` stores, so it is the one to use when updating the checked-in
     flow.

   Rather than saving a file, **right-click the format you want (JSON or J) and choose "Open Link
   in New Tab."** The raw text renders directly in the browser.

5. **Select all and copy.** In that new tab, select the entire contents (**Cmd+A** on macOS /
   **Ctrl+A** on Windows/Linux) and copy it (**Cmd+C** / **Ctrl+C**). This is the full,
   authoritative text of the flow.

6. **Replace the flow in its source file.** Open the flow's source `.jrl` (e.g.
   `foam3/src/foam/demos/u2/working-with-u2/flows.jrl`), locate the entry for this flow — find
   its `"name":"..."` — and replace that flow's `p({ ... })` block with the text you just copied.
   Save. On the next build the updated flow replays into `flowDAO`.

## Notes

- **Lift the whole flow, not just a block.** Exporting through `flowDAO` captures the complete
  flow — metadata (`name`, `label`, `version`, `category`), access control, and the full
  serialized `script` of blocks. Copying an individual block's text out of the editor loses this
  wrapper.
- **Version bumps.** Each save increments the flow's `version`. If you re-lift after editing,
  expect the `version` (and block contents) to differ from the copy you exported earlier — this
  is how the app detects that a stored flow is newer than a checked-in one.
- **Round-trip.** A lifted **J** entry can be dropped straight into a `flows.jrl` under the
  appropriate directory; it will be replayed into `flowDAO` on the next build. See
  [Journals](./Journals.md) for how `.jrl` files load.

## Related

- [Reflow](./Reflow.md) — the console, flows, and block model.
- [AutoQueryParser](./AutoQueryParser.md) — the `where`-clause query syntax used in step 3.
- [Journals](./Journals.md) — how exported **J** entries are loaded back.
