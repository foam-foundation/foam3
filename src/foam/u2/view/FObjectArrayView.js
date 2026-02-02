/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'FObjectArrayView',
  extends: 'foam.u2.view.ArrayView',

  documentation: `
    A specialization of 'foam.u2.view.ArrayView' for arrays of FObjects.
    This view is intended for use with FObject arrays where object
    lifecycle and identity matter and where minimizing DOM updates for
    single-object changes improves UX and performance.
  `,

  css: `
    ^ .foam-u2-DetailView {
      border: 1px solid #ddd;
      margin-bottom: 8px;
    }
  `,

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      name: 'defaultNewItem',
      expression: function(of) {
        return foam.lang.InterfaceModel.isInstance(of.model_)
          ? null
          : of.create(null, this.__subContext__);
      }
    },
    {
      name: 'valueView',
      expression: function(of) {
        return { class: 'foam.u2.DetailView' };
        /*
        return {
          class: 'foam.u2.view.CollapseableDetailView',
          view: {
            class: 'foam.u2.view.DraftDetailView',
            view: {
              class: 'foam.u2.view.FObjectView',
              of: of
            }
          }
        };
        */
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      let self = this;
      this.onDetach(this.data$.sub(() => { 
        if ( ! self.feedback_ ) {
          // Remove any rows that were removed in the array
          let oldData = [...self.data2_];
          for ( let j = 0; j < oldData.length; j++ ) {
            let oldIndex = j;
            let item = oldData[j];
            if ( ! item ) continue;
            let newIndex = self.data.indexOf(item) 
            if ( newIndex === -1 ) {
              self.data2_[j] = null;
              self.removeRowWithID(item.$UID)
              continue;
            }
            // Row already exisits but the index has changed
            if ( self.dataViewMap[item.$UID] && newIndex != oldIndex ) {
              let el = self.dataViewMap[item.$UID];
              el.index = newIndex;
              // We dont care to update index in data2_ or in the arrayView's childNodes as 
              // those will update when the loop has finished
            }
          }
          //Loop through array and add new elements 
          // flip the array around since element only supports insert before
          for ( let i = self.data.length - 1; i >= 0; i--) {
            let row = self.data[i];
            if ( ! self.dataViewMap[self.data[i].$UID] ) {
              let rowEl = self.buildRow.call(this.rows_, row, i, self);
              if ( i >= self.data.length - 1 ) {
                self.rows_.add(rowEl);
              } else {
                let nextRow = self.data[realIndex + 1];
                let nextEl = self.dataViewMap[nextRow.$UID ?? ''];
                if ( nextEl ) {
                  self.rows_.insertBefore(rowEl, nextEl);
                } else {
                  self.rows_.add(rowEl);
                }
              }
            }
          }
        }
        // Even with feedback still clone as data2_ should be in sync with data
        self.data2_ = foam.Array.shallowClone(this.data);
      }));
    },
    function initArrayView(self) {
      this.forEach(self.data || [], function(e, i) {
        let row = self.buildRow.call(this, e, i, self);
        this.add(row);
      });
    },
    function fromProperty(p) {
      this.SUPER(p);
      if ( ! this.of && p.of ) this.of = p.of;
    },
    function addAction() {
      this.start(this.ADD_ROW, {
          themeIcon: 'plus',
          buttonStyle: 'SECONDARY',
          label$: this.of$.map(v => 'Add ' + v.model_.label)
      }).end();
    }
  ],
  listeners: [
    {
      name: 'removeRowWithID',
      code: function(id) {
        let view = this.dataViewMap[id];
        if ( ! view ) {
          console.error(`Trying to delete invalid array element with ID: ${id}`);
          return;
        }
        view.remove();
        delete this.dataViewMap[id];
      }
    }
  ]
});
