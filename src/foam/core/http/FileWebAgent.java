package foam.core.http;

import foam.lang.X;
import foam.core.boot.CSpec;
import foam.core.boot.CSpecAware;
import foam.util.SafetyUtil;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.text.StringEscapeUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.util.HashMap;

public class FileWebAgent
  implements WebAgent, CSpecAware
{
  protected static final int                     BUFFER_SIZE = 4096;
  protected static final String                  DEFAULT_EXT = "application/octet-stream";
  protected static final HashMap<String, String> EXTS        = new HashMap<>();

  static {
    EXTS.put("js",    "application/javascript");
    EXTS.put("json",  "application/json");
    EXTS.put("class", "application/java-vm");
    EXTS.put("xml",   "application/xml");

    EXTS.put("gif",   "image/gif");
    EXTS.put("png",   "image/png");
    EXTS.put("svg",   "image/svg+xml");

    EXTS.put("java",  "text/x-java-source");
    EXTS.put("csv",   "text/csv");
    EXTS.put("txt",   "text/plain");
    EXTS.put("html",  "text/html");
  }

  protected CSpec  nspec_;
  protected String path_;
  protected String cwd_;

  public FileWebAgent() {
    this("");
  }

  public FileWebAgent(String path) {
    this(path, System.getProperty("user.dir"));
  }

  public FileWebAgent(String path, String cwd) {
    this.path_ = path;
    this.cwd_  = cwd;
  }

  @Override
  public void execute(X x) {
    HttpServletRequest  req  = x.get(HttpServletRequest.class);
    HttpServletResponse resp = x.get(HttpServletResponse.class);
    String              path = null;

    try {
      path = req.getRequestURI().replaceFirst("/?service/" + nspec_.getName() + "/?", "") + path_;
      File cwdFile = new File(SafetyUtil.isEmpty(cwd_) ? System.getProperty("user.dir") : cwd_).getCanonicalFile();
      File src = new File(cwdFile, SafetyUtil.isEmpty(path) ? "./" : path).getCanonicalFile();

      // Ensure that the canonical path stays within cwd to prevent path escaping
      if ( ! src.toPath().startsWith(cwdFile.toPath()) ) {
        throw new FileNotFoundException("File not found: " + path);
      }

      // handle reading of directories
      if ( src.isDirectory() && src.canRead() ) {
        PrintWriter pw = x.get(PrintWriter.class);
        resp.setContentType(EXTS.get("html"));
        pw.write(
            "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<body>\n" +
                "<ul style=\"list-style-type:disc\">");

        File[] files = src.listFiles();
        if ( files != null ) {
          for ( File file : files ) {
            String escapedName = StringEscapeUtils.escapeHtml4(file.getName());
            pw.write("<li>" + "<a href=\"/service/" + StringEscapeUtils.escapeHtml4(nspec_.getName()) + "/" + StringEscapeUtils.escapeHtml4(path)
                + ( ! path.isEmpty() && ! path.endsWith("/") ? "/" : "" )
                + escapedName + "\">" + escapedName + "</a></li>");
          }
        }

        pw.write("</ul></body></html>");
        return;
      }

      // handle reading of files
      if ( src.isFile() && src.canRead() ) {
        String ext = EXTS.get(FilenameUtils.getExtension(src.getName()));
        resp.setContentType(! SafetyUtil.isEmpty(ext) ? ext : DEFAULT_EXT);
        resp.setHeader("Content-Disposition", "filename=\"" + StringEscapeUtils.escapeHtml4(src.getName()) + "\"");
        resp.setContentLengthLong(src.length());

        int read = 0;
        byte[] buffer = new byte[BUFFER_SIZE];
        try (BufferedInputStream is = new BufferedInputStream(new FileInputStream(src))) {
        	while ( (read = is.read(buffer, 0, BUFFER_SIZE)) != -1 ) {
            resp.getOutputStream().write(buffer, 0, read);
          }
        }
        return;
      }

      // file not found
      throw new FileNotFoundException("File not found: " + path);
    } catch (Throwable t) {
      t.printStackTrace();
      resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
      resp.setContentType(EXTS.get("json"));
      PrintWriter pw = x.get(PrintWriter.class);
      pw.write("{\"error\": \"File not found\"," + "\"filename\": \"" + StringEscapeUtils.escapeJson(path) + "\"}");
    }
  }

  @Override
  public CSpec getCSpec() {
    return this.nspec_;
  }

  @Override
  public void setCSpec(CSpec spec) {
    this.nspec_ = spec;
  }

  @Override
  public void clearCSpec() {
    this.nspec_ = null;
  }
}
