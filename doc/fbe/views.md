<flow name="be:views" category="DOC/EXAMPLES" spid="foam" description="Live examples of the most commonly used FOAM views, default views per property type and overriding them with view: and ViewSpecs." keywords="views,viewspec,property views,u2,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM Views By Example

FOAM provides a comprehensive set of views for displaying and editing property values. Views are automatically selected based on property type, but can be customized using the `view:` property. This document covers the most commonly used views and patterns.

<toc></toc>

## Overview

Every FOAM property has a default view based on its type. You can override this by specifying a `view:` property with either a class name or a <term term="ViewSpec"></term>.

| Property Type | Default View | Common Alternatives |
|---------------|--------------|---------------------|
| String | TextField | TextArea, RadioView, ChoiceView |
| Boolean | CheckBox | RadioView |
| Int/Float | IntView/FloatView | RangeView, ProgressView |
| Enum | ChoiceView | RadioView |
| Date | DateView | DateTimeView |
| Array | ArrayView | DAOList, TableView |
| FObject | DetailView | FObjectView |

### View Configuration Patterns

Views can be specified in several ways:

```javascript
// 1. Class name string
view: 'foam.u2.TextField'

// 2. ViewSpec object
view: {
  class: 'foam.u2.TextField',
  maxLength: 100,
  placeholder: 'Enter text...'
}

// 3. Function returning ViewSpec (for dynamic configuration)
view: function(args, X) {
  return {
    class: 'foam.u2.view.ChoiceView',
    choices: X.myService.getChoices()
  };
}
```

## Display Modes

Views support different display modes controlled by the `mode` or `visibility` property:

| Mode | Description | User Can Edit |
|------|-------------|---------------|
| `RW` | Read-Write (default) | Yes |
| `RO` | Read-Only | No |
| `DISABLED` | Disabled/greyed out | No |
| `HIDDEN` | Not rendered | N/A |

```javascript
// Set mode on property
{
  class: 'String',
  name: 'status',
  visibility: 'RO'  // Always read-only
}

// Dynamic visibility based on other properties
{
  class: 'String',
  name: 'reason',
  visibility: function(status) {
    return status === 'REJECTED' ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
  }
}
```

---

## String Properties

String properties default to a simple text field. Use `displayWidth` to control the field width, `placeholder` for hint text, and `help` for explanatory text below the field.

<example id="string-basic">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'default'
    },
    {
      class: 'String',
      name: 'featured',
      required: true,
      placeholder: 'placeholder',
      help: 'Help text.'
    },
    {
      class: 'String',
      name: 'stringWithDisplayWidth',
      displayWidth: 4
    },
    {
      class: 'String',
      name: 'stringWithTextFieldWithSize',
      displayWidth: 4,
      view: {
        class: 'foam.u2.TextField',
        maxLength: 4
      }
    },
    {
      class: 'String',
      name: 'stringWithTextArea',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 8,
        cols: 80
      }
    }
  ]
});

add(foam.u2.DetailView.create({data: Example.create()}));
</example>

---

## String with Choices

When a string property has a fixed set of valid values, use <term term="ChoiceView"></term>, <term term="RadioView"></term>, or a TextField with choices for autocomplete.

| View | Best For |
|------|----------|
| RadioView | Few options (2-5), all visible at once |
| ChoiceView | Many options, dropdown selection |
| TextField with choices | Autocomplete with free-form input |
| MultiView | Showing multiple views of the same value |

<example id="string-choices">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'radioView',
      view: {
        class: 'foam.u2.view.RadioView',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'radioViewHorizontal',
      value: 'Yes',
      view: {
        class: 'foam.u2.view.RadioView',
        choices: ['Yes', 'No', 'Maybe'],
        isHorizontal: true
      }
    },
    {
      class: 'String',
      name: 'textField',
      value: 'Yes',
      view: {
        class: 'foam.u2.TextField',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'choiceView',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'choiceViewWithSize',
      view: {
        class: 'foam.u2.view.ChoiceView',
        size: 3,
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'choiceViewWithPlaceholder',
      value: 'Yes',
      view: {
        class: 'foam.u2.view.ChoiceView',
        placeholder: 'placeholder',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'choiceViewWithMultipleViews',
      value: 'Yes',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.view.ChoiceView',
            size: 10,
            choices: ['Yes', 'No', 'Maybe']
          },
          {
            class: 'foam.u2.view.ChoiceView',
            size: 3,
            choices: ['Yes', 'No', 'Maybe']
          },
          {
            class: 'foam.u2.view.ChoiceView',
            placeholder: 'placeholder',
            choices: ['Yes', 'No', 'Maybe']
          },
          'foam.u2.TextField'
        ]
      }
    },
    {
      class: 'String',
      name: 'choiceViewWithValues',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [[1, 'Yes'], [0, 'No'], [0.5, 'Maybe']]
      }
    }
  ]
});

var t = Example.create();
add(foam.u2.detail.SectionedDetailView.create({data: t}));
</example>

---

## Boolean Properties

Boolean properties default to a checkbox. For more explicit yes/no selections, use RadioView with labeled choices.

<example id="boolean">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Boolean',
      name: 'default'
    },
    {
      class: 'Boolean',
      name: 'booleanWithRadio',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RadioView',
          choices: [
            [true, 'Yes'],
            [false, 'No']
          ],
          isHorizontal: true
        };
      }
    }
  ]
});

add(foam.u2.CheckBox.create());
var t = Example.create();
add(foam.u2.detail.SectionedDetailView.create({data: t}));
</example>

---

## Number Properties

FOAM provides several numeric property types with appropriate views. Use `min` and `max` to constrain values, and `units` to display a label.

| Type | Range | Use Case |
|------|-------|----------|
| Byte | -128 to 127 | Small integers |
| Short | -32,768 to 32,767 | Medium integers |
| Int | ±2 billion | Standard integers |
| Long | ±9 quintillion | Large integers |
| Float | ~7 decimal digits | Decimal numbers |
| Double | ~15 decimal digits | High-precision decimals |

<example id="numbers">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Int',
      name: 'default'
    },
    {
      class: 'Int',
      name: 'help',
      help: 'Help text.'
    },
    {
      class: 'Int',
      name: 'tooltip',
      view: { class: 'foam.u2.view.IntView', tooltip: 'Please enter a number.' }
    },
    {
      class: 'Int',
      name: 'intWithIntView',
      view: {
        class: 'foam.u2.view.IntView',
        onKey: true,
        displayWidth: 50
      }
    },
    {
      class: 'Int',
      name: 'intWithMinAndMax',
      min: 1,
      max: 5,
      value: 3,
      units: 'rating (1-5)'
    },
    {
      class: 'Int',
      name: 'intWithRangeView',
      view: { class: 'foam.u2.RangeView' }
    },
    {
      class: 'Int',
      name: 'intWithProgressView',
      view: { class: 'foam.u2.ProgressView' },
      value: 42
    },
    {
      class: 'Int',
      name: 'intWithMultiView',
      view: {
        class: 'foam.u2.MultiView',
        views: ['foam.u2.RangeView', 'foam.u2.IntView']
      }
    },
    {
      class: 'Int',
      name: 'intWithMultiViewVertical',
      view: {
        class: 'foam.u2.MultiView',
        horizontal: false,
        views: ['foam.u2.RangeView', { class: 'foam.u2.view.IntView', onKey: true }]
      }
    },
    { class: 'Byte',   name: 'defaultByte' },
    { class: 'Short',  name: 'defaultShort' },
    { class: 'Long',   name: 'defaultLong' },
    { class: 'Float',  name: 'defaultFloat' },
    {
      class: 'Float',
      name: 'floatWithPrecision',
      precision: 2,
      value: 3.1415926
    },
    { class: 'Double', name: 'defaultDouble' },
    {
      class: 'Float',
      name: 'temperature',
      value: 1,
      view: { class: 'foam.core.pm.TemperatureCView', width: 300 }
    },
    {
      class: 'Float',
      name: 'multiViewFloat',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          { class: 'foam.u2.TextField', placeholder: 'textfield', onKey: true },
          { class: 'foam.u2.FloatView', placeholder: 'floatview', onKey: true },
          { class: 'foam.u2.TextField', onKey: false },
          { class: 'foam.u2.FloatView', onKey: false },
          { class: 'foam.u2.FloatView', onKey: false, precision: 2 },
          { class: 'foam.u2.FloatView', onKey: false, precision: 2, trimZeros: false }
        ]
      }
    }
  ]
});

add(foam.u2.DetailView.create({data: Example.create()}));
</example>

---

## Enum Properties

<term term="Enum"></term> properties automatically use a ChoiceView populated with the enum's values. The enum's `label` property is displayed to the user while the actual enum value is stored.

<example id="enums">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Enum',
      name: 'displayWidth',
      of: 'foam.u2.layout.DisplayWidth'
    },
    {
      class: 'Enum',
      name: 'displayWidth2',
      of: 'foam.u2.layout.DisplayWidth',
      visibility: 'RO'
    }
  ]
});

var data = Example.create();
data.displayWidth$ = data.displayWidth2$;
add(data);
</example>

---

## Date and Time Properties

FOAM provides several date/time property types with specialized views. The `onKey` option controls whether updates happen on every keystroke or on blur.

| Type | Stores | View |
|------|--------|------|
| Date | Date only | DateView (calendar picker) |
| DateTime | Date and time | DateTimeView |
| Time | Time only | TimeView |
| Duration | Time span | DurationView |

<example id="dates-times">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Date',
      name: 'defaultDate'
    },
    {
      class: 'Date',
      name: 'dateRWAndRO',
      factory: function() { return new Date(); },
      view: {
        class: 'foam.u2.MultiView',
        views: [
          { class: 'foam.u2.view.DateView', onKey: false },
          { class: 'foam.u2.view.DateView', onKey: false },
          { class: 'foam.u2.view.DateView', mode: foam.u2.DisplayMode.RO }
        ]
      }
    },
    {
      class: 'Date',
      name: 'dateRWAndROOnKey',
      factory: function() { return new Date(); },
      view: {
        class: 'foam.u2.MultiView',
        views: [
          { class: 'foam.u2.view.DateView', onKey: true },
          { class: 'foam.u2.view.DateView', onKey: true },
          { class: 'foam.u2.view.DateView', mode: foam.u2.DisplayMode.RO }
        ]
      }
    },
    {
      class: 'DateTime',
      name: 'defaultDateTime'
    },
    {
      class: 'DateTime',
      name: 'defaultDateTime2',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          { class: 'foam.u2.view.DateTimeView', onKey: true },
          { class: 'foam.u2.view.DateTimeView', onKey: true },
          { class: 'foam.u2.view.DateView', onKey: true }
        ]
      }
    },
    {
      class: 'Time',
      name: 'defaultTime'
    },
    {
      class: 'Duration',
      name: 'duration'
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
add(data.defaultDateTime$);
</example>

---

## Color Properties

Color properties provide color picker views. Use `ReadColorView` for display-only color swatches, and `ColorEditView` for interactive editing.

<example id="colors">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Color',
      name: 'defaultColor'
    },
    {
      class: 'Color',
      name: 'readOnlyColor',
      value: 'orange',
      view: 'foam.u2.view.ReadColorView'
    },
    {
      class: 'Color',
      name: 'multiView',
      value: 'orange',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          'foam.u2.view.ColorEditView',
          'foam.u2.view.ReadColorView'
        ]
      }
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## Password Properties

Password properties automatically mask input. The value is hidden from view but accessible programmatically.

<example id="passwords">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Password',
      name: 'defaultPassword',
      value: 'secret'
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## Image Properties

Image properties store URLs and can display the image using various views.

<example id="images">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Image',
      name: 'defaultImage',
      value: '../u2/Dragon.png'
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## Array Properties

FOAM provides several array property types for different use cases.

| Type | Stores | Best View |
|------|--------|-----------|
| StringArray | Array of strings | StringArrayRowView |
| FObjectArray | Array of FObjects | FObjectArrayView, TitledArrayView |
| Array | Generic array | ArrayView |

<example id="arrays">
foam.CLASS({
  package: 'foam.demos.u2',
  name: 'SampleData',
  properties: [
    { class: 'String', name: 'id' },
    'name',
    'value'
  ],
  methods: [
    function toSummary() { return this.id + ' ' + this.value; }
  ]
});

foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'StringArray',
      name: 'defaultStringArray'
    },
    {
      class: 'StringArray',
      name: 'stringArrayRowView',
      view: 'foam.u2.view.StringArrayRowView',
      factory: function() { return ['row1', 'row2', 'row3']; }
    },
    {
      class: 'FObjectArray',
      name: 'FObjectArrayMultiView',
      of: 'foam.demos.u2.SampleData',
      view: {
        class: 'foam.u2.MultiView',
        views: [
          { class: 'foam.u2.view.TitledArrayView' },
          { class: 'foam.u2.view.FObjectArrayView' }
        ]
      }
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## Map Properties

Map properties store key-value pairs and provide a view for editing them.

<example id="maps">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'Map',
      name: 'map'
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## DAO Properties

<term term="DAOProperty"></term> stores a reference to a DAO and can display its contents using various views.

| View | Description |
|------|-------------|
| TableView | Spreadsheet-like grid with sorting and selection |
| DAOList | Simple vertical list of items |
| EmbeddedTableView | Compact table for embedding in forms |
| AltView | Lets user switch between multiple view options |

<example id="daos">
foam.CLASS({
  name: 'DAOSampleData',
  properties: [
    { class: 'Int', name: 'id' },
    'name',
    'value'
  ],
  methods: [
    function toSummary() { return this.id + ' ' + this.value; }
  ]
});

var dao = foam.dao.EasyDAO.create({
  of: DAOSampleData,
  daoType: 'MDAO',
  testData: [
    { id: 1, name: 'John',  value: 'value1' },
    { id: 2, name: 'John',  value: 'value2' },
    { id: 3, name: 'Kevin', value: 'value3' },
    { id: 4, name: 'Kevin', value: 'value4' },
    { id: 5, name: 'Larry', value: 'value5' },
    { id: 6, name: 'Linda', value: 'value6' }
  ]
});

foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'foam.dao.DAOProperty',
      of: 'DAOSampleData',
      name: 'dao',
      visibility: 'RW',
      value: dao
    },
    {
      class: 'foam.dao.DAOProperty',
      of: 'DAOSampleData',
      name: 'daoList',
      value: dao,
      visibility: 'RW',
      view: 'foam.u2.DAOList'
    },
    {
      class: 'foam.dao.DAOProperty',
      of: 'DAOSampleData',
      name: 'altDao',
      value: dao,
      visibility: 'RW',
      view: {
        class: 'foam.u2.view.AltView',
        views: [
          ['foam.u2.table.TableView', 'Table'],
          ['foam.u2.view.EmbeddedTableView', 'Embedded Table'],
          [{ class: 'foam.u2.DAOList' }, 'List']
        ],
        selectedViewLabel: 'Table'
      }
    }
  ]
});

var data = Example.create();
add(data);
</example>

---

## Rich Text Properties

FOAM supports several rich text formats including HTML, Code, and Markdown.

| View | Use Case |
|------|----------|
| HTMLView | Display rendered HTML |
| PreView | Display code with preserved formatting |
| CodeView | Edit code with syntax highlighting |
| MarkdownView | Display rendered Markdown |

<example id="rich-text">
var code = `
if ( true ) {
  console.log('true');
}
`;

foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'htmlView',
      value: '<b>bold</b><br/><i>italic</i>',
      view: 'foam.u2.HTMLView'
    },
    {
      class: 'Code',
      name: 'roCode',
      label: 'RO Code',
      view: 'foam.u2.view.PreView',
      value: code
    },
    {
      class: 'Code',
      name: 'code',
      value: code
    },
    {
      class: 'String',
      name: 'markdownView',
      value: `# Heading 1
## Heading 2
### Heading 3

[a link](https://github.com/kgrgreer/foam3)

normal _italics_ **bold** \`code\`
\`\`\`
a block of code
\`\`\`
`,
      view: {
        class: 'foam.u2.MultiView',
        horizontal: false,
        views: [
          { class: 'foam.u2.tag.TextArea', onKey: true, rows: 16, cols: 80 },
          'foam.u2.view.MarkdownView'
        ]
      }
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## Object Properties

For properties that hold arbitrary objects or FObjects, FOAM provides flexible views.

| View | Use Case |
|------|----------|
| AnyView | Edit any JavaScript value |
| FObjectView | Edit FObjects with class selection |
| DetailView | Display FObject properties |

<example id="objects">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      name: 'any',
      view: 'foam.u2.view.AnyView'
    },
    {
      name: 'fobjectView',
      view: 'foam.u2.view.FObjectView',
      value: { class: 'foam.util.Timer' }
    },
    {
      class: 'FObjectProperty',
      name: 'detailView',
      of: 'foam.util.Timer'
    }
  ]
});

var data = Example.create();
add(foam.u2.DetailView.create({data: data}));
</example>

---

## DetailViews

<term term="DetailView"></term> displays all properties of an FObject. FOAM provides several variants for different layouts and use cases.

| View | Description |
|------|-------------|
| DetailView | Standard two-column label/value layout |
| SectionedDetailView | Groups properties into collapsible sections |
| VerticalDetailView | Single-column stacked layout |

### DetailView Options

| Option | Effect |
|--------|--------|
| `title: ''` | Hide the title |
| `showActions: false` | Hide action buttons |
| `mode: 'RO'` | Read-only display |
| `mode: 'DISABLED'` | Disabled (greyed out) display |
| `expandPropertyViews: true` | Expand sub-objects inline |

<example id="detail-views">
var data = foam.util.Timer.create();

start('h2').add('DetailView').end();
add(foam.u2.DetailView.create({data: data}));
tag('p');

start('h2').add('DetailView with expandPropertyViews: true').end();
add(foam.u2.DetailView.create({data: data, expandPropertyViews: true}));
tag('p');

start('h2').add('DetailView with title: \'\'').end();
add(foam.u2.DetailView.create({data: data, title: ''}));
tag('p');

start('h2').add('DetailView with showActions: false').end();
add(foam.u2.DetailView.create({data: data, showActions: false}));
tag('p');

start('h2').add('DetailView with visibility: \'RO\'').end();
add(foam.u2.DetailView.create({data: data, mode: 'RO'}));
tag('p');

start('h2').add('DetailView with visibility: \'DISABLED\'').end();
add(foam.u2.DetailView.create({data: data, mode: 'DISABLED'}));
tag('p');

start('h2').add('SectionedDetailView').end();
add(foam.u2.detail.SectionedDetailView.create({data: data, title: 'SectionedDetailView'}));
tag('p');

start('h2').add('VerticalDetailView').end();
add(foam.u2.detail.VerticalDetailView.create({data: data, title: 'VerticalDetailView'}));
</example>

---

## Miscellaneous Views

### ReadWriteView

<term term="ReadWriteView"></term> composes two different views: one for display and another for editing. Like a spreadsheet cell that appears as a label until selected, then becomes an editable field.

Customize by subclassing and overriding `toReadE()` and `toWriteE()` methods.

<example id="read-write-view">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'value',
      value: 'value',
      view: 'foam.u2.ReadWriteView'
    }
  ]
});

add(Example.create());

foam.CLASS({
  name: 'TextView',
  extends: 'foam.u2.ReadWriteView',

  methods: [
    function toReadE() {
      return foam.u2.HTMLView.create({data$: this.data$}, this);
    },

    function toWriteE() {
      this.data$.sub(this.onDataLoad);
      return foam.u2.tag.TextArea.create({
        rows: 20,
        cols: 120,
        escapeTextArea: false,
        data$: this.data$
      }, this);
    }
  ]
});

tag(TextView.create({data: '<b>bold</b> <i>italic</i>'}));
</example>

---

### ValueView

<term term="ValueView"></term> displays a property value as plain text without any editing capability. Useful for computed or derived values.

<example id="value-view">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'value1',
      onKey: true,
      value: 'value'
    },
    {
      class: 'String',
      name: 'value2',
      view: 'foam.u2.view.ValueView'
    }
  ]
});

var e = Example.create();
e.value1$ = e.value2$;
add(e);
</example>

---

### ModeAltView

<term term="ModeAltView"></term> shows different views depending on the display mode (RW vs RO). This is useful when read and write views are fundamentally different and hard to combine into a single view.

<example id="mode-alt-view">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'value1',
      onKey: true,
      value: 'value',
      visibility: 'RW',
      view: {
        class: 'foam.u2.view.ModeAltView',
        readView: 'foam.u2.view.ValueView',
        writeView: 'foam.u2.TextField'
      }
    },
    {
      class: 'String',
      name: 'value2',
      visibility: 'RO',
      view: {
        class: 'foam.u2.view.ModeAltView',
        readView: 'foam.u2.view.ValueView',
        writeView: 'foam.u2.TextField'
      }
    }
  ]
});

var e = Example.create();
e.value1$ = e.value2$;
add(e);
</example>

---

### AltView

<term term="AltView"></term> lets users switch between multiple views of the same data. Each view is specified as a `[ViewSpec, label]` pair.

<example id="alt-view">
foam.CLASS({
  name: 'Example',
  properties: [
    {
      class: 'String',
      name: 'value1',
      value: 'No',
      view: {
        class: 'foam.u2.view.AltView',
        views: [
          [
            {
              class: 'foam.u2.view.RadioView',
              choices: ['Yes', 'No', 'Maybe']
            },
            'Radio'
          ],
          [
            {
              class: 'foam.u2.view.ChoiceView',
              choices: ['Yes', 'No', 'Maybe']
            },
            'Choice'
          ],
          [
            { class: 'foam.u2.TextField' },
            'Text'
          ]
        ],
        selectedViewLabel: 'Radio'
      }
    },
    {
      name: 'value2'
    }
  ]
});

var e = Example.create();
e.value2$ = e.value1$;
add(e);
add(e.value1$);
</example>

---

## Creating Custom Views

When built-in views don't meet your needs, create custom views by extending `foam.u2.View`.

```javascript
foam.CLASS({
  name: 'MyCustomView',
  extends: 'foam.u2.View',

  css: `
    ^ {
      border: 1px solid $borderDefault;
      padding: 8px;
    }
  `,

  methods: [
    function render() {
      this.addClass();

      // Access the bound data via this.data or this.data$
      this
        .start('div')
          .add('Current value: ', this.data$)
        .end()
        .start('button')
          .add('Clear')
          .on('click', () => { this.data = ''; })
        .end();
    }
  ]
});
```

### Key View Patterns

| Pattern | Method | Use Case |
|---------|--------|----------|
| Bind to data | `this.data$` | Display reactive value |
| Update data | `this.data = newValue` | Modify bound property |
| Sub-context | `this.__subContext__` | Access services |
| Add children | `this.add()`, `this.start()` | Build DOM structure |

---

## Summary

When selecting views for your properties:

1. **Start with defaults** — FOAM's default views are well-suited for most cases
2. **Use semantic types** — EMail, PhoneNumber, URL etc. provide appropriate validation and views
3. **Consider the user** — RadioView for few choices, ChoiceView for many
4. **Combine with MultiView** — Show the same data in multiple formats for debugging or complex interfaces
5. **Use AltView for flexibility** — Let users choose their preferred view
6. **Create custom views sparingly** — Extend existing views when possible

---

## See Also

- [FOAM CSS Tokens By Example](be:CSSTokens) — Styling views with tokens
- [FOAM Validation By Example](be:validation) — Property validation in views
- [U2 Element documentation](u2.md) — Low-level view building

<glossary>
  <def term="ViewSpec" definition="A specification for creating a view, either a class name string or an object with class and configuration properties."></def>
  <def term="ChoiceView" definition="A dropdown select view for choosing from a list of options. Supports [value, label] pairs."></def>
  <def term="RadioView" definition="A view showing radio buttons for mutually exclusive choices. Use isHorizontal for inline layout."></def>
  <def term="Enum" definition="An enumeration type with a fixed set of named values. Automatically uses ChoiceView."></def>
  <def term="DAOProperty" definition="A property that holds a reference to a DAO (Data Access Object)."></def>
  <def term="DetailView" definition="A view that displays all properties of an FObject in a form layout."></def>
  <def term="SectionedDetailView" definition="A DetailView variant that groups properties into collapsible sections."></def>
  <def term="ReadWriteView" definition="A view that switches between read and write modes, like a spreadsheet cell."></def>
  <def term="ValueView" definition="A simple view that displays a value as plain text without editing capability."></def>
  <def term="ModeAltView" definition="A view that shows different sub-views based on the current display mode (RW/RO)."></def>
  <def term="AltView" definition="A view that lets users switch between multiple alternative views of the same data."></def>
  <def term="MultiView" definition="A view that displays multiple views of the same data simultaneously. Useful for debugging."></def>
  <def term="onKey" definition="View property that controls whether updates fire on every keystroke (true) or on blur (false)."></def>
  <def term="displayWidth" definition="Property setting that controls the visual width of text input fields."></def>
  <def term="DisplayMode" definition="Enum controlling view editability: RW (read-write), RO (read-only), DISABLED, HIDDEN."></def>
</glossary>