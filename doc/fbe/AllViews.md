<flow name="be:AllViews" category="DOC/EXAMPLES" spid="foam" description="Reference of every FOAM property type and its views: the default view plus common alternatives, shown with live examples." keywords="allviews,views,property types,default view,viewspec,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM AllViews Reference

A comprehensive reference of all FOAM property types and their associated views. Each section demonstrates the default view and common alternatives for a property type.

<toc></toc>

## Overview

FOAM automatically selects appropriate views based on property type. This reference shows:
- Default views for each property type
- Common view alternatives and configurations
- View options and customization

### Property Type Categories

| Category | Types |
|----------|-------|
| **Text** | String, Code, Script |
| **Numbers** | Int, Float, Double, Byte, Short, Long, Currency |
| **Boolean** | Boolean |
| **Date/Time** | Date, DateTime, Time, Duration |
| **Selection** | Enum, Reference |
| **Collections** | Array, StringArray, FObjectArray, Map |
| **Special** | Color, Image, Password, URL, EMail, PhoneNumber |
| **Objects** | FObjectProperty, Class, Object |

---

## String Properties

<term term="String"></term> properties are the most common, with many view options depending on use case.

| View | Use Case |
|------|----------|
| TextField | Single-line input (default) |
| TextArea | Multi-line input |
| ChoiceView | Selection from list |
| RadioView | Few mutually exclusive options |
| RichTextField | HTML/formatted text |

<example id="string-views">
foam.CLASS({
  name: 'StringViews',
  properties: [
    {
      class: 'String',
      name: 'stringDefault'
    },
    {
      class: 'String',
      name: 'stringWithTextField',
      view: 'foam.u2.TextField'
    },
    {
      class: 'String',
      name: 'stringWithTextFieldWithSize',
      view: { class: 'foam.u2.TextField', maxLength: 10 }
    },
    {
      class: 'String',
      name: 'stringWithTextArea',
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 80 }
    },
    {
      class: 'String',
      name: 'stringWithChoiceView',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'stringWithRadioView',
      view: {
        class: 'foam.u2.view.RadioView',
        choices: ['Yes', 'No', 'Maybe']
      }
    },
    {
      class: 'String',
      name: 'stringWithChoicesKeyValue',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [['y', 'Yes'], ['n', 'No'], ['m', 'Maybe']]
      }
    },
    {
      class: 'String',
      name: 'stringWithChoicesFunction',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.ChoiceView',
          choices: ['Function', 'Generated', 'Choices']
        };
      }
    },
    {
      class: 'String',
      name: 'stringWithRichTextField',
      view: 'foam.u2.view.RichTextField'
    },
    {
      class: 'String',
      name: 'stringWithDisplayWidth',
      displayWidth: 10
    }
  ]
});

add(foam.u2.DetailView.create({ data: StringViews.create() }));
</example>

---

## Code and Script Properties

<term term="Code"></term> properties are for source code with syntax highlighting. <term term="Script"></term> is similar but for executable scripts.

<example id="code-views">
foam.CLASS({
  name: 'CodeViews',
  properties: [
    {
      class: 'Code',
      name: 'codeDefault',
      value: 'function hello() {\n  console.log("Hello!");\n}'
    },
    {
      class: 'Code',
      name: 'codeWithPreView',
      view: 'foam.u2.view.PreView',
      value: 'const x = 42;\nreturn x * 2;'
    },
    {
      class: 'Script',
      name: 'scriptDefault',
      value: 'return this.name + " script";'
    }
  ]
});

add(foam.u2.DetailView.create({ data: CodeViews.create() }));
</example>

---

## Integer Properties

<term term="Int"></term> properties have specialized views for numeric input with optional constraints.

| View | Use Case |
|------|----------|
| IntView | Text input with validation (default) |
| RangeView | Slider control |
| ProgressView | Read-only progress indicator |
| CurrencyView | Formatted currency display |

<example id="int-views">
foam.CLASS({
  name: 'IntViews',
  properties: [
    {
      class: 'Int',
      name: 'intDefault'
    },
    {
      class: 'Int',
      name: 'intWithIntView',
      view: 'foam.u2.IntView'
    },
    {
      class: 'Int',
      name: 'intWithMinMax',
      min: 0,
      max: 100,
      value: 50
    },
    {
      class: 'Int',
      name: 'intWithUnits',
      units: 'kg',
      value: 75
    },
    {
      class: 'Int',
      name: 'intWithRangeView',
      view: 'foam.u2.RangeView',
      value: 50
    },
    {
      class: 'Int',
      name: 'intWithProgressView',
      view: 'foam.u2.ProgressView',
      value: 75
    },
    {
      class: 'Int',
      name: 'intWithMultiView',
      view: {
        class: 'foam.u2.MultiView',
        views: ['foam.u2.RangeView', 'foam.u2.IntView']
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: IntViews.create() }));
</example>

---

## Other Numeric Properties

FOAM provides several numeric types for different ranges and precision requirements.

| Type | Range/Precision |
|------|-----------------|
| Byte | -128 to 127 |
| Short | -32,768 to 32,767 |
| Int | ±2.1 billion |
| Long | ±9.2 quintillion |
| Float | ~7 decimal digits |
| Double | ~15 decimal digits |

<example id="numeric-views">
foam.CLASS({
  name: 'NumericViews',
  properties: [
    { class: 'Byte', name: 'byteDefault' },
    { class: 'Short', name: 'shortDefault' },
    { class: 'Long', name: 'longDefault' },
    {
      class: 'Float',
      name: 'floatDefault'
    },
    {
      class: 'Float',
      name: 'floatWithPrecision',
      precision: 2,
      value: 3.14159
    },
    {
      class: 'Double',
      name: 'doubleDefault'
    },
    {
      class: 'Currency',
      name: 'currencyDefault',
      value: 1234.56
    }
  ]
});

add(foam.u2.DetailView.create({ data: NumericViews.create() }));
</example>

---

## Boolean Properties

<term term="Boolean"></term> properties default to a checkbox but can use radio buttons for explicit yes/no choices.

<example id="boolean-views">
foam.CLASS({
  name: 'BooleanViews',
  properties: [
    {
      class: 'Boolean',
      name: 'booleanDefault'
    },
    {
      class: 'Boolean',
      name: 'booleanWithCheckBox',
      view: 'foam.u2.CheckBox'
    },
    {
      class: 'Boolean',
      name: 'booleanWithRadioView',
      view: {
        class: 'foam.u2.view.RadioView',
        choices: [[true, 'Yes'], [false, 'No']]
      }
    },
    {
      class: 'Boolean',
      name: 'booleanWithToggle',
      view: 'foam.u2.view.Toggle'
    }
  ]
});

add(foam.u2.DetailView.create({ data: BooleanViews.create() }));
</example>

---

## Date and Time Properties

FOAM provides separate types for dates, times, and combined date-times.

| Type | Stores | View |
|------|--------|------|
| Date | Date only | DateView (calendar) |
| DateTime | Date and time | DateTimeView |
| Time | Time only | TimeView |
| Duration | Time span in ms | DurationView |

<example id="date-views">
foam.CLASS({
  name: 'DateViews',
  properties: [
    {
      class: 'Date',
      name: 'dateDefault',
      factory: function() { return new Date(); }
    },
    {
      class: 'Date',
      name: 'dateWithDateView',
      view: 'foam.u2.view.DateView'
    },
    {
      class: 'DateTime',
      name: 'dateTimeDefault',
      factory: function() { return new Date(); }
    },
    {
      class: 'DateTime',
      name: 'dateTimeWithView',
      view: 'foam.u2.view.DateTimeView'
    },
    {
      class: 'Time',
      name: 'timeDefault'
    },
    {
      class: 'Duration',
      name: 'durationDefault',
      value: 3661000  // 1 hour, 1 minute, 1 second
    }
  ]
});

add(foam.u2.DetailView.create({ data: DateViews.create() }));
</example>

---

## Enum Properties

<term term="Enum"></term> properties use ChoiceView by default, populated with the enum's values.

<example id="enum-views">
foam.ENUM({
  name: 'Status',
  values: [
    { name: 'PENDING', label: 'Pending' },
    { name: 'ACTIVE', label: 'Active' },
    { name: 'COMPLETED', label: 'Completed' },
    { name: 'CANCELLED', label: 'Cancelled' }
  ]
});

foam.CLASS({
  name: 'EnumViews',
  properties: [
    {
      class: 'Enum',
      of: 'Status',
      name: 'enumDefault'
    },
    {
      class: 'Enum',
      of: 'Status',
      name: 'enumWithRadioView',
      view: {
        class: 'foam.u2.view.RadioView',
        isHorizontal: true
      }
    },
    {
      class: 'Enum',
      of: 'Status',
      name: 'enumReadOnly',
      value: Status.ACTIVE,
      visibility: 'RO'
    }
  ]
});

add(foam.u2.DetailView.create({ data: EnumViews.create() }));
</example>

---

## Color Properties

<term term="Color"></term> properties provide color pickers and display views.

<example id="color-views">
foam.CLASS({
  name: 'ColorViews',
  properties: [
    {
      class: 'Color',
      name: 'colorDefault',
      value: '#ff6600'
    },
    {
      class: 'Color',
      name: 'colorWithReadView',
      value: '#3366cc',
      view: 'foam.u2.view.ReadColorView'
    },
    {
      class: 'Color',
      name: 'colorWithEditView',
      value: '#cc3366',
      view: 'foam.u2.view.ColorEditView'
    },
    {
      class: 'Color',
      name: 'colorWithMultiView',
      value: '#66cc33',
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

add(foam.u2.DetailView.create({ data: ColorViews.create() }));
</example>

---

## Image Properties

<term term="Image"></term> properties store image URLs and can display thumbnails.

<example id="image-views">
foam.CLASS({
  name: 'ImageViews',
  properties: [
    {
      class: 'Image',
      name: 'imageDefault',
      value: 'https://picsum.photos/200/150'
    },
    {
      class: 'Image',
      name: 'imageWithSize',
      displayWidth: 100,
      displayHeight: 100,
      value: 'https://picsum.photos/200/200'
    }
  ]
});

add(foam.u2.DetailView.create({ data: ImageViews.create() }));
</example>

---

## Password Properties

<term term="Password"></term> properties mask input and are never displayed in read-only mode.

<example id="password-views">
foam.CLASS({
  name: 'PasswordViews',
  properties: [
    {
      class: 'Password',
      name: 'passwordDefault'
    },
    {
      class: 'Password',
      name: 'passwordWithValue',
      value: 'secret123'
    }
  ]
});

add(foam.u2.DetailView.create({ data: PasswordViews.create() }));
</example>

---

## Contact Properties

FOAM provides specialized property types for common contact information with built-in validation.

<example id="contact-views">
foam.CLASS({
  name: 'ContactViews',
  properties: [
    {
      class: 'EMail',
      name: 'emailDefault'
    },
    {
      class: 'PhoneNumber',
      name: 'phoneDefault'
    },
    {
      class: 'URL',
      name: 'urlDefault',
      value: 'https://example.com'
    }
  ]
});

add(foam.u2.DetailView.create({ data: ContactViews.create() }));
</example>

---

## Array Properties

FOAM provides several array property types for different element types.

| Type | Element Type | Default View |
|------|--------------|--------------|
| Array | Any | ArrayView |
| StringArray | String | StringArrayView |
| FObjectArray | FObject | FObjectArrayView |

<example id="array-views">
foam.CLASS({
  name: 'SampleItem',
  properties: ['id', 'name', 'value']
});

foam.CLASS({
  name: 'ArrayViews',
  properties: [
    {
      class: 'Array',
      name: 'arrayDefault',
      factory: function() { return [1, 2, 3]; }
    },
    {
      class: 'StringArray',
      name: 'stringArrayDefault',
      factory: function() { return ['apple', 'banana', 'cherry']; }
    },
    {
      class: 'StringArray',
      name: 'stringArrayWithRowView',
      view: 'foam.u2.view.StringArrayRowView',
      factory: function() { return ['row1', 'row2', 'row3']; }
    },
    {
      class: 'FObjectArray',
      of: 'SampleItem',
      name: 'fobjectArrayDefault',
      factory: function() {
        return [
          SampleItem.create({ id: '1', name: 'Item 1', value: 100 }),
          SampleItem.create({ id: '2', name: 'Item 2', value: 200 })
        ];
      }
    },
    {
      class: 'FObjectArray',
      of: 'SampleItem',
      name: 'fobjectArrayWithTitledView',
      view: 'foam.u2.view.TitledArrayView',
      factory: function() {
        return [
          SampleItem.create({ id: '1', name: 'Item 1', value: 100 })
        ];
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: ArrayViews.create() }));
</example>

---

## Map Properties

<term term="Map"></term> properties store key-value pairs.

<example id="map-views">
foam.CLASS({
  name: 'MapViews',
  properties: [
    {
      class: 'Map',
      name: 'mapDefault',
      factory: function() {
        return {
          key1: 'value1',
          key2: 'value2',
          nested: { a: 1, b: 2 }
        };
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: MapViews.create() }));
</example>

---

## Reference Properties

<term term="Reference"></term> properties store foreign keys to objects in another DAO.

<example id="reference-views">
foam.CLASS({
  name: 'Category',
  properties: ['id', 'name'],
  methods: [
    function toSummary() { return this.name; }
  ]
});

var categoryDAO = foam.dao.EasyDAO.create({
  of: Category,
  daoType: 'MDAO',
  testData: [
    { id: 'tech', name: 'Technology' },
    { id: 'sci', name: 'Science' },
    { id: 'art', name: 'Art' }
  ]
});

foam.CLASS({
  name: 'ReferenceViews',
  exports: ['categoryDAO'],
  properties: [
    {
      name: 'categoryDAO',
      hidden: true,
      factory: function() { return categoryDAO; }
    },
    {
      class: 'Reference',
      of: 'Category',
      name: 'referenceDefault',
      targetDAOKey: 'categoryDAO'
    },
    {
      class: 'Reference',
      of: 'Category',
      name: 'referenceWithCustomView',
      targetDAOKey: 'categoryDAO',
      view: {
        class: 'foam.u2.view.ReferenceView',
        objToChoice: function(obj) {
          return [obj.id, obj.id + ': ' + obj.name];
        }
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: ReferenceViews.create() }));
</example>

---

## FObject Properties

<term term="FObjectProperty"></term> stores nested FOAM objects. <term term="FObjectView"></term> provides a class selector and property editor.

<example id="fobject-views">
foam.CLASS({
  name: 'Address',
  properties: ['street', 'city', 'country']
});

foam.CLASS({
  name: 'FObjectViews',
  properties: [
    {
      class: 'FObjectProperty',
      of: 'Address',
      name: 'fobjectDefault'
    },
    {
      class: 'FObjectProperty',
      of: 'Address',
      name: 'fobjectWithValue',
      factory: function() {
        return Address.create({
          street: '123 Main St',
          city: 'Toronto',
          country: 'Canada'
        });
      }
    },
    {
      name: 'anyFObject',
      view: 'foam.u2.view.FObjectView'
    },
    {
      name: 'anyValue',
      view: 'foam.u2.view.AnyView'
    }
  ]
});

add(foam.u2.DetailView.create({ data: FObjectViews.create() }));
</example>

---

## Class Properties

<term term="Class"></term> properties store references to FOAM class objects.

<example id="class-views">
foam.CLASS({
  name: 'ClassViews',
  properties: [
    {
      class: 'Class',
      name: 'classDefault'
    },
    {
      class: 'Class',
      name: 'classWithValue',
      value: 'foam.util.Timer'
    }
  ]
});

add(foam.u2.DetailView.create({ data: ClassViews.create() }));
</example>

---

## DAO Properties

<term term="DAOProperty"></term> stores a reference to a DAO and can display its contents.

<example id="dao-views">
foam.CLASS({
  name: 'Person',
  properties: ['id', 'name', 'age']
});

var personDAO = foam.dao.EasyDAO.create({
  of: Person,
  seqNo: true,
  daoType: 'MDAO',
  testData: [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 35 }
  ]
});

foam.CLASS({
  name: 'DAOViews',
  properties: [
    {
      class: 'foam.dao.DAOProperty',
      of: 'Person',
      name: 'daoDefault',
      value: personDAO
    },
    {
      class: 'foam.dao.DAOProperty',
      of: 'Person',
      name: 'daoWithTableView',
      value: personDAO,
      view: 'foam.u2.table.TableView'
    },
    {
      class: 'foam.dao.DAOProperty',
      of: 'Person',
      name: 'daoWithDAOList',
      value: personDAO,
      view: 'foam.u2.DAOList'
    },
    {
      class: 'foam.dao.DAOProperty',
      of: 'Person',
      name: 'daoWithAltView',
      value: personDAO,
      view: {
        class: 'foam.u2.view.AltView',
        views: [
          ['foam.u2.table.TableView', 'Table'],
          ['foam.u2.DAOList', 'List']
        ]
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: DAOViews.create() }));
</example>

---

## Special Views

### MultiView

<term term="MultiView"></term> displays multiple views of the same property simultaneously.

<example id="multiview">
foam.CLASS({
  name: 'MultiViewDemo',
  properties: [
    {
      class: 'Int',
      name: 'value',
      value: 50,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          'foam.u2.RangeView',
          { class: 'foam.u2.IntView', onKey: true },
          'foam.u2.ProgressView'
        ]
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: MultiViewDemo.create() }));
</example>

### AltView

<term term="AltView"></term> lets users switch between different views of the same property.

<example id="altview">
foam.CLASS({
  name: 'AltViewDemo',
  properties: [
    {
      class: 'String',
      name: 'content',
      value: '**Bold** and _italic_ text',
      view: {
        class: 'foam.u2.view.AltView',
        views: [
          [{ class: 'foam.u2.tag.TextArea', rows: 4 }, 'Edit'],
          ['foam.u2.view.MarkdownView', 'Preview']
        ]
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: AltViewDemo.create() }));
</example>

### ModeAltView

<term term="ModeAltView"></term> shows different views based on display mode (RW vs RO).

<example id="modealtview">
foam.CLASS({
  name: 'ModeAltViewDemo',
  properties: [
    {
      class: 'String',
      name: 'html',
      value: '<b>Bold</b> and <i>italic</i>',
      view: {
        class: 'foam.u2.view.ModeAltView',
        readView: 'foam.u2.HTMLView',
        writeView: { class: 'foam.u2.tag.TextArea', rows: 3 }
      }
    }
  ]
});

add(foam.u2.DetailView.create({ data: ModeAltViewDemo.create() }));
add(foam.u2.DetailView.create({ data: ModeAltViewDemo.create(), mode: 'RO' }));
</example>

---

## Property Configuration

### Common Property Options

| Option | Description |
|--------|-------------|
| `value` | Default value |
| `factory` | Function returning default value |
| `view` | Custom view specification |
| `visibility` | RW, RO, HIDDEN, DISABLED |
| `required` | Validation requirement |
| `help` | Help text below field |
| `placeholder` | Placeholder text |
| `displayWidth` | Visual width hint |
| `units` | Unit label suffix |
| `min` / `max` | Numeric constraints |

<example id="property-options">
foam.CLASS({
  name: 'PropertyOptions',
  properties: [
    {
      class: 'String',
      name: 'withHelp',
      help: 'This help text appears below the field.'
    },
    {
      class: 'String',
      name: 'withPlaceholder',
      placeholder: 'Enter something here...'
    },
    {
      class: 'String',
      name: 'required',
      required: true,
      placeholder: 'This field is required'
    },
    {
      class: 'Int',
      name: 'withUnits',
      units: 'kg',
      value: 75
    },
    {
      class: 'Int',
      name: 'withMinMax',
      min: 0,
      max: 100,
      value: 50,
      help: 'Value must be between 0 and 100'
    },
    {
      class: 'String',
      name: 'readOnly',
      value: 'Cannot edit this',
      visibility: 'RO'
    },
    {
      class: 'String',
      name: 'disabled',
      value: 'Disabled field',
      visibility: 'DISABLED'
    }
  ]
});

add(foam.u2.DetailView.create({ data: PropertyOptions.create() }));
</example>

---

## Summary

### View Selection Guide

| Need | View |
|------|------|
| Single-line text | TextField |
| Multi-line text | TextArea |
| Choose from list | ChoiceView |
| Few exclusive options | RadioView |
| Number with slider | RangeView |
| Progress indicator | ProgressView |
| Date selection | DateView |
| Color selection | ColorEditView |
| Multiple views at once | MultiView |
| User-switchable views | AltView |
| Mode-dependent views | ModeAltView |
| DAO contents | TableView, DAOList |

### Best Practices

1. **Use semantic types** — EMail, PhoneNumber, URL provide validation
2. **Set appropriate constraints** — min/max, required, displayWidth
3. **Provide help text** — Guide users with help and placeholder
4. **Consider read-only** — Use ModeAltView for different RW/RO displays
5. **Choose the right view** — RadioView for few options, ChoiceView for many

---

## See Also

- [FOAM Views By Example](be:views) — Detailed view documentation
- [FOAM U3 By Example](be:u3) — Building custom views
- [FOAM CSS Tokens By Example](be:CSSTokens) — Styling views

<glossary>
  <def term="String" definition="Basic text property type. Default view is TextField."></def>
  <def term="Code" definition="Property type for source code with syntax highlighting."></def>
  <def term="Script" definition="Property type for executable scripts."></def>
  <def term="Int" definition="Integer property type. Supports min, max, and units options."></def>
  <def term="Boolean" definition="True/false property type. Default view is CheckBox."></def>
  <def term="Enum" definition="Enumeration property type. Default view is ChoiceView populated with enum values."></def>
  <def term="Color" definition="Color property type storing hex color values."></def>
  <def term="Image" definition="Property type storing image URLs with optional thumbnail display."></def>
  <def term="Password" definition="Masked input property type. Never displayed in read-only mode."></def>
  <def term="Map" definition="Property type storing key-value pairs as a JavaScript object."></def>
  <def term="Reference" definition="Foreign key property type linking to objects in another DAO."></def>
  <def term="FObjectProperty" definition="Property type storing nested FOAM objects."></def>
  <def term="FObjectView" definition="View for FObject properties with class selector and property editor."></def>
  <def term="Class" definition="Property type storing references to FOAM class objects."></def>
  <def term="DAOProperty" definition="Property type storing a reference to a DAO."></def>
  <def term="MultiView" definition="View that displays multiple views of the same property simultaneously."></def>
  <def term="AltView" definition="View that lets users switch between different views of the same property."></def>
  <def term="ModeAltView" definition="View that shows different sub-views based on display mode (RW/RO)."></def>
  <def term="TextField" definition="Single-line text input view. Default for String properties."></def>
  <def term="TextArea" definition="Multi-line text input view."></def>
  <def term="ChoiceView" definition="Dropdown select view for choosing from a list of options."></def>
  <def term="RadioView" definition="Radio button view for mutually exclusive choices."></def>
  <def term="RangeView" definition="Slider view for numeric properties."></def>
  <def term="ProgressView" definition="Read-only progress bar view for numeric properties."></def>
</glossary>