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
  name: 'Outputter',

  properties: [
    {
      name: 'indentLevel_',
      value: 0
    },
    {
      name: 'indentStr',
      value: '  '
    },
    {
      class: 'String',
      name: 'buf_'
    }
  ],

  methods: [
    function indent() {
      for ( var i = 0 ; i < this.indentLevel_ ; i++ ) this.buf_ += this.indentStr;
      return this;
    },

    function out() {
      for ( var i = 0 ; i < arguments.length ; i++ ) {
        if ( arguments[i] != null && arguments[i].outputJava ) {
          arguments[i].outputJava(this);
        } else {
          this.buf_ += arguments[i];
        }
      }
      return this;
    },

    function outputSourceHeader(source) {
      // Generated .java files name the model .js they came from so a javac
      // error in build/ can be traced back to the file that was edited.
      // The path is written relative to the build's working directory (the
      // pom root): an absolute path would bake each developer's home
      // directory into the output, so two checkouts of the same commit would
      // produce byte-different sources and defeat a shared build cache.
      if ( typeof source === 'undefined' ) {
        this.out('// SOURCE: <implied class>\n');
        return this;
      }
      var path_ = require('path');
      if ( path_.isAbsolute(source) ) {
        source = path_.relative(process.cwd(), source);
      }
      this.out('// SOURCE: ' + source + '\n');
      return this;
    },

    function increaseIndent() {
      this.indentLevel_++;
    },

    function decreaseIndent() {
      this.indentLevel_--;
    }
  ]
});
