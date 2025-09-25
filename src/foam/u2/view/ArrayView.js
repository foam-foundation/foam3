/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ArrayView',
  extends: 'foam.u2.View',

  requires: [
    'foam.lang.FObject',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows'
  ],

  exports: [
    'enableRemoving',
    'mode',
    'updateData',
    'updateDataWithoutFeedback'
  ],

  properties: [
    {
      class: 'Array',
      name: 'data'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'valueView',
      value: { class: 'foam.u2.view.AnyView' }
    },
    {
      name: 'defaultNewItem',
      value: ''
    },
    {
      class: 'Boolean',
      name: 'enableAdding',
      value: true
    },
    {
      class: 'Boolean',
      name: 'enableRemoving',
      value: true
    },
    {
      class: 'Boolean',
      name: 'allowDuplicates',
      value: true
    },
    {
      name: 'disabledData_',
      documentation: 'Optional list of choices that should be disabled',
      expression: function(allowDuplicates, data) {
        return allowDuplicates ? [] : data;
      }
    },
    {
      class: 'Int',
      name: 'arrayLength_',
      documentation: 'Optional number of unique elements in array, used to limit number of array items that can be assigned',
      value: -1
    },
    // The next two properties are used to avoid excess flickering.
    // We only update data to data2_ when we know that our feedback
    // didn't cause the update. This prevents the whole view from
    // being redrawn when we update a single row's value.
    {
      name: 'data2_'
    },
    {
      class: 'Boolean',
      name: 'feedback_'
    }
  ],

  actions: [
    {
      name: 'addRow',
      label: 'Add',
      isAvailable: function(mode, enableAdding) {
        return enableAdding && mode === foam.u2.DisplayMode.RW;
      },
      isEnabled: function(allowDuplicates, data, arrayLength_) {
        // Disable adding if no duplicates and all uniques already assigned
        return allowDuplicates || data.length !== arrayLength_;
      },
      code: function() {
        var newItem = this.defaultNewItem;
        if ( this.FObject.isInstance(newItem) ) {
          newItem = newItem.clone(this.__context__);
        }
        this.data = [ ...this.data, newItem ];
        this.updateData();
      }
    }
  ],

  classes: [
    {
      name: 'Row',
      imports: [
        'data',
        'enableRemoving',
        'mode',
        'updateData',
        'updateDataWithoutFeedback'
      ],
      properties: [
        {
          class: 'Int',
          name: 'index',
          visibility: 'RO'
        },
        {
          name: 'value',
          postSet: function(_, n) {
            if ( this.data[this.index] === n ) return;
            this.data[this.index] = n;
            var data = [...this.data];
            data[this.index] = n;
            this.data = data;
          }
        }
      ],
      actions: [
        {
          name: 'remove',
          isAvailable: function(enableRemoving, mode) {
            return enableRemoving && mode === foam.u2.DisplayMode.RW;
          },
          code: function() {
            this.data = this.data.toSpliced(this.index, 1);
          }
        }
      ]
    }
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 4px;
    }
    ^value-view {
      flex: 1;
      max-width: 100%;
    }
    ^addButton.foam-u2-ActionView {
      border: 1.5px dashed $borderDefault;
      justify-content: flex-start;
      text-align: left;
      width: 100%;
    }
    ^value-view-container {
      gap:4px;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this.onDetach(this.data$.sub(() => { if ( ! this.feedback_ ) this.data2_ = this.data; }));
      this.data2_ = foam.Array.isInstance(this.data) && this.data;
      this.addClass();

      this
        .add(this.slot(function(data2_, valueView) {
          var data = data2_;
          return self.E()
            .start(self.Rows)
              .addClass('p')
              .forEach(data || [], function(e, i) {
                var row = self.Row.create({ index: i, value: e });
                e && e.sub(self.updateDataWithoutFeedback);
                this
                  .startContext({ data: row })
                    .start(self.Cols)
                      .addClass(self.myClass('value-view-container'))
                      .start(valueView, { data$: row.value$ })
                        .addClass(self.myClass('value-view'))
                      .end()
                      .tag(self.Row.REMOVE, {
                        label: '',
                        // icon: '/images/remove-circle.svg',
                        // encode data as an embedded data URL of the SVG
                        // because then the GUI updates without flickering
                        themeIcon: 'close',
                        icon: "data:image/svg+xml;utf8,%0A%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Cpath fill='%23d9170e' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z'/%3E%3C/svg%3E",
                        buttonStyle: 'TERTIARY',
                        size: 'SMALL'
                      })
                    .end()
                  .endContext();
                row.onDetach(row.sub(self.updateDataWithoutFeedback));
              });
        }))
        .startContext({ data: this })
          .add(this.slot(this.addAction))
        .endContext();
    },
    function addAction() {
      return this.E().start(this.ADD_ROW, {
        themeIcon: 'plus',
        icon: "data:image/svg+xml;utf8,%0A%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Cpath fill='%2317d90e' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z'/%3E%3C/svg%3E",
        buttonStyle: 'TERTIARY'
      }).addClass(this.myClass('addButton')).end();
    }
  ],

  listeners: [
    {
      name: 'updateData',
      code: function() {
        this.data = foam.Array.shallowClone(this.data);
      }
    },
    {
      name: 'updateDataWithoutFeedback',
      isFramed: true,
      code: function() {
        this.feedback_ = true;
        try {
          this.updateData();
        } finally {
          this.feedback_ = false;
        }
      }
    }
  ]
});
