/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'FileDataDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.blob.*',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.Sink',
    'foam.util.SafetyUtil',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
  ],

  properties: [
    {
      class: 'Long',
      name: 'maxStringDataSize',
      value: 1024 * 3
    }
  ],

  methods: [
    {
      documentation: `Server side logic to save file to either file.dataString or to physical files system.`,
      name: 'put_',
      javaCode: `
      File file = (File) obj;
      DAO fileTypeDAO = (DAO) x.get("fileTypeDAO");
      FileType fileType;
      String type = "";

      if ( SafetyUtil.isEmpty(file.getMimeType()) ) {
        fileType = (FileType) fileTypeDAO.find(file.getFileType());

         if ( fileType != null ) {
          type = fileType.toSummary();
          file.setMimeType(type);
        }

        if ( SafetyUtil.isEmpty(type) ) {
          String fileExtention = "";
          if ( ! SafetyUtil.isEmpty(file.getFilename()) &&
               file.getFilename().lastIndexOf(".") != -1 &&
               file.getFilename().lastIndexOf(".") != 0 ) {
            fileExtention = file.getFilename().substring(file.getFilename().lastIndexOf(".")+1);
          }

          if ( ! SafetyUtil.isEmpty(fileExtention) ) fileType = (FileType) fileTypeDAO.find(EQ(FileType.ABBREVIATION, fileExtention.toUpperCase()));

          if ( fileType != null ) {
            file.setMimeType(fileType.toSummary());
          } else {
            throw new foam.lang.FOAMException(
              SafetyUtil.isEmpty(fileExtention) ? "Can not find file extension from file: " + file.getFilename() : "File type not supported: " + fileExtention
            );
          }
        }
      }
      if ( ! SafetyUtil.isEmpty(file.getDataString()) ) {
        return getDelegate().put_(x, obj);
      }

      Blob blob = file.getData();
      if ( blob == null ) {
        return getDelegate().put_(x, obj);
      }

      if ( file.getFilesize() != blob.getSize() ) file.setFilesize(blob.getSize());
      // save to data string
      if ( file.getFilesize() <= getMaxStringDataSize() ) {
        try {
          java.io.ByteArrayOutputStream os = new java.io.ByteArrayOutputStream((int) file.getFilesize());
          blob.read(os, 0, file.getFilesize());
          String encodedString = java.util.Base64.getEncoder().encodeToString(os.toByteArray());
          file.setDataString("data:"+file.getMimeType()+";base64," + encodedString);
          file.clearData();
          return getDelegate().put_(x, file);
        } catch (Exception e) {
          ((foam.dao.DAO) x.get("alarmDAO")).put(new foam.core.alarming.Alarm.Builder(x)
            .setName("Failed to encode")
            .setSeverity(foam.log.LogLevel.ERROR)
            .setReason(foam.core.alarming.AlarmReason.UNSPECIFIED)
            .setNote(file.getFilename() + " " + e.getMessage())
            .build());
          throw new foam.lang.FOAMException("Failed to encode file", e);
        }
      }

      try {
        // save to filesystem
        BlobService blobStore = (BlobService) x.get("blobStore");
        IdentifiedBlob result = (IdentifiedBlob) blobStore.put(blob);
        file.setId(result.getId());
        file.clearData();
        return getDelegate().put_(x, file);
      } catch (Exception e) {
        ((foam.dao.DAO) x.get("alarmDAO")).put(new foam.core.alarming.Alarm.Builder(x)
          .setName("Failed to save")
          .setSeverity(foam.log.LogLevel.ERROR)
          .setNote(file.getFilename())
          .build());
        throw new foam.lang.FOAMException("Failed to save file", e);
      }
      `
    },
    {
      name: 'select_',
      javaCode: `
      Sink delegateSink = sink;
      if ( delegateSink == null ) {
        delegateSink = new ArraySink();
      }
      getDelegate().select_(x, new FileDataClearSink(x, delegateSink), skip, limit, order, predicate);
      return delegateSink;
      `
    }
  ]
});
