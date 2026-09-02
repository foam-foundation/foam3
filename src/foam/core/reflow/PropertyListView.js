/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyPickerDialog',
  extends: 'foam.u2.Controller',

  imports: ['closeDialog'],

  css: `
    ^ {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 500px;
    }
    ^columns {
      display: flex;
      align-items: stretch;
    }
    ^col {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      overflow: hidden;
    }
    ^col-header {
      padding: 6px 10px;
      border-bottom: 1px solid $borderDefault;
    }
    ^col-body {
      flex: 1;
      overflow-y: auto;
      max-height: 50vh;
      padding: 4px;
    }
    ^item {
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
    }
    ^item:hover {
      background: $blue50;
    }
    ^middle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 8px;
    }
    ^arrow {
      cursor: pointer;
      padding: 4px 10px;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      background: none;
      font-size: 1.1em;
    }
    ^arrow:hover {
      background: $blue50;
    }
    ^actions {
      display: flex;
      justify-content: flex-end;
    }
  `,

  messages: [
    { name: 'AVAILABLE', message: 'Available' },
    { name: 'SELECTED_MSG',  message: 'Selected' },
    { name: 'DONE',      message: 'Done' }
  ],

  properties: [
    'suggestText',
    'of',
    { class: 'Array', name: 'selected' }
  ],

  methods: [
    function render() {
      var self = this;
      var props = this.of.getAxiomsByClass(foam.lang.Property)
        .filter(p => ! p.hidden && ! p.networkTransient);

      this.addClass()
        .start().addClass(self.myClass('columns'))
          .start().addClass(self.myClass('col'))
            .start().addClass(self.myClass('col-header'))
              .start('p').addClass('p-label-lg').add(self.AVAILABLE).end()
            .end()
            .start().addClass(self.myClass('col-body'))
              .add(self.dynamic(function(selected) {
                this.start()
                  .forEach(props.filter(p => ! selected.includes(p.name)), function(prop) {
                    this.start().addClass(self.myClass('item'))
                      .add(prop.columnLabel)
                      .on('click', () => self.selected$push(prop.name))
                    .end();
                  })
                .end();
              }))
            .end()
          .end()
          .start().addClass(self.myClass('middle'))
            .start('button').addClass(self.myClass('arrow')).add('→')
              .on('click', () => {
                var toAdd = props.filter(p => ! self.selected.includes(p.name)).map(p => p.name);
                self.selected = [...self.selected, ...toAdd];
              })
            .end()
            .start('button').addClass(self.myClass('arrow')).add('←')
              .on('click', () => { self.selected = []; })
            .end()
          .end()
          .start().addClass(self.myClass('col'))
            .start().addClass(self.myClass('col-header'))
              .start('p').addClass('p-label-lg').add(self.SELECTED_MSG).end()
            .end()
            .start().addClass(self.myClass('col-body'))
              .add(self.dynamic(function(selected) {
                this.start()
                  .forEach(selected, function(name) {
                    var prop = props.find(p => p.name === name);
                    if ( ! prop ) return;
                    this.start().addClass(self.myClass('item'))
                      .add(prop.columnLabel)
                      .on('click', () => {
                        var i = self.selected.indexOf(name);
                        if ( i !== -1 ) self.selected$splice(i, 1);
                      })
                    .end();
                  })
                .end();
              }))
            .end()
          .end()
        .end()
        .start().addClass(self.myClass('actions'))
          .start('button').add(self.DONE)
            .on('click', () => {
              self.suggestText(self.selected.join(','));
              self.closeDialog();
            })
          .end()
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyListView',
  extends: 'foam.u2.View',

  documentation: `
    A composite view for editing a comma-separated property list.
    Provides a SmartView (text input with grammar-based autocomplete) on the
    left and a picker button ([…]) on the right that opens a graphical
    two-column PropertyPickerDialog. The two input modes stay in sync via
    the shared data$ slot.
  `,

  requires: [
    'foam.parse.auto.SmartView',
    'foam.u2.dialog.Popup',
    'foam.core.reflow.parser.PropertyParser',
    'foam.core.reflow.PropertyPickerDialog'
  ],

  messages: [
    { name: 'EDIT', message: 'Edit' }
  ],

  css: `
    ^ {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^smart-view {
      flex: 1;
    }
    ^picker-btn {
      cursor: pointer;
      padding: 4px 8px;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      background: none;
      white-space: nowrap;
    }
    ^picker-btn:hover {
      background: $blue50;
    }
  `,

  properties: [
    'of'
  ],

  methods: [
    function render() {
      var parser    = this.PropertyParser.create({ of: this.of }, this).getSymParser('propertyList');
      var smartView = this.SmartView.create({ parser: parser, data$: this.data$ });

      this.addClass()
        .start().addClass(this.myClass('smart-view'))
          .add(smartView)
        .end()
        .start('button').addClass(this.myClass('picker-btn')).add(this.EDIT)
          .on('click', this.openPicker_)
        .end();
    }
  ],

  listeners: [
    function openPicker_() {
      var self     = this;
      var selected = self.data ? self.data.split(',').filter(s => s) : [];
      var popup    = self.Popup.create({closeable: false});
      popup.content.tag(self.PropertyPickerDialog, {
        of: self.of,
        selected: selected,
        suggestText: function(val) { self.data = val; }
      });
      popup.open();
    }
  ]
});
