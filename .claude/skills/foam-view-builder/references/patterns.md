# FOAM View Builder — Implementation Patterns

Full text for the patterns indexed in `SKILL.md` Phase 3. Read only the pattern you need.

### 3.1 Custom View Structure

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'MyCustomView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.detail.SectionedDetailView',
    'foam.u2.view.RichChoiceView'
  ],

  imports: [
    'currencyDAO',
    'pushMenu?'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: $inputVerticalPadding;
    }
    ^header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: $font-bold;
      color: $textDefault;
    }
    ^content {
      padding: 16px;
      border: 1px solid $borderLight;
      border-radius: $inputBorderRadius;
    }
    ^error {
      color: $destructive500;
      font-size: 12px;
    }
  `,

  properties: [
    // data is inherited from foam.u2.View
    { class: 'Boolean', name: 'isExpanded' }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this
        .addClass()  // Applies root CSS class
        .start('div').addClass(this.myClass('header'))
          .add('My Header')
        .end()
        .start('div').addClass(this.myClass('content'))
          .add(this.dynamic(function(data) {
            if ( ! data ) return;
            this.start('span').add(data.name).end();
          }))
        .end();
    }
  ]
});
```

**Key rules:**
- Always call `this.SUPER()` at start of `render()`
- Always call `this.addClass()` (no args) to apply root class, or `this.addClass(this.myClass())` explicitly
- Use `this.myClass('suffix')` for CSS classes → generates `foam-example-MyCustomView-suffix`
- Use `self.myClass()` inside `dynamic()` blocks (NOT `this.myClass()`)
- Use `this.start()` inside `dynamic()` for DOM (NOT `this.E()`)

### 3.2 CSS Best Practices

**Selectors:**
```css
^                           /* Root element */
^header                     /* Child: .foam-pkg-MyView-header */
^ .foam-u2-Accordion        /* Framework child components */
^:hover                     /* Pseudo-classes */
```

**FOAM CSS Tokens — full set defined in `foam3/src/foam/u2/CSSTokens.js`. Use these instead of hardcoded values:**

```css
/* COLOR SCALES — 50/100/200/300/400/500/600/700 ramps */
$blue50…$blue700            /* aliased to $primary50…$primary700 */
$red50…$red700              /* aliased to $destructive50…$destructive700 */
$green50…$green700          /* aliased to $success50…$success700 */
$yellow50…$yellow700        /* aliased to $warn50…$warn700 */
$orange50…$orange700        /* informational */
$purple50…$purple700
$grey50…$grey700            /* neutral UI */
$warmGrey50…$warmGrey700
$black50…$black700, $white, $black

/* SEMANTIC ALIASES — prefer these over raw color scales (theme-aware, dark-mode safe) */
$primary50…$primary700                    /* brand */
$destructive50…$destructive700            /* errors / dangerous actions */
$success50…$success700                    /* success / positive */
$warn50…$warn700                          /* warnings */

/* SEMANTIC SURFACES — backgrounds */
$backgroundDefault, $backgroundSecondary, $backgroundTertiary, $backgroundHover
$backgroundBrand, $backgroundBrandSecondary, $backgroundBrandTertiary
$backgroundInverse, $backgroundInverseSecondary, $backgroundInverseTertiary
$backgroundDestructive, $backgroundDestructiveSecondary, $backgroundDestructiveTertiary

/* SEMANTIC TEXT */
$textDefault, $textSecondary, $textTertiary
$textBrand, $textBrandSecondary, $textBrandTertiary
$textDestructive, $textOnBrand, $textOnInverse, $textOnDestructive
$link, $dropdownIcon

/* SEMANTIC BORDERS */
$borderXLight, $borderLight, $borderDefault, $borderStrong
$borderBrandXLight, $borderBrandLight, $borderBrand, $borderBrandStrong

/* INPUT / LAYOUT */
$inputHeight, $inputHorizontalPadding, $inputVerticalPadding, $inputBorderRadius

/* TYPOGRAPHY — font weights (numeric values) */
$font-extra-light, $font-light, $font-normal, $font-regular,
$font-medium, $font-semi-bold, $font-bold, $font-extra-bold

/* TYPOGRAPHY — font sizes (rem-based) */
$header-xl   /* 3.5rem */    $header-lg   /* 3rem */     $header-md   /* 2.4rem */
$header-sm   /* 2rem */      $header-xs   /* 1.6rem */   $header-xxs  /* 1.4rem */
$header-xxxs /* 1.2rem */
$font1       /* 'Source Sans Pro', sans-serif */
```

**Rules:**
- NEVER use inline `style:` attributes
- NEVER hardcode colors — use semantic tokens (`$primary500`, `$textDestructive`) over raw color scales (`$blue500`, `$red400`); semantic tokens are theme-aware (dark-mode variants)
- NEVER redefine `font-size` / `font-weight` / `font-family` in custom CSS when a global typography class fits — see §3.2.1
- Use `border-collapse: separate; border-spacing: 0` for sticky headers
- Simulate borders with `box-shadow: inset -1px -1px 0 $borderLight` when using sticky positioning
- Use `content-visibility: auto` for off-screen performance

### 3.2.1 Global Typography Classes (Fonts.js)

`foam3/src/foam/core/controller/Fonts.js` defines reusable typography classes mounted on `body`. **Use these via `addClass('…')` instead of hand-rolling `font-size` / `font-weight` rules** — they keep type scale consistent, react to theme overrides, and shrink your view's CSS to layout-only concerns.

**Headings** (descending size; all `font-style: normal`, `margin: 0`):
| Class | Size | Weight |
|-------|------|--------|
| `h100` | `$header-xl` (3.5rem) | `$font-bold` |
| `h200` | `$header-lg` (3rem)   | `$font-bold` |
| `h300` | `$header-md` (2.4rem) | `$font-semi-bold` |
| `h400` | `$header-sm` (2rem)   | `$font-medium` |
| `h500` | `$header-xs` (1.6rem) | `$font-medium` |
| `h600` | `$header-xxs` (1.4rem) | `$font-medium` |
| `h700` | `$header-xxxs` (1.2rem) | `$font-medium` |

**Body / paragraph variants**:
| Class | Size | Weight | Use for |
|-------|------|--------|---------|
| `p` | 1.4rem | `$font-regular` | Default body |
| `p-light` | 1.4rem | `$font-light` | Muted body |
| `p-bold` | 1.4rem | `$font-semi-bold` | Strong body |
| `p-semiBold` | 1.4rem | `$font-medium` | Slight emphasis |
| `p-md` | 1.6rem | `$font-regular` | Larger body |
| `p-lg` | 1.8rem | `$font-regular` | Lead paragraph |
| `p-xl` | 2.4rem | `$font-regular` | Hero text |
| `p-sm` | 1.2rem | `$font-regular` | Secondary text |
| `p-xs` | 1rem | `$font-regular` | Fine print |
| `p-xxs` | 0.8rem | `$font-regular` | Tiny meta |
| `p-legal` | 1.2rem | `$font-regular` | Legal copy |
| `p-legal-light` | 1.2rem | `$font-normal` | Legal copy (muted) |
| `p-label` | 1.2rem | `$font-medium` | Form labels |
| `p-label-light` | 1.2rem | `normal` | Form labels (muted) |
| `p-label-lg` | 1.4rem | `$font-medium` | Larger form labels |
| `p-label-lg-light` | 1.4rem | `$font-regular` | Larger form labels (muted) |

**Misc title / status helpers**:
- `headerTitle` — 2.4rem `$font-extra-bold` (page header titles, uses `^` selector)
- `title-light` — 2rem `$font-light`
- `large-title` — responsive 2.8rem→8.4rem (mobile→desktop), bold center-aligned
- `dao-title` — 3.6rem `$font-medium` (DAO landing titles)
- `enum-label` — 1rem `$font-medium`, centered (badge text)
- `^ .generic-status` — inline-block badge; size 1.2rem, white text, uses `^` parent prefix
- `lighter` / `bolder` — weight modifiers when reusing a heading class

**Mobile / kiosk variants** (large touch surfaces): `md-button`, `md-title`, `md-title-sm`, `md-text`, `md-text-light`, `md-text-sm`, `md-text-sm-bold`, `md-text-xs`, `md-text-xs-bold`, `md-text-xxs`.

**Pattern** — apply via `addClass()` in `start()` chains; combine with layout CSS:
```javascript
this
  .start('div').addClass('h300').add('Section Title').end()
  .start('div').addClass('p').add('Description text.').end()
  .start('span').addClass('p-label').add('Field Label').end()
  .start('div').addClass('p-bold').add(this.data.summary$).end()
```

```javascript
// In a citation/list row:
this.start().addClass('p-semiBold').add(this.label).end()
   .start().addClass('p-sm').add(this.subtitle).end();
```

**When to define your own font CSS**: only when a class above doesn't fit (e.g. unusual `letter-spacing`, multi-line specific `line-height`). In that case **still reference `$font-*` weight tokens and `$header-*` size tokens** — don't write raw `font-weight: 600` or `font-size: 14px`.

**Reference**: `foam3/src/foam/core/controller/Fonts.js`

### 3.3 Reactive Patterns

#### Slots — When Only Values Change (Preferred over dynamic())
```javascript
// Attribute binding via slot
.start('img')
  .attrs({
    src: this.data.imageUrl$,       // Direct slot binding
    alt: this.data.name$,
    width: this.slot(function(maxWidth) {  // Computed slot
      return maxWidth || 'auto';
    })
  })
.end()

// Conditional class via slot
.enableClass(this.myClass('active'), this.isActive$)
.enableClass('hidden', this.data.isHidden$)

// Reactive show/hide
.show(this.data.isVisible$)
.hide(this.data.isHidden$)
```

### 3.4 Section Configuration

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'MyModel',

  sections: [
    {
      name: 'basicInfo',
      title: 'Basic Information',
      permissionRequired: true       // Requires write permission to see
    },
    {
      name: 'address',
      title: 'Address'
    },
    {
      name: 'additionalInfo',
      title: 'Additional Info'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'accountName',
      section: 'basicInfo',
      gridColumns: 4                  // 12-column grid (4 = 1/3 width)
    },
    {
      class: 'Enum',
      of: 'com.example.ContactType',
      name: 'contactType',
      section: 'basicInfo',
      gridColumns: 4
    },
    {
      class: 'String',
      name: 'notes',
      section: 'additionalInfo',
      gridColumns: 12                 // Full width
    }
  ]
});
```

### 3.5 tableCellFormatter Patterns

#### Simple Function Formatter
```javascript
{
  class: 'Long',
  name: 'id',
  tableCellFormatter: function(value, obj, axiom) {
    // 'this' = Element being built
    // 'value' = property value
    // 'obj' = full model instance (access sibling props)
    // 'axiom' = PropertyInfo
    this.add('CASE-' + value);
  }
}
```

#### Rich Formatter with Context
```javascript
{
  class: 'Enum',
  of: 'com.example.StatusEnum',
  name: 'status',
  tableCellFormatter: function(value, obj, axiom) {
    var x = this.__context__;
    this.start('div')
      .style({ display: 'flex', alignItems: 'center', gap: '8px' })
      .add(value.label)
      .startContext({ data: obj })
        .tag(foam.u2.ActionView, { action: obj.cls_.getAxiomByName('escalate') })
      .endContext()
    .end();
  }
}
```

#### Reference Formatter (Built-in)
```javascript
{
  class: 'Reference',
  of: 'foam.core.auth.User',
  name: 'createdBy',
  tableCellFormatter: { class: 'foam.u2.view.ReferenceToSummaryCellFormatter' }
}
```

#### Custom View as Formatter
```javascript
// Separate view class for complex formatting
foam.CLASS({
  package: 'com.example',
  name: 'NameFormatter',
  extends: 'foam.u2.View',

  css: `
    ^tableview { display: flex; align-items: center; }
    ^badge { padding: 2px 5px; background-color: $grey100; margin-right: 5px; }
  `,

  properties: [ 'obj' ],

  methods: [
    function render() {
      this.addClass(this.myClass('tableview'));
      if ( this.obj.isPrimary ) {
        this.start('div').addClass(this.myClass('badge')).add('P').end();
      }
      this.add(this.data);  // The property value
    }
  ]
});
```

#### DoubleUnitValue (Currency) Formatter
```javascript
// When tableCellFormatter needs sibling properties (e.g., currency code):
tableCellFormatter: function(value, obj, axiom) {
  this.startContext({ objData: obj })
    .tag(foam.u2.view.ValueView, { prop: axiom, data: value })
  .endContext();
}
// Set projectionSafe: false since full object is needed
```

### 3.6 labelFormatter Patterns (Reactive Labels)

> `labelFormatter` is a ONE-TIME render function — it does not re-fire when the data changes. For a reactive label, map a slot: `data.propName$.map(...)`.

### 3.7 Property view: Configuration

#### ViewSpec Object
```javascript
{
  class: 'String',
  name: 'type',
  view: {
    class: 'foam.u2.view.ChoiceView',
    choices: [
      [ 'String',   'Abc' ],
      [ 'Long',     '###' ],
      [ 'Date',     'YYYY/MM/DD' ]
    ]
  }
}
```

#### ViewSpec Function (Access Context)
```javascript
{
  class: 'Reference',
  of: 'foam.core.auth.User',
  name: 'assignedTo',
  view: function(_, X) {
    return {
      class: 'foam.u2.view.RichChoiceView',
      sections: [
        {
          heading: 'Users',
          dao: X.userDAO.orderBy(foam.core.auth.User.LEGAL_NAME)
        }
      ]
    };
  }
}
```

#### PropertyCardView (Rich Custom View)
```javascript
{
  class: 'String',
  name: 'contactName',
  view: function(_, X) {
    return {
      class: 'com.example.PropertyCardView',
      property: X.data.CONTACT_NAME,
      icon: '/images/person.svg',
      label: 'Contact',
      inputView: { class: 'foam.u2.TextField' },
      data: X.data
    };
  }
}
```

### 3.8 DoubleUnitValue (Currency Display)

> For read-only display in a custom view, wrap in `startContext({ controllerMode: VIEW, objData: this.data })`. Both keys are required: `controllerMode` picks the read-only `ValueView` over the editable input, and `objData` is how that view resolves the unit property.

### 3.9 ViewCustomizer (Dynamic View by Context)

> Drive it from an `on:` declarative listener rather than a manual `.sub()` — no `isInitialized_` flag and no `pushMenu` refresh hack needed.


### 3.10 Confirmation Modal from postSet

> Build it from `postSet` plus a `ConfirmationModal`: `preSet` is synchronous and cannot show one. Use a transient `changeReady_` flag to skip the first `postSet` during initial load, and clear it before reverting so the revert does not re-trigger.

### 3.11 propertyWhitelist — Replacing Custom DetailViews

**The most important pattern for avoiding custom views.** Instead of writing a custom DetailView class with manually placed properties, use `VerticalDetailView` or `SectionedDetailView` with `propertyWhitelist`.

#### Array Format (Simple — filter + reorder)
```javascript
view: function(_, X) {
  var RA = com.example.RuleAction;
  return {
    class: 'foam.u2.detail.SectionedDetailView',
    of: RA,
    propertyWhitelist: [
      RA.PREDICATE,
      RA.ENABLED,
      RA.TARGET_D_A_O_KEY
    ]
  };
}
```
- Pass Property axiom constants (e.g., `Model.PROPERTY_NAME`)
- Order in array = render order
- Only listed properties are shown

#### Object/Map Format (Advanced — filter + reorder + override per property)
```javascript
view: function(_, X) {
  return {
    class: 'foam.u2.view.TitledArrayView',
    valueView: {
      class: 'foam.u2.detail.VerticalDetailView',
      of: 'com.example.Address',
      propertyWhitelist: {
        'identifier': {
          labelFormatter: function(data) {
            this.add(X.data.contactType$.map(function(contactType) {
              if ( contactType && contactType.name === 'PERSONAL' ) return 'Personal ID';
              if ( contactType && contactType.name === 'BUSINESS' ) return 'Business ID';
              return 'ID';
            }));
          }
        },
        'currency': {},
        'kind': {}
      }
    }
  };
}
```
- Keys = property names (strings)
- Values = override objects (can override ANY property attribute: `label`, `units`, `view`, `labelFormatter`, `visibility`, `gridColumns`, etc.)
- Empty `{}` = use defaults, just include in whitelist
- Order of keys = render order

**What it replaces**: Custom DetailView classes that manually list properties. Instead of 80-line custom view files, use 10-line propertyWhitelist configs.



### 3.12 ExpressionSlot for Cross-Context Visibility

When a **child** object's property visibility depends on the **parent** object's property, use `ExpressionSlot.create` inside `propertyWhitelist` overrides. This is the key pattern for controlling visibility across context boundaries.

```javascript
// In Account, the lineItems FObjectArray uses this:
view: function(_, X) {
  return {
    class: 'foam.u2.view.TitledArrayView',
    valueView: {
      class: 'foam.u2.detail.VerticalDetailView',
      of: 'com.example.LineItem',
      propertyWhitelist: {
        'productName': {},
        'productId': {},
        'code': {},
        'altId': {
          // Show 'altId' only when PARENT's contactType is PERSONAL
          visibility: foam.lang.ExpressionSlot.create({
            args: [
              X.data$.dot('contactType'),            // Watch parent's contactType
              X.data.__context__.controllerMode$    // Watch current controller mode
            ],
            code: function(s, l) {
              return s && s.name === 'PERSONAL'
                ? l.restrictDisplayMode('RW')       // Respect VIEW/EDIT mode
                : 'HIDDEN';
            }
          })
        },
        'hasRange': {},
        'from': {},
        'to': {},
        'subId': {
          // Show 'subId' only when PARENT's hasSub is true
          visibility: foam.lang.ExpressionSlot.create({
            args: [
              X.data$.dot('hasSub'),
              X.data.__context__.controllerMode$
            ],
            code: function(f, l) {
              return f ? l.restrictDisplayMode('RW') : 'HIDDEN';
            }
          })
        }
      }
    }
  };
}
```

**How it works:**
- `X.data` = the parent model (Account) — available because `view: function(_, X)` captures it
- `X.data$.dot('propName')` = a reactive slot watching the parent's property
- `X.data.__context__.controllerMode$` = the current VIEW/EDIT/CREATE mode
- `restrictDisplayMode('RW')` = returns RW if mode allows editing, RO if VIEW mode, HIDDEN if already hidden
- **ALWAYS pass controllerMode$ and use restrictDisplayMode** to respect VIEW/EDIT mode correctly



### 3.13 visibility: function() — Sibling Property Visibility

For showing/hiding a property based on sibling properties on the **same** model, use the `visibility` function:

```javascript
{
  class: 'String',
  name: 'altId',
  label: 'Alt ID',
  section: 'address',
  gridColumns: 4,
  visibility: function(contactType) {
    // Parameter name MUST match a sibling property name
    // FOAM auto-injects the value and re-evaluates when it changes
    if ( contactType === this.ContactType.PERSONAL ) return foam.u2.DisplayMode.RW;
    if ( contactType === this.ContactType.BUSINESS ) return foam.u2.DisplayMode.RW;
    return foam.u2.DisplayMode.HIDDEN;
  }
}
```

**Key rules:**
- Parameter names are used by FOAM to find which properties to watch
- `this` = the model instance (can access `this.ContactType` enum constants)
- Return a `foam.u2.DisplayMode` value: `RW`, `RO`, `DISABLED`, `HIDDEN`
- ControllerMode is applied automatically on top (VIEW mode restricts RW to RO)

**Simpler boolean toggle:**
```javascript
{
  class: 'String',
  name: 'from',
  label: 'Range Start',
  visibility: function(hasRange) {
    return hasRange ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
  }
}
```



### 3.14 Version Counter for Nested FObjectArray Reactivity

When a property (like a DAO filter) depends on changes **inside** an FObjectArray's child items, normal reactivity won't detect it (the array reference doesn't change). Use a transient version counter:

```javascript
// Step 1: Transient version counter
{
  class: 'Int',
  name: 'addressCurrencyVersion_',
  hidden: true,
  transient: true
},

// Step 2: FObjectArray with subscription management in postSet
{
  class: 'FObjectArray',
  of: 'com.example.Address',
  name: 'addresses',
  postSet: function(old, nu) {
    // Clean up old subscriptions (prevent memory leaks)
    if ( this.addressSubs_ ) {
      this.addressSubs_.forEach(function(s) { s.detach(); });
    }
    var self = this;
    // Subscribe to each child's property changes
    this.addressSubs_ = (nu || []).map(function(ss) {
      return ss.sub(function() { self.addressCurrencyVersion_++; });
    });
    // Bump version for the array change itself
    self.addressCurrencyVersion_++;
  }
},

// Step 3: View that reacts to the version counter
{
  class: 'Reference',
  of: 'foam.lang.Currency',
  name: 'defaultCurrency',
  view: function(_, X) {
    var E = foam.mlang.Expressions.create();
    var section = foam.u2.view.RichChoiceViewSection.create({
      heading: 'Account Currencies',
      dao: X.currencyDAO
    }, X);

    function updateDAO() {
      var currencies = (X.data.addresses || [])
        .map(function(ss) { return ss.currency; })
        .filter(function(c) { return c; });
      section.dao = currencies.length > 0
        ? X.currencyDAO.where(E.IN(foam.lang.Currency.ID, currencies))
        : X.currencyDAO;
    }

    // Subscribe to version counter — fires when ANY address changes
    section.onDetach(X.data.addressCurrencyVersion_$.sub(updateDAO));
    updateDAO();  // Initial population

    return {
      class: 'foam.u2.view.RichChoiceReferenceView',
      sections: [section]
    };
  },
  // Validation also tracks the version counter for reactivity
  validateObj: function(defaultCurrency, addresses, addressCurrencyVersion_) {
    if ( ! defaultCurrency ) return;
    if ( addresses && addresses.length > 0 ) {
      var found = addresses.some(function(ss) { return ss.currency === defaultCurrency; });
      if ( ! found ) return this.DEFAULT_CURRENCY_NOT_IN_LIST;
    }
  }
}
```



### 3.15 supportingLabel as Reactive Function

`supportingLabel` can be a function using `data.dynamic()` for reactive help text:

```javascript
{
  class: 'FObjectArray',
  name: 'lineItems',
  label: 'Line Items',
  supportingLabel: function(data) {
    this.add(data.dynamic(function(contactType, addresses) {
      var id = '';
      if ( addresses && addresses.length > 0 ) {
        id = addresses[0].identifier || '';
      }
      if ( contactType && contactType.name === 'PERSONAL' ) {
        this.add(id ? 'Line items for personal account ' + id : 'Line items per personal account.');
      } else if ( contactType && contactType.name === 'BUSINESS' ) {
        this.add(id ? 'Line items for business account ' + id : 'Line items per business account.');
      } else {
        this.add('Line items per account.');
      }
    }));
  }
}
```

**How it works:**
- `supportingLabel: function(data)` — `this` = Element, `data` = model instance
- Use `data.dynamic()` to watch multiple properties reactively
- Inside dynamic(), `this.add()` builds DOM content



### 3.16 Refinement Pattern — Replacing Custom Views with Model Config

Instead of custom CreateView/DetailView classes, use a `refines:` class to add `sections:` with inline property overrides:

```javascript
// BEFORE: a custom RuleDetailView class (manually placed properties)
// AFTER: Refinement with sections + propertyWhitelist — no custom view needed
foam.CLASS({
  package: 'com.example',
  name: 'RuleRefinement',
  refines: 'foam.core.ruler.Rule',

  sections: [
    {
      name: 'editCreateSection',
      title: 'Info',
      properties: [
        { name: 'name' },
        {
          name: 'documentation',
          view: {
            class: 'foam.u2.tag.TextArea',
            rows: 2,
            cols: 80
          }
        },
        { name: 'priority' },
        { name: 'spid' },
        { name: 'daoKey' },
        {
          name: 'action',
          view: function(_, X) {
            var RA = com.example.RuleAction;
            return {
              class: 'foam.u2.detail.SectionedDetailView',
              of: RA,
              propertyWhitelist: [
                RA.PREDICATE,
                RA.ENABLED,
                RA.TARGET_D_A_O_KEY
              ]
            };
          },
          createVisibility: 'RO',
          updateVisibility: 'RO'
        },
        { name: 'enabled' }
      ]
    }
  ],

  reactions: [
    ['', 'propertyChange.daoKey', 'onDaoKeyChange']
  ]
});
```

**What this replaces**: A custom `DetailView` class with manually constructed `properties` array and `config` object. The refinement approach is:
- Declarative (sections define the layout)
- No custom view class needed (framework's DAOMenu2 / SectionedDetailView handles rendering)
- Property overrides are inline in the section definition
- Can add validation, reactions, and listeners



### 3.17 Reactive labelFormatter with Parent Context (X.data)

When an FObjectArray's child item needs a label based on the **parent** model:

```javascript
// In Account's addresses FObjectArray view:
propertyWhitelist: {
  'identifier': {
    labelFormatter: function(data) {
      // 'data' = the Address child item
      // X.data = the Account parent (captured from view: function closure)
      this.add(X.data.contactType$.map(function(contactType) {
        if ( contactType && contactType.name === 'PERSONAL' ) return 'Personal ID';
        if ( contactType && contactType.name === 'BUSINESS' ) return 'Business ID';
        return 'ID';
      }));
    }
  }
}
```

**Key**: `X.data` is the parent, not the child. The `view: function(_, X)` closure captures `X.data` as the parent Account. The `data` parameter in `labelFormatter` is the child Address. Use `X.data.prop$` for reactive slots from the parent.

### 3.18 Property Metadata Guide

Use the right metadata property for each purpose:

| Property | Purpose | Where Displayed | Reactive? |
|----------|---------|-----------------|-----------|
| `label` | Short field label | Next to input field | No (static) |
| `placeholder` | Input hint text | Inside empty input field (greyed out) | No |
| `supportingLabel` | User-facing descriptive text | Below the label, above the input | Yes (if function) |
| `documentation` | Developer-facing notes | Tooltip on hover / admin detail views | No |
| `help` | Legacy — prefer `supportingLabel` | Tooltip | No |

**Rules:**
- Use `supportingLabel` for user-visible help text (not `help`)
- Use `documentation` for developer/admin notes about the field's purpose
- Use `placeholder` for input format hints (e.g., `'YYYY-MM-DD'`, `'Enter account number'`)
- `help` is legacy — only use if you need tooltip-only behavior

```javascript
{
  class: 'String',
  name: 'identifier',
  label: 'Identifier',
  placeholder: 'Enter reference number',
  supportingLabel: 'The type-specific identifier for this account',
  documentation: 'Maps to a personal or business identifier by contact type'
}
```

### 3.19 TitledArrayView (Preferred Array View)

**Use `TitledArrayView` instead of `FObjectArrayView`** for rendering FObjectArray properties. TitledArrayView provides a cleaner layout with title bars, add/remove buttons, and better nested view support.

```javascript
{
  class: 'FObjectArray',
  of: 'com.example.Address',
  name: 'addresses',
  view: function(_, X) {
    return {
      class: 'foam.u2.view.TitledArrayView',
      valueView: {
        class: 'foam.u2.detail.VerticalDetailView',
        of: 'com.example.Address',
        propertyWhitelist: {
          'identifier': {},
          'currency': {},
          'kind': {}
        }
      }
    };
  }
}
```

**Reference**: `foam3/src/foam/u2/view/TitledArrayView.js`

### 3.20 CitationView for Compact Array Display

When array items need a compact display (e.g., summary row instead of full form), use `CitationView`:

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'MyItemCitationView',
  extends: 'foam.u2.CitationView',

  methods: [
    function render() {
      this.SUPER();
      this
        .start('span').add(this.data.name).end()
        .start('span').addClass(this.myClass('secondary'))
          .add(' — ')
          .add(this.data.status.label)
        .end();
    }
  ]
});
```

Then reference it in the array view:
```javascript
view: {
  class: 'foam.u2.view.TitledArrayView',
  citationView: 'com.example.MyItemCitationView'
}
```

### 3.21 View Decomposition — Small Focused Views

**Prefer small focused views over monolithic custom views.** If a custom view exceeds ~200 lines, decompose it into:

1. **Model-level config** — sections, visibility, propertyWhitelist (handles 80% of cases)
2. **Small utility views** — focused on one task (e.g., a status badge, a summary row)
3. **Utils classes** — extract shared logic out of views into static utility methods

**Pattern from a codebase refactor** (a large custom view was replaced with model config + 3 small views):
- Move field display logic to `visibility: function()` on properties
- Move grouping to `sections:` on the model
- Move shared formatting to a Utils class
- Create small CitationView subclasses for compact array display

---

### 3.22 Faceted DetailView Pattern (Custom Row Detail)

When clicking a row in a DAOController table should show a **custom detail view** (not the default SectionedDetailView), use the **Faceted DetailView** pattern. `foam.comics.v3.DetailView` already has a Faceted axiom — naming your class `{ModelName}DetailView` makes it auto-discovered.

#### How the facet resolves

`foam.pattern.Faceted` (`src/foam/pattern/Faceted.js`) overrides `create()`: when a faceted class is created with `of: <model>` (or with `data` whose class it can read), it computes the id `<model.package>.<ModelName><FacetedClassName>` and, if that class is registered, substitutes it. `DetailView`'s short name is `DetailView`, so `DetailView.create({of: com.example.Foo})` → `com.example.FooDetailView`. No `config.detailView`, no menu wiring — just the naming convention plus the class being in the build.

#### CRITICAL: view and create facet INDEPENDENTLY

The comics state machine mounts a *different* micro-controller per state (`DAOController.js:120-140`), and each is faceted separately:

| User action | Faceted class created (with `of:`) | Your class to define |
|-------------|-----------------------------------|----------------------|
| Open/click a record (view/edit) | `foam.comics.v3.DetailView` | `{Model}DetailView` |
| Click **Create** | `foam.comics.v3.CreateView` (`config.createController` default) | `{Model}CreateView` |

**A `{Model}DetailView` alone does NOT intercept the Create button** — Create goes through `CreateView`, a different faceted class. To customize both, define **both** wrappers, each pointing `viewView` at the same ContentView:

```javascript
foam.CLASS({ package:'com.example', name:'FooDetailView', extends:'foam.comics.v3.DetailView',
  properties:[{ class:'foam.u2.ViewSpec', name:'viewView',
    factory:function(){ return { class:'com.example.FooContentView' }; } }] });

foam.CLASS({ package:'com.example', name:'FooCreateView', extends:'foam.comics.v3.CreateView',
  properties:[{ class:'foam.u2.ViewSpec', name:'viewView',
    factory:function(){ return { class:'com.example.FooContentView' }; } }] });
```

#### Three grains of customization (smallest → largest)

1. **Inner form view** — `config.detailView` / `config.createView` (or the wrapper's `viewView`). Just the form content.
2. **The micro-controller for a state** — the faceted `{Model}DetailView` / `{Model}CreateView`, or `config.browseController` / `config.createController`. Swaps the whole state's controller (chrome + save/cancel + behavior).
3. **Untouched states stay generated** — browse table, routing, and any state you didn't override keep the default.

#### Verifying it (don't assume — it silently falls back)

If the facet class isn't found, comics silently renders the default (`TabbedDetailView`). Before concluding a facet "doesn't work":
- In the browser console, confirm the class loaded into the build: `com.example.FooDetailView` (and `FooCreateView`) should print a class, not `undefined`. `undefined` ⇒ a **build/registration** problem (pom flags / compile error), not the view code.
- Confirm **which state** you're testing — Create vs. opening a record hit different facets. Testing Create while only a `{Model}DetailView` exists will always show the default.

#### Architecture: Thin Wrapper + ContentView Controller

Split into two classes:
1. **Wrapper** (extends `foam.comics.v3.DetailView`) — overrides `viewView` to point to your content
2. **ContentView** (extends `foam.u2.Controller`) — contains all the custom rendering logic

```javascript
// 1. Thin wrapper — auto-discovered by Faceted pattern via name
foam.CLASS({
  package: 'com.example',
  name: 'MyModelDetailView',           // {ModelName} + "DetailView"
  extends: 'foam.comics.v3.DetailView',
  properties: [{
    class: 'foam.u2.ViewSpec',
    name: 'viewView',
    factory: function() {
      return { class: 'com.example.MyModelContentView' };
    }
  }]
});

// 2. ContentView — receives data from DetailView
foam.CLASS({
  package: 'com.example',
  name: 'MyModelContentView',
  extends: 'foam.u2.Controller',

  properties: [
    {
      name: 'data',
      documentation: 'REQUIRED: Controller does not have data — must declare explicitly. DetailView passes data$: currentData_$'
    },
    {
      class: 'FObjectProperty',
      of: 'com.example.MyModel',
      name: 'myModel',
      expression: function(data) { return data; }
    }
  ],

  methods: [
    function init() {
      // Data arrives asynchronously — subscribe to data$ instead of loading in init
      this.myModel$.sub(this.onDataReady.bind(this));  // MUST use .bind(this)
    },
    function onDataReady() {
      if ( ! this.myModel ) return;  // Null guard — data not yet loaded
      // ... load related data from DAOs
    },
    function render() {
      var self = this;
      this.addClass(this.myClass())
        .start()
          // Use dynamic() for content that depends on async data
          .add(this.dynamic(function(myModel) {
            if ( ! myModel ) return;  // Null guard
            this.start('div').add(myModel.name).end();
          }))
        .end();
    }
  ]
});
```

#### Key Gotchas

**1. Controller needs explicit `data` property:**
`foam.u2.Controller` does NOT inherit `data` from `foam.u2.View`. You must declare `{ name: 'data' }` explicitly, or the expression `function(data)` will fail with `slot() called with unknown axiom: 'data'`.

**2. `.sub()` callbacks need `.bind(this)`:**
Method references passed to `.sub()` lose `this` context. Always use `.bind(this)`:
```javascript
// WRONG — this.loadData loses context, DAO imports appear undefined
this.myProp$.sub(this.loadData);

// CORRECT
this.myProp$.sub(this.loadData.bind(this));
```

**3. Data loads asynchronously — don't load in init():**
DetailView loads data asynchronously. `init()` fires before data arrives. Subscribe to `data$` or a derived property's slot and null-guard:
```javascript
function init() {
  this.myModel$.sub(this.loadRelatedData.bind(this));
  // Do NOT call this.loadRelatedData() directly here
}
```

**4. Use `dynamic()` not `slot()` for content in render chains:**
`slot()` can cause DOM placement issues with async rendering — content renders outside its container. Use `dynamic()` instead, which re-renders in-place.

#### Embedded Tables: Preventing Column Leakage

When rendering tables inside a custom DetailView, the parent DAOController's `config` leaks into child tables via context, causing all tables to use the parent model's `tableColumns`. Fix with two context overrides:

```javascript
exports: ['columnStorage'],

properties: [
  {
    name: 'columnStorage',
    documentation: 'Prevents global localStorage column prefs from overriding model tableColumns',
    factory: function() {
      return {
        storage_: {},
        getItem: function() { return null; },
        setItem: function() {},
        removeItem: function() {},
        clear: function() {}
      };
    }
  }
],

methods: [
  function render() {
    this
      .startContext({
        columnStorage: this.columnStorage,  // Override global localStorage
        config: null                         // Prevent parent DAOController config leakage
      })
        .tag(foam.u2.table.TableView, { data: this.myDAO })
      .endContext();
  }
]
```

- **`config: null`** — Forces TableView's `selectedColumnNames` expression to fall back to each DAO model's own `tableColumns` instead of using the parent DAOController's config
- **`columnStorage` factory** — Returns `null` from `getItem()`, preventing global `localStorage` column preferences from overriding model defaults

#### Editable Controls Inside DetailView

DetailView renders in VIEW mode by default. To render editable controls (e.g., ChoiceView dropdown), wrap in a startContext:

```javascript
.startContext({ mode: foam.u2.DisplayMode.RW, controllerMode: foam.u2.ControllerMode.EDIT })
  .tag(foam.u2.view.ChoiceView, { choices: myChoices, data$: self.myProp$ })
.endContext()
```



---

### 3.23 Controller View Pattern — Shared Search + Selection + Rendering

**When**: two or more host views run the same "query a DAO, render rows, let the user pick one" flow and differ only in chrome (title, banner copy, action buttons, row-click policy).

**The pattern**: extract a controller-style view that owns the query/predicate, the in-memory result DAO, the row rendering, and the `selection` property. Hosts compose one instance (single-section popups) or many (multi-section popups) and aggregate selections through the controller's exported slot.

**What goes where**:
- **Controller**: query inputs, predicate construction (including fallbacks), result DAO lifecycle, DAOList + row-wrapper wiring, `selection` slot, shared domain predicates used by children (e.g. `isSettled(record)`) as the single source of truth
- **Host**: title/subtitle, composition (1 or N controllers), selection aggregation, action `isEnabled` / label expressions, confirm/cancel callback shapes

**Rules**:
- Extract only when 2+ hosts actually need it, not speculatively
- Name the controller for its role (picker, browser) not its specific feature — it should be reusable across features with the same shape
- Domain helpers like `isSettled` live on the controller once and get exported — never duplicated into the citation or the host



---

### 3.24 Opt-Out Knobs on Shared Views

**When**: a shared view (controller, citation, any reusable piece) serves multiple hosts that need the same behavior 95% of the time but disagree on one or two UX specifics — banner copy vs custom header, auto-select on single result vs click-always, default empty-state text vs custom empty-state.

**The pattern**: add boolean props with defaults matching the **majority** host (`showBanner: true`, `autoSelectOnSingleExact: true`, etc.). Outlier hosts set them `false` and render their own variant alongside the shared view. Expose the data those outliers need to build their variant (e.g. `candidatesCount_` so a custom header can say "Results (N)").

**Rules**:
- Default to what the common case needs; don't pick a neutral middle that serves nobody
- Prefer several independent booleans over one enum mode — combinations compose cleanly
- If an "opt-out" is actually different business logic, not UX polish, that's a sign it belongs in a different class or hook, not a flag

**Example**: `showBanner`, `showEmptyMessage`, and `autoSelectOnSingleExact` opt-out props let an outlier host keep its own section header and click-to-select UX without forking the shared controller.

---

### 3.25 Custom Row Wrapper for Object-Level Selection

**When**: DAOList's default row wrapper doesn't fit — you need the full record in `selection` (not just the id), OR per-row click policy (disable + side-effect), OR selection in a context without a `DAOController` ancestor.

**The pattern**: replace DAOList's `rowView_` (the wrapping view, distinct from `rowView` which is the inner body) with a small custom view that handles click directly, writes the full record to the imported `selection` slot, and accepts pluggable `isDisabled` / `onDisabledClick` callbacks for per-row policy. Build it generic enough to share across features — one per project, not one per popup.

**Rules**:
- `rowView_` = the wrapper ViewSpec; `rowView` = the inner body ViewSpec. Easy to confuse
- Writing to an imported property propagates up through the exporter's slot (see Phase 6 "Imports are writable") — the child driving parent state needs no manual slot plumbing
- Keep host-specific row policy (what "disabled" means, what a blocked click does) in callbacks the host supplies, not hardcoded in the wrapper



---

### 3.26 Adapting Framework Views to Non-Native Contexts

**When**: embedding a framework view (`DAOList`, `TableView`, etc.) inside a popup, accordion, stacked flex column, or any container that isn't the full-page chrome it was designed for.

**The pattern**: framework views often assume a full-height parent, a pagination strip, sticky toolbars, etc. Embedding in smaller contexts means overriding those defaults **once, in the container that does the embedding** — not scattering overrides across every consumer. Common overrides: sizing (`height: auto; flex: 0 0 auto`) to stop the framework view from claiming all vertical space, hiding pagination chrome for small result sets, removing borders that conflict with the container's own.

**Rules**:
- Stacked instances of a framework view in a flex column are the most common hazard: the first one claims all space and later siblings render below the fold
- Put the adaptation CSS on the shared view (controller) or on the popup shell — not duplicated across every host
- When a framework view has native-context assumptions that don't match your use case, consider whether you're using the right primitive before papering over with CSS

**Example**: keep the `^list` adaptation CSS on the shared view (or the popup shell) — one override set serving every host that embeds it.

---

### 3.27 Rendering a Property: Bare vs Bordered (Permission-Aware)

**Critical**: choosing the wrong access form silently disables the model's permission/visibility declarations. Four ways to reference a FOAM property in a view:

| Form | What it returns | Renders via | Honors `writePermissionRequired` / `controllerMode`? |
|------|-----------------|-------------|----------------------|
| `OBJ.PROP_NAME` | Property axiom | `Property.toE()` — bare view | **No.** No PropertyBorder, no auth check, no `controllerMode` awareness. |
| `OBJ.PROP_NAME.__` | Axiom + PropertyBorder wrapper (getter, no `()`) | `Property.toPropertyView()` → `PropertyBorder` | **Yes.** PropertyBorder runs `createVisibilityFor` which performs the `<classname>.rw.<propname>` auth check. |
| `obj.propName` | Current value (snapshot) | n/a — string/number | n/a |
| `obj.propName$` | Reactive slot | `SlotNode` | n/a |

**The trap**: `writePermissionRequired: true` / `readPermissionRequired: true` on a property are enforced **only inside `PropertyBorder.createVisibilityFor`** (`foam3/src/foam/u2/Element2.js`). Calling `.add(prop)` or `.start(prop)` with the bare axiom invokes `Property.toE()` and skips PropertyBorder entirely — every user gets RW regardless of what the model declares. Group-config changes will not fix this; the auth check never runs.

**The fix when you need a compact cell (table `<td>`, sidebar item, etc.) but still want permissions enforced**: route through PropertyBorder via `__`, then strip the label and reserved space via `config`:

```javascript
.start('td')
  .tag(txn.CLIENT_ID.__, {
    config: { label: '', reserveLabelSpace: false }
  })
.end()
```

How it works: `PropertyBorder.render` clones the prop and calls `copyFrom(this.config)` (`foam3/src/foam/u2/PropertyBorder.js`), so any property metadata can be overridden per render: `label`, `reserveLabelSpace`, `view`, `units`, `units$`, `helpText`, etc. With `label: ''` and `reserveLabelSpace: false`, the label slot collapses to `display: contents` (PropertyBorder.js — search `labelSlot`) — no visible chrome added. The view itself still receives `mode$: modeSlot` and the auth check still fires.

**Decision matrix**:

| Goal | Use |
|------|-----|
| Full label + validation + permission UI | `.add(prop.__)` |
| Compact cell, permission-gated | `.tag(prop.__, { config: { label: '', reserveLabelSpace: false } })` |
| Compact cell, force read-only locally (no auth check, applies to all viewers) | `.startContext({ controllerMode: foam.u2.ControllerMode.VIEW })` … `.endContext()` |
| Compact cell, mode driven by your own slot | `.tag(prop, { mode$: someSlot })` |
| Reactive value display | `obj.propName$` |
| One-shot value (won't update) | `obj.propName` |

**Reach**: same trick works in `foam3/src/foam/**` and any application view, on any model, for any property attribute that PropertyBorder copies from `config` (`label`, `view`, `units`, `helpText`, `reserveLabelSpace`, etc.). Don't reach for `visibility: 'RO'` on the model unless RO is the universal answer — that strips admin-override capability whereas the `tag(prop.__, { config })` route preserves the original permission gate.

**Example**: bare `.add(obj.SOME_ID)` rendered a permission-gated cell editable for basic users despite `writePermissionRequired: true`; routing through `prop.__` with a stripped label restored the gate.

**Where `prop.__` gets its mode from — CONTEXT, not the parent view's properties.** The inner view (any `ModeAltView` such as `DateTimeView`) reads the context `controllerMode`; `Element.controllerMode` is a factory `this.__context__.controllerMode || CREATE` (`foam3/src/foam/u2/Element2.js:553-558`), so no mode in context means CREATE, i.e. editable inputs. A view class whose own `controllerMode` property should drive its children must EXPORT it — `foam.core.fs.fileDropZone.FileCard` is the canonical example (`FileCard.js:30-37`: imports the outer mode as `importedControllerMode`, declares its own prop, exports `controllerMode`). Declaring a local `controllerMode` property without the export is a silent no-op for children; either export it or wrap the render in `startContext({ controllerMode: VIEW })`.

### 3.28 Formatting any property value programmatically (inline text, not a property view)

The machinery in 3.27 is fully generic: EVERY property, any type, has the `OBJ.PROP_NAME` axiom and the `prop.__` PropertyBorder route. Prefer those when you want a property VIEW. This section is for when you need the VALUE as plain text (card sublabel, `" | "` separated runs, string building) — and the rule is: use the type's own formatter, never hand-roll `value.toString()`.

**Property views are block elements — never put one inside an inline text run.** `.add(' | ', obj.PROP)` or `.add(' | ', prop.__)` drops a `div` into a sentence: Element's default `nodeName` is `div` (`Element2.js:619-622`), so view delegates like `RODateTimeView` (div + inner div, `RODateTimeView.js:36`) and PropertyBorder (flex-column div) are blocks even when a wrapper like `ModeAltView` is a span (`ModeAltView.js:28`). CSS block-in-inline splits the run into anonymous block boxes — the value jumps to its own line and the layout looks broken (a block property view inside a text run wraps to its own line and can introduce a phantom gap; swapping to the value formatter fixes both). Inline text = value formatters below; property views (`PROP`, `prop.__`) = block/flex/grid slots only.

1. **Universal — `tableCellFormatter`.** Every property type carries one (base refinement + per-type overrides, all in `foam3/src/foam/u2/view/TableCellFormatter.js`: `Date` :438, `DateTime` :471, `DateTimeUTC` :506, Enum/UnitValue/etc.). It renders INTO an element rather than returning a string:
   ```javascript
   this.E().call(function() { prop.tableCellFormatter.format(this, value, obj, prop); });
   ```
   Ready-made read-only wrapper: `foam.u2.view.TableCellFormatterReadView` (`TableCellFormatterReadView.js:31`).
2. **String-returning, type-specific.** Only Date/DateTime/DateTimeUTC define `format`/`formatLocale` on the axiom (`foam3/src/foam/lang/types.js:236, 265, 271, 320, 328`):
   ```javascript
   if ( data$created )
     e.add(' | ', self.data.CREATED.formatLocale(data$created));
   ```
   `formatLocale` = `foam.util.DateUtil.format` = `toLocaleString(foam.util.getClientLocale())` — same output as the DateTime table cell and `RODateTimeView.js:50-51`. Date-only: `value.toLocaleDateString(foam.util.getClientLocale())`.
3. **Enums / FObjects**: `.label` / `.toSummary()` on the value (`data$status.toSummary()`; Java `getLabel()`). Unit/currency props need the DoubleUnitValue pattern (3.8) — display depends on a sibling unit prop.

Gotchas:
- Guard unset values before appending separators — `.add(' | ', value?.toString())` leaves a dangling separator for records that predate the field; the read-only DateTime view renders a `"yyyy-mm-dd hh:mm"` placeholder for null (`RODateTimeView.js:48-49`).
- Never bake a server-side `toString()` into a persisted String (Java `Date.toString()` = server TZ, unreformattable later). Persist the typed prop, format at render; fixed `SimpleDateFormat("yyyy-MM-dd")` only as a last resort for string payloads.

---
