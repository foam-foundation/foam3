/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TableCellFormatter',
  extends: 'FObjectProperty',

  requires: [
    'foam.lang.FObjectProperty',
    'foam.u2.view.FnFormatter'
  ],

  properties: [
    {
      name: 'of',
      value: 'foam.u2.view.Formatter'
    },
    {
      name: 'adapt',
      value: function(o, f, prop) {
        if ( foam.String.isInstance(f) ) {
          return foam.lookup(f).create();
        }
        if ( foam.Function.isInstance(f) ) {
          return prop.FnFormatter.create({f: f});
        }
        return prop.FObjectProperty.ADAPT.value.call(this, o, f, prop);
      }
    },
    {
      name: 'value',
      adapt: function(_, v) {
        return this.adapt.call(this, _, v, this);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'TableCellPropertyRefinement',

  refines: 'foam.lang.Property',

  properties: [
    {
      name: 'tableHeaderFormatter',
      value: function(axiom) {
        this.add(axiom.label || foam.String.labelize(axiom.name));
      }
    },
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      factory: function() {
        return foam.u2.view.FnFormatter.create({
          class: 'foam.u2.view.FnFormatter',
          f: function(value, obj, axiom) {
            this.add(value);
          }
        });
      },
      // Allows formatters to decide if they are projectionSafe or not
      postSet: function(_,n) {
        if ( 'projectionSafe' in n ) this.projectionSafe = n.projectionSafe;
      }
    },
    {
      class: 'Int',
      name: 'tableWidth'
    },
    {
      class: 'Boolean',
      name: 'projectionSafe',
      value: true
    },
    {
      class: 'String',
      documentation: 'Column label that overrides the label property in table headers',
      name: 'columnLabel',
      // return the label if columnLabel is not set
      expression: function(label) { return label; }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TableHeaderActionRefinement',

  refines: 'foam.lang.Action',

  properties: [
    {
      class: 'String',
      name: 'columnLabel',
      expression: function(label) { return label; }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'ActionTableCellFormatterRefinement',
  refines: 'foam.lang.Action',

  properties: [
    {
      tags: ['web'],
      generateJava: false,
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(_, obj, axiom) {
        this.
          startContext({ data: obj }).
          tag(axiom, {
            size: 'SMALL',
            buttonStyle: 'SECONDARY'
          }).
          endContext();
      }
    },
    {
      tags: ['web'],
      generateJava: false,
      name: 'tableHeaderFormatter',
      value: function(axiom) { this.add(axiom.label); }
    },
    {
       type: 'Int',
       name: 'tableWidth',
       value: 130
    },
    ['projectionSafe', false]
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'EnumTableCellFormatterRefinement',
  refines: 'foam.lang.Enum',

  requires: ['foam.u2.view.ReadOnlyEnumView'],

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        if ( value ) {
          this
            .tag(foam.u2.view.ReadOnlyEnumView, { data: value });
        } else {
          this.start().
            add('-').
          end();
        }
      }
    },
    {
      class: 'Int',
      name: 'tableWidth',
      value: 130
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ImageTableCellFormatterRefinement',
  refines: 'foam.lang.Image',

  requires: [
    'foam.u2.view.ImageView',
    'foam.u2.crunch.Style'
  ],
  css: `
    .foam-u2-view-ImageTableCellFormatter {
      height: -webkit-fill-available;
      height: -moz-available;
      padding: 2px;
    }
  `,
  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        if ( value ) {
          this
            .start({ class: 'foam.u2.view.ImageView', data: value })
              .addClass('foam-u2-view-ImageTableCellFormatter')
            .end();
        } else {
          this.start()
            .add('-')
          .end();
        }
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'FObjectPropertyTableCellFormatterRefinement',
  refines: 'foam.lang.FObjectProperty',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(obj) {
        this.callIf(obj, function() {
          this.start()
            .add(obj.toSummary())
          .end();
        })
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'UnitValueTableCellFormatterRefinement',
  refines: 'foam.lang.UnitValue',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value, obj, axiom) {
        var unitProp = obj.cls_.getAxiomByName(axiom.unitPropName);
        if ( ! unitProp ) {
          console.warn(obj.cls_.name, ' does not have the property: ', axiom.unitPropName);
          this.add(value);
          return;
        }
        var self = this;
        this.startContext({objData: obj}).tag(foam.u2.view.ValueView, {prop: axiom, data: value}).endContext();
      }
    },
    ['projectionSafe', false]
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'ReferenceToSummaryCellFormatter',
  implements: ['foam.u2.view.Formatter'],

  properties: [
    {
      class: 'Boolean',
      name: 'projectionSafe'
    }
  ],

  methods: [
    function format(e, value, obj, axiom) {
      try {
        obj[axiom.name + '$find'].then(o => e.add(o && o?.toSummary() || value), r => e.add(value));
      } catch (x) {
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'DAOCountCellFormatter',
  implements: ['foam.u2.view.Formatter'],

  properties: [
    {
      class: 'Boolean',
      name: 'projectionSafe',
      value: true
    }
  ],

  methods: [
    function format(e, value, obj, axiom) {
      try {
        var ex = foam.mlang.Expressions.create();
        value.select(ex.COUNT()).then(o => e.add(o.value));
      } catch (x) {
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'YesNoTableCellFormatter',
  implements: ['foam.u2.view.Formatter'],
  documentation: `Shows 'Y'/'N' for boolean props`,

  methods: [
    function format(e, value, obj, axiom) {
      e.start()
        .call(function() {
          if ( value ) { e.style({color: 'green'}); }
        })
        .add(value ? ' Y' : '-')
      .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'BooleanTableCellFormatterRefinement',
  refines: 'foam.lang.Boolean',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        this.tag({
          class: 'foam.u2.CheckBox',
          data: value
        });
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'StringArrayTableCellFormatterRefinement',
  refines: 'foam.lang.StringArray',
  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        this.add(value.join(', '));
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'FObjectArrayTableCellFormatterRefinement',
  refines: 'foam.lang.FObjectArray',
  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        this.callIf(value, function() {
          this.add(value.map(o => o.toSummary()).join(', '));
        });
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'DateTableCellFormatterRefinement',
  refines: 'foam.lang.Date',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(date) {
        // allow the browser to deal with this since we are technically using the user's preference
        if ( date ) {
          var formattedDate = date.toLocaleDateString(foam.locale);
          this.add(formattedDate);
          this.tooltip = formattedDate;
        }
      }
    },
    {
      class: 'Int',
      name: 'tableWidth',
      value: 130
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'DateTimeTableCellFormatterRefinement',
  refines: 'foam.lang.DateTime',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(date) {
        // allow the browser to deal with this since we are technically using the user's preference
        if ( date ) {
          // toLocaleString includes date and time (uses local timezone)
          var formattedDate = date.toLocaleString(foam.locale);
          this.add(formattedDate);
          this.tooltip = formattedDate;
        }
      }
    },
    {
      class: 'Int',
      name: 'tableWidth',
      value: 130
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'DateTimeUTCTableCellFormatterRefinement',
  refines: 'foam.lang.DateTimeUTC',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(date) {
        if ( date ) {
          // Format as UTC using locale-default format
          var formattedDate = foam.util.DateUtil.format(date, 'UTC');
          this.add(formattedDate);
          this.tooltip = formattedDate;
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'DurationTableCellFormatterRefinement',
  refines: 'foam.lang.Duration',
  imports: [
    'returnExpandedCSS'
  ],
  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(value) {
        let formatted = foam.lang.Duration.duration(value);
        let negative = value < 0;
        this.add(formatted || '0ms').style({ color: negative ? this.__subContext__.returnExpandedCSS('$destructive500') : 'inherit' });
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'FormattedStringTableCellFormatterRefinement',
  refines: 'foam.lang.FormattedString',

  properties: [
    {
      class: 'foam.u2.view.TableCellFormatter',
      name: 'tableCellFormatter',
      value: function(val, _, prop) {
        var format = prop.formatter.join('').replace(/\d+/g, function(match) { return 'x'.repeat(match); });
        this.add(foam.String.applyFormat(val, format));
      }
    }
  ]
});
