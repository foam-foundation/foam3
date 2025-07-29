/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichTitledArrayView',
  extends: 'foam.u2.view.FObjectArrayView',

  documentation: 'Collapsible FObjectArrayView with a title and expand/collapse per row.',

  imports: [ 'theme' ],

  css: `
    ^ .foam-u2-DetailView {
      border: 1px solid #borderLight;
      margin-bottom: 8px;
    }
    ^header-row {
      align-items: center;
      cursor: pointer;
      border-bottom: 1px solid $borderLight;
      padding: 5px;
    }
    ^value-view-container {
      border: 1px solid $borderLight;
      border-radius: 4px;
     
    }
    ^collapse-icon {
      margin-right: 8px;
      cursor: pointer;
      user-select: none;
    }
    ^value-view {
      margin-top: 10px;
      padding: 5px;
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
    ^typeLabel {
        padding: 5px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    }
    ^control.opened {
        transform: rotate(180deg);
    }
    ^ .foam-u2-layout-Rows {
        gap: 10px;
    }
    
  `,

  properties: [
    {
      name: 'title',
      documentation: 'This property is used to populate the header for each individual array element'
    },
    {
      class: 'Map',
      name: 'collapsed',
      factory: function() { return {}; },
      documentation: 'Map of row index to collapsed state.'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.onDetach(this.data$.sub(() => { if ( ! this.feedback_ ) this.data2_ = this.data; }));
      this.data2_ = this.data;
      this.addClass();

      this
        .add(this.slot(function(data2_, valueView, collapsed) {
          var data = data2_;
          return self.E()
            .start(self.Rows)
              .forEach(data || [], function(e, i) {
                var row = self.Row.create({ index: i, value: e });
                var isCollapsed = collapsed[i] === undefined ? true : collapsed[i];
                   
                this
                  .startContext({ data: row })
                    .start()
                        .addClass(self.myClass('value-view-container')).style({
                            borderColor: !isCollapsed && self.theme.primary5
                        })
                        .start(self.Cols)
                            .addClass(self.myClass('header-row'))
                            .start().style({alignContent: 'center'}).addClass(self.myClass('item-row'))
                                .start('span').addClass(self.myClass('item-index')).add(i+1).end()
                                .start('span').addClass(self.myClass('item-name')).add(
                                row.value$.dot('label').map(label => label ? label : 'New Property')
                                ).end()
                            .end()
                            .start().addClass(self.myClass('actions-holder'))
                              .start().addClass(self.myClass('typeLabel'))
                                .addClass(row.value$.dot('type').dot('name').map(name => name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : ''))
                                .add(row.value$.dot('type').dot('label').map(label => label))
                              .end()
                                .tag(self.Row.REMOVE, {
                                    buttonStyle: 'TERTIARY',
                                    themeIcon: 'trash',
                                    label: '',
                                })
                                .start(foam.u2.tag.Button, {
                                    buttonStyle: 'BLACK',
                                    themeIcon: 'dropdown',
                                }).addClass(self.myClass('control')).enableClass('opened', !isCollapsed).on('click', function() { self.toggleCollapse(i); })
                                .end()
                            .end()
                        .end()
                        .callIf(!isCollapsed, function() {
                            this.start(valueView, { data$: row.value$ })
                                .addClass(self.myClass('value-view'))
                        .end();
                        })
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
  ],

  listeners: [
    function toggleCollapse(idx) {
      this.collapsed$set(idx, ! this.collapsed[idx])
    },
  ]
});
