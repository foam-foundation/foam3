/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Could use foam.lib.csv.DynamicHeaderCSVParser if need to support inner-objects

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOHolder',

  properties: [
    { class: 'foam.dao.DAOProperty', name: 'preview', hidden: true }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'UploadView',
  extends: 'foam.u2.View',

  documentation: 'UploadView which switches to a simplified progress view when uploading.',

  methods: [
    function render() {
      var self = this;

      this.SUPER();
      this.add(function(uploading, hideControls) {
        if ( uploading || hideControls ) {
          this.start().style({maxWidth: 700, width: 700, height: 100}).add(self.data.processing$, ' ', self.data.PROGRESS);
        } else {
          this.add(self.data);
        }
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'MappingsView',
  extends: 'foam.u2.Controller',


  properties: [ 'data' ],

  css: `
    ^ { overflow-x: auto; }
    ^ .foam-u2-tag-Select { height: 20px; }
    ^ td { padding: 2px 10px; }
    ^ .foam-u2-DetailView { padding: 0; }
    ^ .foam-u2-DetailView table { margin: 0; }
    ^ .foam-u2-DetailView td { padding: 0; }
  `,

  methods: [
    function render() {
      this.SUPER();

      this.addClass().
      start('table').start('tr').
        start('th').add('Property').end().
        start('th').add('Type').end().
        start('th').add('Value').end().
        start('th').add('Required').end().
      end().
      add(this.dynamic(function(data) {
        if ( ! data || data.length === 0 ) return;

        this.forEach(data, function(mapping) {
          // Get the property info from the target model
          var targetModel = mapping.of;
          var prop = targetModel && targetModel.getAxiomByName(mapping.property);

          this.
            startContext({ data: mapping }).
            start('tr').
              start('td').add(mapping.property).end().
              start('td').
                add(mapping.TYPE.__).
              end().
              start('td').
                add(mapping.CONSTANT_VALUE.__).
                add(mapping.FIELD_NAME.__).
                add(mapping.DYNAMIC_EXPRESSION.__).
              end().
              start('td').add(prop ? (prop.required || false) : false).end().
            end()
            .endContext();
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Upload',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: `
    Data upload component supporting file drag & drop or manual text input.
    Handles CSV, JSON, XML formats with auto-detection, column mapping,
    and bulk import to DAOs. Provides preview and progress tracking.

    When files are uploaded, their content is processed and moved to input.
    When input is manually cleared, uploadedFiles is cleared.
  `,

  requires: [
    'foam.dao.MDAO',
    'foam.lib.csv.CSVParser',
    'foam.core.reflow.ColumnParser',
    'foam.core.reflow.DAOHolder',
    'foam.core.reflow.Mapping',
    'foam.core.reflow.UploadSink',
    'foam.parse.QueryParser',
    'foam.core.fs.fileDropZone.FileDropZone',
    'foam.core.fs.File'
  ],

  imports: [ 'currentBlock?', 'eval_?', 'setTimeout' ],

  exports: [
    'dao',
  ],

  constants: {
    SUPPORTED_FORMATS: {
      'text/csv': 'CSV',
      'application/json': 'JSON',
      'text/xml': 'XML',
      'text/plain': 'TXT'
    }
  },

  properties: [
    {
      class: 'Boolean',
      name: 'hideControls',
      documentation: 'Set to true to hide controls',
      hidden: true
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'uploadedFiles',
      factory: function() { return []; },
      postSet: function(_, n) {
        if ( n && n.length > 0 ) {
          // Clear any existing text input since we're switching to file mode
          // The file content will be processed and displayed in the text area
          this.input = '';
          this.processUploadedFiles();
        }
      },
      view: function(_, X) {
        return {
          class: 'foam.core.fs.fileDropZone.FileDropZone',
          files$: X.data.uploadedFiles$,
          supportedFormats: X.data.SUPPORTED_FORMATS,
          isMultipleFiles: false,
          maxSize: 50,
          title: 'Drag and drop a file here or click to browse',
          onFilesChanged: X.data.onFilesChanged.bind(X.data)
        };
      },
      visibility: function(input) {
        return ( ! input || input.trim() === '' ) ?
          foam.u2.DisplayMode.RW :
          foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'input',
      view: { class: 'foam.u2.tag.TextArea', rows: 8, cols: 80 },
      postSet: function(_, n) {
        if ( n && n.trim() !== '' ) {
          // Clear uploaded files when user manually enters/edits text
          // Since the file content is now represented as text, we no longer need the file reference
          this.uploadedFiles = [];
        }
      },
      visibility: function(uploadedFiles) {
        return ( ! uploadedFiles || uploadedFiles.length === 0 ) ?
          foam.u2.DisplayMode.RW :
          foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'daoKey',
      label: 'DAO',
      adapt: function(o, n) {
        if ( this.__context__[n] ) return n;
        if ( this.__context__[n + 'DAO'] ) return n + 'DAO';
        if ( n.endsWith('s') ) return n.substring(0, n.length-1) + 'DAO';
        return n;
      }
    },
    {
      name: 'dao',
      hidden: true,
      factory: function() {
        return this.__context__[this.daoKey];
      }
    },
    {
      class: 'String',
      name: 'format',
      value: 'AUTO',
      view: { class: 'foam.u2.view.ChoiceView', choices: [ 'AUTO', 'DAO', 'CSV', 'JSON', 'XML' ] },
      postSet: function(o, n) {
        // Clear cached headers when format changes to ensure mappings regenerate
        if ( o !== n ) {
          this.fileHeaders = [];
        }
      }
    },
    {
      class: 'String',
      name: 'sourceDAOKey',
      label: 'Source DAO',
      adapt: function(o, n) {
        if ( this.__context__[n] ) return n;
        if ( this.__context__[n + 'DAO'] ) return n + 'DAO';
        if ( n.endsWith('s') ) return n.substring(0, n.length-1) + 'DAO';
        return n;
      },
      visibility: function(format) { return format === 'DAO' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      }
    },
    {
      name: 'sourceDAO',
      hidden: true,
      expression: function(sourceDAOKey) {
        return this.__context__[sourceDAOKey];
      }
    },
    {
      class: 'String',
      name: 'delimiter',
      value: ',',
      visibility: function(format) { return format === 'CSV' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      },
      width: 1
    },
    {
      class: 'String',
      name: 'tagName',
      value: 'CardFinancial',
      visibility: function(format) { return format === 'XML' ?
        foam.u2.DisplayMode.RW :
        foam.u2.DisplayMode.HIDDEN ;
      }
    },
    {
      // having class and of, makes the mapping expression not reactive, even if the post set is there, (somewhere it gets set to empty array)
      // class: 'FObjectArray',
      // of: 'foam.core.reflow.Mapping',
      name: 'mappings',
      view: function(_, X) {
        return { class: 'foam.core.reflow.MappingsView' };
      },
      expression: function(of, fileHeaders) {
        // Auto-calculate mappings from fileHeaders when available
        // Once explicitly set, this expression stops being reactive (FOAM3 behavior)
        if (!of || !fileHeaders || fileHeaders.length === 0) return [];

        // Clean up file headers
        var cleanHeaders = fileHeaders.filter(function(h) { return h && h.trim(); });
        if (cleanHeaders.length === 0) return [];

        // Get all properties for the target model
        var props = of.getAxiomsByClass(foam.lang.Property)
          .filter(function(p) { return p.showInPropertyChoice; })
          .sort(foam.lang.Property.NAME.compare);

        // Create mappings for all properties with file headers
        var mappings = [];
        var self = this;
        props.forEach(function(prop) {
          mappings.push(self.createFieldMapping(prop, {
            fileHeaders: cleanHeaders
          }));
        });

        return mappings;
      },
      visibility: function(fileHeaders) {
        return fileHeaders && fileHeaders.length > 0 ?
          foam.u2.DisplayMode.RW :
          foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'output',
      label: 'Errors',
      view: {
        class: 'foam.u2.HTMLView',
        nodeName: 'pre'
      },
      visibility: 'RO'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data',
      factory: function() {
        return this.MDAO.create({of: this.dao.of});
      },
      hidden: true
    },
    { name: 'block', hidden: true, postSet: function(o, n) { if ( ! n ) debugger; } },
    {
      name: 'of',
      transient: true,
      hidden: true,
      expression: function (dao) { return dao.of; }
    },
    {
      name: 'columnParser',
      transient: true,
      hidden: true,
      expression: function (of) {
        return this.ColumnParser.create({of: of});
      }
    },
    {
      class: 'Boolean',
      name: 'bulkUpload',
      hidden: true,
      value: true
    },
    {
      class: 'String',
      name: 'where',
      label: 'Filter',
      view: { class: 'foam.core.reflow.PredicateSuggestedField' },
      help: 'Filter data. Applied to both preview and upload.'
    },
    {
      class: 'Int',
      name: 'matchedRows',
      visibility: function(where) {
        return where ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.HIDDEN;
      },
      value: 0
    },
    {
      class: 'Map',
      name: 'validationErrorMap',
      factory: function() { return {}; },
      hidden: true,
      documentation: 'Map tracking validation error counts by field:error key'
    },
    {
      class: 'String',
      name: 'filterStatus',
      visibility: function(where) {
        return where ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.HIDDEN;
      },
      expression: function(rows, where, matchedRows) {
        if ( ! where ) return '';
        return matchedRows + ' rows match filter (of ' + rows + ' total)';
      }
    },
    {
      class: 'Function',
      name: 'adaptObject',
      documentation: 'Callback function to adapt objects before uploading. Called with (object).',
      value: function() { },
      hidden: true
    },
    {
      name: 'fileHeaders',
      hidden: true,
      documentation: 'File headers from processed data (CSV columns, XML tags/attributes, DAO properties)'
    },
    {
      class: 'Int',
      name: 'processing',
      visibility: 'RO',
      hidden: true
    },
    {
      class: 'Int',
      name: 'progress',
      view: { class: 'foam.u2.ProgressView' },
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'uploading',
      hidden: true
    },
    {
      class: 'Int',
      name: 'rows',
      visibility: 'RO'
    }
  ],

  methods: [
    function onFilesChanged(files) {
      var foamFiles = [];
      for ( var i = 0 ; i < files.length ; i++ ) {
        var file = files[i];
        if ( file.cls_ && file.cls_.id === 'foam.core.fs.File' ) {
          foamFiles.push(file);
        } else {
          var foamFile = this.File.create({
            filename: file.name || `File ${i+1}`,
            filesize: file.size || 0,
            mimeType: file.type || 'text/plain',
            data: { blob: file }
          });
          foamFiles.push(foamFile);
        }
      }
      this.uploadedFiles = foamFiles;
    },

    function init() {
      this.SUPER();

      if ( this.currentBlock ) {
        this.block        = this.currentBlock;
        this.block.upload = this;
        this.block.value  = this.DAOHolder.create({preview: this.data});
      }
    },

    function parseFilter() {
      if ( ! this.where ) return null;
      try {
        return this.QueryParser.create({of: this.dao.of}).parseString(this.where);
      } catch (e) {
        console.warn('Invalid filter expression:', this.where, e);
        return null;
      }
    },

    function findMatchingHeader(headers, prop) {
      if ( ! headers || headers.length === 0 ) return null;

      // Try to match each header against the target property using ColumnParser
      for ( var i = 0; i < headers.length; i++ ) {
        var header = headers[i];
        try {
          var parsedProp = this.columnParser.parseString(header);
          if ( parsedProp && parsedProp.name === prop.name ) {
            return header;
          }
        } catch (e) {
          // Continue to next header if parsing fails
        }
      }

      return null;
    },

    function createFieldMapping(property, options) {
      options = options || {};

      var mapping = this.Mapping.create({
        id: options.id || property.name,
        property: property.name,
        type: foam.core.reflow.MappingType.FIELD,
        of: this.of,
        fileHeaders: options.fileHeaders || []
      });

      // Auto-set fieldName if not provided and fileHeaders are available
      if ( ! options.fieldName && options.fileHeaders ) {
        var matchingHeader = this.findMatchingHeader(options.fileHeaders, property);
        if ( matchingHeader ) {
          mapping.fieldName = matchingHeader;
        }
      } else if ( options.fieldName ) {
        mapping.fieldName = options.fieldName;
      }

      return mapping;
    },



    async function processUploadedFiles() {
      if ( ! this.uploadedFiles || this.uploadedFiles.length === 0 ) {
        return;
      }

      try {
        var firstFile = this.uploadedFiles[0];
        var content = await this.readFileContent(firstFile);
        this.input = content;

        this.format = this.SUPPORTED_FORMATS[firstFile.mimeType] || 'AUTO';
      } catch (e) {
        console.error('Error processing uploaded files:', e);
        this.output += '<span style="color:red">Error reading uploaded file: ' + e.message + '</span><br>';
      }
    },

    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        try {
          var actualFile = file.data ? file.data.blob : file;

          if ( ! actualFile ) {
            reject('No file data available');
            return;
          }

          var reader = new FileReader();

          reader.onload = function(e) {
            resolve(e.target.result);
          };

          reader.onerror = function() {
            reject('Error reading file');
          };

          reader.readAsText(actualFile);
        } catch (e) {
          console.error('Error accessing file:', e);
          reject('Error accessing file: ' + e.message);
        }
      });
    },

    async function process(real) {
      this.data = undefined;
      this.block.value  = this.DAOHolder.create({preview: this.data});

      var self  = this;
      var latch = foam.lang.Latch.create();
      await this.data.removeAll();
      this.uploading = true;
      this.processing = 0;
      this.matchedRows = 0;
      this.validationErrorMap = {};
      this.clear();
      console.time('upload');

      var filter = self.parseFilter();

      function updateStatus(sink) {
        self.processing  = sink.totalRows;
        self.progress    = self.rows ? Math.max(self.progress, Math.floor(100 * sink.totalRows / self.rows)) : sink.progress;
        self.matchedRows = sink.matchedRows;
        // Copy validation errors and output from sink
        self.validationErrorMap = sink.validationErrorMap;
        if ( sink.output ) {
          self.output += sink.output;
        }
      }

      // Create UploadSink with proper configuration
      var sink = this.UploadSink.create({
        dao: this.dao,
        previewDAO: this.data,
        isRealUpload: real,
        bulkUpload: this.bulkUpload,
        filter: filter,
        mappings: this.mappings,
        adaptObject: this.adaptObject,
        progressCallback: function(processing, progress) {
          self.processing = processing;
          self.progress = progress;
        }
      });

      // Override sink's eof to handle Upload-specific logic
      var originalEof = sink.eof.bind(sink);
      sink.eof = async function() {
        try {
          await originalEof();
          updateStatus(sink);
          self.progress = 100;
          self.uploading = false;
          console.timeEnd('upload');

          if ( ! real ) {
            var block = self.block;
            // Data is already filtered during put operations
            self.eval_(`dao(${block.flowName}.preview, '${block.flowName}.preview')`);
            var block2 = self.currentBlock;
            block2.flowName = block.flowName + 'data';
            block2.obj.dao = self.data;
            block2.obj.limit = 10;
          }

          latch.resolve('eof');
        } catch (e) {
          console.error('Upload eof error:', e);
          var errorMessage = e.message || 'Unknown error during upload completion';
          self.output += '<span style="color:red">ERROR: ' + errorMessage + '</span><br>';
          latch.reject(e);
        }
      };

      this.input = this.input.trim();

      if ( this.format === 'AUTO' ) {
        this.input = this.input
        if ( this.input.startsWith('<?xml') ) {
          this.format = 'XML';
        } else if ( this.input.startsWith('{') ) {
          this.format = 'JSON';
        } else {
          this.format = 'CSV';
        }
      }

      // Process based on format
      switch ( this.format ) {
        case 'DAO':
          this.processDAO(sink);
          break;
        case 'CSV':
          this.processCSV(sink);
          break;
        case 'XML':
          this.processXML(sink);
          break;
        case 'JSON':
          // TODO:
          // this.processJSON(sink);
          break;
      }

      // Set file headers for non-CSV formats (empty headers)
      if ( this.format !== 'CSV' && ( ! this.mappings || this.mappings.length === 0 ) ) {
        this.fileHeaders = [];
      }

      return latch;
    },

    function collectXMLHeaders(node, xmlHeaders) {
      var children = node.children;

      // Collect tag names and attributes from this node
      for ( var i = 0 ; i < children.length ; i++ ) {
        var child = children[i];
        var attrs = child.getAttributeNames();

        // Add tag name as header
        if ( child.firstChild ) {
          xmlHeaders.add(child.tagName);
        }

        // Add tag.attribute as headers
        for ( var j = 0 ; j < attrs.length ; j++ ) {
          var attrName = attrs[j];
          xmlHeaders.add(child.tagName + '.' + attrName);
        }
      }
    },

    function objectifyXML(doc, sink) {
      var obj      = this.of.create();
      var children = doc.children;
      var rowData  = {}; // Create rowData object for XML attributes/elements

      // Collect all XML data into rowData
      for ( var i = 0 ; i < children.length ; i++ ) {
        var node  = children[i];
        var attrs = node.getAttributeNames();

        if ( node.firstChild ) {
          rowData[node.tagName] = node.firstChild.nodeValue;
        }
        for ( var j = 0 ; j < attrs.length ; j++ ) {
          var attrName = attrs[j];
          rowData[node.tagName + '.' + attrName] = node.getAttribute(attrName);
        }
      }

      // Process ALL mappings using UploadSink method
      
      sink.processAllMappings(obj, rowData);
      

      return obj;
    },

    async function processDAO(sink) {
      var a = (await this.sourceDAO.select()).array;

      // Collect headers from first object if available
      var daoHeaders = [];
      if ( a.length > 0 ) {
        var firstObj = a[0];
        for ( var prop in firstObj.instance_ ) {
          if ( firstObj.hasOwnProperty(prop) ) {
            daoHeaders.push(prop);
          }
        }
      }

      // Set file headers - this will trigger mapping generation if headers changed
      this.fileHeaders = daoHeaders;

      // Process all objects
      for ( var i = 0 ; i < a.length ; i++ ) {
        var sourceObj = a[i];
        var targetObj = this.of.create();
        
        // Create rowData from source object properties
        var rowData = {};
        for ( var prop in sourceObj.instance_ ) {
          if ( sourceObj.hasOwnProperty(prop) ) {
            rowData[prop] = sourceObj[prop];
          }
        }

        // Apply mappings directly using rowData
        
        sink.processAllMappings(targetObj, rowData);
        

        await sink.put(targetObj);
      }
      sink.eof();
    },

    async function processXML(sink) {
      var parser   = new DOMParser();
      var doc      = parser.parseFromString(this.input, 'text/xml');
      var root     = doc.firstChild;
      var children = root.children;

      this.rows = 0;
      var xmlHeaders = new Set();

      // First pass: collect all XML headers and count rows
      for ( var i = 0 ; i < children.length ; i++ ) {
        var node = children[i];
        if ( this.tagName && node.tagName !== this.tagName ) continue;
        this.rows++;

        // Collect headers from this node
        this.collectXMLHeaders(node, xmlHeaders);
      }

      // Set file headers - this will trigger mapping generation if headers changed
      this.fileHeaders = Array.from(xmlHeaders);

      // Second pass: process matched rows using generated mappings
      for ( var i = 0 ; i < children.length ; i++ ) {
        var node = children[i];
        if ( this.tagName && node.tagName !== this.tagName ) continue;
        
        var obj = this.objectifyXML(node);
        
        // Extract rowData from XML node for mapping
        var rowData = {};
        var nodeAttrs = node.getAttributeNames();
        for ( var j = 0; j < node.children.length; j++ ) {
          var childNode = node.children[j];
          if ( childNode.firstChild ) {
            rowData[childNode.tagName] = childNode.firstChild.nodeValue;
          }
          for ( var k = 0; k < nodeAttrs.length; k++ ) {
            var attrName = nodeAttrs[k];
            rowData[childNode.tagName + '.' + attrName] = node.getAttribute(attrName);
          }
        }

        // Apply mappings directly using rowData
        sink.processAllMappings(obj, rowData);
        

        await sink.put(obj);
      }

      sink.eof();
    },

    async function processCSV(sink) {
      let input = this.input;
      if ( ! input ) { this.rows = 0; return; }

      try {
        var j = input.indexOf('\n');
        var header = input.substring(0, j);
        input = input.substring(j+1);

        // Parse CSV headers using existing CSVParser
        var parser        = this.CSVParser.create({delimiter: this.delimiter});
        var parsedHeaders = parser.parseString(header, this.delimiter); // delimiter not used
        var fileHeaders   = parsedHeaders.map(h => h.value);

        // Set file headers - this will trigger mapping generation if headers changed
        this.fileHeaders = fileHeaders;

        var a = parser.parseFile(input, this.delimiter);

        this.rows = a.length;

        for ( var i = 0 ; i < a.length ; i++ ) {
          var csv = a[i];
          var obj = this.of.create(null, this);

          // Convert CSV array to a rowData object using file headers
          var rowData = {};
          csv.forEach((cell, index) => {
            if ( index < fileHeaders.length ) {
              rowData[fileHeaders[index]] = cell.value;
            }
          });

          // Apply mappings directly using rowData (handles spaces in column names)
          sink.processAllMappings(obj, rowData);
          

          await sink.put(obj);
          /*
          if ( ids[obj.id] ) {
            this.output += '<span style="color:red">Duplicate Records for id "' + obj.id + '":<br>' + ids[obj.id] + '<br>' + row + '</span>';
          }
          ids[obj.id] = row;
          */
        }

        sink.eof();
      } catch (x) {
        console.error('Error processing uploaded files:', x);
        this.output += '<span style="color:red">ERROR: ' + x + '</span>';
      }
    }
  ],

  actions: [
    {
      name: 'preview',
      code: function() { this.process(false); }
    },
    {
      name: 'upload',
      code: function() { this.process(true); },
      isEnabled: function(data, where, matchedRows) {
        // Enable upload if we have data and (no filter OR matches exist)
        return data && (!where || matchedRows > 0);
      }
    },
    {
      name: 'clear',
      code: function() {
        this.output   = '';
        this.progress = 0;
      }
    },
    {
      name: 'clearFilter',
      label: 'Clear Filter',
      isAvailable: function(where) { return !!where; },
      code: function() {
        this.where = '';
      }
    }
  ]
});
