/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.jdbc;

import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.Indexer;
import foam.lang.PropertyInfo;
import foam.lang.X;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;
import foam.core.logger.Logger;
import java.sql.*;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

// TODO: Create AbstractJDBCDAO baseclass
public class PostgresDAO
  extends AbstractJDBCDAO
{
  protected ThreadLocal<StringBuilder> sb = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }

    @Override
    public StringBuilder get() {
      StringBuilder b = super.get();
      b.setLength(0);
      return b;
    }
  };

  public PostgresDAO(X x, ClassInfo of)
    throws java.sql.SQLException, ClassNotFoundException
  {
    super(x, of);
  }

  public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    sink = prepareSink(sink);

    Connection               c         = null;
    IndexedPreparedStatement stmt      = null;
    ResultSet                resultSet = null;

    try {
      c = dataSource_.getConnection();

      StringBuilder builder = sb.get()
        .append("select * from ")
        .append(tableName_);

      if ( predicate != null ) {
        builder.append(" where ").append(predicate.createStatement());
      }

      if ( order != null ) {
        builder.append(" order by ").append(order.createStatement());
      }

      if ( limit > 0 && limit < this.MAX_SAFE_INTEGER ) {
        builder.append(" limit ").append(limit);
      }

      if ( skip > 0 && skip < this.MAX_SAFE_INTEGER ) {
        builder.append(" offset ").append(skip);
      }

      stmt = new IndexedPreparedStatement(c.prepareStatement(builder.toString()));

      if ( predicate != null ) {
        predicate.prepareStatement(stmt);
      }

      resultSet = stmt.executeQuery();
      while ( resultSet.next() ) {
        sink.put(createFObject(resultSet), null);
      }

      return sink;
    } catch ( Throwable e ) {
      Logger logger = (Logger) x.get("logger");
      logger.error(e);
      return null;
    } finally {
      closeAllQuietly(resultSet, stmt);
      try {
        if ( c != null ) c.close();
      } catch ( SQLException e ) {
        Logger logger = (Logger) x.get("logger");
        logger.error(e);
      }
    }
  }

  @Override
  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
    Connection               c    = null;
    IndexedPreparedStatement stmt = null;

    try {
      c = dataSource_.getConnection();
      StringBuilder builder = sb.get();

      if ( order == null && ( skip <= 0 || skip >= MAX_SAFE_INTEGER ) && ( limit <= 0 || limit >= MAX_SAFE_INTEGER ) ) {
        builder.append("delete from ").append(tableName_);

        if ( predicate != null ) {
          builder.append(" where ").append(predicate.createStatement());
        }
      } else {
        String pk = getPrimaryKey().createStatement();
        builder.append("delete from ").append(tableName_)
          .append(" where ").append(pk)
          .append(" in (select ").append(pk)
          .append(" from ").append(tableName_);

        if ( predicate != null ) {
          builder.append(" where ").append(predicate.createStatement());
        }
        if ( order != null ) {
          builder.append(" order by ").append(order.createStatement());
        }
        if ( limit > 0 && limit < MAX_SAFE_INTEGER ) {
          builder.append(" limit ").append(limit);
        }
        if ( skip > 0 && skip < MAX_SAFE_INTEGER ) {
          builder.append(" offset ").append(skip);
        }
        builder.append(')');
      }

      stmt = new IndexedPreparedStatement(c.prepareStatement(builder.toString()));

      if ( predicate != null ) {
        predicate.prepareStatement(stmt);
      }

      stmt.executeUpdate();
    } catch ( Throwable e ) {
      Logger logger = (Logger) x.get("logger");
      logger.error(e);
    } finally {
      closeAllQuietly(null, stmt);
      try {
        if ( c != null ) c.close();
      } catch ( SQLException e ) {
        Logger logger = (Logger) x.get("logger");
        logger.error(e);
      }
    }
  }

  @Override
  public FObject put_(X x, FObject obj) {
    Connection c = null;
    IndexedPreparedStatement stmt      = null;
    ResultSet resultSet = null;

    try {
      c = dataSource_.getConnection();
      StringBuilder builder = sb.get()
        .append("insert into ")
        .append(tableName_);

      buildFormattedColumnNames(obj, builder);
      builder.append(" values");
      buildFormattedColumnPlaceholders(obj, builder);
      builder.append(" on conflict (")
        .append(getPrimaryKey().createStatement())
        .append(") do update set");
      buildFormattedColumnNames(obj, builder);
      builder.append(" = ");
      buildFormattedColumnPlaceholders(obj, builder);

      stmt = new IndexedPreparedStatement(
        c.prepareStatement(
          builder.toString(),
          Statement.RETURN_GENERATED_KEYS));

      // set statement values twice: once for the insert and once for the update on conflict
      setStatementValues(stmt, obj);
      setStatementValues(stmt, obj);

      int inserted = stmt.executeUpdate();
      if ( inserted == 0 ) {
        throw new SQLException("Error performing put_ command");
      }

      // get auto-generated postgres keys
/*       resultSet = stmt.getGeneratedKeys();
      if ( resultSet.next() ) {
        obj.setProperty(getPrimaryKey().getName(), resultSet.getObject(1));
      } */

      return obj;
    } catch (Throwable e) {
      Logger logger = (Logger) x.get("logger");
      logger.error(e);
      return null;
    } finally {
      closeAllQuietly(resultSet, stmt);
      try {
        if ( c != null ) c.close();
      } catch ( SQLException e ) {
        Logger logger = (Logger) x.get("logger");
        logger.error(e);
      } 
    }
  }

  public void addIndex(X x,String indexName, boolean unique, Indexer... props) {
    if ( props == null || props.length == 0 ) return;

    Logger logger = (Logger) x.get("logger");
    Connection c = null;
    Statement stmt = null;

    try {
      c = dataSource_.getConnection();

      StringBuilder builder = sb.get();
      if ( unique ) {
        builder.append("create unique index if not exists ");
      } else {
        builder.append("create index if not exists ");
      }
      builder.append(indexName)
        .append(" on ")
        .append(tableName_);
      // do we need option to specify index type?
      // if ( type != null ) {
      //   builder.append(" using ").append(type.toString());
      // }
      builder.append('(');
      for ( int i = 0; i < props.length; i++ ) {
        if ( i > 0 ) builder.append(", ");
        builder.append(((PropertyInfo) props[i]).createStatement());
      }
      builder.append(')');

      stmt = c.createStatement();
      stmt.execute(builder.toString());
    } catch ( Throwable e ) {
      logger.error(e);
    } finally {
      try {
        if ( stmt != null ) stmt.close();
        if ( c != null ) c.close();
      } catch ( SQLException e ) {
        logger.error(e);
      }
    }
  }
}
