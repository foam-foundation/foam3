/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'TitleBorder',
  extends: 'foam.u2.borders.NullBorder',
  documentation: `
    Simple border that adds a title around it's content
  `,

  css:`
    ^baseTitle {
      padding-bottom: 1rem;
    }
  `,

  properties: [
    {
      name: 'title',
      class: 'String',
      reactive: false,
      optionalBorder: true
    },
    {
      class: 'String',
      name: 'titleStyle',
      value: 'h300',
      visibility: function(title) {
        return title ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      view: {
        class: 'foam.u2.TextField',
        choices:  [ 'h100', 'h200', 'h300', 'h400', 'h500', 'h600', 'h700', 'p-semiBold', 'p-bold' ]
      }
    },
    {
      name: 'oldTitleStyle_',
      hidden: true
    }
  ],

  methods: [
    function render() {
      let self = this;
      this.SUPER();
      this.start()
        .show(this.title$)
        .add(this.title$)
        .addClass(this.myClass('baseTitle'))
        .call(function() {
          let l = () => {
            this.removeClass(self.oldTitleStyle_);
            self.oldTitleStyle_ = self.titleStyle;
            this.addClass(self.titleStyle);
          };
          self.titleStyle$.dedup().sub(l);
          l();
        })
      .end()
      .tag('', {}, this.content$);
    }
  ]
});
