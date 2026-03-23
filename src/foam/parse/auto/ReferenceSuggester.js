/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'ReferenceSuggester',
  extends: 'foam.u2.View',

  documentation: `
    A suggester view for Reference properties in the AQL search bar.
    Renders a RichChoiceReferenceView in embedded mode inside SmartView's
    suggestion dropdown. When the user selects a record, its ID is inserted
    into the search text via suggestText.
  `,

  css: `
    ^:hover {
      background-color: unset !important;
      cursor: default !important;
    }
    ^ {
      padding: 0 !important;
    }
  `,

  requires: [
    'foam.u2.view.RichChoiceReferenceView'
  ],

  properties: [
    'suggestText',
    { class: 'Class', name: 'of' },
    { class: 'String', name: 'targetDAOKey' }
  ],

  methods: [
    function render() {
      this.addClass();
      var self = this;
      var dao  = this.__subContext__[this.targetDAOKey];
      if ( ! dao ) return;

      var choiceView = this.RichChoiceReferenceView.create({
        embedded: true
      });
      choiceView.fromProperty({
        targetDAOKey: this.targetDAOKey,
        of: this.of,
        name: this.targetDAOKey
      });

      choiceView.data$.sub(function() {
        if ( choiceView.data != null ) {
          self.suggestText(choiceView.data + ' ');
        }
      });

      this.add(choiceView);
    }
  ]
});
