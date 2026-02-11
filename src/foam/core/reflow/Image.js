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
      class: 'String',
      name: 'sizingStrategy',
      value: 'Auto',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: ['Auto', 'Manual', 'Maintain-Ratio']
      }
    },
    {
      class: 'Int',
      name: 'width',
      value: 100,
      visibility: function(sizingStrategy) {
        return sizingStrategy === 'Auto' ? 'HIDDEN' : 'RW'
      }
    },
    {
      class: 'Int',
      name: 'height',
      value: 100,
      visibility: function(sizingStrategy) {
        return sizingStrategy === 'Auto' || sizingStrategy === 'Maintain-Ratio' ? 'HIDDEN' : 'RW'
      }
    },
    {
      class: 'String',
      name: 'alt'
    }
  ],

  methods: [
    function addToE(e) {
      e.start('img')
        .attrs({
          src: this.imageData$,
          alt: this.alt$,
          width: this.slot(function(sizingStrategy, width) {
            if ( sizingStrategy === 'Auto') return 'auto';
            return width;
          }),
          height: this.slot(function(sizingStrategy, height) {
            if ( sizingStrategy === 'Auto') return 'auto';
            if ( sizingStrategy === 'Maintain-Ratio') return 'auto';
            return height;
          })
        })
      .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ImageTag',
  extends: 'foam.u2.Element',
  imports: [ 'scope?' ],

  properties: [
    ['nodeName', 'img'],
    {
      name: 'src',
      attribute: 'BOTH',
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
