/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'FileDAODecorator',
  extends: 'foam.dao.AbstractDAODecorator',

  imports: [
    'fileDAO?'
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'Long',
      name: 'maxStringDataSize',
      value: 1024 * 3
    }
  ],

  methods: [
    function write(X, dao, obj, existing) {
      if ( ! this.fileDAO ) return this.SUPER(X, dao, obj, existing);

      var self = this;
      var i = 0;

      // FileDAODecorator explicitly extracts File properties from 'obj' to send to a separate file storage service (fileDAO).
      // These transient File properties on 'obj' are client-side only and generally for UI/UX purposes. There is no need to
      // save it to fileDAO.
      var props = obj.cls_.getAxiomsByClass(foam.core.fs.FileProperty);
      props = props.filter(p => ! ( p.transient || p.networkTransient || p.storageTransient ));

      // clone the object if we need to update the file properties
      if ( props.length > 0 ) obj = obj.clone();

      return Promise.resolve().then(async function a() {
        var prop = props[i++];

        if ( ! prop ) return obj;

        var file = prop.f(obj);

        if ( ! file ) return a();

        // We do not allow file update, so there is no point to send file again
        // if it is already stored and has id
        if ( file.id ) return obj;

        if ( file.filesize <= self.maxStringDataSize ) {
          file.dataString = await self.encode(file.data.blob);
          file.instance_.data = undefined;
        } else {
          file.dataString = undefined;
        }
        return self.fileDAO.put(file).then(function (b) {
          prop.set(obj, b);
          return a();
        });
      });
    },

    async function encode(file) {
      const toBase64 = file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
      });
      return await toBase64(file);
    },
  ]
});
