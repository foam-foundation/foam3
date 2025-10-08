/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.LIB({
  name: 'foam.Blob',
  methods: [
    function acquireUrl(blob) {
      blob.count_ = (blob.count_ || 0) + 1;
      if ( blob.count_ == 1 ) {
        blob.url_ = URL.createObjectURL(blob);
      }
      return blob.url_
    },
    function releaseUrl(blob) {
      blob.count_ = blob.count_ - 1;
      if ( blob.count_ == 0 ) {
        URL.revokeObjectURL(blob.url_);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.tag',
  name: 'Image',
  extends: 'foam.u2.View',

  requires: [
    'foam.net.HTTPRequest',
    'foam.u2.HTMLView',
    'foam.blob.Blob',
    'foam.blob.BlobBlob'
  ],

  css: `
    ^ .foam-u2-HTMLView {
      padding: 0;
    }
  `,

  constants: {
    CACHE: {}
  },

  properties: [
    {
      class: 'GlyphProperty',
      name: 'glyph'
    },
    {
      name: 'displayWidth',
      attribute: true
    },
    {
      name: 'displayHeight',
      attribute: true
    },
    ['alpha', 1.0],
    {
      class: 'String',
      name: 'role'
    },
    {
      class: 'Boolean',
      name: 'embedSVG'
    },
    {
      class: 'Boolean',
      name: 'sync'
    }
  ],

  methods: [
    function requestWithCache(data) {
      if ( ! this.CACHE[data] ) {
        this.CACHE[data] = new Promise(resolve => {
          this.HTTPRequest.create({method: 'GET', path: data, cache: true}).send().then(resp => {
            resp.resp.text().then(t => resolve(t));
          } );
        });
      }

      return this.CACHE[data];
    },

    function render() {
      var self = this;
      this
        .addClass(this.myClass())
        .add(this.dynamic(function(data, glyph, displayWidth, displayHeight, alpha) {
          if ( glyph ) {
            var indicator = glyph.clone(self).expandSVG();
            this.start(self.HTMLView, { data: indicator })
              .attrs({ role: self.role })
            .end();
            return;
          }

          if ( self.embedSVG && data?.endsWith('svg') ) {
            self.requestWithCache(data).then(data => {
              this.start(self.HTMLView, { data: data })
                .attrs({ role: self.role })
              .end();
            });

            return;
          }

          if ( ! data ) return null;

          var src = data;

          /// TODO: A better polymorphic way of doing this
          if ( self.BlobBlob.isInstance(src) ) {
            var url = foam.Blob.acquireUrl(src.blob);
            this.onDetach(() => {
              foam.Blob.releaseUrl(src.blob);
            })
            src = url;
          } else if ( self.Blob.isInstance(data) ) {
            src = self.__context__.blobService.urlFor(data);
          }

          this.start('img')
            .attrs({ src: src, role: self.role })
            .style({
              height:  displayHeight,
              width:   displayWidth,
              opacity: alpha
            })
          .end();
        }));
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2.tag',
  name: 'ImageScript',
  requires: [
    'foam.u2.tag.Image',
    'foam.u2.U2ContextScript'
  ],
  flags: ['web'],
  code: function() {
    foam.__context__.registerElement(foam.u2.tag.Image);
  }
});
