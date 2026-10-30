/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

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
    function execute(cls, simple) {
      let original = cls;
      if ( foam.String.isInstance(cls) ) {
        cls = foam.maybeLookup(cls);
        if ( cls == null ) {
          cls = this.__context__[original];
          if ( cls == null ) {
            this.log('Unknown class or service');
            return;
          }
          cls = cls.cls_;
        }
      }

      // TODO: add ability to specify how SimpleClassView writes links so it can hyperlink back to this command
      if ( foam.lang.InterfaceModel.isInstance(cls.model_) ) {
        this.out.tag(foam.doc.InterfaceView, {data: cls});
      } else {
        // TODO: a better method of determining if a cls is a QA
        if ( cls.QUESTIONS ) {
          this.out.tag(foam.u2.qa.QADocView, {data: cls});
        }

        if ( simple ) {
          this.out.tag(foam.doc.PropertyView, {data: cls});
        } else {
          this.out.startContext({conventionalUML: true}).
            tag(foam.doc.SimpleClassView, {data: cls, showUML: true});
        }
      }
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
