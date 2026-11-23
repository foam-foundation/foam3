/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.menu',
  name: 'TreeAltView',
  extends: 'foam.u2.view.AltView',

  requires: [
    'foam.core.menu.Menu',
    'foam.u2.table.TableView',
    'foam.u2.view.TreeView'
  ],

  // The Tree opens a row on double-click (a single click selects it and opens or closes its branch),
  // through the dblclick it imports; hand it the screen's own click, as InlineDAOControllerView does.
  imports: [ 'click?' ],
  exports: [ 'click as dblclick' ],

  properties: [
    'relationship'
  ],

  methods: [
    function init() {
      var relationship = typeof this.relationship === 'object' ?
        relationship :
        foam.lookup(this.relationship);

      this.views = [
        [
          {
            class: 'foam.u2.table.TableView'
          },
         'Table'
        ],
        [ {
            class: 'foam.u2.view.TreeView',
            relationship: relationship,
            startExpanded: true,
            formatter: function(data) { this.add(data.label); }
          }, 'Tree' ]
      ]
    }
  ]
});
