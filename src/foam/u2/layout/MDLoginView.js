/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2.layout',
  name: 'MDLoginView',
  extends: 'foam.u2.View',

  imports: [
    'appConfig',
    'loginVariables'
  ],

  requires: [
    'foam.core.auth.login.SignIn',
    'foam.core.auth.login.SignUp'
  ],

  css: `

    ^ .title-top {
      font-size: 1.7em;
      padding-bottom: 5rem;
      text-align: center;
    }

    ^ .center-footer {
      text-align: center;
      display: grid;
      position: relative;
      top: -52px;
      color: $textSecondary;
    }

    ^ .link {
      font-size: larger;
      font-weight: bold;
      padding-bottom: 2rem;
    }

    ^ .content-form {
      width: 75%;
      padding: 3rem;
      top: -10rem;
      position: relative;
      background: $backgroundSecondary;
      margin: auto;
      box-shadow: 0px 0px 30px 0px #b7b7b7;
      border-radius: 30px;
      color: $textSecondary;
    }

    ^ .background-container {
      --parent-mainfill: linear-gradient(#604aff, #2e2379);
      background-image: var(--parent-mainfill);
      height: 40%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    ^ .home-logo {
      background-color: $backgroundSecondary;
      padding: 3rem;
      border-radius: 50%;
      margin-bottom: 13rem;
      box-shadow: 0 0px 5px 3px white;
    }

    ^ .foam-u2-layout-Cols {
      height: 0px;
    }

    ^ input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0px 1000px #f5f7fa inset;
    }

    ^ .input-image {
      display: none;
    }

    ^ .home-img {
      font-size: 9rem;
      background: -webkit-linear-gradient($primary300, $primary600);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'topBarShow_',
      factory: function() {
        return !! this.backLink_;
      },
      hidden: true
    },
    {
      name: 'model',
      factory: () => {
       return {};
      },
      view: { class: 'foam.u2.detail.VerticalDetailView' }
    },
    {
      name: 'param',
      factory: function() {
        return {};
      }
    },
    {
      class: 'String',
      name: 'mode_',
      hidden: true
    },
    {
      class: 'String',
      name: 'backLink_',
      factory: function() {
        return this.model.backLink_ || this.appConfig.externalUrl || undefined;
      },
      hidden: true
    }
  ],

  messages: [
    { name: 'GO_BACK', message: 'Go to ' },
    { name: 'MODE1', message: 'SignUp' }
  ],

  methods: [
    function init() {
      this.param.dao_ = !! this.param.dao_ ? this.param.dao_ : this.loginVariables.dao_;
      if ( this.mode_ === this.MODE1 ) {
        this.model = this.SignUp.create(this.param, this);
      } else {
        this.model = this.SignIn.create(this.param, this);
      }
    },

    function render() {
      this.SUPER();
      this.document.addEventListener('keyup', this.onKeyPressed);
      this.onDetach(() => {
        this.document.removeEventListener('keyup', this.onKeyPressed);
      });
      this.addClass();
      this
        .start('div').addClass('background-container')
          .start('div').addClass('home-logo').start('div').addClass('home-img').addClass('material-icons').add('home').end().end()
        .end();
      this.start('div')
        .start().addClass('title-top', 'md-text-sm').add('Login').end()
        .startContext({ data: this })
          .addClass('content-form', 'md-text-xs').tag(this.MODEL).br()
        .endContext()
      .end();
      this.start().addClass('md-text-xs', 'center-footer')
        .start('span').add(this.model.FOOTER_TXT).end()
        .start('span').addClass('link')
          .add(this.model.FOOTER_LINK)
          .on('click', () => {
            this.model.footerLink(this.topBarShow_, this.param);
          })
        .end()
        .start('span').add(this.model.SUB_FOOTER_TXT).end()
        .start('span').addClass('link')
          .add(this.model.SUB_FOOTER_LINK)
          .on('click', () => {
            this.model.subfooterLink();
          })
        .end()
      .end();
    }
  ],

  listeners: [
    function onKeyPressed(e) {
      e.preventDefault();
      var key = e.key || e.keyCode;
      if ( key === 'Enter' || key === 13 ) {
          this.model.login();
      }
    }
  ]
});
