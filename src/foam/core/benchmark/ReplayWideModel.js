/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'ReplayWideModel',

  documentation: `Fifty properties across every common FOAM property type, all
    set on every row: the wide end of the replay benchmark model axis. Names
    and values are synthetic.`,

  properties: [
    { class: 'Long',     name: 'id' },
    { class: 'String',   name: 'token' },
    { class: 'String',   name: 's1'  },
    { class: 'String',   name: 's2'  },
    { class: 'String',   name: 's3'  },
    { class: 'String',   name: 's4'  },
    { class: 'String',   name: 's5'  },
    { class: 'String',   name: 's6'  },
    { class: 'String',   name: 's7'  },
    { class: 'String',   name: 's8'  },
    { class: 'String',   name: 's9'  },
    { class: 'String',   name: 's10' },
    { class: 'String',   name: 's11' },
    { class: 'String',   name: 's12' },
    { class: 'String',   name: 's13' },
    { class: 'String',   name: 's14' },
    { class: 'String',   name: 's15' },
    { class: 'String',   name: 's16' },
    { class: 'String',   name: 's17' },
    { class: 'String',   name: 's18' },
    { class: 'String',   name: 's19' },
    { class: 'String',   name: 's20' },
    { class: 'Double',   name: 'd1'  },
    { class: 'Double',   name: 'd2'  },
    { class: 'Double',   name: 'd3'  },
    { class: 'Double',   name: 'd4'  },
    { class: 'Double',   name: 'd5'  },
    { class: 'Double',   name: 'd6'  },
    { class: 'Double',   name: 'd7'  },
    { class: 'Double',   name: 'd8'  },
    { class: 'Double',   name: 'd9'  },
    { class: 'Double',   name: 'd10' },
    { class: 'Long',     name: 'l1'  },
    { class: 'Long',     name: 'l2'  },
    { class: 'Long',     name: 'l3'  },
    { class: 'Long',     name: 'l4'  },
    { class: 'Long',     name: 'l5'  },
    { class: 'Long',     name: 'l6'  },
    { class: 'DateTime', name: 't1'  },
    { class: 'DateTime', name: 't2'  },
    { class: 'Date',     name: 't3'  },
    { class: 'Date',     name: 't4'  },
    { class: 'Boolean',  name: 'b1'  },
    { class: 'Boolean',  name: 'b2'  },
    { class: 'Int',      name: 'i1'  },
    { class: 'Int',      name: 'i2'  },
    { class: 'Enum',     name: 'state', of: 'foam.core.auth.LifecycleState' },
    { class: 'Reference', name: 'owner', of: 'foam.core.auth.User' },
    { class: 'StringArray', name: 'tags' }
  ]
});
