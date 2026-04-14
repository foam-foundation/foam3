/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JrlLoader',

  documentation: `Generic JRL file loader using eval-intercept pattern.
    Defines p (put), c (create), r (remove) as interceptor functions,
    evals the JRL content, and returns collected objects.
    Reusable by any part of the system that needs to load JRL files.`,

  methods: [
    function loadFile(filePath) {
      var fs_;
      try { fs_ = require('fs'); } catch ( e ) { return []; }
      if ( ! fs_.existsSync(filePath) ) return [];
      var content = fs_.readFileSync(filePath, 'utf8');
      return this.loadString(content);
    },

    function loadFiles(filePaths) {
      var all = {};
      for ( var i = 0 ; i < filePaths.length ; i++ ) {
        var objects = this.loadFile(filePaths[i]);
        for ( var j = 0 ; j < objects.length ; j++ ) {
          var obj = objects[j];
          var key = (obj['class'] || '') + ':' + (obj.id || j);
          all[key] = obj;
        }
      }
      var result = [];
      for ( var k in all ) {
        if ( all.hasOwnProperty(k) ) result.push(all[k]);
      }
      return result;
    },

    function loadString(content) {
      var objects = {};
      var ordered = [];
      var nextId = 0;

      function put(obj) {
        if ( ! obj || typeof obj !== 'object' ) return;
        var key = (obj['class'] || '') + ':' + (obj.id != null ? obj.id : '__auto_' + (nextId++));
        if ( ! objects[key] ) ordered.push(key);
        objects[key] = obj;
      }

      function remove(obj) {
        if ( ! obj || typeof obj !== 'object' ) return;
        var key = (obj['class'] || '') + ':' + (obj.id != null ? obj.id : '');
        if ( objects[key] ) {
          delete objects[key];
          var idx = ordered.indexOf(key);
          if ( idx !== -1 ) ordered.splice(idx, 1);
        }
      }

      try {
        var fn = new Function('p', 'c', 'r', content);
        fn(put, put, remove);
      } catch ( e ) {
        // Malformed JRL — return whatever was collected before the error
      }

      var result = [];
      for ( var i = 0 ; i < ordered.length ; i++ ) {
        if ( objects[ordered[i]] ) result.push(objects[ordered[i]]);
      }
      return result;
    },

    function filterByClass(objects, className) {
      var result = [];
      for ( var i = 0 ; i < objects.length ; i++ ) {
        if ( objects[i]['class'] === className ) result.push(objects[i]);
      }
      return result;
    }
  ]
});
