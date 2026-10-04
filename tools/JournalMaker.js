/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

exports.description = 'Concatenate all repository .jrl files into .0 files.';

const fs_   = require('fs');
const path_ = require('path');

const journalFiles  = [];
const journalOutput = {};
const imageDirs     = [ 'images' ];
const COPY_BUFFER_SIZE = 1024 * 1024; // MB -

function addJournalOutput(j, o) {
  if ( ! journalOutput[j] ) journalOutput[j] = [];
  journalOutput[j].push(o);
}

function writeFileChunked(source, targetFd) {
  const sourceFd = fs_.openSync(source, 'r');
  const buffer = Buffer.allocUnsafe(COPY_BUFFER_SIZE);

  try {
    var bytesRead;
    do {
      bytesRead = fs_.readSync(sourceFd, buffer, 0, buffer.length, null);
      if ( bytesRead > 0 ) fs_.writeSync(targetFd, buffer, 0, bytesRead);
    } while ( bytesRead > 0 );
  } finally {
    fs_.closeSync(sourceFd);
  }
}

// Any .md file carrying a <flow> tag is a FLOW document: markdown kept editable
// with normal tools, with its FLOW properties in the tag:
//   <flow name="someName" category="optional" label="optional" description="optional"
//         keywords="keyword1,keyword2,..." notes="optional" spid="optional"
//         accessLevel="optional"/>
const FLOW_TAG  = /<flow\b([^>]*?)\/?>[ \t]*\r?\n?/i;
const FLOW_ATTR = /([a-zA-Z][-a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

// Properties copied straight through from the <flow> tag to the Flow model.
// accessLevel is a FlowAccess enum, written by name (eg. "PUBLIC_RO"): a string
// enum value resolves via Enum.valueOf() in the generated cast().
const FLOW_STRING_ATTRS = [ 'category', 'label', 'description', 'notes', 'spid', 'accessLevel' ];

// Parse and remove the <flow> tag, returning its attributes plus the remaining
// markdown, or null if the file has no <flow> tag.
function parseFlowTag(txt) {
  var m = FLOW_TAG.exec(txt);
  if ( ! m ) return null;

  // First version removes the <foam> tag
  //  var attrs = { markdown_: txt.substring(0, m.index) + txt.substring(m.index + m[0].length) };

  // Keep the <foam> tag. In the future this should be removed and regenerated in REFLOW on save/export.
  var attrs = { markdown_: txt };

  // Attribute names are the Flow property names, so keep their case.
  FLOW_ATTR.lastIndex = 0;
  for ( var a ; ( a = FLOW_ATTR.exec(m[1]) ) ; )
    attrs[a[1]] = a[2] !== undefined ? a[2] : a[3];

  return attrs;
}

// Escape markdown for inclusion in a """ block.
function escapeMultiline(str) {
  // Backslashes first: the parser unescapes \\ to \ and \c to c, so literal
  // backslashes must be doubled before any escapes of our own are added.
  str = str.replace(/\\/g, '\\\\');

  // Runs of 3+ quotes would close the block early, and so would a trailing run
  // of any length once the closing delimiter is appended to it.
  str = str.
    replace(/"{3,}/g, m => m.replace(/"/g, '\\"')).
    replace(/"+$/,    m => m.replace(/"/g, '\\"'));

  // The journal reader is line based: it opens a record on a line that is
  // exactly p({ or r({ and closes it on a line that is exactly })
  // (foam/dao/AbstractFileJournal.js:399-404). Markdown holding such a line --
  // any JS code sample ending in }) -- would otherwise split its own record,
  // losing that document and turning the rest of its text into junk entries.
  // The reader compares the raw line, the parser unescapes it, so escaping a
  // character hides the line from the reader and still yields the same text.
  // It has to be the SECOND character: a leading \\r would read as a carriage
  // return (ASCIIEscapeParser.java:44), whereas ( and ) are not escape letters
  // and fall through to the literal-next-character rule.
  return str.split('\n').
    map(l => ( l === '})' || l === 'p({' || l === 'r({' ) ?
      l.charAt(0) + '\\' + l.substring(1) : l).
    join('\n');
}

// Build the flows.jrl entry for one .fmd file: a Flow whose script is a single
// markdown block holding the file's text. 'source' records the file the FLOW
// was generated from, so that it can be traced back to, and eventually resaved
// to, its .fmd.
function flowJournalEntry(attrs, name, source) {
  var props = [
    '"class": "foam.core.reflow.Flow"',
    `"name": ${JSON.stringify(name)}`,
    `"source": ${JSON.stringify(source)}`
  ];

  FLOW_STRING_ATTRS.forEach(k => {
    if ( attrs[k] ) props.push(`"${k}": ${JSON.stringify(attrs[k])}`);
  });

  if ( attrs.keywords ) {
    var kws = attrs.keywords.split(',').map(k => k.trim()).filter(k => k);
    if ( kws.length ) props.push(`"keywords": ${JSON.stringify(kws)}`);
  }

  props.push(`"script": [
	{
		"flowName": "markdown1",
		"cmd": "markdown",
		"value": {
			"class": "foam.core.reflow.Markdown",
			"markdown":
"""${escapeMultiline(attrs.markdown_)}"""
		}
	}
]`);

  return `p({\n  ${props.join(',\n  ')}\n})\n`;
}

exports.init = function() {
  X.journaldir = X.journaldir || (X.builddir + '/journals');
  this.emptyDir(X.journaldir);

  flags.loadFiles = true;
}

exports.visitFile = function(pom, f, fn) {
  if ( f.name.endsWith('.jrl') ) {
    var i           = fn.lastIndexOf('/');
    var journalName = fn.substring(i+1, fn.length-4);

    // Disallow wildcard matching for excluding .jrl files, excluded entries must be exact match
    // if ( isExcluded(pom, fn, true) ) return;

    // Until all journal files are under pom control, use the
    // journalFiles list as an exclude list.
    // If test flag enabled - include if present and flag match
    if ( ! flags.test && pom.journalFiles ) {
      // journalFiles name is relative to pom
      var name = f.parentPath ? f.parentPath.substring(pom.location.length+1) : '';
      name += (name ? '/' : '') + journalName;
      let jf = pom.journalFiles.find((jf) => jf.name === name);
      if ( jf && foam.checkForFlag(foam.adaptFlags(jf.flags), 'test') )
        return;
    }
    if ( f.name.endsWith('tests.jrl') && ! flags.test )
      return;

    this.verbose('\t\tjournal source:', fn);
    journalFiles.push(fn);

    addJournalOutput(journalName, {
      fn: fn,
      msg: `// The following lines were copied from "${path_.relative(process.cwd(), fn)}"\n`
    });
  }
  else if ( f.name.endsWith('.md') ) {
    if ( this.isExcluded(pom, fn) ) return;

    var attrs = parseFlowTag(fs_.readFileSync(fn).toString());

    // Only markdown files which declare themselves a FLOW become journal entries.
    if ( ! attrs ) {
      return;
    }

    // A file without an explicit name is named after itself.
    var flowName = attrs.name || f.name.substring(0, f.name.length-3);

    this.verbose('\t\tflow document source:', fn);
    journalFiles.push(fn);

    var source = path_.relative(process.cwd(), fn);

    addJournalOutput('flows',
      `// The following FLOW was generated from "${source}"\n` +
      flowJournalEntry(attrs, flowName, source));
  }
}


exports.visitDir = function(pom, f, fn) {
  if ( f.name === 'images' || f.name === 'favicon' ) {
    imageDirs.push(fn);
  }
}


exports.end = function() {
  this.verbose(`[Journal Maker] Creating journals to ${X.journaldir} from ${X.pom}`);

  if ( X.pom !== 'pom' ) {
    var poms = X.pom.split(',').map(f => path_.relative(process.cwd(), f)).join(',');
    var flgs = '';
    Object.keys(flags).forEach(key => {
      // this.info(`[Journal] flags[${key}]:${flags[key]}`);
      if ( key.startsWith('-') ||
           flags[key] === true ) {
        flgs = this.comma(flgs, key);
      }
    });
    this.info(`[Journal] flags:${flgs}`);

    addJournalOutput('services', `
// The following record was generated by JournalMaker

p({
  "class":"foam.core.boot.CSpec",
  "name":"appConfig",
  "service": {
    "class":"foam.core.app.AppConfig",
    "pom":"${poms}",
    "flags":"${flgs}"
  }
})
`);
  }

  if ( imageDirs.length > 1 ) {
    var paths = imageDirs.map(f => path_.relative(process.cwd(), f)).join(':');
    addJournalOutput('services', `
// The following record was generated by JournalMaker

p({
  "class":"foam.core.boot.CSpec",
  "name":"http",
  "service": {
    "class":"foam.core.jetty.HttpServer",
    "imageDirs":"${paths}"
  }
})
`);
  }

  var keys = Object.keys(journalOutput);
  for ( var i = 0 ; i < keys.length ; i++ ) {
    const f           = keys[i];
    const fn          = X.journaldir + '/' + f + '.0';
    const writeStream = fs_.openSync(fn, 'w');
    const a           = journalOutput[f];
    this.verbose('[Journal] creating', fn);
    try {
      for ( var j = 0 ; j < a.length ; j++ ) {
        var o = a[j];
        try {
          if ( typeof o === 'string' ) {
            fs_.writeSync(writeStream, o + '\n');
          } else {
            fs_.writeSync(writeStream, o.msg + '\n');
            writeFileChunked(o.fn, writeStream);
            fs_.writeSync(writeStream, '\n');
          }
        } catch(e) {
          this.error(e);
        }
      }
    } finally {
      fs_.closeSync(writeStream);
    }
  }

  this.log(`[Journal Maker] Generating ${Object.keys(journalOutput).length} journal files from ${journalFiles.length} sources.`);
};
