# Railroad notation for `foam.parse` grammars

Railroad skin, PEG semantics. Two conventions differ from textbook railroad
and are stated on every page's legend: **branch numbers are priority** (ordered
choice, first match wins) and **loops are greedy** (never give back).

## Track elements

| Parser | Drawing | Glyph / text |
|---|---|---|
| `Literal` | rounded yellow box | `"text"` |
| `LiteralIC` | rounded yellow box + badge | `"text"` · `aA` |
| `Range` | rounded yellow box | `a…z` |
| `Chars` | rounded yellow box | `[abc]` |
| `NotChars` | rounded yellow box | `¬[abc]` |
| `AnyChar` | rounded yellow box | `•` |
| `EOF` | rounded yellow box | `⊣` |
| `Symbol` | blue rectangle (rule reference); click unfolds one level; missing rule = red outline + `?` | rule name |
| `Sequence` | straight track | |
| `Sequence1` | straight track, dashed outline on item n | `▸n` |
| `Sequence0` | straight track with badge | `∅` |
| `Alternate` | branches stacked top-down | `①②③` priority |
| `Optional` | bypass track above the item | |
| `Repeat` | loop-back under the item, delimiter on the return track | `×4` exactly, `×1–2` range, `×3+` at least; none when unbounded |
| `Plus` | as Repeat | `×1+` |
| `Repeat0` | as Repeat | `∅`, followed by the bounds when set (`∅ ×3+`) |
| `Until` / `UntilLiteral` | `…` box then the terminator | `…` |
| `Until0` / `UntilLiteral0` | as Until, badge | `∅` |
| `Not` | dashed grey frame with a barrier, then the else child if any | `⊘` |
| `Peek` | dashed grey frame with a lookahead mark | `⟶?` |

An unfolded rule reference is a dashed frame headed `▾ NAME`; click the header to fold.

## Badges on a wrapped child (value-only decorators)

| Parser | Badge | Tooltip |
|---|---|---|
| `Substring` | `«»` | |
| `String`, `Join` | `⊕` | |
| `ParserWithAction` | `⚙` | action source |
| `Suggest`, `Msg` | `💬` | |
| `DebugParser` | `🐞` | |

## Anything else

Grey square box with the class name (`RailGeneric`); one `console.warn` per
class name per build. A plain-object parser (`Parsers.cut`) shows
`(plain object)`. The enumeration test (`RailNotationTest`) fails when a
`foam.parse` combinator has no row here.

## Trace states (from PR 6)

Hue + stroke weight + corner glyph, never colour alone: `✓` matched (blue),
`▶` trying (amber), `✗` failed (vermilion); not reached = faded.
