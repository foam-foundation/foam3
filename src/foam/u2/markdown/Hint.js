/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Hint',
  extends: 'foam.u2.Controller',
  documentation: `
    Renders a body of text within a "hint" box
  `,

  requires: [ 'foam.u2.tag.Image' ],

  css: `
    ^icon {
      color: currentColor;
      flex: 0 0 24px;
      height: 24px;
      margin-right: 8px;
    }

    ^icon svg {
      width: 100%;
      height: 100%;
    }

    ^box {
      margin: 8px;
      padding: 8px;
      border: 2px solid;
      border-radius: 8px;
      display: flex;
    }

    ^hint {
      color: $hintText;
      background-color: $hintBackground;
      border-color: $hintBorder;
    }

    ^warning {
      color: $hintWarningText;
      background-color: $hintWarningBackground;
      border-color: $hintWarningBorder;
    }

    ^danger {
      color: $hintDangerText;
      background-color: $hintDangerBackground;
      border-color: $hintDangerBorder;
    }

    ^success {
      color: $hintSuccessText;
      background-color: $hintSuccessBackground;
      border-color: $hintSuccessBorder;
    }
  `,

  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.markdown.HintCategory',
      name: 'category',
      attribute: true,
      adapt: function(old, nu) {
        var E = foam.u2.markdown.HintCategory;
        if ( E.isInstance(nu) ) return nu; // If we we're passed an enum we're all good!
        if ( foam.String.isInstance(nu) ) { // If we're passed a string...
          var v = E[nu.toUpperCase()]; // ...it needs to be converted into an enum
          if ( v ) return v;
        }
        return old || E.HINT; // Default to hint if anything goes wrong
      }
    },
    {
      class: 'String',
      name: 'iconName',
      expression: function(category) {
        return category && category.glyphName || 'hintInfo';
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass()
        .addClass(this.myClass('box'))
        .addClass(this.category$.map(function(c) {
          return self.myClass(c && c.cssClass ? c.cssClass : 'hint');
        }))
        .start()
          .addClass(this.myClass('icon'))
          .add(this.iconName$.map(function(n) {
            return self.Image.create({
              glyph:    n || 'documentation',
              embedSVG: true
            }, self);
          }))
        .end();
    }
  ]
});

foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'HintTagScript',
  documentation: 'Registers hint custom elements for use in markdown',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Hint); // <hint>
  }
});