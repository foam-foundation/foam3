/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

exports.description = 'copies .flow and .md files into /build/documents';

const fs_                                 = require('fs');

const documentFiles = [];

exports.init = function() {
  X.documentdir = X.documentdir || (X.builddir + '/documents');
  this.ensureDir(X.documentdir);
}


exports.visitFile = function(pom, f, fn) {
  if ( ( f.name.endsWith('.flow') ||
         f.name.endsWith('.md') ) &&
       ! f.name.startsWith('README') ) {
    if ( ! this.isExcluded(pom, fn) ) {
      this.verbose('\t\tdocument source:', fn);

      var i            = fn.lastIndexOf('/');
      var documentName = fn.substring(i+1);

      this.copyFile(fn, X.documentdir + '/' + documentName);
      documentFiles.push(fn);
    }
  }
}


exports.end = function() {
  this.log(`[Doc Maker] Copied ${documentFiles.length} flow|md document files to ${X.documentdir}.`);
}
