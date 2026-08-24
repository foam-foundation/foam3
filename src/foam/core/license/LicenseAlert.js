/**
* PAYTIC CONFIDENTIAL
*
* [2026] Paytic Inc.
* All Rights Reserved.
*
* NOTICE:  All information contained herein is, and remains
* the property of Paytic Inc.
* The intellectual and technical concepts contained
* herein are proprietary to Paytic Inc
* and may be covered by Canadian and Foreign Patents, patents
* in process, and are protected by trade secret or copyright law.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Paytic Inc.
*/

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseAlert',
  extends: 'foam.core.notification.Notification',

  properties: [
    {
      class: 'String',
      name: 'clientName'
    },
    {
      class: 'String',
      name: 'spid'
    },
    {
      class: 'String',
      name: 'daoKey'
    }
  ]
});