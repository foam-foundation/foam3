/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.util',
  name: 'CopyButton',
  extends: 'foam.u2.Element',

  mixins: ['foam.u2.util.ClipboardAccess'],

  documentation: `A copy-to-clipboard icon button. 'textProvider' is called at
    click time and its return value (stringified, undefined becomes '') is
    written to the clipboard. Positioning and reveal styling (hover-hide,
    alignment) belong to the host's stylesheet; this class only styles the
    button itself.`,

  css: `
    ^ {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0 4px;
    }
    ^ img {
      width: 14px;
      height: 14px;
    }
  `,

  messages: [
    { name: 'COPY',       message: 'Copy' },
    { name: 'COPY_LABEL', message: 'Copy {label}' }
  ],

  properties: [
    ['nodeName', 'button'],
    {
      name: 'textProvider',
      documentation: 'function(): String — returns the text to copy, called at click time.'
    },
    {
      class: 'String',
      name: 'label',
      documentation: `What the copied value is, for assistive technology: the
        aria-label becomes the COPY_LABEL message with {label} substituted, so
        translations can reorder the verb and the label.`
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this
        .addClass()
        .attrs({
          type: 'button',
          title: this.COPY,
          'aria-label': this.label ?
            this.COPY_LABEL.replace('{label}', this.label) :
            this.COPY
        })
        .on('click', function(e) {
          // Keep the click from also triggering host handlers such as a table
          // row's open-detail-view click.
          e.stopPropagation();
          e.preventDefault();
          self.copy(String(self.textProvider() ?? ''));
        })
        .start('img')
          .attrs({ src: '/images/copy-icon.svg', alt: '' })
        .end();
    }
  ]
});
