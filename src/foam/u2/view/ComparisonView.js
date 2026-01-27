/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.view',
  name: 'ComparisonView',
  extends: 'foam.u2.View',
  documentation: 'Displays a side-by-side comparison of two FObjects with a summary of changes.',

  requires: [
    'foam.lang.FObject',
    'foam.u2.ModalHeader',
    'foam.u2.DetailView',
    'foam.u2.detail.VerticalDetailView',
    'foam.u2.layout.Cols'
  ],

  css: `
    ^summary-box {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    ^summary-deleted {
      background-color: $destructive50;
      border: 1px solid $destructive200;
    }
    ^summary-changed {
      background-color: transparent;
      border: none;
      padding-left: 0;
      padding-right: 0;
    }
    ^summary-unchanged {
      background-color: $success50;
      border: 1px solid $success200;
    }
    ^summary-label {
      font-weight: $font-medium;
      color: $textSecondary;
    }
    ^field-chip {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85em;
      background-color: $warn100;
      color: $warn700;
    }
    ^columns {
      display: flex;
      gap: 24px;
    }
    ^column {
      flex: 1;
      min-width: 0;
    }
    ^column-header {
      font-weight: $font-medium;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid $borderLight;
    }
  `,

  properties: [
    {
      name: 'left',
      type: 'FObject',
      documentation: 'The "before" object (original/initial state)'
    },
    {
      name: 'right',
      type: 'FObject',
      documentation: 'The "after" object (current/runtime state). Null if deleted.'
    },
    {
      name: 'changedFields',
      class: 'StringArray',
      documentation: 'List of field names that differ between left and right objects.',
      factory: function() {
        return this.calculateChangedFields();
      }
    }
  ],

  methods: [
    function calculateChangedFields() {
      var changed = [];
      if ( ! this.left || ! this.right ) return changed;

      // Use the model's properties (axioms) to compare
      var cls = this.left.cls_;
      if ( ! cls || ! cls.getAxiomsByClass ) return changed;

      try {
        var props = cls.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < props.length ; i++ ) {
          var prop = props[i];
          var leftValue = prop.get(this.left);
          var rightValue = prop.get(this.right);
          if ( ! foam.util.equals(leftValue, rightValue) ) {
            changed.push(prop.label || prop.name);
          }
        }
      } catch ( e ) {
        console.warn('ComparisonView: Error calculating changed fields', e);
      }

      return changed;
    },

    function render() {
      this.SUPER();
      var self = this;

      this.addClass();

      // Render summary section
      this.renderSummary();

      // Render comparison columns
      this
        .startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
        .start().addClass(this.myClass('columns'))
          .start().addClass(this.myClass('column'))
            .start('div').addClass(this.myClass('column-header')).add('Before').end()
            .tag(this.VerticalDetailView, { data: this.left })
          .end()
          .start().addClass(this.myClass('column'))
            .start('div').addClass(this.myClass('column-header')).add('After').end()
            .call(function() {
              if ( self.right ) {
                this.tag(self.VerticalDetailView, { data: self.right });
              } else {
                this.start('div')
                  .style({ color: '$textTertiary', 'font-style': 'italic', padding: '16px' })
                  .add('Object has been deleted')
                .end();
              }
            })
          .end()
        .end()
        .endContext();
    },

    function renderSummary() {
      var summaryBox = this.start('div').addClass(this.myClass('summary-box'));

      if ( this.right == null ) {
        // Object was deleted
        summaryBox
          .addClass(this.myClass('summary-deleted'))
          .start('span').addClass(this.myClass('summary-label')).add('Status:').end()
          .add(' Object was deleted at runtime');
      } else if ( this.changedFields.length > 0 ) {
        // Object has changes
        summaryBox
          .addClass(this.myClass('summary-changed'))
          .start('span').addClass(this.myClass('summary-label')).add('Changed fields:').end();
        for ( var i = 0 ; i < this.changedFields.length ; i++ ) {
          summaryBox.start('span').addClass(this.myClass('field-chip')).add(this.changedFields[i]).end();
        }
      } else {
        // No changes
        summaryBox
          .addClass(this.myClass('summary-unchanged'))
          .start('span').addClass(this.myClass('summary-label')).add('Status:').end()
          .add(' No changes detected');
      }

      summaryBox.end();
    }
  ]
});
