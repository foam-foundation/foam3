/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'CopyBorder',
  extends: 'foam.u2.Element',

  requires: ['foam.u2.util.CopyButton'],

  documentation: `Wraps arbitrary content with a copy-to-clipboard button, for
    custom views that render copyable text outside a property view:

      this.start(this.CopyBorder).add(this.data.arn$).end()

    With no copyText set, the button copies the wrapped content's rendered
    text — everything inside the border, so keep labels or prefixes outside
    it. Set copyText (or bind a slot via copyText$) to copy an explicit value
    instead, for content that renders icons or formatting:

      this.start(this.CopyBorder, { copyText$: this.data.arn$ }).
        tag(SomeIconView).end()

    The button hides until hover on hover-capable devices and stays visible
    on touch; override ^copy-button { opacity: 1 } to always show it.`,

  css: `
    ^ {
      align-items: center;
      display: inline-flex;
      gap: 4px;
    }
    ^copy-button {
      flex-shrink: 0;
    }
    /* Only hide the copy button behind hover on devices that can hover;
       on touch devices it stays visible. */
    @media (hover: hover) {
      ^copy-button { opacity: 0; }
      ^:hover ^copy-button, ^copy-button:focus-visible { opacity: 1; }
    }
  `,

  properties: [
    {
      name: 'copyText',
      documentation: `Explicit text to copy. Left unset, the button copies the
        wrapped content's innerText at click time. Untyped so an unset value is
        distinguishable from an empty string.`
    },
    {
      class: 'String',
      name: 'label',
      documentation: `What the copied value is, for the button's aria-label.`
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this.
        addClass().
        start('span', null, this.content$).end().
        start(this.CopyButton, {
          label: this.label,
          textProvider: function() {
            if ( self.hasOwnProperty('copyText') ) return self.copyText;
            var node = self.content.el_();
            return node ? node.innerText.trim() : '';
          }
        }).
          addClass(this.myClass('copy-button')).
        end();
    }
  ]
});
