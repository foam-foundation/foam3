/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'LibraryScript',
  extends: 'foam.core.reflow.Script',

  documentation: 'Script subtype for persisted Library entries with required id and scriptName.',

  ids: [ 'id' ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      visibility: 'RO',
    },
    {
      class: 'String',
      name: 'scriptName',
      required: true
    }
  ]
});


