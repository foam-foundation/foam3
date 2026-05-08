/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.blob',
  name: 'BlobBlob',
  extends: 'foam.blob.AbstractBlob',

  properties: [
    {
      name: 'blob',
      cloneProperty: function(value, map) {
        map[this.name] = value;
      }
    },
    {
      name: 'size',
      factory: function() {
        return this.blob.size;
      }
    }
  ],

  methods: [
    function read(out, offset, length) {
      var b = this.blob.slice(offset, offset + length);

      // Node.js: use blob.arrayBuffer() API (Node.js 18+)
      if ( typeof FileReader === 'undefined' ) {
        return b.arrayBuffer().then(function(arrayBuffer) {
          out(arrayBuffer);
        });
      }

      // Browser: use FileReader API
      var reader = new FileReader();

      return new Promise(function(resolve, reject) {
        reader.onload = function(e) {
          out(reader.result);
          resolve();
        };

        reader.onerror = function(e) {
          reject(e);
        };

        reader.readAsArrayBuffer(b);
      });
    }
  ]
});
