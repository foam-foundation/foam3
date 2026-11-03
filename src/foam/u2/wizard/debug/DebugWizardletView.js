/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.debug',
  name: 'DebugWizardletView',
  extends: 'foam.u2.Controller',

  imports: [
    'debugContextIntercept',
    'sequence',
    'wizardlets'
  ],

  requires: [
    'foam.dao.MDAO',
    'foam.u2.Accordion',
    'foam.u2.borders.LoadingLevel',
    'foam.u2.table.TableView',
    'foam.u2.wizard.debug.DebugWAO',
    'foam.u2.wizard.debug.PropertyEvent',
    'foam.u2.wizard.debug.WAOEvent',
    'foam.u2.wizard.debug.WizardEvent',
    'foam.u2.wizard.internal.PropertyUpdate'
  ],

  css: `
    << {
      margin-top: 15pt;
      border: 3pt solid $destructive400;
      border-radius: 6px;
    }
    <<title {
      background-color: $destructive400;
      color: $white;
      padding: 3px 11px;
    }
    << .foam-u2-Accordion.expanded {
      border-bottom: 0;
      border-left: 0;
      border-right: 0;
    }
  `,

  properties: [
    {
      name: 'wizardlet',
      class: 'FObjectProperty',
      of: 'foam.u2.wizard.wizardlet.Wizardlet'
    },
    {
      name: 'reloadCount',
      label: 'Reload Count',
      class: 'Int'
    },
    'wizardEventDAO'
  ],

  methods: [
    function init() {
      this.SUPER();
      if ( ! this.wizardlet ) {
        throw new Error('must be initialized with wizardlet');
      }
      this.wizardEventDAO = this.MDAO.create({ of: this.WizardEvent });
      var s = this.wizardlet.getDataUpdateSub();
      var seqNo = 0;
      this.debugContextIntercept.stubMethodCalled.sub((_1, _2, ev) => {
        ev.seqNo = ++seqNo;
        this.wizardEventDAO.put(ev);
      });
      if ( this.DebugWAO.isInstance(this.wizardlet.wao) ) {
        this.wizardlet.wao.waoEvent.sub((_1, _2, ev) => {
          this.wizardEventDAO.put(this.WAOEvent.create({
            method: ev,
            seqNo: ++seqNo
          }));
        })
      }
      var autoSaveEnabled = this.sequence.contains('AutoSaveWizardletsAgent');
      s.sub(() => {
        if ( ! autoSaveEnabled ) this.wizardlet.loadingLevel = this.LoadingLevel.IDLE;
        var propertyUpdate = s.get();
        if ( ! this.PropertyUpdate.isInstance(propertyUpdate) ) {
          propertyUpdate = this.PropertyUpdate.create({
            path: '%unknown%'
          });
        }
        this.wizardEventDAO.put(this.PropertyEvent.create({
          data: propertyUpdate,
          seqNo: ++seqNo
        }));
        this.reloadCount++;
      });
    },
    function render() {
      this.SUPER();
      this
        .addClass(this.myClass())
        .start()
          .addClass('p-md', this.myClass('title'))
          .add('Developer Tools: ')
          .add(this.wizardlet.title$)
        .end()
        .startContext({ controllerMode: 'VIEW' })
          .start(this.Accordion, {
            title: 'Property Updates',
            expanded: false
          })
            .tag(this.TableView, {
              data$: this.wizardEventDAO$.map(dao =>
                dao.orderBy(this.WizardEvent.SEQ_NO))
            })
          .end()
          .start(this.Accordion, {
            title: 'Debug Actions',
            expanded: false
          })
            .start()
              .tag(this.SAVE)
              .tag(this.LOAD_ACTION)
            .end()
          .end()
        .endContext()
        ;
    }
  ],

  actions: [
    function save() {
      try {
        this.wizardlet.save();
      } catch (e) {
        console.error(e);
      }
    },
    {
      name: 'loadAction',
      label: 'Load',
      code: function loadAction() {
        this.wizardlet.load();
      }
    }
  ]
});
