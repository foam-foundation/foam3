/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ManyToManyRelationshipPropertyView',
  extends: 'foam.u2.View',

  imports: [
    'stack',
  ],

  documentation: 'A sensible default view view of a ManyToManyRelationshipProperty.',

  requires: [
    'foam.u2.table.TableView',
    'foam.u2.view.EmbeddedTableView',
    'foam.comics.v2.DAOControllerConfig'
  ],

  property: [
    'config', 'prop'
  ],

  css: `
<<actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
`,

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this.config = this.DAOControllerConfig.create({ dao: this.data.dao });

      this
        .addClass(this.myClass())
        .tag(this.EmbeddedTableView, {
          data: this.data.dao,
          config: this.config,
        }).call(function() { this.fromProperty(self.prop); });

      if ( this.mode === foam.u2.DisplayMode.RW ) {
        this
          .start('div').addClass(this.myClass('actions'))
            .startContext({ data: this.data })
            .tag(this.data.ADD_ITEM)
            .tag(this.data.REMOVE_ITEM)
            .endContext()
          .end();
      }
    },
    function fromProperty(p) {
      this.prop = p;
      this.SUPER(p);
    }
  ]
});
