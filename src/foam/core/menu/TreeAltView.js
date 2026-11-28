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
  imports: [ 'browserPredicate?', 'click?' ],
  exports: [ 'click as dblclick' ],

  properties: [
    'relationship',
    {
      name: 'config',
      documentation: `The list screen's config; DAOBrowserView passes it to its
        summary view. Its dao is the whole, unsearched store, which the Tree
        needs to draw the parents of a match.`
    }
  ],

  methods: [
    function init() {
      var self         = this;
      var relationship = typeof this.relationship === 'object' ?
        this.relationship :
        foam.lookup(this.relationship);

      this.views = [
        [
          {
            class: 'foam.u2.table.TableView'
          },
         'Table'
        ],
        [ {
            // AltView hands every view the searched rows. The Tree draws the
            // whole store instead and takes the search as its searchPredicate, so a
            // match shows with its parent rows.
            // Without a config (an older list screen), it follows AltView's data.
            create: function(args, x) {
              return self.TreeView.create({
                ...( self.config ? { data: self.config.dao } : { data$: args.data$ } ),
                searchPredicate$: self.browserPredicate$,
                relationship:  relationship,
                startExpanded: true,
                formatter:     function(data) { this.add(data.label); }
              }, x);
            }
          }, 'Tree' ]
      ]
    }
  ]
});
