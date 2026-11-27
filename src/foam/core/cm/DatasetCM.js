/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cm',
  name: 'DatasetCM',
  extends: 'foam.core.cm.CM',
  documentation: `
    Holds chart-shaped results: x-axis labels and one series of values per key.
  `,

  javaImports: [
    'java.util.Map.Entry',
    'java.util.Map',
    'java.util.List'
  ],

  properties: [
    {
      class: 'List',
      name: 'labels',
      javaType: 'java.util.List<String>',
      documentation: 'xAxis key',
      storageTransient: true,
      visibility: 'HIDDEN',
      javaFactory: `
        return new java.util.ArrayList<String>();
      `
    },
    {
      class: 'Map',
      name: 'dataset',
      documentation: 'yAxis keys and data',
      storageTransient: true,
      javaType: 'java.util.Map<String, foam.core.cm.DatasetCMItem>',
      visibility: 'HIDDEN',
      javaFactory: `
        return new java.util.HashMap<String, foam.core.cm.DatasetCMItem>();
      `
    }
  ],

  methods: [
    {
      name: 'generateSummaryResult',
      type: 'String',
      javaCode: `
        var ret = "";
        for ( Map.Entry<String, foam.core.cm.DatasetCMItem> e: getDataset().entrySet() ) {
          var key = e.getKey();
          var values = e.getValue().getValues();

          for ( int i = 0 ; i < values.size() && i < getLabels().size() ; i++ ) {
            ret += key + "-" + getLabels().get(i) + ": " + values.get(i) + ", ";
          }
        }
        return ret;
      `
    },
    {
      name: 'clear',
      javaCode: `
        clearResult();
        clearLabels();
        clearDataset();
      `
    },
    {
      name: 'addLabel',
      args: 'String label',
      javaCode: `
        getLabels().add(label);
      `
    },
    {
      name: 'addDataPoint',
      args: 'String key, Double value',
      javaCode: `
        var r = getDataset().getOrDefault(key, new DatasetCMItem());
        r.getValues().add(value);
        getDataset().put(key, r);
      `
    }
  ]
})