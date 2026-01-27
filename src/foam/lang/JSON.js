/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
// JSON Support
//
// TODO:
//   - don't output default classes
*/
foam.CLASS({
  package: 'foam.lang',
  name: 'PropertyToFromJSONRefinement',
  refines: 'foam.lang.Property',

  properties: [
    {
      name: 'fromJSON',
      value: function fromJSON(value, ctx, prop, json) {
        return foam.json.parse(value, null, ctx);
      }
    },
    {
      name: 'toJSON',
      value: function toJSON(value, outputter) { return value; }
    }
  ],

  methods: [
    function outputJSON(o) {
      if ( o.passPropertiesByReference ) {
        o.output({ class: '__Property__', forClass_: this.forClass_, name: this.name });
      } else {
        o.outputFObject_(this);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: '__Property__',

  axioms: [
    {
      name: 'create',
      installInClass: function(c) {
        var oldCreate = c.create;
        c.create = function(args, X) {
          var clsName = args.forClass_;
          var name = args.name;

          var cls = X.maybeLookup(clsName);

          // If we failed to find the class, try to deserialize the old format
          // where forClass_ contains the full path to the property: foo.bar.Pereson.lastName
          if ( ! cls ) {
            clsName = args.forClass_.substring(0, args.forClass_.lastIndexOf('.'));
            name = args.forClass_.substring(args.forClass_.lastIndexOf('.') + 1);

            cls = X.lookup(clsName);
          }

          if ( ! cls ) {
            console.error('Unknown class:', clsName);
          }
          var prop = cls.getAxiomByName(name);

          foam.assert(prop, 'Could not find property "', args.forClass_ + '.' + name, '"');

          return prop;
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: '__Class__',

  axioms: [
    {
      name: 'create',
      installInClass: function(cls) {
        cls.create = function(args, x) {
          return foam.maybeLookup(args.forClass_);
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: '__Timestamp__',
  axioms: [
    {
      name: 'create',
      installInClass: function(cls) {
        cls.create = function(args) {
          return new Date(args.value);
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'FObjectStringifyRefinement',
  refines: 'foam.lang.FObject',

  methods: [
    /**
      Output as a pretty-printed JSON-ish String.
      Use for debugging/testing purposes. If you want actual
      JSON output, use foam.json.* instead.
    */
    function stringify() {
      return foam.json.Pretty.stringify(this);
    }
  ]
});


/** JSON Outputter. **/
foam.CLASS({
  package: 'foam.json',
  name: 'Outputter',

  documentation: 'JSON Outputter.',

  properties: [
    {
      class: 'String',
      name: 'buf_',
      value: ''
    },
    {
      class: 'Boolean',
      name: 'pretty',
      value: true,
      postSet: function(_, p) {
        if ( p ) {
          this.clearProperty('indentStr');
          this.clearProperty('nlStr');
          this.clearProperty('postColonStr');
          this.clearProperty('useShortNames');
        } else {
          this.indentStr = this.nlStr = this.postColonStr = null;
        }
      }
    },
    {
      // TODO: rename to FON
      class: 'Boolean',
      name: 'strict',
      value: true,
      postSet: function(_, s) {
        if ( s ) {
          this.useShortNames            = false;
          this.formatDatesAsNumbers     = false;
          this.alwaysQuoteKeys          = true;
          this.formatFunctionsAsStrings = true;
        } else {
          this.alwaysQuoteKeys          = false;
          this.formatFunctionsAsStrings = false;
        }
      }
    },
    {
      class: 'Int',
      name: 'indentLevel_',
      value: 0
    },
    {
      class: 'String',
      name: 'indentStr',
      value: '\t'
    },
    {
      class: 'String',
      name: 'nlStr',
      value: '\n'
    },
    {
      class: 'String',
      name: 'postColonStr',
      value: ' '
    },
    {
      class: 'Boolean',
      name: 'useTemplateLiterals',
      help: 'If true, multiline strings will be outputted using template literals (i.e. surrounded by backticks)',
      value: false,
    },
    {
      class: 'Boolean',
      name: 'alwaysQuoteKeys',
      help: 'If true, keys are always quoted, as required by the JSON standard. If false, only quote keys which aren\'tvalid JS identifiers.',
      value: true
    },
    {
      class: 'Boolean',
      name: 'passPropertiesByReference',
      help: 'If true, Property objects are passed as __Property__ references rather than by value.',
      value: true
    },
    {
      class: 'Boolean',
      name: 'formatDatesAsNumbers',
      value: false
    },
    {
      class: 'Boolean',
      name: 'formatFunctionsAsStrings',
      value: true
    },
    {
      class: 'Boolean',
      name: 'outputDefaultValues',
      value: true
    },
    {
      class: 'Boolean',
      name: 'outputOwnPropertiesOnly',
      documentation: 'If true expressions are not stored.',
      value: true
    },
    {
      class: 'Boolean',
      name: 'outputClassNames',
      value: true
    },
    {
      class: 'String',
      name: 'defaultPackage',
      //value: 'foam.lang.'
    },
    {
      class: 'Function',
      name: 'propertyPredicate',
      value: function(o, p) { return ! p.transient; }
    },
    {
      class: 'Function',
      name: 'objectKeyValuePredicate',
      documentation: 'Called before outputting a key/value. Outputs if true.',
      value: function(k, v) { return true; }
    },
    {
      class: 'Boolean',
      name: 'useShortNames',
      value: false
    },
    {
      class: 'Boolean',
      name: 'sortObjectKeys',
      value: false
    },
    {
      class: 'Boolean',
      name: 'convertUnserializableToStubs',
      value: false
    }
    /*
    {
      class: 'Boolean',
      name: 'functionFormat',
      value: false
    },
    */
  ],

  methods: [
    function reset() {
      this.indentLevel_ = 0;
      this.buf_ = '';
      return this;
    },

    function escape(str) {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\x00-\x1f]/g, function(c) {
          return "\\u00" + ((c.charCodeAt(0) < 0x10) ?
            '0' + c.charCodeAt(0).toString(16) :
            c.charCodeAt(0).toString(16));
        });
    },

    function maybeEscapeKey(str) {
      return this.alwaysQuoteKeys || ! /^[a-zA-Z\$_][0-9a-zA-Z$_]*$/.test(str) ?
        '"' + str + '"' :
        str ;
    },

    function out() {
      for ( var i = 0 ; i < arguments.length ; i++ ) this.buf_ += arguments[i];
      return this;
    },

    /**
      Start a block, using the supplied start character, which would typically
      be '{' for objects or '[' for arrays.  Handles indentation if enabled.
    */
    function start(c) {
      if ( c ) this.out(c).nl();
      if ( this.indentStr ) {
        this.indentLevel_++;
        this.indent();
      }
      return this;
    },

    /**
      End a block, using the supplied end character, which would typically
      be '}' for objects or ']' for arrays.
    */
    function end(c) {
      if ( this.indent ) this.indentLevel_--;
      if ( c ) this.nl().indent().out(c);
      return this;
    },

    function nl() {
      if ( this.nlStr && this.nlStr.length ) this.out(this.nlStr);
      return this;
    },

    function indent() {
      for ( var i = 0 ; i < this.indentLevel_ ; i++ ) this.out(this.indentStr);
      return this;
    },

    function outputPropertyName(p) {
    //  console.log('********** Property:', p.name);
      this.out(this.maybeEscapeKey(this.useShortNames && p.shortName ? p.shortName : p.name));
      return this;
    },

    function outputProperty(o, p, includeComma) {
      if ( ! this.propertyPredicate(o, p) ) return false;
      if ( ! this.outputDefaultValues && p.isDefaultValue(o[p.name]) )
        return false;

      if ( this.outputOwnPropertiesOnly && ! o.hasOwnProperty(p.name) )
        return false;

      var v = o[p.name];

      if ( includeComma ) this.out(',');

      this.nl().indent().outputPropertyName(p).out(':', this.postColonStr);

      this.output(p.toJSON(v, this), p.of);

      return true;
    },

    function outputString(str) {
      if ( this.useTemplateLiterals && str.indexOf('\n') != -1 ) {
        this.out('`', str.replace(/`/g, '\\`'), '`');
      } else {
        this.out('"', this.escape(str), '"');
      }
    },

    function outputDate(o) {
      // Serialize an unambiguous timestamp.  Date and DateTime
      // property can provide an alternative toJSON() and
      // adapt/javaJSONParser mechanism to save space.
      this.out('{"class":"__Timestamp__","value":');
      this.output(this.formatDatesAsNumbers ? o.getTime() : o.toISOString());
      this.out('}');
    },

    function outputFunction(o) {
      if ( this.formatFunctionsAsStrings ) {
        this.output(o.toString());
      } else {
        this.out(o.toString());
      }
    },

    function outputRegExp(o) {
      // These methods happen to have identical implementation
      this.outputFunction(o);
    },

    function outputFObject(o, opt_cls) {
      if ( o.outputJSON ) {
        o.outputJSON(this);
      } else {
        this.outputFObject_(o, opt_cls);
      }
    },

    function classId_(cls) {
      return cls.package === this.defaultPackage ? cls.name : cls.id;
    },

    function outputFObject_(o, opt_cls, opt_axioms) {
      /** Output an FObject without checking if it implements outputJSON. **/
      this.start('{');
      var cls = this.getCls(opt_cls);
      var outputClassName = this.outputClassNames && o.cls_.id !== cls?.id;
//      console.log('************* class', o.cls_.name);
      if ( outputClassName ) {
        this.out(
          this.maybeEscapeKey('class'),
          ':',
          this.postColonStr,
          '"',
          this.classId_(o.cls_),
          '"');
      }
      var ps = opt_axioms || o.cls_.getAxiomsByClass(foam.lang.Property);
      var outputComma = outputClassName;
      for ( var i = 0 ; i < ps.length ; i++ ) {
        outputComma = this.outputProperty(o, ps[i], outputComma) || outputComma;
      }
      this.end('}');
    },

    function outputObjectKeyValue_(key, value, first) {
      if ( this.objectKeyValuePredicate(key, value) ) {
        if ( ! first ) this.out(',').nl().indent();
        this.out(
          this.maybeEscapeKey(key),
          ':',
          this.postColonStr).output(value);
        return true;
      }
      return false;
    },

    function outputObjectKeyValues_(o) {
      var first = true;
      for ( var key in o ) {
        first = !this.outputObjectKeyValue_(key, o[key], first) && first;
      }
    },

    function outputSortedObjectKeyValues_(o) {
      var key, keys = [];

      for ( key in o ) keys.push(key);
      keys.sort();

      var first = true;
      for ( var i = 0 ; i < keys.length; i++ ) {
        key = keys[i];
        first = !this.outputObjectKeyValue_(key, o[key], first) && first;
      }
    },

    function outputClassInfo(o) {
      this.out('{"class":"__Class__","forClass_":');
      this.outputString(o.id);
      this.out('}');
    },

    {
      name: 'output',
      code: foam.mmethod({
        // JSON doesn't support sending 'undefined'
        Undefined: function(o) { this.out('null'); },
        Null:      function(o) { this.out('null'); },
        String:    function(o) { this.outputString(o); },
        Number:    function(o) { this.out(o); },
        Boolean:   function(o) { this.out(o); },
        Date:      function(o) { this.outputDate(o); },
        Function:  function(o) { this.outputFunction(o); },
        RegExp:  function(o) { this.outputRegExp(o); },
        FObject: function(o, opt_cls) { this.outputFObject(o, opt_cls); },
        Array: function(o, opt_cls) {
          this.start('[');
          var cls = this.getCls(opt_cls);
          for ( var i = 0 ; i < o.length ; i++ ) {
            this.output(o[i], cls);
            if ( i < o.length-1 ) this.out(',').nl().indent();
          }
          //this.nl();
          this.end(']');
        },
        Object: function(o) {
          if ( foam.lang.FObject.isSubClass(o) ) {
            this.outputClassInfo(o);
          } else if ( o.outputJSON ) {
            o.outputJSON(this);
          } else {
            this.start('{');
            if ( this.sortObjectKeys ) {
              this.outputSortedObjectKeyValues_(o);
            } else {
              this.outputObjectKeyValues_(o);
            }
            this.end('}');
          }
        }
      })
    },

    function stringify(o, opt_cls) {
      // Focibly set this.buf_ to empty string.
      // It can be non-empty if a previous serialized threw an exception and didn't complete.
      this.buf_ = "";

      this.output(o, opt_cls);
      var ret = this.buf_;
      this.reset(); // reset to avoid retaining garbage
      return ret;
    },

    {
      name: 'objectify',
      code: foam.mmethod({
        Date: function(o) {
          return this.formatDatesAsNumbers ? o.valueOf() : o;
        },
        Function: function(o) {
          return this.formatFunctionsAsStrings ? o.toString() : o;
        },
        FObject: function(o, opt_cls) {
          var m = {};
          var cls = this.getCls(opt_cls);
          if ( this.outputClassNames && o.cls_.id !== cls?.id ) {
            m.class = this.classId_(o.cls_);
          }
          var ps = o.cls_.getAxiomsByClass(foam.lang.Property);
          for ( var i = 0 ; i < ps.length ; i++ ) {
            var p = ps[i];
            if ( ! this.propertyPredicate(o, p) ) continue;
            if ( ! this.outputDefaultValues && p.isDefaultValue(o[p.name]) )
              continue;

            m[p.name] = this.objectify(p.toJSON(o[p.name], this), p.of);
          }
          return m;
        },
        Array: function(o, opt_cls) {
          var a = [];
          var cls = this.getCls(opt_cls);
          for ( var i = 0 ; i < o.length ; i++ ) {
            a[i] = this.objectify(o[i], cls);
          }
          return a;
        },
        Object: function(o) {
          var ret = {};
          for ( var key in o ) {
            // NOTE: Could lazily construct "ret" first time
            // this.objectify(o[key]) !== o[key].
            if ( o.hasOwnProperty(key) ) ret[key] = this.objectify(o[key]);
          }
          return ret;
        }
      },
      function(o) { return o; })
    },

    function getCls(opt_cls) {
      return foam.typeOf(opt_cls) === foam.String ? this.__context__.maybeLookup(opt_cls) :
        opt_cls;
    }
  ]
});


foam.CLASS({
  package: 'foam.json',
  name: 'Parser',

  properties: [
    {
      class: 'Boolean',
      name: 'strict',
      value: true
    },
    {
      name: 'creationContext'
    }
  ],

  methods: [
    function parseString(str, opt_ctx) {
      return this.parseClassFromString(str, null, opt_ctx);
    },
    function aparse(str, opt_ctx) {
      var x = this.__context__;

      var json = JSON.parse(str);

      var references = foam.json.references(x, json);

      return Promise.all/*Settled*/(references).then(() => {
        return foam.json.parse(json, undefined, opt_ctx || this.creationContext);
      });
    },
    function parseClassFromString(str, opt_cls, opt_ctx) {
      return this.strict ?
        // JSON.parse() is faster; use it when data format allows.
        foam.json.parse(
          JSON.parse(str),
          opt_cls,
          opt_ctx || this.creationContext) :
        // Create new parser iff different context was injected; otherwise
        // use same parser bound to "creationContext" each time.
        opt_ctx ? foam.parsers.FON.create({
          creationContext: opt_ctx || this.creationContext
        }).parseClassFromString(str, opt_cls) :
        this.fonParser_.parseClassFromString(str, opt_cls);
    },
    function clone() {
      return this;
    }
  ]
});


/** Library of pre-configured JSON Outputters. **/
foam.LIB({
  name: 'foam.json',

  constants: {

    // Pretty Print
    Pretty: foam.json.Outputter.create({
      strict: false
    }),

    // Strict means output as proper JSON.
    Strict: foam.json.Outputter.create({
      pretty: false,
      strict: true
    }),

    // Pretty and proper JSON.
    PrettyStrict: foam.json.Outputter.create({
      pretty: true,
      strict: true
    }),

    // Compact output (not pretty)
    Compact: foam.json.Outputter.create({
      pretty: false,
      strict: false,
      formatDatesAsNumbers: true,
      outputDefaultValues: false
    }),

    // Shorter than Compact (uses short-names if available)
    Short: foam.json.Outputter.create({
      pretty: false,
      strict: false,
      formatDatesAsNumbers: true,
      outputDefaultValues: false,
      useShortNames: false
    }),

    // Short, but exclude network-transient properties.
    Network: foam.json.Outputter.create({
      pretty: false,
      strict: true,
      formatDatesAsNumbers: true,
      outputDefaultValues: true,
      // TODO: No deserialization support for shortnames yet.
      //      useShortNames: true,
      useShortNames: true,
      // TODO: Currently faster to use strict JSON and native JSON.parse
      convertUnserializableToStubs: true,
      propertyPredicate: function(o, p) { return ! p.networkTransient; }
    }),

    // Short, but exclude network-transient properties.
    Dig: foam.json.Outputter.create({
      pretty: true,
      strict: false,
      formatDatesAsNumbers: false,
      outputDefaultValues: true,
      useShortNames: false,
      convertUnserializableToStubs: true,
      propertyPredicate: function(o, p) { return ! p.externalTransient && ! p.networkTransient; }
    }),

    // Short, but exclude storage-transient properties.
    Storage: foam.json.Outputter.create({
      pretty: false,
      strict: false,
      formatDatesAsNumbers: true,
      outputDefaultValues: false,
      // TODO: No deserialization support for shortnames yet.
      //      useShortNames: true,
      useShortNames: false,
      propertyPredicate: function(o, p) { return ! p.storageTransient; }
    }),

    // Short, but exclude storage-transient properties and is proper JSON.
    StorageStrict: foam.json.Outputter.create({
      pretty: false,
      strict: true,
      formatDatesAsNumbers: true,
      outputDefaultValues: false,
      // TODO: No deserialization support for shortnames yet.
      //      useShortNames: true,
      useShortNames: false,
      propertyPredicate: function(o, p) { return ! p.storageTransient; }
    }),

    // Short, but exclude cluster-transient properties.
    Cluster: foam.json.Outputter.create({
      pretty: false,
      strict: false,
      formatDatesAsNumbers: true,
      outputDefaultValues: false,
      // TODO: No deserialization support for shortnames yet.
      //      useShortNames: true,
      useShortNames: false,
      propertyPredicate: function(o, p) { return ! p.clusterTransient; }
    })
  },

  methods: [
    {
      name: 'parse',
      args: 'Any o, Class opt_class, Context opt_ctx',
      code: foam.mmethod({
        Array: function(o, opt_class, opt_ctx) {
          if ( foam.String.isInstance(opt_class) ) opt_class = ( opt_ctx || foam ).lookup(opt_class);

          var a = new Array(o.length);
          for ( var i = 0 ; i < o.length ; i++ ) {
            a[i] = this.parse(o[i], opt_class, opt_ctx);
          }

          return a;
        },
        FObject: function(o) { return o; },
        Object: function(json, opt_class, opt_ctx) {
          if ( foam.String.isInstance(opt_class) ) opt_class = ( opt_ctx || foam ).lookup(opt_class);
          var c = json.class || opt_class;
          if ( foam.String.isInstance(c) ) c = ( opt_ctx || foam ).maybeLookup(c);

          if ( c ) {
            if ( json.class && json.class != c.id ) {
              if ( foam.Undefined.isInstance(c) ) {
                console.warn(
                  "In foam.lang.JSON.parse(Object): JSON parser tried to deserialize class '"
                    + json.class + "' and failed. Is this class available to the client?"
                );
                return null;
              }
            }

            // TODO(markdittmer): Turn into static method: "parseJSON__" once
            // https://github.com/foam-framework/foam2/issues/613 is fixed.
            if ( c.PARSE_JSON ) return c.PARSE_JSON(json, opt_class, opt_ctx);

            var pMap = c.model_.getPrivate_('axiomsByNameOrShortnameMap');

            if ( ! pMap ) {
              pMap = c.model_.setPrivate_('axiomsByNameOrShortnameMap', {});
              c.getAxiomsByClass(foam.lang.Property).forEach(function(p) {
                pMap[p.name] = p;
                if ( p.shortName ) pMap[p.shortName] = p;
              });
            }

            try {
              /**
                 This code is very tricky and specific!

                 We initialize the object in two passes:
                 1. We extra all of the simple non-object/non-array parameters and store them
                 in the simpleArgs map.
                 2. We create() the object passing simpleArgs and the opt_ctx.
                 3. We then call the setters on the created object for all of the non-simple parameters.

                 We do this because some simple parameters need to be passed to create() if the class
                 is a Multiton which uses those parameters to determine the actual class to create or
                 for psedo-Classes like __PROPETY__ which use the arguments to determine which Property
                 constant to use.

                 However, nested FObject properties need to be created in the sub-context of their parent,
                 so we need to wait until after the object is created to create those objects.

                 However, we make an exception for properties named 'delegate' because they shouldn't be
                 in the sub-context of the parent, since this is merely a reference, not a composition.

                 TODO: Maybe Add a property to FObjectProperty to control if nested objects are parsed
                 in their parent's context or not, or find out where this is an issue and fix those instances.
               **/
              var simpleArgs = {};

              function isSimple(key, o) {
                return ! foam.Object.isInstance(o) && ! foam.Array.isInstance(o) || key === 'delegate';
              }

              // Pass1: handle simple non-Object values
              for ( var key in json ) {
                if ( ! isSimple(key, json[key]) ) continue;
                var prop = pMap[key];
                if ( prop ) {
                  var js = prop.fromJSON(json[key], opt_ctx, prop, this);
                  if ( js == null && json[key] != 'null' ) {
                    console.warn('Unable to parse property "' + key + '"', 'in', json);
                  } else {
                    simpleArgs[prop.name] = js;
                  }
                } else {
                  simpleArgs[key] = json[key];
                }
              }

              var o = c.create(simpleArgs, opt_ctx);

              // Pass1: handle non-simple values
              for ( var key in json ) {
                if ( isSimple(key, json[key]) ) continue;
                var prop = pMap[key];
                if ( prop ) {
                  var js = prop.fromJSON(json[key], o.__subContext__, prop, this);
                  if ( js == null && json[key] != 'null' ) {
                    console.warn('Unable to parse property "' + key + '"', 'in', json);
                  } else {
                    o[prop.name] = js;
                  }
                }
              }

              return o;
            } catch (x) {
              console.error(`Error creating object of class ${c.id} from ${json}:`, x);
//              console.error(`Error creating object of class ${c.id} from ${JSON.stringify(json)}:`, x);
            }
          } else if ( json.class ) {
            console.error('Unknown class:', json.class || opt_class);
          }

          for ( var key in json ) {
            var o = json[key];
            json[key] = this.parse(json[key], null, opt_ctx);
          }

          return json;
        }
      }, function(o) { return o; })
    },

    {
      name: 'references',
      code: function(x, o, r) {
        r = r || [];

        if ( foam.Array.isInstance(o) ) {
          for ( var i = 0 ; i < o.length ; i++ ) {
            foam.json.references(x, o[i], r);
          }
        } else if ( foam.lang.FObject.isSubClass(o) ) {
          return r;
        } else if ( foam.Object.isInstance(o) ) {
          for ( var key in o ) {
            if ( ! o[key] ) continue;
            if ( key === 'type' && foam.String.isInstance(o[key]) ) {
              foam.lang.type.toType(o[key]).refs().forEach(function(id) {
                r.push(x.classloader.maybeLoad(id));
              })
              continue;
            }
            if ( ( key === 'of'          ||
                   key === 'class'       ||
                   key === 'view'        ||
                   key === 'sourceModel' ||
                   key === 'targetModel' ||
                   key === 'refines' )   &&
                 foam.String.isInstance(o[key]) ) {
              r.push(x.classloader.maybeLoad(o[key]));
              continue;
            }

            foam.json.references(x, o[key], r);
          }

          return r;
        }
      }
    },

    // TODO: unsafe and only used by LocalStorageDAO, so remove.
    function parseString(jsonStr, opt_ctx) {
      return this.parse(eval('(' + jsonStr + ')'), undefined, opt_ctx);
    },

    function stringify(o) {
      return foam.json.Compact.stringify(o);
    },

    function objectify(o) {
      return foam.json.Compact.objectify(o);
    }
  ]
});
