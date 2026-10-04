# foam.lang — the class engine

`foam.lang` is the class system itself: `FObject`, `Property` and the property types, `Slot`, `Enum`, `Action`, boot and class registration. Services such as auth, cron and logging live in `foam.core`. Framework reference: `doc/guides/claude.md`.

## Traps

Paths that do not start with `src/` or `doc/` are relative to this folder.

- **`Object.keys(somePackage)` misses most classes.** Classes register lazily as a getter with no `enumerable` flag (`Context.js:118-120`, `stdlib.js:1229-1244`). To list a package, use `Object.getOwnPropertyNames(somePackage)`.
- **`foam.USED[id]` is the raw spec passed to `foam.CLASS`, not a built model** (`EndBoot.js:322`, `:341`). A mixin there is a string, so `mx.path` is `undefined`; write `mx.path || mx`. See `doc/guides/DebuggingCountAndUsed.md`.
- **A constant can collide with a property.** Property `frame` installs the constant `FRAME` (`Property.js:428`); a `constants:` entry named `FRAME` then throws `Class constant conflict` (`FObject.js:186-193`).
- **Boolean adapt is `!!v`** (`Boolean.js:28`). Any write of `null` (`copyFrom({ flag: null })`, a JSON row with `"flag": null`, a journal replay) stores `false`; only an unset default or an expression can stay `null`. Model a value that can be unknown as a `String` with `''`.
- **`class: 'Date'` stores noon UTC of the value's local day** (`types.js:242-250`); the time is discarded. See `doc/guides/DateTimeUTC.md`.
- **`slot.dot('mapProp')` stays silent when the map is changed with `mapProp$set(k, v)`** (`Slot.js:400-403`, `types.js:1129-1136`). Subscribe to `obj.mapProp$`. See `doc/guides/Slots.md`.
- **Every enum already has `color`, `background`, `icon` and a `glyph` property** (`Enum.js:326-390`); do not declare your own `glyph`. See `doc/guides/Enum.md`.
- **Which file defined this? Three places record it.**
  - The class: `foam.lookup(id).model_.source` (`EndBoot.js:300-308`).
  - Each axiom: `.source`. A refined property names the refinement file (`Boot.js:273`).
  - Generated Java: line 2 is `// SOURCE: <path>` (`src/foam/java/Outputter.js:54-70`).
- **`requires:` is a lazy getter** (`Requires.js:70-73`). An entry nobody reads is not a consumer, and a consumer that mounts `.tag(this.Foo)` has no fully qualified name near the call. Count call sites by grepping the short name, not `class: 'pkg.Foo'`.
- **The class loader does not fetch missing classes.** `ClassLoader.load` returns only classes a loaded script already registered (`src/foam/apploader/ClassLoader.js:157`); what loads is decided by the POM.

## Parsers (`src/foam/parse`)

- **A `<rule>Action` method attaches only to a rule with exactly that name**, with no warning for a typo (`src/foam/parse/parse.js:1608-1613`).
- **`repeat(p)` has no progress check.** It stops only when `p` fails or `maximum` is reached (`src/foam/parse/parse.js:839-851`), so a `p` that can match empty input loops until memory runs out.
