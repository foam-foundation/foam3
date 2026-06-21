/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.mcp;

import foam.lang.*;
import foam.core.*;
import foam.dao.*;
import foam.lib.json.Outputter;
import foam.lib.json.JSONParser;
import foam.lib.formatter.JSONFObjectFormatter;
import foam.core.http.WebAgent;
import foam.core.logger.Logger;
import foam.mlang.MLang;
import foam.mlang.predicate.Predicate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.util.*;
import jakarta.servlet.http.*;

/**
 * Model Context Protocol (MCP) server implemented as a FOAM WebAgent.
 *
 * Exposes the entire FOAM CORE through 5 tools that mirror the DAO interface:
 *   dao_select, dao_find, dao_put, dao_remove, dao_getOf
 *
 * The MCP client bootstraps by selecting from "cSpecDAO" — the same DAO
 * interface as everything else — to discover all available DAOs. It calls
 * dao_getOf on any DAO to learn its model schema. No special discovery
 * mechanism needed; the uniform interface IS the discovery mechanism.
 *
 * Queries use AQL (Anthropic-friendly text) rather than JSON MLang trees.
 * Select uses ArraySink by default, with optional JSON Sink composition
 * for server-side aggregation (COUNT, SUM, GROUP_BY, etc.).
 *
 * Authorization is inherited: the Session and GRANT permissions flow
 * through X, so DAO operations are automatically permission-scoped.
 *
 * Transport: Streamable HTTP (JSON-RPC 2.0 over POST)
 * Protocol: MCP 2025-03-26
 */
public class MCPWebAgent
  implements WebAgent
{

  protected static final String        MCP_VERSION   = "2025-03-26";
  protected static final int           DEFAULT_LIMIT = 100;
  protected static final int           MAX_LIMIT     = 1000;
  protected static final ObjectMapper  MAPPER        = new ObjectMapper();

  // Maps tool name → Flow primary key whose first markdown block is the tool description.
  // Null entry = use the hard-coded description from TOOLS as fallback.
  protected static final Map<String,String> TOOL_DOC_FLOWS = Map.of(
    "dao_select", "MCP:dao_select",
    "dao_find",   "MCP:dao_find",
    "dao_put",    "MCP:dao_put",
    "dao_remove", "MCP:dao_remove",
    "dao_getOf",  "MCP:dao_getOf"
  );

  // ─── Tool Definitions ─────────────────────────────────────────────────────────
  //
  // 5 tools. That's it. The DAO interface + getOf().
  // The client starts with "cSpecDAO" and discovers everything else.

  protected static final List<Map<String,Object>> TOOLS = List.of(

    tool("dao_select", "",
      Map.of("type", "object",
        "properties", Map.of(
          "dao",   Map.of("type", "string", "description", "DAO name (e.g. 'cSpecDAO', 'userDAO')"),
          "query", Map.of("type", "string", "description",
            "AQL query string. Examples: "
            + "'firstName=\"Kevin\"', "
            + "'status=ACTIVE AND age>18', "
            + "'amount>=1000 OR priority=HIGH'. "
            + "Omit to return all records."),
          "skip",  Map.of("type", "integer", "description", "Number of results to skip (pagination)"),
          "limit", Map.of("type", "integer", "description", "Max results to return (default 100, max 1000)"),
          "sink",  Map.of("type", "object", "description",
            "Optional FOAM Sink as JSON for server-side aggregation. "
            + "Default is ArraySink. Examples: "
            + "{\"class\":\"foam.mlang.sink.Count\"}, "
            + "{\"class\":\"foam.mlang.sink.GroupBy\",\"arg1\":\"status\",\"arg2\":{\"class\":\"foam.mlang.sink.Count\"}}"),
          "orderBy", Map.of("type", "object", "description",
            "Optional sort order. Single field ascending: {\"class\":\"__Property__\",\"forClass_\":\"...\",\"name\":\"field\"}. "
            + "Descending: {\"class\":\"foam.mlang.order.Desc\",\"arg1\":{...}}. "
            + "Multiple fields: {\"class\":\"foam.mlang.order.ThenBy\",\"head\":{...},\"tail\":{...}}.")),
        "required", List.of("dao"))),

    tool("dao_find", "",
      Map.of("type", "object",
        "properties", Map.of(
          "dao", Map.of("type", "string", "description", "DAO name"),
          "id",  Map.of("type", "string", "description", "Object ID")),
        "required", List.of("dao", "id"))),

    tool("dao_put", "",
      Map.of("type", "object",
        "properties", Map.of(
          "dao",    Map.of("type", "string", "description", "DAO name"),
          "object", Map.of("type", "object", "description", "Object as JSON with 'class' property")),
        "required", List.of("dao", "object"))),

    tool("dao_remove", "",
      Map.of("type", "object",
        "properties", Map.of(
          "dao", Map.of("type", "string", "description", "DAO name"),
          "id",  Map.of("type", "string", "description", "Object ID")),
        "required", List.of("dao", "id"))),

    tool("dao_getOf", "",
      Map.of("type", "object",
        "properties", Map.of(
          "dao", Map.of("type", "string", "description", "DAO name")),
        "required", List.of("dao")))
  );


  // ─── WebAgent Entry Point ─────────────────────────────────────────────────────

  @Override
  public void execute(X x) {
    HttpServletRequest  req    = x.get(HttpServletRequest.class);
    HttpServletResponse resp   = x.get(HttpServletResponse.class);
    PrintWriter         out    = x.get(PrintWriter.class);
    Logger              logger = (Logger) x.get("logger");

    resp.setContentType("application/json");
    resp.setHeader("Cache-Control", "no-store");

    try {
      String             body   = readBody(req);
      Map<String,Object> rpc    = parseJSON(x, body);
      String             method = (String) rpc.get("method");
      Object             id     = rpc.get("id");
      Map<String,Object> params = asMap(rpc.get("params"));

      // Notifications (no id) — acknowledge silently
      if ( id == null ) {
        resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        return;
      }

      Object result = dispatch(x, method, params);
      writeResult(out, id, result);

    } catch ( MCPError e ) {
      writeError(out, null, e.code, e.getMessage());
    } catch ( Throwable t ) {
      logger.error("MCPWebAgent", t);
      writeError(out, null, -32603, t.getMessage());
    }
  }


  // ─── JSON-RPC Dispatch ────────────────────────────────────────────────────────

  protected Object dispatch(X x, String method, Map<String,Object> params) {
    return switch ( method ) {
      case "initialize" -> handleInitialize();
      case "tools/list" -> handleToolsList(x);
      case "tools/call" -> handleToolCall(x, params);
      default -> throw new MCPError(-32601, "Method not found: " + method);
    };
  }

  protected Map<String,Object> handleInitialize() {
    return Map.of(
      "protocolVersion", MCP_VERSION,
      "capabilities",    Map.of("tools", Map.of("listChanged", false)),
      "serverInfo",      Map.of("name", "foam-mcp", "version", "1.0.0")
    );
  }

  @SuppressWarnings("unchecked")
  protected Map<String,Object> handleToolsList(X x) {
    List<Map<String,Object>> tools = new ArrayList<>();
    for ( Map<String,Object> t : TOOLS ) {
      String name   = (String) t.get("name");
      String flowId = TOOL_DOC_FLOWS.get(name);
      String desc = flowId != null ? findFlowMarkdown(x, flowId) : "";
      tools.add(tool(name, desc != null ? desc : "", (Map<String,Object>) t.get("inputSchema")));
    }
    return Map.of("tools", tools);
  }

  @SuppressWarnings("unchecked")
  protected String findFlowMarkdown(X x, String flowId) {
    try {
      DAO      flowDAO = (DAO) x.get("flowDAO");
      if ( flowDAO == null ) return null;
      FObject  flow    = (FObject) flowDAO.find(flowId);
      if ( flow == null ) return null;
      PropertyInfo scriptProp = (PropertyInfo) flow.getClassInfo().getAxiomByName("script");
      String script = (String) scriptProp.get(flow);
      if ( script == null || script.isBlank() ) return null;
      List<Map<String,Object>> blocks = MAPPER.readValue(script, List.class);
      StringBuilder sb = new StringBuilder();
      for ( Map<String,Object> block : blocks ) {
        if ( "markdown".equals(block.get("cmd")) ) {
          Map<String,Object> value = asMap(block.get("value"));
          String md = (String) value.get("markdown");
          if ( md != null ) { if ( sb.length() > 0 ) sb.append("\n\n"); sb.append(md); }
        }
      }
      if ( sb.length() > 0 ) return sb.toString();
    } catch ( Throwable t ) {}
    return null;
  }

  protected Object handleToolCall(X x, Map<String,Object> params) {
    String             name = (String) params.get("name");
    Map<String,Object> args = asMap(params.get("arguments"));

    Object result = switch ( name ) {
      case "dao_select" -> daoSelect(x, requireString(args, "dao"), args);
      case "dao_find"   -> daoFind(x, requireString(args, "dao"), args.get("id"));
      case "dao_put"    -> daoPut(x, requireString(args, "dao"), asMap(args.get("object")));
      case "dao_remove" -> daoRemove(x, requireString(args, "dao"), args.get("id"));
      case "dao_getOf"  -> daoGetOf(x, requireString(args, "dao"));
      default -> throw new MCPError(-32602, "Unknown tool: " + name);
    };

    return toolResult(result);
  }


  // ─── Tool Implementations ─────────────────────────────────────────────────────

  /** Select from a DAO with optional AQL query, pagination, and sink. */
  protected Object daoSelect(X x, String daoName, Map<String,Object> args) {
    DAO dao = requireDAO(x, daoName);

    // AQL query → MLang predicate
    String query = (String) args.get("query");
    if ( query != null && ! query.trim().isEmpty() ) {
      Predicate predicate = parseAQL(x, dao.getOf(), query);
      dao = dao.where(predicate);
    }

    // OrderBy
    Object orderBySpec = args.get("orderBy");
    if ( orderBySpec != null ) {
      FObject comparator = jsonToFObject(x, asMap(orderBySpec));
      if ( comparator instanceof foam.mlang.order.Comparator ) {
        dao = dao.orderBy((foam.mlang.order.Comparator) comparator);
      }
    }

    // Pagination
    int skip  = args.containsKey("skip")  ? ((Number) args.get("skip")).intValue()  : 0;
    int limit = args.containsKey("limit") ? ((Number) args.get("limit")).intValue() : DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);
    dao = dao.skip(skip).limit(limit);

    // Sink: custom JSON sink or default ArraySink
    Sink sink = buildSink(x, args.get("sink"));
    sink = (Sink) dao.select(sink);

    // Format result based on sink type
    return formatSinkResult(x, sink, skip, limit);
  }

  /** Find a single object by primary key. */
  protected Object daoFind(X x, String daoName, Object id) {
    DAO    dao = requireDAO(x, daoName);
    Object obj = dao.find(parseId(dao, id));
    if ( obj == null ) throw new MCPError(-32602, "Not found: " + id + " in " + daoName);
    return fObjectToJSON(x, (FObject) obj);
  }

  /** Create or update an object. */
  protected Object daoPut(X x, String daoName, Map<String,Object> objectData) {
    DAO     dao    = requireDAO(x, daoName);
    FObject obj    = jsonToFObject(x, objectData);
    if ( obj == null ) {
      throw new MCPError(-32602,
        "Could not parse object. Ensure 'class' is set to: " + dao.getOf().getId());
    }
    FObject result = dao.put(obj);
    return fObjectToJSON(x, result);
  }

  /** Remove an object by primary key. */
  protected Object daoRemove(X x, String daoName, Object id) {
    DAO    dao = requireDAO(x, daoName);
    FObject obj = dao.find(parseId(dao, id));
    if ( obj == null ) throw new MCPError(-32602, "Not found: " + id + " in " + daoName);
    dao.remove(obj);
    return Map.of("removed", true, "id", String.valueOf(id));
  }

  /**
   * Return the model schema for a DAO's getOf().
   * This is how the MCP client learns what properties a DAO holds,
   * what types they are, and how to construct valid queries and objects.
   */
  protected Map<String,Object> daoGetOf(X x, String daoName) {
    DAO       dao = requireDAO(x, daoName);
    ClassInfo of  = dao.getOf();

    Map<String,Object> schema = new LinkedHashMap<>();
    schema.put("class", of.getId());
    //    schema.put("label", of.getLabel());

    List<Map<String,Object>> props = new ArrayList<>();
    List axioms = of.getAxiomsByClass(PropertyInfo.class);

    for ( Object axiom : axioms ) {
      PropertyInfo prop = (PropertyInfo) axiom;
      Map<String,Object> p = new LinkedHashMap<>();
      p.put("name",  prop.getName());
      p.put("type",  prop.getValueClass().getSimpleName());
      //      p.put("label", prop.getLabel());

      if ( prop.getRequired() )                                     p.put("required", true);
      //      if ( prop.getHelp() != null && ! prop.getHelp().isEmpty() )   p.put("help", prop.getHelp());

      // TODO: Enum values for enum-typed properties
      // TODO: Relationship targets for Reference properties (targetDAOKey)

      props.add(p);
    }
    schema.put("properties", props);

    return schema;
  }


  // ─── Sink Building ────────────────────────────────────────────────────────────

  /** Build a Sink from optional JSON spec, defaulting to ArraySink. */
  protected Sink buildSink(X x, Object sinkSpec) {
    if ( sinkSpec == null ) return new ArraySink();

    // Parse the sink JSON through FOAM's parser — it handles the 'class' property
    // to instantiate the correct Sink type (Count, GroupBy, etc.)
    FObject sink = jsonToFObject(x, asMap(sinkSpec));
    if ( sink instanceof Sink ) return (Sink) sink;

    throw new MCPError(-32602, "Invalid sink specification");
  }

  /** Format sink results depending on type. */
  protected Object formatSinkResult(X x, Sink sink, int skip, int limit) {
    Map<String,Object> response = new LinkedHashMap<>();

    if ( sink instanceof ArraySink ) {
      ArraySink as = (ArraySink) sink;
      List<Object> results = new ArrayList<>();
      for ( Object obj : as.getArray() ) {
        try {
          results.add(new RawJson(fObjectToJSON(x, (FObject) obj)));
        } catch ( Throwable t ) {
          Logger logger = (Logger) x.get("logger");
          logger.warning("MCPWebAgent", "serialization failed for", obj.getClass().getName(), t.getMessage());
        }
      }
      response.put("results", results);
      response.put("count",   results.size());
      response.put("skip",    skip);
      response.put("limit",   limit);
    } else {
      // For aggregation sinks (Count, GroupBy, etc.), serialize the whole sink
      response.put("result", new RawJson(fObjectToJSON(x, (FObject) sink)));
    }

    return response;
  }


  // ─── AQL Parsing ──────────────────────────────────────────────────────────────

  /** Parse an AQL query string into an MLang predicate. */
  protected Predicate parseAQL(X x, ClassInfo of, String query) {
    try {
      // TODO: Wire to FOAM's AQL parser
      // return AQLParser.parse(x, of, query);
      throw new UnsupportedOperationException("AQL parser not yet wired");
    } catch (Throwable t) {
      throw new MCPError(-32602, "Invalid AQL query: " + query + " — " + t.getMessage());
    }
  }


  // ─── DAO Utilities ────────────────────────────────────────────────────────────

  protected DAO requireDAO(X x, String name) {
    Object svc = x.get(name);
    if ( svc instanceof DAO ) return (DAO) svc;
    throw new MCPError(-32602, "DAO not found: " + name);
  }

  /** Parse an ID string using the DAO's primary key property. */
  protected Object parseId(DAO dao, Object id) {
    if ( id == null ) return null;
    PropertyInfo idProp = (PropertyInfo) dao.getOf().getAxiomByName("id");
    return idProp.fromString(String.valueOf(id));
  }

  /** Coerce a string ID to the type expected by the DAO's primary key. */
  protected Object coerceId(DAO dao, Object id) {
    if ( id == null ) return null;
    String s = String.valueOf(id);
    // TODO: Inspect dao.getOf()'s id property type for proper coercion
    try { return Long.parseLong(s); } catch ( NumberFormatException e ) {}
    return s;
  }


  // ─── JSON Serialization ───────────────────────────────────────────────────────

  /** Serialize an FObject to its JSON representation, including default values. */
  protected String fObjectToJSON(X x, FObject obj) {
    JSONFObjectFormatter fmt = new JSONFObjectFormatter();
    fmt.setX(x);
    fmt.setOutputDefaultValues(true);
    fmt.setQuoteKeys(true);
    fmt.output(obj, null);
    return fmt.builder().toString();
  }

  /** Parse JSON into an FObject via FOAM's JSONParser. */
  protected FObject jsonToFObject(X x, Map<String,Object> data) {
    String json = mapToJSONString(data);
    JSONParser parser = new JSONParser();
    parser.setX(x);
    return (FObject) parser.parseString(json);
  }


  // ─── JSON-RPC Helpers ─────────────────────────────────────────────────────────

  protected static Map<String,Object> tool(String name, String desc, Map<String,Object> schema) {
    return Map.of("name", name, "description", desc, "inputSchema", schema);
  }

  protected Map<String,Object> toolResult(Object content) {
    String text = (content instanceof String) ? (String) content : mapToJSONString(content);
    return Map.of("content", List.of(Map.of("type", "text", "text", text)));
  }

  protected void writeResult(PrintWriter out, Object id, Object result) {
    out.print(mapToJSONString(Map.of("jsonrpc", "2.0", "id", id, "result", result)));
    out.flush();
  }

  protected void writeError(PrintWriter out, Object id, int code, String message) {
    out.print(mapToJSONString(Map.of(
      "jsonrpc", "2.0",
      "id",      id != null ? id : "Unknown Id",
      "error",   Map.of("code", code, "message", message != null ? message : "Internal error")
    )));
    out.flush();
  }


  // ─── I/O Utilities ────────────────────────────────────────────────────────────

  protected String readBody(HttpServletRequest req) throws IOException {
    StringBuilder sb = new StringBuilder();
    try ( BufferedReader reader = req.getReader() ) {
      char[] buf = new char[4096];
      int n;
      while ( (n = reader.read(buf)) != -1 ) sb.append(buf, 0, n);
    }
    return sb.toString();
  }

  @SuppressWarnings("unchecked")
  protected Map<String,Object> parseJSON(X x, String json) {
    try {
      Object result = MAPPER.readValue(json, Object.class);
      if ( result instanceof Map ) return (Map<String,Object>) result;
      throw new MCPError(-32700, "Parse error: expected JSON object");
    } catch (MCPError e) {
      throw e;
    } catch (Throwable t) {
      throw new MCPError(-32700, "Parse error: " + t.getMessage());
    }
  }

  protected String mapToJSONString(Object obj) {
    StringBuilder sb = new StringBuilder();
    writeJSON(sb, obj);
    return sb.toString();
  }

  @SuppressWarnings("unchecked")
  protected void writeJSON(StringBuilder sb, Object obj) {
    if      ( obj == null )             sb.append("null");
    else if ( obj instanceof RawJson )  sb.append(((RawJson) obj).json);
    else if ( obj instanceof Map )    { writeJSONMap(sb, (Map<String,Object>) obj); }
    else if ( obj instanceof List )   { writeJSONList(sb, (List<?>) obj); }
    else if ( obj instanceof String )   sb.append('"').append(escapeJSON((String) obj)).append('"');
    else if ( obj instanceof Boolean || obj instanceof Number ) sb.append(obj);
    else                                sb.append('"').append(escapeJSON(obj.toString())).append('"');
  }

  private void writeJSONMap(StringBuilder sb, Map<String,Object> map) {
    sb.append('{');
    boolean first = true;
    for ( Map.Entry<String,Object> e : map.entrySet() ) {
      if ( ! first ) sb.append(',');
      first = false;
      sb.append('"').append(escapeJSON(e.getKey())).append("\":");
      writeJSON(sb, e.getValue());
    }
    sb.append('}');
  }

  private void writeJSONList(StringBuilder sb, List<?> list) {
    sb.append('[');
    boolean first = true;
    for ( Object item : list ) {
      if ( ! first ) sb.append(',');
      first = false;
      writeJSON(sb, item);
    }
    sb.append(']');
  }

  protected String escapeJSON(String s) {
    return s.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
  }

  @SuppressWarnings("unchecked")
  protected Map<String,Object> asMap(Object obj) {
    return obj instanceof Map ? (Map<String,Object>) obj : Map.of();
  }

  protected String requireString(Map<String,Object> map, String key) {
    Object val = map.get(key);
    if ( val instanceof String s && ! s.isEmpty() ) return s;
    throw new MCPError(-32602, "Missing required parameter: " + key);
  }

  // ─── Error Type ───────────────────────────────────────────────────────────────

  static class MCPError extends RuntimeException {
    int code;
    MCPError(int code, String message) { super(message); this.code = code; }
  }

  static class RawJson {
    final String json;
    RawJson(String json) { this.json = json; }
  }
}

/*

  // TODO: help text is not available in the JAVA PropertyInfo

  Set session CIDR Whitelist

  Sample .claude.json configuration:

        "my-mcp-server": {
          "type": "http",
          "url": "http://localhost:8080/service/mcp",
          "headers": {
            "Authorization": "Bearer c1f1406e-bdee-4a2a-8697-56eef2cxxxxxlocalhost:8080"
          }
        }
*/
