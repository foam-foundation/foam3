/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'OrderedSink',
  extends: 'foam.dao.ProxySink',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.order.Comparator',
      required: true,
      name: 'comparator'
    },
    {
      class: 'List',
      name: 'array',
      factory: function() { return []; }
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        this.array.push(obj);
      },
      swiftCode: 'array.append(obj)',
      javaCode: `
        if ( getArray() == null ) setArray(new java.util.ArrayList());
        getArray().add(obj);
      `
    },
    {
      name: 'eof',
      code: function eof() {
        var comparator = this.comparator;
        this.array.sort(function(o1, o2) {
          return comparator.compare(o1, o2);
        });

        var sub = foam.lang.FObject.create();
        var detached = false;
        sub.onDetach(function() { detached = true; });
        for ( var i = 0 ; i < this.array.length ; i++ ) {
          this.delegate.put(this.array[i], sub);
          if ( detached ) break;
        }
      },
      swiftCode: `array.sort(by: {
  return comparator.compare($0, $1) < 0
});

var detached = false
let sub = Subscription { detached = true }
for obj in array {
  delegate.put(obj as! foam_core_FObject, sub)
  if detached { break }
}`,
      javaCode: `
      if ( getArray() == null ) setArray(new java.util.ArrayList());

      java.util.Collections.sort(getArray(), getComparator());

      foam.dao.Subscription sub = new foam.dao.Subscription();
      for ( Object o : getArray() ) {
        if ( sub.getDetached() ) break;
        getDelegate().put(o, sub);
      }`
    },
    {
      name: 'remove',
      code: function remove(obj, sub) {
        // TODO
      },
      swiftCode: '// TODO',
      javaCode: '// TODO'
    }
  ]
});
