/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'SignatureHelpHandler',

  documentation: 'Parameter hints for method calls inside FOAM model files. Triggered by `(` or `,`.',

  properties: [
    { name: 'index' },
    { name: 'cache' }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var lines  = text.split('\n');
      var line   = lines[position.line] || '';
      var prefix = line.substring(0, position.character);

      var callMatch = prefix.match(/(?:this\.)?(\w+)\s*\(\s*[^)]*$/);
      if ( ! callMatch ) return null;

      var methodName = callMatch[1];

      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( ! model ) return null;
      var classId = this.cache.getClassId(model);

      var methods = this.index.getMethods(classId);
      var method = null;
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name === methodName ) { method = methods[i]; break; }
      }
      if ( ! method ) return null;

      var params = [];
      if ( method.args && method.args.length > 0 ) {
        for ( var i = 0 ; i < method.args.length ; i++ ) {
          var a = method.args[i];
          params.push({
            label:         a.name,
            documentation: a.type ? 'Type: ' + a.type : ''
          });
        }
      } else if ( method.code ) {
        var match = method.code.toString().match(/function\s*\w*\s*\(([^)]*)\)/);
        if ( match && match[1].trim() ) {
          var paramNames = match[1].split(',').map(function(p) { return p.trim(); });
          for ( var i = 0 ; i < paramNames.length ; i++ ) {
            params.push({ label: paramNames[i] });
          }
        }
      }

      if ( params.length === 0 ) return null;

      var sig         = methodName + '(' + params.map(function(p) { return p.label; }).join(', ') + ')';
      var afterParen  = prefix.substring(prefix.lastIndexOf('(') + 1);
      var activeParam = (afterParen.match(/,/g) || []).length;

      return {
        signatures: [{
          label:         sig,
          documentation: method.documentation || '',
          parameters:    params
        }],
        activeSignature: 0,
        activeParameter: Math.min(activeParam, params.length - 1)
      };
    }
  ]
});
