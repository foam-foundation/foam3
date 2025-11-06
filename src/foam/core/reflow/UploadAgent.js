/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'UploadAgent',

  implements: [ 'foam.lang.ContextAgent' ],

  javaImports: [
    'foam.dao.DAO',
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
      name: 'execute',
      javaCode: `
        DAO dao = ((DAO) x.get("AGENTDAO"));
        foam.lang.FObject[] data = getData(); // This will trigger decompression via javaFactory
        for ( int i = 0 ; i < data.length ; i++ ) {
          var d = data[i];
          dao.put(d);
        }
        // Clear compressed data to avoid sending back to client
        clearProperty("compressed");
        // Reset transient data property
        clearProperty("data");
        setProcessed(data.length);
      `
    }
  ]
});
