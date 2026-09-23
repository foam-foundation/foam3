/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.debug',
  name: 'WizardInspector',
  extends: 'foam.u2.Controller',

  imports: [
    'wizardController',
    'crunchController'
  ],

  requires: [
    'foam.core.controller.AppStyles',
    'foam.core.controller.Fonts',
    'foam.u2.borders.Block'
  ],

  static: [
    // ???: Should this and TranslationConsole extend a common class?
    function OPEN(opt_args, opt_x) {
      const windowProps = "width=800,height=800,scrollbars=no";
      const w = globalThis.window.open("", "Wizard Inspector", windowProps, true);

      document.body.addEventListener('beforeunload', () => w.close());

      w.document.body.innerText = '';
      w.document.body.innerHTML = '<title>Wizard Inspector</title>';
      w.document.$UID = foam.next$UID();

      var window = foam.lang.Window.create({window: w}, opt_x || ctrl);
      var v      = this.create(opt_args || {}, window);
      v.write(window.document);
    }
  ],

  css: `
    ^, ^wizardlet-list {
      display: flex;
      flex-direction: column;
    }
    ^wizardlet-row {
      display: flex;
      flex-direction: column;
    }
    ^wizardlet-row:not(:last-of-type) {
      margin-bottom: 4px;
    }
    ^wizardlet-actions, ^title {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    ^ .foam-u2-borders-Block {
      border-color: $borderDefault;
      border-left-size: 6px;
    }
    ^current.foam-u2-borders-Block {
      border-color: $borderBrand;
    }
  `,

  methods: [
    function render() {
      const self = this;
      const wizardController$ = this.crunchController.lastActiveWizard$;
      self.AppStyles.create();
      self.Fonts.create();
      this
        .addClass(this.myClass())
        .add(this.dynamic(function(crunchController$lastActiveWizard) {
          if (! crunchController$lastActiveWizard) {
            this.start('h1').add('Open a wizard to inspect').end();
            return;
          }
          this.start('h1').add(wizardController$.get().title || 'Untitled Wizard').end()
          .startContext({ data: self.crunchController.lastActiveWizard$ })
            .tag(self.STORE_GLOBAL)
          .endContext()
          .start('h2').add('wizardlets').end()
          .start(this.Block)
            .add(wizardController$.dot('wizardlets').map(() => this.E()
              .addClass(self.myClass('wizardlet-list'))
              .forEach(wizardController$.dot('wizardlets').map(v => v ?? []), function (wizardlet) {
                this.start(self.Block)
                  .addClass(wizardController$.dot('currentWizardlet').map(() =>
                    ( wizardController$.get().currentWizardlet === wizardlet )
                      ? self.myClass('current')
                      : self.myClass('not-current')))
                  .addClass(self.myClass('wizardlet-row'))
                  .startContext({ data: wizardlet })
                    .startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
                    .start('span')
                      .addClass(this.myClass('title'), 'h500')
                      .add(wizardlet.TITLE, ' ')
                      .start('span')
                        .addClass('p')
                        .add(wizardlet.ID)
                      .end()
                    .end()
                    .endContext()
                    .start()
                      .addClass(self.myClass('wizardlet-actions'))
                      .tag(wizardlet.IS_AVAILABLE)
                      .add('isAvailable')
                      .tag(wizardlet.IS_VISIBLE)
                      .add('isVisible')
                      .tag(self.STORE_GLOBAL, { size: 'SMALL' })
                      .tag(self.LOG_DATA_UPDATE, { size: 'SMALL' })
                    .end()
                  .endContext()
                .end()
                ;
              })
            ))
          .end()
        }))
        ;
    }
  ],

  actions: [
    {
      name: 'storeGlobal',
      label: 'Store as Global Variable',
      code: function storeGlobal() {
        for ( let i = 1 ; true ; i++ ) {
          const nameToTry = 'temp' + i;
          if ( globalThis.hasOwnProperty(nameToTry) ) continue;

          globalThis[nameToTry] = this;
          console.log(`%cstored wizardlet: %c${nameToTry} %o`,
            "font-weight: bold",
            "color: $red300;",
            this
          );
          break;
        }
      }
    },
    {
      name: 'logDataUpdate',
      label: 'Log on data update',
      code: function() {
        this.getDataUpdateSub().sub(() => { console.log(this.id, this.data) })
      }
    }
  ]
});
