/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.theme.customisation',
  name: 'CSSTokenOverride',

  ids: ['theme', 'source'],

  implements: [
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware'
  ],


  searchColumns: [
    'theme',
    'enabled',
    'source',
    'target'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.theme.Theme',
      name: 'theme',
      documentation: 'Id of the theme this override is applied on',
      updateVisibility: 'RO',
      tableCellFormatter: { class: 'foam.u2.view.ReferenceToSummaryCellFormatter'}
    },
    {
      class: 'Map',
      name: 'variants',
      documentation: `Per-mode values, keyed by the variant name the theme is
        in: { light: '#FFC0CB' } or { dark: '#202020' }. An entry wins for its
        mode; target fills any mode without one. With theme.useVariants off no
        mode is named, so only target is read.`
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true
    },
    {
      class: 'String',
      name: 'source',
      view: { class: 'foam.u2.view.ClassCompleterView' },
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'target',
      documentation: `Replacement value for the token. The fallback for every
        mode that has no entry in variants; a row with variants only and no
        target leaves those other modes to the next match: a theme-less ('')
        row, then the token's own value.`
    }
  ]
});
