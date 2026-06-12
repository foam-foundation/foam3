/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'DeDupDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'java.util.List'
  ],

  documentation: `
    DeDupDAO is a decorator that internalizes strings in put() objects to save memory.
    Useful for indexed or cached data.
    <p>
    Use a foam.dao.EasyDAO with dedup:true to automatically apply deduplication.
   `,

  methods: [
    {
      name: 'put_',
      code: function(x, obj) {
        this.dedup(obj);
        return this.delegate.put_(x, obj);
      },
      javaCode: `
        dedup(obj);
        return getDelegate().put_(x, obj);
      `
    },
    {
      name: 'dedup',
      args: [
        {
          name: 'obj',
          type: 'FObject'
        }
      ],
      code: function(obj) {
        var inst = obj.instance_;
        for ( var key in inst ) {
          var val = inst[key];
          if ( typeof val === 'string' ) {
            inst[key] = foam.String.intern(val);
          }
        }
      },
      javaCode: `
        if ( obj == null ) return;

        List<PropertyInfo> props = obj.getClassInfo().getAxiomsByClass(PropertyInfo.class);
        for ( PropertyInfo prop : props ) {
          if ( ! prop.isSet(obj) ) continue;

          Object val = prop.get(obj);
          if ( val instanceof String ) {
            prop.set(obj, ((String) val).intern());
          }
        }
      `
    }
  ]
});
