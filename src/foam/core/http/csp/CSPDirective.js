/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.http.csp',
  name: 'CSPDirective',

  documentation: `Individual Content Security Policy Directive used
by CSPFilter to build a domain specific policy.
See CSPFilter.js for more documenation.`,

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  searchColumns: [
    'name',
    'key',
    'domain',
    'value',
    'hash'
  ],

  tableColumns: [
    'enabled',
    'name',
    'key',
    'domain',
    'value'
  ],

  ids: [ 'name', 'key', 'domain' ],

  constants: [
    {
      documenation: 'Domain with this value will match all domains',
      name: 'WILDCARD',
      type: 'String',
      value: '*'
    }
  ],

  properties: [
    {
      name: 'enabled',
      value: true,
      order: 1,
      gridColumns: 3
    },
    {
      // TODO: enum, or Strategy?
      documentation: 'Directive name: img-src, script-src, .. ',
      name: 'name',
      class: 'String',
      required: true,
      order: 2,
      gridColumns: 3
    },
    {
      documentation: 'name and key form a unique pair (ID). Example: script-src:ace',
      name: 'key',
      class: 'String',
      required: true,
      order: 3,
      gridColumns: 3
    },
    {
      documentation: 'Directive applies only on this domain.',
      name: 'domain',
      class: 'String',
      value: '*', // REVIEW: how to use constant
      required: true,
      order: 4,
      gridColumns: 3
    },
    {
      documentation: 'directive value (included URLs).',
      name: 'value',
      label: 'Value | URL',
      class: 'String',
      required: true,
      order: 5,
      gridColumns: 6
    },
    {
      name: 'hash',
      class: 'String',
      order: 6,
      gridColumns: 6
    }
  ]
})
