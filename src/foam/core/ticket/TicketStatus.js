/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketStatus',

  properties: [
    {
      name: 'id',
      class: 'String',
      label: 'Status'
    },
    {
      name: 'label',
      class: 'I18NString'
    },
    {
      name: 'ordinal',
      class: 'Long'
    },
    {
      name: 'description',
      class: 'String'
    },
    {
      class: 'String',
      name: 'color'
    },
    {
      class: 'String',
      name: 'background'
    },
    {
      class: 'String',
      name: 'borderColor',
      factory: function(){
        return this.background;
      }
    },
    {
      class: 'String',
      name: 'glyphFill',
      factory: function(){
        return this.color;
      }
    },
    {
      class: 'String',
      name: 'glyphBackground',
      factory: function(){
        return this.background;
      }
    },
    {
      class: 'GlyphProperty',
      name: 'glyph'
    },
    {
      class: 'String',
      name: 'icon',
      documentation: 'simple img src alternative for glyph'
    }
  ]
});
