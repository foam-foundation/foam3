/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'UploadAgent',

  extends: 'foam.core.job.Job',

  documentation: `One batch of rows of an upload, run as a Job on the server.

    The browser used to send each batch through dao.cmd(), a request that the
    gateway times out after 60 seconds and then retries. When the target table
    was cold, loading it took longer than that, so the retried request stored
    the same batch a second time. As a Job, the submit only stores the batch in
    the jobDAO and returns, and a resent submit finds the same Job (the sender
    gives it a fixed id) and runs nothing twice.`,

  javaImports: [
    'foam.dao.DAO',
    'foam.core.boot.CSpec',
    'java.io.ByteArrayInputStream',
    'java.io.ByteArrayOutputStream',
    'java.util.zip.GZIPInputStream',
    'foam.lib.json.JSONParser',
    'foam.lib.json.ExprParser',
    'foam.lib.parse.ErrorReportingPStream',
    'foam.lib.parse.Parser',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.PStream',
    'foam.lib.parse.StringPStream',
    'foam.lang.ProxyX'
  ],

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      transient: true,
      name: 'data',
      javaFactory: `
        // Decompress the compressed base64 string data
        foam.core.logger.Logger logger = foam.core.logger.Loggers.logger(getX(), this);
        String compressed = getCompressed();

        if ( compressed != null && ! compressed.isEmpty() ) {
          try {
            // Decode base64 to get compressed data
            byte[] compressedData = java.util.Base64.getDecoder().decode(compressed);

            // Decompress using GZIP
            java.io.ByteArrayInputStream  bais = new java.io.ByteArrayInputStream(compressedData);
            java.util.zip.GZIPInputStream gzis = new java.util.zip.GZIPInputStream(bais);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();

            byte[] buffer = new byte[1024];
            int len;
            while ( (len = gzis.read(buffer)) != -1 ) {
              baos.write(buffer, 0, len);
            }

            gzis.close();
            bais.close();
            baos.close();

            // Deserialize the decompressed data back to FObject array
            String decompressedJson = new String(baos.toByteArray(), "UTF-8");

            foam.lib.json.JSONParser parser = new foam.lib.json.JSONParser();
            parser.setX(getX());

            // Parse the JSON - returns null on error (doesn't throw by default)
            Object[] arrayResult;
            try {
              arrayResult = parser.parseStringForArray(decompressedJson, null);
            } catch (RuntimeException t) {
              String message = getParsingError(getX(), decompressedJson);
              throw new RuntimeException("Failed to parse decompressed JSON: " + message, t);
            }

            if ( arrayResult == null ) {
              String message = getParsingError(getX(), decompressedJson);
              throw new RuntimeException("Failed to parse decompressed JSON: " + message);
            }

            // Convert Object[] to foam.lang.FObject[] since each object is an FObject
            foam.lang.FObject[] fObjectArray = new foam.lang.FObject[arrayResult.length];
            for ( int i = 0; i < arrayResult.length; i++ ) {
              if ( arrayResult[i] instanceof foam.lang.FObject ) {
                fObjectArray[i] = (foam.lang.FObject) arrayResult[i];
              } else {
                logger.warning("UploadAgent", "Array element is not FObject", "index", i,
                  "type", arrayResult[i] != null ? arrayResult[i].getClass().getName() : "null");
              }
            }
            return fObjectArray;
          } catch ( Exception e ) {
            throw new RuntimeException("UploadAgent exception: " + e.getMessage(), e);
          }
        }
        logger.warning("UploadAgent", "No compressed data, returning empty array");
        return new foam.lang.FObject[0];
      `
    },
    {
      class: 'String',
      name: 'compressed'
    },
    {
      class: 'Int',
      name: 'processed'
    },
    {
      class: 'String',
      name: 'daoKey',
      documentation: `Name of the served DAO the rows go to, the name its service is registered under,
        such as 'fooDAO'. The sender fills it in. Empty means the page that sent the batch is older
        than this server.`
    }
  ],

  javaCode: `
    /**
     * Gets detailed parsing error message using ErrorReportingPStream
     * Uses FObjectArrayParser for JSON array parsing errors
     * @param x the context
     * @param buffer the JSON string that failed to parse
     * @return detailed error message
     */
    protected String getParsingError(foam.lang.X x, String buffer) {
      Parser        parser = foam.lib.json.FObjectArrayParser.create(null);
      PStream       ps     = new StringPStream();
      ParserContext psx    = new ParserContextImpl();

      ((StringPStream) ps).setString(buffer);
      psx.set("X", x == null ? new ProxyX() : x);

      ErrorReportingPStream eps = new ErrorReportingPStream(ps);
      ps = eps.apply(parser, psx);
      return eps.getMessage();
    }
  `,

  methods: [
    async function compressData(data) {
      if ( ! data || data.length === 0 ) {
        return null;
      }

      try {
        // Serialize data to JSON
        const jsonData  = foam.json.Network.stringify(data);
        const dataBytes = new TextEncoder().encode(jsonData);

        // Create compression stream using Response API for efficiency
        const stream = new CompressionStream('gzip');
        const compressedResponse = new Response(
          new Blob([dataBytes]).stream().pipeThrough(stream)
        );

        // Get compressed data as array buffer (more efficient than reading chunks)
        const compressedBuffer = await compressedResponse.arrayBuffer();
        const compressedArray  = new Uint8Array(compressedBuffer);

        // Optimized base64 encoding
        const CHUNK_SIZE = 65536; // 64KB chunks to avoid call stack issues

        let base64Result;
        if ( compressedArray.length <= CHUNK_SIZE ) {
          // For smaller data, use direct conversion with spread operator
          base64Result = btoa(String.fromCharCode.apply(null, compressedArray));
        } else {
          // For larger data, process in chunks and use array join for efficiency
          const chunks = [];
          for ( let i = 0 ; i < compressedArray.length ; i += CHUNK_SIZE ) {
            const chunk = compressedArray.subarray(i, Math.min(i + CHUNK_SIZE, compressedArray.length));
            chunks.push(String.fromCharCode.apply(null, chunk));
          }
          base64Result = btoa(chunks.join(''));
        }
        return base64Result;

      } catch ( e ) {
        console.error('UploadAgent.compressData - EXCEPTION:', e);
        return null;
      }
    },

    async function normalizeObj() {
      this.compressed = await this.compressData(this.data);
    },

    {
      name: 'resolveDAO',
      type: 'foam.dao.DAO',
      documentation: `Find the DAO the rows go to, and check that the user who submitted the batch may
        reach it, exactly as the request that used to carry the batch would have been checked:
        service.<daoKey>. Reads cSpecDAO directly, not AuthenticatedCSpecDAO, which would also demand
        service.read.<daoKey>.`,
      args: 'X x',
      javaCode: `
        if ( foam.util.SafetyUtil.isEmpty(getDaoKey()) )
          throw new RuntimeException("This page or client is older than the server. Reload and upload again.");

        CSpec  spec = (CSpec) ((DAO) x.get("cSpecDAO")).find(getDaoKey());
        Object svc  = x.get(getDaoKey());
        if ( spec != null && spec.getServe() && svc instanceof DAO ) {
          spec.checkAuthorization(x);
          return ((DAO) svc).inX(x);
        }
        DAO dao = resolveUnservedDAO(x);
        if ( dao == null ) throw new RuntimeException("No served DAO named " + getDaoKey());
        return dao;
      `
    },
    {
      name: 'resolveUnservedDAO',
      type: 'foam.dao.DAO',
      documentation: `Extension point for a DAO that is not a served CSpec, such as one created at runtime.
        An application refines this to find it. Returns null when there is none, which is what the
        default does.`,
      args: 'X x',
      javaCode: `
        return null;
      `
    },
    {
      name: 'execute',
      javaCode: `
        try {
          DAO dao = resolveDAO(x);
          foam.lang.FObject[] data = getData(); // This will trigger decompression via javaFactory

          // A batch whose payload is gone would otherwise complete with nothing stored.
          if ( data.length == 0 ) throw new RuntimeException("UploadAgent received no rows");

          for ( int i = 0 ; i < data.length ; i++ ) {
            dao.put(data[i]);
          }
          setProcessed(data.length);
        } finally {
          // The Job stays in the jobDAO after it ends; do not keep thousands of rows with it.
          clearProperty("compressed");
          clearProperty("data");
        }
      `
    }
  ]
});
