/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.csv',
  name: 'CSVOutputterImpl',

  implements: [
    'foam.lib.csv.CSVOutputter'
  ],

  javaImports: [
    'foam.lang.*',
    'foam.mlang.Expr',
    'java.util.List',
    'java.util.Date',
    'java.text.*'
  ],

  properties: [
    {
      class: 'Class',
      name: 'of',
      required: true
    },
    {
      class: 'Boolean',
      name: 'sheetsCompatible',
      documentation: 'If enabled dates and times will be output in a Google Sheets compatible format without the timezone.'
    },
    {
      class: 'StringArray',
      name: 'props',
      factory: null,
      expression: function(of) {
        return of.getAxiomByName('tableColumns')
          ? of.getAxiomByName('tableColumns').columns
          : of.getAxiomsByClass()
            .filter((p) => ! p.networkTransient)
            .map((p) => p.name);
      },
      javaFactory: `
        // TODO: Add tableColumns to java to give an opportunity for a better default.
        return ((List<PropertyInfo>)getOf().getAxiomsByClass(PropertyInfo.class)).stream()
          .filter(propI -> ! propI.getNetworkTransient())
          .map(propI -> propI.getName())
          .toArray(String[]::new);
      `
    },
    {
      class: 'Array',
      type: 'foam.mlang.Expr[]',
      name: 'exprs',
      javaFactory: `
        Expr[] exprs = new Expr[getProps().length];

        for ( var i = 0 ; i < getProps().length ; i++ ) {
          exprs[i] = (Expr) getOf().getAxiomByName(getProps()[i]);
        }

        return exprs;
      `
    },
    {
      class: 'Boolean',
      name: 'isFirstRow',
      value: true
    },
    {
      class: 'Boolean',
      name: 'isFirstColumn',
      value: true
    },
    {
      class: 'String',
      name: 'csv',
      view: 'foam.u2.tag.TextArea',
      flags: ['js']
    },
    {
      class: 'Object',
      name: 'sb',
      flags: ['java'],
      javaType: 'java.lang.StringBuilder',
      javaFactory: 'return new StringBuilder();'
    },
    {
      class: 'Object',
      name: 'dateFormatter',
      javaType: 'java.text.DateFormat',
      javaFactory: 'return new java.text.SimpleDateFormat("MM/dd/yyyy hh:mm:ss aa");'
    }
  ],

  methods: [
    {
      name: 'outputValue',
      code: function(value) {
        if ( ! this.isFirstColumn ) this.csv += ',';
        this.isFirstColumn = false;
        this.outputValue_(value);
      },
      javaCode: `
        if ( ! getIsFirstColumn() ) getSb().append(",");
        setIsFirstColumn(false);
        outputValue_(value);
      `
    },
    {
      name: 'outputValue_',
      args: [
        { type: 'Any', name: 'value' }
      ],
      code:
        foam.mmethod(
          {
            String: function(value) {
              if ( value.includes(',') ) value = `"${value.replace(/\"/g, '""')}"`;
              this.csv += value;
            },
            Date: function(value) {
              this.outputValue_(value.toDateString());
            },
            Undefined: function(value) {},
            Null: function(value) {}
          }, function(value) {
            this.outputValue_(value.toString());
          }
        ),
      javaCode: `
        if ( value instanceof String ) {
          if ( ((String)value).contains(",") )
            value = '"' + ((String)value).replace("\\"", "\\"\\"") + '"';
          getSb().append(value);
        } else if ( value instanceof Date ) {
          if ( getSheetsCompatible() ) {
            String getSheetsCompatibleDate = getDateFormatter().format(value);
            getSb().append(getSheetsCompatibleDate);
          } else {
            getSb().append(value.toString());
          }
        } else if ( value instanceof String[] ) {
          // TODO: escape | character in values
          outputValue(String.join("|", (String[]) value));
        } else if ( value == null ) {
        } else {
          outputValue_(value.toString());
        }
      `
    },
    {
      name: 'newLine_',
      code: function() {
        this.csv += '\n';
        this.isFirstColumn = true;
      },
      javaCode: `
        getSb().append("\\n");
        setIsFirstColumn(true);
      `
    },
    {
      name: 'toString',
      code: function() {
        if ( this.isFirstRow ) this.outputHeader(this.__context__);
        return this.csv;
      },
      javaCode: `
        if ( getIsFirstRow() ) outputHeader(getX());
        return getSb().toString();
      `
    },
    {
      name: 'outputHeader',
      args: [
        { type: 'Context', name: 'x' }
      ],
      code: function(x) {
        this.props
          .map((name) => this.of.getAxiomByName(name))
          .forEach((p) => {
            if ( foam.lang.Property.isInstance(p) ) p.toCSVLabel.call(p, x, this);
          });
        this.newLine_();
        this.isFirstRow = false;
      },
      javaCode: `
        for (String name: getProps()) {
          Object p = getOf().getAxiomByName(name);
          if ( p != null && p instanceof PropertyInfo ) ((PropertyInfo)p).toCSVLabel(x, this);
        }
        newLine_();
        setIsFirstRow(false);
      `
    },
    {
      name: 'outputFObject',
      code: function(x, obj) {
        if ( ! this.of ) this.of = obj.cls_;
        if ( this.isFirstRow ) this.outputHeader(x);
        this.props
          .map((name) => this.of.getAxiomByName(name))
          .forEach((p) => {
            if ( foam.lang.Property.isInstance(p) ) p.toCSV.call(p, x, obj, this);
          });
        this.newLine_();
      },
      javaCode: `
        if ( getOf() == null ) setOf(obj.getClassInfo());
        if ( getIsFirstRow() ) outputHeader(x);
        for ( Expr expr : getExprs() ) {
          if ( expr != null && expr instanceof PropertyInfo ) {
            ((PropertyInfo) expr).toCSV(x, obj, this);
          }
        }
        newLine_();
      `
    },
    {
      name: 'flush',
      code: function() {
        this.csv = '';
        this.isFirstColumn = undefined;
        this.isFirstRow    = undefined;
      },
      javaCode: `
        getSb().setLength(0);
        clearIsFirstRow();
        clearIsFirstColumn();
      `
    }
  ]
});
