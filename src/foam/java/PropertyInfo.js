/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
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

foam.CLASS({
  package: 'foam.java',
  name: 'PropertyInfo',
  extends: 'foam.java.Class',

  properties: [
    { name: 'property' },
    { name: 'anonymous', value: true },
    { name: 'propName',                factory: function() { return this.property.name; } },
    { name: 'propShortName',           factory: function() { return this.property.shortName; } },
    { name: 'propAliases',             factory: function() { return this.property.aliases; } },
    { name: 'compare',                 factory: function() { return this.property.javaCompare; } },
    { name: 'comparePropertyToObject', factory: function() { return this.property.javaComparePropertyToObject; } },
    { name: 'comparePropertyToValue',  factory: function() { return this.property.javaComparePropertyToValue; } },
    {
      name: 'getAliasesBody',
      expression: function() {
      var b = 'new String[] {';
        for ( var i = 0 ; i < this.propAliases.length ; i++ ) {
          b += '"' + this.propAliases[i] + '"';
          if ( i < this.propAliases.length-1 ) b += ', ';
        }
        return b + '};';
      }
    },
    {
      class: 'Int',
      name: 'precision',
      factory: function() { return this.property.precision; }
    },
    {
      class: 'Boolean',
      name: 'networkTransient',
      factory: function() { return this.property.networkTransient; }
    },
    {
      class: 'Boolean',
      name: 'externalTransient',
      factory: function() { return this.property.externalTransient; }
    },
    {
      class: 'Boolean',
      name: 'storageTransient',
      factory: function() { return this.property.storageTransient; }
    },
    {
      class: 'Boolean',
      name: 'storageOptional',
      factory: function() { return this.property.storageOptional; }
    },
    {
      class: 'Boolean',
      name: 'clusterTransient',
      factory: function() { return this.property.clusterTransient; }
    },
    {
      class: 'Boolean',
      name: 'readPermissionRequired',
      factory: function() { return this.property.readPermissionRequired; }
    },
    {
      class: 'Boolean',
      name: 'writePermissionRequired',
      factory: function() { return this.property.writePermissionRequired; }
    },
    {
      class: 'Boolean',
      name: 'updatePermissionRequired',
      factory: function() {
        return this.property.updatePermissionRequired;
      }
    },
    {
      class: 'Boolean',
      documentation: 'define a property is a XML attribute. eg <foo id="XMLAttribute"></foo>',
      name: 'xmlAttribute',
      factory: function() { return this.property.xmlAttribute; }
    },
    {
      class: 'Boolean',
      documentation: 'define a property is a XML textNode. eg <foo id="1">textNode</foo>',
      name: 'xmlTextNode',
      factory: function() { return this.property.xmlTextNode; }
    },
    {
      class: 'String',
      name: 'sqlType',
      factory: function() { return this.property.sqlType; }
    },
    {
      name: 'getterName',
      expression: function(propName) {
        return 'get' + foam.String.capitalize(propName);
      }
    },
    {
      name: 'setterName',
      expression: function(propName) {
        return 'set' + foam.String.capitalize(propName);
      }
    },
    {
      name: 'clearName',
      expression: function(propName) {
        return 'clear' + foam.String.capitalize(propName);
      }
    },
    {
      class: 'Boolean',
      name: 'includeInID'
    },
    {
      class: 'Boolean',
      name: 'includeInDigest',
      value: true
//      factory: function() { return (! this.clusterTransient && ! this.storageTransient)/* && this.property.includeInDigest;*/ }
    },
    {
      class: 'Boolean',
      name: 'includeInSignature',
      factory: function() { return this.property.includeInSignature; }
    },
    {
      class: 'Boolean',
      name: 'containsPII',
      factory: function() { return this.property.containsPII; }
    },
    {
      class: 'Boolean',
      name: 'containsDeletablePII',
      factory: function() { return this.property.containsDeletablePII; }
    },
    { name: 'sourceCls' },
    { name: 'propType',            factory: function() { return this.property.javaType; } },
    { name: 'propValue',           factory: function() { return this.property.javaValue; } },
    { name: 'propRequired',        factory: function() { return this.property.required; } },
    { name: 'jsonParser',          factory: function() { return this.property.javaJSONParser; } },
    { name: 'csvParser',           factory: function() { return this.property.javaCSVParser; } },
    { name: 'cloneProperty',       factory: function() { return this.property.javaCloneProperty; } },
    { name: 'queryParser',         factory: function() { return this.property.javaQueryParser; } },
    { name: 'diffProperty',        factory: function() { return this.property.javaDiffProperty; } },
    { name: 'validateObj',         factory: function() { return this.property.javaValidateObj; } },
    { name: 'toCSV',               factory: function() { return this.property.javaToCSV; } },
    { name: 'toCSVLabel',          factory: function() { return this.property.javaToCSVLabel; } },
    { name: 'fromCSVLabelMapping', factory: function() { return this.property.javaFromCSVLabelMapping; } },
    { name: 'formatJSON',          factory: function() { return this.property.javaFormatJSON; } },
    {
      name: 'propClassName',
      expression: function (propType) {
        const i = propType.indexOf('<');
        return i == -1 ? propType : propType.slice(0, i);
      }
    },
    {
      class: 'Boolean',
      name: 'sheetsOutput',
      factory: function() { return this.property.sheetsOutput; },
      documentation: 'The sheetsOutput specifies if property shoud be written to Google Sheet on import. eg on Transaction import in case there is Status column transaction\'s status will be written there'
    },
    {
      name: 'methods',
      factory: function() {
        var fullName = this.sourceCls.package ? this.sourceCls.package + '.' + this.sourceCls.name : this.sourceCls.name;

        var m = [
          {
            name: 'getName',
            visibility: 'public',
            type: 'String',
            body: 'return "' + this.propName + '";'
          },
          {
            name: 'get_',
            type: this.propType,
            visibility: 'public',
            args: [{ name: 'o', type: 'Object' }],
            body: 'return ((' + fullName + ') o).' + this.getterName + '();'
          },
          {
            name: 'set',
            type: 'void',
            visibility: 'public',
            args: [{ name: 'o', type: 'Object' }, { name: 'value', type: 'Object' }],
            body: '((' + fullName + ') o).' + this.setterName + '(cast(value));'
          },
          {
            name: 'clear',
            type: 'void',
            visibility: 'public',
            args: [{ name: 'o', type: 'Object' }],
            body: '((' + fullName + ') o).' + this.clearName + '();'
          },
          {
            name: 'isSet',
            visibility: 'public',
            type: 'boolean',
            args: [{ name: 'o', type: 'Object' }],
            body: `return ((${fullName}) o).${this.propName}IsSet_;`
          }
        ];

        var numberType    = [ 'long', 'byte', 'double', 'float', 'short', 'int' ];
        var primitiveType = [ ...numberType, 'boolean' ];

        if ( ! ( primitiveType.includes(this.propType) || this.propType == 'Object' || this.propType == 'String' ) ) {
          m.push({
            name: 'cast',
            type: this.propType,
            visibility: 'public',
            args: [{ name: 'o', type: 'Object' }],
            body: 'return ' + ( this.propType == "Object" ? 'o;' : '( ' + this.propType + ') o;')
          });
        }

        if ( ! ( primitiveType.includes(this.propType) || this.propType == 'Object' || this.extends == 'foam.lang.AbstractFObjectPropertyInfo' || this.extends == 'foam.lang.AbstractFObjectArrayPropertyInfo' ) ) {
          m.push({
            name: 'getSQLType',
            visibility: 'public',
            type: 'String',
            body: 'return "' + this.sqlType + '";'
          });
        }

        if ( ! primitiveType.includes(this.propType) ) {
          m.push({
            name: 'get',
            visibility: 'public',
            type: 'Object',
            args: [{ name: 'o', type: 'Object' }],
            body: 'return get_(o);'
          });

          m.push({
            name: 'jsonParser',
            type: 'foam.lib.parse.Parser',
            visibility: 'public',
            body: 'return ' + ( this.jsonParser || null ) + ';'
          });
        }

        if ( ! ( primitiveType.includes(this.propType) || this.propType == 'java.util.Date' || this.propType == 'String' || this.propType == 'Object' ) ) {
            //TODO add support for special type.
//              || this.propType == 'java.util.Map' || this.propType == 'java.util.List'
            //TODO add support for subtype.
//            this.propType == 'foam.lang.AbstractFObjectPropertyInfo' || this.propType == 'foam.lang.AbstractClassPropertyInfo') ||
//            this.propType == 'foam.lang.AbstractObjectPropertyInfo'

          m.push({
            name: 'getValueClass',
            visibility: 'public',
            type: 'Class',
            body: `return ${this.propClassName}.class;`
          });

          m.push({
            name: 'queryParser',
            type: 'foam.lib.parse.Parser',
            visibility: 'public',
            body: 'return ' + ( this.queryParser || null ) + ';'
          });
        }

        // TODO: the csvParser / jsonParser hierarchy should be cleaned up with defaults moved to AbstractPropertyInfo classes
        // to avoid generating a lot of redundant code and making the generating code difficult to understand and update.
        if ( ! ( primitiveType.includes(this.propType) || this.propType == 'String' || this.propType == 'Object' ) ) {
          if ( this.csvParser || this.propType != 'java.util.Date' ) {
            m.push({
              name: 'csvParser',
              type: 'foam.lib.parse.Parser',
              visibility: 'public',
              body: 'return ' + ( this.csvParser || null ) + ';'
            });
          }
        }

        // Generate csvParser override for primitive types when explicitly provided
        // This allows custom CSV parsing for Double, Int, Long, etc. (e.g., handling "NULL" strings)
        if ( primitiveType.includes(this.propType) && this.csvParser ) {
          m.push({
            name: 'csvParser',
            type: 'foam.lib.parse.Parser',
            visibility: 'public',
            body: 'return ' + this.csvParser + ';'
          });
        }

        if ( this.compare !== '' ) {
          m.push({
            name: 'compare',
            type: 'int',
            visibility: 'public',
            args: [{ name: 'o1', type: 'Object' }, { name: 'o2', type: 'Object' }],
            body: this.compare,
          });
        }
        if ( this.comparePropertyToObject !== '' ) {
          m.push({
            name: 'comparePropertyToObject',
            type: 'int',
            visibility: 'public',
            args: [{ name: 'key', type: 'Object' }, { name: 'o', type: 'Object' }],
            body: this.comparePropertyToObject,
          });
        }
        if ( this.comparePropertyToValue !== '' ) {
          m.push({
            name: 'comparePropertyToValue',
            type: 'int',
            visibility: 'public',
            args: [{ name: 'key', type: 'Object' }, { name: 'value', type: 'Object' }],
            body: this.comparePropertyToValue,
          });
        }
        if ( numberType.includes(this.propType) ) {
          if ( this.propValue != '0' ) {
            m.push({
              name: 'isDefaultValue',
              visibility: 'public',
              type: 'boolean',
              args: [{ name: 'o', type: 'Object' }],
              /* TODO: revise when/if expression support is added to Java */
              body: `return foam.util.SafetyUtil.compare(get_(o), ${this.propValue}) == 0;`
            });
          }
        } else if ( this.propType != 'boolean' && this.propType != 'java.util.Date' && this.propType != 'String' && this.propType != 'Object' && this.extends != 'foam.lang.AbstractFObjectPropertyInfo' && this.extends != 'foam.lang.AbstractFObjectArrayPropertyInfo' ) {
          m.push({
            name: 'isDefaultValue',
            visibility: 'public',
            type: 'boolean',
            args: [{ name: 'o', type: 'Object' }],
            /* TODO: revise when/if expression support is added to Java */
            body: `return foam.util.SafetyUtil.compare(get_(o), ${this.propValue}) == 0;`
          });
        }

        // TODO: We could reduce the amount a Enum PropertyInfo code we output
        if ( this.extends != 'foam.lang.AbstractEnumPropertyInfo' ) {
          var body = 'formatter.output(get_(obj));';

          // Double extends Float, so just checking for Float catches both
          if ( foam.lang.Float.isInstance(this.property) && this.precision ) {
            var precision = this.precision;
            var body = `formatter.output(get_(obj), ${precision});`;
          }

          m.push({
            name: 'format',
            visibility: 'public',
            type: 'void',
            args: [
              {
                name: 'formatter',
                type: 'foam.lib.formatter.FObjectFormatter'
              },
              {
                name: 'obj',
                type: 'foam.lang.FObject'
              }
            ],
            body: body
          });
        }

        m.push({
          name: 'getNetworkTransient',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.networkTransient + ';'
        });

        m.push({
          name: 'getExternalTransient',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.externalTransient + ';'
        });

        m.push({
          name: 'getStorageTransient',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.storageTransient + ';'
        });

        m.push({
          name: 'getStorageOptional',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.storageOptional + ';'
        });

        m.push({
          name: 'getClusterTransient',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.clusterTransient + ';'
        });

        m.push({
          name: 'getReadPermissionRequired',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.readPermissionRequired + ';'
        });

        m.push({
          name: 'getWritePermissionRequired',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.writePermissionRequired + ';'
        });

        m.push({
          name: 'getUpdatePermissionRequired',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.updatePermissionRequired + ';'
        });

        m.push({
          name: 'getXMLAttribute',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.xmlAttribute + ';'
        });

        m.push({
          name: 'getXMLTextNode',
          type: 'boolean',
          visibility: 'public',
          body: 'return ' + this.xmlTextNode + ';'
        });

        m.push({
          name: 'getRequired',
          visibility: 'public',
          type: 'boolean',
          body: 'return ' + Boolean(this.propRequired) + ';'
        });

        m.push({
          name: 'validateObj',
          visibility: 'public',
          type: 'void',
          args: [
            { name: 'x', type: 'foam.lang.X' },
            { name: 'obj', type: 'foam.lang.FObject' }
          ],
          body: this.validateObj
        });

        m.push({
          name: 'getShortName',
          visibility: 'public',
          type: 'String',
          body: this.propShortName ?
            'return "' + this.propShortName + '";' :
            'return null;'
        });

        m.push({
          name: 'getAliases',
          visibility: 'public',
          type: 'String[]',
          body: 'return ' + this.getAliasesBody
        });

        if ( this.cloneProperty != null ) {
          m.push({
            name: 'cloneProperty',
            visibility: 'public',
            type: 'void',
            args: [{ type: 'foam.lang.FObject', name: 'source' },
                    { type: 'foam.lang.FObject', name: 'dest' }],
            body: this.cloneProperty
          });
        }

        if ( this.diffProperty != null ) {
          m.push({
            name: 'diff',
            visibility: 'public',
            type: 'void',
            args: [{ type: 'foam.lang.FObject',       name: 'o1'   },
                    { type: 'foam.lang.FObject',      name: 'o2'   },
                    { type: 'java.util.Map',          name: 'diff' },
                    { type: 'foam.lang.PropertyInfo', name: 'prop' }],
            body: this.diffProperty
          });
        }


/*
//        if ( ! this.includeInDigest ) {
          m.push({
            name:       'includeInDigest',
            visibility: 'public',
            type:       'boolean',
            body:       'return ${this.includeInDigest};'
          });
          */
//        }

          m.push({
            name:       'includeInID',
            visibility: 'public',
            type:       'boolean',
            body:       `return ${this.includeInID};`
          });

        // default value is true, only generate if value is false
      //  if ( ! this.includeInSignature ) {
          m.push({
            name:       'includeInSignature',
            visibility: 'public',
            type:       'boolean',
            body:       `return ${this.includeInSignature && this.includeInDigest};`
          });
      //  }

          m.push({
            name:       'containsPII',
            visibility: 'public',
            type:       'boolean',
            body:       `return ${this.containsPII};`
          });

          m.push({
            name:       'containsDeletablePII',
            visibility: 'public',
            type:       'boolean',
            body:       `return ${this.containsDeletablePII};`
          });

          m.push({
            name: 'getSheetsOutput',
            type: 'boolean',
            visibility: 'public',
            body: 'return ' + this.sheetsOutput + ';'
          });

        if ( this.formatJSON != null ) {
          m.push({
            name: 'formatJSON',
            type: 'void',
            visibility: 'public',
            args: [
              {
                name: 'formatter',
                type: 'foam.lib.formatter.FObjectFormatter'
              },
              {
                name: 'obj',
                type: 'foam.lang.FObject'
              }
            ],
            body: this.formatJSON + ';'
          });
        }

        return m;
      }
    }
  ]
});
