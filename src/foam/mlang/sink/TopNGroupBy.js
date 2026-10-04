/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'TopNGroupBy',
  extends: 'foam.mlang.sink.GroupBy',

  documentation: 'GroupBy sink that keeps only top N groups, aggregating others. works with only value-based grouping. (min, max, sum, avg, count)',

  requires: [
    'foam.mlang.sink.GroupBySortOrder'
  ],

  properties: [
    {
      class: 'Int',
      name: 'topN',
      value: 0,
      documentation: 'Number of top groups to keep'
    },
    {
      class: 'Enum',
      of: 'foam.mlang.sink.GroupBySortOrder',
      name: 'sortOrder',
      value: 'DESC',
      documentation: 'Sort order for value-based limiting'
    },
    {
      class: 'String',
      name: 'othersLabel',
      value: 'Others',
      documentation: 'Label for the aggregated "Others" category'
    },
    {
      class: 'Boolean',
      name: 'includeOthers',
      value: true,
      documentation: 'Whether to include "Others" group for remaining items'
    }
  ],

  static: [
    {
      name: 'isSupported',
      args: 'foam.dao.Sink sink',
      type: 'boolean',
      code: function isSupported(sink) {
        return foam.mlang.sink.Sum.isInstance(sink) ||
                foam.mlang.sink.Average.isInstance(sink) ||
               foam.mlang.sink.Count.isInstance(sink) ||
               foam.mlang.sink.Min.isInstance(sink) ||
               foam.mlang.sink.Max.isInstance(sink);
      },
      javaCode: `
return (sink instanceof foam.mlang.sink.Sum) ||
       (sink instanceof foam.mlang.sink.Average) ||
       (sink instanceof foam.mlang.sink.Count) ||
       (sink instanceof foam.mlang.sink.Min) ||
       (sink instanceof foam.mlang.sink.Max);
      `
    }
  ],

  methods: [
    {
      name: 'eof',
      code: function eof() {
        if ( this.topN === 0 ){
          return;
        }
        // Check if the sink type is supported by TopNGroupBy
        if ( ! this.cls_.isSupported(this.arg2) ) {
          throw new Error('TopNGroupBy does not support sink type: ' + this.arg2.cls_.name);
        }

        /// get the top groups based on this.sortOrder and their values
        var allGroupEntries = Object.entries(this.groups);
        if ( this.sortOrder === this.GroupBySortOrder.DESC ) {
          allGroupEntries.sort((a, b) => b[1].value - a[1].value);
        } else {
          allGroupEntries.sort((a, b) => a[1].value - b[1].value);
        }
        
        var topNGroups = allGroupEntries.slice(0, this.topN);
        var remainingGroups = allGroupEntries.slice(this.topN);
        
        // Replace groups with only top N (no Others if includeOthers is false)
        if ( ! this.includeOthers || remainingGroups.length === 0 ) {
          var newGroups = {};
          topNGroups.forEach(function(entry) {
            newGroups[entry[0]] = entry[1];
          });
          this.groups = newGroups;
          // Set groupKeys to preserve order (JavaScript reorders numeric string keys)
          this.groupKeys = topNGroups.map(function(entry) { return entry[0]; });
          return;
        }
        
        // Create the "Others" group if there are any remaining groups and includeOthers is true
        if ( remainingGroups.length > 0 && this.includeOthers ) {
          /// now we will reduce all of the other groups into our "othersLabel" group
          var othersGroup = remainingGroups[0][1]; // Start with first remaining group
          
          // Reduce all other remaining groups into the first one
          for ( var i = 1; i < remainingGroups.length; i++ ) {
            var currentGroup = remainingGroups[i][1];
            // Use Reducible interface - all supported sinks implement it
            if ( foam.mlang.sink.Reducible.isInstance(othersGroup) ) {
              othersGroup.reduce(currentGroup);
            }
          }
          
          // Replace groups with only top N plus Others (Others last)
          var newGroups = {};
          // First add all top N groups
          topNGroups.forEach(function(entry) {
            newGroups[entry[0]] = entry[1];
          });
          // Then add Others group last
          newGroups[this.othersLabel] = othersGroup;
          
          this.groups = newGroups;
          // Set groupKeys to preserve order (JavaScript reorders numeric string keys)
          var orderedKeys = topNGroups.map(function(entry) { return entry[0]; });
          orderedKeys.push(this.othersLabel);
          this.groupKeys = orderedKeys;
        }
        
      },
      javaCode: `
if (getTopN() == 0) return;

// Check if the sink type is supported by TopNGroupBy
if (!isSupported(getArg2())) {
  throw new RuntimeException("TopNGroupBy does not support sink type: " + getArg2().getClass().getSimpleName());
}

// Get all group entries and sort them
java.util.List<java.util.Map.Entry<Object, foam.dao.Sink>> allEntries = 
    new java.util.ArrayList<>(getGroups().entrySet());

if (getSortOrder() == foam.mlang.sink.GroupBySortOrder.DESC) {
  allEntries.sort((a, b) -> {
    double aVal = getSinkValue(a.getValue());
    double bVal = getSinkValue(b.getValue());
    return Double.compare(bVal, aVal); // DESC
  });
} else {
  allEntries.sort((a, b) -> {
    double aVal = getSinkValue(a.getValue());
    double bVal = getSinkValue(b.getValue());
    return Double.compare(aVal, bVal); // ASC
  });
}



// Get top N and remaining groups
java.util.List<java.util.Map.Entry<Object, foam.dao.Sink>> topNGroups = 
    allEntries.subList(0, Math.min(getTopN(), allEntries.size()));
java.util.List<java.util.Map.Entry<Object, foam.dao.Sink>> remainingGroups = 
    allEntries.subList(Math.min(getTopN(), allEntries.size()), allEntries.size());

// Create "Others" group if there are remaining groups and includeOthers is true
if (remainingGroups.size() > 0 && getIncludeOthers()) {
  foam.dao.Sink othersGroup = remainingGroups.get(0).getValue();
  
  // Reduce all other remaining groups into the first one
  for (int i = 1; i < remainingGroups.size(); i++) {
    foam.dao.Sink currentGroup = remainingGroups.get(i).getValue();
    
    // Use Reducible interface - all supported sinks implement it
    if (othersGroup instanceof foam.mlang.sink.Reducible && currentGroup instanceof foam.mlang.sink.Reducible) {
      ((foam.mlang.sink.Reducible) othersGroup).reduce((foam.mlang.sink.Reducible) currentGroup);
    }
  }
  
  // Replace groups with only top N plus Others (Others last)
  java.util.Map<Object, foam.dao.Sink> newGroups = new java.util.LinkedHashMap<>();
  // First add all top N groups
  for (java.util.Map.Entry<Object, foam.dao.Sink> entry : topNGroups) {
    newGroups.put(entry.getKey(), entry.getValue());
  }
  // Then add Others group last
  newGroups.put(getOthersLabel(), othersGroup);
  
  setGroups(newGroups);
  
  // Set groupKeys to maintain order: top N groups first, then Others
  java.util.List<Object> orderedKeys = new java.util.ArrayList<>();
  for (java.util.Map.Entry<Object, foam.dao.Sink> entry : topNGroups) {
    orderedKeys.add(entry.getKey());
  }
  orderedKeys.add(getOthersLabel());
  setGroupKeys(orderedKeys);
} else {
  // Just use top N groups without Others
  java.util.Map<Object, foam.dao.Sink> newGroups = new java.util.LinkedHashMap<>();
  for (java.util.Map.Entry<Object, foam.dao.Sink> entry : topNGroups) {
    newGroups.put(entry.getKey(), entry.getValue());
  }
  setGroups(newGroups);
  
  // Set groupKeys to maintain order: top N groups only
  java.util.List<Object> orderedKeys = new java.util.ArrayList<>();
  for (java.util.Map.Entry<Object, foam.dao.Sink> entry : topNGroups) {
    orderedKeys.add(entry.getKey());
  }
  setGroupKeys(orderedKeys);
}
      `
    },


    {
      name: 'getSinkValue',
      args: 'foam.dao.Sink sink',
      type: 'double',
      javaCode: `
if (sink instanceof foam.mlang.sink.Sum) {
  return ((foam.mlang.sink.Sum) sink).getValue();
} else if (sink instanceof foam.mlang.sink.Average) {
  return ((foam.mlang.sink.Average) sink).getValue();
} else if (sink instanceof foam.mlang.sink.Count) {
  return ((foam.mlang.sink.Count) sink).getValue();
} else if (sink instanceof foam.mlang.sink.Min) {
  Object val = ((foam.mlang.sink.Min) sink).getValue();
  return val instanceof Number ? ((Number) val).doubleValue() : 0.0;
} else if (sink instanceof foam.mlang.sink.Max) {
  Object val = ((foam.mlang.sink.Max) sink).getValue();
  return val instanceof Number ? ((Number) val).doubleValue() : 0.0;
}
return 0.0;
      `
    },
    {
      name: 'toString',
      code: function toString() {
        return 'TopNGroupBy(' + this.arg1 + ',' + this.arg2.toString() + ',' + this.groupLimit + ',' + this.topN + ',' + this.sortOrder + ',' + this.includeOthers + ',' + this.othersLabel + ')';
      },
      javaCode: 'return this.getGroups().toString();'
    },
  ]
});