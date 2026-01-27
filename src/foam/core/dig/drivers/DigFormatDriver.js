/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigFormatDriver',
  abstract: true,

  flags: [ 'java' ],

  javaImports: [
    'foam.lang.*',
    'foam.dao.AbstractDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputter',
    'foam.lib.json.OutputterMode',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.AuthService',
    'foam.core.boot.CSpec',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.core.http.*',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.mlang.MLang',
    'foam.mlang.predicate.Predicate',
    'foam.util.SafetyUtil',
    'java.io.PrintWriter',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'jakarta.servlet.http.HttpServletResponse'
  ],

  constants: [
    {
      name: 'MAX_PAGE_SIZE',
      type: 'Long',
      value: 1000
    }
  ],

  properties: [
    {
      name: 'format',
      class: 'Reference',
      of: 'foam.core.dig.format.DigFormat',
      targetDAOKey: 'digFormatDAO'
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.core.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaCloneProperty: '//noop',
      javaFactory: `
        return new PrefixLogger(new Object[] {
          this.getClass().getSimpleName()
        }, (Logger) getX().get("logger"));
      `
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      type: 'Object',
      javaThrows: [
        'java.lang.Exception'
      ],
      args: 'X x, DAO dao, String data',
      javaCode: `
        throw new RuntimeException("Unimplemented parse method");
      `
    },
    {
      name: 'outputFObjects',
      args: 'X x, DAO dao, List fobjects, String[] cols',
      javaCode: `
        throw new RuntimeException("Unimplemented output method");
      `
    },
    {
      name: 'outputFObject',
      args: 'X x, DAO dao, FObject obj, String[] cols',
      javaCode: `
        if ( obj == null ) return;
        outputFObjects(x, dao, List.of(obj), cols);
      `
    },
    {
      name: 'put',
      args: 'X x',
      javaThrows: [
        'java.lang.Exception'
      ],
      javaCode: `
        DAO dao = getDAO(x);
        if ( dao == null ) return;

        HttpParameters p      = x.get(HttpParameters.class);
        String        daoName = p.getParameter("dao");
        String        data    = p.getParameter("data");

        // Check if the data is empty
        if ( SafetyUtil.isEmpty(data) ) {
          DigUtil.outputException(x, new EmptyDataException.Builder(x).build(), getFormat());
          return;
        }

        var fobjects = parseFObjects(x, dao, data);
        if ( fobjects == null ) return;
        if ( fobjects instanceof FObject ) {
          outputFObject(x, dao, daoPut(x, dao, (FObject) fobjects), null);
        } else {
          var list = (List) fobjects;
          for ( int i = 0 ; i < list.size() ; i++ ) {
            list.set(i, daoPut(x, dao, (FObject) list.get(i)));
          }
          outputFObjects(x, dao, list, null);
        }

        PrintWriter out = x.get(PrintWriter.class);
        out.println();
        out.flush();
        getLogger().debug("put.success", daoName);

        HttpServletResponse resp = x.get(HttpServletResponse.class);
        resp.setStatus(HttpServletResponse.SC_OK);
      `
    },
    {
      name: 'select',
      args: 'X x',
      javaCode: `
      HttpParameters p = x.get(HttpParameters.class);
      HttpServletResponse resp = x.get(HttpServletResponse.class);
      Command   command   = (Command) p.get(Command.class);
      String   id         = p.getParameter("id");
      String   q          = p.getParameter("q");
      String   cols       = p.getParameter("columns");
      String   limit      = p.getParameter("limit");
      String   skip       = p.getParameter("skip");
      String   daoName    = p.getParameter("dao");
      String[] outputCols = null;

      if ( SafetyUtil.isEmpty(daoName) ) {
        return;
      }

      DAO dao = getDAO(x);
      if ( dao == null )
        return;

      String className = p.getParameter("of");
      ClassInfo cInfo;
      try {
        cInfo = SafetyUtil.isEmpty(className) ? dao.getOf() :
         ((FObject) Class.forName(className).newInstance()).getClassInfo();
      } catch ( Throwable t ) {
        getLogger().error("Failed to get class info", className);
        cInfo = dao.getOf();
      }
      final ClassInfo cInfoFinal = cInfo;

      Predicate pred = new WebAgentQueryParser(cInfo).parse(x, q);
      getLogger().debug(pred.toString());
      dao = dao.where(pred);

      if ( ! foam.util.SafetyUtil.isEmpty(cols) ) {
        String[] cs = cols.split(",");
        if ( cs.length > 0 ) {
          outputCols = Arrays.asList(cs).stream().filter(pn -> {
            try {
              PropertyInfo pi = (PropertyInfo) cInfoFinal.getAxiomByName(pn);
              return ! pi.getNetworkTransient();
            } catch (Throwable t) {
              return false;
            }
          }).toArray(String[]::new);
        }
      }

      PropertyInfo idProp = (PropertyInfo) cInfo.getAxiomByName("id");
      dao = ! SafetyUtil.isEmpty(id) ? dao.where(MLang.EQ(idProp, id)) : dao;

      if ( ! SafetyUtil.isEmpty(skip) ) {
        long s = Long.valueOf(skip);
        if ( s > 0 && s != AbstractDAO.MAX_SAFE_INTEGER ) {
          dao = dao.skip(s);
        }
      }

      long pageSize = DigFormatDriver.MAX_PAGE_SIZE;
      if ( ! SafetyUtil.isEmpty(limit) ) {
        AuthService auth = (AuthService) x.get("auth");
        long l = Long.valueOf(limit);

        if ( l == 0 ) {
          if ( auth.check(x, "service.dig.read-all-records") ) {
            // page size of 0 allows for maximum record count
            pageSize = AbstractDAO.MAX_SAFE_INTEGER;
          }
        } else if ( l != AbstractDAO.MAX_SAFE_INTEGER && l < pageSize && l > 0 ) {
          pageSize = l;
        }
      }
      dao = dao.limit(pageSize);

      List fobjects = ((ArraySink) dao.select(new ArraySink())).getArray();
      getLogger().debug("Number of FObjects selected: " + fobjects.size());

      if ( ! SafetyUtil.isEmpty(id) && fobjects.size() == 1 ) {
        // NOTE: 'id' property indicates 'find' rather than 'select'
        outputFObject(x, dao, (FObject) fobjects.get(0), outputCols);
      } else {
        outputFObjects(x, dao, fobjects, outputCols);
      }

      PrintWriter out = x.get(PrintWriter.class);
      out.println();
      out.flush();
      getLogger().debug("select.success", daoName, id);

      resp.setStatus(HttpServletResponse.SC_OK);
      `
    },
    {
      name: 'remove',
      args: 'X x',
      javaCode: `
      HttpParameters p = x.get(HttpParameters.class);
      String daoName = p.getParameter("dao");
      String id = p.getParameter("id");

      DAO dao = getDAO(x);
      if ( dao == null )
        return;

      if ( SafetyUtil.isEmpty(id) ) {
        DigUtil.outputException(x, new UnknownIdException(), getFormat());
        return;
      }

      ClassInfo cInfo = dao.getOf();
      PropertyInfo idProp = (PropertyInfo) cInfo.getAxiomByName("id");
      Object idObj = idProp.fromString(id);
      FObject targetFobj = dao.find(idObj);

      if ( targetFobj == null ) {
        DigUtil.outputException(x, new UnknownIdException(), getFormat());
        return;
      }

      dao.remove(targetFobj);
      DigUtil.outputException(x, new DigSuccessMessage("Success"), getFormat());

      getLogger().debug("remove.success", daoName, id);
      `
    },
    {
      name: 'getDAO',
      type: 'DAO',
      args: 'X x',
      javaCode: `
      HttpParameters p = x.get(HttpParameters.class);
      String daoName = p.getParameter("dao");

      if ( SafetyUtil.isEmpty(daoName) ) {
        DigUtil.outputException(x, new DAORequiredException(), getFormat());
        return null;
      }

      DAO cSpecDAO = (DAO) x.get("AuthenticatedCSpecDAO");
      CSpec nspec = (CSpec) cSpecDAO.find(daoName);
      if ( nspec == null || ! nspec.getServe() ) {
        DigUtil.outputException(x, new DAONotFoundException(daoName), getFormat());
        return null;
      }

      // Check if the user is authorized to access the DAO.
      try {
        nspec.checkAuthorization(x);
      } catch (AuthorizationException e) {
        DigUtil.outputFObject(x, e, 403, getFormat());
        return null;
      }

      DAO dao = (DAO) x.get(daoName);
      if ( dao == null ) {
        DigUtil.outputException(x, new DAONotFoundException(daoName), getFormat());
        return null;
      }

      return dao.inX(x);
      `
    },
    {
      name: 'daoPut',
      type: 'FObject',
      args: 'Context x, DAO dao, FObject obj',
      synchronized: true,
      javaCode: `
      FObject nu = obj;

      try {
        if ( ! dao.getOf().isInstance(obj) ) {
          foam.core.logger.Loggers.logger(x, this).warning("Possible ClassCastException", obj.getClass(), "not instance of", dao.getOf());
          // throw new ClassCastException(obj.getClass() + " isn't instance of " + dao.getOf());
        }

        Object id = obj.getProperty("id");
        if ( id != null &&
          ! SafetyUtil.isEmpty(id.toString()) ) {
          AuthService auth = (AuthService) x.get("auth");
          String prefix = obj.getClass().getSimpleName().toLowerCase();
          String readPermissionAll = String.format("%s.read.*", prefix);
          String readPermissionId = String.format("%s.read.%s", prefix, id);
          Boolean hasReadPermission = auth.check(x, readPermissionAll) || auth.check(x, readPermissionId);

          // use system context in case if user has permission to update but not to read
          FObject old = dao.inX(hasReadPermission ? x : getX()).find(id);
          if ( old != null ) {
            nu = old.fclone();
            nu.copyFrom(obj);
          }
        }

        return dao.put(nu);
      } catch ( ClassCastException cc ) {
        throw new DAOPutException(cc.getMessage(), cc);
      }  catch ( ValidationException ve ) {
        throw new DAOPutException(ve.getMessage(), ve);
      } catch ( CompoundException ce ) {
        // FObject.validate(x) can collect all validation exceptions into a
        // CompoundException but we just need to return the first to preserve
        // the existing behavior.
        var clientEx = ce.getClientRethrowException();
        if ( clientEx instanceof ValidationException ) {
          throw new DAOPutException(clientEx.getMessage(), clientEx);
        }
        throw ce;
      }
      `
    }
  ]
});
