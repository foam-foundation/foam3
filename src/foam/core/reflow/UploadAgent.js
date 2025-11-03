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
        logger.info("UploadAgent", "javaFactory called",
          "hasCompressed", compressed != null,
          "isEmpty", compressed != null ? compressed.isEmpty() : true,
          "length", compressed != null ? compressed.length() : 0);

        if ( compressed != null && ! compressed.isEmpty() ) {
          logger.info("UploadAgent", "Starting decompression", "compressedLength", compressed.length());
          try {
            // Decode base64 to get compressed data
            byte[] compressedData = java.util.Base64.getDecoder().decode(compressed);
            logger.debug("UploadAgent", "Base64 decoded", "compressedDataLength", compressedData.length);

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
            logger.info("UploadAgent", "Decompression complete", "jsonLength", decompressedJson.length());
            logger.debug("UploadAgent", "JSON preview (first 500 chars)", "preview",
              decompressedJson.length() > 500 ? decompressedJson.substring(0, 500) : decompressedJson);

            foam.lib.json.JSONParser parser = new foam.lib.json.JSONParser();
            parser.setX(getX());
            logger.debug("UploadAgent", "Parser created and context set");

            // Parse the JSON - returns null on error (doesn't throw by default)
            logger.info("UploadAgent", "Starting JSON parsing");
            Object[] arrayResult = null;
            try {
              arrayResult = parser.parseStringForArray(decompressedJson, null);
              logger.info("UploadAgent", "Parsing completed", "resultIsNull", arrayResult == null,
                "resultLength", arrayResult != null ? arrayResult.length : -1);
            } catch (RuntimeException t) {
              // Parsing threw an exception - get detailed error like ServiceWebAgent
              logger.error("UploadAgent", "EXCEPTION during parsing", "exceptionType", t.getClass().getName(),
                "message", t.getMessage());
              try {
                String detailedError = getParsingError(getX(), decompressedJson);
                logger.error("UploadAgent", "JSON parsing exception - detailed error", "error", detailedError);
              } catch (RuntimeException r) {
                // If getting detailed error fails, log basic error
                logger.error("UploadAgent", "JSON parsing exception - basic error", "error", t.getMessage(), t);
              }
              throw new RuntimeException("Failed to parse decompressed JSON: " + t.getMessage(), t);
            }

            if ( arrayResult == null ) {
              // Parsing returned null - get detailed error like ServiceWebAgent does
              logger.error("UploadAgent", "Parser returned NULL - getting detailed error");
              String detailedError = getParsingError(getX(), decompressedJson);
              logger.error("UploadAgent", "JSON parsing returned null - detailed", "error", detailedError);
              throw new RuntimeException("Failed to parse decompressed JSON (parser returned null): " + detailedError);
            }

            if ( arrayResult.length > 0 ) {
              logger.info("UploadAgent", "Array has elements", "count", arrayResult.length);
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

              logger.info("UploadAgent", "Conversion complete", "fObjectArrayLength", fObjectArray.length);
              return fObjectArray;
            } else {
              // Empty array
              logger.error("UploadAgent", "EMPTY ARRAY RETURNED", "arrayLength", arrayResult.length);
              String preview = decompressedJson.length() > 500 ?
                decompressedJson.substring(0, 500) + "..." : decompressedJson;
              logger.error("UploadAgent", "Empty array details", "jsonLength", decompressedJson.length(),
                "jsonPreview", preview);
              throw new RuntimeException("Parser returned empty array. JSON length: " + decompressedJson.length() +
                ", Preview: " + preview);
            }
          } catch ( Exception e ) {
            // Re-throw parsing errors - message already has context from inner exception
            logger.error("UploadAgent", "OUTER EXCEPTION CAUGHT", "exceptionType", e.getClass().getName(),
              "message", e.getMessage(), e);
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

  methods: [
    async function compressData(data) {
      console.log('UploadAgent.compressData called', 'hasData:', !!data, 'length:', data ? data.length : 0);
      if ( ! data || data.length === 0 ) {
        console.warn('UploadAgent.compressData - no data to compress');
        return null;
      }

      try {
        // Serialize data to JSON
        const jsonData  = foam.json.Network.stringify(data);
        console.log('UploadAgent.compressData - serialized to JSON', 'jsonLength:', jsonData.length);
        const dataBytes = new TextEncoder().encode(jsonData);
        console.log('UploadAgent.compressData - encoded to bytes', 'byteLength:', dataBytes.length);

        // Create compression stream using Response API for efficiency
        const stream = new CompressionStream('gzip');
        const compressedResponse = new Response(
          new Blob([dataBytes]).stream().pipeThrough(stream)
        );

        // Get compressed data as array buffer (more efficient than reading chunks)
        const compressedBuffer = await compressedResponse.arrayBuffer();
        const compressedArray  = new Uint8Array(compressedBuffer);
        console.log('UploadAgent.compressData - compressed', 'compressedLength:', compressedArray.length);

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
        console.log('UploadAgent.compressData - base64 encoded', 'base64Length:', base64Result.length);
        return base64Result;

      } catch ( e ) {
        console.error('UploadAgent.compressData - EXCEPTION:', e);
        return null;
      }
    },

    async function normalizeObj() {
      console.log('*** UploadAgent.normalizeObj ENTRY ***', 'hasData:', !!this.data, 'dataLength:', this.data ? this.data.length : 0);
      this.compressed = await this.compressData(this.data);
      console.log('UploadAgent.normalizeObj DONE', 'hasCompressed:', !!this.compressed, 'compressedLength:', this.compressed ? this.compressed.length : 0);
    }
  ],

  javaCode: `
    /**
     * Gets detailed parsing error message using ErrorReportingPStream
     * Same approach as ServiceWebAgent.getParsingError()
     * @param x the context
     * @param buffer the JSON string that failed to parse
     * @return detailed error message
     */
    protected String getParsingError(foam.lang.X x, String buffer) {
      Parser        parser = ExprParser.instance();
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
    {
      name: 'execute',
//      type: 'Void',
//      args: 'Context x',
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
