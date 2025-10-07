/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'MultiChoiceView',
  extends: 'foam.u2.View',
  flags: ['web'],

  implements: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.u2.view.CardSelectView' ],

  documentation: `
    -takes a faceted CardSelectView - based on each choice[2].cls_

    Wraps a tag that represents multiple choices.

    The choices are in [value, label, isSelected, choiceMode ] quartets.

    However the client can simply pass in [value, label] and it will adapt to a [value, label, isSelected, choiceMode ] format

    Or the client can instead pass in a DAO to the MultiChoiceView.dao and the choices list will
    be automatically generated

    Calling the following methods:

    MultiChoiceView.data will be automatically set to a predicated dao based on the choices selected only if
    the minSelected, maxSelected criteria is respected, it will be foam.dao.NullDAO othrewise
  `,

  css: `
    ^helpTextRow {
      padding: 8pt 0;
    }
    ^flexer {
      align-items: stretch;
      text-align: center;
      justify-content:flex-start;
      display: grid;
      gap: 1.6rem;
    }
  `,

  messages: [
    { name: 'OPTIONS_MSG', message: 'options' },
    { name: 'CHOOSE_1_OF_FOLLOWING_OPTIONS', message: 'Choose one of the following options' },
    { name: 'CHOOSE_AT_LEAST_1_OPTION', message: 'Choose at least one option' },
    { name: 'CHOOSE_AT_LEAST', message: 'Choose at least' },
    { name: 'CHOOSE_EXACTLY', message: 'Choose exactly' },
    { name: 'CHOOSE', message: 'Choose' }
  ],

  enums: [
    {
      name: 'MaxChoiceBehaviour',
      values: [
        { name: 'DISABLE', label: 'Disable other choices' },
        { name: 'POP', label: 'When another value is selected replaces the last selected value' },
        { name: 'SHIFT', label: 'When another value is selected replaces the first selected value' }
      ]
    }
  ],

  properties: [
    {
      class: 'Function',
      name: 'onSelect'
    },
    {
      name: 'choices',
      documentation: `
        An array of choices which are single choice is denoted as [value, label, isFinal]

      `,
      factory: function() {
        return [];
      },
      adapt: function(old, nu) {
        if ( foam.Object.isInstance(nu) ) {
          var out = [];
          for ( var key in nu ) {
            if ( nu.hasOwnProperty(key) ) out.push([ key, nu[key] ]);
          }
          return out;
        }

        nu = foam.Array.shallowClone(nu);

        // Upgrade single values to [value, value].
        for ( var i = 0; i < nu.length; i++ ) {
          if ( ! Array.isArray(nu[i]) ) {
            nu[i] = [ nu[i], nu[i] ];
          }
        }
        return nu;
      }

    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      documentation: `
        If the user wants to be able to export data as a dao, then this needs to be filled out.

        If the user just wants to pass in a dao and no choices array, useDao should be true as well and it will be processed to populate the
        choices array instead of manually inputing the choices
      `
    },
    {
      class: 'Boolean',
      name: 'useDao'
    },
    {
      class: 'Boolean',
      name: 'showMinMaxHelper',
      value: true
    },
    {
      class: 'Boolean',
      name: 'isValidNumberOfChoices',
      expression: function(minSelected, maxSelected, data){
        return data.length >= minSelected && data.length <= maxSelected;
      }
    },
    {
      class: 'Int',
      name: 'minSelected',
      expression: function(choices) {
        return choices.length > 0 ? 1 : 0;
      }
    },
    {
      class: 'Int',
      name: 'maxSelected',
      value: 2
    },
    {
      class: 'Boolean',
      name: 'isVertical',
      value: false,
      documentation: `deprecated, use numberColumns instead`,
      postSet: function(_, n) {
        if ( n ) {
          this.numberColumns = 1;
        }
      }
    },
    {
      class: 'Boolean',
      name: 'isDaoFetched',
      value: false
    },
    {
      name: 'objToChoice',
      class: 'Function',
      value: function(obj) {
        return [obj.id, obj.toSummary()];
      }
    },
    {
      name: 'helpText_',
      expression: function(minSelected, maxSelected) {
        // TODO: Change this when formatted messages are supported
        return ( maxSelected > 0 )
          ? ( minSelected == maxSelected )
            ? ( minSelected == 1 )
              ? this.CHOOSE_1_OF_FOLLOWING_OPTIONS
              : `${this.CHOOSE_EXACTLY} ${minSelected} ${this.OPTIONS_MSG}`
            : `${this.CHOOSE} ${minSelected} - ${maxSelected} ${this.OPTIONS_MSG}`
          : ( minSelected == 1 )
            ? this.CHOOSE_AT_LEAST_1_OPTION
            : `${this.CHOOSE_AT_LEAST} ${minSelected} ${this.OPTIONS_MSG}`
          ;
      }
    },
    {
      name: 'data',
      value: []
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'choiceView',
      value: { class: 'foam.u2.view.CardSelectView' }
    },
    {
      name: 'numberColumns',
      value: 3
    },
    {
      // Correct class and of, just doesnt work with inner enums
      // class: 'Enum',
      // of: 'foam.u2.view.MultiChoiceView.MaxChoiceBehaviour',
      name: 'maxSelectedBehviour',
      documentation: `Behaviour of other choices when maxSelected is reached`,
      factory: function() {
        return this.MaxChoiceBehaviour.POP;
      },
      adapt: function(_, nu) {
        if ( typeof nu === 'string' ) {
          return this.MaxChoiceBehaviour[nu];
        }
        return nu;
      }
    }
  ],

  methods: [
    function outputSelectedChoicesInDAO() {
      if ( ! this.isValidNumberOfChoices || ! this.dao ) {
        console.warn('Please select a valid number of choices');
        return foam.dao.NullDAO;
      }

      var of = this.dao.of;

      return this.dao.where(this.IN(of.ID, this.data));
    },

    function isChoiceSelected(data, choice) {
      for ( var i = 0; i < data.length; i++ ) {
        if ( foam.util.equals(data[i], choice) ) return true;
      }
      return false;
    },

    function getIndexOfChoice(data, choice) {
      for ( var i = 0; i < data.length; i++ ) {
        if ( foam.util.equals(data[i], choice) ) return i;
      }
      return -1;
    },

    function getSelectedSlot(choice) {
      let slot = foam.lang.SimpleSlot.create();
      let self = this;
      slot.sub(() => {
        var arr = [
          ...self.data,
        ];
        arr = arr.filter(o => ! foam.util.equals(o, choice));
        if ( slot.get() ) {
          arr.push(choice);
        }
        if ( foam.util.equals(arr, self.data) ) return;
        self.data = arr;
      });
      self.data$.sub(()=> slot.set(self.isChoiceSelected(self.data, choice)));
      slot.set(self.isChoiceSelected(self.data, choice));
      return slot;
    },

    function render() {
      var self = this;

      this.onDAOUpdate();

      var renderEl = function() {
        this
          .start()
          .addClass(this.myClass('flexer'))
          .style({ 'grid-template-columns': `repeat(${self.numberColumns}, 1fr)` })
          .add(this.dynamic(function(choices) {
            choices.forEach((choice, index) => {
              var valueSimpSlot = self.mustSlot(choice[0]);
              var labelSimpSlot = self.mustSlot(choice[1]);

              var isFinal = choice[2];

              var isSelectedSlot = self.slot(function(choices, data) {
                try {
                  var isSelected = self.isChoiceSelected(data, choices[index][0]);
                  return !! isSelected;
                } catch (err) {
                  console.error('isSelectedSlot', err);
                  return false;
                }
              });
              var isDisabledSlot = self.slot(function(choices, data, maxSelected) {
                try {
                    if ( isFinal ) {
                      return true;
                    }

                    var isSelected = self.isChoiceSelected(data, choices[index][0]);
                    return !! (! isSelected && self.maxSelectedBehviour == 'DISABLE' && data.length >= maxSelected);
                } catch (err) {
                  console.error('isDisabledSlot', err);
                  return false;
                }
              });

              var cls =  choice[0] && choice[0].cls_ && choice[0].cls_.id;

              this
                .start(self.choiceView, {
                  data$: valueSimpSlot,
                  label$: labelSimpSlot,
                  isSelected$: isSelectedSlot,
                  isDisabled$: isDisabledSlot,
                  of: cls
                })
                  .call(function() {
                    self.onDetach(this.clicked.sub(() => {
                      let indexDataToAdd = self.getIndexOfChoice(self.data, valueSimpSlot.get());
                      let array = [
                        ...self.data
                      ];
                      if ( indexDataToAdd === -1 ) {
                        if ( self.data.length >= self.maxSelected ) {
                          if ( self.maxSelectedBehviour == 'DISABLE' ) return;
                          array[self.maxSelectedBehviour.name.toLowerCase()].call(array);
                        }
                        array = [
                          ...array,
                          valueSimpSlot.get()
                        ];
                      } else {
                        array.splice(indexDataToAdd, 1);
                      }
                      self.data = array;
                    }));
                  })
                .end();
          });
        })).end();
      };

      this
        .add(this.dynamic(function(showMinMaxHelper) {
          if ( ! showMinMaxHelper ) return;
          this
          .start(foam.u2.layout.Rows)
            .start()
              .addClass('p', self.myClass('helpTextRow'))
              .add(self.helpText_$)
            .end()
          .end();
        }))
        .call(renderEl);
    },

    function mustSlot(v) {
      return foam.lang.Slot.isInstance(v) ?
        v :
        foam.lang.SimpleSlot.create({ value: v });
    }
  ],

  listeners: [
    {
      name: 'onDAOUpdate',
      isFramed: true,
      code: function() {
        if ( ! this.useDao && ! this.dao || ! foam.dao.DAO.isInstance(this.dao) ) return;

        var of = this.dao.of;
        if ( of._CHOICE_TEXT_ ) {
          this.dao.select(this.PROJECTION(of.ID, of._CHOICE_TEXT_)).then(s => {
            this.choices      = s.projection;
            this.isDaoFetched = true;
          });
          return;
        }
        console.warn('Inefficient ChoiceView. Consider creating transient _choiceText_ property on ' + of.id + ' DAO, prop: ' + this.prop_);

        /* Ex.:
        {
          class: 'String',
          name: '_choiceText_',
          transient: true,
          javaGetter: 'return getName();',
          getter: function() { return this.name; }
        }
        */
        var p = this.mode === foam.u2.DisplayMode.RW ?
          this.dao.select().then(s => s.array) :
          this.dao.find(this.data).then(o => o ? [o] : []);

        p.then(a => {
          var choices = a.map(this.objToChoice);
          var choiceLabels = a.map(o => this.objToChoice(o)[1]);
          Promise.all(choiceLabels).then(resolvedChoiceLabels => {
            for ( let i = 0; i < choices.length; i++ ) {
              choices[i][1] = resolvedChoiceLabels[i];
            }
            this.choices = choices;
            this.isDaoFetched = true;
          });
        });
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'MinMaxChoiceView',
  extends: 'foam.u2.view.MultiChoiceView',
  description: 'ChoiceView with additional support to make it compatible with MinMaxCapabilities',

  properties: [
    'feedback_',
    {
      name: 'choice',
      // 'choice' is the canonical source of truth. Updating 'choice' is
      // responsible for updating 'index', 'data', and 'text'. Updating any
      // of those properties calls back to updating 'choice'.
      documentation: 'The current choice. (That is, a [value, text, isFinal].)',
      postSet: function(o, n) {
        if ( o === n || this.feedback_ ) return;

        this.feedback_ = true;

        try {
          if ( ! n && this.placeholder ) {
            this.data  = [];
          } else {
            this.data  = n && [n[0]];
          }
        } finally {
          this.feedback_ = false;
        }
      }
    },
    {
      class: 'StringArray',
      name: 'data',
      postSet: function(o, n) {
        if ( o !== n && ! foam.Null.isInstance(n) ) this.choice = this.findChoiceByData(n);
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'selectSpec',
      value: { class: 'foam.u2.view.ChoiceView' }
    },
    {
      class: 'String',
      name: 'placeholder',
      factory: function() { return 'Select...'; }
    },
    'prop_'
  ],

  methods: [
    function render() {
      var self = this;

      this.onDAOUpdate();

      this.start(self.selectSpec, {
        choice$:          self.choice$,
        choices$:         self.choices$,
        placeholder$:     self.placeholder$,
        mode$:            self.mode$,
      })
        .attrs({ name: self.name })
      .end();
    },

    function fromProperty(p) {
      this.SUPER(p);
      this.prop_ = p;
      this.placeholder = p.placeholder;
      this.label = p.label || this.label || p.name;
    },

    function findChoiceByData(data) {
      var choices = this.choices;
      for ( var i = 0 ; i < choices.length ; i++ ) {
        if ( foam.util.equals(choices[i][0], data[0]) ) return choices[i];
      }
    }
  ]
});
