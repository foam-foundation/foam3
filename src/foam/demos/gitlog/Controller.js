/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// git log --since="2021-01-01" --until="2022-01-01" --no-merges -p > src/foam/demos/gitlog/data2021.log

foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'Commit',

  properties: [
    { class: 'String',      name: 'id' },
    { class: 'String',      name: 'author' },
    { class: 'DateTime',    name: 'date' },
    { class: 'String',      name: 'subject' },
    { class: 'String',      name: 'body' },
    { class: 'StringArray', name: 'files' },
    { class: 'String',      name: 'diff' }
  ]
});


foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'DiffView',
  extends: 'foam.u2.View',

  methods: [
    function render() {
      this.
        style({'white-space': 'pre'}).
        forEach(this.data.split('\n'), l => {
          if ( l.startsWith('+++') ) {
            this.start('b').add(l, '\n').end();
          } else if ( l.startsWith('+') ) {
            this.start('span').style({color: 'green'}).add(l, '\n').end();
          } else if ( l.startsWith('-') && ! l.startsWith('---') ) {
            this.start('b').style({color: 'red'}).add(l, '\n').end();
          } else {
            this.add(l, '\n');
          }
        });
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'CommitMessageView',
  extends: 'foam.u2.View',

  constants: {
    REGEX: /(\[[A-Za-z]{2,}-\d{4,}\]|\(#\d+\))/
  },

  methods: [
    function render() {
      this.
        addClass(this.myClass()).
        forEach(this.data.split(this.REGEX), l => {
          if ( l.startsWith('(#') ) {
            // Pull Request
            // TODO: make this configurable
            this.start('a').attrs({href: 'https://github.com/foam-framework/foam2/pull/' + l.substring(1,l.length-1)}).add(l).end();
          } else if ( l.match(this.REGEX) ) {
            // Jira Ticket
            // TODO: make this configurable
            this.start('a').attrs({href: 'https://your-company.atlassian.net/browse/' + l.substring(1,l.length-1)}).add(l).end();
          } else {
            this.add(l);
          }
        });
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'CommitDetailView',
  extends: 'foam.u2.View',

  imports: [ 'file' ],

  methods: [
    function render() {
      var self = this;
      this.add(self.dynamic(function(data) {
        // this.add('data: ', data);
        if ( ! data ) return;
        this.
        start('b').add(data.subject).end().br().
        start('p').style({'white-space': 'pre'}).add(data.body).end().
        start('b').add('Files: ').end().br().br().forEach(data.files,
          function(f) {
            this.start('a').attrs({href:'#'}).on('click', () => self.file = f).add(f).end().br();
          }
        ).br().
        start('b').add('Diff:  ').end().tag({class: 'foam.demos.gitlog.DiffView'}, {data: data.diff});
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'UserMonthView',
  extends: 'foam.u2.View',

  css: `
    ^ table { font-size: smaller; margin-right: 20px; }
    ^ th { text-align: right; }
    ^ th:first-child { text-align: left; }
    ^ td { align: rigth; }
    ^ .selected { background: lightskyblue; }
  `,

  properties: [
    { class: 'Boolean', name: 'isHardSelection' },
    { name: 'selection' }
  ],

  methods: [
    function cell(self, count, totalCount, salary) {
      var a = [];

      if ( this.data.showCounts ) {
        a.push(count || '-');
      }

      if ( count ) {
        if ( this.data.showPercentages ) {
          a.push((count/totalCount*100).toFixed(0) + '%');
        }

        if ( this.data.showSalaries ) {
          a.push('$' + Math.round(count/totalCount * salary).toLocaleString());
//          a.push('$' + (salary/count).toFixed(0).toLocaleString());
        }
      }

      self.add(a.join(' / ') || '-');
    },

    function render() {
      var self            = this;
      var allCommits      = this.data.commits;
      var salaries        = this.data.salaries;
      var commits         = this.data.filteredCommits;
      var allCounts       = [0,0,0,0,0,0,0,0,0,0,0,0];
      var counts          = [0,0,0,0,0,0,0,0,0,0,0,0];
      var authorCounts    = {};
      var allAuthorCounts = {};
      var totalSalary     = 0;

      commits.forEach(c => {
        var month   = c.date.getMonth();
        var author  = c.author;
        var aCounts = authorCounts[author] || ( authorCounts[author] = [0,0,0,0,0,0,0,0,0,0,0,0] );
        counts[month]++;
        aCounts[month]++;
      });

      allCommits.forEach(c => {
        var month   = c.date.getMonth();
        var author  = c.author;
        var aCounts = allAuthorCounts[author] || ( allAuthorCounts[author] = [0,0,0,0,0,0,0,0,0,0,0,0] );
        allCounts[month]++;
        aCounts[month]++;
      });

      self.data.authorTotalSalaries = {};

      this.
        addClass(this.myClass()).
        start('table')
        .attrs({cellpadding: 4, cellspacing: 0, border: 1}).
        start('tr').forEach('Author Jan Feb Mar Apr May Jun July Aug Sept Oct Nov Dec Total'.split(' '), function(h) {
          this.start('th').add(h).end();
        }).end().
        forEach(this.data.authors, function(a) {
          var total = 0, allTotal = 0, salaryTotal = 0;

          if ( ! authorCounts[a[0]] ) return;
          this.start('tr').
            enableClass('selected', self.selection$.map(s => s === a[0])).

            // Author Title
            start('th').
              attr('nowrap', true).
              start('href').
                on('click', () => {
                  if ( self.selection == a[0] ) {
                    self.isHardSelection = ! self.isHardSelection;
                  } else {
                    self.selection = a[0];
                  }
                }).
                on('mouseover', () => { if ( ! self.isHardSelection ) self.selection = a[0]; }).
                add(a[0]).
              end().
            end().

            // Per-Month Details
            forEach(authorCounts[a[0]], function(c, i) {
              var salary = 0;
              try { salary = salaries[a[0]][i]; } catch (x) { console.log('***** Missing Salary for',  a[0]); }
              total       += c;
              allTotal    += allAuthorCounts[a[0]][i];
              salaryTotal += salary;
              this.start('td').attr('nowrap', true).call(function() {
                self.cell(this, c, allAuthorCounts[a[0]][i], salary);
              }).end();
            }).

            // Totals
            start('th').attr('nowrap', true).call(function() {
              self.data.authorTotalSalaries[a[0]] = ( total / allTotal ) * salaryTotal;
              self.cell(this, total, allTotal, salaryTotal);
            }).end().
          end();
        }).

        // Per-Month Totals
        start('tr').
          start('th').on('click', () => self.selection = '-- All --').add('All:').end().
          forEach(counts, function(c, i) {
            this.start('th').attr('nowrap', true).call(function() {
              var monthlySalaryTotal = Object.values(salaries).reduce((sum, s) => s[i] + sum, 0);
              totalSalary += monthlySalaryTotal;
              self.cell(this, c, allCounts[i], monthlySalaryTotal);
            }).end();
          }).
          start('th').attr('nowrap', true).call(function() {
            self.cell(this, self.data.filteredCommits.length, self.data.commits.length, totalSalary);
          }).end().
        end().
      end();
    }
  ],

  listeners: [
    {
      name: 'updateSelection',
      isIdled: true,
      delay: 160,
      on: [ 'this.propertyChange.selection' ],
      code: function() { this.data.author = this.selection; }
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.gitlog',
  name: 'Controller',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.demos.gitlog.Commit',
    'foam.demos.gitlog.UserMonthView'
  ],

  exports: [ 'file' ],

  css: `
    ^ th { text-align: left; }
    ^ .selected { background: lightskyblue; }
    .foam-u2-TextField { margin-bottom: 14px }
  `,

  constants: {
    IGNORE_CONTAINS: [
      ' -> ',
      '4.',
      'Add test',
      'broken build',
      'Cleanup',
      'fix build',
      'Fix build',
      'fix spacing',
      'Fix spacing',
      'fix syntax error',
      'foam peg',
      'Foam peg',
      'FOAM peg',
      'FOAM Peg',
      'FOAM_PEG',
      'Merge release',
      'merge',
      'Peg  foam',
      'peg -foam',
      'peg dev',
      'peg foam',
      'peg Foam',
      'peg FOAM',
      'Peg foam',
      'Peg Foam',
      'Peg FOAM',
      'peg master',
      'peg nwe foam',
      'peg to foam',
      'Peg to foam',
      'peg to matching foam',
      'peg to',
      'pege foam',
      'peged',
      'pegfoam',
      'pegFoam',
      'Pegged to dev foam',
      'pegged',
      'Pegged',
      'pegging',
      'Pegging',
      'pegMaster',
      'Release-',
      'remove peg',
      'Repeg  foam',
      'REPEG foam',
      'Repeg master',
      'repeg',
      'Repeg',
      'revert',
      'Revert',
      'Small fix',
      'Space corrected',
      'spacing fixes',
      'spacing',
      'Spacing',
      'typo',
      'v2.',
      'v4.'
    ],
    IGNORE_EQUALS: [
      'foam',
      'Merged dev',
      'faom',
      'foam again',
      'foam2',
      'formatting',
      'master foam',
      'Add comment.',
      'Add space',
      'added space',
      'adding spaces',
      'cleanup',
      'Cleanup',
      'Fix indentation.',
      'fix space',
      'fix spaces',
      'Fixed space',
      'fixing pr',
      'format',
      'Formatting.',
      'Formatting',
      'Indentation.',
      'Peg to foam',
      'Peg to mcv foam',
      'peg',
      'remove extra space',
      'Remove extra space',
      'Remove space.',
      'Remove stale comments.',
      'remove space',
      'Remove unused code.',
      'update version',
      'removed a space',
      'Sort exports.',
      'space',
      'Spacing.',
      'syntax error',
      'Updating FOAM',
      'Updating version numbers',
      'Update FOAM peg',
      'Update FOAM Peg',
      'Updated.',
      'spacing',
    ],
    AUTHOR_MAP: {
      'dependabot[bot]': 'dependabot[bot]',
      'Adam Van Ymeren': 'Adam Van Ymeren',
      'Mritunjay Chauhan': 'Mritunjay Chauhan',
      'Mritunjay': 'Mritunjay Chauhan',
      'mritunjay51': 'Mritunjay Chauhan',
      'kiana-nanopay': 'Kiana Omoerah',
      'Kiana Omoerah': 'Kiana Omoerah',
      'Bipin': 'Bipinjot Kaur',
      'BipinjotKaur': 'Bipinjot Kaur',
      'Bipinjot Kaur': 'Bipinjot Kaur',
      'Adam Fox': 'Adam Fox',
      'Alexey Greer': 'Alexey Greer',
      'AlexeyGreer': 'Alexey Greer',
      'Anna Doulatshahi': 'Anna Doulatshahi',
      'Anna': 'Anna Doulatshahi',
      'Arthur Pavlovs': 'Arthur Pavlovs',
      'Artur Linnik': 'Artur Linnik',
      'Blake Green': 'Blake Green',
      'blakegreen': 'Blake Green',
      'Carl Chen': 'Carl Chen',
      'carl-zzz': 'Carl Chen',
      'Chanmann Lim': 'Chanmann Lim',
      'Christine Lee': 'Christine Lee',
      'Christine': 'Christine Lee',
      'Danny Tharma': 'Danny Tharma',
      'Eric Dube': 'Eric Dube',
      'Eric': 'Eric Dube',
      'garfield jian': 'Garfiled Jian',
      'Garfield Jian': 'Garfiled Jian',
      'Garfiled Jian': 'Garfiled Jian',
      'Hassene Choura': 'Hassene Choura',
      'hchoura': 'Hassene Choura',
      'Jin Jung': 'Jin Jung',
      'Jin': 'Jin Jung',
      'JIn': 'Jin Jung',
      'jinn9': 'Jin Jung',
      'Joel Hughes': 'Joel Hughes',
      'Kenny Qi Yen Kan': 'Kenny Qi Yen Kan',
      'KernelDeimos': 'Eric Dube',
      'Kevin Glen Roy Greer': 'Kevin Greer',
      'Kevin Greer': 'Kevin Greer',
      'Kristina Smirnova': 'Kristina Smirnova',
      'kristina': 'Kristina Smirnova',
      'Lenore Chen': 'Lenore Chen',
      'LenoreChen': 'Lenore Chen',
      'Mahimaa Jayaprakash': 'Mahimaa Jayaprakash',
      'Mahimaa': 'Mahimaa Jayaprakash',
      'Mayowa Olurin': 'Mayowa Olurin',
      'mayowa': 'Mayowa Olurin',
      'mcarcaso': 'Mike Carcasole',
      'Michael Magahey': 'Michael Magahey',
      'Michal Pasternak': 'Michal Pasternak',
      'Michal': 'Michal Pasternak',
      'microArtur': 'Artur Linnik',
      'Mike Carcasole': 'Mike Carcasole',
      'Mike': 'Michael Magahey',
      'Minsun Kim': 'Minsun Kim',
      'MINSUN KIM': 'Minsun Kim',
      'Minsun': 'Minsun Kim',
      'Moorthy Rathinasamy': 'Moorthy Rathinasamy',
      'moorthy': 'Moorthy Rathinasamy',
      'Moorthy': 'Moorthy Rathinasamy',
      'Mykola': 'Mykola Kolombet',
      'Mykola Kolombet': 'Mykola Kolombet',
      'Mykola97': 'Mykola Kolombet',
      'nanoArtur': 'Artur Linnik',
      'nanokristina': 'Kristina Smirnova',
      'nanoMichal': 'Michal Pasternak',
      'nanoNeel': 'Neel Patel',
      'nanopay-arthur': 'Arthur Pavlovs',
      'nanopay-moorthy': 'Moorthy Rathinasamy',
      'Nauna': 'Anna Doulatshahi',
      'Neel Patel': 'Neel Patel',
      'Neelkanth Patel': 'Neel Patel',
      'Nicholas Prat': 'Nick Prat',
      'Nick Prat': 'Nick Prat',
      'noodlemoodle': 'Ruby Zhang',
      'Olha Bahatiuk': 'Olha Bahatiuk',
      'olhabn': 'Olha Bahatiuk',
      'Patrick Zanowski': 'Patrick Zanowski',
      'penzital': 'Kristina Smirnova',
      'Pete Conway': 'Pete Conway',
      'petenanopay': 'Pete Conway',
      'Rachael Ding': 'Rachael Ding',
      'RachaelDing': 'Rachael Ding',
      'Ruby Zhang': 'Ruby Zhang',
      'Ruby': 'Ruby Zhang',
      'Sarthak Marwaha': 'Sarthak Marwaha',
      'sarthakmarwaha55': 'Sarthak Marwaha',
      'sarthak-marwaha': 'Sarthak Marwaha',
      'sarthak': 'Sarthak Marwaha',
      'Scott Head': 'Scott Head',
      'Tala Abu Adas': 'Tala Abu Adas',
      'tala': 'Tala Abu Adas',
      'Tala': 'Tala Abu Adas',
      'Xuerong Wu': 'Xuerong Wu',
      'Xuerong': 'Xuerong Wu',
      'xuerongNanopay': 'Xuerong Wu',
      'yij793': 'Garfiled Jian'
    },

    IGNORED_AUTHORS: {
      'Adam Van Ymeren': true,
      'Ani Maria Lukose': true,
      'Arturs Pavlovs': true,
      'dependabot[bot]': true,
      'Mahimaa Jayaprakash': true,
      'Moorthy Rathinasamy': true,
      'Mritunjay Chauhan': true,
      'Mykola Kolombet': true
    },

    PROJECT_RULES: [
      {
        name: 'Test',
        keywords: [ ],
        paths: [ 'demos/m0' ]
      },
      {
        name: 'Intuit',
        keywords: [ 'intuit' ],
        paths: [ 'intuit' ]
      },
      {
        name: 'NBP',
        keywords: [ 'nbp' ],
        paths: [ 'nbp', 'transfer' ]
      },
      {
       name: 'FOOBAR',
        keywords: [ 'genjava', 'genjs', 'pomsplit', 'build', 'Maker', 'pom' ],
        paths: [ 'tools', 'build', 'foam.js', 'xsd', 'src/foam/xsd' ]
      },
      {
        name: 'CORE',
//        name: 'Hybrid-Blockchain',
        keywords: [ 'saf', 'storeandforward', 'replay', 'crypt', 'medusa', 'socket', 'compact' ],
        paths: [ 'medusa', 'cluster', 'sf', 'nanopay/tx', 'nanopay/fx' ]
      },
      {
        name: 'CORE',
        keywords: [ 'memento', 'graphbuilder', 'wizardlet' ],
        paths: [ 'analytic', 'foam/graph', 'foam/foobar', 'doc/templates', 'DocBrowser', 'foam/doc', 'Outputter' ]
      },
      {
//        name: 'Core',
        name: 'CORE',
        keywords: [ 'fscript' ],
        paths: [ ]
      },
      {
        name: 'Application',
        keywords: [ 'afex', 'approval', 'gateway', 'deployment' ],
        paths: [ 'companybrand', 'accounting', 'contacts', 'integration', 'gateway', 'plaid', 'rbc', 'afex', 'invoice', 'android', 'deployment', 'nanopay/auth', 'nanopay/admin', 'nanopay/personal', 'svg', 'paymentrequest', 'ticket', 'dashboard', 'bepay', 'billing', 'i18n', 'exchange', 'creditengine', 'compliance', 'treviso', 'bmo', 'flinks', 'onboarding', 'intuit', 'marqeta', 'cards', 'transfer', 'partner', 'interac', 'scotiabank', 'payroll', 'bank', 'reporting', 'payment', 'nanopay/rfi', 'nanopay/sme' ]
      },
      {
       name: 'U2/U3',
        keywords: [ 'initE', 'view', 'u3', 'u2', 'demo', 'example'  ],
        paths: [ 'u2', 'xsd', 'comics', 'foamdev', 'demo', 'layout', 'google/flow', 'phonecat' ]
      },
      {
        name: 'CORE',
//        name: 'Hybrid-Blockchain',
        keywords: [ 'medusa', 'dao', 'json', 'mlang', 'docker' ],
        paths: [ 'medusa', 'dao', 'box', 'foam/net', 'mlang', 'formatter', 'json', 'Linked', 'util', 'SMF', 'docker', 'Docker', 'iso20022' ]
      },
      {
//        name: 'Core',
        name: 'CORE',
        keywords: [ ],
        paths: [ 'core', 'pattern' ]
      },
      {
        name: 'CORE',
//        name: 'Hybrid-Blockchain',
        keywords: [ 'pm', 'performance', 'bench' ],
        paths: [ 'pm', 'concurrent' ]
      },
      {
//        name: 'CRUNCH',
        name: 'CORE',
        keywords: [ 'crunch', 'capab' ],
        paths: [ 'crunch' ]
      },
      {
        name: 'CORE',
        keywords: [ 'core' ],
        paths: [ 'core', 'dashboard', 'parse', 'Email', 'foam/java', 'src/cronjobs', 'src/regions', 'src/services', 'doc/guides' ]
      },
      {
        name: 'Test',
        keywords: [ 'test', 'tests' ],
        paths: [ 'test', 'tests', 'demos/m0' ]
      },
      {
        name: 'Application',
        keywords: [ ],
        paths: [ 'nanopay' ]
      },
    ]
  },

  properties: [
    {
      class: 'Array',
      name: 'authors',
      factory: function() {
        var authors = { '-- All --': this.commits.length };
        this.commits.forEach(c => this.incr(authors, c.author));
        return Object.keys(authors).sort().map(a => [a, a + ' ' + authors[a]]);
      }
    },
    {
      class: 'Int',
      name: 'year',
      value: '2021',
      view: function(_, X) {
        return foam.u2.view.ChoiceView.create({choices: [
          [0, '-- All --'], [ 2021, '2021' ], [ 2022, '2022' ], [ 2023, '2023' ]
        ]}, X);
      }
    },
    {
      class: 'String',
      name: 'author',
      value: '-- All --',
      postSet: function() { this.files = undefined; this.paths = undefined; },
      view: function(_, X) {
        return foam.u2.view.ChoiceView.create({choices: X.data.authors}, X);
      }
    },
    {
      class: 'Array',
      name: 'projects',
      factory: function() {
        var projects = { '-- All --': this.commits.length };
        this.commits.forEach(c => this.incr(projects, c.project || '-- Unknown --'));
        return Object.keys(projects).sort().map(a => [a, a + ' ' + projects[a]]);
      }
    },
    {
      class: 'String',
      name: 'project',
      value: '-- All --',
      postSet: function() { this.files = undefined; this.paths = undefined; },
      view: function(_, X) {
        return foam.u2.view.ChoiceView.create({choices: X.data.projects}, X);
      }
    },
    {
      class: 'Array',
      name: 'files',
      factory: function() {
console.log('*********** files: ', this.author, this.project);
var commits = this.commits.filter(c => this.match(c, this.query, this.author, '/', '/', this.project));

        var files = { '/': commits.length };
        commits.forEach(c => c.files.forEach(f => {
          this.incr(files, f);
        }));
        return Object.keys(files).sort().map(a => [a, a + '      ' + files[a]]);
      }
    },
    {
      class: 'String',
      name: 'file',
      value: '/',
      view: function(_, X) {
        return foam.u2.view.ChoiceView.create({choices$: X.data.files$}, X);
      }
    },
    {
      class: 'Array',
      name: 'paths',
      factory: function() {
        console.log('*********** paths: ', this.author, this.project);
        var commits = this.commits.filter(c => this.match(c, this.query, this.author, '/', '/', this.project));
        var files = { '/': commits.length };
        commits.forEach(c => c.files.forEach(f => this.incr(files, this.fileToPath(f))));
        return Object.keys(files).sort().map(a => [a, a + '      ' + files[a]]);
      }
    },
    {
      class: 'String',
      name: 'path',
      value: '/',
      view: function(_, X) {
        return foam.u2.view.ChoiceView.create({choices$: X.data.paths$}, X);
      }
    },
    {
      class: 'String',
      name: 'query',
      postSet: function() { this.files = undefined; this.paths = undefined; },
      // view: 'foam.u2.SearchField',
      preSet: function(o, n) { return n.toLowerCase(); },
      onKey: true
    },
    {
      class: 'Boolean',
      name: 'showCounts',
      value: true
    },
    {
      class: 'Boolean',
      name: 'showPercentages'
    },
    {
      class: 'Boolean',
      name: 'showSalaries'
    },
    {
      class: 'Boolean',
      name: 'embedFiles'
    },
    {
      name: 'data',
      factory: function() { return []; }
    },
    {
      name: 'salaries',
      factory: function() { return {}; }
    },
    { class: 'Boolean', name: 'isHardSelection' },
    {
      class: 'FObjectProperty',
      of: 'foam.demos.gitlog.Commit',
      name: 'selection',
      view: 'foam.demos.gitlog.CommitDetailView'
    },
    {
      name: 'commits',
      expression: function(data) {
        var seen = {}; // used to remove duplicates based on same date and subject
        var d2 = data.
          filter(c => {
            for ( var i = 0 ; i < this.IGNORE_CONTAINS.length ; i++ ) {
              if ( c.subject.indexOf(this.IGNORE_CONTAINS[i]) != -1 ) return false;
            }
            return true;
          }).
          filter(c => {
            for ( var i = 0 ; i < this.IGNORE_EQUALS.length ; i++ ) {
              if ( c.subject === this.IGNORE_EQUALS[i] ) return false;
            }
            return true;
          }).
          filter(c => {
            var signature = c.date + "+" + c.subject;
            if ( seen[signature] ) return false;
            seen[signature] = true;
            return true;
          }).
          map(c => { c.files = c.files.map(s => s.trim()); return c; }).
//          map(c => { c.author = this.AUTHOR_MAP[c.author] || 'UNKNOWN: "' + c.author + '"'; return c; }).
          map(c => {
            var subject = c.subjectLC = c.subject.toLowerCase();
            this.PROJECT_RULES.forEach(r => {
              if ( c.project ) return;
              if ( r.name === 'CORE' || r.name === 'Hybrid-Blockchain' || r.name === "FOOBAR" || r.name === "U2/U3" ) r.name = 'SR&ED';
              for ( var i = 0 ; i < r.keywords.length ; i++ ) {
                var keyword = r.keywords[i];
                if ( subject.indexOf(keyword) != -1 ) {
                  c.project = r.name;
                  return;
                }
              }
              for ( var i = 0 ; i < r.paths.length ; i++ ) {
                var path = r.paths[i];
                for ( var j = 0 ; j < c.files.length ; j++ ) {
                  var file = c.files[j];
                  if ( file.indexOf(path) != -1 ) {
                    c.project = r.name;
                    return;
                  }
                }
              }
            });

            return c;
          });

          d2.sort((a, b) => foam.Date.compare(a.date, b.date));

          return d2;
      }
    },
    {
      name: 'filteredCommits',
      expression: function(commits, query, file, path, project) {
        return commits.filter(c => this.match(c, query, '-- All --', file, path, project));
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // TODO: make this configurable
//      this.loadYear(2023);
      this.loadYear(2024);
    },

    function loadYear(year) {
      this.loadData(`data/data${year}.log`);
      this.loadData(`data/np${year}.log`);
      this.loadSalaryData(`data/salary${year}.csv`);
    },

    function loadData(f) {
      fetch(f)
      .then(r => r.text())
      .then(t => this.parseLog(t));
    },

    function loadSalaryData(f) {
      fetch(f)
      .then(r => r.text())
      .then(t => this.parseSalaries(t));
    },

    function parseLog(t) {
      var data  = [];
      var state = 0;
      var lines = t.split('\n');
      var commit;
      t = null;
      for ( var i = 0 ; i < lines.length ; i++ ) {
        var line = lines[i];
        if ( state == 0 ) {
          if ( line.startsWith('commit ') ) {
            commit = this.Commit.create({id: line.substring(7)});
            data.push(commit);
          } else if ( line.startsWith('Author: ') ) {
            commit.author = line.substring(8, line.indexOf('<')).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            commit.author = this.AUTHOR_MAP[commit.author] || 'Unknown: ' + commit.author;
            if ( this.IGNORED_AUTHORS[commit.author] ) data.pop();
          } else if ( line.startsWith('Date: ') ) {
            commit.date = new Date(line.substring(6).trim());
            i++;
            state = 1;
          }
        } else if ( state == 1 ) {
          if ( line.startsWith('diff') ) {
            state = 2;
          } else if ( line.startsWith('commit') ) {
            state = 0;
            i--;
          } else {
            if ( ! commit.subject ) {
              commit.subject = line.trim();
            } else {
              commit.body += (commit.body.length ? '\n' : '') + line.trim();
            }
          }
        } else if ( state == 2 ) {
          if ( line.startsWith('commit') ) {
            state = 0;
            i--;
          } else {
            if ( line.startsWith('+++ b/') && ! line.startsWith('+++ b/.') ) {
              commit.files.push(line.substring(6));
            }
            commit.diff += (line.length ? '\n' : '') + line.trim();
          }
        }
      }
      this.data    = this.data.concat(data);
      this.authors = this.files = this.projects = undefined;
    },

    function parseSalaries(csv) {
      var self = this;
      csv.split('\n').slice(1).forEach(s => {
        s = s.split(',');
        const name = s[2], salaries = s.slice(3);
        if ( ! self.IGNORED_AUTHORS[name] )
          this.salaries[name] = salaries.map(parseFloat);
      });
      delete this.salaries[undefined];
      console.log('salaries: ', this.salaries);
    },

    function match(commit, query, author, file, path, project) {
      if ( project === '-- Unknown --' ) project = undefined;

      return ( author === '-- All --' || author === commit.author ) &&
        ( query === '' || commit.subjectLC.indexOf(query) != -1 ) &&
        ( file === '/' || commit.files.some(f => f === file) ) &&
        ( path === '/' || commit.files.some(f => f.startsWith(path)) ) &&
        ( project === '-- All --' || commit.project === project )
        ;
    },

    function fileToPath(file) {
      var i = file.lastIndexOf('/');
      if ( i == -1 ) return '/';
      return file.substring(0, i);
    },

    function incr(map, key) {
      /** Increment counter for key in map of keys->counts. **/
      map[key] = (map[key] || 0) + 1;
    },

    function render() {
      var self = this;
      this.commits$.sub(function() {
        self.projects = self.files = self.paths = self.authors = undefined;
        self.removeAllChildren();
        self.render_();
      });
      this.commits;
    },

    function render_() {
      var self = this;

      this.
        addClass(this.myClass()).
        start('h2').add('GitLog').end().

        start().
          style({display: 'flex'}).
          start().
            style({width: '25%', 'padding-right': '60px'}).
            call(function() { self.searchPane.call(this, self); }).
          end().
          start().
            style({width: '75%', 'padding-left': '60px'}).
            add(this.slot(function (filteredCommits, showCounts, showPercentages, showSalaries) {
              return self.UserMonthView.create({data: self}, self);
            })).
          end().
        end().

        br().
        tag('hr').

        start().
          style({display: 'flex'}).
          start().
            style({width: self.embedFiles$.map(e => e ? '80%' :'50%'), height: '100vh', padding: '10px', 'overflow-y': 'scroll'}).
            call(function() { self.commitTable.call(this, self); }).
          end().
          start().
//            hide(self.embedFiles$).
            style({width: self.embedFiles$.map(e => e ? '20%' :'50%'), height: '100vh', padding: '10px', 'overflow-y': 'scroll'}).
            start(this.SELECTION).end().
          end().
        end();
      ;
    },

    function searchPane(self) {
      this.start('').
//        add('Year: ',             self.YEAR).br().
        add('Keyword: ',          self.QUERY).br().
        add('Project: ',          self.PROJECT).br().
        add('File: ',             self.FILE).br().
        add('Path: ',             self.PATH).br().
        add('Author: ',           self.AUTHOR).br().
        add('Show Counts: ',      self.SHOW_COUNTS).br().
        add('Show Percentages: ', self.SHOW_PERCENTAGES).br().
        add('Show Salaries: ',    self.SHOW_SALARIES).br().
        add('Embed Files: ',      self.EMBED_FILES).br().
      end();
    },

    function commitTable(self) {
      this.start('table').attrs({cellpadding: '4px'}).style({'width': '100%'}).
        start('tr').
          start('th').add('Commit').end().
          start('th').add('Date').end().
          start('th').add('Author').end().
          start('th').add('Project').end().
          start('th').add('Subject').end().
          start('th').show(self.embedFiles$).add('Files').end().
        end().forEach(self.commits, function(d) {
          var href = 'https://github.com/foam-foundation/foam3/commit/' + d.id;
          this.start('tr').
            enableClass('selected', self.selection$.map(s => { return s && s === d; })).
            on('click', () => {
              if ( d == self.selection ) {
                self.isHardSelection = ! self.isHardSelection;
              } else {
                self.selection = d;
              }
            }).
            on('mouseover', () => { if ( ! self.isHardSelection ) self.selection = d; }).
            show(self.slot(function(query, author, file, path, project) {
              return self.match(d, query, author, file, path, project);
            })).
            start('td').start('a').attrs({href: href}).add(d.id.substring(0,8)).end().end().
            start('td').style({'white-space': 'nowrap'}).add(d.date.toISOString().substring(0,10)).end().
            start('td').style({'white-space': 'nowrap'}).
              start('a').attrs({href:'#'}).on('click', () => self.author = d.author).add(d.author).
              end().
            end().
            start('td').style({'white-space': 'nowrap'}).
              start('a').attrs({href:'#'}).on('click', () => self.project = d.project).add(d.project).
              end().
            end().
            start('td').tag({class: 'foam.demos.gitlog.CommitMessageView', data: d.subject}).end().
            start('td').show(self.embedFiles$).forEach(d.files, function(f) { this.add(f).br(); }).end().
          end();
        }).
      end();
    },

    function sredReport() {
      var output = '';
      function o(...args) {
        output += args.join('');
      }
//      o('Employee Name,SR&ED Role,Salary,Bonus & Taxable Benefits,Total Hours,SR&ED Hours,SR&ED %,SR&ED Salary,SR&ED Bonus & Taxable Benefits,Salary for Proxy Overhead,Province\n');
      o('Employee Name,SR&ED Role,Salary,Bonus & Taxable Benefits,SR&ED %,SR&ED Salary,SR&ED Bonus & Taxable Benefits,Salary for Proxy Overhead,Total,Province\n');
      this.authors.slice(1).forEach(a => {
        a = a[0];
        var salary      = this.salaries[a].reduce((sum, s) => s + sum, 0);
        var p           = this.authorTotalSalaries[a] / salary;
        var sredSalary  = this.authorTotalSalaries[a]; // p * salary;
        var proxySalary = 0.55 * sredSalary;

        o(a, ',', 'Product,');
        o('$', Math.round(salary));
        o(',,');
        o(Math.round(100*p), '%',);
        o(',$', Math.round(sredSalary), ',');
        o(',$', Math.round(proxySalary));
        o(',$', Math.round(sredSalary + proxySalary));
        o(',ON\n');
      });
      document.body.innerText = output;
      return output;
    }
  ]
});
