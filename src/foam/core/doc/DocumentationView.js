/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.doc',
  name: 'DocumentationView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.Router'],

  css: `
    ^ {
      padding-left: 12px;
      max-width: 800px;
    }
    ^ table { width: 100%; }
    ^ td , ^ th {
      text-align: left;
      padding: 8pt;
    }
    ^ th {
      font-weight: bold;
      background-color: $backgroundInverseTertiary;
    }
    ^ tr:nth-child(even) td:nth-child(odd) {
      background-color: $backgroundSecondary;
    }
    ^ tr:nth-child(even) td:nth-child(even) {
      background-color: $backgroundInverseTertiary;
    }
    ^ tr:nth-child(odd) td:nth-child(even) {
      background-color: $backgroundSecondary;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Documentation' }
  ],

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.TITLE;
      }
    },
    {
      class: 'String',
      name: 'docKey',
      memorable: true,
      shortName: 'route',
      documentation: 'ID of the document to render.'
    },
    {
      class: 'String',
      name: 'defaultDocument'
    },
    {
      class: 'String',
      name: 'daoKey',
      value: 'documentDAO'
    },
    {
      class: 'String',
      name: 'anchor'
    },
    {
      name: 'data'
    },
    'error'
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));
    },

    function render() {
      var self = this;
      var dao = this.__context__[this.daoKey];
      this.addClass();
      if ( ! dao ) {
        this.add('No DAO found for key: ', this.daoKey);
      } else this.add(this.slot(function(data, error, docKey) {
        var key = docKey || self.defaultDocument;
        if ( (! data || !foam.util.equals(data.id, key) ) && ! error) {
          dao.find(key).then(function(doc) {
            if ( doc ) this.data = doc;
            else this.error = 'Not found.';
          }.bind(this), function(e) {
            this.error = e.message ? e.message : '' + e;
          }.bind(this));
          return this.E('span').add('Loading...');
        }
        if ( ! data ) {
          return this.E('span').add(this.error);
        }
        return data.toE(null, this.__subSubContext__);
      }));
    }
  ]
});
