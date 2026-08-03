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

//import limitSplit from 'foam.java.util.js';

foam.CLASS({
  package: 'foam.java',
  name: 'InterfaceMethod',

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'documentation'
    },
    'type',
    {
      class: 'FObjectArray',
      of: 'foam.java.Argument',
      name: 'args'
    },
    {
      class: 'StringArray',
      name: 'throws'
    },
    {
      name: 'body',
      documentation: 'Optional default implementation'
    },
    {
      class: 'Boolean',
      name: 'remote'
    }
  ],

  methods: [
    function outputJava(o) {
      if ( this.documentation ) {
        str = foam.java.Util.removeSpacing(this.documentation);
        lines = foam.java.Util.limitSplit(str, 25);
        o.indent();
        o.out('/**\n');
        for ( i = 0 ; i < lines.length ; i++ ) {
          o.indent();
          o.out('* ' + lines[i]);
          o.out('\n');
        }
        o.indent();
        o.out('*/\n');
      }

      o.indent();
      o.out(
        this.body ? 'default ' : '',
        this.type, ' ', this.name, '(');

      for ( var i = 0 ; this.args && i < this.args.length ; i++ ) {
        o.out(this.args[i]);
        if ( i != this.args.length - 1 ) o.out(', ');
      }

      o.out(')');

      if ( this.throws.length > 0 ) {
        o.out(" throws ", this.throws.join(", "));
      }

      if ( ! this.body ) {
        o.out(';\n');
      } else {
        o.out(' {\n');

        o.increaseIndent();
        o.out(this.body);
        o.decreaseIndent();
        o.indent();
        o.out('}\n');
      }
    }
  ]
});
