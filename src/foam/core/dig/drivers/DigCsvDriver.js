/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigCsvDriver',
  extends: 'foam.core.dig.drivers.DigFormatDriver',
  flags: ['java'],

  javaImports: [
    'foam.lang.*',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputter',
    'foam.lib.csv.CSVOutputterImpl',
    'foam.lib.csv.CSVSupport',
    'foam.lib.json.OutputterMode',
    'foam.core.boot.CSpec',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.dao.AbstractSink',
    'foam.dao.AbstractDAO',
    'foam.lang.Detachable',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.MLang',
    'foam.core.auth.AuthService',
    'foam.core.http.Command',
    'foam.core.http.HttpParameters',
    'foam.core.http.*',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.util.SafetyUtil',
    'java.io.ByteArrayInputStream',
    'java.io.InputStream',
    'java.io.PrintWriter',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'jakarta.servlet.http.HttpServletResponse'
  ],

  properties: [
    {
      name: 'format',
      value: 'CSV'
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      javaCode: `
      ArraySink arraySink = new ArraySink();
      InputStream is = new ByteArrayInputStream(data.toString().getBytes());

      ClassInfo cInfo = dao.getOf();
      CSVSupport csvSupport = new CSVSupport();
      csvSupport.setX(x);
      csvSupport.inputCSV(is, arraySink, cInfo);

      List list = arraySink.getArray();

      if ( list == null || list.size() == 0 ) {
        DigUtil.outputException(x, new ParsingErrorException("Invalid CSV Format"), getFormat());
        return null;
      }

      return list;
      `
    },
    {
      name: 'outputFObjects',
      javaCode: `
      HttpServletResponse resp   = x.get(HttpServletResponse.class);
      PrintWriter         out    = x.get(PrintWriter.class);
      ClassInfo           cInfo  = dao.getOf();
      String              output = null;

      if ( fobjects == null || fobjects.size() == 0 ) {
        out.println("[]");
        return;
      }

      CSVOutputterImpl csv = new CSVOutputterImpl.Builder(x)
        .setOf(cInfo)
        .build();

      if ( cols != null && cols.length > 0 ) csv.setProps(cols);

      for ( Object o : fobjects ) {
        FObject fobj = (FObject) o;
        csv.outputFObject(x, fobj);
      }

      // Output the formatted data
      out.append(csv.getSb());
      out.println();
      `
    },
    {
      // Stream CSV rows directly to the response instead of buffering the
      // entire dataset into memory. This keeps large exports from blowing up
      // either the server or the browser when the DAO is big.
      name: 'select',
      args: 'X x',
      javaCode: `
      HttpParameters    p        = x.get(HttpParameters.class);
      HttpServletResponse resp   = x.get(HttpServletResponse.class);
      Command           command  = (Command) p.get(Command.class);
      String            id       = p.getParameter("id");
      String            q        = p.getParameter("q");
      String            cols     = p.getParameter("columns");
      String            limit    = p.getParameter("limit");
      String            skip     = p.getParameter("skip");
      String            daoName  = p.getParameter("dao");
      String[]          outputCols = null;

      if ( SafetyUtil.isEmpty(daoName) ) return;

      DAO dao = getDAO(x);
      if ( dao == null ) return;

      ClassInfo cInfo = dao.getOf();
      try {
        String className = p.getParameter("of");
        if ( ! SafetyUtil.isEmpty(className) ) {
          cInfo = ((FObject) Class.forName(className).newInstance()).getClassInfo();
        }
      } catch ( Throwable t ) {
        getLogger().warning("Failed to override class info", t);
      }
      final ClassInfo cInfoFinal = cInfo;

      Predicate pred = new WebAgentQueryParser(cInfo).parse(x, q);
      dao = dao.where(pred);

      if ( ! SafetyUtil.isEmpty(cols) ) {
        String[] cs = cols.split(",");
        if ( cs.length > 0 ) {
          outputCols = Arrays.asList(cs).stream().filter(pn -> {
            try {
              PropertyInfo pi = (PropertyInfo) cInfoFinal.getAxiomByName(pn);
              return pi != null && ! pi.getNetworkTransient();
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
            pageSize = AbstractDAO.MAX_SAFE_INTEGER;
          }
        } else if ( l != AbstractDAO.MAX_SAFE_INTEGER && l < pageSize && l > 0 ) {
          pageSize = l;
        }
      }
      dao = dao.limit(pageSize);

      // Prepare CSV outputter and response headers
      CSVOutputterImpl csv = new CSVOutputterImpl.Builder(x)
        .setOf(cInfo)
        .build();
      if ( outputCols != null && outputCols.length > 0 ) csv.setProps(outputCols);

      resp.setContentType("text/csv");
      resp.setHeader("Content-Disposition", "attachment; filename=\\"" + daoName + ".csv\\"");

      PrintWriter out = x.get(PrintWriter.class);
      final boolean[] wroteRows = { false };

      dao.select(new AbstractSink() {
        @Override
        public void put(Object obj, Detachable sub) {
          csv.outputFObject(x, (FObject) obj);
          wroteRows[0] = true;

          // Flush in manageable chunks to avoid large buffers.
          if ( csv.getSb().length() >= 8192 ) {
            out.append(csv.getSb());
            csv.getSb().setLength(0);
            out.flush();
          }

          if ( sub != null ) sub.detach();
        }
      });

      if ( ! wroteRows[0] ) {
        // Emit just the header so the downloaded file is still valid CSV.
        csv.outputHeader(x);
      }

      if ( csv.getSb().length() > 0 ) {
        out.append(csv.getSb());
        csv.getSb().setLength(0);
      }

      out.println();
      out.flush();
      getLogger().debug("select.success", daoName, id);

      resp.setStatus(HttpServletResponse.SC_OK);
      `
    }
  ]
});
