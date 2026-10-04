/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CopyTextField',
  extends: 'foam.u2.Controller',
  documentation: 'Read-Only text field that copies the contents of the field when the user clicks',

  mixins: ['foam.u2.util.ClipboardAccess'],

  css: `
    << {
      cursor: pointer;
      position:relative;
    }
    <<:after{ 
      content: '';
      background: transparent;
      position: absolute;
      top: 0; 
      bottom: 0; 
      left: 0; 
      right: 0;
      width:100%;
      height: 100%;
    }
    <<textfield {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      background: $backgroundDefault url(/images/copy-icon.svg) no-repeat;
      background-position: right 0.5em top 50%;
      font-size: 1.6rem;
      height: 4rem;
      width: 100%;
    }
    <<showTooltip{
      transform: scaleY(0) translateX(-50%);
      left: 50%;
      top: 104%;
    }
    <<show {
      animation-name: bounce;
      animation-duration: 2s;
      text-align: center;
    }
    @keyframes bounce {
      0%, 100% {
        transform: scaleY(0) translateX(-50%);
        transform-origin: 100% 0%;
      }
      10%, 90%  {
        transform: scaleY(1) translateX(-50%);
        transform-origin: 100% 0%;
      }
    }
  `,

  imports: [
    'notify'
  ],
  
  properties: [
    {
      name: 'data',
      documentation: 'content to be copied'
    },
    {
      name: 'label',
      class: 'String',
      documentation: 'content shown inside the text field',
      expression: function(data) {
        return data;
      },
      view: {
        class: 'foam.u2.TextField',
        autocomplete: false
      },
      visibility: 'DISABLED'
    },
    'showTooltip_'
  ],
  methods: [
    function render() {
      this.SUPER();
      this
        .addClass()
        .on('click', () => {
          this.copyText();
        })
        .start(this.LABEL, { mode$: this.LABEL.createVisibilityFor( this.label$, this.controllerMode$)})
          .addClass(this.myClass('textField'))
        .end()
        .start(foam.u2.TooltipView, { data: 'Copied!' })
          .addClass(this.myClass('showTooltip'))
          .enableClass(this.myClass('show'), this.showTooltip_$)
        .end();
    }
  ],
  actions: [
    {
      name: 'copyText',
      code: function(_, X) {
        var self = this;
        let res = this.copy(this.data);
        res.then(() => {
          this.showTooltip_ = true;
          setTimeout(() => { this.showTooltip_ = false; }, 1000);
        }, e => {
          self.notify(e.message, '', foam.log.LogLevel.ERROR, true);
        });
      }
    }
  ]
});
