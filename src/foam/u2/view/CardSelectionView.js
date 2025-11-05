/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CardSelectionView',
  extends: 'foam.u2.View',
  flags: ['web'],

  documentation: `A card selection view where the data is presented in a CardSelectView,
  a simpler version of the MultiChoiceView where the user must choose only one card`,

  implements: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.u2.view.CardSelectView' ],

  css: `
    ^flexer {
      flex-wrap: wrap;
    }
    ^innerFlexer {
      display: inline-flex;
      padding: 4px;
      box-sizing: border-box;
    }
  `,

  properties: [
    {
      name: 'choices',
      factory: function() {
        return [];
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      postSet: function (_, n) {
        (async () => {
          this.choices = (await n.select()).array;
        })();
      }
    },
    [ 'isVertical', true],
    {
      class: 'Int',
      name: 'numCols',
      value: 2,
      documentation: `
        Used to control the number of cards shown in a row if isVertical is false
      `
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'choiceView',
      value: { class: 'foam.u2.view.CardSelectView' }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'selectionPredicate',
      documentation: 'Predicate for selecting the default choice when not able to infer from data'
    }
    ,
    {
      class: 'Boolean',
      name: 'autoSelect',
      value: true,
      documentation: 'When true, auto-select the first choice'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .start(this.isVertical ? foam.u2.layout.Rows : foam.u2.layout.Cols)
          .addClass(this.myClass('flexer'))
          .add(
            self.dynamic(function(choices) {
              let e = this;
              // Since the code below requires at least one choice, special case
              if ( choices.length < 1 ) {
                return;
              }

              // Set default choice selection based on data
              var selection = choices.find(c => self.choiceIsSelected(self.data, c));
              choices.forEach((choice, index) => {
                var isSelectedSlot = self.slot(function(choices, data) {
                  return self.choiceIsSelected(data, choices[index]);
                });

                var cardSelectViewConfig = {
                  isSelected$: isSelectedSlot
                }

                var valueSimpSlot;

                if ( choice instanceof Array ) {
                  valueSimpSlot = self.mustSlot(choice[0]);
                  cardSelectViewConfig.label = choice[1];
                } else {
                  valueSimpSlot = self.mustSlot(choice);
                }

                cardSelectViewConfig.data$ = valueSimpSlot;
                cardSelectViewConfig.data  = valueSimpSlot.get();

                // No default selection, set choice selection based on predicate
                if ( selection === undefined && self.selectionPredicate?.f(choice) ) {
                    selection = choice;
                }

                e.start(self.choiceView, cardSelectViewConfig)
                  .addClass(self.myClass('innerFlexer'))
                  .style({
                    'width': self.isVertical ? '100%' : `${100 / self.numCols}%`
                  })
                  .call(function () {
                    let e = self.E();
                    e.onDetach(
                      this.clicked.sub(() => {
                        self.data =  ! self.choiceIsSelected(self.data, valueSimpSlot.get()) ?
                          valueSimpSlot.get() :
                          null;
                      })
                    );
                    e.onDetach(
                      this.selectionDisabled.sub(() => {
                        if ( self.isDisabled && self.choiceIsSelected(self.data, valueSimpSlot.get()) ) {
                          self.clearProperty('data');
                        }
                      })
                    );
                  })
                .end();
              });

              if ( selection === undefined ) {
                if ( self.autoSelect ) {
                  selection = choices[0];
                  self.data = foam.Array.isInstance(selection) ? selection[0] : selection;
                }
              } else {
                self.data = foam.Array.isInstance(selection) ? selection[0] : selection;
              }
            })
          )
        .end();
    },

    function choiceIsSelected(data, choice) {
      return foam.util.equals(data, choice instanceof Array ? choice[0] : choice);
    },

    function mustSlot(v) {
      return foam.lang.Slot.isInstance(v) ?
        v :
        foam.lang.SimpleSlot.create({ value: v });
    }
  ]
});