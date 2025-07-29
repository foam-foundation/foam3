/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'foam.core.reflow.control',
    name: 'CollectionsControl',
    extends: 'foam.core.reflow.control.ComponentsControl',
  
    requires: [ 'foam.core.reflow.DynamicReflowData' ],
  
    properties: [
      {
        name: 'buttonLabel',
        value: 'Collections'
      },
      {
        name: 'buttonIcon',
        value: 'file'
      },
      {
        class: 'foam.u2.ViewSpec',
        name: 'spec',
        factory: function() {
          return { class: 'foam.core.reflow.DynamicReflowData', header: this.buttonLabel, dataType: 'collections' }
        }
      }
    ]
  });
  