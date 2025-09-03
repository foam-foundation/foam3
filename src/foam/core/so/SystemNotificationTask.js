/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
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
  package: 'foam.core.so',
  name: 'SystemNotificationTask',
  extends: 'foam.core.so.SystemOutageTask',

  documentation: 'Task for managing SystemNotification display',

  implements: ['foam.core.auth.EnabledAware'],

  javaImports: [
    'foam.lang.X'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.so.SystemNotification',
      name: 'systemNotification',
    },
    {
      documentation: 'Optionally filter display to particular themes',
      class: 'StringArray',
      name: 'themes',
      view: {
        class: 'foam.u2.view.ReferenceArrayView',
        daoKey: 'themeDAO',
        allowDuplicates: false
      }
    },
    {
      documentation: 'Optionally filter display to particular users via permissions',
      class: 'StringArray',
      name: 'permissions',
      // Not all permissions and capabilities are in the permission dao.
      // view: {
      //   class: 'foam.u2.view.ReferenceArrayView',
      //   daoKey: 'permissionDAO',
      //   allowDuplicates: false
      // }
    },
    {
      documentation: `Restrict visibility of this notification to particular IP address range.
@see https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing
List entries are of the form: 172.0.0.0/24 - this would restrict visibility to the 172 network.`,
      class: 'FObjectArray',
      of: 'foam.net.CIDR',
      name: 'cidrWhiteList'
    },
    {
      name: 'enabled',
      value: true
    }
  ],

  methods: [
    {
      name: 'activate',
      javaCode: `
      // nop
      `
    },
    {
      name: 'deactivate',
      javaCode: `
      // nop
      `
    }
  ]
});

