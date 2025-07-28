/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.view',
  name: 'SuggestedTextField',
  extends: 'foam.u2.View',

  documentation: 'recommends values based on search characters and the provided autocompleter. Look at foam.u2.autocompleter for implementation of the search predicate.',

  requires: [
    'foam.u2.Autocompleter',
    'foam.u2.CitationView',
    'foam.u2.TextField',
    'foam.u2.LoadingSpinner'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'onRowSelect?'
  ],

  css: `
    ^ {
      position: relative;
    }
    ^suggestions {
      box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.06), 0px 4px 6px rgba(0, 0, 0, 0.1);
      background-color: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      height: auto;
      margin-top: 2px;
      overflow: auto;
      padding: 12px;
      gap: 8px;
      position: absolute;
      width: 100%;
      z-index: 100;
    }
    ^row {
      color: $textDefault;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
    }
  `,

  messages: [
    { name: 'SUGGESTIONS_MSG',    message: 'Suggestions' },
    { name: 'NO_SUGGESTIONS_MSG', message: 'No Suggestions' },
    { name: 'MORE_SUGGESTIONS',   message: 'Refine search to see more results' }
  ],

  properties: [
    'prop',
    {
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Autocompleter',
      name: 'autocompleter',
      factory: function() {
        if ( ! this.daoKey ) console.error('No daokey');
        return this.Autocompleter.create({ dao: this.__subContext__[this.daoKey] })
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView',
      value: {
        class: 'foam.u2.CitationView'
      }
    },
    {
      name: 'onSelect',
      value: function(obj) {
        this.data = obj.toSummary();
      }
    },
    {
      class: 'String',
      name: 'title',
      factory: function() {
        return this.SUGGESTIONS_MSG;
      }
    },
    {
      class: 'String',
      name: 'emptyTitle',
      factory: function() {
        return this.NO_SUGGESTIONS_MSG;
      }
    },
    {
      class: 'Array',
      name: 'filteredValues'
    },
    {
      class: 'String',
      name: 'placeholder'
    },
    {
      class: 'Boolean',
      name: 'suggestOnFocus'
    },
    {
      class: 'Int',
      name: 'suggestionsLimit',
      value: 50,
      documentation: 'Limits the number of suggestions displayed'
    },
    {
      class: 'Boolean',
      name: 'refineInput'
    },
    {
      class: 'Boolean',
      name: 'loading',
    },
    {
      class: 'String',
      name: 'error',
      documentation: 'When populated and autocompleter is done loading, displays the error'
    },
    'inputFocused'
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      var callFromProperty = function() {
        self.prop && this.fromProperty && this.fromProperty(self.prop);
      };
      if ( this.autocompleter )
        this.autocompleter.partial$ = this.data$;

      this.onDetach(this.data$.sub(function() {
        if ( self.data )
          self.inputFocused = true;
      }));

      // Initialize loaded listener after render
      this.loaded();
      this
      .addClass()
      .start(this.TextField, {
        data$: this.data$,
        onKey: true,
        placeholder$: this.placeholder$,
        autocomplete: false
      })
        .call(callFromProperty)
        .on('focus', () => {
          this.inputFocused = true;
        })
        .on('blur', () => {
          this.inputFocused = false;
        })
      .end()
      .add(this.slot(this.populate));
    },
    function populate(filteredValues, data, inputFocused, suggestOnFocus, loading, error) {
      const self = this;
      if ( ( ! data && ! suggestOnFocus ) || ! inputFocused ) return this.E();
      if ( loading ) return this.E().addClass(this.myClass('suggestions')).tag(self.LoadingSpinner, {size: '32px'})
      if ( error ) return this.E().addClass(this.myClass('suggestions')).add(this.error);
      return this.E().addClass(this.myClass('suggestions'))
        .start().addClass('p-semiBold').add(this.title).end()
        .forEach(filteredValues, function(obj) {
          this
            .start(self.rowView, { data: obj })
              .addClass(self.myClass('row'))
              .on('mousedown', function(e) {
              // using mousedown not click since mousedown is fired before blur is fired so we can intercept rowClick
              // otherwise when using click the blur gets fired first and the row listener is never called
                let fn = self.onRowSelect ? self.onRowSelect(obj) : self.onSelect.call(self, obj);
                fn.then(() => {
                  self.inputFocused = false;
                });

                e.preventDefault();
              })
            .end();
        })
        .add(this.refineInput$.map(v => v ? self.MORE_SUGGESTIONS : this.E().style({ display: 'contents' })));
    },
    function fromProperty(prop) {
      this.prop = prop;
    }
  ],

  listeners: [
    {
      name: 'onUpdate',
      isFramed: true,
      code: function() {
        this.filteredValues = [];
        this.error = '';
        this.loading = true;
        const self = this;
        let dao = this.autocompleter.filteredDAO;
        if ( this.suggestionsLimit > 0 ) {
          dao = dao.limit(this.suggestionsLimit);
        }
        dao.select()
          .then(sink => {
            this.filteredValues = sink.array;
            if ( ! this.filteredValues.length ) this.error = this.NO_SUGGESTIONS_MSG;
            this.loading = false;
          });
        if ( this.suggestionsLimit > 0 ) {
          // required to check if more elements are available to render
          this.autocompleter.filteredDAO.limit(this.suggestionsLimit+1).select(this.Count.create()).then( count => {
            self.refineInput = count.value > self.suggestionsLimit;
          });
        }
      }
    },
    function loaded() {
      this.onDetach(this.autocompleter.filteredDAO$proxy.sub(this.onUpdate));
      this.onUpdate();
    }
  ]
});
