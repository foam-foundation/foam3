/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  name: 'TokenTest',
  extends: 'foam.u2.View',

  imports: ['ctrl?'],

  exports: [
    'tokenDAO as cssTokenOverrideDAO',
    'tokenService as cssTokenOverrideService'
  ],
  css: `
    ^test1 {
      background: $test1;
      color: $test1$foreground;
    }
    ^test2 {
      background: $test1$hover;
      color: $test1$hover$foreground;
    }
  `,
  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'test1',
      value: 'red'
    }
  ],

  properties: [
    'color', 'color2',
    {
      name: 'disabled',
      class: 'Boolean',
    },
    {
      name: 'loading',
      class: 'Boolean',
    },
    {
      class: 'Enum',
      of: 'foam.u2.ButtonStyle',
      name: 'style'
    },
    {
      name: 'tokenDAO',
      factory: function() {
        return foam.dao.EasyDAO.create({
          of: foam.core.theme.customisation.CSSTokenOverride,
          daoType: 'MDAO'
        }, this);
      }
    },
    {
      name: 'tokenService',
      factory: function() {
        return foam.core.theme.customisation.CSSTokenOverrideService.create({}, this);
      }
    }
  ],
  methods: [
    function render() {
      this.tokenService.sub('cacheUpdated', () => {
        if ( this.ctrl ) return;
        let a = foam.u2.CSS.create({ code: this.cls_.model_.css  }, this);
        let b = foam.u2.CSS.create({ code: foam.u2.tag.Button.model_.css  }, this);
        this.__subContext__.installCSS(a.expandCSS(this.cls_, a.code, this.__subContext__));
        this.__subContext__.installCSS(a.expandCSS(foam.u2.ActionView, b.code, this.__subContext__));
      });
      this
      .start()
        .addClass(this.myClass('test1'))
        .add('Token test1 as background, auto-generated foreground')
      .end()
      .start()
        .addClass(this.myClass('test2'))
        .add('Token test2 as background (auto generated as 20% darker version of test1, also generates foreground based on current background)')
      .end()
      .br().br()
      .startContext({ data: this })
      .tag(this.COLOR.__, { config: { label: 'Color for buttonPrimaryColor token' } })
      .tag(this.COLOR2.__, { config: { label: 'Color for buttonSecondaryColor token' } })
      .add(this.DISABLED.__)
      .add(this.LOADING.__)
      .add(this.STYLE.__)
      .tag(this.SAVE)
      .br().br()
      .start()
      .add('Interact with this action to see auto generated hover and clicked states')
      .br()
      .start(this.TEST_ACTION, { buttonStyle$: this.style$, loading_$: this.loading$ }).addClass(this.myClass('myButton')).end()
      .end()
      .endContext();
    }
  ],
  actions: [
    {
      name: 'testAction',
      toolTip: 'This action will load for 10 seconds on click',
      isEnabled: function(disabled) { return ! disabled; },
      code: function() {
        return new Promise(res => setTimeout(res, 10000));
      }
    },
    {
      name: 'save',
      code: async function(X) {
        await X.cssTokenOverrideDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({ theme: '', source: 'buttonPrimaryColor', target: this.color }, this));
        var result = await X.cssTokenOverrideDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({ theme: '', source: 'buttonSecondaryColor', target: this.color2 }, this));
      }
    }
  ]
});
