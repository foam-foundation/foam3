/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'CapabilityRequirementView',
  extends: 'foam.u2.View',

  imports: [
    'ctrl'
  ],

  requires: [
    'foam.u2.crunch.Style',
  ],

  css: `
    << {
      max-width: 60vw;
      max-height: 75vh;
      overflow: auto;
      margin: 24px;
      text-align: center;
    }

    <<title {
      padding-bottom: 1em;
    }

    <<subTitle {
      color: $textSecondary;
      width: 85%;
      display: inline-block;
      padding-bottom: 1em;
    }

    << .table-content {
      color: $textTertiary;
      padding-left: 1.5vw;
      margin-top: -19px;
      padding-bottom: 2vh;
    }

    << .circle-center {
      padding-top: 1em;
      padding-bottom: 1em;
      text-align: center;
    }

    << .actionPosition {
      float: right;
      padding: 1em;
    }
  `,

  messages: [
    {
      name: 'INTRO_TEXT',
      message: `In this section, we ask you to enter some details relating to your business.`
    }
  ],

  properties: [
    {
      class: 'StringArray',
      name: 'arrayRequirement'
    },
    {
      class: 'Function',
      name: 'onClose'
    },
    {
      class: 'Object',
      name: 'functionData'
    },
    {
      class: 'String',
      name: 'capabilityId'
    }
  ],

  methods: [
    function render() {
      var style = this.Style.create();
      style.addBinds(this);
      var mainCapability = this.functionData ?
        this.functionData.caps.filter(
          capability =>
            capability.id == this.capabilityId
        ) :
        undefined;
      this.addClass().addClass('start')
        // center icon image
        .start().callIf(mainCapability, function() {
          return this.addClass('circle-center')
            .start()
              .addClass(style.myClass('icon-circle'))
              .style({
                'background-image': `url('${mainCapability[0].icon}')`,
                'background-size': 'cover',
                'background-position': '50% 50%'
              })
            .end();
        }).end()

        .start().addClass('titles')
          // title
          .start().addClass(this.myClass('title'), 'h400')
            .callIfElse(mainCapability[0].marketingHeader,
              function() { this.translate(mainCapability[0].id+'.marketingHeader', mainCapability[0].marketingHeader); },
              function() { this.translate(mainCapability[0].id+'.name', mainCapability[0].name); }
            )
          .end()
          // subTitle
          .start().addClass(this.myClass('subTitle'), 'p-lg')
            .translate(mainCapability[0].id + '.requirementViewTitle' , mainCapability[0].requirementViewTitle || this.INTRO_TEXT)
          .end()
        .end()
      .start().addClass('actionPosition')
        .startContext({ data: this })
          .tag(this.GET_STARTED, { buttonStyle: 'PRIMARY' })
          .tag(this.CANCEL, { buttonStyle: 'SECONDARY' })
        .endContext()
      .end();
    }
  ],
  actions: [
    {
      name: 'getStarted',
      label: 'Get started',
      code: function(x) {
        x.closeDialog();
        this.onClose(x, true);
      }
    },
    {
      name: 'cancel',
      code: function(x) {
        x.closeDialog();
        this.onClose(x, false);
      }
    }
  ]
});
