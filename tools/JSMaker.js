/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// JSMaker

exports.description = 'create minified foam-bin.js distribution';

const fs_      = require('fs');
const path_    = require('path');
const uglify_  = require('uglify-js');
const zlib_    = require('zlib');

var licenses   = {};
var version    = '';
var files      = {}; // filename to content map for uglify

function addLicense(l) {
  l = l.split('\n').map(l => l.trim()).join('\n');
  licenses[l] = true;
}

exports.args = [
  {
    name: 'outdir',
    description: 'location to write foam-bin files, default: {builddir}/js',
    factory: () => path_.resolve(path_.normalize(X.outdir || (X.builddir + '/js')))
  },
  {
    name: 'bundle',
    description: 'bundle name prefix for foam-bin output'
  }
];

exports.init = function() {
  this.adaptOrCreateArgs(X, exports.args);
  this.ensureDir(X.outdir);

  version = X.version || version;
  licenses = {};
  files    = {};

  flags.loadFiles = true;
}


exports.visitPOM = function(pom) {
  if ( ! version && pom.version ) version = pom.version;
  if ( typeof pom.licenses === 'string' ) {
    addLicense(pom.licenses);
  } else if ( Array.isArray(pom.licenses) ) {
    pom.licenses.forEach(addLicense);
  }
}


exports.end = function() {
  var self = this;
  var loaded = Object.keys(globalThis.foam.loaded);
  if ( Object.keys(loaded).length == 0 ) {
    this.info('[JS] flags:');
    Object.keys(globalThis.foam.flags).forEach(f => {
      self.log(f, globalThis.foam.flags[f]);
    });
    this.error('[JS] No files loaded');
  }

  loaded.unshift(path_.dirname(__dirname) + '/src/foam.js');

  // Build array of files for Uglify
  loaded.forEach(l => {
    // POM's can be included in files: so just ignore
    // This is needed when separate pom's need to be loaded in a specific
    // order rather than just before all files:. This happens in the main FOAM pom.
    if ( l.endsWith('pom.js') ) return;
    try {
      l = path_.resolve(__dirname, l);
      self.verbose('[JS] path', l);
      if ( X.stage === undefined ) {
        files[l] = fs_.readFileSync(l, "utf8");
      } else {
        var stage = foam.stages[l] ?? foam.defaultStage;
        if ( X.stage == stage ) {
          // this.log('***** IN stage:', X.stage,' *** file:', l);
          files[l] = fs_.readFileSync(l, "utf8");
        } else {
          // this.log('***** EX stage:', X.stage, stage, ' *** file:', l);
        }
      }
    } catch (x) {
      // this.log('********************************* Unexpected Error: ', x);
    }
  });

  var a = Object.keys(licenses);
  var license = '';
  if ( a.length == 1 ) {
    license = '\nCopyright:\n';
  } else if ( a.length ) {
    license = '\nPortions Copyright:\n';
  }
  license += a.join('');

  license = license.split('\n').map(l => '// ' + l).join('\n');

  this.log(`[JS] Version: ${version}, Licenses: ${Object.keys(licenses).length}, Files: ${Object.keys(files).length}, Stage: ${X.stage}`);
  var result = Object.keys(files).length && uglify_.minify(
    files,
    {
      compress: false,
      mangle:   false,
      module:   false,
      output:   {
        semicolons: false,
        preamble: `// Generated: ${new Date()}\n\n${license}\n` + ((X.stage === undefined || X.stage === '0') ? `globalThis.foam = { main: function() { /* prevent POM loading since code is in-lined below */ } };\n` : '')
      }
    });

  if (result && result.error) {
    this.error('[JS]', result.error);
  }
  var code = result && result.code;

  if ( ! code ) {
    this.warning('[JS] No output for stage', X.stage);
//    return;
    code = '';
  }

  // Remove most Java and Swift Code
  // - java only meta properties are from TypeInfo and after eg. javaTypeInfo, javaJSONParser, ... javaValidateObj
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):`(\\`|[^`])*`}/gm, '}');
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):"(\\"|[^"])*"}/gm, '}');
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):'(\\'|[^'])*'}/gm, '}');
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):`(\\`|[^`])*`,/gm, '');
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):"(\\"|[^"])*",/gm, '');
  code = code.replace(/(java|swift)(DefaultValue|Type|Code|Setter|Getter|Factory|PreSet|PostSet|Extends|Value|InfoType|JSONParser|FormatJSON|ToCSV|ToCSVLabel|CSVParser|CloneProperty|Compare|ValidateObj):'(\\'|[^'])*',/gm, '');
  code = code.replace(/swiftThrows:true,/gm, '');
  code = code.replace(/swiftSynchronized:true,/gm, '');
  code = code.replace(/swiftThrows:true}/gm, '}');
  code = code.replace(/swiftSynchronized:true}/gm, '}');
  code = code.replace(/javaGenerate(Convenience|Default)Constructor:false,?/gm, '');
  code = code.replace(/java(Imports|Throws|Implements):\[[^\]]*\], ?/gm, '');
  /*
  code = code.replace(/documentation:`(\\`|[^`])*`,?/gm, '');
  code = code.replace(/documentation:'(\\`|[^'])*',?/gm, '');
  code = code.replace(/documentation:"(\\`|[^"])*",?/gm, '');
  */
  code = code.replace(/documentation:`(\\"|[^`])*`}/gm, '}');
  code = code.replace(/documentation:'(\\"|[^'])*'}/gm, '}');
  code = code.replace(/documentation:"(\\"|[^"])*"}/gm, '}');
  code = code.replace(/documentation:`(\\"|[^`])*`,/gm, '');
  code = code.replace(/documentation:'(\\"|[^'])*',/gm, '');
  code = code.replace(/documentation:"(\\"|[^"])*",/gm, '');

  // Remove leading whitespace (probably from in-lined CSS)
  code = code.replaceAll(/^\s*/gm, '');

  function fn(s) {
    var stage = ( s === undefined || s == '0' ) ? '' : '-' + s;
    var bundle = X.bundle ? `${X.bundle}-` : '';
    return version ? `foam-bin-${bundle}${version}${stage}` : `foam-bin-${bundle}${stage}`;
  }

  // We record that we've loaded stage1 in localstorage so that we can be safe
  // and load it synchronously if we know that we've loaded it already.
  var name = `'/${fn('1')}.js'`;

  if ( X.stage === '0' ) {
    code += `
if ( ! foam.flags.skipStage1 ) {
  var next = () => foam.loadJSLibs([{name: ${name}}]);

  if ( window.location.hash || window.location.search.indexOf('otltoken') != -1 || localStorage.stage1version == ${name} ) {
    next();
  } else if ( globalThis.requestIdleCallback ) {
    window.setTimeout(() =>
      window.requestIdleCallback(next, {timeout:15000}),
      2000);
  } else {
    window.setTimeout(next, 2000);
  }
}
`;
  } else if ( X.stage === '1' ) {
    code += `
localStorage.stage1version = ${name};
if ( ! foam.flags.skipStage2 ) {
  foam.loadJSLibs([{name:'/${fn('2')}.js'}]);
}
`;
  }

  // Put each Model on its own line
  // not needed with the semicolons: false options set above
  // code = code.replaceAll(/foam.CLASS\({/gm, '\nfoam.CLASS({');

  var filename = fn(X.stage);
  this.log('[JS] Writing', filename + '.js');
  fs_.writeFileSync(X.outdir + "/" + filename + '.js', code);
  this.log('[JS] Writing', filename + '.js.gz');
  zlib_.gzip(code, (err, buffer) => {
    if ( ! err ) {
      fs_.writeFileSync(X.outdir + "/" + filename + '.js.gz', buffer);
    } else {
      this.error('[JS] Writing', filename, err);
    }
  });
}
