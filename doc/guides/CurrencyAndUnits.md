<flow name="CurrencyAndUnits" category="DOC/GUIDE" spid="foam" description="How money and unit values render in FOAM: UnitValue vs DoubleUnitValue, minor and major units, Currency.format, the CurrencyView read and write faces, objData, and why a money column stops derived columns exporting their server value." keywords="currency,money,UnitValue,DoubleUnitValue,CurrencyView,objData,minorAmount,format,export,projectionSafe,units,knowledge"/>

# Currency and Unit Values

A money amount in FOAM is two properties: the number, and a sibling property that names its currency. Most rendering bugs come from one of three mix-ups: minor versus major units, a view that cannot reach the sibling currency, or an export that silently stops reading server-computed values.

---

## Two number types, two unit conventions

| Property class | Stores | Example for 12.34 USD | Declared at |
|---|---|---|---|
| `UnitValue` | a `Long` in **minor** units (cents) | `1234` | `src/foam/lang/types.js:962` |
| `DoubleUnitValue` | a `Double` in **major** units (dollars) | `12.34` | `src/foam/lang/types.js:1013` |

Both carry `unitPropName`, the name of the sibling property that holds the currency code:

```javascript
properties: [
  { class: 'String', name: 'currency', value: 'USD' },
  { class: 'DoubleUnitValue', name: 'amount', unitPropName: 'currency' }
]
```

**`Currency.format` always takes minor units.** The JS method is `format(amount, hideId, hideSymbol)` (`src/foam/lang/Currency.js:151`); the Java one adds a context first, `format(x, amount, hideId, hideSymbol)`, and its `amount` arg is a `UnitValue` (`Currency.js:240-259`). A `DoubleUnitValue` must be converted with `minorAmount` first (`Currency.js:350-363`), which rounds so `123.45 * 100` does not come out as `12344`:

```java
// server-side text: an email, a notification, a log line
String text = currency.format(x, currency.minorAmount(obj.getAmount()), true, false);
```

In JavaScript, passing the major-unit double straight to `format` prints 12.34 as `0.12`. Formatting by hand with `toFixed(2)` is wrong for currencies whose precision is not 2; `Currency.precision` holds the right number.

`DoubleUnitValue.unitPropValueToString` already does the conversion for you (`types.js:1038-1049`). It is **async**, because it looks the currency up in `currencyDAO`. A sentence that mixes several amounts needs `Promise.all([...]).then(...)`, not string concatenation of the returned promises.

---

## The default view has two faces

Both types default to `foam.u2.view.CurrencyView` (`src/foam/u2/Element2.js:2063-2084`). That class is a `ModeAltView`: it picks a different view per display mode (`src/foam/u2/view/CurrencyView.js:19-27`).

| Display mode | View used | Shows |
|---|---|---|
| `RO` (read-only) | `foam.u2.view.ValueView` | `$12.34`, formatted with the currency |
| `RW`, `DISABLED` | `foam.u2.CurrencyView` (a text field) | `12.34`, no symbol: `hideSymbol` defaults to `true` (`src/foam/u2/CurrencyView.js:41`) |

The `DoubleUnitValue` refinement sets `useMinorUnits: false` on the write view (`Element2.js:2081`), so typing `12.34` stores `12.34`, not `1234`.

**Two different "read-only" enums.** `DisplayMode` is per field: `RW`, `DISABLED`, `RO`, `HIDDEN`. `ControllerMode` is per context: `CREATE`, `EDIT`, `VIEW`, and `VIEW` caps every field inside it at `RO` (see [ControllerModeAndVisibility](ControllerModeAndVisibility.md)). There is no `DisplayMode.VIEW`: the constant is `undefined`, and the string `'VIEW'` fails the Enum adapt with `Attempt to set invalid Enum value` (`src/foam/lang/Enum.js:482`).

### The read face needs `objData`

The read face has only the number. To find the currency it reads the sibling property off `objData`, the whole owning object, from the context (`src/foam/u2/view/ValueView.js:41-51`). `data` is this field's value; `objData` is the object the field belongs to.

- A detail view and `PropertyBorder` export `objData` for you (`src/foam/u2/PropertyBorder.js:38`), so a normal form works.
- A custom view that renders the value view itself must put it in the context. With no `objData` the read face throws reading `objData[unitPropName]` (`ValueView.js:50`).

```javascript
// read-only amount with its symbol, inside a custom render()
this.startContext({ objData: invoice, data: invoice, controllerMode: this.ControllerMode.VIEW })
  .tag(invoice.AMOUNT)
.endContext();
```

The table cell formatter does the same thing for every money column (`src/foam/u2/view/TableCellFormatter.js:305`).

To show the symbol inside an editable field instead, set `hideSymbol: false` on the write view and bind its `currency$`.

---

## Exports: one money column turns off projection for every column

The export driver decides once, for the whole export, whether it may ask the server for a projection. It ANDs the `projectionSafe` flag of every exported column (`src/foam/core/export/TableExportDriver.js:66`). `UnitValue`, `DoubleUnitValue` and `CurrencyCode` all declare `projectionSafe: false`, because their cell formatter needs the whole object (`TableCellFormatter.js:284`, `:308`, `:606`).

With projection off, the client re-reads every column from the full object in JavaScript (`src/foam/mlang/sink/Projection.js:66-72`). A derived column whose value exists only in a `javaGetter` has no JavaScript counterpart, and a full object sent to the client never carries it (see the isSet section of [PropertyGotchas](PropertyGotchas.md)). The client therefore reads the property's JavaScript default, and the outputter writes that default: an empty cell for a `String`, `0` for a number, `false` for a `Boolean` (`src/foam/core/column/TableColumnOutputter.js:39-64`).

**Example.** A table of `demo.Invoice` rows shows `amount` (a `DoubleUnitValue`) and `daysOverdue` (a `javaGetter` with `storageTransient: true`). The server computes `daysOverdue` correctly, but in the CSV it is `0` in every row.

**Fix.** Store the derived value and write it when the row is written, or give the property a JavaScript `getter` too. The export includes exactly the columns visible in the table (`filteredTableColumns`, `TableExportDriver.js:81`), so adding a column to an export is a column-config change, not export code.

---

## Unit labels on plain numbers

A number property can carry `units: 'days'`. The read view and the text field translate it at display time with the flat key `foam.units.<units>`, falling back to the raw value (`ValueView.js:55-59`, `src/foam/u2/TextField.js:77`). Add a `Locale` row with source `foam.units.days` to translate it; see [i18n-advanced](i18n-advanced.md).
