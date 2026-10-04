/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: looks like there's a bug in cSpecDAO and flowDAO.where(IN)
foam.CLASS({
  package: 'foam.demos.reflow',
  name: 'Controller',
  extends: 'foam.u2.Element',

  requires: [
    'foam.dao.EasyDAO',
    'foam.core.reflow.cmd.Command',
    'foam.core.reflow.ToolbarControl',
    'foam.core.reflow.Console',
    'foam.core.reflow.Flow',
    'foam.core.reflow.SinkAgent',
    'foam.ai.vector.VectorEmbedding'
  ],

  exports: [
    'as ctrl',
    'agentDAO',
    'commandDAO',
    'cSpecDAO',
    'flowDAO',
    'isMenuOpen',
    'showNav',
    'toolbarControlDAO',
    'vectorStoreDAO',
    '__DO_NOT_WARN_MISSING_CONTEXT_VALUE__'
  ],

  css: `
  `,

  properties: [
    {
      name: '__DO_NOT_WARN_MISSING_CONTEXT_VALUE__',
      value: true
    },
    {
      class: 'Boolean',
      name: 'showNav'
    },
    {
      class: 'Boolean',
      name: 'isMenuOpen'
    },
    {
      name: 'commandDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: this.Command,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'toolbarControlDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: this.ToolbarControl,
          daoType: 'MDAO',
          testData: [
            {
              "class": "foam.core.reflow.ToolbarControl",
              "id": "auto",
              "order": 0,
              "permissionRequired": true,
              "view": "foam.core.reflow.control.AutoControl"
            }
          ]
        });
      }
    },
    {
      name: 'agentDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: this.SinkAgent,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'flowDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: this.Flow,
          daoType: 'MDAO'
        });
      }
    },
    {
      name: 'cSpecDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: foam.core.boot.CSpec,
          daoType: 'MDAO',
          testData: [
            { "class": "foam.core.boot.CSpec", name: 'agentDAO',   serve: true },
            { "class": "foam.core.boot.CSpec", name: 'commandDAO', serve: true },
            { "class": "foam.core.boot.CSpec", name: 'cSpecDAO',   serve: true },
            { "class": "foam.core.boot.CSpec", name: 'flowDAO',    serve: true }
          ]
        });
      }
    },
    {
      name: 'vectorStoreDAO',
      factory: function() {
        return this.EasyDAO.create({
          of: this.VectorEmbedding,
          daoType: 'IDB'
        });
      }
    }
  ],


  methods: [
    function loadDAO(dao, file) {
      let self = this;

      return fetch(file + '.json')
        .then(res => res.text())
        .then(function(o) {
          foam.json.objectify(eval(o)).forEach(o => {
            o = foam.json.parse(o, null, self.__subContext__);
            dao.put(o);
          });
        });
    },

    async function loadData() {
      await this.loadDAO(this.agentDAO,   'agents');
      await this.loadDAO(this.commandDAO, 'cmds');
      await this.loadDAO(this.flowDAO,    'flows');
    },

    async function render() {
      // Install CSS
      foam.core.controller.AppStyles.create();
      foam.core.controller.Fonts.create();

      await this.loadData();

      this.
        addClass().
        tag(this.Console);
    }
  ]
});
