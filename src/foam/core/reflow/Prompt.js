/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// TODO: Temporarily hide 'type' Property until it can be handled properly.
// TODO: Rename to something else because Prompt has another meaning these days
// Is currently used for String queries not as objects.
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Prompt',

  imports: [ 'params' ],

  sections: [
    {
      name: '_defaultSection',
      title: 'General'
    },
    {
      name: 'viewSection',
      title: 'View'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'label'
    },
    {
      class: 'String',
      name: 'supportingLabel'
    },
    {
      class: 'String',
      name: 'urlParameter'
    },
    {
      class: 'String',
      name: 'type',
      value: 'String',
      hidden: true,
      reactive: false,
      postSet: function() { this.value = undefined; this.value; },
      view: { class: 'foam.u2.view.ChoiceView', choices: [
        [ 'String',   'Abc' ],
        [ 'Long',     '##' ],
        [ 'Double',   '##.##' ],
        [ 'Boolean',  'Y/N' ],
        [ 'Date',     'YYYY/MM/DD' ],
        [ 'DateTime', 'YYY/MM/DD HH:MM:SS' ],
        [ 'EMail',    'username@email.com' ],
        'Color'
      ] }
    },
    {
      name: 'defaultValue',
      postSet: function(o, n) {
        if ( ! this.value )
//          this.value = foam.lang[this.type].ADAPT.value(null, this.defaultValue);
          this.value = n;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      section: 'viewSection',
      label: '',
      view: function (_, X) {
        return { class: 'foam.u2.view.ViewConfiguratorView', traceId$: X.data$.dot('traceId') };
      }
    },
    {
      name: 'traceId',
      hidden: true,
      transient: true
    },
    {
      name: 'value',
      transient: true,
      visibility: 'RO',
      view: function(_, X) {
        return X.data.prop.view || { class: 'foam.u2.view.ValueView' };
      },
      factory: function() {
        if ( this.params && this.params[this.urlParameter] != undefined ) {
          return this.params[this.urlParameter];
        }
        return this.defaultValue;
      }
    },
    {
      name: 'prop',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'blocking',
      value: false,
      documentation: `
        When true, loading a saved flow waits until the user answers this
        input before running the blocks after it. Use it when later blocks
        need the answer, e.g. a reconciliation date the report queries filter on.
      `
    },
    {
      name: 'readyLatch_',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.lang.Latch.create();
      }
    }
  ],

  methods: [
    async function onLoad() {
      await this.readyLatch_;

      // The flow load calls onLoad after this block is on the page
      // (Console.includeScript), so the user can see the field it waits on.
      // Returning a promise from input() instead would wait inside eval_,
      // before the block is added, on a field nobody can see.
      if ( this.blocking ) return this.answer();
    },

    async function answer() {
      // Resolves with the user's answer. A value supplied by the URL
      // parameter already counts as an answer, so ?reconDate=2026-11-01
      // resolves at once instead of waiting for the user.
      if ( this.urlParameter && this.params && this.params[this.urlParameter] != undefined ) return Promise.resolve(this.value);

      await this.readyLatch_;

      return new Promise(resolve => {
        var s = this.value$.sub(() => {
          // An empty value is not an answer. Showing the field can write ''
          // into a question nobody has answered yet, and without this check
          // ask input("What's your name?") replied '' at once.
          if ( this.value === '' || this.value == null ) return;
          s.detach();
          resolve(this.value);
        });
      });
    },

    function toString() {
      return this.value.toString();
    },

    function valueOf() {
      return this.value.valueOf();
    },

    function addToE(e) {
      var self = this;
      e.add(this.dynamic(function(type) {
        var prop    = self.prop = foam.lang[type].create({ name: 'value' });
        let traceId = 'el-' + foam.next$UID();

        // Use the TextField to edit Date and DateTime fields because they don't cause premature update events
        if ( type === 'Date' ) prop.view = { class: 'foam.u2.TextField', type: 'date' };
        else if ( type === 'DateTime' ) prop.view = { class: 'foam.u2.TextField', type: 'datetime-local' };

        prop.view = {...(self.view || prop.view), id: traceId, onKey: false, autofocus: true};

        this.startContext({data: self})
          .start(prop.__, { config: { label$: self.label$ } })
            .call(function() {
              // Now in the context of the property border
              this.prop.supportingLabel$.mapFrom(self.supportingLabel$, v => {
                return v;
              })
            })
          .end()
        .endContext();
        self.traceId = traceId;
        self.readyLatch_.resolve();
      }));
    }
  ]
});
