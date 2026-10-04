/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.app',
  name: 'AppDownloadBadgeService',
  extends: 'foam.u2.Element',

  documentation: `
    Client side service that shows the download badges for the playstore and the app store.
    Currently only shows the playstore badge on all devices but should be made to be dynamic based 
    on current device. Will also be responsible for native app download prompts when available.
    `,

  requires: [
    'foam.u2.dialog.StyledModal',
    'foam.core.app.AppBadgeView'
  ],

  imports: [
    'appConfig',
    'document',
    'initLayout',
    'loginSuccess',
    'theme',
    'params',
    'window'
  ],
  messages: [
    { name: 'APP_DOWNLOAD_TITLE', message: 'Fast and Free Money Transfers, directly from your phone'},
    { name: 'APP_DOWNLOAD_SUB', message: 'Try our mobile app for a seamless transfer experience'},
    { name: 'GPLAY_LEGAL', message: 'Google Play and the Google Play logo are trademarks of Google LLC.'}
  ],
  css: `
    <<appDownloadPopup {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1rem;
      align-items: center;
      text-align: center;
    }
    <<playLink img {
      max-width: max(18rem, 10vw);
    }
    <<legal {
      margin: 0 1rem;
      text-align: center;
      font-size: 0.8rem;
      width: 100%;
    }
    <<header{
      color: $textBrand;
      text-align: center;
    }
  `,
  properties: [
    {
      class: 'Boolean',
      name: 'referralToken',
      factory: function() {
        var searchParams = new URLSearchParams(this.window.location.search);
        return searchParams.get('referral');
      },
      hidden: true
    },
    {
      name: 'popup'
    }
  ],
  methods: [
    function init() {
      if ( localStorage.getItem('showDownloadPrompt') == 'NO' ) return;
      this.loginSuccess$.sub(() => {
        this.initLayout.then(() => {
          if ( ! this.loginSuccess ) return;
          // Needed since ctrl sometimes rebuilds this
          // Prevents duplicate popups, check again after ZAC
          let existing = this.document.querySelector(`.${this.myClass('appDownloadPopup')}`);
          if (  (this.referralToken || this.params['utm_id']) && this.appConfig.playLink && ! existing ) {
            this.popup = this.StyledModal.create();
            this.popup.start().addClass(this.myClass('appDownloadPopup'))
            .start('img')
              .attr('src', this.theme.logo)
              .addClass(this.myClass('logo'))
            .end()
  
            .start().addClass(this.myClass('header'),'h400')
              .add(this.APP_DOWNLOAD_TITLE)
            .end()
            .add(this.APP_DOWNLOAD_SUB)
            .tag(this.AppBadgeView, {legalTextAbsolute: false})
            this.popup.open();

            // Remove the referral token from the URL
            let url = new URL(this.window.location.href);
            url.searchParams.delete('referral');
            url.searchParams.delete('utm_id');
            this.window.history.replaceState('', '', url);

          }})
        }
      );
    }
  ]
});