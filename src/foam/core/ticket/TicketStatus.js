/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketStatus',

  imports: [
    'translationService?'
  ],

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
  ],

  methods: [
    {
      // The label in the user's language, e.g. "Fermé" for CLOSED in French.
      // A status is journal data, which no class constant holds, so boot
      // cannot install a translation onto its label. This asks for one by
      // the key foam.core.ticket.TicketStatus.CLOSED.label, as an enum
      // value's is, and falls back to the label when there is none.
      name: 'toSummary',
      flags: ['js'],
      code: function() {
        return this.translationService ?
          this.translationService.getTranslation(foam.locale, 'foam.core.ticket.TicketStatus.' + this.id + '.label', this.label) :
          this.label;
      }
    }
  ]
});
