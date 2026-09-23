/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.reflow',
  name: 'Controller',
  extends: 'foam.u2.Element',

  requires: [
    'foam.dao.EasyDAO',
    'foam.core.reflow.cmd.Command',
    'foam.core.reflow.ToolbarControl',
    'foam.core.reflow.Console',
    'foam.core.reflow.SinkAgent'
  ],

  exports: [
    'agentDAO',
    'commandDAO',
    'isMenuOpen',
    'showNav',
    'toolbarControlDAO'
  ],

  css: `
  `,

  properties: [
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
          daoType: 'MDAO',
          testData: [
          ]
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
              "class":"foam.core.reflow.ToolbarControl",
              "id":"auto",
              "order":0,
              "permissionRequired":true,
              "view":"foam.core.reflow.control.AutoControl"
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
    }
  ],


  methods: [
    async function loadData() {
      let self = this;

      await fetch('agents.json')
        .then(res => res.text())
        .then(function(o) {
          foam.json.objectify(eval(o)).forEach(o => {
            o = foam.json.parse(o, null, self.__subContext__);
//            console.log('agent:', o);
            self.agentDAO.put(o);
          });
        });

      await fetch('cmds.json')
        .then(res => res.text())
        .then(function(o) {
          foam.json.objectify(eval(o)).forEach(o => {
            o = foam.json.parse(o, null, self.__subContext__);
            self.commandDAO.put(o);
          });
        });

    },

    async function render() {
      await this.loadData();

      this.
        addClass();
      this.tag(this.Console);
    }
  ]
});
