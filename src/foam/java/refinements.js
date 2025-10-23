/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * To debug in browser, load with ?java=true flag, then run something like:
 *   c = foam.java.Class.create();
 *   foam.core.auth.Region.buildJavaClass(c);
 *   c.toString();
 * from the console.
**/

foam.INTERFACE({
  package: 'foam.lib.csv',
  name: 'FromCSVSetter',
  flags: [ 'genjava', 'java' ],

  methods: [
    {
      name: 'set',
      args: [
        { type: 'FObject', name: 'obj' },
        { type: 'String',  name: 'str' }
      ]
    }
  ]
});


foam.LIB({
  name: 'foam.java',
  // flags: ['java'],
  methods: [
    {
      name: 'asJavaValue',
      code: foam.mmethod({
        String: function asJavaValue(s) {
          return '"' + s.
            replace(/\\/g, "\\\\").
            replace(/"/g, '\\"').
            replace(/\n/g, "\\n") + '"';
        },
        Boolean: function(b) {
          return b ? "true" : "false";
        },
        Number: function(n) {
          return '' + n +
            (n > Math.pow(2, 31) || n < -Math.pow(2,31) ? 'L' : '');
        },
        FObject: function(o) {
          return o.asJavaValue();
        },
        Undefined: function() {
          // TODO: This probably isn't strictly right, but we do it in
          // a number of places.
          return null;
        },
        Array: function(a, prop) {
          return "new " + (prop ? prop.javaType : 'Object[]') + " {" +
            a.map(foam.java.asJavaValue).join(',') +
            '}';
        },
        Null: function(n) { return "null"; },
        Object: function(o) {
          if ( o.asJavaValue ) return o.asJavaValue.call(o, o);
          return `foam.util.Arrays.asMap(new Object[] {
${Object.keys(o).map(function(k, i, a) {
  return `  ${foam.java.asJavaValue(k)}, ${foam.java.asJavaValue(o[k])}` + ((i == a.length-1) ? '' : ',')
}).join('\n')}
})`;
        },
        RegExp: function(o) {
          o = o.toString();
          o = o.slice(o.indexOf('/') + 1, o.lastIndexOf('/'))
          o = o.replace(/\\/g, '\\\\')
          return `java.util.regex.Pattern.compile("${o}")`
        },
        Date: function(d) {
          var n = d.getTime();
          return `new java.util.Date(` + n +
            (n > Math.pow(2, 31) || n < -Math.pow(2,31) ? 'L' : '') + `)`
        }
      })
    },
    {
      name: 'toJavaType',
      code: function(type) {
        return foam.lang.type.toType(type).toJavaType();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'JavaType',
  extends: 'String',
  flags: [],
  properties: [
    {
      name: 'flags',
      value: ['java']
    },
    {
      name: 'expression',
      expression: function(value) {
        // TODO: This is a large hack around the way SHADOW_MAP works.
        // What we really want is a way to specify a default
        // factory/expression but not to use it if the user sets a
        // default value.
        return function(type) {
          return value || foam.java.toJavaType(type);
        }
      }
    },
    {
      name: 'name',
      value: 'javaType'
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ArgumentJavaRefinement',
  refines: 'foam.lang.Argument',
  // flags: ['java'],
  properties: [
    { class: 'foam.java.JavaType' } // JavaType defines 'name' and other properties
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'PropertyJavaRefinement',
  refines: 'foam.lang.Property',

  // flags: ['java'],

  properties: [
    {
      class: 'Boolean',
      name: 'generateJava',
      expression: function(flags) {
        return foam.util.flagFilter(['java'])(this);
      }
    },
    { class: 'foam.java.JavaType' }, // JavaType defines 'name' and other properties
    {
      class: 'String',
      name: 'javaJSONParser',
      // Set to the String literal 'null' if no JSONParser desired
      value: 'foam.lib.json.AnyParser.instance()'
    },
    {
      class: 'String',
      name: 'javaQueryParser',
      expression: function(javaJSONParser) {
        return javaJSONParser;
      }
    },
    {
      class: 'String',
      name: 'javaCSVParser'
    },
    {
      class: 'String',
      name: 'javaInfoType'
    },
    {
      class: 'String',
      name: 'javaFactory'
    },
    {
      class: 'Boolean',
      name: 'synchronized'
    },
    {
      class: 'String',
      name: 'javaGetter'
    },
    {
      class: 'String',
      name: 'javaSetter'
    },
    {
      class: 'String',
      name: 'javaAdapt'
    },
    {
      class: 'String',
      name: 'javaPreSet'
    },
    {
      class: 'String',
      name: 'javaPostSet'
    },
    {
      class: 'String',
      name: 'shortName'
    },
    {
      class: 'StringArray',
      name: 'aliases'
    },
    {
      class: 'String',
      name: 'javaCloneProperty',
      value: null
    },
    {
      class: 'String',
      name: 'javaDiffProperty',
      value: null
    },
    {
      class: 'String',
      name: 'javaCompare',
      value: 'return foam.util.SafetyUtil.compare(get_(o1), get_(o2));'
    },
    {
      class: 'String',
      name: 'javaComparePropertyToObject',
      value: 'return foam.util.SafetyUtil.compare(cast(key), get_(o));'
    },
    {
      class: 'String',
      name: 'javaComparePropertyToValue',
      value: 'return foam.util.SafetyUtil.compare(cast(key), cast(value));'
    },
    {
      class: 'String',
      name: 'javaAssertValue'
    },
    {
      class: 'String',
      name: 'javaValue',
      expression: function(value) {
        return foam.java.asJavaValue(value);
      }
    },
    {
      class: 'String',
      name: 'javaValidateObj',
      expression: function(required, validationPredicates, internalValidationPredicates) {
        validationPredicates = [...validationPredicates, ...internalValidationPredicates];

        return validationPredicates.length == 0 ? '' : (required ? 'super.validateObj(x, obj);' : '') + `
var sps    = new foam.lib.parse.StringPStream();
var parser = foam.parse.FScriptParser.create(this);
var px     = new foam.lib.parse.ParserContextImpl();` +
        validationPredicates
          .map((vp) => {
            var exception = vp.errorMessage ?
              `throw new IllegalStateException(((${this.forClass_}) obj).${vp.errorMessage});` :
              `throw new IllegalStateException(${foam.java.asJavaValue(vp.errorString)});`
            return `
sps.setString(${foam.java.asJavaValue(vp.query)});
if ( ! ((foam.mlang.predicate.Predicate) parser.parse(sps,px).value()).f(obj) ) {
  ${exception}
}`;
          })
          .join('');
      }
    },
    {
      class: 'String',
      name: 'javaFromCSVLabelMapping',
      value: `
        foam.lang.PropertyInfo prop = this;
        map.put(getName(), new foam.lib.csv.FromCSVSetter() {
          public void set(foam.lang.FObject obj, String str) {
            prop.set(obj, fromString(str));
          }
        });
      `
    },
    {
      class: 'String',
      name: 'javaToCSV',
      value: 'outputter.outputValue(obj != null ? get(obj) : null);'
    },
    {
      class: 'String',
      name: 'javaToCSVLabel',
      value: 'outputter.outputValue(getName());'
    },
    {
      class: 'String',
      name: 'javaFormatJSON',
      value: null
    }
  ],

  methods: [
    function asJavaValue() {
      return `${this.forClass_}.${foam.String.constantize(this.name)}`;
    },

    function createJavaPropertyInfo_(cls) {
      var isID = false;

      // sourceCls_ isn't set for Proxy delegate properties
      if ( this.sourceCls_ ) {
        if ( this.sourceCls_.model_.ids ) {
          var ids = this.sourceCls_.model_.ids;
          for ( var i = 0 ; i < ids.length ; i++ ) {
            if ( ids[i] == this.name ) {
              isID = true;
              break;
            }
          }
        } else {
          if ( this.name == 'id' ) isID = true;
        }
      }

      var info = foam.java.PropertyInfo.create({
        includeInID: isID,
        sourceCls:   cls,
        extends:     this.javaInfoType,
        property:    this
      });

      info.method({
        name: 'toString',
        visibility: 'public',
        type: 'String',
        body: 'return "' + cls.id + '.' + this.name + '";'
      });

      return info;
    },

    function generateSetter_() {
      // return user defined setter
      if ( this.javaSetter ) {
        return this.javaSetter;
      }

      var capitalized = foam.String.capitalize(this.name);
      var setter = `assertNotFrozen();\n`;

      // add pre-set function
      if ( this.javaAdapt ) {
        setter += this.javaAdapt;
      }

      // add value assertion
      if ( this.javaAssertValue ) {
        setter += this.javaAssertValue;
      }

      // add pre-set function
      if ( this.javaPreSet ) {
        setter += this.javaPreSet;
      }

      // set value
      // Don't include oldVal if not used
      if ( this.javaPostSet && this.javaPostSet.indexOf('oldVal') != -1 ) {
        setter += `${this.javaType} oldVal = ${this.name}_;\n`;
      }
      setter += `${this.name}_ = val;\n`;
      setter += `${this.name}IsSet_ = true;\n`;

      // add post-set function
      if ( this.javaPostSet ) {
        setter += this.javaPostSet;
      }

      return setter;
    },

    function buildJavaClass(cls) {
      if ( ! this.generateJava ) return;

      // Use javaInfoType as an indicator that this property should be
      // generated to java code.

      // TODO: Evaluate if we still want this behaviour.  It might be
      // better to only respect the generateJava flag
      if ( ! this.javaInfoType ) return;

      var privateName = this.name + '_';
      var capitalized = foam.String.capitalize(this.name);
      var constantize = foam.String.constantize(this.name);
      var isSet       = this.name + 'IsSet_';
      var factoryName = capitalized + 'Factory_';

      cls.
        field({
          name: privateName,
          type: this.javaType,
          visibility: 'protected'
        }).
        field({
          name: isSet,
          type: 'boolean',
          visibility: 'protected',
          initializer: 'false;'
        }).
        method({
          name: 'get' + capitalized,
          type: this.javaType,
          visibility: 'public',
          synchronized: this.synchronized,
          forceJavaOutputter: true,
          body: this.javaGetter || ('if ( ! ' + isSet + ' ) {\n' +
            ( this.javaFactory ?
                '  set' + capitalized + '(' + factoryName + '());\n' :
                ' return ' + this.javaValue + ';\n' ) +
            '}\n' +
            'return ' + privateName + ';')
        }).
        method({
          name: 'set' + capitalized,
          // setter: true,
          // Enum setters shouldn't be public.
          visibility: 'public',
          synchronized: this.synchronized,
          args: [
            {
              type: this.javaType,
              name: 'val'
            }
          ],
          type: 'void',
          forceJavaOutputter: true,
          body: this.generateSetter_()
        }).
        method({
          name: 'clear' + capitalized,
          visibility: 'public',
          type: 'void',
          forceJavaOutputter: true,
          body: `assertNotFrozen();
${isSet} = false;`
        });

      if ( this.javaFactory ) {
        cls.method({
          name: factoryName,
          visibility: 'public',
          type: this.javaType,
          body: this.javaFactory
        });
      }

      if ( ! foam.java.Interface.isInstance(cls) ) {
        cls.field({
          name: constantize,
          visibility: 'public',
          static: true,
          final: true,
          type: 'foam.lang.PropertyInfo',
          initializer: this.createJavaPropertyInfo_(cls)
        });
      }

      var info = cls.getField('classInfo_');
      if ( info ) info.addAxiom(cls.name + '.' + constantize);
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ImplementsJavaRefinement',
  refines: 'foam.lang.Implements',
  // flags: ['java'],
  properties: [
    {
      name: 'java',
      class: 'Boolean',
      value: true
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( this.java ) cls.implements = cls.implements.concat(this.path);
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'InnerClassJavaRefinement',
  refines: 'foam.lang.InnerClass',
  // flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'generateJava',
      expression: function(model) {
        return foam.util.flagFilter(['java'])(model);
      }
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( ! this.generateJava ) return;

      var innerClass = this.model.buildClass().buildJavaClass();
      innerClass.innerClass = true;
      innerClass.static = true;
      cls.classes.push(innerClass);

      return innerClass;
    }
  ]
});


foam.LIB({
  name: 'foam.lang.FObject',
  methods: [
    function buildJavaClass(cls) {
      // TODO Generate getX() and setX() if contextAware
      cls = cls || foam.java.Class.create();

      cls.name          = this.model_.name;
      cls.package       = this.model_.package;
      cls.source        = this.model_.source;
      cls.abstract      = this.model_.abstract;
      cls.documentation = this.model_.documentation;

      // javaExtends - extends only for java
      cls.extends = this.model_.extends === 'FObject' ?
        undefined : this.model_.extends;

      cls.SUPER_CLASSES[cls.id] = cls;

      if ( this.model_.javaExtends )
        cls.extends = this.model_.javaExtends;

      cls.fields.push(foam.java.ClassInfo.create({ id: this.id }));

      cls.method({
        name: 'getClassInfo',
        type: 'foam.lang.ClassInfo',
        visibility: 'public',
        body: 'return classInfo_;',
        forceJavaOutputter:true
      });

      cls.method({
        name: 'getOwnClassInfo',
        visibility: 'public',
        static: true,
        type: 'foam.lang.ClassInfo',
        body: 'return classInfo_;',
        forceJavaOutputter:true
      });

      var flagFilter = foam.util.flagFilter(['java']);
      var axioms     = this.getOwnAxioms().filter(flagFilter);

      for ( var i = 0 ; i < axioms.length ; i++ ) {
        axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls, this);
      }

      // TODO: instead of doing this here, we should walk all Axioms
      // and introduce a new buildJavaAncestorClass() method
      var flagFilter = foam.util.flagFilter(['java']);

      var properties = this.getAxiomsByClass(foam.lang.Property)
        .filter(flagFilter)
        .filter(p => !! p.javaType && p.javaInfoType && p.generateJava);

      cls.allProperties = properties
        .map(p => foam.java.Field.create({ name: p.name, type: p.javaType, includeInHash: p.includeInHash }));

      var javaFactoryProperties = properties.filter(p => p.javaFactory);

      if ( javaFactoryProperties.length > 0 ) {
        cls.method({
          visibility: 'public',
          type: 'void',
          name: 'beforeFreeze',
          body: (this.model_.extends === 'FObject' ? '' : 'super.beforeFreeze();\n') +
            javaFactoryProperties.map(p => `get${foam.String.capitalize(p.name)}();`)
              .join('\n')
        });
      }

      // If model doesn't explicitly extend anything, inject old AbstractFObject methods
      if ( this.model_.extends === 'FObject' ) {
        cls.field({
          name: "x_",
          visibility: 'protected',
          static: false,
          final: false,
          type: 'foam.lang.X',
          initializer: "foam.lang.EmptyX.instance();"
        });

        cls.method({
          name: 'getX',
          type: 'foam.lang.X',
          visibility: 'public',
          body: 'return x_;'
        });

        cls.method({
          name: 'setX',
          type: 'void',
          visibility: 'public',
          args: [
            {
              name: 'x',
              type: 'foam.lang.X'
            }
          ],
          body: 'x_ = x;'
        });

        // Generate Freeze
        cls.field({
          name: "__frozen__",
          visibility: 'protected',
          static: false,
          final: false,
          type: 'boolean',
          initializer: "false;"
        });

        if ( ! this.hasOwnAxiom('freeze') ) {
          cls.method({
            name: 'freeze',
            type: 'foam.lang.FObject',
            visibility: 'public',
            body: `beforeFreeze();
__frozen__ = true;
return this;`
          });
        }

        if ( ! this.hasOwnAxiom('isFrozen') ) {
          cls.method({
            name: 'isFrozen',
            type: 'boolean',
            visibility: 'public',
            body: `return __frozen__;`
          });
        }

        // Generate Extras if they don't exist in the model
        if ( ! this.hasOwnAxiom('toString') ) {
          cls.method({
            name: 'toString',
            type: 'String',
            visibility: 'public',
            body: `StringBuilder sb = new StringBuilder();
append(sb);
return sb.toString();`
          });
        }

        if ( ! this.hasOwnAxiom('equals') ) {
          cls.method({
            name: 'equals',
            type: 'boolean',
            visibility: 'public',
            args: [
              {
                name: 'o',
                type: 'Object'
              }
            ],
            body: `if ( o == null ) return false; if ( o.getClass() != getClass() ) return false; return compareTo(o) == 0;`
          });
        }

        // If model doesn't already implement FObject, implement it
        if ( ! cls.implements )
          cls.implements = [ 'foam.lang.FObject' ];
        else if ( ! ( cls.implements.includes('foam.lang.FObject') || cls.implements.includes('foam.lang.FObject') ) )
          cls.implements.push('foam.lang.FObject');
      }

      if ( this.hasOwnAxiom('id') ) {
        cls.implements = cls.implements.concat('foam.lang.Identifiable');
        cls.method({
          visibility: 'public',
          type: 'Object',
          name: 'getPrimaryKey',
          body: 'return getId();'
        });
      }

      if ( cls.name ) {
        var props = cls.allProperties;

        if ( ! this.model_.hasOwnProperty('javaGenerateDefaultConstructor') ) {
          this.model_.javaGenerateDefaultConstructor = true;
        }

        if ( this.model_.javaGenerateDefaultConstructor ) {
          // No-arg constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            // Set the bock to this comment so that the code generator doesn't think
            // this has the same implementation as its parent if a class extends another
            // class with the same name but a different package and then not output it.
            body: '/*' + this.model_.package + '*/'
          });

          // Context-oriented constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            args: [{ type: 'foam.lang.X', name: 'x' }],
            body: 'setX(x);'
          });
        }

        cls.method({
          visibility: 'public',
          name: 'getPlural',
          type: 'String',
          body: `return "${this.model_.plural}";`
        });

        cls.method({
          visibility: 'public',
          name: 'hashCode',
          type: 'int',
          body:
            ['int hash = 1'].concat(props.filter(function(p) {
              return p.includeInHash; }).map(function(f) {
              return 'hash = hash * 31 + foam.util.SafetyUtil.hashCode(' + f.name + '_)';
            })).join(';\n') + ';\n'
            +'return hash;\n'
        });

        if ( ! this.hasOwnAxiom('compareTo') ) {
          cls.method({
            visibility: 'public',
            name: 'compareTo',
            type: 'int',
            args:[{ name: 'o', type: 'Object' }],
            body: [''
              +'if ( o == null ) return 1;'
              +'if ( o == this ) return 0;'
              +'if ( ! ( o instanceof foam.lang.FObject ) ) return 1;'
              +'if ( getClass() != o.getClass() ) {'
                +'return getClassInfo().getId().compareTo(((foam.lang.FObject)o).getClassInfo().getId());'
              +'}'
              +cls.name+' o2 = ('+ cls.name + ') o;\n'
              +'int cmp;\n'].concat(props.map(function(f) {
                return 'cmp = ' + foam.String.constantize(f.name) + '.compare(this, o2);\n'
                  +'if ( cmp != 0 ) return cmp;';
              })).join('\n')+'\n'
              +'  return 0;\n'
          });
        }

        // If the model doesn't explicitly define a value, then compute based
        // on number of properties.
        if ( ! this.model_.hasOwnProperty('javaGenerateConvenienceConstructor') )
          this.model_.javaGenerateConvenienceConstructor = props.length && props.length < 7;

        if ( this.model_.javaGenerateConvenienceConstructor ) {
          // All-property constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            args: props.map(function(f) {
              return { name: f.name, type: f.type };
            }),
            body: props.map(function(f) {
              return 'set' + foam.String.capitalize(f.name) + '(' + f.name + ')';
            }).join(';\n') + ';'
          });

          // Context oriented all-property constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            args: [{ name: 'x', type: 'foam.lang.X' }]
              .concat(props.map(function(f) {
                return { name: f.name, type: f.type };
              })),
            body: ['setX(x)'].concat(props.map(function(f) {
              return 'set' + foam.String.capitalize(f.name) + '(' + f.name + ')';
            })).join(';\n') + ';'
          });
        }

        if ( ! cls.abstract ) {
          // Apply builder pattern if not abstract.
          foam.java.Builder.create({ properties: this.getAxiomsByClass(foam.lang.Property)
            .filter(flagFilter)
            .filter(function(p) {
            return p.generateJava && p.javaInfoType;
          }) }).buildJavaClass(cls);
        }
      }

      return cls;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractMethodJavaRefinement',
  refines: 'foam.lang.AbstractMethod',
  // flags: ['java'],

  properties: [
    {
      class: 'String',
      name: 'javaCode',
      // flags: ['java'],
    },
    { class: 'foam.java.JavaType' }, // JavaType defines 'name' and other properties
    {
      class: 'Boolean',
      name: 'final'
    },
    {
      class: 'Boolean',
      name: 'abstract',
      value: false
    },
    { class: 'String', name: 'visibility', value: 'public' },
    {
      class: 'StringArray',
      name: 'javaThrows'
    },
    {
      class: 'Boolean',
      name: 'javaSupport',
      expression: function(flags) {
        return foam.util.flagFilter(['java'])(this);
      }
    },
    {
      class: 'Boolean',
      name: 'remote'
    }
  ],

  methods: [
    function buildMethodInfoInitializer(cls) {
      // Add MethodInfo field for each method
      initializerString = `new foam.lang.MethodInfo() {
@Override
public String getName() {
  return "${this.name}";
}
@Override
public Object call(foam.lang.X x, Object receiver, Object[] args) {
`;
      // See if call needs try catch block
      var exceptions = this.javaThrows.length > 0;
      if ( exceptions ) initializerString += `    try {
        `;

      if ( this.javaType != 'void' ) initializerString += '  return ';
      // Use ((typeCast)receiver).methodName() to call method because of rare collisions between inner and outer class method names
      initializerString += `((${cls.name})receiver).${this.name}(`;
      argsString = '';
      for ( var i = 0 ; this.args && i < this.args.length ; i++ ) {
        if ( this.args[i].javaType )
          argsString += '(' + this.args[i].javaType.replace('...', '[]').replace('final ', '') + `)(args[${ i }])`;
        else if ( this.args[i].type )
          argsString += '(' + this.args[i].type.replace('...', '[]').replace('final ', '') + `)(args[${ i }])`;
        else if ( this.args[i].class )
          argsString += '(' + this.args[i].class.replace('...', '[]').replace('final ', '') + `)(args[${ i }])`;
        else
          continue;
        if ( i != this.args.length - 1 ) argsString += ', ';
      }
      initializerString += argsString + ');\n';

      // Close try block
      if ( exceptions ) { initializerString += `          }
         catch (Throwable t) {
           foam.core.logger.Logger logger = (foam.core.logger.Logger) x.get("logger");
           logger.error(t.getMessage());
         }\n
        `
      }

      if ( exceptions || this.javaType == 'void' ) {
        initializerString += "return null;"
      }

      initializerString += `}
};
`;
      return initializerString;
    },

    function buildJavaClass(cls) {
      if ( ! this.javaSupport ) return;
      if ( ! this.javaCode && ! this.abstract ) return;

      cls.method({
        name:          this.name,
        type:          this.javaType || 'void',
        visibility:    this.visibility,
        static:        this.isStatic(),
        abstract:      this.abstract && ! this.javaCode,
        final:         this.final,
        synchronized:  this.synchronized,
        remote:        this.remote,
        throws:        this.javaThrows,
        documentation: this.documentation,
        body:          this.javaCode || '',
        args: this.args && this.args.map(function(a) {
          return {
            name: a.name,
            type: a.javaType
          };
        })
      });

      var initializerString = this.buildMethodInfoInitializer(cls);

      // Create MethodInfo field
      methodInfoName = foam.String.constantize(this.name);
      field = cls.field({
        name: methodInfoName,
        visibility: 'public',
        static: true,
        final: true,
        type: 'foam.lang.MethodInfo',
        initializer: initializerString,
        order: 0,
      });

      var info = cls.getField('classInfo_');
      if ( info ) info.addAxiom(cls.name + '.' + methodInfoName);

    },
    function isStatic() {
      return false;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractMethodJavaRefinement',
  refines: 'foam.lang.internal.InterfaceMethod',
  // flags: ['java'],

  methods: [
    function buildJavaClass(cls) {
      if ( ! this.javaSupport ) return;
//      if ( ! this.javaCode && ! this.abstract ) return;

      cls.interfaceMethod({
        name:          this.name,
        type:          this.javaType || 'void',
        visibility:    this.visibility,
        remote:        this.remote,
        throws:        this.javaThrows,
        documentation: this.documentation,
        body:          this.javaCode || '',
        args:          this.args && this.args.map(function(a) {
          return {
            name: a.name,
            type: a.javaType
          };
        })
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'MessageJavaRefinement',
  refines: 'foam.i18n.MessageAxiom',
  // flags: ['java'],

  methods: [
    function buildJavaClass(cls) {
      if ( this.flags && this.flags.length && ! foam.checkForFlag(this.flags, 'java') ) return;
      cls.constant({
        name: this.name,
        type: 'String',
        documentation: this.documentation,
        value: foam.java.asJavaValue(this.message)
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ConstantJavaRefinement',
  refines: 'foam.lang.Constant',
  // flags: ['java'],

  properties: [
    {
      name: 'javaValue',
      expression: function(value) {
        return foam.java.asJavaValue(value);
      }
    },
    { class: 'foam.java.JavaType' } // JavaType defines 'name' and other properties
  ],

  methods: [
    function buildJavaClass(cls) {
      if ( this.flags && this.flags.length && ! foam.checkForFlag(this.flags, 'java') ) return;

      if ( ! this.javaType ) {
        this.__context__.warn('Skipping constant ', this.name, ' with unknown type.');
        return;
      }

      cls.constant({
        name: this.name,
        type: this.javaType,
        value: this.javaValue,
        documentation: this.documentation
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'MethodJavaRefinement',
  refines: 'foam.lang.Method',
  // flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'abstract',
      value: false
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ProxiedMethodJavaRefinement',
  refines: 'foam.lang.ProxiedMethod',
  // flags: ['java'],

  properties: [
    {
      name: 'javaCode',
      getter: function() {
        // TODO: This could be an expression if the copyFrom in createChildMethod
        // didn't finalize its value
        var code = '';

        if ( this.javaType && this.javaType !== 'void' ) {
          code += 'return ';
        }

        var isContextOriented = this.args.length && this.args[0].name === 'x' && this.args[0].type === 'Context';

        code += 'get' + foam.String.capitalize(this.property);
        if ( isContextOriented ) {
          code += '(x)';
        } else {
          code += '()';
        }
        code += '.' + this.name + '(';

        for ( var i = 0 ; this.args && i < this.args.length ; i++ ) {
          code += this.args[i].name;
          if ( i != this.args.length - 1 ) code += ', ';
        }
        code += ');';

        return code;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ImportJavaRefinement',
  refines: 'foam.lang.Import',
  // flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' } // JavaType defines 'name' and other properties
  ],

  methods: [
    function buildJavaClass(cls) {
      if ( this.javaType == 'null' ) return;
      cls.method({
        type: this.javaType,
        name: 'get' + foam.String.capitalize(this.name),
        forceJavaOutputter: true,
        body: `return (${this.javaType})getX().get("${this.key}");`,
        visibility: 'protected'
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FObjectJavaRefinement',
  refines: 'foam.lang.FObject',
  // flags: ['java'],
  methods: [
    {
      name: 'asJavaValue',
      code: function() {
        var self = this;
        var props = self.cls_.getAxiomsByClass(foam.lang.Property)
          .filter(function(a) {
            return self.hasOwnProperty(a.name);
          })
          .map(function(p) {
            return `.set${foam.String.capitalize(p.name)}(${foam.java.asJavaValue(self[p.name], p)})`
          })
        return `
new ${self.cls_.id}.Builder(foam.lang.EmptyX.instance())
  ${props.join('\n')}
  .build()
        `
      },
    },
    {
      name: 'toString',
      type: 'String',
      code: foam.lang.FObject.prototype.toString
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractEnumJavaRefinement',
  refines: 'foam.lang.AbstractEnum',
  // flags: ['java'],
  methods: [
    {
      name: 'asJavaValue',
      code: function() {
        var self = this;
        return `${self.cls_.id}.${self.name}`
      },
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractInterfaceJavaRefinement',
  refines: 'foam.lang.AbstractInterface',
  // flags: ['java'],
  axioms: [
    {
      installInClass: function(cls) {
        cls.buildJavaClass = function(cls) {
          cls = cls || foam.java.Interface.create();

          cls.name          = this.model_.name;
          cls.package       = this.model_.package;
          cls.documentation = this.model_.documentation;
          cls.implements    = (this.implements || [])
            .concat(this.model_.javaExtends || []);

          var axioms = this.getAxioms().filter(foam.util.flagFilter(['java']));

          for ( var i = 0 ; i < axioms.length ; i++ ) {
            axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls);
          }

          return cls;
        };
      }
    }
  ]
});



foam.CLASS({
  package: 'foam.java',
  name: 'JavaCompareImplementor',
  // flags: ['java'],

  properties: [
    ['javaCompare', ''],
    ['javaComparePropertyToObject', ''],
    ['javaComparePropertyToValue', '']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'IntJavaRefinement',
  refines: 'foam.lang.Int',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',     'int'],
    ['javaInfoType', 'foam.lang.AbstractIntPropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ByteJavaRefinement',
  refines: 'foam.lang.Byte',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',       'byte'],
    ['javaInfoType',   'foam.lang.AbstractBytePropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ShortJavaRefinement',
  refines: 'foam.lang.Short',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',       'short'],
    ['javaInfoType',   'foam.lang.AbstractShortPropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'LongJavaRefinement',
  refines: 'foam.lang.Long',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',     'long'],
    ['javaInfoType', 'foam.lang.AbstractLongPropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DoubleJavaRefinement',
  refines: 'foam.lang.Double',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',     'double'],
    ['javaInfoType', 'foam.lang.AbstractDoublePropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FloatJavaRefinement',
  refines: 'foam.lang.Float',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaType',     'float'],
    ['javaInfoType', 'foam.lang.AbstractFloatPropertyInfo']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'EnumJavaRefinement',
  refines: 'foam.lang.Enum',
  // flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' }, // JavaType defines 'name' and other properties
    [ 'javaInfoType',   'foam.lang.AbstractEnumPropertyInfo' ],
    [ 'javaJSONParser', 'parser__' ], // parser__ defined in AbstractEnumPropertyInfo
    [ 'javaCSVParser',  'parser__' ]
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      info.method({
        name: 'getOrdinal',
        visibility: 'public',
        type: 'int',
        args: [
          {
            name: 'o',
            type: 'Object'
          }
        ],
        body: `return ((${this.of.id}) o).getOrdinal();`
      });

      info.method({
        name: 'forOrdinal',
        visibility: 'public',
        type: this.of.id,
        args: [
          {
            name: 'ordinal',
            type: 'int'
          }
        ],
        body: `return ${this.of.id}.forOrdinal(ordinal);`
      });

      info.method({
        name: 'toJSON',
        visibility: 'public',
        type: 'void',
        // args: 'foam.lib.json.Outputter outputter, Object value',
        args: [
          { type: 'foam.lib.json.Outputter', name: 'outputter' },
          { type: 'Object',                  name: 'value' }
        ],
        body: `outputter.output(getOrdinal(value));`
      });

      var cast = info.getMethod('cast');
      cast.body = `if ( o instanceof Integer ) return forOrdinal((int) o);
  if ( o instanceof String ) return Enum.valueOf(${this.of.id}.class, (String) o);
  return (${this.of.id})o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractEnumJavaRefinement',
  refines: 'foam.lang.AbstractEnum',
  // flags: ['java'],

  axioms: [
    {
      installInClass: function(cls) {
        cls.buildJavaClass = function(cls) {
          cls = cls || foam.java.Enum.create();

          cls.name       = this.name;
          cls.package    = this.package;
          cls.extends    = this.extends;
          cls.values     = this.VALUES;
          cls.implements = [ 'foam.lang.FEnum' ];

          // TODO: needed for now because Enums don't extend FObject
          // but a better solution would be to remove setters from
          // Enums and not call asserNotFrozen in first place. KGR
          cls.method({
            name: 'assertNotFrozen',
            visibility: 'public',
            type: 'void',
            body: `/* nop */`
          });

          var flagFilter = foam.util.flagFilter(['java']);
          var axioms = this.getAxioms().filter(flagFilter);
          for ( var i = 0 ; i < axioms.length ; i++ ) {
            axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls);
          }

          var properties = this.getAxiomsByClass(foam.lang.Property)
            .filter(flagFilter)
            .filter(p => p.generateJava && p.javaInfoType);

          cls.method({
            name: cls.name,
            args: properties.map(function(p) {
              return {
                name: p.name,
                type: p.javaType
              };
            }),
            body: properties.map(function(p) {
              return `set${foam.String.capitalize(p.name)}(${p.name});`;
            }).join('\n')
          });

          this.VALUES.sort( function (a, b) {
            return (a.ordinal < b.ordinal)
              ? -1
              : 1;
          });

          cls.declarations = this.VALUES.map(function(v) {
            return `${v.name}(${properties.map(p => foam.java.asJavaValue(v[p.name])).join(', ')})`;
          }).join(',\n  ');

          cls.method({
            name: 'labels',
            type: 'String[]',
            visibility: 'public',
            static: true,
            body: `
return new String[] {
  ${this.VALUES.map(v => foam.java.asJavaValue(v.label)).join(', ')}
};
            `
          });

          cls.method({
            name: 'forOrdinal',
            type: cls.name,
            visibility: 'public',
            static: true,
            args: [ { name: 'ordinal', type: 'int' } ],
            body: `return switch (ordinal) {
${this.VALUES.map(v => `\tcase ${v.ordinal} -> ${cls.name}.${v.name};`).join('\n')}
  default -> null;
};`
          });

          var nameLabel = function(v) {
            return v.label === v.name ? `"${v.name}"` : `"${v.name}", "${v.label}"`;
          };

          cls.method({
            name: 'forLabel',
            type: cls.name,
            visibility: 'public',
            static: true,
            args: [ { name: 'label', type: 'String' } ],
            body: `return switch (label) {
${this.VALUES.map(v => `\tcase ${nameLabel(v)} -> ${cls.name}.${v.name};`).join('\n')}
  default -> null;
};`
          });

          return cls;
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DateTimeJavaRefinement',
  refines: 'foam.lang.DateTime',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaInfoType',    'foam.lang.AbstractDatePropertyInfo'],
    ['javaJSONParser',  'foam.lib.json.DateParser.instance()'],
    ['sqlType',         'TIMESTAMP WITHOUT TIME ZONE'],
    ['javaAdapt',       '']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var m = info.getMethod('cast');
      m.body = `
        try {
          if ( o instanceof Number ) {
            return new java.util.Date(((Number) o).longValue());
          }
          if ( o instanceof String ) {
            return (java.util.Date) fromString((String) o);
          }
          return (java.util.Date) o;
        } catch ( Throwable t ) {
          throw new RuntimeException(t);
        }`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DateJavaRefinement',
  refines: 'foam.lang.Date',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaInfoType',    'foam.lang.AbstractDatePropertyInfo'],
    ['javaJSONParser',  'foam.lib.json.DateParser.instance()'],
    ['sqlType',         'DATE'],
    ['javaAdapt',
     `
      // convert the Date to be noon in GMT
      val = new java.util.Date(val.getTime() / 86400000l * 86400000l + 43200000l);
     `
    ]
  ],

   methods: [
     function createJavaPropertyInfo_(cls) {
       var info = this.SUPER(cls);
       // TODO: cast isn't called on setter
       var m = info.getMethod('cast');
       m.body = `
         return foam.util.DateUtil.adapt(o);
       `;

       return info;
     }
   ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'MapJavaRefinement',
  refines: 'foam.lang.Map',
  // flags: ['java'],

  properties: [
    ['javaType',       'java.util.Map'],
    ['javaInfoType',   'foam.lang.AbstractMapPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.MapParser.instance()'],
    ['javaFactory',    'return new java.util.HashMap();'],
    ['javaCompare',    '']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var getValueClass = info.getMethod('getValueClass');
      getValueClass.body = 'return java.util.Map.class;';

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ListJavaRefinement',
  refines: 'foam.lang.List',
  // flags: ['java'],

  properties: [
    ['javaType',       'java.util.List'],
    ['javaInfoType',   'foam.lang.AbstractListPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.ListParser.instance()'],
    ['javaFactory',    'return new java.util.ArrayList();'],
    ['javaCompare',    '']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var getValueClass  = info.getMethod('getValueClass');
      getValueClass.body = 'return java.util.List.class;';

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'StringJavaRefinement',
  refines: 'foam.lang.String',
  // flags: ['java'],
  mixins: [ 'foam.java.JavaCompareImplementor' ],

  properties: [
    ['javaInfoType',    'foam.lang.AbstractStringPropertyInfo'],
    {
      name: 'javaAdapt',
      expression: function(trim) {
        return trim ? `val = foam.util.SafetyUtil.trim(val);\n` : '';
      }
    },
    // Breaks parsing for some reason, but probably doesn't help much
    // because the default is AnyParser which first list NullParser then StringParser
    // ['javaJSONParser',  'foam.lib.json.StringParser.instance()'],
    {
      name: 'sqlType',
      expression: function(width) {
        return 'VARCHAR(' + width + ')';
      }
    }
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      if ( this.value != '' ) {
        info.method({
          name: 'isDefaultValue',
          visibility: 'public',
          args: [
            { name: 'o', type: 'Object'}
          ],
          type: 'boolean',
          body: `return foam.util.SafetyUtil.compare(get_(o), ${this.javaValue}) == 0;`
        });
      }

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FormattedStringJavaRefinement',
  refines: 'foam.lang.FormattedString',
  // flags: ['java'],
  documentation: `
    Override setter for formattedstrings so that we only store the unformatted data
    and generate method to return a formatted version of the data
  `,

  properties: [
    {
      name: 'javaSetter',
      factory: function() {
        return `
          assertNotFrozen();
          ${this.formatter.buildJavaRemoveFormatting(this.name)}
          ${this.name}_ = val;
          ${this.name}IsSet_ = true;`;
      }
    }
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      info.method({
        name: 'getFormatted',
        visibility: 'public',
        type: 'String',
        args: [
          { name: 'o', type: 'Object'}
        ],
        documentation: 'Returns a formatted version of this property',
        body: this.formatter.buildJavaGetFormatted(cls.name, this.name)
      });
      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FObjectPropertyJavaRefinement',
  refines: 'foam.lang.FObjectProperty',
  // flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.lang.AbstractFObjectPropertyInfo'],
    ['javaCompare',  ''],
    {
      name: 'javaJSONParser',
      expression: function(of) {
        // TODO: add caching
        return 'new foam.lib.parse.Alt(foam.lib.json.PropertyReferenceParser.instance(), foam.lib.json.FObjectParser.create('
          + (of ? of.id + '.class' : '') + ')/*, foam.lib.json.UnknownFObjectParser.instance()*/)';
      }
    },
    {
      name: 'javaFromCSVLabelMapping',
      value: `
        foam.lang.AbstractFObjectPropertyInfo prop = this;

        java.util.Map<String, foam.lib.csv.FromCSVSetter> map2 = new java.util.HashMap<>();
        prop.of().getAxiomsByClass(foam.lang.PropertyInfo.class).forEach(a -> {
          foam.lang.PropertyInfo p = (foam.lang.PropertyInfo) a;
          p.fromCSVLabelMapping(map2);
        });

        for ( java.util.Map.Entry<String, foam.lib.csv.FromCSVSetter> entry : map2.entrySet() ) {
          map.put(getName() + "." + entry.getKey(), new foam.lib.csv.FromCSVSetter() {
            public void set(foam.lang.FObject obj, String str) {
              try {
                if ( prop.get(obj) == null ) prop.set(obj, prop.of().newInstance());
                entry.getValue().set((foam.lang.FObject) prop.get(obj), str);
              } catch ( Throwable t ) {
                t.printStackTrace(); // cannot use logging from logging.
              }
            }
          });
        }
      `
    }
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      if ( this.of &&
           this.of !== foam.lang.FObject &&
           ! foam.lang.InterfaceModel.isInstance(this.of.model_) ) {
        info.method({
          name: 'of',
          visibility: 'public',
          type: 'foam.lang.ClassInfo',
          body: `return ${this.of.id}.getOwnClassInfo();`
        });
      }
      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'StringArrayJavaRefinement',
  refines: 'foam.lang.StringArray',
  // flags: ['java'],

  properties: [
    ['javaType',       'String[]'],
    ['javaInfoType',   'foam.lang.AbstractArrayPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.StringArrayParser.instance()'],
    ['javaFactory',    'return new String[0];'],
    {
      name: 'javaValue',
      expression: function(value) {
        if ( ! value ) {
          return null;
        }

        return 'new String[] {\"' + value.join('\",\"') + '\"}';
      }
    }
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      var cast = info.getMethod('cast');
      cast.body = 'Object[] value = (Object[])o;\n'
                + this.javaType
                + ' ret = new String[value == null ? 0 : value.length];\n'
                + 'if ( value != null ) System.arraycopy(value, 0, ret, 0, value.length);\n'
                + 'return ret;';

      // TODO: figure out what this is used for
      info.method({
        name: 'of',
        visibility: 'public',
        type: 'String',
        body: 'return "String";'
      });

      var isDefaultValue = info.getMethod('isDefaultValue');

      isDefaultValue.body = 'return java.util.Arrays.equals(get_(o), null);';

      return info;
    }
  ],

  templates: [
    {
        name: 'compareTemplate',
        template: `
<%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = foam.util.SafetyUtil.compare(values1[i], values2[i]);
  if ( result != 0 ) return result;
}
return 0;
    `
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ArrayJavaRefinement',
  refines: 'foam.lang.Array',
  // flags: ['java'],

  properties: [
    {
      name: 'javaType',
      expression: function(type) {
        return type ? foam.java.toJavaType(type) : 'Object[]'
      }
    },
    ['javaInfoType',   'foam.lang.AbstractArrayPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.ArrayParser.instance()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info     = this.SUPER(cls);
      var compare  = info.getMethod('compare');
      compare.body = this.compareTemplate();

      // TODO: Change to ClassInfo return type once primitive support is added
      info.method({
        name: 'of',
        visibility: 'public',
        type: 'String',
        body: 'return "' + (this.of ? this.of.id ? this.of.id : this.of : null) + '";'
      });

      if ( this.javaType != 'byte[]' && this.javaType != 'Object[]' )
        info.getMethod('cast').body = 'Object[] a = (Object[]) o; return java.util.Arrays.copyOf(a, a.length, ' + this.javaType + '.class);';

      // TODO: **********************************************************
      // add 'if' to avoid breaking build, but check why, KGR
      var isDefaultValue = info.getMethod('isDefaultValue');
      if ( isDefaultValue ) isDefaultValue.body = 'return java.util.Arrays.equals(get_(o), null);';

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: `
<%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = ((Comparable)values1[i]).compareTo(values2[i]);
  if ( result != 0 ) return result;
}
return 0;
`
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FObjectArrayJavaRefinement',
  refines: 'foam.lang.FObjectArray',
  // flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' }, // JavaType defines 'name' and other properties
    {
      name: 'javaFactory',
      expression: function(type) {
        return `return new ${foam.lang.type.toType(type).type.toJavaType()}[0];`;
      }
    },
    {
      name: 'javaJSONParser',
      expression: function(of) {
        var id = of ? of.id ? of.id : of : null;
        return 'foam.lib.json.FObjectArrayParser.create('
          + ( id ? id + '.class' : '') + ')';
      }
    },
    ['javaInfoType', 'foam.lang.AbstractFObjectArrayPropertyInfo']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      var cast = info.getMethod('cast');
      cast.body = 'Object[] value = (Object[])o;\n'
                + this.javaType + ' ret = new '
                + this.of + '[value == null ? 0 : value.length];\n'
                + 'if ( value != null ) System.arraycopy(value, 0, ret, 0, value.length);\n'
                + 'return ret;';

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: `
<%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = ((Comparable)values1[i]).compareTo(values2[i]);
  if ( result != 0 ) return result;
}
return 0;
`
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ArrayList',
  extends: 'foam.lang.Array',
  //// flags: ['java'],
  properties: [
    ['javaType', 'ArrayList'],
    ['javaInfoType', 'foam.lang.AbstractPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.ArrayParser.instance()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: `
  <%= this.javaType %> values1 = get_(o1);
  <%= this.javaType %> values2 = get_(o2);

  if ( values1.size() > values2.size() ) return 1;
  if ( values1.size() < values2.size() ) return -1;

  int result;
  for ( int i = 0 ; i < values1.size() ; i++ ) {
    result = ((Comparable)values1.get(i)).compareTo(values2.get(i));
    if ( result != 0 ) return result;
  }
  return 0;
    `
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'BooleanJavaRefinement',
  refines: 'foam.lang.Boolean',
//  // flags: ['java'],
  properties: [
    ['javaType',       'boolean'],
    ['javaInfoType',   'foam.lang.AbstractBooleanPropertyInfo'],
    ['javaCompare',    ''],
    ['javaJSONParser',  'foam.lib.json.BooleanParser.instance()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      if ( this.value ) {
        info.method({
          name: 'isDefaultValue',
          visibility: 'public',
          args: [
            { name: 'o', type: 'Object'}
          ],
          type: 'boolean',
          body: `return get_(o);`
        });
      }

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ObjectJavaRefinement',
  refines: 'foam.lang.Object',
 // // flags: ['java'],
  properties: [
    ['javaInfoType',    'foam.lang.AbstractObjectPropertyInfo'],
    ['javaCompare',    '']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ClassJavaRefinement',
  refines: 'foam.lang.Class',
//  // flags: ['java'],
  properties: [
    ['javaType',       'foam.lang.ClassInfo'],
    ['javaInfoType',   'foam.lang.AbstractClassPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.ClassReferenceParser.instance()']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ProxyJavaRefinement',
  refines: 'foam.lang.Proxy',
  // flags: ['java'],
  properties: [
    {
      name: 'javaType',
      expression: function(of) {
        return of ? of : 'Object';
      }
    },
    ['javaInfoType', 'foam.lang.AbstractFObjectPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.FObjectParser.instance()']
  ],

  methods: [
    function buildJavaClass(cls) {
      this.SUPER(cls);
      cls.method({
        name: `get${foam.String.capitalize(this.name)}`,
        visibility: 'public',
        type: this.javaType,
        args: [ { name: 'x', type: 'foam.lang.X' } ],
        body: `return get${foam.String.capitalize(this.name)}();`
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ReferenceJavaRefinement',
  refines: 'foam.lang.Reference',
  flags: [ 'java' ],

  properties: [
    {
      name: 'referencedProperty',
      documentation: `
        Used to ensure we use the right types for this
        value in statically typed languages.
      `,
      transient: true,
      expression: function(of) {
        return of.ID.cls_ == foam.lang.IDAlias ? of.ID.targetProperty : of.ID;
      }
    },
    { name: 'type',            factory: function() { return this.referencedProperty.type; } },
    { name: 'javaType',        factory: function() { return this.referencedProperty.javaType; } },
    { name: 'javaJSONParser',  factory: function() { return this.referencedProperty.javaJSONParser; } },
    { name: 'javaQueryParser', factory: function() { return this.referencedProperty.javaQueryParser; } },
    { name: 'javaInfoType',    factory: function() { return this.referencedProperty.javaInfoType; } }
  ],

  methods: [
    function buildJavaClass(cls) {
      this.SUPER(cls);
      cls.method({
        name: `find${foam.String.capitalize(this.name)}`,
        visibility: 'public',
        type: this.of.id,
        args: [ { name: 'x', type: 'foam.lang.X' } ],
        body: `return (${this.of.id})((foam.dao.DAO) x.get("${this.unauthorizedTargetDAOKey || this.targetDAOKey}")).find_(x, (Object) get${foam.String.capitalize(this.name)}());`
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MultitonJavaRefinement',
  refines: 'foam.pattern.Multiton',
//  // flags: ['java'],

  properties: [
    {
      name: 'javaName',
      value: 'Multiton',
    },
    {
      name: 'javaInfoName',
      expression: function(javaName) {
        return foam.String.constantize(this.javaName);
      },
    },
  ],

  methods: [
    function buildJavaClass(cls) {
      var info = cls.getField('classInfo_');
      if ( info ) info.addAxiom(cls.name + '.' + this.javaInfoName);

      cls.field({
        name: this.javaInfoName,
        visibility: 'public',
        static: true,
        final: true,
        type: 'foam.lang.MultitonInfo',
        initializer: `
new foam.lang.MultitonInfo("${this.javaName}", ${cls.name}.${foam.String.constantize(this.property)});
        `,
        order: 1,
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'IDAliasJavaRefinement',
  refines: 'foam.lang.IDAlias',
  // flags: ['java'],
  properties: [
    { name: 'type',            factory: function() { return this.targetProperty.type; } },
    { name: 'javaType',        factory: function() { return this.targetProperty.javaType; } },
    { name: 'javaJSONParser',  factory: function() { return this.targetProperty.javaJSONParser; } },
    { name: 'javaQueryParser', factory: function() { return this.targetProperty.javaQueryParser; } },
    { name: 'javaInfoType',    factory: function() { return this.targetProperty.javaInfoType; } },
    {
      name: 'javaGetter',
      factory: function() {
        return `return get${foam.String.capitalize(this.propName)}();`;
      }
    },
    {
      name: 'javaSetter',
      factory: function() {
        return `set${foam.String.capitalize(this.targetProperty.name)}((${this.targetProperty.javaType})val);`;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MultiPartIDJavaRefinement',
  refines: 'foam.lang.MultiPartID',
  // flags: ['java'],

  properties: [
    ['javaJSONParser', 'foam.lib.json.ExprParser.instance()'],
    {
      name: 'javaGetter',
      factory: function() {
        var str = `return new ${this.of.id}.Builder(getX()).
`;
        for ( var i = 0 ; i < this.propNames.length ; i++ ) {
          var name = foam.String.capitalize(this.propNames[i]);

          str += `  set${name}(get${name}()).
`;
        }

        return str += '  build();';
      }
    },
    {
      name: 'javaSetter',
      factory: function() {
        var str = '';

        for ( var i = 0 ; i < this.propNames.length ; i++ ) {
          var name = foam.String.capitalize(this.propNames[i]);

          str += `set${name}(val.get${name}());
`;
        }

        return str;
      }
    },
    {
      name: 'toString',
      factory: function() {
        var arr = [];
        for ( var i = 0 ; i < this.propNames.length ; i++ ) {
          var name = foam.String.capitalize(this.propNames[i]);

          arr.push(`val.get${name}())`);
        }
        return 'return ' + arr.join(' + "-" + ') + ';';
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ModelJavaRefinement',
  refines: 'foam.lang.Model',
  // flags: ['java'],

  properties: [
     {
      class: 'Boolean',
      name: 'javaGenerateDefaultConstructor',
      value: true
    },
    {
      class: 'Boolean',
      name: 'javaGenerateConvenienceConstructor',
      value: true
    },
    {
      class: 'AxiomArray',
      of: 'foam.java.JavaImport',
      name: 'javaImports',
      adaptArrayElement: function(o) {
        return typeof o === 'string' ?
          foam.java.JavaImport.create({import: o}) :
          foam.java.JavaImport.create(o);
      }
    },
    {
      class: 'String',
      name: 'javaName',
      factory: function() { return this.id; }
    },
    {
      class: 'AxiomArray',
      of: 'foam.java.JavaImplements',
      name: 'javaImplements',
      adaptArrayElement: function(o) {
        return foam.String.isInstance(o) ?
          foam.java.JavaImplements.create({ name: o }) :
          foam.java.JavaImplements.create(o);
      }
    },
    {
      name: 'fs_',
      factory: function() { return require('fs'); }
    },
    {
      name: 'sep',
      factory: function() { return require('path').sep; }
    }
  ],

  methods: [
    function ensurePath(p) {
      var i     = 1 ;
      var parts = p.split(this.sep);
      var path  = parts[0] === '' ? this.sep : parts[0];

      while ( i < parts.length ) {
        try {
          var stat = this.fs_.statSync(path);
          if ( ! stat.isDirectory() ) throw path + 'is not a directory';
        } catch(e) {
          this.fs_.mkdirSync(path);
        }

        path += this.sep + parts[i++];
      }
    },

    function writeFileIfUpdated(X, outfile, javaSource) {
      // console.log('[GENJAVA] Updating ', outfile, this.fs_.existsSync(outfile));
      X.javaFiles.push(outfile);

      if ( ! this.fs_.existsSync(outfile) || this.fs_.readFileSync(outfile).toString() !== javaSource ) {
        // console.log('[GENJAVA] Updating ', outfile);
        var of = outfile.substring(outfile.lastIndexOf('/'));

        // Uncomment next two lines if you would like to do a diff to see where a file changed.
        // this.fs_.writeFileSync("/tmp/" + of + ".old", javaSource);
        // this.fs_.writeFileSync("/tmp/" + of + ".new", this.fs_.readFileSync(outfile).toString());

        this.fs_.writeFileSync(outfile, javaSource);
      }
    },

    function outputJavaClass(X, outdir, javaClass) {
      var outfile = outdir + this.sep + javaClass.id.replace(/\./g, this.sep) + '.java';
      this.ensurePath(outfile);
      this.writeFileIfUpdated(X, outfile, javaClass.toJavaSource());
    },

    function targetJava(X) {
      var desired = 'java';
      if ( foam.flags && foam.flags.test ) desired += "|java&test";
      if ( ! this.flags || ! foam.checkForFlag(this.flags, desired) )
        return false;

      var cls = foam.lookup(this.id);
      this.outputJavaClass(X, X.outdir, cls.buildJavaClass());
      return true;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'InterfaceModelJavaRefinement',
  refines: 'foam.lang.InterfaceModel',

  methods: [
    function targetJava(X) {
      if ( ! this.SUPER(X) ) return;

      if ( this.skeleton )
        this.outputJavaClass(X, X.outdir, foam.java.Skeleton.create({of: this.id}).buildJavaClass());

      return true;
    }
  ]
});



foam.CLASS({
  package: 'foam.java',
  name: 'StubMethodJavaRefinement',
  refines: 'foam.lang.StubMethod',

  methods: [
    {
      name: 'buildJavaClass',
      flags: [ 'java' ],
      code: function buildJavaClass(cls) {
        if ( ! this.javaSupport ) return;

        var name = this.name;
        var args = this.args;
        var boxPropName = foam.String.capitalize(this.boxPropName);

        var code = `
var envelope = getX().create(foam.box.Envelope.class);
var rpc = getX().create(foam.box.RPCMessage.class);
rpc.setName("${name}");
Object[] args = { ${ args.map( a => a.name ).join(',') } };
rpc.setArgs(args);

envelope.setMessage(rpc);
var replyBox = getX().create(foam.box.RPCReturnBox.class);
envelope.setReplyBox(replyBox);
get${boxPropName}().send(envelope);
try {
  replyBox.getSemaphore().acquire();
} catch (Throwable t) {
  throw new RuntimeException(t);
}

Object result = replyBox.getEnvelope().getMessage();
`;

        if ( this.javaType && this.javaType !== 'void' ) {
          code += `if ( result instanceof foam.box.RPCReturnMessage )
  return (${this.javaType})((foam.box.RPCReturnMessage)result).getData();
`;
        }

        code += `if ( result instanceof java.lang.Throwable )
  throw new RuntimeException((java.lang.Throwable)result);

if ( result instanceof foam.box.RPCErrorMessage ) {
  foam.box.RPCErrorMessage error = (foam.box.RPCErrorMessage) result;
  if ( error.getData() != null ) {
    throw new RuntimeException(error.getData().toString());
  }
  throw new RuntimeException(error.getMessage());
}
`;

        if ( this.javaType && this.javaType !== 'void') {
          code += `throw new RuntimeException("Invalid response type: " + result.getClass());`;
        }

        this.javaCode = code;

        this.SUPER(cls);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ListenerJavaRefinement',
  refines: 'foam.lang.Listener',
  // flags: ['java'],
  properties: [
    {
      class: 'String',
      name: 'javaCode'
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( ! this.javaCode ) return;

      if ( ! this.isMerged && ! this.isFramed ) {
        cls.method({
          name: this.name,
          type: 'void',
          args: this.args && this.args.map(function(a) {
            return {
              name: a.name, type: a.javaType
            };
          }),
          body: this.javaCode
        });
        return;
      }

      cls.method({
        name: this.name + '_real_',
        type: 'void',
        visibility: 'protected',
        args: this.args && this.args.map(function(a) {
          return {
            name: a.name, type: a.javaType
          };
        }),
        body: this.javaCode
      });

      cls.method({
        name: this.name,
        type: 'void',
          args: this.args && this.args.map(function(a) {
            return {
              name: a.name, type: a.javaType
            };
          }),
        body: `${this.name + 'Listener_'}.fire(new Object[] { ${ this.args.map(function(a) {
          return a.name;
        }).join(', ') } });`
      });

      var listener = foam.java.Field.create({
        name: this.name + 'Listener_',
        visibility: 'protected',
        type: 'foam.lang.MergedListener',
        initializer: foam.java.Class.create({
          anonymous: true,
          extends: 'foam.lang.MergedListener',
          methods: [
            foam.java.Method.create({
              name: 'getDelay',
              type: 'int',
              visibility: 'public',
              body: `return ${this.isFramed ? 16 : this.mergeDelay};`
            }),
            foam.java.Method.create({
              name: 'go',
              type: 'void',
              visibility: 'public',
              args: [foam.java.Argument.create({ type: 'Object[]', name: 'args' })],
              body: `${this.name + '_real_'}(${ this.args && this.args.map(function(a, i) {
                return '(' + a.javaType + ')args[' + i + ']';
              }).join(', ') });`
            })
          ]
        })
      });

      cls.fields.push(listener);
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'RequiresJavaRefinement',
  refines: 'foam.lang.Requires',
  // flags: ['java'],
  properties: [
    {
      name: 'javaPath',
      expression: function(path) {
        return path;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FunctionJavaRefinement',
  refines: 'foam.lang.Function',
  // flags: ['java'],
  properties: [
    ['javaType', 'java.util.function.Function']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'PromisedMethodRefinement',
  refines: 'foam.lang.PromisedMethod',
  // flags: ['java'],
  properties: [
    {
      name: 'javaCode',
      getter: function() {
        return `
          try {
            synchronized ( getDelegate() ) {
              while ( ! getDelegate().isPropertySet("${this.property}") ) getDelegate().wait();
            }
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
          ${this.javaType != 'void' ? 'return ' : ''}getDelegate()
              .${this.name}(${this.args.map(a => a.name).join(', ')});
        `;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'PromisedRefinement',
  refines: 'foam.lang.Promised',
  // flags: ['java'],
  properties: [
    ['javaInfoType', 'foam.lang.AbstractFObjectPropertyInfo'],
    {
      name: 'javaType',
      expression: function(of) { return of; }
    },
    {
      name: 'javaPostSet',
      expression: function(name, stateName) {
        return `
set${foam.String.capitalize(stateName)}(val);
try {
  synchronized ( this ) {
    this.notifyAll();
  }
} catch (Exception e) {
  throw new RuntimeException(e);
}
        `;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DAOPropertyJavaRefinement',
  refines: 'foam.dao.DAOProperty',
  // flags: ['java'],
  properties: [
    [ 'javaCompare',       '' ],
    [ 'javaCloneProperty', 'set(dest, get(source));' ]
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'TemplateAxiomJavaRefinement',
  refines: 'foam.templates.TemplateAxiom',
  // flags: ['java'],

  requires: [
    'foam.parse.Grammar',
    'foam.templates.TemplateUtil'
  ],

  methods: [

    function buildJavaClass(cls) {
      if ( ! this.javaSupport ) return;

    var result = this.TemplateUtil.create().compileJava(this.template, this.name, this.args || []);
      var args = [{ type: 'java.lang.StringBuilder', name: 'builder' }];
      args.push()
      this.args.forEach(a => args.push({type: a.type, name: a.name}));
      cls.method({
        name: 'build' + this.name.charAt(0).toUpperCase() + this.name.slice(1),
        type: 'void',
        args: args,
        body: `
          ${result};
        `
      });
      return;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'JavaCode',

  documentation: `
    Axiom for adding java code to a model.
    The supplied code will be added to the generated .java code generated for the model.
  `,

  properties: [
    'name',
    'code'
  ],

  methods: [
    function buildJavaClass(cls) {
      cls.extras.push(foam.java.Code.create({data: this.code}));
    }
  ]
});


foam.CLASS({
  refines: 'foam.lang.Model',
  package: 'foam.java',
  name: 'JavaCodeModelRefine',

  requires: [ 'foam.java.JavaCode' ],

  properties: [
    {
      class: 'String',
      name: 'javaCode',
      postSet: function(_, code) {
        this.axioms_.push(this.JavaCode.create({
          name: 'JavaCode_' + this.name,
          code: code
        }));
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'CurrencyCodeJavaRefinement',
  refines: 'foam.lang.CurrencyCode',
  extends: 'foam.lang.Reference',
  flags: [ 'java' ],

  properties: [
    {
      name: 'javaAdapt',
      value: `
        try {
          var numericCode = Long.parseLong(val);
          var curr = (foam.lang.Currency) ((foam.dao.DAO) getX().get("currencyDAO"))
            .find(foam.mlang.MLang.EQ(foam.lang.Currency.NUMERIC_CODE, val));
          if ( curr != null )
            val = curr.getId();
          else
            foam.core.logger.Loggers.logger(getX(), this).error("Cannot adapt CurrencyCode numeric value", val);
        } catch (NumberFormatException e) { /* assume string id */ }
      `
    }
  ]
});
