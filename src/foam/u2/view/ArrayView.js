/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ArrayView',
  extends: 'foam.u2.View',
  documentation: `
    Renders an array of values as a vertical list of editable rows. 
    Each row uses a configurable 'valueView' to render or edit a single item. 
    ArrayView supports adding and removing rows, optional duplicate prevention, 
    and efficient updates to prevent full re-renders when a single row changes.

    Can be easily extended to support more complex rows (See TitledFObjectArrayView).

    NOTES:
    - Non-primitive items are tracked via $UID in 'dataViewMap' so that object updates (e.g., 'sub') can be handled without re-rendering every row.
    - The element intentionally treats programmatic row updates as feedback to avoid remounting slotted per-row views.
  `,

  requires: [
    'foam.lang.FObject',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows'
  ],

  exports: [
    'enableRemoving',
    'mode',
    'updateData',
    'updateDataWithoutFeedback',
    'as arrayView',
    'scrollToIndex',
    'valueView'
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
    },
    {
      class: 'Map',
      name: 'dataViewMap'
    },
    'rows_',
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
      }
    }
  ],

  classes: [
    {
      name: 'Row',
      extends: 'foam.u2.Element',
      requires: [
        'foam.u2.layout.Cols'
      ],
      css: `
        ^value-view {
          flex: 1;
          max-width: 100%;
        }
        ^value-view-container {
          gap:4px;
        }
      `,
      imports: [
        'data',
        'enableRemoving',
        'mode',
        'updateData',
        'updateDataWithoutFeedback',
        'scrollToIndex',
        'arrayView',
        'valueView'
      ],
      properties: [
        {
          class: 'Int',
          name: 'index',
          visibility: 'RO'
        },
        {
          name: 'value',
          postSet: function(o, n) {
            if ( this.data[this.index] === n ) return;
            if ( this.arrayView.dataViewMap[o.$UID] ) {
              delete this.arrayView.dataViewMap[o.$UID];
            }
            var data = [...this.data];
            data[this.index] = n;
            if ( ! foam.util.isPrimitive(this.value) )
              this.arrayView.dataViewMap[n.$UID] = this;
            // Treat value updates as feedback to prevent rerendering the whole array since the values are already slotted
            this.arrayView.feedback_ = true;
            this.data = data;
            this.arrayView.feedback_ = false;
            this.scrollToIndex(this.index)
          }
        }
      ],
      methods: [
        function init() {
          this.SUPER();
          if ( foam.util.isPrimitive(this.value) ) return;
          this.arrayView.dataViewMap[this.value.$UID] = this;
        },
        function render() {
          let self = this;
          this
            .attrs({ 'data-idx': self.index$ })
            .startContext({ data: this })
              .start(self.Cols)
                .addClass(self.myClass('value-view-container'))
                .add(self.dynamic(function(valueView) {
                  this.start(valueView, { data$: self.value$ })
                    .addClass(self.myClass('value-view'))
                  .end()
                }))
                .tag(self.REMOVE_ROW, {
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
        }
      ],
      actions: [
        {
          name: 'removeRow',
          isAvailable: function(enableRemoving, mode) {
            return enableRemoving && mode === foam.u2.DisplayMode.RW;
          },
          code: function() {
            this.data = this.data.toSpliced(this.index, 1);
            this.scrollToIndex(this.index == 0 ? 0 : this.index -1);
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
    ^addButton.foam-u2-ActionView {
      border: 1.5px dashed $borderDefault;
      justify-content: flex-start;
      text-align: left;
      width: 100%;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this.data2_ = foam.Array.isInstance(this.data) && this.data;
      this.addClass();

      this
        .start(self.Rows, {}, this.rows_$)
          .addClass('p')
          .call(this.initArrayView, [self])
        .end()
        .startContext({ data: this })
          .add(this.slot(this.addAction))
        .endContext();
    },
    function initArrayView(self) {
      this.onDetach(self.data$.sub(() => { if ( ! self.feedback_ ) self.data2_ = self.data; }));
      this.add(self.dynamic(function(data2_) {
        this.forEach(data2_ || [], function(e, i) {
          let row = self.buildRow.call(this, e, i, self);
          this.add(row);
        })
      }))
    },
    function buildRow(e, i, self) {
      var row = self.Row.create({ index: i, value: e });
      e && e.sub && e.sub(self.updateDataWithoutFeedback);
      row.onDetach(row.sub(self.updateDataWithoutFeedback));
      return row;
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
      name: 'scrollToIndex',
      isMerged: true,
      // Delay a bit to allow for any ui changes
      delay: 100,
      code: function(index) {
        if ( this.el_() ) {
          let el = this.el_();
          let currentRow = el.querySelector(`div[data-idx='${index}']`);
          if ( currentRow ) currentRow.scrollIntoView({behaviour: "smooth", block: "nearest", inline: "nearest", container: "nearest"})
        }
      }
    },
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
