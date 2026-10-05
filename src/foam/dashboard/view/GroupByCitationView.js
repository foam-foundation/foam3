/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'GroupByCitationView',
  extends: 'foam.dashboard.view.DashboardCitationView',

  documentation: `
    A citation view that displays a property value and the number of dao entries that share the same value.
  `,

  imports: [
    'translationService'
  ],

  requires: [
    'foam.comics.v2.DAOBrowseControllerView',
    'foam.u2.stack.StackBlock'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  css: `
    << {
      padding-top: 0px;
      padding-bottom: 0px;
      align-items: center;
    }
    << .foam-u2-ActionView {
      width: 100%;
      height: 100%;
      max-height: none;
      padding: 15px 15px;
    }
    <<row-label {
      width: 100%;
      display: flex;
      justify-content: space-between;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'groupByPropertyName'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.menu.Menu',
      name: 'redirectMenu'
    },
    'dao',
    'customizeKey'
  ],

  methods: [
    async function render() {
      var label = this.customizeKey ? await this.customizeKey(this.data[0]) : this.data[0];
      var count = this.data[1];

      this.addClass(this.myClass())
        .startContext({ data : this })
          .tag(this.CLICK, { 
            label: this.E().addClass(this.myClass('row-label')).start().add(label).end().start().add(count).end(),
            buttonStyle: foam.u2.ButtonStyle.UNSTYLED,
          })
        .endContext();
    }
  ],
  actions: [
    {
      name: 'click',
      code: function(X) {
        var config = this.redirectMenu.handler.config;
        var propertyValue = this.data[0];

        var predicate = this.EQ(this.dao.of.getAxiomByName(this.groupByPropertyName), propertyValue);
      
        config.searchPredicate = predicate;
        config.browseTitle = this.translationService.getTranslation(foam.locale, `${this.redirectMenu.id}.browseTitle`, this.redirectMenu.handler.config.browseTitle);
        config.dao = this.dao;
        
        this.stack.push(this.StackBlock.create({
          view: {
            class: this.DAOBrowseControllerView,
            data$: this.dao$,
            config: config
          }, parent: this.__subContext__ 
        }));
      }
    }
  ]
});
