/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


// TODO: Temporarily hide 'type' Property until it can be handled properly.
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
        [ 'String', 'Abc' ],
        [ 'Long',   '##' ],
        [ 'Double', '##.##' ],
        [ 'Boolean', 'Y/N' ],
//        [ 'Date', 'YYYY/MM/DD' ],
//        [ 'DateTime', 'YYY/MM/DD HH:MM:SS' ],
        [ 'EMail', 'username@email.com' ],
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
    }
  ],

  methods: [
    function toString() {
      return this.value.toString();
    },

    function valueOf() {
      return this.value.valueOf();
    },

    function addToE(e) {
      var self = this;
      e.add(this.dynamic(function(type) {
        var prop = self.prop = foam.lang[type].create({ name: 'value' });
        let traceId = 'el-' + foam.next$UID();
        prop.view = {...(self.view || prop.view), id: traceId};
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
      }));
    }
  ]
});
