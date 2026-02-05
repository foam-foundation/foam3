/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Image',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.fs.File',
      name: 'image',
      transient: true,
      view: 'foam.u2.view.FileView',
      documentation: 'Transient upload property. Converts to base64 imageData on set.',
      postSet: function(old, nu) {
        if ( nu && nu.data && nu.data.blob ) {
          var self = this;
          var reader = new FileReader();
          reader.onload = function() {
            self.imageData = reader.result;
          };
          reader.readAsDataURL(nu.data.blob);
        }
      }
    },
    {
      class: 'String',
      name: 'imageData',
      documentation: 'Base64 data URL of the uploaded image. Persists with the flow.',
      hidden: true
    },
    {
      class: 'Int',
      name: 'maxWidth'
    },
    {
      class: 'Int',
      name: 'maxHeight'
    },
    {
      class: 'String',
      name: 'alt'
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.core.reflow.ImageView, {data: this});
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ImageView',
  extends: 'foam.u2.View',

  documentation: 'Display view for reflow Image. Uses base64 data URL stored inline.',

  methods: [
    function render() {
      this.add(this.data.dynamic(function(imageData, alt, maxWidth, maxHeight) {
        if ( ! imageData ) return;

        var style = {};
        if ( maxWidth )  style['max-width']  = maxWidth + 'px';
        if ( maxHeight ) style['max-height'] = maxHeight + 'px';

        this.start('img').attrs({ src: imageData, alt: alt || '' }).style(style).end();
      }));
    }
  ]
});


// TODO: it should be possible to simplify this and only handle 'src' and let everything else pass through
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ImageTag',
  extends: 'foam.u2.Element',

  imports: [ 'scope?' ],
  exports: [ 'elementForName' ],

  properties: [
    {
      name: 'src',
      attribute: true,
      preSet: function(o, n) {
        if ( ! this.scope ) return n;
        // If the src is the name of a value from the scope (probably from reflow) then
        // use that image's imageData if it has it instead
        let image = this.scope[n];
        if ( image && image.imageData ) {
          n = image.imageData;
        }
        return n;
      }
    },
    { class: 'String', name: 'title', attribute: true },
    { class: 'String', name: 'alt',   attribute: true },
    { class: 'Int',    name: 'width'  },
    { class: 'Int',    name: 'height' }
  ],

  methods: [
    function render() {
      this.dynamic(function(src, title, alt, width, height) {
        if ( ! src ) return;

        let style = {};
        if ( width  ) style.width  = width;
        if ( height ) style.height = height;

        // We create an Element() instead of doing start('img') to avoid in infinite loop
        // where the 'img' element gets replaced by this view.
        this.start(foam.u2.Element.create({nodeName: 'img'}, this))
          .attrs({ src: src, title: title, alt: alt })
          .style(style)
        .end();
      });
    }
  ]
});


foam.SCRIPT({
  package: 'foam.core.reflow',
  name: 'ImageScript',
  code: function() {
    foam.__context__.registerElement(foam.core.reflow.ImageTag, 'img');
  }
});
