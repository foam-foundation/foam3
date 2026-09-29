/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// foam.doc.DocBrowser.create({}, ctrl.__subContext__).write(document);

foam.CLASS({
  package: 'foam.doc',
  name: 'DocBorder',
  extends: 'foam.u2.Element',

  documentation: 'Titled raised View border used by the DocBrowser.',

  css: `
    ^ {
      border-radius: 3px;
      box-shadow: 0 1px 3px $grey400;
      display: inline-block;
      width:100%;
    }
    ^title { padding: 6px; align-content: center; background: $blue50; }
    ^info { float: right; font-size: smaller; }
    ^content { padding: 6px; min-width: 220px; height: 100%; background:$backgroundDefault; }
  `,

  properties: [
    'title',
    'info'
  ],

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        start('div').
          addClass(this.myClass('title')).
          add(this.title$).
          start('span').
            addClass(this.myClass('info')).
            add(this.info$).
          end().
        end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end();
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'AxiomInfo',

  ids: [ 'name' ],

  requires: [
    'foam.doc.ClassLink'
  ],

  properties: [
    {
      name: 'axiom',
      hidden: true
    },
    {
      name: 'type',
      tableCellView: function(o, e) {
        return o.type ?
          foam.doc.LinkView.create({data: foam.doc.Link.create({path: o.type.id, label: o.type.name})}, e.__subSubContext__) :
          'anonymous';
      },
      tableCellFormatter: function(value, obj, axiom) {
        if ( value ) {
          this.tag(foam.doc.LinkView, { data: foam.doc.Link.create({ path: value.id, label: value.name }) });
          return;
        }
        this.add('anonymous');
      }
    },
    {
      name: 'name',
      projectionSafe: false,
      tableCellFormatter: function(value, obj, axiom) {
        if ( obj.type === foam.lang.Requires ) {
          this.tag(obj.ClassLink, {data: obj.axiom.path, showPackage: true});
        } else if ( obj.type === foam.lang.Implements ) {
          this.tag(obj.ClassLink, {data: obj.axiom.path, showPackage: true});
        } else {
          this.add(value);
        }
      }
    },
    {
      name: 'cls',
      label: 'Source',
      tableCellView: function(o, e) {
        return foam.doc.LinkView.create({data: o.cls}, e.__subSubContext__);
      },
      tableCellFormatter: function(value, obj, axiom) {
        this.tag(foam.doc.LinkView, { data: value });
      }
    },
    {
      name: 'documentation',
      tableCellFormatter: function(value, obj, axiom) {
        this.add(value);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'EnumInfo',

  ids: [ 'name' ],

  requires: [
    'foam.doc.ClassLink'
  ],

  properties: [
    {
      name: 'name',
      tableCellFormatter: function(value, obj, axiom) {
        this.add(value);
      }
    },
    {
      name: 'label',
      tableCellFormatter: function(value, obj, axiom) {
        this.add(value);
      }
    },
    {
      name: 'documentation',
      tableCellFormatter: function(value, obj, axiom) {
        this.add(value);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'ClassDocViewEnumValue',
  extends: 'foam.u2.View',

  requires: [
    'foam.dao.ArrayDAO',
    'foam.doc.ClassLink',
    'foam.doc.EnumInfo',
    'foam.u2.table.TableView'
  ],

  imports: [
    'selectedAxiom'
  ],

  methods: [
    function render() {
      this.SUPER();
      var data = this.data;
      var self = this;

      this.
        start('b').add(data.id).end().
        br().
        add('extends: ');

      var cls = data;
      for ( var i = 0 ; cls ; i++ ) {
        cls = foam.maybeLookup(cls.model_.extends);
        if ( i ) this.add(' : ');
        this.start(this.ClassLink, {data: cls}).end();
        if ( cls === foam.lang.FObject ) break;
      }
      this.br();
      this.tag(foam.u2.HTMLView, {data: data.model_.documentation});

      this.add(this.slot(function () {
        var axs = [];
        for ( var key in data.model_.values ) {
          var a  = data.model_.values[key];
          var ai = foam.doc.EnumInfo.create({
            label: data[a.name].label,
            documentation: data[a.name].documentation,
            name: a.name
          });
          axs.push(ai);
        }

        return this.TableView.create({
          of: this.EnumInfo,
          data: this.ArrayDAO.create({array: axs}),
          hoverSelection$: self.selectedAxiom$
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'ClassDocView',
  extends: 'foam.u2.View',

  requires: [
    'foam.dao.ArrayDAO',
    'foam.doc.AxiomInfo',
    'foam.doc.ClassLink',
    'foam.doc.Link',
    'foam.u2.table.TableView'
  ],

  imports: [
    'selectedAxiom',
    'showInherited',
    'showOnlyProperties'
  ],

  methods: [
    function render() {
      this.SUPER();

      var data = this.data;

      this.
        addClass(this.myClass()).
        start('b').add(data.id).end().
        start('span').style({float:'right','font-size':'smaller'}).add(data.count_, ' created').end().br().
        add('extends: ');

      var cls = data;
      for ( var i = 0 ; cls ; i++ ) {
        cls = foam.maybeLookup(cls.model_.extends);
        if ( i ) this.add(' : ');
        this.start(this.ClassLink, {data: cls}).end();
        if ( cls === foam.lang.FObject ) break;
      }
      this.br();
      this.tag(foam.u2.HTMLView, {data: data.model_.documentation});

      this.add( this.slot(function (showInherited, showOnlyProperties) {
        // TODO: hide 'Source Class' column if showInherited is false
        var axs = [];
        for ( var key in data.axiomMap_ ) {
          if ( showInherited || Object.hasOwnProperty.call(data.axiomMap_, key) ) {
            var a  = data.axiomMap_[key];
              if ( ( ! showOnlyProperties ) || foam.lang.Property.isInstance(a) ) {
                var ai = foam.doc.AxiomInfo.create({
                  axiom: a,
                  type: a.cls_,
                  cls: this.Link.create({
                    path:  a.sourceCls_ ? a.sourceCls_.id   : '',
                    label: a.sourceCls_ ? a.sourceCls_.name : ''
                  }),
                name: a.name
              });
              axs.push(ai);
            }
          }
        }

        return this.TableView.create({
          of: this.AxiomInfo,
          data: this.ArrayDAO.create({array: axs}),
          hoverSelection$: this.selectedAxiom$
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'Link',

  properties: [
    'path',
    'label'
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'LinkView',
  extends: 'foam.u2.View',

  imports: [ 'browserPath' ],

  properties: [ [ 'nodeName', 'a' ] ],

  methods: [
    function render() {
      this.SUPER();

      this.
        on('click', this.click).
        attrs({href: this.data.path}).
        add(this.data.label);
    }
  ],

  listeners: [
    function click(e) {
      this.browserPath$.set(this.data.path);
      e.preventDefault();
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'DocBrowser',
  extends: 'foam.u2.Element',

  documentation: 'FOAM documentation browser.',

  requires: [
    'foam.dao.MDAO',
    'foam.doc.ClassDocView',
    'foam.doc.ClassDocViewEnumValue',
    'foam.doc.ClassList',
    'foam.doc.DocBorder',
    'foam.doc.SimpleClassView',
    'foam.doc.UMLDiagram'
  ],

  imports: [ 'document', 'params' ],

  exports: [
    'as data',
    'axiom as selectedAxiom',
    'conventionalUML',
    'path as browserPath',
    'showInherited',
    'showOnlyProperties',
    'modelDAO'
  ],

  css: `
    ^ { color: $grey500; }
    ^ th { color: $grey500; }
    ^ td { padding-right: 12px; }
  `,

  constants: [
    {
      name: 'MODEL_COMPARATOR',
      factory: function() {
        var c = foam.compare.compound([foam.lang.Model.PACKAGE, foam.lang.Model.NAME]);
        return c.compare.bind(c);
      }
    }
  ],

  properties: [
    {
      name: 'modelDAO',
      factory: function(/*cSpecDAO, allowedModels*/) {
        var self = this;
        var dao  = self.MDAO.create({of: self.Model}).orderBy(foam.lang.Model.ID);
        var all  = [];
        var packages = { '--All--': all };
        function addModel(m) {
          try {
          var c = foam.maybeLookup(m);
          if ( c ) {
            var mdl = c.model_;
            (packages[mdl.package] || ( packages[mdl.package] = [])).push(mdl);
            all.push(mdl);
            dao.put(mdl);
          }
        } catch (x) {}
        }
        Object.keys(foam.USED).forEach(addModel);
        Object.keys(foam.UNUSED).forEach(addModel);
        this.packages = packages;
        return dao;
      }
    },
    {
      class: 'String',
      name: 'path',
      width: 80,
      factory: function() {
        return this.params.path || 'foam.lang.Property';
      }
    },
    {
      name: 'selectedClass',
      expression: function (path) {
        return foam.maybeLookup(path);
      }
    },
    {
      class: 'Boolean',
      name: 'showInherited',
      value: true
    },
    {
      class: 'FObjectProperty',
      name: 'axiom',
      view: { class: 'foam.u2.DetailView' }
    },
    {
      name: 'subClasses',
      expression: function (path) {
        return Object.values(foam.USED).
          filter(function(cls) {
            return cls.extends === path || 'foam.lang.' + cls.extends === path;
          }).
          sort(this.MODEL_COMPARATOR);
      }
    },
    {
      name: 'requiredByClasses',
      expression: function (path) {
        return Object.values(foam.USED).
          filter(function(cls) {
            return cls.requires && cls.requires.includes(path);
          }).
          sort(this.MODEL_COMPARATOR);
      }
    },
    {
      name: 'relationshipClasses',
      expression: function (path) {
        var cls = foam.lookup(path);
        var rs  = cls.getAxiomsByClass(foam.lang.Reference);
        return rs.map(r => r.of.model_).sort(this.MODEL_COMPARATOR);
      }
    },
    'subClassCount',
    {
      class: 'Boolean',
      name: 'conventionalUML',
      // this property will allow to switch from the conventional UML diagram (diagram contain
      // a set of properties ) to UML ++ diagram ( and vice versa ).
      value: true
    },
    {
      class: 'Boolean',
      name: 'showOnlyProperties',
      value: true
    }
  ],

  methods: [
    function render() {
      for ( var key in foam.UNUSED ) foam.lookup(key);
      this.SUPER();

      var classListData =  Object.values(foam.USED).filter(e => { return e != undefined; }).sort(this.MODEL_COMPARATOR);
      this.
        addClass(this.myClass()).
        tag(this.PATH, {displayWidth: 80}).
        start('span').
          style({'margin-left': '12px', 'font-size':'small'}).
          add('  Show Inherited Axioms: ').
        end().
        tag(this.SHOW_INHERITED, {data$: this.showInherited$}).
        br().br().
        start('table').
          start('tr').
            start('td').
              style({'vertical-align': 'top', 'min-width': '700px'}).
              tag(this.ClassList, {title: 'Class List', showPackages: false, showSummary: true, data: classListData}).
            end().
            start('td').
              style({'vertical-align': 'top'}).
              start(this.DocBorder, {
                title: 'UML',
                info$: this.slot(function(selectedClass) {
                  return selectedClass.getOwnAxioms().length + ' / ' + selectedClass.getAxioms().length;
                })
              }).
                add( 'Conventional UML : ' ).tag(this.CONVENTIONAL_UML, {data$: this.conventionalUML$}).
                add(this.slot(function(selectedClass, conventionalUML) {
                  if ( ! selectedClass ) return '';
                  return this.UMLDiagram.create({
                    data: selectedClass
                  });
                })).
              end().
            end().
            start('td').
              style({'vertical-align': 'top'}).
              start(this.DocBorder, {
                title: 'ModelDoc'
              }).
                add(this.slot(function(selectedClass) {
                  if ( ! selectedClass ) return '';
                  return this.SimpleClassView.create({
                    data: selectedClass
                  });
                })).
              end().
            end().
            start('td').
              style({'vertical-align': 'top', 'min-width': '800px'}).
              start(this.DocBorder, {title: 'Class Definition', info$: this.slot(function(selectedClass) { return selectedClass.getOwnAxioms().length + ' / ' + selectedClass.getAxioms().length; })}).
                add( 'Show just properties : ' ).
                tag( this.SHOW_ONLY_PROPERTIES, { data$: this.showOnlyProperties$ } ).
                add(this.slot(function(selectedClass) {
                  if ( ! selectedClass ) return '';
                  return this.ClassDocView.create({data: selectedClass});
                })).
              end().
            end().
            start('td').
              style({'vertical-align': 'top'}).
              start(this.DocBorder, {title: 'Axiom Definition'}).
                style({'min-width': '500px'}).
                add(this.dynamic(function (axiom) { this.add(axiom && foam.u2.DetailView.create({data: axiom.axiom, controllerMode: foam.u2.ControllerMode.VIEW})); })).
              end().
            end().
            start('td').
              style({'vertical-align': 'top'}).
              start(this.DocBorder, {title: 'Enum values'}).
                add(this.slot(function(selectedClass) {
                  if ( ! selectedClass ) return '';
                  return this.ClassDocViewEnumValue.create({data: selectedClass});
                  })).
              end().
            end().
            start('td').
              style({'vertical-align': 'top'}).
              tag(this.ClassList, {title: 'Sub-Classes', data$: this.subClasses$}).
            end().
            start('td').
              style({'vertical-align': 'top'}).
              tag(this.ClassList, {title: 'Required-By', data$: this.requiredByClasses$}).
            end().
            start('td').
              style({'vertical-align': 'top'}).
              tag(this.ClassList, {title: 'Relationships', data$: this.relationshipClasses$}).
            end().
          end().
        end();
    }
  ]
});


foam.CLASS({
  package: 'foam.doc',
  name: 'DocBrowserWindow',

  requires: [
    'foam.lang.Window',
    'foam.doc.DocBrowser'
  ],

  imports: [ 'window' ],

  properties: [
    'initialClass'
  ],

  methods: [
    function init() {
      // TODO: There should be some helper support to make this easier
      var w = this.window.open('', '', 'width=700, heigh=1000');
      var window = foam.lang.Window.create({window: w}, this.__subContext__);
      var browser = this.DocBrowser.create({path: this.initialClass}, window.__subContext__);
      w.document.body.insertAdjacentHTML('beforeend', browser.outerHTML);
      browser.load();
    }
  ]
});


foam.debug.doc = function(opt_obj, showUnused) {
  if ( showUnused ) {
    for ( var key in foam.UNUSED ) foam.lookup(key);
  }

  return foam.doc.DocBrowserWindow.create({
    initialClass: foam.lang.FObject.isSubClass(opt_obj) ?
      opt_obj.id :
      ( opt_obj && opt_obj.cls_ ) ? opt_obj.cls_.id :
      'foam.lang.FObject' });
};


// TODO:
//    remove LinkView
