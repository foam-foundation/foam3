<flow name="CrunchLite" category="DOC/DEV" spid="foam" description="CRUNCH Lite: storing capability data on objects via the Capable interface instead of associating it with a user." keywords="crunch lite,capable,capability"/>

# CRUNCH Lite

<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" />

Note: code snippets are all written in Javascript syntax, although this is not
  meant to imply that every method called has a javascript implementation.

## What is `crunch.lite`?

CRUNCH Lite makes it possible for capability data to be stored on objects rather
than in association with a user. This allows control over data a user has to
submit to do something with a specific object.

For example, an object representing a choice of icecream may require the user
to choose at least one flavour. Because we know the configuration of icecream
can be complicated, we choose to make Icecream implement Capable, which adds
CRUNCH Lite features to our Icecream model.

## How-To

### Implement `Capable`

```
foam.CLASS({
  package: 'com.example.2scoop4u',
  name: 'Icecream',
  implements: [ 'foam.core.crunch.lite.Capable ],
  
  properties: [
    // Copy essential properties for Capable
    ...(foam.core.crunch.lite.CapableObjectData
      .getOwnAxiomsByClass(foam.lang.Property)
      .map(p => p.clone())),
  ],

  methods: [
    // Copy essential methods for Capable
    ...(foam.core.crunch.lite.CapableObjectData
      .getOwnAxiomsByClass(foam.lang.Method)
      .map(m => m.clone())),
  ]
});
```

### Add a requirement to a Capable

To add a capability that a Capable object requires its own copy of, use the
`addRequirement` method.
`myCapable.addRequirement('MY-CAPABILITY-ID');`

To specify the capabilities that represent a user's prerequisite for filling
Capable requirements, use `setUserCapabilityRequirements`. This will cause an
additional CRUNCH intercept if the user is missing this capability.
`myCapable.setUserCapabilityRequirements(['USER-CAPABILITY-ID']);`

### Verify Requirements

To verify that a capable object has one or more requirements, use the
`verifyRequirements` method. This will throw IllegalStateException if any of
the capabilities listed are not granted.

`myCapable.verifyRequirements(x, ['MY-CAPABILITY-ID']);`

### Invoking a CRUNCH intercept

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

To invoke a CRUNCH intercept, throw a CapabilityRuntimeException. A common way
of doing this is by checking the requirement in a rule.
