/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'FocusWizardView',
  extends: 'foam.u2.View',

  imports: [
    'controlBorder?',
    'popup?',
    'transaltionService'
  ],

  exports: [ 'showTitle' ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      height: 100%;
      /**
       * Make this work with conditional titles
       * gap: 1.6rem;
      */
    }

    ^contents {
      flex: 1;
      min-height: 0;
    }
    ^wizardletTitle {
      text-align: center;
      margin-bottom: 2.4rem;
      transition: all 150ms;
    }
    @media only screen and (min-width: /*%DISPLAYWIDTH.MD%*/ 768px) {
      ^wizardletTitle {
        font-size: 1.6rem;
      }
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'contentsView',
      value: {
        class: 'foam.u2.wizard.views.FlexibleWizardContentsView'
      }
    },
    {
      class: 'Boolean',
      name: 'showTitle'
    },
    {
      class: 'String',
      name: 'viewTitle',
      expression: function (showTitle, data$currentWizardlet) {
        return showTitle && data$currentWizardlet.showTitle ? this.translationService.getTranslation(foam.locale, data$currentWizardlet.id + 'wizardlet.title', data$currentWizardlet.title) : '';
      }
    }
  ],

  methods: [
    function init() {
      if ( this.controlBorder && foam.u2.Progressable.isInstance(this.data) ) {
        this.controlBorder.progressMax$ = this.data$.dot('progressMax');
        this.controlBorder.progressValue$ = this.data$.dot('progressValue');
      }
    },
    function render() {
      const self = this;
      this.addClass()
        .add(this.slot(function (controlBorder, showTitle, data$currentWizardlet) {
          return showTitle && data$currentWizardlet.showTitle && ! controlBorder ?
            this.E().start()
              .addClass('h300', self.myClass('wizardletTitle'))
              .add(data$currentWizardlet.title)
            .end() : null
        }))
        .add(this.slot(function (data$currentWizardlet) {
          return data$currentWizardlet.subTitle ?
            this.E().start()
              .addClass(self.myClass('wizardletTitle'), 'p')
              .tag(foam.u2.HTMLView.create({ nodeName: 'div', data:this.translationService.getTranslation(foam.locale, data$currentWizardlet.id + 'wizardlet.subTitle', data$currentWizardlet.subTitle) }))
            .end() : null
        }))
        .start(this.contentsView, { data: this.data })
          .addClass(this.myClass('contents'))
        .end()
        ;
    }
  ]
});
