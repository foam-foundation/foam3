/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DownloadDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  requires: [ 'foam.core.reflow.DownloadView' ],

  methods: [
    function execute(e) {
      e.tag(this.DownloadView);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DownloadView',
  extends: 'foam.u2.Controller',

  imports: [ 'block', 'sessionID', 'window' ],

  requires: [
    'foam.core.export.CSVTableExportDriver',
    'foam.core.export.JSONDriver',
    'foam.core.export.JSONJDriver',
    'foam.core.export.XMLDriver'
  ],

  properties: [
    {
      name: 'formats',
      factory: function() {
        return [
          { label: 'CSV',    extension: '.csv',  format: 'csv',   driver: this.CSVTableExportDriver },
          { label: 'JSON',   extension: '.json', format: 'json',  driver: this.JSONDriver },
          { label: 'JSON/J', extension: '.jrl',  format: 'jsonj', driver: this.JSONJDriver },
          { label: 'XML',    extension: '.xml',  format: 'xml',   driver: this.XMLDriver }
        ];
      }
    }
  ],

  methods: [
    async function render() {
      var dao         = this.block.value.filteredDAO;
      var serviceName = dao.cmd('serviceName?');
      var isLocal     = ! serviceName;

      if ( isLocal ) {
        this.renderLocalDownloads(dao);
      } else {
        await this.renderServiceDownloads(dao, serviceName);
      }

      return this;
    },

    function renderLocalDownloads(dao) {
      var self      = this;
      var modelName = dao.of?.name || 'data';

      this.add('Download As: ');
      this.formats.forEach((fmt, idx) => {
        if ( idx > 0 ) this.add(', ');
        this.start('a').
          style({
            cursor: 'pointer',
            color: foam.CSS.returnTokenValue('$link', this.cls_, this.__subContext__),
            'text-decoration': 'underline'
          }).
          on('click', async function() {
            self.logDownloadSelection('local', modelName, fmt.format);
            await self.downloadLocal(dao, modelName, fmt);
          }).
          add(fmt.label).
        end();
      });
    },

    async function renderServiceDownloads(dao, serviceName) {
      var location = this.window.location.origin;
      var daoKey   = serviceName.substring(8);
      var url      = `${location}/service/dig?dao=${daoKey}&cmd=select&sessionId=${this.sessionID}&limit=${this.block.value.limit}`;

      var title = daoKey;

      // Probe DAO to find the actual full query being used. Send the
      // predicate itself, serialized, so the server filters with the EXACT
      // predicate this block used — a toMQL() round-trip through the 'q'
      // parser loses case-insensitive matches (ContainsIC parses back as
      // Contains). toMQL() stays for the human-readable title only.
      try {
        var sink = foam.dao.ArraySink.create();
        sink.setPredicate = function(p) {
          if ( ! p ) return;
          url = url + '&predicate=' + encodeURIComponent(foam.json.Network.stringify(p));
          title = title + ', query=' + p.toMQL();
          throw "just probing";
        };
        await dao.select(sink);
      } catch (x) {
      }

      if ( this.block.value.columns ) {
        url = url + '&columns=' + encodeURIComponent(this.block.value.columns);
      }

      if ( this.block.value.skip ) {
        url = url + '&skip=' + this.block.value.skip;
        title = title + ', skip=' + this.block.value.skip;
      }

      if ( this.block.value.limit > 0 ) {
        url = url + '&limit=' + this.block.value.limit;
        title = title + ', limit=' + this.block.value.limit;
      }

      this.add(`Download ${title}`).tag('br').add('As: ');
      this.formats.forEach((fmt, idx) => {
        if ( idx > 0 ) this.add(', ');
        this.
          start('a').
            attrs({
              href: url + '&format=' + fmt.format,
              rel: 'noopener noreferrer',
              download: daoKey + fmt.extension,
              target: '_blank'
            }).
            on('click', () => {
              this.logDownloadSelection('service', daoKey, fmt.format);
            }).
            add(fmt.label).
          end();
      });
    },

    function logDownloadSelection(source, target, format) {
      try {
        this.__subContext__.analyticEventDAO?.put(
          foam.core.analytics.AnalyticEvent.create({
            name: 'DownloadView:'+JSON.stringify({
              source: source,
              target: target,
              format: format,
              flowName: this.block?.flowName
            }),
            tags: [ 'DIG_DOWNLOAD' ]
          }, this.__subContext__),
          this
        );
      } catch (e) {}
    },

    async function downloadLocal(dao, modelName, format) {
      try {
        var driver = format.driver.create({}, this);
        var result = await driver.exportDAO(this.__context__, dao);

        const mime =
          format.mimeType ||
          (format.extension === '.csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8');

        var blob = result instanceof Blob ? result : new Blob([result], { type: mime });
        var url = URL.createObjectURL(blob);

        var link = document.createElement('a');
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

        link.setAttribute('href', url);
        link.setAttribute('download', `${modelName}_Export_${timestamp}${format.extension}`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        // Give the browser time to start the download before cleanup
        setTimeout(() => {
          URL.revokeObjectURL(url);
          link.remove();
        }, 60_000); // 1 minute is safe; you can shorten to e.g. 2–5s and test
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + (error?.message ?? error));
      }
    }
  ]
});
