/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

/**
 * Implemented by the generated PropertyInfo of Reference properties so the
 * target DAO key is queryable at runtime — e.g. partition reference migration
 * discovering which models hold references to a migrated DAO.
 */
public interface ReferencePropertyInfo {
  String getTargetDAOKey();
}
