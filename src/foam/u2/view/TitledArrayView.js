/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TitledArrayView',
  extends: 'foam.u2.view.FObjectArrayView',

  documentation: 'Collapsible FObjectArrayView with a title and expand/collapse per row.',

  imports: [ 'theme' ],

  css: `
    ^ .foam-u2-layout-Rows {
        gap: 1rem;
    }
  `,

  classes: [
    {
      name: 'CollapsableRow',
      extends: 'foam.u2.view.ArrayView.Row',
      imports: ['collapseBehaviour'],
      css: `
        ^header-row {
          align-items: center;
          cursor: pointer;
          padding: 5px;
        }
        ^header-row.opened {
          border-bottom: 1px solid $borderLight;
          padding: 8px 8px;
        }
        ^value-view-container {
          padding: 5px;
          border: 1px solid $borderLight;
          border-radius: 4px;
        }
        ^value-view-container ^value-view-container {
          background: $backgroundSecondary;
        }
        ^value-view {
          padding: 8px;
        }
        ^actions-holder {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        ^item-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        ^item-name {
          line-height: inherit;
        }
        ^item-index {
          color: $grey700;
        }
        ^control.opened {
            transform: rotate(180deg);
        }
        .type-label {
          padding: 5px;
          border-radius: 4px;
          font-size: $body-sm;
          font-weight: $font-bold;
        }
      `,
      properties: [
        {
          class: 'Boolean',
          name: 'collapsed'
        }
      ],
      methods: [
        function render() {
          let arrView = this.arrayView
          var summaryType = arrView.title || this.value.toSummary ? this.value$.map(v => v.toSummary()) : ('New ' + arrView.of.model_.label);
          var summaryTypeClass = this.value.toCSSClassName ? this.value$.map(v => v.toCSSClassName().code()) : 'default';

          this
            .attrs({ 'data-idx': this.index$ })
            .startContext({ data: this })
              .start()
                .addClass(this.myClass('value-view-container'))
                .enableClass('collapsable', this.collapseBehaviour$.map(v => v != 'NONE'))
                .enableClass('opened', this.collapsed$, true)
                .start(this.Cols)
                  .addClass(this.myClass('header-row'))
                  .enableClass('opened', this.collapsed$.map(c => !c))
                  .start().style({alignContent: 'center'}).addClass(this.myClass('item-row'))
                    .start('span').addClass(this.myClass('item-index')).add(this.index$.map(i => i + 1)).end()
                    .start('span').addClass(this.myClass('item-name'), 'h600').add(
                      summaryType
                    ).end()
                  .end()
                  .start().addClass(this.myClass('actions-holder'))
                    .tag(this.REMOVE_ROW, {
                      buttonStyle: 'TERTIARY',
                      themeIcon: 'trash',
                      label: '',
                      size: 'SMALL'
                    })
                    .start(this.COLLAPSE)
                      .addClass(this.myClass('control'))
                      .enableClass('opened', this.collapsed$.not())
                    .end()
                  .end()
                .end()
                .start(arrView.valueView, { data$: this.value$ })
                  .hide(this.collapsed$)
                  .addClass(this.myClass('value-view'))
                .end()
              .end()
          .endContext();
        }
      ],
      actions: [
        {
          name: 'collapse',
          label: '',
          themeIcon: 'dropdown',
          buttonStyle: 'TERTIARY',
          size: 'SMALL',
          isAvailable: function(collapseBehaviour) {
            return collapseBehaviour != 'NONE';
          },
          code: function() {
            this.collapsed = ! this.collapsed
          }
        }
      ]
    }
  ],

  enums: [
    {
      name: 'CollapseBehaviour',
      values: ['NONE', 'ALLOW_COLLAPSE', 'START_COLLAPSED']
    }
  ],

  exports: ['collapseBehaviour'],

  properties: [
    {
      name: 'title',
      documentation: 'This property is used to populate the header for each individual array element'
    },
    {
      name: 'collapseBehaviour',
      factory: function() {
        return this.CollapseBehaviour.NONE;
      }
    },
    {
      class: 'Map',
      name: 'collapseState',
      documentation: 'Map of rowKey -> collapsed boolean to persist state across redraws',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function buildRow(e, i, self) {
      var key = i;
      var initialCollapsed = self.collapseState.hasOwnProperty(key)
        ? !! self.collapseState[key]
        : (self.collapseBehaviour == 'START_COLLAPSED');

      var row = self.CollapsableRow.create({ index: i, value: e, collapsed: initialCollapsed });
      row.onDetach(row.sub(self.updateDataWithoutFeedback));
      row.onDetach(row.collapsed$.sub(function() {
        self.collapseState[key] = row.collapsed;
      }));
      return row;
    }
  ]
});
