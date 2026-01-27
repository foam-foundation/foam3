/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DateFormatCitationView',
  extends: 'foam.u2.CitationView',

  documentation: 'Shows date format label with supported formats below it (dropdown state)',

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    ^label {
      font-weight: $font-regular;
      color: $textDefault;
      font-size: 14px;
    }

    ^documentation {
      font-size: 12px;
      color: $textSecondary;
      line-height: 1.4;
    }
  `,

  methods: [
    function render() {
      if ( ! this.data ) return this;

      return this
        .addClass(this.myClass())
        .start('div')
          .addClass(this.myClass('label'))
          .add(this.data.label || this.data.toSummary())
        .end()
        .start('div')
          .addClass(this.myClass('documentation'))
          .add(this.data.documentation || '')
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DateFormatSelectionView',
  extends: 'foam.u2.Element',

  documentation: 'Shows only the label when selected (collapsed state)',

  properties: [
    'fullObject',
    'defaultSelectionPrompt'
  ],

  css: `
    ^ {
      padding: 8px 12px;
      color: $textDefault;
      font-size: 14px;
    }
  `,

  methods: [
    function render() {
      this.addClass(this.myClass());

      // Use dynamic to react to changes in fullObject
      this.add(this.slot(function(fullObject, defaultSelectionPrompt) {
        if ( ! fullObject ) {
          return defaultSelectionPrompt || 'Select format';
        }
        return fullObject.label || fullObject.toSummary();
      }));

      return this;
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DateFormatRichChoiceView',
  extends: 'foam.u2.view.RichChoiceView',

  documentation: 'Custom RichChoiceView for enum values that stores the full enum object',

  properties: [
    {
      name: 'selectionView',
      factory: function() {
        return { class: 'foam.core.reflow.DateFormatSelectionView' };
      }
    },
    {
      name: 'rowView',
      factory: function() {
        return { class: 'foam.core.reflow.DateFormatCitationView' };
      }
    },
    {
      name: 'sections',
      factory: function() {
        return [
          {
            dao: foam.dao.ArrayDAO.create({
              of: foam.core.reflow.DateFormat,
              array: foam.core.reflow.DateFormat.VALUES
            })
          }
        ];
      }
    }
  ],

  methods: [
    function onSelect(obj) {
      // For enum values, store the whole object, not just the id
      this.fullObject_ = obj;
      this.data = obj;  // Store the enum value itself
      this.isOpen_ = false;
    }
  ],

  listeners: [
    {
      name: 'onDataUpdate',
      code: function() {
        if ( ! this.data ) {
          this.clearSelection();
          return;
        }
        // For enums, data is already the full object
        this.fullObject_ = this.data;
      }
    }
  ]
});
