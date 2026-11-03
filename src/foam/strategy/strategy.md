<flow name="Strategizer" category="DOC/DEV" spid="foam" label="Strategizer" description="The Strategizer: StrategyReference rows that list which classes can stand in for an interface or base class, the strategizer service, choice views, and per-row permissions." keywords="strategizer,strategy,strategyreference,strategydao,fobjectview,knowledge"/>

# foam.strategy — the Strategizer

## What it is for

A view often needs to ask "which concrete classes can the user pick here?"
A `Schedule` property, for example, should offer Cron, Interval, Time of Day
and so on, not every class in the system that happens to extend `Schedule`.
FOAM cannot answer that question at runtime by itself: the Java side has no
reverse index from an interface to its implementors, and the client only
knows about classes that were loaded into the browser.

The Strategizer answers it from data instead. Each row in `strategyDAO` says
"class *S* is a valid choice wherever a *D* is wanted". In this package's
vocabulary:

- **desired model** — the interface, abstract base class or concrete class
  that a property or view asks for (`desiredModelId`, e.g.
  `foam.core.cron.Schedule`).
- **strategy** — one class that can stand in for it, either because it
  implements the interface or because it extends the class (`strategy`, e.g.
  `foam.core.cron.CronSchedule`).

Because the list is journal data, an application can add choices to a
framework type, hide choices per group through permissions, and relabel
choices, all without changing code.

## Why it is called the Strategizer

The name comes from the **Strategy design pattern** (Gang of Four). In that
pattern, an interface describes one job, several classes implement it in
different ways, and the object that needs the job done holds a reference to
the interface. It does not care which class it gets, so the implementation
can be swapped without changing that object. Each interchangeable
implementation is called a *strategy*.

FOAM uses this shape everywhere. A cron job holds a `foam.core.cron.Schedule`,
and `CronSchedule`, `IntervalSchedule` and `TimeOfDaySchedule` are strategies
for it. A rule holds a `foam.mlang.predicate.Predicate`, and `Eq`, `And` and
`StartsWith` are strategies for that.

The pattern explains how to use a strategy once you have chosen one. It says
nothing about how a user picks one from a list, and that is the gap this
package fills. The Strategizer is a **directory of the strategies available
for an interface**: give it the interface (the desired model) and it returns
the classes registered as strategies for it. `foam.strategy` also stretches
the term a little: a subclass of a base class counts as a strategy for that
class, even when the base class is concrete and not an interface
(`StrategizerService.js:19-29`).

## Files in this package

| File | Role |
|------|------|
| `StrategyReference.js` | The row model: `id`, `desiredModelId`, `strategy`, `target`, `label` (`StrategyReference.js:22-75`). |
| `StrategizerService.js` | The service interface with one method, `query(x, desiredModelId, target, strategyPredicate)`, returning `StrategyReference[]` (`StrategizerService.js:51-76`). `proxy: true` and `skeleton: true` generate the proxy and the box skeleton used for the network call. |
| `BasicStrategizer.js` | The server implementation: builds a predicate and selects from `strategyDAO` (`BasicStrategizer.js:33-64`). |
| `ClientStrategizerService.js` | The client stub; forwards `query` over the network to the server (`ClientStrategizerService.js:15-21`). |
| `services.jrl` | Registers `strategyDAO` and `strategizer` (see below). |
| `permissions.jrl` | Declares the service and CRUD permissions. |

## StrategyReference fields

| Property | Type | Meaning |
|----------|------|---------|
| `id` | String | Unique key. The DAO is configured with `setGuid(true)` (`services.jrl:8`), so a row without an id gets a GUID. Many journals use a readable id instead, such as `"NotificationSetting-EmailSetting"` or `"dynamic.DLong"`. The id matters for permissions (see Permissions). |
| `desiredModelId` | String, required | Full id of the model being asked for, e.g. `foam.mlang.predicate.Predicate`. |
| `strategy` | Class, required | The class offered as a choice, e.g. `foam.mlang.predicate.Eq`. Being a `Class` property, it arrives at the client as the class itself, not as a string. |
| `target` | String | Optional tag that hides a strategy from general queries. See below. |
| `label` | String | Overrides the class's label in the choice list, e.g. `"In-App Notification"` for `foam.core.notification.NotificationSetting`. |

### `target`

A strategy that only makes sense in one situation sets `target`. A query
without a target returns only rows whose `target` is empty; a query with a
target returns rows whose `target` is empty *or* equal to it
(`BasicStrategizer.js:40-51`). The model's documentation gives the example of
an ISO 20022 `Outputter` that applies only to transactions: it carries
`target: 'Transaction'` and is offered only when the caller asks for
`Outputter` with that target (`StrategyReference.js:47-68`).

No row in the current deployment sets `target`; all 129 references in
`/opt/paytic/journals/strategyReferences.0` are general.

## Services

Both services are declared in `services.jrl` and both have `serve: true`, so
the client can reach them.

### `strategyDAO`

An `EasyDAO` of `StrategyReference` with a GUID id, a single journal named
`strategyReferences`, and property indexes on `desiredModelId` and `target`
(`services.jrl:6-15`). The client gets a plain client DAO with
`remoteListenerSupport: false` (`services.jrl:17-22`), so open views are not
told when a row changes.

`EasyDAO` adds the standard authorization decorator (`services.jrl:24`), which
is what makes per-row read permissions work.

### `strategizer`

`BasicStrategizer` on the server, exposed through
`StrategizerServiceSkeleton` (`services.jrl:31-32`). On the client it is a
`ClientStrategizerService` whose delegate is a `SessionClientBox` around an
`HTTPBox` posting to `service/strategizer` (`services.jrl:34-45`), so calls
carry the user's session.

## How `query` works

`BasicStrategizer.query` (`BasicStrategizer.js:35-63`):

1. Throws if `desiredModelId` is empty.
2. Builds the default predicate:
   `desiredModelId == D AND target == ""`, or, when a target is given,
   `desiredModelId == D AND (target == "" OR target == T)`.
3. If `strategyPredicate` is not null, **replaces** the default predicate with
   it entirely (`BasicStrategizer.js:53-55`). The caller's predicate is not
   ANDed with the default one, so `desiredModelId` and `target` are ignored in
   that case and the predicate must select the right rows by itself.
4. Selects from `strategyDAO.inX(x)`, so the authorization decorator filters
   out rows the current user may not read, and returns the remaining rows as
   an array.

Results come back in DAO order. `FObjectView` sorts them by label on the
client; the two choice views below do not.

## Consumers

| Consumer | How it calls the service |
|----------|--------------------------|
| `foam.u2.view.FObjectView` | Imports `strategizer?`. When present it calls `query(null, this.of.id, null, this.predicate)`, maps each reference to `[strategy.id, label \|\| strategy.model_.label]` and sorts by label (`foam3/src/foam/u2/view/FObjectView.js:207-231`). With no references it offers the `of` class itself unless `skipBaseClass` is set. Without a strategizer in context it falls back to `choicesFallback`, which walks the implements and extends relations (`FObjectView.js:232-235`). |
| `foam.u2.view.StrategizerChoiceView` | A `ChoiceView` with `desiredModelId` and `target` properties. Re-queries when either changes; the first choice is `[null, 'Select...']`; the choice value is the strategy class itself (`foam3/src/foam/u2/view/StrategizerChoiceView.js:33-55`). |
| `foam.u2.view.StrategizerRichChoiceView` | A searchable `RichChoiceView`. Queries once in `init`, loads `LabeledValue`s into an `MDAO`, and falls back to `strategy.name` (not the model label) when `label` is empty (`foam3/src/foam/u2/view/StrategizerRichChoiceView.js:62-86`). |
| `com.paytic.dynamic.DModel` | Passes `EQ(DESIRED_MODEL_ID, 'com.paytic.dynamic.DProperty')` as the `FObjectView` predicate for property types (`src/com/paytic/dynamic/DModel.js:189`). |
| `com.paytic.identity.ProgramMappingRuleActionView` | Passes a predicate on `StrategyReference.ID` to show only the program-mapping rule actions (`src/com/paytic/identity/ProgramMappingRuleActionView.js:44-52`). |
| `com.paytic.flow.fileupload.FileUploadConfig` | Reads `strategyDAO` directly, without the strategizer, to list `DProperty` types (`src/com/paytic/flow/fileupload/FileUploadConfig.js:1852-1853`). |

### Example: restricting the choices on one property

```js
{
  name: 'exampleProp',
  view: function(_, X) {
    var predicate = X.data.AND(
      X.data.EQ(foam.strategy.StrategyReference.DESIRED_MODEL_ID, 'foam.core.auth.User'),
      X.data.IN(foam.strategy.StrategyReference.STRATEGY, [
        foam.lookup('foam.core.auth.SomeUserClass'),
        foam.lookup('foam.core.auth.AnotherUserClass')
      ])
    );
    return foam.u2.view.FObjectView.create({
      data:      X.data.exampleProp,
      of:        foam.core.auth.User,
      predicate: predicate
    }, X);
  }
}
```

Keep the `DESIRED_MODEL_ID` clause: because the predicate replaces the
default one, leaving it out would return matching rows for every desired
model.

## Registering a strategy

Add a `strategyReferences.jrl` file next to the package's `pom.js` (journal
files in a pom directory load automatically):

```js
p({
  "class": "foam.strategy.StrategyReference",
  "id": "foam-core-cron-SimpleIntervalSchedule",
  "desiredModelId": "foam.core.cron.Schedule",
  "strategy": "foam.core.cron.SimpleIntervalSchedule",
  "label": "Simple Interval"
})
```

At build time `JournalMaker` concatenates every `strategyReferences.jrl` in the
build into one runtime journal, prefixing each file's rows with
`// The following lines were copied from "<path>"`
(`foam3/tools/JournalMaker.js:140-168`). The result is
`/opt/paytic/journals/strategyReferences.0` in a PTV3 deployment.

Guidelines:

- Use a readable, stable `id`. Permissions are granted by id, and a GUID like
  `179551cb-2c89-4f86-9eeb-03219a822723` says nothing in a permission grant.
  Prefix ids by area (`dynamic.DLong`) so a wildcard grant such as
  `strategyreference.read.dynamic.*` can cover the whole family.
- The strategy class must be in the pom for both JS and Java, or the
  reference arrives with an empty `strategy` and the views log
  `Invalid strategy reference: <id>` and skip it.
- Set `label` when the class's own label is not what a user should see.
- Leave `target` empty unless the strategy must be hidden from general
  queries.

## Permissions

`permissions.jrl` declares:

| Permission | Grants |
|------------|--------|
| `service.strategyDAO` | Access to the `strategyDAO` service. |
| `service.strategizer` | Access to the `strategizer` service. |
| `strategyreference.create` | Creating references. |
| `strategyreference.read.*` | Reading every reference. |
| `strategyreference.update.*` | Updating references. |
| `strategyreference.remove.*` | Removing references. |

Read access is checked per row as `strategyreference.read.<id>`. Since the
strategizer queries through `inX(x)`, a user sees only the choices they hold
read permission for. PTV3 uses this to scope choices by role, for example:

- `RoleReflow` holds `strategyreference.read.dynamic.*`, which covers the
  `dynamic.*` property types (`journals/groupPermissionJunctions.jrl:278`).
- `RoleInvoicing` holds `strategyreference.read.com.paytic.flow.invoice.*`
  (`journals/groupPermissionJunctions.jrl:319`).
- `RoleReflowSchedule` holds one grant per `Schedule` strategy id
  (`journals/groupPermissionJunctions.jrl:363-367`).

A user without any matching read permission gets an empty result, and
`FObjectView` then offers only the base class.

## Strategies in the current deployment

From `/opt/paytic/journals/strategyReferences.0` (129 references):

| Desired model | Count | Strategies | Source journal |
|---------------|------:|------------|----------------|
| `foam.mlang.predicate.Predicate` | 34 | `Eq`, `Neq`, `And`, `Or`, `True`, `False`, `Contains`, `ContainsIC`, `StartsWith`, `StartsWithIC`, `EndsWith`, `In`, `Lt`, `Lte`, `Gt`, `Gte`, `Has`, `Not`, `IsInstanceOf`, `Keyword`, `DotF`, `IsClassOf`, `RegExp`, `OlderThan`; ruler predicates `NewEqOld`, `PropertyChangePredicate`, `PropertyEQProperty`, `PropertyEQValue`, `PropertyHasValue`, `PropertyIsClass`, `PropertyIsInstance`, `PropertyNEQValue`; `SpidAwarePredicate` ("SPID Aware"), `SpidHierarchyPredicate` ("SPID Hierarchy") | `foam3/src/strategyReferences.jrl` |
| `foam.mlang.Expr` | 15 | `PropertyExpr`, `Constant`, `ArrayConstant`, `PredicateExpr`, `ContextObject`, `CurrentTime`, `StringLength`, `IdentityExpr`, `IsValid`, `Dot`, `Add`, `Subtract`, `Divide`, `Multiply`, `TimeOfDay` | `foam3/src/strategyReferences.jrl` |
| `foam.Class` | 2 | `foam.core.auth.User`, `foam.core.auth.Group` | `foam3/src/strategyReferences.jrl` |
| `foam.util.BaseFluentSpec` | 3 | `AddFluentSpec`, `RemoveFluentSpec`, `AddBeforeFluentSpec` | `foam3/src/foam/util/` |
| `foam.core.auth.Credential` | 11 | `Credential`, `JOSEPayloadCredential`, `BearerCredential`, `MastercomAPICredential`, `JWTCredential`, `VisaAPICredential`, `BasicAuthCredential`, `SigningKeyCredential`, `SSHCredential`, `JschCredential`, `GpgCredential` | `foam3/src/foam/core/auth/`, `src/com/paytic/schema/credentials/` |
| `foam.core.grant.Grant` | 9 | `SuperUserGrant`, `PermissionGrant`, `CompoundGrant`, `SharedGrant`, `UserGrant`, `GroupGrant`, `SPIDGrant`, `PermissionedGrant`, `RecordingGrant` | `foam3/src/foam/core/grant/` |
| `foam.core.ticket.Ticket` | 4 | `UserLifecycleTicket`, `PIIReportTicket`, `UserCapabilityTicket`, `Ticket` | `foam3/src/foam/core/{auth/ruler,pii,crunch,ticket}/` |
| `foam.core.so.SystemOutageTask` | 2 | `SystemNotificationTask`, `MessageTask` | `foam3/src/foam/core/so/` |
| `foam.core.cron.Schedule` | 5 | `OrSchedule`, `CronSchedule`, `IntervalSchedule`, `SimpleIntervalSchedule`, `TimeOfDaySchedule` | `foam3/src/foam/core/cron/` |
| `foam.core.notification.NotificationSetting` | 6 | `NotificationSetting` ("In-App Notification"), `EmailSetting`, `SlackSetting`, `GoogleChatSetting`, `SMSSetting`, `PushSetting` | `foam3/src/foam/core/notification/` |
| `foam.core.notification.broadcast.BroadcastNotificationFacade` | 1 | itself ("Broadcast Notification") | `foam3/src/foam/core/notification/broadcast/` |
| `foam.core.ruler.RuleAction` | 3 | `JShellRuleAction`, `ProgramMappingRuleAction`, `AutoProgramMappingRuleAction` | `journals/strategyReferences.jrl` |
| `com.paytic.dynamic.DProperty` | 10 | Long, String, Boolean, Double, Date, DateTime, DateTimeUTC, Currency, CurrencyCode, CountryCode property types, each with a format hint in its label | `src/com/paytic/dynamic/` |
| `com.paytic.flow.invoice.LineItem` | 5 | `BasicLineItem`, `ServiceLineItem`, `ProductLineItem`, `DiscountLineItem`, `FeeLineItem` | `src/com/paytic/flow/invoice/` |
| `com.paytic.flow.invoice.fee.FeeType` | 4 | `FixedPerUnitFeeType`, `FixedPerVolumeUnitFeeType`, `PercentageOfVolumeFeeType`, `TieredDynamicFeeType` | `src/com/paytic/flow/invoice/fee/` |
| `com.paytic.flow.fileupload.intake.strategy.filedetection.FileDetectionStrategy` | 4 | `ModificationDateStrategy`, `FilenamePatternStrategy`, `CombinedStrategy`, `DateFilterStrategy` | `src/com/paytic/flow/fileupload/intake/` |
| `com.paytic.flow.fileupload.intake.strategy.routing.FileRoutingStrategy` | 4 | `MappingBasedRoutingStrategy`, `PatternBasedRoutingStrategy`, `ChainedRoutingStrategy`, `StaticRoutingStrategy` | `src/com/paytic/flow/fileupload/intake/` |
| `com.paytic.flow.fileupload.intake.strategy.filedetection.dateconditions.DateCondition` | 3 | `DaysBackCondition`, `DateRangeCondition`, `FromDateCondition` | `src/com/paytic/flow/fileupload/intake/` |
| `com.paytic.flow.fileupload.intake.channels.ChannelConfig` | 3 | `LocalChannel`, `SFTPChannel`, `S3Channel` | `src/com/paytic/flow/fileupload/intake/` |
| `com.paytic.flow.fileupload.intake.strategy.filedetection.dateextractors.DateExtractor` | 1 | `FilenameDateExtractor` | `src/com/paytic/flow/fileupload/intake/` |

The journal is regenerated on every build, so treat this table as a snapshot
and read the journal for the current list.
