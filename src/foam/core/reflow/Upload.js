/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Could use foam.lib.csv.DynamicHeaderCSVParser if need to support inner-objects

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOHolder',

  properties: [
    { name: 'preview', hidden: true }
  ]
});



foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Mapping',

  constants: {
    UNKNOWN: { name: '--', set: function() {}, cls_: { name: '--' } }
  },

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      name: 'handler',
      view: function(_, X) {
        return { class: 'foam.core.reflow.PropertyChoiceView', of: X.data.of };
      }
    },
    {
      name: 'of',
      hidden: true
    }
  ],

  methods: [
    function process(obj, value) {
      if ( foam.String.isInstance(value) ) value = value.trim();
      if ( value !== '' ) {
        this.handler.set(obj, value);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'MappingsView',
  extends: 'foam.u2.Controller',

  properties: [ 'data' ],

  css: `
    ^ .foam-u2-tag-Select { height: 20px; }
    ^ td { padding: 2px 10px; }
  `,

  methods: [
    function render() {
      this.SUPER();

      this.addClass().
      start('table').start('tr').
        start('td').style({fontWeight: 'bold'}).add('Property').end().
        start('td').style({fontWeight: 'bold'}).add('Handler').end().
        start('td').style({fontWeight: 'bold'}).add('Type').end().
        start('td').style({fontWeight: 'bold'}).add('Required').end().
      end().
      add(function(data) {
        this.forEach(data, function(d) {
          this.
            startContext({data: d}).
            start('tr').
              start('td').add(d.id).end().
              start('td').add(d.HANDLER).end().
              start('td').add(d.handler$.map(h => h.cls_.name)).end().
              start('td').add(d.handler$.map(h => h.required)).end();
        });
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Upload',

  requires: [
    'foam.dao.MDAO',
    'foam.lib.csv.CSVParser',
    'foam.core.reflow.ColumnParser',
    'foam.core.reflow.DAOHolder',
    'foam.core.reflow.Mapping',
    'foam.core.reflow.UploadAgent'
  ],

  imports: [ 'currentBlock?', 'eval_?', 'setTimeout' ],

  properties: [
    {
      class: 'String',
      name: 'daoKey',
      label: 'DAO',
      adapt: function(o, n) {
        if ( this.__context__[n] ) return n;
        if ( this.__context__[n + 'DAO'] ) return n + 'DAO';
        if ( n.endsWith('s') ) return n.substring(0, n.length-1) + 'DAO';
        return n;
      }
    },
    {
      name: 'dao',
      hidden: true,
      factory: function() {
        return this.__context__[this.daoKey];
      }
    },
    {
      class: 'String',
      name: 'format',
      value: 'AUTO',
      view: { class: 'foam.u2.view.ChoiceView', choices: [ 'AUTO', 'DAO', 'CSV', 'JSON', 'XML' ] }
    },
    {
      class: 'String',
      name: 'sourceDAOKey',
      label: 'Source DAO',
      adapt: function(o, n) {
        if ( this.__context__[n] ) return n;
        if ( this.__context__[n + 'DAO'] ) return n + 'DAO';
        if ( n.endsWith('s') ) return n.substring(0, n.length-1) + 'DAO';
        return n;
      },
      visibility: function(format) { return format === 'DAO' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      }
    },
    {
      name: 'sourceDAO',
      hidden: true,
      expression: function(sourceDAOKey) {
        return this.__context__[sourceDAOKey];
      }
    },
    {
      class: 'String',
      name: 'delimiter',
      value: ',',
      visibility: function(format) { return format === 'CSV' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      },
      width: 1
    },
    {
      class: 'String',
      name: 'tagName',
      value: 'CardFinancial',
      visibility: function(format) { return format === 'XML' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      }
    },
    {
      class: 'Int',
      name: 'processing',
      visibility: 'RO'
    },
    {
      class: 'Int',
      name: 'progress',
      view: { class: 'foam.u2.ProgressView' }
    },
    {
      class: 'Int',
      name: 'rows',
      visibility: 'RO'
    },
    {
      class: 'String',
      name: 'input',
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 100 }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.Mapping',
      name: 'mappings',
      view: 'foam.core.reflow.MappingsView',
      factory: function() { return []; }
    },
    {
      class: 'String',
      name: 'output',
      label: 'Errors',
      view: {
        class: 'foam.u2.HTMLView',
        nodeName: 'pre'
      },
      visibility: 'RO'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data',
      factory: function() {
        return this.MDAO.create({of: this.dao.of});
      },
      hidden: true
    },
    { name: 'block', hidden: true, postSet: function(o, n) { if ( ! n ) debugger; } },
    {
      name: 'of',
      transient: true,
      hidden: true,
      expression: function (dao) { return dao.of; }
    },
    {
      name: 'columnParser',
      transient: true,
      hidden: true,
      expression: function (of) {
        return this.ColumnParser.create({of: of});
      }
    },
    {
      class: 'Boolean',
      name: 'bulkUpload',
      value: true
    }
  ],

  methods: [
    function init() {
      this.SUPER();

      if ( this.currentBlock ) {
        this.block        = this.currentBlock;
        this.block.upload = this;
        this.block.value  = this.DAOHolder.create({preview: this.data});
      }
    },

    function parseColumns(s) {
      if ( s === this.lastColumns ) return this.mappings;
      var mappings = [];

      s.trim().split(',').forEach(c => {
        if ( c.indexOf(' ') != -1 ) {
          c = c.split(' ').map((n, i) => { n = n.toLowerCase(); if ( i ) n = foam.String.capitalize(n); return n; }).join('');
        }

        var prop = this.columnParser.parseString(c);
        mappings.push(this.Mapping.create({id: c, handler: prop || this.Mapping.UNKNOWN, of: this.of}));
        if ( ! prop ) {
          this.output += '<span style="color:red">Unknown property: ' + c + '</span><br>';
        }
      });

      this.mappings = mappings;
      this.lastColumns = s;

      return this.mappings;
    },

    async function process(real) {
      var self  = this;
      var latch = foam.lang.Latch.create();
      await this.data.removeAll();
      this.processing = 0;
      this.clear();
      console.time('upload');
      var i = 1;
      var agent;

      var sink = this.bulkUpload ? {
        put: async function(o) {
          self.processing = Math.max(self.processing, i);
          self.progress   = self.rows ? Math.max(self.progress, Math.floor(100 * i / self.rows)) : 0;

          if ( o.errors_ ) {
            //            self.output += '<span style="color:red">' + o.errors_ + ', row: ' + i + '<br>' + row + '</span>';
            self.output += '<span style="color:red">' + o.errors_.map(e => e[0].name + ' ' + e[1]).join(', ') + '</span><br>';
          }

          if ( ! real ) {
            if ( foam.lang.Long.isInstance(o.ID) && ! o.id ) o.id = i;
            self.data.put(o);
          } else {
            if ( ! agent ) agent = self.UploadAgent.create();
            agent.data.push(o);
            if ( i && i % 1000 === 0 ) {
              var oldAgent = agent;
              agent = undefined;
              if ( i && i % 10000 === 0 ) {
                await self.dao.cmd(oldAgent);
              } else {
                self.dao.cmd(oldAgent);
              }
              // Wait 0ms so that the GUI (including the upload progress) can update
              await new Promise(r => self.setTimeout(r, 0));
            }
          }
          i++;
        },
        eof: async function() {
          if ( agent ) await self.dao.cmd(agent);
          self.progress = 100;
          console.timeEnd('upload');
          latch.resolve('eof');

          if ( ! real ) {
            var block = self.block;
            self.eval_(`dao(${block.flowName}.preview, '${block.flowName}.preview')`);
            var block2 = self.currentBlock;
            block2.flowName = block.flowName + 'data';
            block2.obj.limit = 10;
            setTimeout(() => {
              // Needed because it is the SinkView which creates the 'select' object
              block2.obj.run();
            }, 100);
          }
        }
      } : {
        put: self.dao.put.bind(self.dao),
        eof: function() {
          console.timeEnd('upload');
          latch.resolve('eof');
        }
      };

      this.input = this.input.trim();

      if ( this.format === 'AUTO' ) {
        this.input = this.input
        if ( this.input.startsWith('<?xml') ) {
          this.format = 'XML';
        } else if ( this.input.startsWith('{') ) {
          this.format = 'JSON';
        } else {
          this.format = 'CSV';
        }
      }

      if ( this.format === 'DAO' ) {
        this.processDAO(sink);
      } else if ( this.format === 'CSV' ) {
        this.processCSV(sink);
      } else if ( this.format === 'XML' ) {
        this.processXML(sink);
      } else if ( this.format === 'JSON' ) {
        // TODO:
        // this.processJSON(sink);
      }

      return latch;
    },

    function getXMLMapping(tag, attr) {
      var key = attr ? tag + '.' + attr : tag;

      if ( ! this.mappings_[key] ) {
        if ( attr ) {
          var prop = this.columnParser.parseString(tag + attr);
          this.mappings_[key] = this.Mapping.create({
            id: key,
            handler: prop || this.Mapping.UNKNOWN,
            of: this.of
          });
        } else {
          var prop = this.columnParser.parseString(tag);
          this.mappings_[key] = this.Mapping.create({
            id: key,
            handler: prop || this.Mapping.UNKNOWN,
            of: this.of
          });
        }
      }

      return this.mappings_[key];
    },

    function objectifyXML(doc) {
      var obj      = this.of.create();
      var children = doc.children;
      var nodes    = {};

      for ( var i = 0 ; i < children.length ; i++ ) {
        // fetch property based on xml tag name since they may not be in order
        var node  = children[i];
        var attrs = node.getAttributeNames();

        if ( node.firstChild ) {
          var value = node.firstChild.nodeValue;
          this.getXMLMapping(node.tagName).process(obj, value);
        }
        for ( var j = 0 ; j < attrs.length ; j++ ) {
          var attrName = attrs[j];
          var value    = node.getAttribute(attrName);
          this.getXMLMapping(node.tagName, attrName).process(obj, value);
        }
      }

      return obj;
    },

    async function processDAO(sink) {
      var a = (await this.sourceDAO.select()).array;
      for ( var i = 0 ; i < a.length ; i++ ) {
        await sink.put(a[i]);
      }
      sink.eof();
    },

    async function processXML(sink) {
      this.mappings_ = {};
      this.mappings.forEach(m => this.mappings_[m.id] = m);

      var parser   = new DOMParser();
      var doc      = parser.parseFromString(this.input, 'text/xml');
      var root     = doc.firstChild;
      var children = root.children;
      var cls      = this.of;

      this.rows = 0;

      // Just count matched rows so that this.rows is set
      for ( var i = 0 ; i < children.length ; i++ ) {
        var node = children[i];
        if ( this.tagName && node.tagName !== this.tagName ) continue;
        this.rows++;
      }

      // Process matched rows
      for ( var i = 0 ; i < children.length ; i++ ) {
        var node = children[i];
        if ( this.tagName && node.tagName !== this.tagName ) continue;
        await sink.put(this.objectifyXML(node));
      }

      sink.eof();
      this.mappings = Object.values(this.mappings_);
    },

    async function processCSV(sink) {
      var ids = {};
      var a   = this.input.split('\n');

      if ( ! a ) { this.rows = 0; return; }

      this.rows = a.length-1;

      try {
        var props  = this.parseColumns(a[0]);
        var parser = this.CSVParser.create({});
        var agent;

        this.rows = a.length-1;

        for ( var i = 1 ; i < a.length ; i++ ) {
          if ( ! agent ) agent = this.UploadAgent.create();
          var row = a[i];
          if ( ! row ) continue;
          var obj = this.of.create();
          var csv = parser.parseString(row, this.delimiter);
          for ( var j = 0 ; j < csv.length && j < props.length ; j++ ) {
            props[j].process(obj, csv[j].value);
          }
          await sink.put(obj);
          /*
          if ( ids[obj.id] ) {
            this.output += '<span style="color:red">Duplicate Records for id "' + obj.id + '":<br>' + ids[obj.id] + '<br>' + row + '</span>';
          }
          ids[obj.id] = row;
          */
        }

        sink.eof();
      } catch (x) {
        this.output += '<span style="color:red">ERROR: ' + x + '</span>';
      }
    }
  ],

  actions: [
    {
      name: 'preview',
      code: function() { this.process(false); }
    },
    {
      name: 'upload',
      code: function() { this.process(true); }
    },
    {
      name: 'clear',
      code: function() {
        this.output   = '';
        this.progress = 0;
      }
    },
    {
      name: 'resetMappings',
      isAvailable: function(mappings) { return mappings.length; },
      code: function() {
        this.mappings = [];
      }
    }
  ]
});
