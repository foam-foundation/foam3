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
  name: 'Person',

  tableColumns: [ 'id', 'firstName', 'lastName', 'hello', 'remove' ],

  properties: [
    { class: 'Int',    name: 'id', hidden: true },
    // copyable: true renders a copy button in each cell copying the displayed text
    { class: 'String', name: 'firstName', copyable: true },
    // copyable as a function(value, obj) copies its returned string instead;
    // use for columns whose cells render icons or objects
    {
      class: 'String',
      name: 'lastName',
      copyable: function(value, obj) { return obj.lastName + ', ' + obj.firstName; }
    },
    { class: 'Int',    name: 'age' }
  ],

  actions: [
    {
      name: 'hello',
      code: function hello() {
        console.log('Hello', this.firstName + ' ' + this.lastName);
      }
    },
    {
      name: 'remove',
      code: function hello(X) {
        X.dao.remove(this);
      }
    }
  ]
});


foam.CLASS({
  name: 'Main',

  requires: [
    'foam.u2.table.TableView',
    'foam.dao.EasyDAO'
  ],

  exports: [ 'dao' ],

  properties: [
    {
      name: 'dao',
      factory: function() {
        return this.EasyDAO.create({
          of: Person,
          daoType: 'MDAO',
          seqNo: true,
          testData: [
            { firstName: 'John',  lastName: 'Davis' },
            { firstName: 'Steve', lastName: 'Howe' },
            { firstName: 'Andy',  lastName: 'Smith' },
            { firstName: 'Gary',  lastName: 'Russell' },
            { firstName: 'Janet', lastName: 'Jones' },
            { firstName: 'Linda', lastName: 'Fisher' },
            { firstName: 'Kim',   lastName: 'Erwin' }
          ]
        });
      }
    },
    {
      name: 'table',
      factory: function() {
        return this.TableView.create({
          of: Person,
          data: this.dao
        });
      }
    }
  ],

  methods: [
    function init() {
      var table = this.table;
      table.write();
      table.selection$.sub(function() { console.log('selection: ', arguments, table.selection); });

      // CopyBorder: wrap arbitrary content with a copy button. No copyText set
      // copies the rendered text; copyText / copyText$ copies an explicit value.
      foam.u2.Element.create().
        add('CopyBorder demo — reference: ').
        start(foam.u2.borders.CopyBorder, { label: 'reference' }).
          add('REF-74837455000').
        end().
        write();
    }
  ]
});

var m = Main.create();
