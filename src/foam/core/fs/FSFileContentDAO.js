/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'foam.core.fs',
    name: 'FSFileContentDAO',
    extends: 'foam.dao.ProxyDAO',
    flags: ['java'],

    documentation: `
      A DAO which returns the content of a file stored in FSFileDAO.
      On find, given a reference to a FSFile, return corresponding FSFileContent with matching reference.
      If no entry is found, try to create a new FSFileContent entry by which stores the file content in a string.
    `,

    javaImports: [
      'foam.core.logger.Loggers',
      'foam.dao.DAO',
      'java.io.File',
      'java.io.IOException',
      'java.nio.file.Files',
      'java.nio.file.Path',
      'java.nio.file.Paths'
    ],

    methods: [
      {
        name: 'find_',
        javaCode: `
          var ret = getDelegate().find(id);
          if ( ret != null ) return ret;

          FSFile file = (FSFile) ((DAO) x.get("FSFileDAO")).find((String) id);
          if ( file == null ) {
            Loggers.logger(x, this).error("Error getting content: FSFile not found for id: ", (String) id);
            return null;
          }
          if ( file.getIsDirectory() ) {
            Loggers.logger(x, this).error("Error getting content: ", (String) file.getId(), "file is a directory");
            return null;
          }

          FSFileContent fsContent = new FSFileContent.Builder(x).setFileName((String) id).build();
          Path path = Paths.get(file.getId());

          try {
            String content = Files.readString(path);
            fsContent.setContent(content);
          } catch (IOException e) {
            Loggers.logger(x, this).error("Failed reading file: ", (String) file.getId(), e);
            fsContent.setContent("Error: could not read file");
          }
          fsContent = (FSFileContent) getDelegate().put_(x, fsContent);

          return fsContent;
        `
      },
      {
        name: 'select_',
        javaCode: `
          throw new UnsupportedOperationException();
        `
      },
      {
        name: 'put_',
        javaCode: `
          throw new UnsupportedOperationException();
        `
      },
      {
        name: 'remove_',
        javaCode: `
          throw new UnsupportedOperationException();
        `
      },
      {
        name: 'removeAll_',
        javaCode: `
          throw new UnsupportedOperationException();
        `
      },
      {
        name: 'cmd_',
        javaCode: `
          throw new UnsupportedOperationException();
        `
      }
    ]
  });
