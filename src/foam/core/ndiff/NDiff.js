/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ndiff',
  name: 'NDiff',
  documentation: `Tracks changes to cSpecs. Used for debugging`,
  requires: [
    'foam.u2.dialog.Popup'
  ],

  css: `
    .ndiff-compare-modal .foam-u2-dialog-StyledModal-wrapper {
      width: min(95vw, 1200px);
    }
  `,
  tableColumns: [
    'cSpecName',
    'objectId',
    'deletedAtRuntime',
    'apply',
    'compare'
  ],
  ids: ['cSpecName', 'objectId'],
  properties: [
    {
      name: 'cSpecName',
      label: 'CSpec',
      class: 'String',
    },
    {
      name: 'objectId',
      class: 'String',
      projectionSafe: false
    },
    {
      name: 'deletedAtRuntime',
      class: 'Boolean',
      tableWidth: 25,
      documentation: `
        Set to true if a repo entry was deleted at runtime.
      `
    },
    {
      name: 'initialFObject',
      class: 'FObjectProperty',
      visibility: 'HIDDEN',
      projectionSafe: false,
      documentation: `
        The object as it was loaded from the repo journals (".0 file")
        `
    },
    {
      name: 'runtimeFObject',
      class: 'FObjectProperty',
      visibility: 'HIDDEN',
      projectionSafe: false,
      storageTransient: true,
      documentation: `
        The current runtime state of the object (fetched on-the-fly during select)
      `
    },
    {
      name: 'applyOriginal',
      label: 'Should Apply Original',
      class: 'Boolean',
      visibility: 'HIDDEN',
      documentation: `
        Client-side will set this true when they want to store
        the initialFObject to its respective DAO.
        The flag will then automatically be set to false.
        `,
      storageTransient: true
    }
  ],

  actions: [
    {
      name: 'apply',
      label: 'Apply Original',
      tableWidth: 25,
      confirmationRequired: function() {
        return true;
      },
      code: async function(X) {
        this.applyOriginal = true;
        await X.ndiffDAO.put(this);
      }
    },
    {
      name: 'compare',
      label: 'Compare Changes',
      tableWidth: 25,
      code: async function(X) {
        var self = this;

        // Fetch latest runtime object from target DAO for accurate comparison
        var targetDAO = X[self.cSpecName];
        var runtimeFObject = null;

        if ( targetDAO && self.initialFObject ) {
          runtimeFObject = await targetDAO.find(self.initialFObject.id);
        }

        // Create comparison modal - ComparisonView handles all the diff logic and UI
        X.ctrl.add(
          foam.u2.dialog.StyledModal.create({
            title: 'Comparison: ' + self.objectId,
            maxWidth: 'min(95vw, 1200px)'
          }, self)
            .addClass('ndiff-compare-modal')
            .tag({
              class: 'foam.u2.view.ComparisonView',
              left: self.initialFObject,
              right: runtimeFObject
            })
        );
      }
    }
  ]
});
