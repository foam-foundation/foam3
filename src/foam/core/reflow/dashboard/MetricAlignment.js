/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow.dashboard',
  name: 'MetricAlignment',
  
  documentation: 'Alignment options for metric display',

  properties: [
    {
      class: 'String',
      name: 'alignmentStyle'
    },
    {
      class: 'String',
      name: 'textAlign'
    }
  ],
  
  values: [
    {
      name: 'LEFT',
      label: 'Left',
      alignmentStyle: 'flex-start',
      textAlign: 'left'
    },
    {
      name: 'CENTER', 
      label: 'Center',
      alignmentStyle: 'center',
      textAlign: 'center'
    },
    {
      name: 'RIGHT',
      label: 'Right',
      alignmentStyle: 'flex-end',
      textAlign: 'right'
    }
  ]
});