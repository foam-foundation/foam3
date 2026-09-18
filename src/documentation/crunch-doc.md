<flow name="crunch-doc" category="DOC/DEV" spid="foam" label="CRUNCH Documentation" description="CRUNCH developer guide: Capability, prerequisites, permissions, required information, and wizard configuration." keywords="crunch,capability,wizard,permissions"/>

# Continuous Reactive User Nano-Capability Hierarchy

<foam class="foam.flow.widgets.DocumentationIncomplete" status="wip" />

CRUNCH is a CORE subsystem that enables flexible definitions of incremental steps users can take to gain access to features of an application. A key principle of CRUNCH is the user will only enter new information at the time it's required to perform an action. (although it is possible to have users add information ahead of time also)

## Purpose of this Document

This document aims to help a developer use CRUNCH within a larger application.
For documentation on CRUNCH internals, see `.flow` documents inside the
`foam.core.crunch` package itself.

## CRUNCH Concepts

### Capability

A `Capability` is an action that can be performed on the system. Most capabilities will simply be instances of `foam.core.crunch.Capability` in the journal, although subclasses of Capability can be used when special behaviours are desired.

Basic configuration of a capability includes specifying what permissions it grants, what information is required from the user, and and when the capability appears.

A capability may also depend on other capabilities by its `prerequisites` relationship. In this way, CRUNCH facilitates controlled and incremental aquisition of capabilities.

#### Specify Permissions

To specify permissions, use the following property.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['permissionsGranted']" />

Specifying permissions is optional. A capability which grants no permissions can be useful for grouping other capabilities.

#### Specify Required Information

A capability may require some input from the user. For example, a capability allowing a user to create new content may require their acceptance of a privacy policy.

The following properties help to specify required information and how it will be processed:
<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['of','daoKey','contextDAOFindKey']" />

The class specified by `of` will be displayed to the user before the capability is granted. An instance of this class will be stored in a junction between User and Capability. (the UserCapabilityJunction)

The `daoKey` property can be used to specify another DAO where the data will be stored. If this is specified, property names of the class specified by the Capability's `of` should match property names of the class specified by the DAO's of.

The `contextDAOFindKey` property allows an object in the context to be used as a starting point for the object that is stored in the DAO specified by `daoKey`. For example, a capability which sets a property of `User` can specify `subject.user` as the `contextDAOFindKey`.

#### Configure how capabilities appear in a wizard

### Wizard configuration with root capability

Whenever a CRUNCH wizard is started, the root capability is able to configure
global behaviour of the wizard by providing its own EasyCrunchWizard object. It
is important to note that a capability will only configure the wizard if it is
the root capability - usually the most dependant capability in a tree invoked by
the intercept.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['wizardConfig']" />

The options available for StepWizardConfig are in the scope of wizard documentation.

As an example, the following journal entry describes a capability that will
configure the wizard to disallow skipping sections.

```
p({
  "class": "foam.core.crunch.Capability",
  "id": "crunch.example",
  "name": "Example Capability",
  "of": "foam.core.crunch.example.ExampleData",
  "wizardConfig": {
    "class": "foam.u2.crunch.EasyCrunchWizard",
    "allowSkipping": false
  }
})
```

### Wizardlet configuration for a specific capability

#### Specify When the Capability Appears

In CRUNCH, visibility and availability are two separate concepts. Visibility
<u>with respect to capabilities</u><sup>1</sup> determines whether or not a
capability is dislpayed in the capability store, while availability determines
whether or not a capability is available by any means to the user, such as by
being a prerequisite of another capability. Additionally, whether or not a
capability is a prerequisite of another can be determined by using the
`predicate` property of CapabilityCapabilityJunction.

The **visibilityPredicate** property of Capability can specify under what
conditions the capability is visible. This uses context predicates (predicates
which receive a context as their object to evaluate on), simlar to rule
predicates.

For example, if we wanted to display "Example Capability" only when another
capability, "crunch.example.prerequisite" is granted, we can use the following
configuration:

```
p({
  "class": "foam.core.crunch.Capability",
  "id": "crunch.example",
  "name": "Example Capability",

  ...

  "visibilityPredicate": {
    "class": "foam.core.crunch.predicate.CapabilityIsStatus",
    "capabilityId": "crunch.example",
    "subjectFromUCJ": false
  },
})
```

The **availabilityPredicate** property of Capability takes the same type of
predicate as does visibilityPredicate, but instead of controlling the
capability's visibility in the Capability Store in controls whether or not the
user can receive information that this capability exists, or perform actions
that assume it exists.

In CapabilityCapabilityJunction, the **predicate** property may be set to a
context predicate that determines when the prerequisite junction is active.
A common example of this is for conditional prerequisites added by a rule
action; this can be done by setting a predicate that evaluates to false until
a junction has not been manually set.

Another important factor in the visibility of capabilities is whether or not
there exists a Capability-CapabilityCategory junction. If a capability is not
in a category, it is possible it will not appear in the Capability Store. A
notable exception is if the capability's `keywords` property contains the
"featured" keyword. In this case, the capability will display as a large card
at the top of the Capability store.

---

`[1] The CRUNCH wizard also distiguishes between visibility and availability, but in this case it is concerning wizardlets and is completely independant of Capability availability and visibility.`

### Capability Prerequisites

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

### CRUNCH Intercepts

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

### Capability Categories

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

### Capability User Associations

Some applications may support an "acting as" behaviour for users; for example: a user may act on behalf of a company or organization, which is another type of user. When using CORE's application logic, the object `subject` in context has two properties to determine each user.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.auth.Subject" whitelist="['realUser', 'user']" />

A capability can specify how the user is associated to the capability using the `associatedEntity` property.

<foam class="foam.flow.widgets.PropertyShortSummary" of="foam.core.crunch.Capability" whitelist="['associatedEntity']" />

Setting `associatedEntity` to one of these values will affect which user CRUNCH grants the capability to. The default value is USER, so capabilities will be granted to the effective user if this is not set.

<foam class="foam.flow.widgets.EnumSummary" of="foam.core.crunch.AssociatedEntity" />

## Subclasses of Capability

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

## CRUNCH Rules

<foam class="foam.flow.widgets.DocumentationIncomplete" status="todo" isSection="true" />

notes: ValidateUCJDataOnPut sets of-less cap to PENDING, then
       SetUCJStatusOnPut will set it to GRANTED or keep it PENDING (or ??)
