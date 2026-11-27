# Who sees a flow, a command and an agent

Paths are under `src/foam/core/reflow/` unless another root is named. For how to grant a permission, see `foam-feature-wiring` ("The permission catalogue enforces nothing; the grant does").

## Four gates

| Gate | What it decides | Where |
|---|---|---|
| menu | whether the person can open the Console at all | `menu.read.flow` (the REFLOW menu) or `menu.read.flow_` (the hidden one the "reflow" row action opens); `src/menus.jrl:306-335` |
| flow row | whether the person can read or change this flow | `Flow.accessLevel`, creator, `specifiedUserAccess` |
| tenant | whether the person's service provider (spid) may read the flow's spid | `Flow` is `ServiceProviderAware` (`Flow.js:17`) |
| block | whether a command or agent exists in the person's scope | `command.read.<id>`, `agent.read.<id>` |

## `FlowAccess`

`FlowAccess` has four values (`FlowAccess.js:11-16`). `Flow.accessLevel` defaults to `PUBLIC_RW` (`Flow.js:144-150`).

| Level | Who may read | Who may change |
|---|---|---|
| `PRIVATE` | the creator, and an admin (`*`) | the creator and an admin |
| `PUBLIC_RO` | everyone who can read the flow's tenant | the creator and an admin |
| `PUBLIC_RW` | everyone who can read the flow's tenant | everyone who can read it |
| `SHARED` | the users in `specifiedUserAccess` with read or write | the users in `specifiedUserAccess` with write |

The checks are in `authorizeOnRead` and `authorizeWrite` (`Flow.js:289-314`, `:348-373`). Both let the creator and any caller who passes `auth.check(x, "*")` through first (`:292-293`, `:355-356`). `authorizeOnCreate` is open (`:274-278`).

A save that changes who can reach the flow, meaning `accessLevel`, `createdBy` or `specifiedUserAccess`, is for the stored creator or an admin only. The test reads the stored copy, not the one being saved, so an editor of a `PUBLIC_RW` flow can change the blocks but cannot make the flow `PRIVATE` (`Flow.js:316-342`; `test/FlowAuthorizationTest.js` covers it).

`SHARED` in foam3 lists users only. The comment `// check role access` in `authorizeOnRead` throws, so a role list needs an application refinement of `Flow`.

Access is enforced by `flowDAO`, not by the Console. `flowDAO` is an `EasyDAO` whose `authorize` defaults to true and whose `Authorizable` model uses its own `authorizeOn*` methods (`services.jrl:57-78`, `dao/EasyDAO.js:531-545`). `PRESENTATION` mode hides the editor and is not a security boundary.

Set the level on purpose. The default lets every reader of the tenant edit the flow. A flow with sensitive numbers should be `PRIVATE`, or `SHARED` with named users.

## Tenant

A `ServiceProviderAware` row carries a `spid`. On a create with no `spid`, `ServiceProviderAwareDAO` stamps the creator's; with one, it checks `serviceprovider.read.<spid>` (`core/auth/ServiceProviderAwareDAO.js:144-152`). `flowDAO` then returns only rows whose spid the reader may read. A flow saved by a user of one tenant is invisible to users of a tenant that cannot read it, whatever its access level. Confirm with a real user of each tenant, since an admin passes every check.

## Sections and properties with their own permission

- `Flow.scriptSection` (`preLoadScript` and `script`) has `permissionRequired: true`, so the person needs `flow.section.scriptsection` to see or edit the raw script in the Flow detail view (`Flow.js:61-67`).
- `spid` and `childLock` have `readPermissionRequired` and `writePermissionRequired` (`Flow.js:170-177`, `:263-269`). `childLock` stops blocks being added, moved or removed (`Console.js:238-239`, `:2114-2118`, `:2190`, `Block.js:241`).
- `limitedEditPermission` names the permission that turns on the limited-edit controls for one flow; a block opts in with `allowLimitedEdit` (`Flow.js:95-100`, `Console.js:384-402`, `Block.js:135-139`).

## Commands and agents

`Command` and `SinkAgent` are `Authorizable`. A row with `permissionRequired: true` is readable only with `command.read.<id>` or `agent.read.<id>` (`cmd/Command.js:78-90`, `SinkAgent.js:55-67`). Updating or removing a row needs `command.update.<id>` or `command.remove.<id>` whatever the flag says (`cmd/Command.js:91-112`, `SinkAgent.js:68-89`). Both DAOs are authorized `EasyDAO`s, so an unreadable row is left out of the select (`services.jrl:79-100`, `cmd/services.jrl`, `core/auth/AuthorizationDAO.js:91-94`).

Two effects follow.

- The Console builds its scope from the select (`Console.js:1453-1464`). A command the person may not read is not defined, and typing it gives `x is not defined`, not a permission error.
- A saved flow that uses a gated command loads for a person without the grant as a `BadBlock` for that block, and the rest of the flow loads (`Console.js:1352-1360`, `:1669-1686`). A gated agent only leaves the picker: `agent.read` filters `agentDAO`, and a saved agent class still loads and runs (`SinkAgent.js:60-64`, `SinkView.js:56`, `:93`, `parser/SinkParser.js:28`).

A flow shared with people who lack a command grant therefore needs the grant given to them or the block removed. Server scripts (`shell`, `beanshell`, `jshell`) are gated this way and have catalogue rows in `cmd/permissions.jrl`.

## Knowledge Base pages

A flow whose `keywords` include `knowledge` is listed on the Knowledge Base menu (`menus.jrl:1-70`). The page only filters by keyword and spid; who can open each document is still `accessLevel` and the tenant. The pages are read-only in that list (create, edit and delete predicates are false, `menus.jrl:16-19`). See `doc/guides/Reflow.md`, "Knowledge Base Documents".

## Checklist for a new flow, command or agent

1. Choose `accessLevel`. Leave `PUBLIC_RW` only for a flow anyone in the tenant may change.
2. For a gated command or agent, add the catalogue row and grant it in a group or module. Test as a non-admin from each tenant.
3. Check the menu: the person needs `menu.read.flow` or `menu.read.flow_`, and the ancestor menu of a leaf (`foam-feature-wiring`).
