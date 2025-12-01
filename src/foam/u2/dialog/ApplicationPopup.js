/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'ApplicationPopup',
  extends: 'foam.u2.dialog.Popup',
  documentation: `
    A full-featured popup with the application's branding on it.
  `,

  implements: [
    'foam.mlang.Expressions',
    'foam.u2.Progressable'
  ],

  imports: [
    'displayWidth?',
    'theme',
    'translationService'
  ],

  requires: [
    'foam.lang.Action',
    'foam.u2.ActionReference',
    'foam.u2.borders.ScrollBorder',
    'foam.u2.dialog.DialogActionsView',
    'foam.u2.layout.Grid',
    'foam.u2.layout.GUnit',
    'foam.u2.layout.GridColumns',
    'foam.u2.tag.Image'
  ],

  css: `
    ^header-action {
      z-index: 1000;
      cursor: pointer;
      transition: all ease-in 0.1s;
    }

    ^inner {
      height: 85vh;
      width: 65vw;
      flex-direction: column;
      overflow: hidden;
    }

    ^bodyWrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 1.6rem;
      align-self: center;
      width: 100%;
      overflow: auto;
      padding: 2rem 2rem;
    }
    ^actionBar {
      padding: 2.4rem;
    }
    ^fullscreen ^actionBar {
      padding: 2.4rem;
    }

    ^header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding: 0.6rem;
    }
    ^header.showBorder {
      border-bottom: 1px solid $borderDefault;
    }

    ^header-left {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    ^header-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    ^header-center {
      display: flex;
      text-align: center;
      align-items: center;
      justify-content: center;
    }

    ^body {
      width: 100%;
      /*
        Temporarily remove scroll border
        max-height: 90vh;
        overflow: auto;
      */
      display: flex;
      align-items: center;
      flex-direction: column;
    }
    ^body > * {
      width: 100%;
    }
    ^fullHeightBody {
      height: auto;
    }
    ^fullHeightBody > *{
      flex-grow: 1;
    }

    ^fullscreen ^bodyWrapper {
      max-height: var(--max-height, 100vh);
    }

    ^logo img, ^logo svg {
      display: flex;
      max-height: 4rem;
      /* remove and override any image styling to preserve aspect ratio */
      width: unset;
    }

    ^header-button-placeholder {
      min-width: 56px;
    }

    ^footer {
      display: grid;
      grid-template-columns: auto;
      align-items: center;
      gap: 0.4rem;
      text-align: center;
      flex-shrink: 0;
      padding: 0.3em 1em;
      white-space: nowrap;
    }
    ^footer-right, ^footer-left {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    ^footer-center a:link,
    ^footer-center a:visited,
    ^footer-center a:active {
      color: $textDefault;
      text-decoration: none;
    }
    ^footer-center a:hover {
      text-decoration: underline;
    }
    ^inner-title, ^inner-title-small {
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: 1.8rem;
      line-height: 1.25;
      transition: all 150ms;
      text-align: center;
    }
    
    ^footer.p-legal-light {
      color: $textTertiary;
    }

    ^info-text {
      color: $textDefault;
    }

    ^footer-center img {
      height: 1em;
      display: inline-block;
      vertical-align: sub;
    }
    
    ^footerContainer {
      padding-top: 0.4rem;
    }

    ^ .foam-u2-ProgressView {
      height: 2px;
    }

    @media only screen and (min-width: /*%DISPLAYWIDTH.MD%*/ 768px) {
      ^header {
        padding: 12px;
      }
      ^:not(^fullscreen) ^inner {
        width: 75%;
        min-width: 50rem;
      }
      ^fullscreen ^bodyWrapper {
        width: min(100rem, 100%);
      }
      ^inner-title {
        text-align: center;
        font-size: 2.4rem;
      }
      ^footer {
        grid-template-columns: 1fr auto 1fr;
        padding: 0.6em 1em;
      }
      ^footer-right {
        justify-content: flex-end;
      }
      ^footer-left {
        justify-content: flex-start;
      }
      ^bodyWrapper{
        padding: 2.4rem 4rem;
        gap: 2rem;
      }
    }
  `,

  messages: [
    { name: 'SUPPORT_TITLE', message: 'Support: '}
  ],

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.ActionReference',
      name: 'customActions'
    },
    {
      name: 'closeAction'
    },
    {
      class: 'Reference',
      targetDAOKey: 'menuDAO',
      of: 'foam.core.menu.Menu',
      name: 'helpMenu'
    },
    'help_',
    {
      class: 'String',
      name: 'footerHTML'
    },
    {
      class: 'Boolean',
      name: 'isScrolled'
    },
    {
      class: 'Array',
      name: 'leadingActions'
    },
    {
      class: 'Array',
      name: 'primaryActions'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'progressView',
      value: { class: 'foam.u2.ProgressView' }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'dynamicFooter',
      documentation: 'Content rendered below the body content. Still a part of the body and can change based on the content of the body'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'dynamicHeader',
      documentation: 'Content rendered above the body content. Still a part of the body and can change based on the content of the body'
    },
    [ 'forceFullscreen', false ],
    [ 'includeSupport', false ],
    [ 'forceFullHeightBody', false]
  ],

  methods: [
    function init() {
      var content;
      const self = this;
      window.thepopup = this;
      this.helpMenu$find.then( menu => {
        self.help_ = menu;
      });
      const updateWidth = () => {
        if ( this.displayWidth?.ordinal <= foam.u2.layout.DisplayWidth.MD.ordinal ) {
          this.forceFullscreen = true;
        } else {
          this.forceFullscreen = false;
        }
      }
      updateWidth();
      this.onDetach(this.displayWidth$.sub(updateWidth))
      this.addClass()

        // These methods come from ControlBorder
        .setActionList(this.EQ(this.Action.NAME, "goPrev"), 'leadingActions')
        .setActionProp(this.EQ(this.Action.NAME, "discard"), 'closeAction')
        .setActionList(this.TRUE, 'primaryActions')

        .enableClass(this.myClass('fullscreen'), this.fullscreen$.or(this.forceFullscreen$))
        .start()
          .addClass(this.myClass('background'))
          .on('click', this.closeable ? this.closeModal.bind(this) : null)
        .end()
        .start()
          .enableClass(this.myClass('inner'), this.isStyled$)
          .style({ 'background-color': this.isStyled ? this.backgroundColor : ''})
          .start()
            .show(this.showActions$)
            .enableClass('showBorder', this.progressMax$, true)
            .addClass(this.myClass('header'))
            .start()
              .addClass(this.myClass('header-left'))
              .add(this.slot(function( leadingActions ) {
                if ( ! leadingActions || leadingActions.length === 0 ) {
                  return this.E().enableClass(this.myClass('header-button-placeholder'), self.closeable$);
                }
                let slots = [];
                leadingActions.forEach(a => {
                  slots.push(a.action.createIsAvailable$(self.__subContext__, a.data));
                });
                let s = foam.lang.ArraySlot.create({ slots: slots }, self);
                let anyAvailable = this.slot(function(slots) {
                  for ( let slot of slots ) {
                    if ( slot ) return true;
                  }
                  return false;
                }, s);
                return this.E()
                  .enableClass(this.myClass('header-button-placeholder'), anyAvailable)
                  .forEach(leadingActions, function(ar) {
                    var isLastWizardlet_ = ar.data.currentWizardlet.isLastWizardlet;
                    this
                      .start(ar.action, { label: '', buttonStyle: 'TERTIARY', data$: ar.data$ }).show(!isLastWizardlet_)
                        .addClass(self.myClass('header-action'))
                      .end();
                  });
              }))
            .end()
            .start()
              .addClass(this.myClass('header-center'))
              .start({ class: 'foam.core.u2.navigation.ApplicationLogoView' })
                .addClass(this.myClass('logo'))
              .end()
            .end()
            .start()
              .addClass(this.myClass('header-right'))
              .add(this.slot(function(help_) {
                return help_ ? this.E().tag(help_, { label: '', buttonStyle: 'TERTIARY' }) : null;
              }))
              .add(this.slot(function(closeAction) {
                return closeAction ?
                this.E()
                  .start(closeAction.action, { label: '', buttonStyle: 'TERTIARY', data$: closeAction.data$ })
                    .show(self.closeable$.and(self.showActions$))
                    .addClass(self.myClass('header-action'))
                  .end() :
                this.E().startContext({ data: self })
                    .start(self.CLOSE_MODAL, { buttonStyle: 'TERTIARY' })
                      .show(self.closeable$.and(self.showActions$))
                      .addClass(self.myClass('header-action'))
                    .end()
                  .endContext();
              }))
            .end()
          .end()
          .add(this.slot(function(progressView, progressMax) {
            if ( ! progressMax ) return;
            return this.E()
              .addClass(self.myClass('progressBar'))
              .tag(progressView, {
                max$: self.progressMax$,
                data$: self.progressValue$
              });
          }))
          .start()
            .addClass(this.myClass('bodyWrapper'))
            // .enableClass(this.myClass('removeFlex'), this.forceFullHeightBody$)
            .add(this.slot(function (dynamicHeader) {
              if ( ! dynamicHeader ) return;
              return this.E()
                .addClass(this.myClass('dynamicFooter'))
                .tag(dynamicHeader);
            }))
            .add(this.slot(function(content$childNodes) {
              if ( ! content$childNodes ) return;
              this.forceFullHeightBody = false;
              let titleSlot = null;
              for ( const child of content$childNodes ) {
                if ( ! child.viewTitle ) continue;
                titleSlot = child.viewTitle$;
                break;
              }
              if ( ! titleSlot ) return this.E();
              return this.E()
                .addClass(self.myClass('inner-title'))
                .addClass('h300')
                .enableClass(self.myClass('inner-title-small'), this.isScrolled$)
                .enableClass(self.myClass('inner-title-small'), this.isScrolled$)
                .enableClass('h500', this.isScrolled$)
                .show(titleSlot)
                .add(titleSlot);
            }))
            .start(
              // Temporarilty remove scrollborder till we can use it in a more reliable way on mobile
              // this.ScrollBorder, { topShadow$: this.isScrolled$, disableScroll$: this.forceFullHeightBody$ }
              )
              .addClass(this.myClass('body'))
              .enableClass(this.myClass('fullHeightBody'), this.forceFullHeightBody$.or(this.fullscreen$.or(this.forceFullscreen$).not()))
              .tag('', {}, this.content$)
            .end()
            .start()
              .enableClass(this.myClass('dialogActionsView-with-footer'), this.dynamicFooter$.map(footer => !! footer))
              .tag(this.DialogActionsView, {
                data$: this.primaryActions$
              })
            .end()
          .end()
          .callIf((this.footerHTML || this.includeSupport ), function() {
            this
            .start().addClass(self.myClass('footerContainer'))
              .add(self.slot(function (dynamicFooter) {
                if ( ! dynamicFooter ) return;
                return this.E()
                  .addClass(self.myClass('dynamicFooter'))
                  .tag(dynamicFooter);
              }))
              .start()
                .addClass(self.myClass('footer'), 'p-legal-light')
                // empty space
                .start().addClass(self.myClass('footer-left'))
                  .end()
                // link
                .start().addClass(self.myClass('footer-center'))
                  .tag(foam.u2.HTMLView.create({ nodeName: 'div', data: self.translationService.getTranslation(foam.locale, self.myClass("footerHTML"), self.footerHTML) }))
                .end()
                // support info
                .start().addClass(self.myClass('footer-right'))
                  .callIf(self.includeSupport, function() {
                    this
                      .start()
                        .start('span')
                          .addClass('')
                          .add(self.SUPPORT_TITLE)
                          .start('a')
                            .addClass(self.myClass('info-text'), self.myClass('footer-link'))
                            .attrs({ href: `mailto:${self.theme.supportConfig.supportEmail}`})
                            .add(self.theme.supportConfig.supportEmail)
                          .end()
                          .add(' | ')
                          .start('a')
                            .addClass(self.myClass('info-text'), self.myClass('footer-link'))
                            .attrs({ href: `tel:${self.theme.supportConfig.supportPhone}`})
                            .add(self.theme.supportConfig.supportPhone)
                          .end()
                        .end()
                      .end()
                  })
                .end()
              .end()
            .end()
          })
        .end();
    }
  ]
});
