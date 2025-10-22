/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.http.csp',
  name: 'CSPFilter',

  documentation: `Content-Security-Policy servlet filter.
See https://content-security-policy.com/

The filter builds a policy for each domain encountered from CSPDirective
entries.

Each CSP Directive ID is a triple of 'name', 'key', 'domain'.

FOAM provides production ready directives.
An application can append, disable, or override any directive, and add
additional directives.

To disable a directive, set enabled:false at an application level
cspdirectives.jrl.

To append to a directive, create an entry with the same name, but unique
key. FOAM itself uses 'foam', so the application name is a good choice.

To override a directive, create an entry with the same name and key
with the new value.

If the domain property is set to other than '*' (wildcard), then the
directive will only apply to that domain.

If any CSPDirective is updated at runtime, all policies will be rebuilt.

CSPDirectives can now be package scoped with their respective code use.
See io/c9/ace/ Editor.js and cspdirectives.jrl
`,

  javaImplements: [ 'jakarta.servlet.Filter' ],

  javaImports: [
    'foam.core.theme.ThemeDomain',
    'foam.core.logger.Loggers',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lang.Detachable',
    'foam.lang.X',
    'foam.lang.XLocator',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GROUP_BY',
    'static foam.mlang.MLang.OR',
    'foam.mlang.sink.GroupBy',
    'foam.mlang.predicate.Predicate',
    'foam.util.SafetyUtil',
    'jakarta.servlet.*',
    'jakarta.servlet.http.HttpServletResponse',
    'java.util.concurrent.ConcurrentHashMap',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  constants: [
    {
      documenatation: 'Deprecated HttpServer CSPFilter initParameters key.',
      name: 'CONTENT_SECURITY_POLICY',
      type: 'String',
      value: 'CONTENT_SECURITY_POLICY'
    },
    {
      documentation: 'Cache key when no policy found.',
      name: 'NONE',
      type: 'String',
      value: 'none'
    }
  ],

  properties: [
    {
      documentation: `Provides backward compatibility for http CSpecs
which provide CONTENT_SECURITY_POLICY as init parameters of CSPFilter.`,
      name: 'initParameterCSP',
      class: 'String',
      visibility: 'HIDDEN'
    },
    {
      name: 'cache',
      class: 'Map',
      javaFactory: 'return new ConcurrentHashMap();',
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'init',
      args: 'FilterConfig config',
      javaThrows: [ 'ServletException' ],
      javaCode: `
        setInitParameterCSP(config.getInitParameter(CONTENT_SECURITY_POLICY));

        X x = (X) config.getServletContext().getAttribute("X");
        initDAOListeners(x);
      `
    },
    {
      name: 'doFilter',
      args: 'ServletRequest request, ServletResponse response, FilterChain chain',
      javaThrows: [ 'java.io.IOException', 'ServletException' ],
      javaCode: `
        String policy = getPolicy((X) request.getServletContext().getAttribute("X"), request.getServerName());
        if ( ! SafetyUtil.isEmpty(policy) &&
             ! policy.equals(NONE) ) {
          ((HttpServletResponse) response).setHeader("Content-Security-Policy", policy);
        }

        chain.doFilter(request, response);
      `
    },
    {
      name: 'destroy',
      javaCode: '// noop'
    },
    {
      name: 'initDAOListeners',
      args: 'X x',
      javaCode: `
        DAO cspDirectiveDAO = (DAO) x.get("cspDirectiveDAO");
        cspDirectiveDAO.listen(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) {
            Loggers.logger(x, this).info("flush cache");
            getCache().clear();
          }
        }, null);
      `
    },
    {
      name: 'getPolicy',
      args: 'X x, String domain',
      type: 'String',
      javaCode: `
        String policy = (String) getCache().get(domain);
        if ( ! SafetyUtil.isEmpty(policy) )
          return policy;

        policy = getInitParameterCSP();
        if ( ! SafetyUtil.isEmpty(policy) ) {
          getCache().put(domain, policy);
          return policy;
        }

        synchronized ( domain.intern() ) {
          policy = (String) getCache().get(domain);
          if ( ! SafetyUtil.isEmpty(policy) )
            return policy;

          policy = buildPolicy(x, domain);
          if ( SafetyUtil.isEmpty(policy) ) {
            policy = NONE;
          }
          getCache().put(domain, policy);
        }
        return policy;
      `
    },
    {
      name: 'buildPolicy',
      args: 'X x, String domain',
      type: 'String',
      javaCode: `
      DAO dao = (DAO) x.get("cspDirectiveDAO");
      GroupBy groups = (GroupBy) dao
        .where(
          AND(
            EQ(CSPDirective.ENABLED, true),
            OR (
              EQ(CSPDirective.DOMAIN, domain),
              EQ(CSPDirective.DOMAIN, CSPDirective.WILDCARD)
            )
          )
        )
        .select(GROUP_BY(CSPDirective.NAME, new ArraySink(x)));

      StringBuilder sb = new StringBuilder();
      for ( String name : ((Map<String, CSPDirective>)groups.getGroups()).keySet() ) {
        sb.append(name);
        for ( CSPDirective directive : (List<CSPDirective>) ((ArraySink) groups.getGroups().get(name)).getArray() ) {
          sb.append(" ");
          sb.append(directive.getValue());
          if ( ! SafetyUtil.isEmpty(directive.getHash()) ) {
            sb.append(" ");
            sb.append(directive.getHash());
          }
        }
        sb.append("; ");
      }

      Loggers.logger(x, this).info("policy", domain, sb.toString().replaceAll(";", ";\\n"));
      return sb.toString();
      `
    }
  ]
});
