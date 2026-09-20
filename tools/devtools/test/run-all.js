/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// One command for the suite: each test file in its own process, so their
// globals (common-test's chrome and fetch mocks) cannot leak into the next,
// and one failing file cannot hide behind another's "passed" line.
// Exit code is the number of failing files.
var spawnSync = require('child_process').spawnSync;
var fs = require('fs'), path = require('path');

var files = fs.readdirSync(__dirname).filter(function(f) { return /-test\.js$/.test(f); }).sort();
var failed = 0, total = 0;
files.forEach(function(f) {
  var r = spawnSync(process.execPath, [ path.join(__dirname, f) ], { encoding: 'utf8' });
  var last = ( r.stdout || '' ).trim().split('\n').pop();
  var m = /^(\S+): (\d+) passed$/.exec(last);
  if ( r.status === 0 && m ) {
    total += parseInt(m[2], 10);
    console.log('  ok', last);
  } else {
    failed++;
    console.log('FAIL', f);
    console.log(( r.stdout + r.stderr ).trim().split('\n').slice(-12).join('\n'));
  }
});
console.log(failed ? failed + ' of ' + files.length + ' files failed' : files.length + ' files, ' + total + ' assertions passed');
process.exit(failed);
