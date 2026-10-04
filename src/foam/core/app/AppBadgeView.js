/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.app',
  name: 'AppBadgeView',
  extends: 'foam.u2.View',

  documentation: `View to display various app store badges`,
  
  imports: [
    'appConfig',
    'window'
  ],

  css: `
  <<{
    display: flex;
    justify-content: center;
    flex-direction: column;
  }
  <<badge-container{
    display: flex;
    gap: 2rem;
    justify-content: center;
  }
  <<appStoreBadge > img, <<playStoreBadge > img {
    width: 108px;
    height: 54px;
  }
  <<legal {
    display: flex;
    justify-content: center;
    flex-direction: column;
    gap: 0.8rem;
    text-align: center;
    font-size: 0.8rem;
    width: 100%;
  }

  @media only screen and (min-width:  /*%DISPLAYWIDTH.MD%*/ 768px) {
    <<appStoreBadge > img, <<playStoreBadge > img {
      width: 125px;
      height: 62px;
    }
  }
  `,
  properties: [
    { 
      name: 'isAndroid',
      factory: function() {
        return navigator.userAgent.indexOf('Android') > -1;
      }
    },
    { 
      name: 'isIOS',
      factory: function() {
        return navigator.userAgent.indexOf('iPhone') > -1 || navigator.userAgent.indexOf('iPad') > -1;
      }
    },
    {
      name:'isReferral',
      class: 'Boolean'
    },
    {
      name: 'showBadges',
      expression: function() { 
        return (this.appConfig.playLink || this.appConfig.appLink) &&
        (! (navigator.standalone || this.window.matchMedia('(display-mode: standalone)').matches) ) &&
        (! this.isReferral);
      }
    },
    {
      name: 'legalTextAbsolute',
      class: 'Boolean',
      value: true
    }
  ],

  messages: [
    { name: 'GPLAY_LEGAL', message: 'Google Play and the Google Play logo are trademarks of Google LLC.'},
    { name: 'APPSTORE_LEGAL', message: 'Apple and the Apple Logo are trademarks of Apple Inc.'}
  ],

  methods: [
    function render() {
      let self = this;
      let renderIOS = ! this.isAndroid && this.appConfig.appLink;
      let renderAndroid = ! this.isIOS && this.appConfig.playLink;
      this.dynamic(function(showBadges) {
        if ( ! showBadges ) return;
        this.addClass(self.myClass()).show(this.showBadges)
        .start().addClass(self.myClass('badge-container'))
          .callIf(renderIOS, function() {
            this.start('a').addClass(self.myClass('appStoreBadge')).attrs({ href: self.appConfig.appLink })
              .start('img')
                .attrs({ loading: 'lazy', alt: 'Download on the App Store', src: '/images/app-store-badge.svg' })
              .end()
            .end();
          })
          .callIf(renderAndroid, function() {
            this.start('a').addClass(self.myClass('playStoreBadge')).attrs({ href: self.appConfig.playLink })
              .start('img')
                .attrs({ loading: 'lazy', alt: 'Get it on Google Play', src: '/images/play-store-badge.svg'})
              .end()
            .end();
          })
        .end();
        if ( ! (renderAndroid || renderIOS) ) return;
        this.start().addClass('p-legal', self.myClass('legal')).enableClass(self.myClass('legal-container'), this.legalTextAbsolute$)
        .callIf(renderIOS, function() {
          this.start().add(self.APPSTORE_LEGAL).end();
        })
        .callIf(renderAndroid, function() {
          this.start().add(self.GPLAY_LEGAL).end();
        })
        .end();
      });
    }
  ]
});
