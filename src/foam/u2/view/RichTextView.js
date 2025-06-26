/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * TODO:
 * - Migrate from execCommand as it has been deprecated,
 *   but it is still supported across browsers so maybe not?
 * - Add file support
 * - Add image support
 * - Add text formatting
 * - Add indentation buttons
 * - Add keyboard macros
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichTextView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.menu.LinkMenu',
    'foam.u2.ToggleActionView',
    'foam.u2.view.RichTextValidator'
  ],

  imports: [
    'document',
    'window'
  ],

  css: `
    ^{
      display: flex;
      flex-direction: column;
    }
    ^editor:empty:before{
      content: attr(placeholder);
      pointer-events: none;
      display: block;
      color: $textTertiary;
    }
    ^ > * + * {
      margin-top: 4px;
    }
    ^editor {
      border: 1px solid $borderDefault;
      border-radius: 4px;
      height: unset;
      overflow: auto;
      padding: 10px;
      position: relative;
      width: 100%;
    }
    ^dragged{
      background: $backgroundBrandTertiary;
      border: 2px dashed $borderBrand;
    }
    ^dragged::after{
      content: "Drop Here";
      font-weight: bold;
      left: 50%;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 100;
    }
    ^ButtonToolbar {
      display: flex;
      gap: 8px;
      width: 100%;
      flex-wrap: wrap;
    }
    ^ButtonToolbar > button + button {
      margin-left: 0 !important;
    }
    ^seperator{
      background: $backgroundSecondary0;
      width: 1px;
      height: 2em;
      align-self: center;
    }
    ^tool.foam-u2-ActionView {
      padding: 6px 10px;
      max-height: unset;
    }
  `,

  messages: [
    { name: 'PLACEHOLDER_MSG', message: 'Enter text/drop HTML' }
  ],

  properties: [
    {
      name: 'data',
      postSet: function(_,n) {
        if ( ! n )
          this.clearInput();
      }
    },
    {
      class: 'String',
      name: 'height',
      value: '400'
    },
    {
      class: 'String',
      name: 'width',
      value: '100%'
    },
    {
      name: 'placeholder',
      description: 'Placeholder text to appear when no text is entered.',
      factory: function() { return this.PLACEHOLDER_MSG; }
    },
    'richText',
    'currentSel_',
    'bold_',
    'italic_',
    'underline_',
    'link_',
    ['allowSelections', false],
    ['isDragged_', false],
    {
      class: 'Proxy',
      of: 'foam.u2.DefaultValidator',
      name: 'validator',
      factory: function() {
        return this.RichTextValidator.create();
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.onDetach(this.document.addEventListener('selectionchange', () => {
        if ( ! this.allowSelection ) return;
        this.currentSel_ = this.window.getSelection().getRangeAt(0);
      }));
      this
        .addClass(this.myClass())
        .startContext({ data: this })
        .start()
          .addClass(this.myClass('ButtonToolbar'))
          .tag(this.ToggleActionView, {
            action: this.BOLD,
            data: this
          }, this.bold_$)
          .tag(this.ToggleActionView, {
            action: this.ITALIC,
            data: this
          }, this.italic_$)
          .tag(this.ToggleActionView, {
            action: this.UNDERLINE,
            data: this
          },this.underline_$)
          .start(this.LINK, {  themeIcon: 'link', size: 'SMALL'}, this.link_$).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('seperator')).end()
          .start(this.LEFT_JUSTIFY, { themeIcon: 'leftAlign', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.CENTER_JUSTIFY, { themeIcon: 'centerAlign', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.RIGHT_JUSTIFY, {  themeIcon: 'rightAlign',size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('seperator')).end()
          .start(this.NUMBERED_LIST, { themeIcon: 'numberedList', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.BULLET_LIST, { themeIcon: 'bulletedList', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('seperator')).end()
          .start(this.DECREASE_INDENTATION, { themeIcon: 'decreaseIndentation', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INCREASE_INDENTATION, { themeIcon: 'increaseIndentation', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.BLOCK_QUOTE, { themeIcon: 'blockQuote', size: 'SMALL' }).addClass(this.myClass('tool')).end()
        .end()
        .endContext()
        .start('', {}, this.richText$)
          .addClass(this.myClass('editor'))
          .attr('contentEditable', true)
          .attr('placeholder', this.placeholder)
          .enableClass(this.myClass('dragged'), this.isDragged_$)
          .on('input', this.parseInnerHTML)
          .on('focus', () => {this.allowSelection = true;})
          .on('blur', () => {this.allowSelection = false;})
          .on('paste', this.onPaste)
          .on('dragover', e => { this.isDragged_ = true; e.preventDefault(); })
          .on('dragenter', e => { this.isDragged_ = true; e.preventDefault(); })
          .on('dragleave', e => { this.isDragged_ = false; e.preventDefault(); })
          .on('drop', this.onDrop)
        .end();

      // Set up toggle listeners
      this.bold_.actionState$.mapFrom(this.currentSel_$, () => { return this.document.queryCommandState('bold') });
      this.italic_.actionState$.mapFrom(this.currentSel_$, () => { return this.document.queryCommandState('italic') })
      this.underline_.actionState$.mapFrom(this.currentSel_$, () => { return this.document.queryCommandState('underline') })
    },

    function sanitizeDroppedHtml(html) {
      return this.validator.sanitizeText(html.replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    },

    function getSelectionText() {
      var selection = this.window.getSelection();

      if ( selection.rangeCount ) {
        return selection.getRangeAt(0).toLocaleString();
      }

      return '';
    },

    function clearInput() {
      if ( this.richText && this.richText.el_() )
        this.richText.el_().innerHTML = '';
    },

    function insertElement(e, sel) {
      var selection = this.window.getSelection();

      if ( sel || selection.rangeCount ) {
        var range = sel || selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(e);
        range.collapse();
      } else {
        // just insert into the body if no range selected
        var range = this.document.createRange();
        range.selectNodeContents(this.richText.el_());
        range.insertNode(e);
        range.collapse();
      }
      selection.removeAllRanges();
      selection.addRange(range);

      // Update the value directly because modifying the DOM programatically
      // doesn't fire an update event.
      this.parseInnerHTML(null, true);
    }
  ],

  listeners: [
    {
      name: 'onDrop',
      code: function(e) {
        e.preventDefault();
        this.isDragged_ = false;
        // TODO: add file support and sanitize
        // var length = e.dataTransfer.files.length;
        // for ( var i = 0 ; i < length ; i++ ) {
        //   var file = e.dataTransfer.files[i];
        //   var id = this.addAttachment(file);
        //   if ( file.type.startsWith("image/") ) {
        //     var img   = document.createElement('img');
        //     img.id = id;
        //     img.src = URL.createObjectURL(file);
        //     this.insertElement(img);
        //   }
        // }

        length = e.dataTransfer.items.length;
        if ( length ) {
          var txt = e.dataTransfer.getData('text/html');
          if ( ! txt )
            txt = e.dataTransfer.getData('text/plain');
          var div = this.sanitizeDroppedHtml(txt);
          this.insertElement(div);
        }
      }
    },
    {
      name: 'onPaste',
      code: function(e) {
        e.preventDefault();
        if ( e && e.inputType && e.inputType == 'insertFromPaste' ) {
          if ( e?.dataTransfer?.getData('text/html') || e?.dataTransfer?.getData('text/plain') ) {
            var txt = e?.dataTransfer?.getData('text/html') || e?.dataTransfer?.getData('text/plain');
            this.insertElement(this.sanitizeDroppedHtml(txt));
          }
        } else if ( e && e.type && e.type == 'paste' ) {
          var txt = e.clipboardData.getData('text');
          this.insertElement(this.sanitizeDroppedHtml(txt));
        }
        return false;
      }
    },
    {
      name: 'parseInnerHTML',
      isFramed: true,
      code: function(_, opt_skipValidate) {
        var el = this.richText.el_();
        if  ( opt_skipValidate ) {
          this.data = el.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          return;
        }
        var sanitized = this.sanitizeDroppedHtml(el.innerHTML);
        var div = document.createElement('div');
        div.style.dispaly = 'none';
        div.appendChild(sanitized);
        this.document.body.appendChild(div);
        this.data = div.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        this.document.body.removeChild(div);
      }
    }
  ],

  actions: [
    {
      name: 'bold',
      label: 'B',
      toolTip: 'Bold',
      code: function () {
        this.richText.focus();
        this.document.execCommand("bold");
      }
    },
    {
      name: 'italic',
      label: 'I',
      toolTip: 'Italic',
      code: function () {
        this.richText.focus();
        this.document.execCommand("italic");
      }
    },
    {
      name: 'underline',
      label: 'U',
      toolTip: 'Underline',
      code: function () {
        this.richText.focus();
        this.document.execCommand("underline");
      }
    },
    {
      name: 'link',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert link',
      code: function () {
        var rect = this.link_.el_().getBoundingClientRect();
        this.RichLink.create({
          richTextView: this,
          label: this.getSelectionText()}).open(rect.x, rect.y);
      }
    },
    {
      name: 'leftJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Left',
      code: function() {
        this.richText.focus();
        this.document.execCommand("justifyLeft");
      }
    },
    {
      name: 'centerJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Center',
      code: function() {
        this.richText.focus();
        this.document.execCommand("justifyCenter");
      }
    },
    {
      name: 'rightJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Right',
      code: function() {
        this.richText.focus();
        this.document.execCommand('justifyRight');
      }
    },
    {
      name: 'numberedList',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Numbered List',
      code: function() {
        this.richText.focus();
        this.document.execCommand('insertOrderedList');
      }
    },
    {
      name: 'bulletList',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Bulleted List',
      code: function() {
        this.richText.focus();
        this.document.execCommand('insertUnorderedList');
      }
    },
    {
      name: 'decreaseIndentation',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Indent Less',
      code: function() {
        this.richText.focus();
        this.document.execCommand('outdent');
      }
    },
    {
      name: 'increaseIndentation',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Indent More',
      code: function() {
        this.richText.focus();
        this.document.execCommand('indent');
      }
    },
    {
      name: 'blockQuote',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Quote',
      code: function() {
        this.richText.focus();
        this.document.execCommand('formatBlock', true, '<blockquote>');
      }
    }
  ],

  classes: [
    {
      name: 'RichLink',
      extends: 'foam.u2.Element',
      requires: [
        'foam.u2.md.OverlayDropdown',
      ],
      css: `
        ^ {
          display: flex;
          flex-direction: column;
        }
        ^ > * + * {
          margin-top: 8px;
        }
        ^insert {
          align-self: flex-end;
        }
      `,
      properties: [
        {
          class: 'FObjectProperty',
          of: 'foam.u2.Element',
          name: 'overlay_',
          factory: function() {
            return this.OverlayDropdown.create({closeOnLeave: false});
          }
        },
        {
          name: 'richTextView'
        },
        {
          class: 'String',
          name: 'label',
          placeholder: 'Link text'
        },
        {
          class: 'String',
          name: 'link',
          placeholder: 'Type or paste link.',
          preSet: function(_, value) {
            value = value.trim();
            // Disallow javascript URL's
            if ( value.toLowerCase().includes('javascript:') ||
                 value.toLowerCase().includes('url') ||
                 value.toLowerCase().includes('eval') )
              value = '';
            return value;
          }
        },
        ['overlayInitialized_', false]
      ],
      methods: [
        function initializeOverlay() {
          this.overlayInitialized_ = true;
          this.overlay_.parentEl = this.richTextView.el_();
          this.overlay_
            .start()
              .addClass(this.myClass())
              .startContext({ data: this })
                .add(this.LABEL)
                .add(this.LINK)
                .start()
                  .addClass(this.myClass('insert'))
                  .add(this.INSERT)
                .end()
              .endContext()
            .end();
          ctrl.add(this.overlay_);
        },
        function open(x, y) {
          if ( ! this.overlayInitialized_ ) this.initializeOverlay();
          this.overlay_.open(x, y);
        }
      ],
      actions: [
        {
          name: 'insert',
          label: 'Add Link',
          buttonStyle: 'PRIMARY',
          toolTip: 'Insert this link into the document.',
          code: function() {
            var el = this.document.createElement('a');
            // Is this secure? Limit it to current scope urls?
            el.href = this.link || '';
            // el.target = '_blank'; // Why was this here?
            el.title = this.label || this.link || '';
            el.appendChild(this.document.createTextNode(this.label || this.link || ''));
            this.richTextView.insertElement(el, this.richTextView.currentSel_);
            this.richTextView.document.body.focus();
            this.overlay_.close();
          }
        }
      ]
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'RichTextValidator',
  extends: 'foam.u2.DefaultValidator',

  imports: [ 'document' ],

  requires: [ 'foam.u2.Element' ],

  methods: [
    function sanitizeText(text) {
      var allowedElements = [
        {
          name: 'B',
          attributes: []
        },
        {
          name: 'I',
          attributes: []
        },
        {
          name: 'U',
          attributes: []
        },
        {
          name: 'P',
          attributes: ['style']
        },
        {
          name: 'SECTION',
          attributes: []
        },
        {
          name: 'BR',
          attributes: []
        },
        {
          name: 'BLOCKQUOTE',
          attributes: []
        },
        {
          name: 'OL',
          attributes: []
        },
        {
          name: 'UL',
          attributes: []
        },
        {
          name: 'LI',
          attributes: []
        },
        {
          name: 'DIV',
          attributes: ['style']
        },
        // TODO: add img support
        // {
        //   name: 'IMG',
        //   attributes: ['src'],
        //   clone: function(node) {
        //     var newNode = document.createElement('img');
        //     if ( node.src.startsWith('http') ) {
        //
        //     } else if ( node.src.startsWith('data:') ) {
        //
        //     } else {
        //       // Unsupported image scheme dropped in.
        //       return null;
        //     }
        //     return newNode;
        //   }
        // },
        {
          name: 'A',
          attributes: ['href']
        },
        {
          name: 'SPAN',
          attributes: ['style']
        },
        {
          name: '#text',
          attributes: []
        },
      ];

      function copyNodes(parent, node) {
        for ( var i = 0; i < allowedElements.length; i++ ) {
          if ( allowedElements[i].name === node.nodeName ) {
            if ( allowedElements[i].clone ) {
              newNode = allowedElements[i].clone(node);
            } else if ( node.nodeType === Node.ELEMENT_NODE ) {
              newNode = this.document.createElement(node.nodeName);
              for ( var j = 0; j < allowedElements[i].attributes.length; j++ ) {
                var currAttr = allowedElements[i].attributes[j];
                if ( node.hasAttribute(currAttr) ) {
                  // Validate attr data
                  var attr = node.getAttribute(currAttr);
                  attr = attr.trim();
                  // Is this safe? Should we look for ascii chars too?
                  if ( ! ( attr.toLowerCase().includes('javascript:') || attr.toLowerCase().includes('url(') || attr.toLowerCase().includes('eval(') ) ){
                    newNode.setAttribute(currAttr,node.getAttribute(currAttr));
                  }
                }
              }
            } else if ( node.nodeType === Node.TEXT_NODE ) {
              newNode = document.createTextNode(node.nodeValue);
            } else {
              newNode = document.createTextNode('');
            }
            break;
          }
        }
        if ( i === allowedElements.length ) {
          newNode = document.createElement('div');
        }
        if ( newNode && parent.appendChild ) {
          parent.appendChild(newNode);
        }
        for ( j = 0; j < node.childNodes?.length; j++ ) {
          if ( node.childNodes[j].nodeType === Node.TEXT_NODE ) {
            var n = this.document.createTextNode(node.childNodes[j].nodeValue);
            newNode.appendChild(n);
            continue;
          }
          copyNodes(newNode, node.childNodes[j]);
        }
      }

      var frame = this.document.createElement('iframe');
      frame.sandbox = 'allow-same-origin';
      frame.style.display = 'none';
      this.document.body.appendChild(frame);
      frame.contentDocument.body.innerHTML = text;

      var sanitizedContent = new DocumentFragment();
      for ( var i = 0; i < frame.contentDocument.body.childNodes.length; i++ ) {
        copyNodes(sanitizedContent, frame.contentDocument.body.childNodes[i]);
      }

      this.document.body.removeChild(frame);
      return sanitizedContent;
    }
  ]
});
