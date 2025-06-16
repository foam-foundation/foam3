/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: replace uses of outputLink with Link

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Command',

  implements: [ 'foam.core.auth.Authorizable' ],

  requires: [ 'foam.u2.Link' ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException'
  ],

  imports: [ 'currentBlock', 'log', 'out', 'eval_' ],

  tableColumns: [ 'id', 'description' /*, 'execute_' */ ],

  properties: [
    { class: 'String',  name: 'id' },
    { class: 'String',  name: 'description' },
    { class: 'Code',    name: 'script' },
    { class: 'Boolean', name: 'linkable', value: true },
    { class: 'Boolean', name: 'permissionRequired' }
  ],

  methods: [
    function execute(...args) {
      with ( this ) {
        with ( { args: args, addValue: this.currentBlock.addValue.bind(this.currentBlock) } ) {
          try {
            eval(this.script);
          } catch (x) {
            console.log('Error:', x, 'in:', this.script);
          }
        }
      }
    },
    {
      name: 'authorizeOnCreate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        // nop - open to write
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        if ( getPermissionRequired() ) {
          AuthService auth = (AuthService) x.get("auth");
          if ( ! auth.check(x, "command.read." + getId()) ) {
            throw new AuthorizationException();
          }
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "command.update." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "command.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'execute_',
      label: 'execute',
      isAvailable: function() { return this.linkable; },
      code: function() { this.execute(); }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Help',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'commandDAO' ],

  properties: [
    { name: 'id', value: 'help' },
    [ 'description', 'Display help' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();

      var self = this;
      var shortcuts = [
        [ 'F1',      'Help' ],
        [ 'ESC',     'Toggle prompt display' ],
        [ 'Up',      'Previous from history' ],
        [ 'Down',    'Next from history' ],
        [ 'CMD + k / CTRL + k',  'Clear console' ],
        [ 'CTRL + `', 'Focus input' ]
      ];

      this.out.start('h3').add('Commands').end().
      start('table').style({width: 'max-content'}).
        select(this.commandDAO, function(c) {
          if ( q && ( c.id + c.description ).toLowerCase().indexOf(q) == -1 ) return;

          this.start('tr').
            start('th').attr('width', '250').attr('align', 'left').call(function() {
              if ( c.linkable ) {
                this.start(self.Link).add(c.id).on('click', () => self.eval_(c.id));
              } else {
                this.add(c.id);
              }
            }).end().
            start('td').attr('align', 'left').add(c.description);
        }).
        end().
        br().
        start('h3').add('Keyboard Shortcuts').end().
        start('table').style({width: 'max-content'}).
          forEach(shortcuts, function(c) {
            this.start('tr').
              start('th').attr('width', '250').attr('align', 'left').add(c[0]).end().
              start('td').add(c[1]);
          }).
        end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'HelpFunctions',
  extends: 'foam.core.reflow.cmd.Command',

  properties: [
    { name: 'id', value: 'helpFunctions' },
    [ 'description', 'Display help for built-in functions.' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();

      var self = this;
      var fns  = Object.keys(foam.core.reflow.lib).sort();

      this.out.start('h3').add('Functions').end().
      start('table').style({width: 'max-content'}).
        forEach(fns, function(f) {
          if ( q && f.toLowerCase().indexOf(q) == -1 ) return;

          var comment = foam.Function.functionComment(foam.core.reflow.lib[f]);

          this.start('tr').
            start('th').attr('width', '250').attr('align', 'left').call(function() {
              this.add(f);
            }).end().
            start('td').attr('align', 'left').add(comment);
        }).
        end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Cells',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.demos.sevenguis.Cells' ],

  properties: [
    [ 'description', 'Embed spreadsheet' ]
  ],

  methods: [
    function execute(rows, cols) {
      this.out.tag(this.Cells, rows && cols && { rows: rows, columns: cols});
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Clear',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'clearFlow as clear' ],

  properties: [
    [ 'description', 'Clear console output' ]
  ],

  methods: [
    function execute() {
      this.clear();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAO',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.DAOPrompt' ],

  properties: [
    [ 'description', 'Perform DAO operation' ]
  ],

  methods: [
    function execute(dao, opt_label) {
      var p = this.DAOPrompt.create({dao: dao, daoLabel: opt_label});

      this.out.tag(p);
      this.currentBlock.obj = p; // ???: Why .obj?
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAO2',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.DAOPrompt2' ],

  imports: [ 'createFlowChildName' ],

  properties: [
    [ 'description', 'Perform DAO operation' ]
  ],

  methods: [
    function execute(dao, opt_label) {
      var p = this.DAOPrompt2.create({dao: dao, label: opt_label});

      p.addToE(this.out);
      this.currentBlock.flowName = this.createFlowChildName(p.label.replaceAll(' ', '').toLowerCase());
      this.currentBlock.obj      = p;
      this.currentBlock.value    = p;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOCreateSave',

  properties: [
    { name: 'daoCreate', hidden: true }
  ],

  actions: [
    function save() { this.daoCreate.save(); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOCreate',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.DAOCreate' ],

  properties: [
    [ 'description', 'Add an object to a DAO' ]
  ],

  methods: [
    function execute(daoKey) {
      var value = this.DAOCreate.create({daoKey: daoKey});
      this.currentBlock.value = foam.core.reflow.cmd.DAOCreateSave.create({daoCreate: value});
      this.out.tag(value);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAOS',
  extends: 'foam.core.reflow.cmd.Command',

  mixins: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.boot.CSpec', 'foam.lang.Latch' ],

  imports: [ 'AuthenticatedCSpecDAO as cSpecDAO', 'commandDAO' ],

  properties: [
    [ 'description', 'Display available DAO services', 'uploadAvailable' ]
  ],

  methods: [
    function execute(opt_nameQuery) {
      var self = this;
      this.commandDAO.find('upload').then( r => this.uploadAvailable = !! r );
      var dao  = this.cSpecDAO.where(this.CSpec.SERVED_DAOS);
      var count = foam.lang.SimpleSlot.create({value: 0});
      if ( opt_nameQuery ) dao = dao.where(
        this.OR(
          this.CONTAINS_IC(this.CSpec.NAME,     opt_nameQuery),
          this.CONTAINS_IC(this.CSpec.KEYWORDS, opt_nameQuery)
        ));
      this.out.tag('br');
      this.out.start('table').attr('width', '100%').
        select(dao, function(n) {
          var sdao  = self.__context__[n.name];
          var of    = sdao.of;

          if ( ! of ) {
            console.log('Bad DAO:', n.name);
            return;
          }

          count.value++;
          var daoFn = () => self.eval_('dao("' + n.name + '")');
          var addFn = () => self.eval_('add("' + n.name + '")');
          var uplFn = () => self.eval_('upload("' + n.name + '")');
          var desFn = () => self.eval_('describe(' + of.id + ')');

          var shortName = n.name;
          if ( shortName.endsWith('DAO') ) shortName = shortName.substring(0, shortName.length-3);

          this.start('tr').
            start('th').attr('align', 'left').
              start(self.Link).add(shortName).on('click', daoFn).end().
            end().
            start('td').attr('align', 'left').
              start(self.Link).add(of.id).on('click', desFn).end().
            end().
            start('td').attr('align', 'left').
              style({
                textWrapMode: 'nowrap',
                overflow: 'hidden',
                paddingRight: '8px',
                maxWidth: '500px',
                textOverflow: 'ellipsis'
              }).
              add(n.description).
            end().
            start('td').attr('align', 'left').
              start(self.Link).add('add').on('click', addFn).end().
            end().
            start('td').attr('align', 'left').
              show(self.uploadAvailable).
              start(self.Link).add('upload').on('click', uplFn).end().
            end()
            ;
        }).
        start('b').add(count, ' selected').end();
    }
  ]
});

/*
  foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AxiomInfo',

  ids: [ 'name' ],

  properties: [
    {
      class: 'String',
      name: 'type',
      label: 'Axiom Type'
    },
    {
      class: 'String',
      name: 'source',
      label: 'Source Class'
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'path',
      label: 'Source Path'
    }
  ]
});
*/

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Describe',
  extends: 'foam.core.reflow.cmd.Command',

  properties: [
    [ 'description', 'Describe a class' ]
  ],

  methods: [
    function execute(cls) {
      if ( foam.String.isInstance(cls) ) {
        cls = foam.lookup(cls);
        if ( cls == null ) {
          log('Unknown class');
          return;
        }
      }
      // TODO: add ability to specify how SimpleClassView writes links so it can hyperlink back to this command
      this.out.startContext({conventionalUML: true}).
        tag(foam.doc.SimpleClassView, {data: cls, showUML: true});
      /*
      this.out.br().add('CLASS:  ', cls.name, ' extends: ');
      this.outputLink(cls.__proto__.id, () => this.eval_('describe(' + cls.__proto__.id + ')'), this.out);
      var dao = foam.dao.ArrayDAO.create({of: foam.core.reflow.AxiomInfo});

      for ( var key in cls.axiomMap_ ) {
        var a = cls.axiomMap_[key];
        dao.put(foam.core.reflow.AxiomInfo.create({
          type: a.cls_ ? a.cls_.name : 'anonymous',
          source: (a.sourceCls_ && a.sourceCls_.name) || 'unknown',
          name: a.name,
          path: a.source || ''
        }));
      }
      dao.select(console);

      this.out.tag({class: 'foam.u2.table.TableView', data: dao});
      */
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Flows',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'flowDAO' ],

  properties: [
    [ 'description', 'Display saved flows' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();
      var self = this;
      this.out.start('table').select(this.flowDAO, function(f) {
        if ( q != undefined && (f.id + f.status + f.description).toLowerCase().indexOf(q) == -1 ) return;
        this.start('tr').
          start('td').start(self.Link).add(f.name).on('click', () => self.eval_('load("' + f.name + '")')).end().end().
          start('td').add(f.status).end().
          start('td').add(f.description).end().
        end();
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'History',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'history_' ],

  properties: [
    [ 'description', 'Display previously executed commands' ]
  ],

  methods: [
    function execute(q) {
      if ( q ) q = q.toLowerCase();
      this.history_.forEach(h => {
        if ( q != undefined && h.toLowerCase().indexOf(q) == -1 ) return;
        this.out.tag('br');
        this.out.start(this.Link).add(h).on('click', () => this.eval_(h));
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'MQLHelp',
  extends: 'foam.core.reflow.cmd.Command',

  properties: [
    [ 'description', 'Display MQL Help' ]
  ],

  methods: [
    function execute() {
      this.out.start('pre').style({'font-family': 'monospace'}).add(`key:value                  key contains "value"
key=value                  key exactly matches "value"
key:value1,value2          key contains "value1" OR "value2"
key:(value1|value2)        "
key1:value key2:value      key1 contains value AND key2 contains "value"
key1:value AND key2:value  "
key1:value and key2:value  "
key1:value OR key2:value   key1 contains value OR key2 contains "value"
key1:value or key2:value   "
key:(-value)               key does not contain "value"
(expr)                     groups expression
-expr                      not expression, ie. -pri:1
NOT expr                   not expression, ie. NOT pri:1
has:key                    key has a value
is:key                     key is a boolean TRUE value
key>value                  key is greater than value
key-after:value            "
key<value                  key is less than value
key-before:value           "
date:YY/MM/DD              date specified
date:today                 date of today
date-after:today-7         date newer than 7 days ago
date:d1..d2                date within range d1 to d2, inclusive
key:me                     key is the current user

Date formats:
YYYY-MM
YYYY-MM-DD
YYYY-MM-DDTHH
YYYY-MM-DDTHH:MM`);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Models',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [
    'foam.demos.sevenguis.Cells'
  ],

  imports: [ ],

  properties: [
    [ 'description', 'Browse Models' ]
  ],

  methods: [
    function execute() {
      this.out.tag(foam.doc.DocBrowser);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Quote',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ ],

  properties: [
    [ 'description', 'Blockquote' ]
  ],

  methods: [
    function execute(t) { this.out.start('blockquote').add(t); }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Load',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'flow', 'flowDAO', 'selected' ],

  properties: [
    [ 'description', 'Load a specified flow' ]
  ],

  methods: [
    async function execute(flowName) {
      if ( ! flowName ) return;
      var loaded = await this.flowDAO.find(flowName);

      if ( loaded ) {
        // Don't save the 'load' command
        this.currentBlock.del();

        this.selected = this.flow;
        this.flow.copyFrom(loaded);
      } else {
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Save',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [  'currentBlock', 'flow', 'flowDAO', 'save' ],

  properties: [
    [ 'description', 'Save the current flow to a specified name' ]
  ],

  methods: [
    function execute(opt_flowName) {
      if ( opt_flowName ) {
        this.flow.name = opt_flowName;
      }

      // Don't save the 'save' command
      this.currentBlock.del();

      if ( ! this.save() ) {
        this.out.add('Please provide a name for the flow');
        return;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Services',
  extends: 'foam.core.reflow.cmd.Command',

  mixins: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.boot.CSpec' ],

  imports: [ 'AuthenticatedCSpecDAO as cSpecDAO' ],

  properties: [
    [ 'description', 'Display available services' ]
  ],

  methods: [
    function execute(opt_nameQuery) {
      var self = this;
      var dao  = this.cSpecDAO.where(this.CSpec.SERVED_SERVICES);
      if ( opt_nameQuery ) dao = dao.where(
        this.OR(
          this.CONTAINS_IC(this.CSpec.NAME,     opt_nameQuery),
          this.CONTAINS_IC(this.CSpec.KEYWORDS, opt_nameQuery)
        ));
      this.out.tag('br');
      this.out.start('table').attr('width', '100%').
        select(dao, function(n) {
          var sdao = self.__context__[n.name];
          this.start('tr').
            start('th').attr('align', 'left').call(function() {
              this.add(n.name);
            }).end().
            start('td').attr('align', 'left').add(n.description);
        });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Login',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.auth.login.LoginView' ],

  properties: [
    [ 'description', 'Login from flow' ]
  ],

  methods: [
    function execute() {
      var p = this.LoginView.create({mode_: 0});

      this.out.tag(p);
      this.currentBlock.obj = p;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Prompt',

  imports: [ 'params' ],

  properties: [
    {
      class: 'String',
      name: 'prompt'
    },
    {
      class: 'String',
      name: 'urlParameter'
    },
    {
      name: 'value',
      transient: true
    }
  ],

  methods: [
    function init() {
      this.SUPER();

      if ( this.params && this.params[this.urlParameter] != undefined ) {
        this.value = this.params[this.urlParameter];
      }
    },

    function toString() {
      return this.value.toString();
    },

    function valueOf() {
      return this.value.valueOf();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Input',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.cmd.Prompt' ],

  methods: [
    function execute(prompt) {
      var p = this.Prompt.create();

      if ( prompt ) p.prompt = prompt;

      this.currentBlock.value = p;

      this.out.startContext({data: p}).start('span').add(p.prompt$, ' ', p.VALUE);
    }
  ]
});
