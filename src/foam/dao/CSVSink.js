/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'CSVSink',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  javaImports: [
    'foam.lang.PropertyInfo',
    'java.util.List'
  ],

  documentation: 'Sink runs the csv outputter, and contains the resulting string in this.csv',

  properties: [
    {
      class: 'String',
      name: 'csv',
      reactive: false,
      view: 'foam.u2.tag.TextArea',
      factory: function() { return this.outputter.toString(); },
      javaGetter: 'return getOutputter().toString();'
    },
    {
      class: 'Class',
      name: 'of',
      hidden: true
    },
    {
      class: 'StringArray',
      name: 'props',
      hidden: true,
      factory: function() {
        if ( ! this.of ) return [];
        if ( tc = this.of.getAxiomByName('tableColumns') ) return tc.columns;
        return this.of.getAxiomsByClass(foam.lang.Property)
          .filter((p) => ! p.networkTransient)
          .map((p) => p.name);
      },
      javaFactory: `
        if ( getOf() == null ) return new String[]{};

        return ((List<PropertyInfo>)getOf().getAxiomsByClass(PropertyInfo.class))
          .stream()
          .filter(propI -> ! propI.getNetworkTransient())
          .map(propI -> propI.getName())
          .toArray(String[]::new);
      `
    },
    {
      name: 'outputter',
      class: 'FObjectProperty',
      of: 'foam.lib.csv.CSVOutputter',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.lib.csv.CSVOutputterImpl.create({
          of: this.of,
          props: this.props
        });
      },
      javaFactory: `
        return new foam.lib.csv.CSVOutputterImpl.Builder(getX())
          .setOf(getOf())
          .setProps(getProps())
          .build();
      `
    }
  ],

  methods: [
    {
      name: 'put',
      code: function(obj) {
        this.outputter.outputFObject(this.__context__, obj);
      },
      javaCode: `
        setCsv("");
        getOutputter().outputFObject(getX(), (foam.lang.FObject)obj);
      `
    },
    {
      name: 'eof',
      code: function() {
        this.csv = this.outputter.toString();
      },
      javaCode: `
        setCsv(getOutputter().toString());
      `
    },
    {
      name: 'reset',
      code: function() {
        this.outputter.flush();
        this.csv = '';
      },
      javaCode: `
        getOutputter().flush();
        setCsv("");
      `
    },
    function addToE(e) { e.start('pre').style({margin: 0, maxHeight: '600px'}).add(this.csv); }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'PropertyCSVRefinement',
  refines: 'foam.lang.Property',

  properties: [
    {
      class: 'Function',
      name: 'toCSV',
      value: function(x, obj, outputter) {
        outputter.outputValue(obj ? this.f(obj) : null);
      }
    },
    {
      class: 'Function',
      name: 'toCSVLabel',
      value: function(x, outputter) {
        outputter.outputValue(this.name);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'FObjectPropertyCSVRefinement',
  refines: 'foam.lang.FObjectProperty',
  requires: [
    'foam.lib.csv.PrefixedCSVOutputter'
  ],

  documentation: `
    Provides FObjectProperties with the behavior to output to multiple columns
    with the property name as a prefix.
  `,

  properties: [
    {
      name: 'toCSV',
      value: function(x, obj, outputter) {
        if ( ! this.of ) {
          outputter.outputValue(obj ? this.f(obj) : null);
          return;
        }
        this.of.getAxiomsByClass(foam.lang.Property)
          .forEach((p) => {
            p.toCSV.call(p, x, obj ? this.f(obj) : null, outputter);
          });
      }
    },
    {
      name: 'javaToCSV',
      class: 'String',
      value: `
        if ( of() instanceof foam.lang.EmptyClassInfo ) {
          outputter.outputValue(obj != null ? f(obj) : null);
          return;
        }
        for ( foam.lang.PropertyInfo p : (java.util.List<foam.lang.PropertyInfo>) of().getAxiomsByClass(foam.lang.PropertyInfo.class) ) {
          p.toCSV(x, obj != null ? f(obj) : null, outputter);
        }
      `
    },
    {
      name: 'toCSVLabel',
      class: 'Function',
      value: function(x, outputter) {
        if ( ! this.of ) {
          outputter.outputValue(this.name);
          return;
        }
        outputter = this.PrefixedCSVOutputter.create({
          prefix: this.name + '.',
          delegate: outputter
        });
        this.of.getAxiomsByClass(foam.lang.Property)
          .forEach(p => {
            p.toCSVLabel.call(p, x, outputter);
          });
      },
    },
    {
      name: 'javaToCSVLabel',
      class: 'String',
      value: `
        if ( of() instanceof foam.lang.EmptyClassInfo ) {
          outputter.outputValue(getName());
          return;
        }
        outputter = new foam.lib.csv.PrefixedCSVOutputter.Builder(x)
          .setPrefix(getName() + ".")
          .setDelegate(outputter)
          .build();
        for ( foam.lang.PropertyInfo p : (java.util.List<foam.lang.PropertyInfo>) of().getAxiomsByClass(foam.lang.PropertyInfo.class) ) {
          p.toCSVLabel(x, outputter);
        }
      `
    }
  ]
});
