/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichChoiceWithCreateView',
  extends: 'foam.u2.view.RichChoiceView',
  mixins: ['foam.util.DeFeedback'],

  requires: ['foam.u2.view.DraftDetailView'],

  documentation: `RichChoiceView with support for inline create,
  ideally should be used with reference props that only reqire a few props to create a new object`,

  css: `
    ^createWrapper {
      padding: 8px 16px;
      background: $backgroundSecondary;
      display: flex;
      gap: 8px;
      flex-direction: column;
    }
  `,

  imports: [ 'auth?' ],

  exports: [
    'cancel as onCancel',
    'saveToDAO as onSave'
  ],

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'createView',
      value: {
        class: 'foam.u2.detail.VerticalDetailView',
        hideActions: true,
        showTitle: false
      }
    },
    ['showCreate', false],
    {
      name: 'workingData',
      factory: function() {
        return this.of.create(this.baseArgs, this);
      }
    },
    {
      class: 'Map',
      name: 'baseArgs'
    },
    {
      name: 'propertyWhitelist',
      documentation: 'Passed to the createView, used by detailViews to only show some props of an FObject'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      factory: function() {
        return this.sections[0]?.dao;
      }
    },
    {
      class: 'String',
      name: 'addPlaceholder'
    }
  ],

  methods: [
    function addAction(showCreate, createView) {
      if ( ! createView )
        return this.E();
      if ( showCreate )
        return this.E()
          .addClass(this.myClass('createWrapper'))
          .start(this.DraftDetailView, {
            view: {
              ...createView,
              propertyWhitelist$: this.propertyWhitelist$,
            },
            data$: this.workingData$,
          })
            .addClass(this.myClass('createView'))
          .end();
      return this.E()
        .tag(this.DefaultActionView, {
          action: this.ADD_ROW, data: this,
          label: this.addPlaceholder || (this.of ? `Add ${this.of.model_.label.toLowerCase()}` : undefined)
        });
    }
  ],

  listeners: [
    // TODO: fix
    // function scrollTo() {
    //   var self = this;
    //   this.createEl_.el_().then(() => {
    //     var el = self.document.querySelector('.' + self.myClass('container'));
    //     if ( ! el ) return;
    //     el.scrollTop = el.scrollHeight;
    //   })
    // },
    function saveToDAO() {
      if ( this.feedback_ ) return;
      this.feedback_ = true;
      this.dao.put(this.workingData).then(obj => {
        if ( ! obj ) console.log(obj);
        this.onSelect(obj);
        this.workingData = undefined;
        this.showCreate = false;
        this.feedback_ = false;
      }, e => {
        this.feedback_ = false;
        ctrl.notify('Something went wrong', e.message, 'ERROR', true)
      });
    },
    function cancel() {
      this.feedback_ = true;
      this.workingData = undefined;
      this.showCreate = false;
      this.feedback_ = false;
    }
  ],

  actions: [
    {
      name: 'addRow',
      isAvailable: function(of) {
        return this.auth ? this.auth.check(this, `${of.name}.create`) : true;
      },
      code: function() { this.showCreate = true; }
    }
  ]
});
