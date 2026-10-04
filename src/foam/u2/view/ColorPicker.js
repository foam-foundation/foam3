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

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColorPicker',
  extends: 'foam.u2.tag.Input',

  css: `
    << {
      height: $inputHeight;
      padding: 0;
    }
  `,

  properties: [
    {
      name: 'type',
      value: 'color'
    }
  ],

  methods: [
    function link() {
      var self = this;
      this.addClass();
      this.attrSlot(null, this.onKey ? 'input' : null).relateFrom(this.data$,
        function(value) {
          if ( typeof value !== 'string' ) return value;

          var v = value.toLowerCase();
          if ( foam.Color.COLOR_TO_NAME[v] ) return foam.Color.COLOR_TO_NAME[v];
          return value;
        },
        function(value) {
          if ( typeof value !== 'string' ) return value;
          
          // Resolve CSS tokens for display in the color picker
          value = foam.CSS.returnTokenValue(value, self.cls_, self.__subContext__);
          
          var v = value.toLowerCase();
          if ( foam.Color.NAME_TO_COLOR[v] ) return foam.Color.NAME_TO_COLOR[v];
          return value;
        });
    }
  ]
});
