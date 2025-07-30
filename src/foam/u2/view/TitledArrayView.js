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
    ^header-row {
      align-items: center;
      cursor: pointer;
      border-bottom: 1px solid $borderLight;
      padding: 8px 8px;
    }
    ^value-view-container {
      border: 1px solid $borderLight;
      border-radius: 4px;
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
    ^item-index {
      color: $grey700;
    }
    ^control.opened {
        transform: rotate(180deg);
    }
    ^ .foam-u2-layout-Rows {
        gap: 10px;
    }
  `,

  classes: [
    {
      name: 'CollapsableRow',
      extends: 'foam.u2.view.ArrayView.Row',
      imports: ['collapseBehaviour'],
      properties: [
        {
          class: 'Boolean',
          name: 'collapsed'
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
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.onDetach(this.data$.sub(() => { if ( ! this.feedback_ ) this.data2_ = this.data; }));
      this.data2_ = this.data;
      this.addClass();

      this
        .start(self.Rows)
        .add(this.dynamic(function(data2_, valueView) {
          var data = data2_;
          this
            .forEach(data || [], function(e, i) {
              var row = self.CollapsableRow.create({ index: i, value: e, collapsed: self.collapseBehaviour == 'START_COLLAPSED' ? true : false });

              this
                .startContext({ data: row })
                  .start()
                    .addClass(self.myClass('value-view-container'))
                    .start(self.Cols)
                      .addClass(self.myClass('header-row'))
                      .start().style({alignContent: 'center'}).addClass(self.myClass('item-row'))
                        .start('span').addClass(self.myClass('item-index')).add(i+1).end()
                        .start('span').addClass(self.myClass('item-name')).add(
                          row.value$.dot('label').map(label => label ? label : 'New Property')
                        ).end()
                      .end()
                      .start().addClass(self.myClass('actions-holder'))
                        .tag(self.CollapsableRow.REMOVE, {
                          buttonStyle: 'TERTIARY',
                          themeIcon: 'trash',
                          label: '',
                          size: 'SMALL'
                        })
                        .start(self.CollapsableRow.COLLAPSE)
                          .addClass(self.myClass('control'))
                          .enableClass('opened', row.collapsed$.not())
                        .end()
                      .end()
                    .end()
                    .start(valueView, { data$: row.value$ })
                      .hide(row.collapsed$)
                      .addClass(self.myClass('value-view'))
                    .end()
                  .end()
              .endContext();
              row.onDetach(row.sub(self.updateDataWithoutFeedback));
            });
        }))
        .start().addClass(self.myClass('add-row-container'))
          .startContext({ data: this })
            .tag(this.ADD_ROW, {
            size: 'SMALL',
            buttonStyle: 'SECONDARY',
            label: 'Add New'
            })
          .endContext()
        .end();
    },
  ]
});
