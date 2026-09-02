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
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 520px;
    }
    ^columns {
      display: flex;
      align-items: stretch;
      gap: 4px;
    }
    ^col {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid $borderLight;
      border-radius: 8px;
      overflow: hidden;
      background: $backgroundDefault;
    }
    ^col-header {
      padding: 8px 12px;
      background: $backgroundSecondary;
      border-bottom: 1px solid $borderLight;
    }
    ^col-body {
      flex: 1;
      overflow-y: auto;
      max-height: 50vh;
      padding: 6px;
    }
    ^item {
      padding: 6px 10px;
      cursor: pointer;
      border-radius: 6px;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    ^item:hover {
      background: $backgroundHover;
      color: $textBrand;
    }
    ^item-draggable {
      cursor: grab;
      display: flex;
      align-items: center;
    }
    ^item-draggable:active {
      cursor: grabbing;
    }
    ^item-draggable::before {
      content: '⠿';
      color: $textTertiary;
      margin-right: 8px;
    }
    ^item-drop-before {
      box-shadow: inset 0 2px 0 0 $primary500;
    }
    ^item-drop-after {
      box-shadow: inset 0 -2px 0 0 $primary500;
    }
    ^middle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 0 8px;
    }
    ^arrow {
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid $borderDefault;
      border-radius: 50%;
      background: $backgroundDefault;
      color: $textSecondary;
      font-size: 1.1em;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    ^arrow:hover {
      background: $backgroundBrandSecondary;
      border-color: $borderBrand;
      color: $textBrand;
    }
    ^actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 12px;
      border-top: 1px solid $borderLight;
    }
    ^actions button {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      background: $primary500;
      color: $textOnBrand;
      font-weight: $font-medium;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    ^actions button:hover {
      background: $primary600;
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
                var BEFORE = self.myClass('item-drop-before');
                var AFTER  = self.myClass('item-drop-after');
                var dropPosition = e => {
                  var rect = e.currentTarget.getBoundingClientRect();
                  return (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
                };
                var clearDropClasses = e => e.currentTarget.classList.remove(BEFORE, AFTER);

                this.start()
                  .forEach(selected, function(name, i) {
                    var prop = props.find(p => p.name === name);
                    if ( ! prop ) return;
                    this.start()
                      .addClass(self.myClass('item'))
                      .addClass(self.myClass('item-draggable'))
                      .attrs({ draggable: 'true' })
                      .on('dragstart', e => {
                        e.dataTransfer.setData('text/plain', i);
                        e.dataTransfer.effectAllowed = 'move';
                      })
                      .on('dragenter', e => e.preventDefault())
                      .on('dragover', e => {
                        e.preventDefault();
                        var before = dropPosition(e) === 'before';
                        e.currentTarget.classList.toggle(BEFORE, before);
                        e.currentTarget.classList.toggle(AFTER, ! before);
                      })
                      .on('dragleave', clearDropClasses)
                      .on('drop', e => {
                        e.preventDefault();
                        var position = dropPosition(e);
                        clearDropClasses(e);
                        var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        if ( isNaN(from) || from === i ) return;
                        var arr = self.selected.slice();
                        var moved = arr.splice(from, 1)[0];
                        var targetIdx = arr.indexOf(name);
                        var insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
                        arr.splice(insertIdx, 0, moved);
                        self.selected = arr;
                      })
                      .add(prop.columnLabel)
                      .on('click', () => {
                        var idx = self.selected.indexOf(name);
                        if ( idx !== -1 ) self.selected$splice(idx, 1);
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
      padding: 6px 12px;
      border: 1px solid $borderDefault;
      border-radius: 6px;
      background: $backgroundDefault;
      color: $textSecondary;
      font-weight: $font-medium;
      white-space: nowrap;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    ^picker-btn:hover {
      background: $backgroundBrandSecondary;
      border-color: $borderBrand;
      color: $textBrand;
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
