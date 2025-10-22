/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.flow',
  name: 'DocumentationFolderDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: 'Loads/stores documentation models from a directory of HTML markup.  Useful for saving and editing documentation in a version control repository.',

  javaImports: [
    'foam.core.fs.Storage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.lang.X',
    'java.nio.charset.StandardCharsets',
    'java.util.HashSet',
    'java.util.Set',
    'java.io.OutputStream',
    'com.vladsch.flexmark.util.ast.Node',
    'com.vladsch.flexmark.html.HtmlRenderer',
    'com.vladsch.flexmark.parser.Parser',
    'com.vladsch.flexmark.util.data.MutableDataSet'
  ],

  properties: [
    {
      name: 'initialized',
      class: 'Boolean',
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'select_',
      javaCode: `
      maybeInit(x);
      return getDelegate().select_(x, sink, skip, limit, order,predicate);
      `
    },
    {
      name: 'find_',
      javaCode: `
      maybeInit(x);
      return getDelegate().find_(x, id);
      `
    },
    {
      name: 'remove_',
      javaCode: `throw new UnsupportedOperationException("Can't remove on DocumentationFolderDAO");`
    },
    {
      name: 'put_',
      javaCode: `
      Document doc = (Document) obj;
      String id = getId(doc);

      Storage storage = getStorage(x);
      OutputStream oStream = storage.getOutputStream(id + ".html");

      if ( oStream == null ) {
        return obj;
      }

      try {
        oStream.write(doc.getMarkup().getBytes(StandardCharsets.UTF_8));
      } catch ( java.io.IOException e ) {
        throw new RuntimeException(e);
      }

      return getDelegate().put_(x, doc);
      `
    },
    {
      name: 'maybeInit',
      args: 'X x',
      javaType: 'void',
      synchronized: true,
      javaCode: `
      if ( getInitialized() )
        return;

      try {
        var storage = getStorage(x);
        Set<String> paths = null;
        try {
          paths = storage.getAvailableFiles("");
        } catch (Throwable t) {
          foam.core.logger.Loggers.logger(x, this).error(t.getMessage());
          throw new RuntimeException(t);
        }

        // MD parsing setup
        MutableDataSet options = new MutableDataSet();
        Parser parser = Parser.builder(options).build();
        HtmlRenderer renderer = HtmlRenderer.builder(options).build();

        for ( String path : paths ) {
          try {
            String name = path.substring(0, path.lastIndexOf("."));
            String id = getId(name);
            var doc = new Document();
            doc.setId(id);

            String content = null;

            var filename = id + ".md";
            byte[] bytes  = storage.getBytes(filename);
            if ( bytes != null ) {
              Node document = parser.parse(new String(bytes, StandardCharsets.UTF_8));
              content = renderer.render(document);
              doc.setType("md");
            } else {
              filename = id + ".flow";
              bytes  = storage.getBytes(filename);
              if ( bytes != null ) {
                content = new String(bytes, StandardCharsets.UTF_8);
                doc.setType("flow");
              }
            }
            if ( content != null ) {
              if ( content.startsWith("<title>") && content.indexOf("</title>") != -1 ) {
                doc.setTitle(content.substring(7, content.indexOf("</title>")));
              } else if ( content.startsWith("<h1>") && content.indexOf("</h1>") != -1 ) {
                doc.setTitle(content.substring(4, content.indexOf("</h1>")));
              } else if ( content.startsWith("<h2>") && content.indexOf("</h2>") != -1 ) {
                doc.setTitle(content.substring(4, content.indexOf("</h2>")));
              }
              doc.setMarkup(content);
              if ( doc.getType().equals("md") ||
                   getDelegate().find_(x, id) == null ) {
                getDelegate().put_(x, doc);
              }
            } else {
              Loggers.logger(x, this).warning("initialize", "No content found", path);
            }
          } catch ( RuntimeException e ) {
            Loggers.logger(x, this).warning("initialize", path, e.getMessage());
          }
        }
      } finally {
        setInitialized(true);
      }
      `
    },
    {
      name: 'getId',
      args: 'Object obj',
      type: 'String',
      javaCode: `
      // Very conservative allowable characters to avoid any possible filename shennanigans.

      String id = obj instanceof Document ? (String) getPK((Document) obj) : (String) obj;
      if ( ! id.matches("^[a-zA-Z0-9_-]+$") ) {
        throw new RuntimeException("DocumentationFolderDAO Invalid primary key '"+id+"', must use only alphanumeric characters, _ and -");
      }
      return id;
      `
    },
    {
      name: 'getStorage',
      args: 'X x',
      javaType: 'foam.core.fs.Storage',
      javaCode: `
      return new foam.core.fs.FallbackStorage(
        new foam.core.fs.FileSystemStorage(System.getProperty("DOCUMENT_HOME")) {
          @Override
          public OutputStream getOutputStream(String name) {
            var path = getPath(name);
            if ( path == null ) return null;

            try {
              return java.nio.file.Files.newOutputStream(path);
            } catch (java.io.IOException e) {
              return null;
            }
          }
        },
        new foam.core.fs.ResourceStorage("documents") {
          @Override
          protected java.nio.file.Path getPath(String name) {
            try {
              getFS();
              return super.getPath(name);
            } catch (RuntimeException e) {
              return null;
            }
          }
        }
      );`
    }
  ]
});
