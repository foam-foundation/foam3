/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Trigger',

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
      name: 'script'
    }
  ],

  actions: [
    async function run() {
      if ( this.condition && this.script ) {
        try {
          var conditionBlock = await this.eval_(this.condition, true);
          var conditionResult = conditionBlock.value ? conditionBlock.value.value : false;
          // Delete the condition block since we don't need it
          conditionBlock.del();
          
          if ( conditionResult ) {
            await this.eval_(this.script);
          }
        } catch (ex) {
          console.error('Error executing trigger script:', ex);
        }
      }
    }
  ]
});