<flow name="be:ComponentLibrary" category="DOC/EXAMPLES" spid="foam" description="Catalogue of FOAM UI components grouped by what they do: inputs, choosers, collections, containers, borders, layout, feedback, dialogs and graphics, shown with live examples." keywords="componentlibrary,components,views,widgets,borders,layout,dialogs,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM Component Library

A catalogue of FOAM UI components, organized by the component rather than by the property type it edits. Where [AllViews](be:AllViews) asks "what views can I use for an Int?", this page asks "what does a RangeView do, and where can I use it?".

<toc></toc>

## Overview

Every FOAM UI component is a u2 <term term="Element"></term>: a FOAM object that builds and manages one DOM node and its children. Components fall into two groups.

- A <term term="View"></term> displays or edits a value. It has a `data` property, and when it is used for a property of an <term term="FObject"></term>, `data` is bound to that property's value so that changes flow both ways. A view is chosen with the property's `view:` option, which takes a <term term="ViewSpec"></term>.
- A container (a border, layout, tab strip or dialog) has no `data` of its own. It wraps whatever content is added to it, and is used from code with `start(...)`, `tag(...)` or `add(...)`.

Most views also respond to the current <term term="DisplayMode"></term>: the same view renders as an editable input in `RW` mode and as plain text in `RO` mode, which is how one model can serve both an edit form and a read-only page.

| Category | Components |
|----------|------------|
| **Text Input** | TextField, TextArea, SearchField, PasswordView, CopyTextField, MultiBoxInputView |
| **Rich Text & Code** | HTMLView, MarkdownView, RichTextView, CodeView, PreView, JSONTextView |
| **Numeric** | IntView, FloatView, CurrencyView, RangeView, ProgressView |
| **Toggles** | CheckBox, Switch |
| **Choosers** | ChoiceView, RadioView, ChoiceWithOtherView, MultiChoiceView, CardSelectionView, RichChoiceView, ReferenceView |
| **Date & Time** | DateView, DateTimeView, TimeView, RelativeDateTimeView, DayOfWeekView, DayOfMonthView |
| **Color & Images** | ColorEditView, ReadColorView, ColorPicker, ImageView, tag.Image, GlyphView |
| **Collections** | ArrayView, StringArrayView, StringArrayRowView, FObjectArrayView, TitledArrayView, MapView |
| **Objects** | DetailView, SectionedDetailView, TabbedDetailView, VerticalDetailView, FObjectView, AnyView, CollapseableDetailView, ComparisonView |
| **DAO Views** | TableView, DAOList, EmbeddedTableView, CarouselView, TreeView |
| **Composite** | MultiView, DualView, AltView, SimpleAltView, ModeAltView, ReadWriteView, ValueView |
| **Actions** | ActionView, ButtonGroup, Link, Label |
| **Layout** | Rows, Cols, Grid, GUnit, Tabs, UnderlinedTabs, SegmentedTabs, Accordion |
| **Borders** | CardBorder, TitleBorder, SpacingBorder, CopyBorder, ExpandableBorder, ScrollBorder, LoadingBorder, MultiBorder |
| **Feedback** | LoadingSpinner, CircleIndicator, InlineNotificationMessage, Tooltip |
| **Dialogs** | Popup, StyledModal, ConfirmationModal |
| **Graphics** | CView, Box, Circle, Arc, Line, Polygon, PieGraph, BarGraph |

### Using a Component

A component can be used in three ways. The first form is a ViewSpec: either a class name as a string, or an object whose `class` names the component and whose other keys set its properties.

| Where | How |
|-------|-----|
| On a property | `view: 'foam.u2.RangeView'` or `view: { class: 'foam.u2.RangeView', maxValue: 10 }` |
| In `render()` | `this.start(foam.u2.borders.CardBorder).add('content').end()` |
| Standalone | `add(foam.u2.RangeView.create({ data: 50 }))` |

---

## Text Input

### TextField

<term term="TextField"></term> (`foam.u2.TextField`) is the default view for String properties. Set `onKey: true` to update `data` on every keystroke instead of on blur.

### TextArea

<term term="TextArea"></term> (`foam.u2.tag.TextArea`) is a multi-line input with `rows` and `cols`.

### SearchField

`foam.u2.SearchField` is a TextField styled as a search box. `foam.u2.ClearableSearchField` adds a clear button.

### PasswordView

<term term="PasswordView"></term> (`foam.u2.view.PasswordView`) masks its input and adds a show/hide icon. It is the default view for Password properties.

### CopyTextField

`foam.u2.view.CopyTextField` shows a read-only value with a button that copies it to the clipboard. Use it for API keys, ids and links.

### MultiBoxInputView

`foam.u2.view.MultiBoxInputView` splits input across a row of single-character boxes, as used for one-time verification codes. `numOfParts` sets how many boxes.

<example id="text-inputs">
foam.CLASS({
  name: 'TextInputComponents',
  properties: [
    {
      class: 'String',
      name: 'textField',
      view: { class: 'foam.u2.TextField', onKey: true, placeholder: 'Type here' }
    },
    {
      class: 'String',
      name: 'textArea',
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 60 }
    },
    {
      class: 'String',
      name: 'searchField',
      view: 'foam.u2.SearchField'
    },
    {
      class: 'String',
      name: 'clearableSearchField',
      view: 'foam.u2.ClearableSearchField'
    },
    {
      class: 'String',
      name: 'password',
      view: 'foam.u2.view.PasswordView'
    },
    {
      class: 'String',
      name: 'copyTextField',
      value: 'sk_live_51H8xyzABC',
      view: 'foam.u2.view.CopyTextField'
    },
    {
      class: 'String',
      name: 'verificationCode',
      view: { class: 'foam.u2.view.MultiBoxInputView', numOfParts: 6 }
    }
  ]
});

add(foam.u2.DetailView.create({ data: TextInputComponents.create() }));
</example>

---

## Rich Text and Code

| Component | Class | Purpose |
|-----------|-------|---------|
| HTMLView | `foam.u2.HTMLView` | Render a String as HTML (read-only) |
| MarkdownView | `foam.u2.view.MarkdownView` | Render a String as Markdown (read-only) |
| RichTextView | `foam.u2.view.RichTextView` | WYSIWYG HTML editor with a formatting toolbar |
| CodeView | `foam.u2.view.CodeView` | Code editor in RW mode, highlighted code in RO mode. Default for Code |
| PreView | `foam.u2.view.PreView` | Read-only code with whitespace preserved |
| JSONTextView | `foam.u2.view.JSONTextView` | Edit an object as JSON text, with a parse-error message |

<example id="rich-text">
foam.CLASS({
  name: 'RichTextComponents',
  properties: [
    {
      class: 'String',
      name: 'htmlView',
      value: '<b>bold</b>, <i>italic</i> and <u>underlined</u>',
      view: 'foam.u2.HTMLView'
    },
    {
      class: 'String',
      name: 'markdownView',
      value: '### A heading\n\nSome **bold** and _italic_ text, plus `code`.',
      view: 'foam.u2.view.MarkdownView'
    },
    {
      class: 'String',
      name: 'richTextView',
      value: '<p>Select some text and use the toolbar.</p>',
      view: 'foam.u2.view.RichTextView'
    },
    {
      class: 'Code',
      name: 'codeView',
      value: 'function square(x) {\n  return x * x;\n}'
    },
    {
      class: 'Code',
      name: 'preView',
      value: 'if ( ready ) {\n  go();\n}',
      view: 'foam.u2.view.PreView'
    },
    {
      name: 'jsonTextView',
      factory: function() { return { name: 'Alice', tags: ['a', 'b'] }; },
      view: { class: 'foam.u2.view.JSONTextView', rows: 6, cols: 60 }
    }
  ]
});

add(foam.u2.DetailView.create({ data: RichTextComponents.create() }));
</example>

---

## Numeric

| Component | Class | Purpose |
|-----------|-------|---------|
| IntView | `foam.u2.IntView` | Integer text input. Default for Int, Long, Short, Byte |
| FloatView | `foam.u2.FloatView` | Decimal input; `precision` sets the displayed decimals |
| CurrencyView | `foam.u2.CurrencyView` | Formats a number as money |
| RangeView | `foam.u2.RangeView` | Slider; set `minValue`, `maxValue` and `step` |
| ProgressView | `foam.u2.ProgressView` | Read-only progress bar for a value from 0 to 100 |

<example id="numeric">
foam.CLASS({
  name: 'NumericComponents',
  properties: [
    {
      class: 'Int',
      name: 'intView',
      value: 42,
      view: 'foam.u2.IntView'
    },
    {
      class: 'Float',
      name: 'floatView',
      value: 3.14159,
      view: { class: 'foam.u2.FloatView', precision: 2 }
    },
    {
      class: 'Float',
      name: 'currencyView',
      value: 1234.5,
      view: 'foam.u2.CurrencyView'
    },
    {
      class: 'Int',
      name: 'rangeView',
      value: 5,
      view: { class: 'foam.u2.RangeView', minValue: 0, maxValue: 10, step: 1 }
    },
    {
      class: 'Int',
      name: 'progressView',
      value: 65,
      view: 'foam.u2.ProgressView'
    }
  ]
});

add(foam.u2.DetailView.create({ data: NumericComponents.create() }));
</example>

---

## Toggles

<term term="CheckBox"></term> (`foam.u2.CheckBox`) is the default view for Boolean properties. <term term="Switch"></term> (`foam.u2.Switch`) extends CheckBox and draws an on/off slider instead; `switchSize` picks `SMALL`, `MEDIUM` or `LARGE`.

<example id="toggles">
foam.CLASS({
  name: 'ToggleComponents',
  properties: [
    {
      class: 'Boolean',
      name: 'checkBox',
      view: 'foam.u2.CheckBox'
    },
    {
      class: 'Boolean',
      name: 'switchView',
      value: true,
      view: 'foam.u2.Switch'
    },
    {
      class: 'Boolean',
      name: 'smallSwitch',
      view: { class: 'foam.u2.Switch', switchSize: 'SMALL' }
    },
    {
      class: 'Boolean',
      name: 'yesNoRadio',
      view: {
        class: 'foam.u2.view.RadioView',
        choices: [[true, 'Yes'], [false, 'No']],
        isHorizontal: true
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: ToggleComponents.create() }));
</example>

---

## Choosers

A chooser lets the user pick from a fixed set of options instead of typing a value. Choosers take a list of `choices`. Each choice is either a plain value, which is used as its own label, or a `[value, label]` pair, where `value` is what gets stored in the property and `label` is what the user sees. For example, `['CA', 'Canada']` stores `'CA'` but shows "Canada".

Some choosers read their options from a <term term="DAO"></term> instead of a fixed list, so the options stay current as rows are added or removed. ReferenceView and RichChoiceView work this way.

| Component | Class | Purpose |
|-----------|-------|---------|
| ChoiceView | `foam.u2.view.ChoiceView` | Drop-down select. Default for Enum |
| RadioView | `foam.u2.view.RadioView` | Radio buttons; `isHorizontal` lays them out in a row |
| ChoiceWithOtherView | `foam.u2.view.ChoiceWithOtherView` | A chooser that shows a free-text field when the `otherKey` choice is picked |
| MultiChoiceView | `foam.u2.view.MultiChoiceView` | Pick several choices as cards; `minSelected` / `maxSelected` bound the count |
| CardSelectionView | `foam.u2.view.CardSelectionView` | Pick exactly one choice as a card |
| IconChoiceView | `foam.u2.view.IconChoiceView` | ChoiceView whose options show icons |
| RichChoiceView | `foam.u2.view.RichChoiceView` | Searchable drop-down over one or more DAOs |
| ReferenceView | `foam.u2.view.ReferenceView` | ChoiceView populated from the DAO of a Reference property |
| TabChoiceView | `foam.u2.view.TabChoiceView` | Choices rendered as tabs; used for canned queries in DAO browsers |

<example id="choosers">
foam.CLASS({
  name: 'ChooserComponents',
  properties: [
    {
      class: 'String',
      name: 'choiceView',
      view: {
        class: 'foam.u2.view.ChoiceView',
        placeholder: 'Pick a size',
        choices: [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]
      }
    },
    {
      class: 'String',
      name: 'radioView',
      value: 'M',
      view: {
        class: 'foam.u2.view.RadioView',
        isHorizontal: true,
        choices: [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]
      }
    },
    {
      class: 'String',
      name: 'choiceWithOther',
      view: {
        class: 'foam.u2.view.ChoiceWithOtherView',
        otherKey: 'Other',
        choiceView: {
          class: 'foam.u2.view.ChoiceView',
          choices: ['Email', 'Phone', 'Other']
        }
      }
    },
    {
      class: 'StringArray',
      name: 'multiChoiceView',
      view: {
        class: 'foam.u2.view.MultiChoiceView',
        choices: ['Red', 'Green', 'Blue', 'Yellow'],
        minSelected: 1,
        maxSelected: 2
      }
    },
    {
      class: 'String',
      name: 'cardSelectionView',
      view: {
        class: 'foam.u2.view.CardSelectionView',
        isVertical: false,
        choices: [['basic', 'Basic'], ['pro', 'Pro'], ['team', 'Team']]
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: ChooserComponents.create() }));
</example>

### ReferenceView

A <term term="Reference"></term> property stores only the `id` of an object that lives in another DAO, much like a foreign key in a database. <term term="ReferenceView"></term> is its default view: it fills a ChoiceView with the objects in the DAO named by the property's `targetDAOKey`, and labels each option with the object's `toSummary()`.

The DAO is found by name in the <term term="Context"></term>, so the example below `exports` `countryDAO` to make it visible to the view.

<example id="reference-view">
foam.CLASS({
  name: 'Country',
  properties: ['id', 'name'],
  methods: [ function toSummary() { return this.name; } ]
});

var countryDAO = foam.dao.EasyDAO.create({
  of: Country,
  daoType: 'MDAO',
  testData: [
    { id: 'CA', name: 'Canada' },
    { id: 'FR', name: 'France' },
    { id: 'JP', name: 'Japan' }
  ]
});

foam.CLASS({
  name: 'ReferenceComponents',
  exports: ['countryDAO'],
  properties: [
    {
      name: 'countryDAO',
      hidden: true,
      factory: function() { return countryDAO; }
    },
    {
      class: 'Reference',
      of: 'Country',
      name: 'country',
      targetDAOKey: 'countryDAO'
    }
  ]
});

add(foam.u2.DetailView.create({ data: ReferenceComponents.create() }));
</example>

---

## Date and Time

| Component | Class | Purpose |
|-----------|-------|---------|
| DateView | `foam.u2.view.DateView` | Calendar date picker. Default for Date |
| DateTimeView | `foam.u2.view.DateTimeView` | Date and time picker. Default for DateTime |
| TimeView | `foam.u2.view.TimeView` | Time-of-day input. Default for Time |
| RelativeDateTimeView | `foam.u2.view.RelativeDateTimeView` | Shows a DateTime as "3 hours ago" when read-only |
| DayOfWeekView | `foam.u2.view.DayOfWeekView` | Pick days of the week as a row of cards |
| DayOfMonthView | `foam.u2.view.DayOfMonthView` | Pick days of the month as a grid of cards |

<example id="date-time">
foam.CLASS({
  name: 'DateTimeComponents',
  properties: [
    {
      class: 'Date',
      name: 'dateView',
      factory: function() { return new Date(); }
    },
    {
      class: 'DateTime',
      name: 'dateTimeView',
      factory: function() { return new Date(); }
    },
    {
      class: 'Time',
      name: 'timeView'
    },
    {
      class: 'DateTime',
      name: 'relativeDateTimeView',
      factory: function() { return new Date(Date.now() - 3 * 3600 * 1000); },
      view: 'foam.u2.view.RelativeDateTimeView',
      visibility: 'RO'
    },
    {
      class: 'Duration',
      name: 'durationView',
      value: 5400000
    }
  ]
});

add(foam.u2.DetailView.create({ data: DateTimeComponents.create() }));
</example>

---

## Color and Images

| Component | Class | Purpose |
|-----------|-------|---------|
| ColorEditView | `foam.u2.view.ColorEditView` | Hex text field plus a native color picker |
| ColorPicker | `foam.u2.view.ColorPicker` | Native color picker only |
| ReadColorView | `foam.u2.view.ReadColorView` | Read-only color swatch with its value |
| ImageView | `foam.u2.view.ImageView` | Displays an image URL |
| Image | `foam.u2.tag.Image` | `<img>` element; also renders Glyphs and inline SVG |
| GlyphView | `foam.u2.view.GlyphView` | Shows a Glyph icon rather than its SVG source |

<example id="color-image">
foam.CLASS({
  name: 'ColorImageComponents',
  properties: [
    {
      class: 'Color',
      name: 'colorEditView',
      value: '#406dea',
      view: 'foam.u2.view.ColorEditView'
    },
    {
      class: 'Color',
      name: 'colorPicker',
      value: '#e6a020',
      view: 'foam.u2.view.ColorPicker'
    },
    {
      class: 'Color',
      name: 'readColorView',
      value: '#2a9d5c',
      view: 'foam.u2.view.ReadColorView'
    },
    {
      class: 'Image',
      name: 'imageView',
      value: 'https://picsum.photos/160/100',
      view: 'foam.u2.view.ImageView'
    }
  ]
});

add(foam.u2.DetailView.create({ data: ColorImageComponents.create() }));

start('h3').add('foam.u2.tag.Image').end();
tag(foam.u2.tag.Image, { data: 'https://picsum.photos/80/80', displayWidth: '80px', displayHeight: '80px' });
</example>

---

## Collections

| Component | Class | Purpose |
|-----------|-------|---------|
| ArrayView | `foam.u2.view.ArrayView` | Editable list of values with add/remove. Default for Array |
| StringArrayView | `foam.u2.view.StringArrayView` | ArrayView of text fields. Default for StringArray |
| StringArrayRowView | `foam.u2.view.StringArrayRowView` | StringArray laid out one row per value |
| SimpleStringArrayView | `foam.u2.view.SimpleStringArrayView` | StringArray as a single comma-separated text field |
| FObjectArrayView | `foam.u2.view.FObjectArrayView` | List of nested objects, each in its own editor. Default for FObjectArray |
| TitledArrayView | `foam.u2.view.TitledArrayView` | FObjectArrayView with a numbered title on each element |
| FObjectArrayTableView | `foam.u2.view.FObjectArrayTableView` | FObjectArray as a table |
| MapView | `foam.u2.view.MapView` | Key/value rows. Default for Map |

<example id="collections">
foam.CLASS({
  name: 'LineItem',
  properties: [
    'description',
    { class: 'Int', name: 'quantity' }
  ]
});

foam.CLASS({
  name: 'CollectionComponents',
  properties: [
    {
      class: 'Array',
      name: 'arrayView',
      factory: function() { return [1, 2, 3]; }
    },
    {
      class: 'StringArray',
      name: 'stringArrayView',
      factory: function() { return ['red', 'green']; }
    },
    {
      class: 'StringArray',
      name: 'stringArrayRowView',
      view: 'foam.u2.view.StringArrayRowView',
      factory: function() { return ['one', 'two']; }
    },
    {
      class: 'StringArray',
      name: 'simpleStringArrayView',
      view: 'foam.u2.view.SimpleStringArrayView',
      factory: function() { return ['a', 'b', 'c']; }
    },
    {
      class: 'FObjectArray',
      of: 'LineItem',
      name: 'titledArrayView',
      view: 'foam.u2.view.TitledArrayView',
      factory: function() {
        return [ LineItem.create({ description: 'Widget', quantity: 2 }) ];
      }
    },
    {
      class: 'FObjectArray',
      of: 'LineItem',
      name: 'fobjectArrayTableView',
      view: 'foam.u2.view.FObjectArrayTableView',
      factory: function() {
        return [
          LineItem.create({ description: 'Widget', quantity: 2 }),
          LineItem.create({ description: 'Gadget', quantity: 5 })
        ];
      }
    },
    {
      class: 'Map',
      name: 'mapView',
      factory: function() { return { region: 'east', tier: 'gold' }; }
    }
  ]
});

add(foam.u2.DetailView.create({ data: CollectionComponents.create() }));
</example>

---

## Object Views

These views show a whole FObject rather than a single value. They read the object's model to decide which properties to show, in what order, with which labels and views, so they need no per-model code.

Properties can be grouped with a <term term="Section"></term>: a named group declared in the model's `sections:` list and referenced from each property's `section:` option. DetailView ignores sections; SectionedDetailView, TabbedDetailView and VerticalDetailView use them to lay out the groups.

A <term term="Citation"></term> is a short, one-line summary of an object, built from its `toSummary()`. It is used where a full DetailView would take too much space, such as in a list or as the collapsed state of CollapseableDetailView.

| Component | Class | Purpose |
|-----------|-------|---------|
| DetailView | `foam.u2.DetailView` | Label/value table of every visible property |
| SectionedDetailView | `foam.u2.detail.SectionedDetailView` | Properties grouped into the model's `sections` |
| TabbedDetailView | `foam.u2.detail.TabbedDetailView` | One tab per section |
| VerticalDetailView | `foam.u2.detail.VerticalDetailView` | Single stacked column |
| FObjectView | `foam.u2.view.FObjectView` | Class chooser plus an editor for the chosen class |
| FObjectPropertyView | `foam.u2.view.FObjectPropertyView` | Default for FObjectProperty: a nested editor |
| AnyView | `foam.u2.view.AnyView` | Picks a view based on the runtime type of the value |
| CollapseableDetailView | `foam.u2.view.CollapseableDetailView` | Shows a one-line citation, expanding to a full DetailView |
| CitationView | `foam.u2.CitationView` | One-line summary of an object |
| ComparisonView | `foam.u2.view.ComparisonView` | Side-by-side diff of two objects (`left`, `right`) |

<example id="object-views">
foam.CLASS({
  name: 'Account',
  properties: [
    { class: 'String', name: 'owner', section: 'general', value: 'Alice' },
    { class: 'String', name: 'email', section: 'general', value: 'alice@example.com' },
    { class: 'Float',  name: 'balance', section: 'financial', value: 1250 },
    { class: 'Boolean', name: 'overdraft', section: 'financial' }
  ],
  sections: [
    { name: 'general',   title: 'General' },
    { name: 'financial', title: 'Financial' }
  ]
});

var account = Account.create();

start('h3').add('SectionedDetailView').end();
add(foam.u2.detail.SectionedDetailView.create({ data: account }));

start('h3').add('TabbedDetailView').end();
add(foam.u2.detail.TabbedDetailView.create({ data: account }));

start('h3').add('VerticalDetailView').end();
add(foam.u2.detail.VerticalDetailView.create({ data: account }));

start('h3').add('CollapseableDetailView').end();
add(foam.u2.view.CollapseableDetailView.create({ data: account }));

start('h3').add('ComparisonView').end();
add(foam.u2.view.ComparisonView.create({
  left:  account,
  right: Account.create({ owner: 'Alice', email: 'alice@new.example.com', balance: 900 })
}));
</example>

---

## DAO Views

A <term term="DAO"></term> (Data Access Object) is FOAM's standard interface to a collection of objects of one class. Every DAO supports the same operations, whatever its storage: `put` to add or update an object, `remove`, `find` by id, and `select` to read many objects, optionally narrowed with `where`, `orderBy` and `limit`. A DAO can hold its data in memory, in the browser, on the server, or in a remote service, and the views below work with all of them.

The examples use an <term term="EasyDAO"></term>, a convenience class that builds a DAO from a few options. `daoType: 'MDAO'` keeps the data in an indexed in-memory store, `seqNo: true` assigns ids 1, 2, 3 to new objects, and `testData` loads the starting rows.

DAO views take a DAO as `data` and show its rows. They listen to the DAO, so a `put` or `remove` from anywhere else in the application updates the view without a reload. They also read only the rows they display, so a TableView over a large server-side DAO fetches one screen of rows at a time rather than the whole collection.

`select()` is asynchronous: it returns a Promise for a <term term="Sink"></term>, an object that receives the selected rows. The CarouselView example uses the default `ArraySink`, whose `array` property holds the rows.

| Component | Class | Purpose |
|-----------|-------|---------|
| TableView | `foam.u2.table.TableView` | Sortable table with one column per property |
| DAOList | `foam.u2.DAOList` | One row view per object |
| EmbeddedTableView | `foam.u2.view.EmbeddedTableView` | Compact table for use inside a DetailView |
| CarouselView | `foam.u2.view.CarouselView` | One object at a time with next/back controls |
| TreeView | `foam.u2.view.TreeView` | Expandable tree over a parent/child relationship |
| GroupingDAOList | `foam.u2.GroupingDAOList` | DAOList with group headings |

<example id="dao-views">
foam.CLASS({
  name: 'Employee',
  properties: [
    'id',
    'name',
    'department',
    { class: 'Int', name: 'age' }
  ],
  methods: [ function toSummary() { return this.name + ' (' + this.department + ')'; } ]
});

var employeeDAO = foam.dao.EasyDAO.create({
  of: Employee,
  seqNo: true,
  daoType: 'MDAO',
  testData: [
    { name: 'Alice', department: 'Sales', age: 30 },
    { name: 'Bob', department: 'Engineering', age: 25 },
    { name: 'Carol', department: 'Engineering', age: 41 }
  ]
});

start('h3').add('TableView').end();
add(foam.u2.table.TableView.create({ data: employeeDAO }));

start('h3').add('DAOList').end();
add(foam.u2.DAOList.create({ data: employeeDAO }));

start('h3').add('CarouselView').end();
employeeDAO.select().then(function(sink) {
  add(foam.u2.view.CarouselView.create({ data: sink.array }));
});
</example>

---

## Composite Views

Composite views wrap other views. They are how one property gets several views at once, or a different view per mode. All the inner views share the composite's `data`, so dragging the slider in a MultiView immediately updates the text field beside it.

Composites build on the existing components instead of replacing them, so prefer one over writing a new view class. ModeAltView is the usual answer when the read-only display of a value should look nothing like its editor, such as rendered HTML when read and a TextArea of source when edited.

| Component | Class | Purpose |
|-----------|-------|---------|
| MultiView | `foam.u2.MultiView` | Shows every view in `views` at once, all bound to the same data |
| DualView | `foam.u2.view.DualView` | MultiView of exactly two views, `viewa` and `viewb` |
| AltView | `foam.u2.view.AltView` | User picks one of several `[view, label]` pairs from a drop-down |
| SimpleAltView | `foam.u2.view.SimpleAltView` | Pick between whole components, not views of one value |
| ModeAltView | `foam.u2.view.ModeAltView` | `readView` in RO mode, `writeView` in RW mode |
| ReadWriteView | `foam.u2.ReadWriteView` | Read view until clicked, then the edit view |
| ValueView | `foam.u2.view.ValueView` | Plain-text display of the value |

<example id="composite">
foam.CLASS({
  name: 'CompositeComponents',
  properties: [
    {
      class: 'Int',
      name: 'multiView',
      value: 40,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          'foam.u2.RangeView',
          { class: 'foam.u2.IntView', onKey: true },
          'foam.u2.ProgressView'
        ]
      }
    },
    {
      class: 'Float',
      name: 'dualView',
      value: 0.5,
      view: {
        class: 'foam.u2.view.DualView',
        viewa: { class: 'foam.u2.FloatView', precision: 2, onKey: true },
        viewb: { class: 'foam.u2.RangeView', maxValue: 1, step: 0.01 }
      }
    },
    {
      class: 'String',
      name: 'altView',
      value: '**Markdown** _source_',
      view: {
        class: 'foam.u2.view.AltView',
        views: [
          [{ class: 'foam.u2.tag.TextArea', rows: 3 }, 'Edit'],
          ['foam.u2.view.MarkdownView', 'Preview']
        ]
      }
    },
    {
      class: 'String',
      name: 'modeAltView',
      value: '<b>bold</b>',
      view: {
        class: 'foam.u2.view.ModeAltView',
        readView: 'foam.u2.HTMLView',
        writeView: { class: 'foam.u2.tag.TextArea', rows: 2 }
      }
    },
    {
      class: 'String',
      name: 'readWriteView',
      value: 'Click me to edit',
      view: 'foam.u2.ReadWriteView'
    },
    {
      class: 'String',
      name: 'valueView',
      value: 'Plain read-only text',
      view: 'foam.u2.view.ValueView'
    }
  ]
});

add(foam.u2.DetailView.create({ data: CompositeComponents.create() }));
</example>

---

## Actions and Links

An <term term="Action"></term> is a method declared in a model's `actions:` list, together with how to present it: a label, an icon, and the conditions under which it is available (`isAvailable`) or enabled (`isEnabled`). Those conditions name properties as arguments, so in the example below RESET greys out automatically whenever `clicks` is 0. DetailView shows a model's actions as buttons along the bottom.

<term term="ActionView"></term> (`foam.u2.ActionView`) is the button that renders an Action. Its look is set by `buttonStyle` (a `foam.u2.ButtonStyle`: `PRIMARY`, `SECONDARY`, `TERTIARY`, `TEXT`, `LINK`, `UNSTYLED`) and `size` (`SMALL`, `MEDIUM`, `LARGE`). The style can be set on the action itself or on the view.

| Component | Class | Purpose |
|-----------|-------|---------|
| ActionView | `foam.u2.ActionView` | Button for an Action |
| ToggleActionView | `foam.u2.view.ToggleActionView` | Action rendered as an on/off toggle |
| ButtonGroup | `foam.u2.ButtonGroup` | Row of actions that collapses overflow into a menu |
| OverlayActionListView | `foam.u2.view.OverlayActionListView` | "More" button with a drop-down list of actions |
| Link | `foam.u2.Link` | Styled `<a>` element |
| Label | `foam.u2.Label` | Text with an optional icon |

<example id="actions">
foam.CLASS({
  name: 'ActionComponents',
  properties: [
    { class: 'Int', name: 'clicks', visibility: 'RO' }
  ],
  actions: [
    {
      name: 'primary',
      buttonStyle: 'PRIMARY',
      code: function() { this.clicks++; }
    },
    {
      name: 'secondary',
      buttonStyle: 'SECONDARY',
      code: function() { this.clicks++; }
    },
    {
      name: 'tertiary',
      buttonStyle: 'TERTIARY',
      code: function() { this.clicks++; }
    },
    {
      name: 'textStyle',
      buttonStyle: 'TEXT',
      code: function() { this.clicks++; }
    },
    {
      name: 'reset',
      isEnabled: function(clicks) { return clicks > 0; },
      code: function() { this.clicks = 0; }
    }
  ]
});

var actions = ActionComponents.create();
add(foam.u2.DetailView.create({ data: actions }));

// Adding an Action to an element renders it as a button. The button runs the
// action against the context's `data`, so startContext({ data: actions }) is
// what tells the PRIMARY and RESET buttons which object to act on.
start('h3').add('Actions placed individually').end();
start().
  startContext({ data: actions }).
    add(ActionComponents.PRIMARY, ' ', ActionComponents.RESET).
  endContext().
end();

start('h3').add('Link and Label').end();
start(foam.u2.Link).attrs({ href: 'https://github.com/kgrgreer/foam3', target: '_blank' }).add('FOAM on GitHub').end();
tag(foam.u2.Label, { label: 'A label with text only' });
</example>

---

## Layout

Layout components arrange their children; they add no visible decoration of their own. Rows and Cols cover most needs. Grid is for forms and dashboards that must reflow on narrow screens: each GUnit claims a number of the grid's 12 columns, and units wrap to the next line when a row is full, so two `columns: 6` units sit side by side and a third starts a new row.

Tabs show one child at a time. Each child must be a `foam.u2.Tab`, whose `label` becomes the tab's heading; the Tab with `selected: true` is shown first.

| Component | Class | Purpose |
|-----------|-------|---------|
| Rows | `foam.u2.layout.Rows` | Stacks children vertically (flex column) |
| Cols | `foam.u2.layout.Cols` | Lays children out horizontally (flex row) |
| Grid | `foam.u2.layout.Grid` | 12-column responsive grid |
| GUnit | `foam.u2.layout.GUnit` | A cell in a Grid; `columns` sets its width out of 12 |
| Tabs | `foam.u2.Tabs` | Tab strip; each child is a `foam.u2.Tab` with a `label` |
| UnderlinedTabs | `foam.u2.UnderlinedTabs` | Tabs with an underline marking the selected tab |
| SegmentedTabs | `foam.u2.SegmentedTabs` | Tabs drawn as a segmented button bar |
| Accordion | `foam.u2.Accordion` | Collapsible section; add to its `title`, never replace it |

<example id="layout">
start('h3').add('Rows and Cols').end();
start(foam.u2.layout.Cols).style({ gap: '16px' }).
  start(foam.u2.layout.Rows).add('Col 1, Row 1').add('Col 1, Row 2').end().
  start(foam.u2.layout.Rows).add('Col 2, Row 1').add('Col 2, Row 2').end().
end();

start('h3').add('Grid and GUnit').end();
start(foam.u2.layout.Grid).
  start(foam.u2.layout.GUnit, { columns: 8 }).style({ background: '#dde6fb' }).add('8 columns').end().
  start(foam.u2.layout.GUnit, { columns: 4 }).style({ background: '#fbecd0' }).add('4 columns').end().
  start(foam.u2.layout.GUnit, { columns: 6 }).style({ background: '#d6f0e0' }).add('6 columns').end().
  start(foam.u2.layout.GUnit, { columns: 6 }).style({ background: '#f6d9dd' }).add('6 columns').end().
end();

start('h3').add('Tabs').end();
start(foam.u2.Tabs).
  start(foam.u2.Tab, { label: 'First', selected: true }).add('Content of the first tab').end().
  start(foam.u2.Tab, { label: 'Second' }).add('Content of the second tab').end().
  start(foam.u2.Tab, { label: 'Third' }).add('Content of the third tab').end().
end();

start('h3').add('UnderlinedTabs').end();
start(foam.u2.UnderlinedTabs).
  start(foam.u2.Tab, { label: 'Overview', selected: true }).add('Overview content').end().
  start(foam.u2.Tab, { label: 'Details' }).add('Details content').end().
end();

start('h3').add('SegmentedTabs').end();
start(foam.u2.SegmentedTabs).
  start(foam.u2.Tab, { label: 'Day', selected: true }).add('By day').end().
  start(foam.u2.Tab, { label: 'Week' }).add('By week').end().
  start(foam.u2.Tab, { label: 'Month' }).add('By month').end().
end();

start('h3').add('Accordion').end();
start(foam.u2.Accordion, { expanded: true }).
  call(function() { this.title.add('Click the arrow to collapse'); }).
  add('Accordion body content.').
end();
</example>

---

## Borders

A <term term="Border"></term> wraps whatever content is added to it. Borders do not take `data`; they decorate their children. Content added to a border with `add()` or `start()` goes inside the border's frame rather than beside it, because the border redirects its children into an inner element, its `content`.

Use a border to change how something looks or behaves without changing the thing itself: the same DetailView can appear plain, in a card, under a title, or inside a scrolling area just by changing the border around it. MultiBorder stacks several borders when one is not enough.

| Component | Class | Purpose |
|-----------|-------|---------|
| CardBorder | `foam.u2.borders.CardBorder` | Card with padding, rounded corners and a border |
| TitleBorder | `foam.u2.borders.TitleBorder` | Adds a `title` heading above the content |
| SpacingBorder | `foam.u2.borders.SpacingBorder` | Adds `padding` and/or `margin` |
| CopyBorder | `foam.u2.borders.CopyBorder` | Adds a copy-to-clipboard button; copies `copyText` or the content's text |
| ExpandableBorder | `foam.u2.borders.ExpandableBorder` | Content slides open when `expanded` is true |
| ScrollBorder | `foam.u2.borders.ScrollBorder` | Scrollable area with shadows at the scrolled edges |
| LoadingBorder | `foam.u2.borders.LoadingBorder` | Covers content with a spinner while loading |
| MultiBorder | `foam.u2.borders.MultiBorder` | Applies a list of `borders` as one border |
| SideViewBorder | `foam.u2.borders.SideViewBorder` | Content with a slide-in side panel |
| AlertMessageBorder | `foam.u2.borders.AlertMessageBorder` | Content with an alert message above it |

<example id="borders">
foam.CLASS({
  name: 'ExpandState',
  properties: [ { class: 'Boolean', name: 'expanded', value: true, view: 'foam.u2.Switch' } ]
});

start('h3').add('CardBorder').end();
start(foam.u2.borders.CardBorder).add('Content inside a card.').end();

start('h3').add('TitleBorder').end();
start(foam.u2.borders.TitleBorder, { title: 'Section Title' }).add('Content under a title.').end();

start('h3').add('SpacingBorder').end();
start(foam.u2.borders.SpacingBorder, { padding: 24 }).style({ background: '#eef1f6' }).add('24px of padding.').end();

start('h3').add('CopyBorder').end();
start(foam.u2.borders.CopyBorder, { label: 'Order id' }).add('ORD-2026-000123').end();

start('h3').add('ExpandableBorder').end();
var state = ExpandState.create();
add(foam.u2.DetailView.create({ data: state, showActions: false, title: '' }));
start(foam.u2.borders.ExpandableBorder, { title: 'Expandable', expanded$: state.expanded$ }).
  add('Toggle the switch above to hide and show this content.').
end();

start('h3').add('ScrollBorder').end();
start(foam.u2.borders.ScrollBorder).style({ height: '100px' }).
  call(function() {
    for ( var i = 1 ; i <= 20 ; i++ ) this.start().add('Line ' + i).end();
  }).
end();

start('h3').add('MultiBorder').end();
start(foam.u2.borders.MultiBorder, {
  borders: [
    { class: 'foam.u2.borders.CardBorder' },
    { class: 'foam.u2.borders.TitleBorder', title: 'Card with a title' }
  ]
}).add('Two borders applied as one.').end();
</example>

---

## Feedback

Feedback components tell the user what is happening: that work is in progress, which step they are on, or that something succeeded or failed. They show status in place, in the page. For a message that needs the user's attention before they continue, use a dialog instead.

| Component | Class | Purpose |
|-----------|-------|---------|
| LoadingSpinner | `foam.u2.LoadingSpinner` | Spinning indicator; `showText` / `text` add a caption |
| CircleIndicator | `foam.u2.tag.CircleIndicator` | Colored circle holding a number, icon or glyph, as used for wizard steps |
| InlineNotificationMessage | `foam.u2.dialog.InlineNotificationMessage` | Inline banner; `type` is `DEFAULT`, `INFO`, `SUCCESS`, `WARN` or `ERROR` |
| Tooltip | `foam.u2.Tooltip` | Hover text. Any Element gets one by setting its `tooltip` |
| ProgressView | `foam.u2.ProgressView` | Progress bar for a value from 0 to 100 |

<example id="feedback">
start('h3').add('LoadingSpinner').end();
tag(foam.u2.LoadingSpinner, { size: 32 });
tag(foam.u2.LoadingSpinner, { size: 32, showText: true, text: 'Loading...' });

start('h3').add('CircleIndicator').end();
start().style({ display: 'flex', gap: '8px' }).
  tag(foam.u2.tag.CircleIndicator, { label: '1', size: 32, backgroundColor: '#406dea', textColor: 'white', borderColor: '#406dea' }).
  tag(foam.u2.tag.CircleIndicator, { label: '2', size: 32 }).
  tag(foam.u2.tag.CircleIndicator, { label: '3', size: 32 }).
end();

start('h3').add('InlineNotificationMessage').end();
['INFO', 'SUCCESS', 'WARN', 'ERROR'].forEach(function(type) {
  start(foam.u2.dialog.InlineNotificationMessage, { type: type }).
    add('This is a ' + type + ' message.').
  end();
});

start('h3').add('Tooltip').end();
start('span', { tooltip: 'Hover text from the tooltip property' }).
  style({ textDecoration: 'underline dotted' }).
  add('Hover over me').
end();
</example>

---

## Dialogs

| Component | Class | Purpose |
|-----------|-------|---------|
| Popup | `foam.u2.dialog.Popup` | Full-screen modal overlay around any content |
| StyledModal | `foam.u2.dialog.StyledModal` | Popup with a `title`, `modalStyle` color bar and an action row |
| ConfirmationModal | `foam.u2.dialog.ConfirmationModal` | StyledModal with a `primaryAction` and a cancel button |

A dialog is built like any other element (create it, then `add()` content) and shown by calling `open()`, which places it over the whole page. It closes when the user clicks outside it, on the close icon, or on one of its actions.

Create a dialog with the action's context, `X`, as the second argument to `create()`. The context carries the services the dialog's content may need, such as DAOs and the `notify` function, and gives the dialog's buttons a `closeDialog` function to call.

<example id="dialogs">
foam.CLASS({
  name: 'DialogDemo',
  requires: [
    'foam.u2.dialog.ConfirmationModal',
    'foam.u2.dialog.StyledModal'
  ],
  properties: [
    { class: 'String', name: 'lastResult', visibility: 'RO' }
  ],
  actions: [
    {
      name: 'openStyledModal',
      code: function(X) {
        this.StyledModal.create({ title: 'A Styled Modal' }, X).
          add('Any content can go inside a modal.').
          open();
      }
    },
    {
      name: 'openWarningModal',
      code: function(X) {
        this.StyledModal.create({ title: 'Careful', modalStyle: 'WARN' }, X).
          add('WARN adds a yellow bar; DESTRUCTIVE adds a red one.').
          open();
      }
    },
    {
      name: 'openConfirmation',
      code: function(X) {
        var self = this;
        this.ConfirmationModal.create({
          title: 'Delete this record?',
          modalStyle: 'DESTRUCTIVE',
          primaryAction: {
            name: 'delete',
            label: 'Delete',
            code: function() { self.lastResult = 'Deleted'; }
          }
        }, X).add('This cannot be undone.').open();
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: DialogDemo.create() }));
</example>

---

## Graphics

`foam.graphics` components draw on a `<canvas>` instead of building HTML. A <term term="CView"></term> (canvas view) is the base class; shapes are CViews and can be nested with `add()`. A child's `x` and `y` are relative to its parent, so moving or rotating a parent moves everything inside it. Adding a CView to a u2 element creates the `<canvas>` for it.

CView properties are ordinary FOAM properties, so they can be bound and animated: binding a Circle's `radius$` to a RangeView's `data$` resizes the circle as the slider moves. Use graphics for custom drawing, simulations and diagrams. For forms and tables, use the HTML components above.

| Component | Class | Purpose |
|-----------|-------|---------|
| CView | `foam.graphics.CView` | Base canvas view with `x`, `y`, `width`, `height`, `rotation`, `alpha` |
| Box | `foam.graphics.Box` | Rectangle with `color` and `border` |
| Circle | `foam.graphics.Circle` | Circle, or a pie wedge when `start` / `end` are set |
| Arc | `foam.graphics.Arc` | Arc segment with `arcWidth` |
| Line | `foam.graphics.Line` | Line from `startX, startY` to `endX, endY` |
| Polygon / RegularPolygon | `foam.graphics.Polygon` | Closed shape from points, or a regular N-gon |
| Ellipse | `foam.graphics.Ellipse` | Ellipse |
| PieGraph / BarGraph | `foam.graphics.PieGraph` | Simple charts over a data series |

For dashboards, the widgets in `foam.dashboard.view` (Bar, Line, Pie, Count, DAOTable) are a better fit; see `foam3/doc/guides/Dashboard.md`.

<example id="graphics">
var canvas = foam.graphics.Box.create({ width: 400, height: 160, color: '#f4f6fa' });

canvas.add(foam.graphics.Circle.create({ x: 60, y: 80, radius: 40, color: '#406dea', border: null }));
canvas.add(foam.graphics.Circle.create({
  x: 160, y: 80, radius: 40, color: '#e6a020', border: null,
  start: 0, end: Math.PI * 1.5
}));
canvas.add(foam.graphics.Box.create({ x: 230, y: 40, width: 70, height: 80, color: '#2a9d5c', border: null }));
canvas.add(foam.graphics.RegularPolygon.create({ x: 350, y: 80, radius: 40, sides: 6, color: '#d1495b', border: null }));

add(canvas);
</example>

---

## Summary

### Component Selection Guide

| Need | Component |
|------|-----------|
| Short text | TextField |
| Long text | TextArea |
| Formatted text, edited | RichTextView |
| Formatted text, shown | HTMLView, MarkdownView |
| Code | CodeView, PreView |
| Secret | PasswordView |
| Value the user copies | CopyTextField, CopyBorder |
| On/off | CheckBox, Switch |
| One of a few options | RadioView, CardSelectionView |
| One of many options | ChoiceView, RichChoiceView |
| Several options | MultiChoiceView |
| Number in a range | RangeView |
| Progress | ProgressView, LoadingSpinner |
| A whole object | DetailView, SectionedDetailView, TabbedDetailView |
| A list of objects | TableView, DAOList, FObjectArrayView |
| Two views of one value | MultiView, DualView, AltView |
| Different view per mode | ModeAltView |
| Grouping content | CardBorder, TitleBorder, Accordion, Tabs |
| Arranging content | Rows, Cols, Grid |
| Status message | InlineNotificationMessage |
| Asking the user to confirm | ConfirmationModal |
| Custom drawing | foam.graphics CViews |

### Best Practices

1. **Prefer the default view** — set `view:` only when the default does not fit the use case
2. **Configure before subclassing** — most components take options (`choices`, `maxValue`, `rows`, `buttonStyle`)
3. **Use borders for decoration** — wrap content in a Border instead of adding CSS to the content
4. **Use composite views** — MultiView, AltView and ModeAltView combine existing components without new code
5. **Style with tokens** — components read CSS tokens such as `$backgroundBrand`; see [CSS Tokens](be:CSSTokens)

---

## See Also

- [FOAM AllViews Reference](be:AllViews) — The same views organized by property type
- [FOAM Views By Example](be:views) — Detailed view documentation
- [FOAM U3 By Example](be:u3) — Building custom views
- [FOAM CSS Tokens By Example](be:CSSTokens) — Styling components

<glossary>
  <def term="Element" definition="A FOAM object that builds and manages one DOM node and its children. The base class of every u2 component."></def>
  <def term="View" definition="A u2 Element with a data property that displays or edits a value. Can be named in a property's view: spec."></def>
  <def term="FObject" definition="An instance of a FOAM class. Its properties carry the metadata (type, label, view) that generic views such as DetailView read."></def>
  <def term="ViewSpec" definition="How a view is specified: a class name string, an object with a class key plus property values, or a function returning either."></def>
  <def term="DisplayMode" definition="Whether a view is editable (RW), read-only (RO), greyed out (DISABLED) or not shown (HIDDEN)."></def>
  <def term="Context" definition="FOAM's dependency-injection scope. Services such as DAOs are exported into a context and imported by name by the views created in it."></def>
  <def term="DAO" definition="Data Access Object: FOAM's standard interface to a collection of objects of one class, with put, remove, find and select, whatever the storage."></def>
  <def term="EasyDAO" definition="Convenience class that builds a DAO and its common decorators (sequence numbers, caching, test data) from a few options."></def>
  <def term="Sink" definition="An object that receives the results of a DAO select, one object at a time. ArraySink collects them into an array."></def>
  <def term="Reference" definition="Property type storing the id of an object held in another DAO, like a foreign key."></def>
  <def term="Section" definition="A named group of properties declared in a model's sections list. Sectioned detail views lay out each group separately."></def>
  <def term="Citation" definition="A short one-line summary of an object, built from its toSummary() method."></def>
  <def term="Action" definition="A method declared in a model's actions list, with a label, icon and availability rules. Rendered as a button by ActionView."></def>
  <def term="Border" definition="A u2 Element that wraps and decorates whatever content is added to it."></def>
  <def term="TextField" definition="Single-line text input. Default view for String properties."></def>
  <def term="TextArea" definition="Multi-line text input with rows and cols."></def>
  <def term="PasswordView" definition="Masked text input with a show/hide toggle."></def>
  <def term="CheckBox" definition="Checkbox input. Default view for Boolean properties."></def>
  <def term="Switch" definition="CheckBox drawn as an on/off slider."></def>
  <def term="ReferenceView" definition="ChoiceView populated from the DAO of a Reference property."></def>
  <def term="ActionView" definition="Button that renders an Action, styled by buttonStyle and size."></def>
  <def term="CView" definition="Base class for canvas-drawn graphics in foam.graphics."></def>
</glossary>
