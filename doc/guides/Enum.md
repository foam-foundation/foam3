<flow name="Enum" category="DOC/GUIDE" spid="foam" description="Covers FOAM Enums: declaring with foam.ENUM, ordinal/label/properties/methods, usage analogous to Java enums." keywords="enum,ordinal,label,values,knowledge"/>

# Enums

For those familiar with Java, FOAM Enums are very similar to Java enums in
design.

An Enum is essentially a class with a fixed number of named instances.
The instances are frequently referred to as Enum Values, or the 'values'
of an Enum.

Enums have most of the features available to FOAM classes, including
properties, methods, constants, templates, and listeners.

Enums extend from FObject, so they inherit FObject features such as
pub/sub events, diffing, hashCode, etc.

Enums also have a few built-in properties by default. Every Enum has an
'ordinal' property, which is a integer unique to all the Enum Values of a
particular Enum. Each enum also has a 'name' property, which is the name
given to each Enum Value.


## Example Usage:
To define an enum we use the `foam.ENUM()` function.
```js
foam.ENUM({
  name: 'IssueStatus',
  // Enums share many features with regular classes, the properties
  // and methods we want our enums to have are defined as follows.
  properties: [
    {
      class: 'Boolean',
      name: 'consideredOpen',
      value: true
    }
  ],
  methods: [
    function foo() {
      return this.label + ( this.consideredOpen ? ' is' : ' is not' ) +
          ' considered open.';
    }
  ],
  // Use the values: key to define the actual Enum Values that we
  // want to exist.
  values: [
    {
      name: 'OPEN'
    },
    {
      // The ordinal can be specified explicitly.
      name: 'CLOSED',
      ordinal: 100
    },
    {
      // If the ordinal isn't given explicitly it is auto assigned as
      // the previous ordinal + 1
      name: 'ASSIGNED'
    },
    {
      // You can specify the label, which will be used when rendering in a
      // combo box or similar
      name: 'UNVERIFIED',
      label: 'Unverified'
    },
    {
      // Values for additional properties to your enum are also defined
      // inline.
      name: 'FIXED',
      label: 'Fixed',
      consideredOpen: false
    }
  ]
});
```

```js
console.log(IssueStatus.OPEN.name); // outputs "OPEN"
console.log(IssueStatus.ASSIGNED.consideredOpen); // outputs "true"
```

Enum value ordinals can be specified.
```js
console.log(IssueStatus.CLOSED.ordinal); // outputs 100
// values without specified ordinals get auto assigned.
console.log(IssueStatus.ASSIGNED.ordinal); // outputs 101
```

Methods can be called on the enum values.
```js
// outputs "Fixed is not considered open."
console.log(IssueStatus.FIXED.foo());
```

To store enums on a class, it is recommended to use the Enum property type.
```js
foam.CLASS({
  name: 'Issue',
  properties: [
    {
      class: 'Enum',
      of: 'IssueStatus',
      name: 'status'
    }
  ]
});

var issue = Issue.create({ status: IssueStatus.UNVERIFIED });
console.log(issue.status.label); // outputs "Unverified"
```

Enum properties give you some convenient adapting. You can set the property to the ordinal or the name of an enum, and it will set the property to the correct Enum value.
```js
issue.status = 100;
issue.status === IssueStatus.CLOSED; // is true
```

Enum properties also allow you to assign them via the name of the enum.
```js
issue.status = "ASSIGNED"
issue.status === IssueStatus.ASSIGNED; // is true
```

The extent of all Enum values can be accessed from either the collection from any individual Enum value:
```js
console.log(IssueStatus.VALUES, IssueStatus.CLOSED.VALUES);
```

Values can be specified as just Strings if you don't want to explicitly the label or ordinal. 

```js
foam.ENUM({
 name: 'DaysOfWeek',
 values: [
   'SUNDAY',
   'MONDAY',
   'TUESDAY',
   'WEDNESDAY',
   'THURSDAY',
   'FRIDAY',
   'SATURDAY'
 ]
});
```

## Enums render as status badges

Every enum value already carries presentation properties: `label`, `color`, `background`, `borderColor`, `glyphFill`, `glyphBackground`, `icon`, `isBold`, `isItalic` and a `glyph` (`src/foam/lang/Enum.js:326-390`). An enum property's default view shows the read-only value through `foam.u2.view.ReadOnlyEnumView` (`src/foam/u2/view/EnumView.js:21-26`, `src/foam/u2/Element2.js:2273-2280`), which draws it as a coloured pill as soon as any value of that enum defines `color` or `background` (`ReadOnlyEnumView.js:94-99`).

So a status display needs no hand-made pill. Give the values colours, preferably `$` tokens (the view resolves them, `ReadOnlyEnumView.js:101-105`), and the pill appears wherever the property is shown read-only. `foam.core.app.HealthStatus` is a working example (`src/foam/core/app/HealthStatus.js:14-18`):

```js
foam.ENUM({
  package: 'demo',
  name: 'InvoiceStatus',
  values: [
    { name: 'OPEN',    label: 'Open',    color: '$statusSuccessText', background: '$statusSuccessBackground' },
    { name: 'OVERDUE', label: 'Overdue', color: '$statusDangerText',  background: '$statusDangerBackground' }
  ]
});
```

**`glyph` is taken.** Every enum gets a `glyph` property of class `GlyphProperty` (`Enum.js:375-377`). Declaring your own `glyph` property with another class replaces the built-in one, and a debug build warns `Change of Axiom ... type from GlyphProperty to String` (`src/foam/lang/debug.js:212-222`). Pick another name for your own field.

## Enums as style presets for a component

The same fields let an enum name the looks of your own component, a card or banner with `SUCCESS`, `ERROR` and `WARN` styles, without colour code in the view. Four pieces:

1. The enum values hold `$token` colours, as in the `InvoiceStatus` example above.
2. The component has a `variant` property of that enum, and one `class: 'Color'` property per colour role that derives from it: `expression: function(variant) { return variant?.background || '$backgroundDefault'; }`. An expression follows `variant` until a caller sets the colour, so callers can still override one colour. A `Color` property turns the token into a real colour when read (`src/foam/lang/types.js:914-921`).
3. `render()` adds `this.myClass(this.variant)`, which gives a class per value such as `<<SUCCESS`, because an enum's `toString()` is its `name` (`src/foam/lang/Enum.js:419`).
4. If the variant can change after render, that class goes stale; add it from a slot instead, as `foam.u2.tag.Button` does: `this.addClass(this.slot(function(styleClass_) { return this.myClass(styleClass_); }))`, where `styleClass_` is an expression on the variant (`src/foam/u2/tag/Button.js:515-520`, `:537-539`).
