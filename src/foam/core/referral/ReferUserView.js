/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.referral',
  name: 'ReferUserView',
  extends: 'foam.u2.View',

  css: `
    ^container{
      container: wrapper / inline-size;
      height: fit-content;
      align-items: center;
      justify-content: space-between;
      display: flex;
      flex-direction: column;
      gap: 2.4rem;
    }
    ^copy-box{
      background: $primary50;
      border: 1px dashed $primary400;
      padding: 1.5rem;
      text-align: center;
      width: 100%;
    }
    ^error^copy-box {
      background: $destructive50;
      border-color: $destructive400;
    }
    ^header{
      display: flex; 
      flex-direction: column;
      gap: 1.2rem;
      text-align: center;
    }
    ^header > .h300{
      font-weight: 900;
      color: $primary400;
    }
    ^item .h400 {
      line-height: 32px;
      color: $primary400;
    }
    ^header > .p,^item .p {
      color: $grey500;
    }
    ^item-header {
      padding-bottom: 1.6rem;
    }
    ^item {
      display: flex;
      gap: 0.4rem;
      align-self: flex-start;
    }
    ^item:not(:last-child) {
      padding-bottom: 1.6rem;
    }
    ^item > *:last-child {
      display: flex;
      flex-direction: column;
    }
    ^item img {
      height: 16;
      align-self: center;
    }
    ^item-text {
      flex: 1 1 0;
      min-width: 0;
      padding-right: 3.8rem;
    }
    @container wrapper (width > 700px) {
      ^copy-box {
        width: fit-content;
      }
      ^item {
        text-align: center;
        align-self: inherit;
      }
    }
  `,

  mixins: ['foam.u2.util.ClipboardAccess'],

  imports: [
    'theme',
    'subject'
  ],

  messages: [
     { name: 'HEADER', message: 'Share ${appName} With a Friend!', template: true },
     { name: 'COPY_FAIL', message: 'Failed to copy!' },
     { name: 'COPYTEXT', message: 'Refer a friend' }
   ],

  properties: [
    {
      name: 'referralText',
      class: 'String'
    },
    'refLink',
    'contentData'
  ],

  methods: [
    function init() {
      this.refLink = this.subject.user.referralCodes.where(
        this.Eq.create({arg1: foam.core.referral.ReferralCode.AUTO_GENERATED, arg2: true})
      ).select().then(v => {
        this.refLink = v.array[0]?.url;
        this.referralText = this.COPYTEXT + '\n\n' + this.refLink;
      });
    },
    function render() {
      let self = this;

      let iconConfig = {
        size: 32,
        backgroundColor: this.color = foam.CSS.returnTokenValue('$primary50', this.cls_, this.__subContext__)
      }
      let fill = foam.CSS.returnTokenValue('$primary700', this.cls_, this.__subContext__)

      let button = navigator.canShare?.({text: this.referralText}) ? this.SHARE_TEXT : this.COPY_TEXT;
      this
        .addClass(this.myClass('container'))
        .start()
          .addClass(this.myClass('header'))
          .start().addClass('h300').add(this.HEADER({ appName: this.theme.appName })).end()
        .end()
        .start()
          .addClass(this.myClass('content'))
          .add(this.slot(function(contentData) {
            var e = this.E();
            return this.addContent(e);
          }))
        .end()
        .start()
          .addClass(this.myClass('copy-box'))
          .enableClass(this.myClass('error'), this.refLink$.map(v => ! v))
          .add(this.dynamic(function(refLink) {
            this.removeAllChildren()
            if (refLink) {
              this.add(self.COPYTEXT)
              .tag('br')
              .tag('br')
              .add(self.refLink);
            } else {
              this.add('Something went wrong, please try again');
            }
          }))
        .end()
        .startContext({data:this})
          .start(button, { buttonStyle: 'PRIMARY', size: 'LARGE' }).addClass(this.myClass('share-button')).end()
        .endContext()
    },
    {
      name: 'addContent',
      code: function() {
        // nop
      }
    }
  ],
  actions: [
    {
      name: 'shareText',
      label: 'Share',
      isAvailable: function(refLink) { return refLink },
      code: async function(_, x) {

        var shareData = {
          text: this.referralText
        };

        navigator.share(shareData);
      }
    },
    {
      name: 'copyText',
      label: 'Copy',
      isAvailable: function(refLink) { return refLink },
      code: async function() {
        this.copy(this.referralText)
      }
    }
  ]
});
