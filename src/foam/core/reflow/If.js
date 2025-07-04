/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'If',

  imports: [
    'eval_',
    'currentBlock'
  ],

  properties: [
    {
      class: 'String',
      name: 'condition'
    },
    {
      class: 'String',
      name: 'ifBlock',
      reactive : false
    },
    {
      class: 'String',
      name: 'elseBlock',
      reactive : false
    }
  ],

  actions: [
    async function run() {
      if (this.condition) {
        try {
          var conditionBlock = await this.eval_(this.condition, true);
          var conditionResult = conditionBlock.value ? conditionBlock.value.value : false;
          conditionBlock.del();
          
          var scriptToExecute = conditionResult ? this.ifBlock : this.elseBlock;
          
          if (scriptToExecute) {
            await this.eval_(scriptToExecute);
          }
        } catch (ex) {
          console.error('Error evaluating if condition:', ex);
        }
      }
    }
  ]
});